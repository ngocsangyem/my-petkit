import Foundation
import PetkitCore

/// The severity drawn as a 2pt edge on a log line. The hub has no levels, so
/// it is derived the way the web panel does: a 5xx answer or a blocked
/// command is an error, a 4xx or a rewrite a warning, the rest info.
enum LogLevel: Equatable {
    case info
    case warning
    case error
}

/// How hub events become log lines: level, text, filtering, heartbeats and
/// the merge of the `/api/events` catch-up with the live stream.
enum ServerLogRules {
    /// Lines kept on screen; also what the catch-up asks for.
    static let limit = 600

    static func level(kind: String, status: Double?) -> LogLevel {
        if kind == "blocked" || (status ?? 0) >= 500 { return .error }
        if kind == "redact" || (status ?? 0) >= 400 { return .warning }
        return .info
    }

    static func level(of event: LiveEvent) -> LogLevel {
        level(kind: event.kind, status: event.detail?["status"]?.number)
    }

    /// A heartbeat is not its own kind: it is an `http` line naming the endpoint.
    static func isHeartbeat(_ event: LiveEvent) -> Bool {
        event.kind == "http" && event.summary.contains("heartbeat")
    }

    /// "mqtt 100234567 event pet_in"; an unattributed event reads "server".
    static func text(of event: LiveEvent) -> String {
        "\(event.kind) \(event.deviceID ?? "server") \(event.summary)"
    }

    /// Whitespace-separated terms, all required, case-insensitive. Never a
    /// regex: a typed `.` or `(` means itself.
    static func matches(_ text: String, filter: String) -> Bool {
        let terms = filter.split(whereSeparator: \.isWhitespace)
        return terms.allSatisfy { text.range(of: $0, options: [.caseInsensitive, .diacriticInsensitive]) != nil }
    }

    /// The visible lines: pings dropped, heartbeats dropped when asked,
    /// then the filter.
    static func visible(_ events: [LiveEvent], filter: String, hideHeartbeats: Bool) -> [LiveEvent] {
        events.filter { event in
            !event.isPing
                && !(hideHeartbeats && isHeartbeat(event))
                && matches(text(of: event), filter: filter)
        }
    }

    /// The catch-up and the live tail overlap (the socket replays its last
    /// 80 events), so events are keyed by `seq` and kept once, oldest first.
    static func merge(backfill: [LiveEvent], live: [LiveEvent], limit: Int = limit) -> [LiveEvent] {
        var seen = Set<String>()
        var merged: [LiveEvent] = []
        for event in backfill + live where !event.isPing && seen.insert(event.id).inserted {
            merged.append(event)
        }
        merged.sort { ($0.ts, $0.seq ?? 0) < ($1.ts, $1.seq ?? 0) }
        return Array(merged.suffix(limit))
    }

    /// "14:05:02": 24-hour, whatever the phone's locale, so lines align.
    static func clock(_ date: Date, timeZone: TimeZone = .current) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let parts = calendar.dateComponents([.hour, .minute, .second], from: date)
        return String(format: "%02d:%02d:%02d", parts.hour ?? 0, parts.minute ?? 0, parts.second ?? 0)
    }

    /// The lines as a plain text file for sharing, one per event.
    static func exportText(_ events: [LiveEvent], timeZone: TimeZone = .current) -> String {
        let day = Date.ISO8601FormatStyle(timeZone: timeZone).year().month().day()
        return events.map { "\($0.date.formatted(day)) \(clock($0.date, timeZone: timeZone)) \(text(of: $0))" }
            .joined(separator: "\n") + "\n"
    }
}
