import CoreGraphics
import Foundation

/// One lane of the household day strip. Every position is minutes since
/// midnight on the wall clock of the device that produced the mark.
struct DayStripLane: Identifiable, Hashable {
    enum Marks: Hashable {
        /// Toilet visits of one pet; `tintIndex` picks its ink from `Theme.Color.catTints`.
        case visits(minutes: [Double], tintIndex: Int)
        /// Meals: fed ones filled, planned ones outlined.
        case meals([Meal])
        /// When a fountain was reporting, and when it went quiet.
        case fountain([Span])
    }

    struct Meal: Hashable {
        let minute: Double
        let fed: Bool
    }

    struct Span: Hashable {
        let start: Double
        let end: Double
        let reporting: Bool
    }

    let id: String
    let title: String
    let marks: Marks
}

/// The strip's geometry, separated from the drawing so it can be tested: the
/// 24 h axis, where a minute lands, and the device-local minute of an instant.
enum DayStripLayout {
    static let dayMinutes: Double = 24 * 60

    /// Minutes since local midnight on the wall clock of `zone` (fractional).
    /// Wall-clock, not elapsed: on a 23 h or 25 h day an event at 03:30 sits
    /// under the "03:30" of the axis, which is what a person reading it expects.
    static func minuteOfDay(_ date: Date, in zone: TimeZone) -> Double {
        let parts = calendar(zone).dateComponents([.hour, .minute, .second], from: date)
        return Double(parts.hour ?? 0) * 60 + Double(parts.minute ?? 0) + Double(parts.second ?? 0) / 60
    }

    /// Whether two instants fall on the same calendar day in `zone`.
    static func isSameDay(_ first: Date, _ second: Date, in zone: TimeZone) -> Bool {
        calendar(zone).isDate(first, inSameDayAs: second)
    }

    /// "HH:MM" for a minute of the day.
    static func clock(minute: Double) -> String {
        let total = Int(min(max(minute, 0), dayMinutes - 1).rounded(.down))
        return String(format: "%02d:%02d", total / 60, total % 60)
    }

    /// "HH:MM" of an instant on the wall clock of `zone`.
    static func clock(_ date: Date, in zone: TimeZone) -> String {
        clock(minute: minuteOfDay(date, in: zone))
    }

    /// Share of the day, clamped to the axis.
    static func fraction(minute: Double) -> Double {
        min(max(minute / dayMinutes, 0), 1)
    }

    /// The x of a minute on a lane `width` wide.
    static func x(minute: Double, width: CGFloat) -> CGFloat {
        CGFloat(fraction(minute: minute)) * width
    }

    /// The x of the leading edge of a mark `markWidth` wide centred on
    /// `minute`, kept inside the lane so the first and last marks stay whole.
    static func markOrigin(minute: Double, markWidth: CGFloat, width: CGFloat) -> CGFloat {
        let centre = x(minute: minute, width: width)
        return min(max(centre - markWidth / 2, 0), max(width - markWidth, 0))
    }

    /// The x and width of a span, clamped to the axis; nil when it is empty.
    static func spanFrame(_ span: DayStripLane.Span, width: CGFloat) -> (x: CGFloat, width: CGFloat)? {
        let start = x(minute: span.start, width: width)
        let end = x(minute: span.end, width: width)
        return end > start ? (start, end - start) : nil
    }

    private static func calendar(_ zone: TimeZone) -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        return calendar
    }
}
