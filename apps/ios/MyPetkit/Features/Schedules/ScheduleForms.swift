import Foundation

// The text a person types into an edit sheet, held as typed. A field that is
// cleared stays cleared and is reported as empty; it never snaps back to the
// value it had, because a sheet showing the old value next to a disabled Done
// button hides the fact that nothing was accepted.

/// What is wrong with one sheet, as one sentence.
struct FormProblem: Error, Equatable {
    let message: String
}

private func clockField(_ text: String, name: String, allowsEndOfDay: Bool) -> Result<Int, FormProblem> {
    if text.trimmingCharacters(in: .whitespaces).isEmpty {
        return .failure(FormProblem(message: "Enter \(name), such as 07:30."))
    }
    guard let minute = ScheduleClock.parse(text, allowsEndOfDay: allowsEndOfDay) else {
        let range = allowsEndOfDay ? "00:00 to 24:00" : "00:00 to 23:59"
        return .failure(FormProblem(message: "\(name.prefix(1).uppercased() + name.dropFirst()) must be a time from \(range)."))
    }
    return .success(minute)
}

private func portionField(_ text: String, name: String, max: Int) -> Result<Int, FormProblem> {
    if text.trimmingCharacters(in: .whitespaces).isEmpty {
        return .failure(FormProblem(message: "Enter the portions for \(name)."))
    }
    guard let value = PortionRules.parse(text, max: max) else {
        return .failure(FormProblem(message: "Portions for \(name) are whole numbers from 0 to \(max)."))
    }
    return .success(value)
}

/// One period: all day, or a start and an end that may cross midnight.
struct RangeForm: Equatable {
    var isAllDay: Bool
    var start: String
    var end: String

    init(isAllDay: Bool = false, start: String = "", end: String = "") {
        self.isAllDay = isAllDay
        self.start = start
        self.end = end
    }

    init(_ range: ScheduleRange) {
        if range.isAllDay {
            self.init(isAllDay: true)
        } else {
            self.init(start: ScheduleClock.format(minute: range.start), end: ScheduleClock.format(minute: range.end))
        }
    }

    /// The server takes 0...1440 for either end, so "24:00" is accepted for both.
    func validated() -> Result<ScheduleRange, FormProblem> {
        if isAllDay { return .success(.allDay) }
        return clockField(start, name: "a start time", allowsEndOfDay: true).flatMap { from in
            clockField(end, name: "an end time", allowsEndOfDay: true).map { ScheduleRange(start: from, end: $0) }
        }
    }
}

/// A weekly entry: switch, weekdays, periods.
struct WeeklyForm: Equatable {
    var enabled = true
    var days: WeekdaySet = .everyDay
    var ranges: [RangeForm] = [RangeForm(isAllDay: true)]

    init() {}

    init(_ entry: WeeklyEntry) {
        enabled = entry.enabled
        days = entry.days
        ranges = entry.ranges.map(RangeForm.init)
    }

    func validated(keeping id: UUID = UUID()) -> Result<WeeklyEntry, FormProblem> {
        if days.isEmpty { return .failure(FormProblem(message: "Pick at least one day.")) }
        var parsed: [ScheduleRange] = []
        for (index, form) in ranges.enumerated() {
            switch form.validated() {
            case .success(let range): parsed.append(range)
            case .failure(let problem):
                return .failure(FormProblem(message: "Period \(index + 1): \(problem.message)"))
            }
        }
        return .success(WeeklyEntry(id: id, enabled: enabled, days: days, ranges: parsed))
    }
}

/// A litter-box job time on weekdays.
struct PointForm: Equatable {
    var time = ""
    var days: WeekdaySet = .everyDay

    init() {}

    init(_ point: PointEntry) {
        time = ScheduleClock.format(minute: point.minute)
        days = point.days
    }

    /// A moment, not a range end: "24:00" is not a time the job can run.
    func validated(onto point: PointEntry) -> Result<PointEntry, FormProblem> {
        if days.isEmpty { return .failure(FormProblem(message: "Pick at least one day.")) }
        return clockField(time, name: "a time", allowsEndOfDay: false).map { minute in
            var updated = point
            updated.minute = minute
            updated.days = days
            return updated
        }
    }
}

/// One feeder meal: a time and a portion count per hopper.
struct MealForm: Equatable {
    var time = ""
    var hopper1 = "1"
    var hopper2 = "0"
    let dual: Bool

    init(dual: Bool) {
        self.dual = dual
    }

    init(_ meal: FeedMeal, dual: Bool) {
        self.dual = dual
        time = ScheduleClock.format(second: meal.second)
        hopper1 = meal.hopper1 >= 0 ? String(meal.hopper1) : ""
        hopper2 = meal.hopper2 >= 0 ? String(meal.hopper2) : ""
    }

    /// A single-hopper feeder never shows hopper 2, so its served value rides
    /// along untouched instead of being validated against a field nobody sees.
    func validated(onto meal: FeedMeal) -> Result<FeedMeal, FormProblem> {
        clockField(time, name: "a time", allowsEndOfDay: false).flatMap { minute in
            portionField(hopper1, name: dual ? "hopper 1" : "this meal", max: PortionRules.scheduleMax).flatMap { first in
                let second: Result<Int, FormProblem> = dual
                    ? portionField(hopper2, name: "hopper 2", max: PortionRules.scheduleMax) : .success(meal.hopper2)
                return second.map { secondValue in
                    var updated = meal
                    updated.second = minute * 60
                    updated.hopper1 = first
                    updated.hopper2 = secondValue
                    return updated
                }
            }
        }
    }
}

/// The body of `addDeferredFeed`, on the feeder's clock.
struct DeferredFeedDraft: Equatable {
    let date: String
    let time: String
    let hopper1: Int
    let hopper2: Int
}

/// A one-off feed: a moment picked on the feeder's clock and portions.
struct DeferredFeedForm: Equatable {
    var moment: Date
    var hopper1 = "1"
    var hopper2 = "0"
    let dual: Bool

    /// The server reads HH:MM and refuses a moment that is not in the future,
    /// so the check is made at the minute that will actually be sent.
    func validated(clock: DeviceClock, now: Date) -> Result<DeferredFeedDraft, FormProblem> {
        let minute = clock.calendar.dateInterval(of: .minute, for: moment)?.start ?? moment
        guard minute > now else {
            return .failure(FormProblem(message: "Pick a time later than now on the feeder's clock."))
        }
        return portionField(hopper1, name: dual ? "hopper 1" : "this feed", max: PortionRules.oneOffMax).flatMap { first in
            let second = dual ? portionField(hopper2, name: "hopper 2", max: PortionRules.oneOffMax) : .success(0)
            return second.map { secondValue in
                let wire = clock.wireDateTime(minute)
                return DeferredFeedDraft(date: wire.date, time: wire.time, hopper1: first, hopper2: secondValue)
            }
        }
    }
}
