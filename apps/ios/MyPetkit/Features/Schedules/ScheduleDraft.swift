import Foundation

// The four schedule shapes as the editor holds them (features/schedules on the
// server). Nothing here sorts, merges or tidies a schedule the device already
// runs: an end before its start crosses midnight, a one-minute window came out
// of PetKit's own app, and both are correct. The only refusals are the ones
// the server makes, so a Save that is enabled is a Save the server accepts.

/// `[start, end]` in minutes since the device's midnight, 0...1440.
struct ScheduleRange: Equatable, Sendable {
    var start: Int
    var end: Int

    /// PetKit's own "entire day"; the only place 1440 normally appears.
    static let allDay = ScheduleRange(start: 0, end: ScheduleClock.dayMinutes)

    var isAllDay: Bool { self == .allDay }
    /// An end before the start runs through midnight.
    var crossesMidnight: Bool { end < start }
    var isValid: Bool { (0...ScheduleClock.dayMinutes).contains(start) && (0...ScheduleClock.dayMinutes).contains(end) }

    var label: String {
        isAllDay ? "All day"
            : "\(ScheduleClock.format(minute: start)) – \(ScheduleClock.format(minute: end))"
    }
}

/// A weekly entry: ranges on chosen weekdays, with an on/off switch.
struct WeeklyEntry: Identifiable, Equatable, Sendable {
    var id = UUID()
    var enabled: Bool
    var days: WeekdaySet
    var ranges: [ScheduleRange]
}

/// One litter-box job at a moment of the day. `type` 0 is a cleaning and 1 a
/// deodorizing; both live in ONE array, so a save always sends all of them.
struct PointEntry: Identifiable, Equatable, Sendable {
    var id = UUID()
    var serverID: Int
    var type: Int
    var days: WeekdaySet
    /// Minutes since midnight, 0...1439.
    var minute: Int
}

/// One feeder meal: `second` counts SECONDS since midnight; `hopper2` is the
/// second hopper of a Dual-Hopper and is kept as served on a single one.
struct FeedMeal: Identifiable, Equatable, Sendable {
    var id = UUID()
    /// The cloud's `n_<seconds>` string, or a number the server turns into one.
    var mealID: ScheduleJSON
    var second: Int
    var hopper1: Int
    var hopper2: Int
}

/// Meals sharing weekdays (`re`).
struct FeedGroup: Identifiable, Equatable, Sendable {
    var id = UUID()
    var days: WeekdaySet
    var meals: [FeedMeal]
}

enum ScheduleKind: String, Sendable {
    case ranges, weekly, points, feed
}

enum ScheduleDraft: Equatable, Sendable {
    case ranges([ScheduleRange])
    case weekly([WeeklyEntry])
    case points([PointEntry])
    case feed([FeedGroup])

    /// Point types the editor names; any other is shown as "Other" and kept.
    static let pointSections: [(type: Int, name: String)] = [(0, "Scheduled cleaning"), (1, "Periodic deodorizing")]

    /// The server's current value read as a working copy. Permissive about
    /// content like the server: a malformed row is read as best it can be and
    /// then caught by `problem`, never silently dropped.
    init(kind: ScheduleKind, value: ScheduleJSON) {
        switch kind {
        case .ranges:
            self = .ranges(Self.ranges(value))
        case .weekly:
            self = .weekly(value.array.map { entry in
                WeeklyEntry(enabled: (entry["enable"].int ?? 1) != 0,
                            days: Self.days(entry["rpt"]), ranges: Self.ranges(entry["time"]))
            })
        case .points:
            self = .points(value.array.map { entry in
                PointEntry(serverID: entry["id"].int ?? 0, type: entry["type"].int ?? 0,
                           days: Self.days(entry["repeats"]), minute: entry["time"].int ?? -1)
            })
        case .feed:
            self = .feed(value["schedule"].array.map { group in
                FeedGroup(days: Self.days(group["re"]), meals: group["it"].array.map { meal in
                    let id = meal["id"]
                    return FeedMeal(mealID: id == .null ? .int(0) : id, second: meal["t"].int ?? -1,
                                    hopper1: meal["a1"].int ?? -1, hopper2: meal["a2"].int ?? 0)
                })
            })
        }
    }

    private static func ranges(_ value: ScheduleJSON) -> [ScheduleRange] {
        value.array.compactMap { pair in
            let parts = pair.array
            guard parts.count == 2 else { return nil }
            return ScheduleRange(start: parts[0].int ?? -1, end: parts[1].int ?? -1)
        }
    }

    private static func days(_ value: ScheduleJSON) -> WeekdaySet {
        WeekdaySet(days: value.text.split(separator: ",").compactMap { Int($0.trimmingCharacters(in: .whitespaces)) })
    }

    // MARK: Validation

    /// Why the server would refuse this draft, as one sentence; nil when valid.
    var problem: String? {
        switch self {
        case .ranges(let ranges):
            return ranges.allSatisfy(\.isValid) ? nil : "A period has a time outside the day."
        case .weekly(let entries):
            if entries.contains(where: { $0.days.isEmpty }) { return "Pick at least one day for each entry." }
            return entries.allSatisfy { $0.ranges.allSatisfy(\.isValid) } ? nil : "A period has a time outside the day."
        case .points(let points):
            if points.contains(where: { $0.days.isEmpty }) { return "Pick at least one day for each time." }
            return points.allSatisfy { (0..<ScheduleClock.dayMinutes).contains($0.minute) }
                ? nil : "A time is outside the day."
        case .feed(let groups):
            if groups.contains(where: { $0.days.isEmpty }) { return "Pick at least one day for each set of meals." }
            let meals = groups.flatMap(\.meals)
            if meals.contains(where: { !(0..<ScheduleClock.daySeconds).contains($0.second) }) {
                return "A meal time is outside the day."
            }
            return meals.allSatisfy { PortionRules.isSchedulePortion($0.hopper1) && PortionRules.isSchedulePortion($0.hopper2) }
                ? nil : "Portions are whole numbers from 0 to \(PortionRules.scheduleMax)."
        }
    }

    // MARK: Wire

    /// The body's `value`. A feeder's schedule object also carries keys this
    /// editor does not own (the pending one-off feeds, the format stamp) and
    /// the server stores the object it is sent, so everything but the meals
    /// comes from `current`, the value the server serves NOW, or a one-off
    /// feed added meanwhile would be deleted by this save.
    func wire(current: ScheduleJSON = .null) -> ScheduleJSON {
        switch self {
        case .ranges(let ranges):
            return Self.wire(ranges)
        case .weekly(let entries):
            return .array(entries.map {
                .object(["enable": .int($0.enabled ? 1 : 0), "rpt": .string($0.days.wire), "time": Self.wire($0.ranges)])
            })
        case .points(let points):
            return .array(points.map {
                .object(["id": .int($0.serverID), "repeats": .string($0.days.wire),
                         "time": .int($0.minute), "type": .int($0.type)])
            })
        case .feed(let groups):
            var object = current.object ?? [:]
            object["schedule"] = .array(groups.map { group in
                .object(["re": .string(group.days.wire), "it": .array(group.meals.map {
                    .object(["id": $0.mealID, "t": .int($0.second), "a1": .int($0.hopper1), "a2": .int($0.hopper2)])
                })])
            })
            return .object(object)
        }
    }

    private static func wire(_ ranges: [ScheduleRange]) -> ScheduleJSON {
        .array(ranges.map { .array([.int($0.start), .int($0.end)]) })
    }

    // MARK: Ids

    /// One above the highest numeric id held: cannot collide with an entry on
    /// the device. The cloud's `n_<seconds>` strings count as 0.
    static func nextID(_ ids: [ScheduleJSON]) -> Int {
        (ids.compactMap { id -> Int? in
            if case .string = id { return nil }
            return id.int
        }.max() ?? 0) + 1
    }
}

/// Portion bounds: a schedule meal is one byte per hopper on the firmware
/// (the server refuses outside 0...255); a one-off feed keeps the limit the
/// web form has always used.
enum PortionRules {
    static let scheduleMax = 255
    static let oneOffMax = 20

    static func isSchedulePortion(_ value: Int) -> Bool { (0...scheduleMax).contains(value) }

    /// Digits only, inside `0...max`; an empty or signed field is nil.
    static func parse(_ text: String, max: Int) -> Int? {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty, trimmed.count <= 4, trimmed.allSatisfy({ $0.isASCII && $0.isNumber }),
              let value = Int(trimmed), (0...max).contains(value) else { return nil }
        return value
    }

    /// "Hopper 1 × 2 · Hopper 2 × 1" on a Dual-Hopper, "2 portions" otherwise.
    static func describe(hopper1: Int, hopper2: Int, dual: Bool) -> String {
        guard dual else { return hopper1 == 1 ? "1 portion" : "\(hopper1) portions" }
        let parts = [(1, hopper1), (2, hopper2)].filter { $0.1 > 0 }.map { "Hopper \($0.0) × \($0.1)" }
        return parts.isEmpty ? "No portions" : parts.joined(separator: " · ")
    }
}
