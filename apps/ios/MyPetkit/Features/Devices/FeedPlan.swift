import Foundation
import PetkitCore

/// One planned meal today: minutes since the device's midnight and its portions.
struct PlannedMeal: Equatable, Sendable {
    let minute: Double
    let first: Double
    let second: Double

    /// "2 portions" / "2 + 1 portions".
    func portionsText(dual: Bool) -> String {
        if dual { return "\(Int(first)) + \(Int(second)) portions" }
        return "\(Int(first)) \(Int(first) == 1 ? "portion" : "portions")"
    }
}

/// Today's meals from a feeder's `feed` schedule target, in the device's day.
enum FeedPlan {
    /// Wire shape (a D4SH `ctrl`): `{schedule: [{re, it: [{id, t, a1, a2}]}]}`,
    /// where `re` is a comma list of weekdays with SUNDAY = 1 and a meal's `t`
    /// counts SECONDS since local midnight (every other schedule counts minutes).
    static func todaysMeals(_ schedules: [ScheduleTarget], zone: TimeZone, now: Date) -> [PlannedMeal] {
        guard let target = schedules.first(where: { $0.kind == "feed" }),
              case .array(let groups)? = target.value?["schedule"] else { return [] }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        let weekday = calendar.component(.weekday, from: now)
        var meals: [PlannedMeal] = []
        for group in groups {
            let days = (group["re"]?.string ?? "").split(separator: ",")
                .compactMap { Int($0.trimmingCharacters(in: .whitespaces)) }
            guard days.contains(weekday), case .array(let items)? = group["it"] else { continue }
            for item in items {
                guard let seconds = item["t"]?.number, seconds >= 0, seconds < 86400 else { continue }
                meals.append(PlannedMeal(minute: seconds / 60, first: item["a1"]?.number ?? 0,
                                         second: item["a2"]?.number ?? 0))
            }
        }
        return meals.sorted { $0.minute < $1.minute }
    }

    /// The first meal after `minute`, if any is left today.
    static func next(_ meals: [PlannedMeal], after minute: Double) -> PlannedMeal? {
        meals.first { $0.minute > minute }
    }

    /// Whether the feed target is dual-hopper (a meal carries a1 and a2).
    static func isDual(_ schedules: [ScheduleTarget]) -> Bool {
        schedules.first { $0.kind == "feed" }?.dual == true
    }
}
