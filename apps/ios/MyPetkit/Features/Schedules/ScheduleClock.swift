import Foundation

// PetKit has one scheduling model and four shapes of it. All but one count
// MINUTES since local midnight with Sunday as weekday 1; a feeder meal's `t`
// counts SECONDS. "Local" is always the device's own clock, never the phone's.

enum ScheduleClock {
    /// Minutes in a day. 1440 is the end of the day and only ever a range end.
    static let dayMinutes = 1440
    /// Seconds in a day, the unit of a feeder meal's `t`.
    static let daySeconds = 86_400

    /// Minutes since midnight as "HH:MM"; 1440 prints "24:00". Empty for
    /// anything that is not a minute of the day.
    static func format(minute: Int) -> String {
        guard (0...dayMinutes).contains(minute) else { return "" }
        return String(format: "%02d:%02d", minute / 60, minute % 60)
    }

    /// Feeder seconds since midnight as "HH:MM".
    static func format(second: Int) -> String {
        guard (0..<daySeconds).contains(second) else { return "" }
        return format(minute: second / 60)
    }

    /// "HH:MM", "H:MM", "HHMM" or "HMM" as minutes since midnight. "24:00"
    /// is accepted only when `allowsEndOfDay`, because only a range end may
    /// be the end of the day. Anything else, an empty field included, is nil.
    static func parse(_ text: String, allowsEndOfDay: Bool = false) -> Int? {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        let parts: [Substring]
        if trimmed.contains(":") {
            parts = trimmed.split(separator: ":", omittingEmptySubsequences: false)
            guard parts.count == 2, (1...2).contains(parts[0].count), parts[1].count == 2 else { return nil }
        } else {
            guard (3...4).contains(trimmed.count) else { return nil }
            let split = trimmed.index(trimmed.endIndex, offsetBy: -2)
            parts = [trimmed[..<split], trimmed[split...]]
        }
        guard parts.allSatisfy({ $0.allSatisfy(\.isASCII) && $0.allSatisfy(\.isNumber) }),
              let hours = Int(parts[0]), let minutes = Int(parts[1]) else { return nil }
        if allowsEndOfDay && hours == 24 && minutes == 0 { return dayMinutes }
        guard (0...23).contains(hours), (0...59).contains(minutes) else { return nil }
        return hours * 60 + minutes
    }

    /// An hour offset as "UTC+7", "UTC+5:45", "UTC-3:30".
    static func format(offsetHours: Double) -> String {
        let total = Int((abs(offsetHours) * 60).rounded())
        let sign = offsetHours < 0 ? "-" : "+"
        let minutes = total % 60
        return "UTC\(sign)\(total / 60)" + (minutes == 0 ? "" : String(format: ":%02d", minutes))
    }

    /// "3 h 13 m", "45 m", "2 h".
    static func format(durationMinutes: Int) -> String {
        let hours = durationMinutes / 60, minutes = durationMinutes % 60
        switch (hours, minutes) {
        case (0, _): return "\(minutes) m"
        case (_, 0): return "\(hours) h"
        default: return "\(hours) h \(minutes) m"
        }
    }
}

/// The device's wall clock: a fixed UTC offset in hours, as the server
/// reports it (`effective`) and uses for deferred feeds. Read with this, the
/// phone's own time zone never enters a schedule.
struct DeviceClock: Equatable, Sendable {
    let offsetHours: Double

    var timeZone: TimeZone {
        TimeZone(secondsFromGMT: Int((offsetHours * 3600).rounded())) ?? .gmt
    }

    var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        return calendar
    }

    /// Minutes since the device's midnight at `date`.
    func minuteOfDay(_ date: Date) -> Int {
        let parts = calendar.dateComponents([.hour, .minute], from: date)
        return (parts.hour ?? 0) * 60 + (parts.minute ?? 0)
    }

    /// The device's weekday at `date`, Sunday 1, as the schedules count.
    func weekday(_ date: Date) -> Int {
        calendar.component(.weekday, from: date)
    }

    /// "YYYY-MM-DD" and "HH:MM" on the device's clock: the deferred-feed body.
    func wireDateTime(_ date: Date) -> (date: String, time: String) {
        let parts = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: date)
        let day = String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
        return (day, String(format: "%02d:%02d", parts.hour ?? 0, parts.minute ?? 0))
    }

    /// A unix moment as the device's own "Thu 13 Aug, 17:05".
    func formatMoment(_ unixSeconds: Double) -> String {
        var style = Date.FormatStyle(date: .omitted, time: .omitted, locale: Locale(identifier: "en_GB"),
                                     calendar: calendar, timeZone: timeZone)
        style = style.weekday(.abbreviated).day().month(.abbreviated).hour(.twoDigits(amPM: .omitted)).minute()
        return Date(timeIntervalSince1970: unixSeconds).formatted(style)
    }
}
