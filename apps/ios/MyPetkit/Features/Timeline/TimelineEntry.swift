import Foundation

/// Media files of a session or step, by role. Every path is relative to the
/// media root; `MediaPath` turns it into a thumbnail or file path.
struct TimelineMedia: Hashable, Sendable {
    var highlight: String?
    var playback: String?
    var preview: String?
    var poster: String?
    var snapshot: String?
    var waste: [String] = []
    var health: [String] = []
    /// A chunked recording is still being stitched.
    var videoPending = false
}

/// One step of a session (cleaning started, waste photo taken, ...).
struct TimelineStep: Hashable, Sendable, Identifiable {
    let eventID: Int?
    let eventType: String?
    let ts: Double?
    let label: String?
    /// A low-level step the UI collapses.
    let isDetail: Bool
    let media: TimelineMedia?
    let index: Int

    var id: String { eventID.map { "e\($0)" } ?? "i\(index)" }
}

/// One card of the day: a litter-box visit or a single event.
struct TimelineEntry: Hashable, Sendable, Identifiable {
    /// `visit` or `event`.
    let kind: String
    let eventID: Int?
    let deviceID: Int?
    /// Empty when the device is unregistered.
    let deviceName: String
    let ts: Double?
    /// When to show the card (visit entry time).
    let displayTs: Double?
    let petID: Int?
    let petName: String?
    /// Absolute server path of the pet's photo.
    let petPhotoPath: String?
    let label: String?
    let eventKind: String?
    let eventType: String?
    let durationSec: Double?
    /// In whatever unit the device sent; the litter boxes send grams.
    let weight: Double?
    /// Server-decoded facts ("waste 42 g", "litter 40%").
    let bits: [String]
    let steps: [TimelineStep]
    let media: TimelineMedia
    let index: Int
    /// Who decided `petID`: `device`, `weight` or `manual`; nil when nobody did.
    var petSource: String?
    /// Too light to be any registered cat; listed only under "Light visits".
    var passing = false
    /// The identity the box reported when no pet holds it yet.
    var unboundPetRef: Int?

    var id: String { eventID.map { "s\($0)" } ?? "i\(index)" }
    var isVisit: Bool { kind == "visit" }
    var sortTime: Double { displayTs ?? ts ?? 0 }
    var hasPet: Bool { petName.map { !$0.isEmpty } ?? false }
    var isMatchedByWeight: Bool { petSource == "weight" && hasPet }
}

/// What the timeline route answers for one server day.
struct TimelineDayResult: Hashable, Sendable {
    /// The local day the server used (YYYY-MM-DD).
    let date: String
    /// Seconds east of UTC for that day, in the server's zone.
    let tzOffset: Int
    let toiletingCount: Int
    let feedingCount: Int
    let drinkingCount: Int
    let faultCount: Int
    /// Newest first.
    let entries: [TimelineEntry]
    /// Light visits that day; `all` leaves them out, their own chip lists them.
    var passingCount = 0
}
