import Foundation

/// A set of weekdays as a bitmask: bit 0 is weekday 1, SUNDAY, through bit 6
/// for Saturday, matching the wire's comma list (`rpt`, `repeats`, `re`).
struct WeekdaySet: OptionSet, Hashable, Sendable {
    let rawValue: UInt8

    static let everyDay = WeekdaySet(rawValue: 0b111_1111)
    static let weekdays = WeekdaySet(days: [2, 3, 4, 5, 6])
    static let weekend = WeekdaySet(days: [1, 7])

    /// Short names in WIRE order: index 0 is weekday 1, Sunday.
    static let shortNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    /// Display order, Monday first; the wire order is unaffected.
    static let displayOrder = [2, 3, 4, 5, 6, 7, 1]

    init(rawValue: UInt8) {
        self.rawValue = rawValue & 0b111_1111
    }

    /// Days 1...7; anything else is ignored.
    init(days: [Int]) {
        self.init(rawValue: days.filter { (1...7).contains($0) }.reduce(0) { $0 | (1 << ($1 - 1)) })
    }

    /// The wire's comma list, or nil when it is not one the server accepts:
    /// every part must be a day 1...7 and there must be at least one.
    init?(wire: String) {
        var days: [Int] = []
        for part in wire.split(separator: ",", omittingEmptySubsequences: false) {
            guard let day = Int(part.trimmingCharacters(in: .whitespaces)), (1...7).contains(day) else { return nil }
            days.append(day)
        }
        guard !days.isEmpty else { return nil }
        self.init(days: days)
    }

    static func day(_ number: Int) -> WeekdaySet { WeekdaySet(days: [number]) }

    var days: [Int] { (1...7).filter { contains(.day($0)) } }

    /// Sorted, de-duplicated, comma-separated: what the server rebuilds anyway.
    var wire: String { days.map(String.init).joined(separator: ",") }

    /// "Every day", "Weekdays", "Weekends", or "Mon, Wed, Fri".
    var summary: String {
        switch self {
        case .everyDay: return "Every day"
        case .weekdays: return "Weekdays"
        case .weekend: return "Weekends"
        case []: return "No days"
        default:
            return Self.displayOrder.filter { contains(.day($0)) }.map { Self.shortNames[$0 - 1] }
                .joined(separator: ", ")
        }
    }

    mutating func toggle(_ day: Int) {
        if contains(.day(day)) { remove(.day(day)) } else { insert(.day(day)) }
    }
}
