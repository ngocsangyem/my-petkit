import Foundation

/// Reading a feeding schedule against the feeder's clock: which meal is next
/// and where today's "now" line falls. Pure, so the phone's zone cannot leak in.
enum ScheduleFeedPlan {
    struct NextMeal: Equatable {
        /// Seconds since the feeder's midnight on the day it falls.
        let second: Int
        /// 0 today, 1 tomorrow, up to 7.
        let daysAhead: Int
        /// Whole minutes from now until the meal.
        let minutesUntil: Int
        /// Weekday of the meal, Sunday 1.
        let weekday: Int
    }

    /// The first meal strictly after `nowSecond` on `weekday`, looking up to a
    /// week ahead; nil when no group has a meal.
    static func nextMeal(groups: [FeedGroup], weekday: Int, nowSecond: Int) -> NextMeal? {
        for ahead in 0...7 {
            let day = (weekday - 1 + ahead) % 7 + 1
            let seconds = groups.filter { $0.days.contains(.day(day)) }
                .flatMap(\.meals).map(\.second)
                .filter { (0..<ScheduleClock.daySeconds).contains($0) && (ahead > 0 || $0 > nowSecond) }
            if let first = seconds.min() {
                let until = ahead * ScheduleClock.daySeconds + first - nowSecond
                return NextMeal(second: first, daysAhead: ahead, minutesUntil: (until + 59) / 60, weekday: day)
            }
        }
        return nil
    }

    /// The lede: "Next meal at 18:00, in 3 h 13 m." / "Next meal tomorrow at 07:00."
    static func sentence(for next: NextMeal?) -> String {
        guard let next else { return "No meals are set. The feeder dispenses only when you press Feed." }
        let time = ScheduleClock.format(second: next.second)
        switch next.daysAhead {
        case 0: return "Next meal at \(time), in \(ScheduleClock.format(durationMinutes: next.minutesUntil))."
        case 1: return "Next meal tomorrow at \(time)."
        default: return "Next meal on \(WeekdaySet.shortNames[next.weekday - 1]) at \(time)."
        }
    }

    /// Where the now line goes among meals sorted by time: before the first
    /// meal that is still to come today.
    static func nowLineIndex(sortedSeconds: [Int], nowSecond: Int) -> Int {
        sortedSeconds.firstIndex { $0 > nowSecond } ?? sortedSeconds.count
    }
}
