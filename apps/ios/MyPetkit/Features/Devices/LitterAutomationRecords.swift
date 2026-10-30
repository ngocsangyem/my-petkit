import Foundation

// `GET /api/devices/{id}/litter-automation` and the auto-pack rule, decoded by
// hand like the other device reads. The rule is also ENCODED by hand: every
// field is required, and `quietHours: null` (no quiet hours) has to be sent
// as an explicit null, which the generated request type drops as nil.

/// What force continue and auto-pack can do on one device right now.
struct LitterAutomationRecord: Decodable, Equatable, Sendable {
    var forceContinue: ForceContinueInfo
    var autoPack: AutoPackInfo

    /// What a device that supports neither answers.
    static let unsupported = LitterAutomationRecord(
        forceContinue: ForceContinueInfo(supported: false, offered: false, blockers: []),
        autoPack: AutoPackInfo(supported: false))
}

struct ForceContinueInfo: Decodable, Equatable, Sendable {
    var supported: Bool
    /// True exactly when every guard passes; the action is shown only then.
    var offered: Bool
    var blockers: [ForceContinueBlocker]
}

/// One failed guard: `reason` is a `ForceContinueReason` code (kept as text so
/// a reason added on the server later still decodes), `message` the sentence.
struct ForceContinueBlocker: Decodable, Equatable, Sendable {
    var reason: String
    var message: String
}

struct AutoPackInfo: Decodable, Equatable, Sendable {
    var supported: Bool
    /// Present when `supported`.
    var rule: AutoPackRule?
    var status: AutoPackStatus?
}

enum AutoPackTrigger: String, Codable, CaseIterable, Sendable {
    case afterCleanings = "after_cleanings"
    case binFull = "bin_full"
    case dailyAt = "daily_at"
}

struct AutoPackQuietHours: Codable, Equatable, Sendable {
    /// "HH:MM" in the device's zone; an end before the start crosses midnight.
    var start: String
    var end: String
}

/// The whole rule; `PUT /api/devices/{id}/auto-pack` replaces it at once.
struct AutoPackRule: Codable, Equatable, Sendable {
    static let cleaningsRange = 1...50

    var enabled: Bool
    var trigger: AutoPackTrigger
    /// Cleanings that fire `after_cleanings`, 1–50.
    var cleanings: Int
    /// "HH:MM" in the device's zone that fires `daily_at`.
    var at: String
    var quietHours: AutoPackQuietHours?

    private enum CodingKeys: String, CodingKey {
        case enabled, trigger, cleanings, at, quietHours
    }

    init(enabled: Bool, trigger: AutoPackTrigger, cleanings: Int, at: String, quietHours: AutoPackQuietHours?) {
        self.enabled = enabled
        self.trigger = trigger
        self.cleanings = cleanings
        self.at = at
        self.quietHours = quietHours
    }

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        enabled = try container.decode(Bool.self, forKey: .enabled)
        trigger = try container.decode(AutoPackTrigger.self, forKey: .trigger)
        cleanings = try container.decode(Int.self, forKey: .cleanings)
        at = try container.decode(String.self, forKey: .at)
        quietHours = try container.decodeIfPresent(AutoPackQuietHours.self, forKey: .quietHours)
    }

    /// Every key, `quietHours` as null when there are none.
    func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(enabled, forKey: .enabled)
        try container.encode(trigger, forKey: .trigger)
        try container.encode(cleanings, forKey: .cleanings)
        try container.encode(at, forKey: .at)
        try container.encode(quietHours, forKey: .quietHours)
    }
}

/// What the server's rule loop last did. Times are epoch seconds.
struct AutoPackStatus: Decodable, Equatable, Sendable {
    var enabledAt: Double?
    /// When the pack now awaiting the box's "packed" report was sent.
    var pendingSince: Double?
    var lastAttemptAt: Double?
    var retries: Int?
    /// `packed`, `no_response` or `failed`.
    var lastResult: String?
    var lastPackedAt: Double?
    /// `not_due`, `quiet_hours`, `cooldown`, `not_delivered`, or a guard reason.
    var heldBackBy: String?
    /// `no_response`, or `pack_error: ` and the device's message.
    var disabledReason: String?
    /// A `bin_full` rule packed and waits to see the bin not full before it
    /// counts again. Required by the contract; read as false if absent.
    var awaitingBinClear: Bool?
}

/// `PUT /api/devices/{id}/auto-pack`'s answer.
struct AutoPackResult: Decodable, Sendable {
    var rule: AutoPackRule
    var status: AutoPackStatus
}
