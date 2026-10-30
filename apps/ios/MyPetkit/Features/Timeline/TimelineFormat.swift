import Foundation

/// A video file of a session, in the order it is offered.
struct TimelineVideoSource: Hashable, Sendable, Identifiable {
    enum Label: String, Sendable { case clip = "Clip", timelapse = "Timelapse", playback = "Playback" }
    let label: Label
    let path: String
    var id: String { label.rawValue }
}

/// Pure formatting rules of the Timeline screen, ported from the web app's
/// `timeline-model.ts`. Nothing here touches the network.
enum TimelineFormat {
    // MARK: Numbers

    /// "45 s", "1 min 55 s"; nil when unknown.
    static func duration(_ seconds: Double?) -> String? {
        guard let seconds, seconds.isFinite, seconds >= 0 else { return nil }
        let total = Int(seconds.rounded())
        let minutes = total / 60
        let rest = total % 60
        return minutes > 0 ? "\(minutes) min \(rest) s" : "\(rest) s"
    }

    /// "1:55", the length printed on a video poster; nil when unknown.
    static func clipLength(_ seconds: Double?) -> String? {
        guard let seconds, seconds.isFinite, seconds >= 0 else { return nil }
        let total = Int(seconds.rounded())
        return String(format: "%d:%02d", total / 60, total % 60)
    }

    /// Grams to "5.43 kg"; nil when unknown.
    static func weight(_ grams: Double?) -> String? {
        guard let grams, grams.isFinite else { return nil }
        return String(format: "%.2f kg", grams / 1000)
    }

    /// "13:58" in the server's zone for the day, so times line up with the
    /// midnight the server cut the day at.
    static func clock(_ ts: Double?, tzOffset: Int) -> String? {
        guard let ts, ts.isFinite, ts > 0, let zone = TimeZone(secondsFromGMT: tzOffset) else { return nil }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        let parts = calendar.dateComponents([.hour, .minute], from: Date(timeIntervalSince1970: ts))
        return String(format: "%02d:%02d", parts.hour ?? 0, parts.minute ?? 0)
    }

    // MARK: Sentences

    private static let kindTags: [String: String] = [
        "toilet_visit": "Toilet visit", "pet": "Appeared", "motion": "Motion", "cleaning": "Cleaning",
        "error": "Alert", "feeding": "Feeding", "drinking": "Drinking", "system": "System",
    ]

    static func kindTag(_ eventKind: String?) -> String {
        let kind = eventKind ?? "event"
        return kindTags[kind] ?? kind.replacingOccurrences(of: "_", with: " ")
    }

    /// The headline of a card.
    static func sentence(_ entry: TimelineEntry) -> String {
        if entry.isVisit {
            if let name = entry.petName, !name.isEmpty { return "\(name) used the litter box" }
            return entry.passing ? "Light visit" : "A cat used the litter box"
        }
        if let label = entry.label, !label.isEmpty { return label }
        return kindTag(entry.eventKind)
    }

    /// A fault reads in red; everything else in ink.
    static func isAlert(_ entry: TimelineEntry) -> Bool {
        entry.eventKind == "error"
    }

    /// "13:58 · 1 min 55 s · 5.43 kg · waste 42 g"; a visit nobody named ends
    /// "not recognised" (a weight match carries its own "by weight" tag).
    static func metaLine(_ entry: TimelineEntry, tzOffset: Int) -> String {
        var parts = [clock(entry.displayTs ?? entry.ts, tzOffset: tzOffset)]
        if entry.isVisit {
            parts.append(duration(entry.durationSec))
            parts.append(weight(entry.weight))
            if !entry.hasPet, !entry.passing { parts.append("not recognised") }
        }
        if !entry.isVisit, !entry.deviceName.isEmpty { parts.append(entry.deviceName) }
        return (parts.compactMap { $0 } + entry.bits).joined(separator: " · ")
    }

    static func stepLabel(_ step: TimelineStep) -> String {
        if let label = step.label, !label.isEmpty { return label }
        return step.eventType ?? "Event"
    }

    // MARK: Media

    /// Playable files in the order offered: the single-file clip first (never
    /// a fragment), then the stitched timelapse, then the full playback.
    static func videoSources(_ media: TimelineMedia) -> [TimelineVideoSource] {
        var sources: [TimelineVideoSource] = []
        if let path = media.highlight { sources.append(.init(label: .clip, path: path)) }
        if let path = media.preview { sources.append(.init(label: .timelapse, path: path)) }
        if let path = media.playback { sources.append(.init(label: .playback, path: path)) }
        return sources
    }

    /// An MPEG transport stream file: AVPlayer plays HLS playlists, not a bare `.ts`.
    static func isTransportStream(_ path: String) -> Bool {
        let file = path.split(separator: "?").first.map(String.init) ?? path
        return file.lowercased().hasSuffix(".ts")
    }

    /// Sources the phone can play.
    static func playableSources(_ media: TimelineMedia) -> [TimelineVideoSource] {
        videoSources(media).filter { !isTransportStream($0.path) }
    }

    /// There is video, but only as `.ts` files the phone cannot play.
    static func isTransportStreamOnly(_ media: TimelineMedia) -> Bool {
        !videoSources(media).isEmpty && playableSources(media).isEmpty
    }

    /// A chunked recording is still being stitched and nothing is playable
    /// yet: show "Assembling video…" instead of a fragment.
    static func isAssembling(_ media: TimelineMedia) -> Bool {
        media.videoPending && videoSources(media).isEmpty
    }

    /// The clip plays, but the full recording is still being stitched.
    static func isPlaybackPending(_ media: TimelineMedia) -> Bool {
        media.videoPending && media.playback == nil && !videoSources(media).isEmpty
    }

    /// Best still for a poster: snapshot, else the clip's or recording's frame grab.
    static func posterPath(_ media: TimelineMedia) -> String? {
        media.snapshot ?? media.poster ?? media.highlight ?? media.playback
    }

    /// Waste and stool stills of a session and its steps, one group per role.
    struct StillGroup: Hashable, Sendable, Identifiable {
        let title: String
        let pill: String
        let paths: [String]
        var id: String { title }
    }

    static func stillGroups(_ entry: TimelineEntry) -> [StillGroup] {
        let all = [entry.media] + entry.steps.compactMap(\.media)
        func unique(_ paths: [String]) -> [String] {
            var seen = Set<String>()
            return paths.filter { seen.insert($0).inserted }
        }
        let waste = unique(all.flatMap(\.waste))
        let health = unique(all.flatMap(\.health))
        var groups: [StillGroup] = []
        if !waste.isEmpty {
            groups.append(.init(title: "Check waste", pill: count(waste.count, "waste photo"), paths: waste))
        }
        if !health.isEmpty {
            groups.append(.init(title: "Health", pill: count(health.count, "stool photo"), paths: health))
        }
        return groups
    }

    static func count(_ value: Int, _ word: String) -> String {
        "\(value) \(word)\(value == 1 ? "" : "s")"
    }

    // MARK: Days

    private static var utcCalendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0) ?? .gmt
        return calendar
    }

    private static func parse(_ date: String) -> Date? {
        let parts = date.split(separator: "-").compactMap { Int($0) }
        guard date.count == 10, parts.count == 3 else { return nil }
        let components = DateComponents(year: parts[0], month: parts[1], day: parts[2])
        guard let parsed = utcCalendar.date(from: components) else { return nil }
        // Rejects "2026-02-30", which the calendar would roll into March.
        let back = utcCalendar.dateComponents([.year, .month, .day], from: parsed)
        guard back.year == parts[0], back.month == parts[1], back.day == parts[2] else { return nil }
        return parsed
    }

    /// `YYYY-MM-DD` moved by `days` calendar days. Calendar arithmetic on the
    /// name only: the server still decides where each day starts and ends.
    static func shiftDay(_ date: String, by days: Int) -> String? {
        guard let parsed = parse(date), let moved = utcCalendar.date(byAdding: .day, value: days, to: parsed) else {
            return nil
        }
        let parts = utcCalendar.dateComponents([.year, .month, .day], from: moved)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }

    private static let monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                                     "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    private static let weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

    /// "Today, 28 Oct", "Yesterday, 27 Oct", "Mon, 26 Oct".
    static func dayTitle(_ date: String, today: String?) -> String {
        guard let parsed = parse(date) else { return date }
        let parts = utcCalendar.dateComponents([.day, .month, .weekday], from: parsed)
        let dayMonth = "\(parts.day ?? 0) \(monthNames[((parts.month ?? 1) - 1) % 12])"
        if let today, date == today { return "Today, \(dayMonth)" }
        if let today, shiftDay(today, by: -1) == date { return "Yesterday, \(dayMonth)" }
        return "\(weekdayNames[((parts.weekday ?? 1) - 1) % 7]), \(dayMonth)"
    }

    /// One-letter weekday for a chart axis ("M", "T", ...).
    static func weekdayInitial(_ date: String) -> String {
        guard let parsed = parse(date) else { return "" }
        let weekday = utcCalendar.component(.weekday, from: parsed)
        return String(weekdayNames[(weekday - 1) % 7].prefix(1))
    }

    /// "5 visits, 2 meals so far." from the day's counts; nil on an empty day.
    static func daySummary(_ day: TimelineDayResult, isToday: Bool) -> String? {
        var parts: [String] = []
        if day.toiletingCount > 0 { parts.append(count(day.toiletingCount, "visit")) }
        if day.feedingCount > 0 { parts.append(count(day.feedingCount, "meal")) }
        if day.drinkingCount > 0 { parts.append(count(day.drinkingCount, "drink")) }
        if day.faultCount > 0 { parts.append(count(day.faultCount, "fault")) }
        guard !parts.isEmpty else { return nil }
        return parts.joined(separator: ", ") + (isToday ? " so far." : ".")
    }
}
