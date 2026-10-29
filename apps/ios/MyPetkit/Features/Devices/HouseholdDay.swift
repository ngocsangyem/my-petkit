import Foundation
import PetkitCore

/// A pet's day so far: visits and the last one, each read in its device's day.
struct PetDay: Equatable, Sendable {
    var visits = 0
    var last: Date?
    /// The zone `last` is read in.
    var lastZone: TimeZone?

    /// "3 visits · last 13:58", "0 visits".
    var summary: String {
        let count = "\(visits) \(visits == 1 ? "visit" : "visits")"
        guard let last, let lastZone else { return count }
        return "\(count) · last \(DayStripLayout.clock(last, in: lastZone))"
    }
}

/// Everything Home derives from the devices, accessories, today's sessions and
/// pets: each device's zone, per-pet counts and the day strip's lanes.
struct HouseholdDay {
    /// An accessory is "not reporting" after this many missed poll intervals.
    static let missedPolls: Double = 3

    let zones: [Int: TimeZone]
    /// The zone the strip's axis and now line are drawn in: the first device
    /// that has said where it lives. Nil until one has.
    let homeZone: TimeZone?
    let petDays: [Int: PetDay]
    let lanes: [DayStripLane]

    init(devices: [DeviceRecord], accessories: [BleAccessoryRecord], sessions: [TimelineSessionRecord],
         pets: [PetRecord], now: Date) {
        var zones: [Int: TimeZone] = [:]
        for device in devices {
            if let zone = DeviceFacts.zone(device.timezoneInfo) { zones[device.id] = zone }
        }
        self.zones = zones
        homeZone = devices.lazy.compactMap { zones[$0.id] }.first

        // Today's sessions only, each in its own device's day.
        let today: [(session: TimelineSessionRecord, date: Date, zone: TimeZone)] = sessions.compactMap { session in
            guard let id = session.deviceID, let zone = zones[id], let date = session.date,
                  DayStripLayout.isSameDay(date, now, in: zone) else { return nil }
            return (session, date, zone)
        }

        var petDays: [Int: PetDay] = [:]
        var minutesByPet: [Int: [Double]] = [:]
        var unknownMinutes: [Double] = []
        let known = Set(pets.map(\.id))
        for entry in today where entry.session.isVisit {
            let minute = DayStripLayout.minuteOfDay(entry.date, in: entry.zone)
            guard let petID = entry.session.petID, known.contains(petID) else {
                unknownMinutes.append(minute)
                continue
            }
            minutesByPet[petID, default: []].append(minute)
            var day = petDays[petID] ?? PetDay()
            day.visits += 1
            if day.last.map({ entry.date > $0 }) ?? true {
                day.last = entry.date
                day.lastZone = entry.zone
            }
            petDays[petID] = day
        }
        self.petDays = petDays

        var lanes = pets.enumerated().map { index, pet in
            DayStripLane(id: "p\(pet.id)", title: pet.name,
                         marks: .visits(minutes: minutesByPet[pet.id] ?? [], tintIndex: index))
        }
        if !unknownMinutes.isEmpty {
            lanes.append(DayStripLane(id: "unknown", title: "Unknown",
                                      marks: .visits(minutes: unknownMinutes, tintIndex: pets.count)))
        }
        let feeders = devices.filter { DeviceFamily(deviceType: $0.type) == .feeder }
        for feeder in feeders {
            guard let zone = zones[feeder.id] else { continue }
            let nowMinute = DayStripLayout.minuteOfDay(now, in: zone)
            var meals = today.filter { $0.session.deviceID == feeder.id && $0.session.eventKind == "feeding" }
                .map { DayStripLane.Meal(minute: DayStripLayout.minuteOfDay($0.date, in: zone), fed: true) }
            meals += FeedPlan.todaysMeals(feeder.schedules, zone: zone, now: now)
                .filter { $0.minute > nowMinute }
                .map { DayStripLane.Meal(minute: $0.minute, fed: false) }
            lanes.append(DayStripLane(id: "d\(feeder.id)", title: feeders.count == 1 ? "Meals" : feeder.name,
                                      marks: .meals(meals)))
        }
        for device in devices where DeviceFamily(deviceType: device.type) == .fountain {
            guard let zone = zones[device.id] else { continue }
            lanes.append(DayStripLane(id: "d\(device.id)", title: device.name, marks: .fountain(
                Self.fountainSpans(last: DeviceFacts.lastReport(device), quiet: !device.online, zone: zone, now: now))))
        }
        for accessory in accessories where DeviceFamily(deviceType: accessory.bleType) == .fountain {
            guard let zone = accessory.linkWith.flatMap({ zones[$0] }) ?? homeZone else { continue }
            let last = DeviceFacts.epochSeconds(accessory.lastSeen).map { Date(timeIntervalSince1970: $0) }
            let stale = last.map { now.timeIntervalSince($0) > accessory.interval * Self.missedPolls } ?? true
            lanes.append(DayStripLane(id: "a\(accessory.id)", title: accessory.name, marks: .fountain(
                Self.fountainSpans(last: last, quiet: !accessory.parentOnline || stale, zone: zone, now: now))))
        }
        self.lanes = lanes
    }

    /// Reporting up to the last report, then quiet while it has gone silent.
    static func fountainSpans(last: Date?, quiet: Bool, zone: TimeZone, now: Date) -> [DayStripLane.Span] {
        let nowMinute = DayStripLayout.minuteOfDay(now, in: zone)
        guard quiet else { return [.init(start: 0, end: nowMinute, reporting: true)] }
        guard let last, DayStripLayout.isSameDay(last, now, in: zone) else {
            return [.init(start: 0, end: nowMinute, reporting: false)]
        }
        let lastMinute = DayStripLayout.minuteOfDay(last, in: zone)
        return [.init(start: 0, end: lastMinute, reporting: true),
                .init(start: lastMinute, end: nowMinute, reporting: false)]
    }

    /// The next planned meal of a feeder, in its own day.
    func nextMeal(_ device: DeviceRecord, now: Date) -> PlannedMeal? {
        guard let zone = zones[device.id] else { return nil }
        return FeedPlan.next(FeedPlan.todaysMeals(device.schedules, zone: zone, now: now),
                             after: DayStripLayout.minuteOfDay(now, in: zone))
    }
}
