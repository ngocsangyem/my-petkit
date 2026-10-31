import Foundation

/// One retention category of `/api/retention`, as the setup screen labels it,
/// with the server's default caps (`media/retention.py::DEFAULT_RETENTION`).
struct RetentionKind: Identifiable, Equatable {
    let key: String
    let label: String
    let defaultDays: Double
    /// nil for the age-only categories (events, blocked attempts).
    let defaultMegabytes: Double?
    var id: String { key }
    var isSized: Bool { defaultMegabytes != nil }
}

enum RetentionRules {
    /// Display order. `rawUpload` is left out on purpose: staged uploads are
    /// swept with a one-hour floor a panel edit cannot lower, so the server
    /// default stays, as on the web panel.
    static var kinds: [RetentionKind] { [
        RetentionKind(key: "events", label: L10n.string("Events"), defaultDays: 180, defaultMegabytes: nil),
        RetentionKind(key: "fullVideo", label: L10n.string("Recordings"), defaultDays: 7, defaultMegabytes: 1024),
        RetentionKind(key: "dynamicVideo", label: L10n.string("Motion clips"), defaultDays: 7, defaultMegabytes: 512),
        RetentionKind(key: "cloudDouble", label: L10n.string("Timelapses"), defaultDays: 3, defaultMegabytes: 256),
        RetentionKind(key: "eventImage", label: L10n.string("Snapshots"), defaultDays: 30, defaultMegabytes: 512),
        RetentionKind(key: "highLight", label: L10n.string("Highlights"), defaultDays: 30, defaultMegabytes: 512),
        RetentionKind(key: "wasteCheck", label: L10n.string("Waste photos"), defaultDays: 30, defaultMegabytes: 512),
        RetentionKind(key: "healthPic", label: L10n.string("Health photos"), defaultDays: 90, defaultMegabytes: 256),
        RetentionKind(key: "deviceLog", label: L10n.string("Device logs"), defaultDays: 1, defaultMegabytes: 18),
        RetentionKind(key: "blocked", label: L10n.string("Blocked attempts"), defaultDays: 365, defaultMegabytes: nil),
        RetentionKind(key: "thumbnail", label: L10n.string("Thumbnail cache"), defaultDays: 30, defaultMegabytes: 256),
    ] }

    /// "30 days · 1 GB max", "180 days", "No limit".
    static func text(days: Double?, megabytes: Double?) -> String {
        var parts: [String] = []
        if let days { parts.append(daysText(days)) }
        if let megabytes { parts.append(L10n.string("\(ByteSize.format(megabytes: megabytes)) max")) }
        return parts.isEmpty ? L10n.string("No limit") : parts.joined(separator: " · ")
    }

    static func daysText(_ days: Double) -> String {
        let number = days == days.rounded() ? String(Int(days)) : String(format: "%.1f", days)
        return days == 1 ? L10n.string("1 day") : L10n.string("\(number) days")
    }

    /// A typed cap. Empty means no cap; anything else must be a positive
    /// finite number. Returns nil when the text is not acceptable.
    static func parseCap(_ text: String) -> Double?? {
        let trimmed = text.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: ".")
        if trimmed.isEmpty { return .some(nil) }
        guard let value = Double(trimmed), value.isFinite, value > 0 else { return nil }
        return .some(value)
    }

    /// A cap as the edit field shows it: whole numbers without a decimal point.
    static func fieldText(_ value: Double?) -> String {
        guard let value else { return "" }
        return value == value.rounded() ? String(Int(value)) : String(value)
    }
}
