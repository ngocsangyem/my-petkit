import Foundation

/// The auto-pack form as edited: times as minutes of the device's day, quiet
/// hours as a switch plus a window. `rule(enabled:)` always builds the whole
/// rule, because the server replaces it at once and every field is required.
struct AutoPackDraft: Equatable {
    static let defaultQuietStart = 22 * 60
    static let defaultQuietEnd = 7 * 60
    static let defaultAt = 21 * 60

    var trigger: AutoPackTrigger
    var cleanings: Int
    var atMinute: Int
    var quietHours: Bool
    var quietStart: Int
    var quietEnd: Int

    init(_ rule: AutoPackRule) {
        trigger = rule.trigger
        cleanings = Self.clamped(rule.cleanings)
        atMinute = ScheduleClock.parse(rule.at) ?? Self.defaultAt
        quietHours = rule.quietHours != nil
        quietStart = rule.quietHours.flatMap { ScheduleClock.parse($0.start) } ?? Self.defaultQuietStart
        quietEnd = rule.quietHours.flatMap { ScheduleClock.parse($0.end) } ?? Self.defaultQuietEnd
    }

    func rule(enabled: Bool) -> AutoPackRule {
        AutoPackRule(
            enabled: enabled,
            trigger: trigger,
            cleanings: Self.clamped(cleanings),
            at: ScheduleClock.format(minute: atMinute % ScheduleClock.dayMinutes),
            quietHours: quietHours
                ? AutoPackQuietHours(start: ScheduleClock.format(minute: quietStart % ScheduleClock.dayMinutes),
                                     end: ScheduleClock.format(minute: quietEnd % ScheduleClock.dayMinutes))
                : nil)
    }

    private static func clamped(_ cleanings: Int) -> Int {
        min(max(cleanings, AutoPackRule.cleaningsRange.lowerBound), AutoPackRule.cleaningsRange.upperBound)
    }
}

/// The words of the auto-pack block.
enum AutoPackText {
    static let advice = "PetKit's advice: have someone nearby when it packs, and take the bag out promptly."
    static let confirmQuestion = "Turn on auto-pack?"
    static let confirmDetail = "The box packs the bin by itself when the rule fires, only when no cat is near "
        + "and bags are left. \(advice) The server turns it off after a pack error or two unanswered packs."

    static func option(_ trigger: AutoPackTrigger) -> String {
        switch trigger {
        case .afterCleanings: "After a number of cleans"
        case .binFull: "When the bin is full"
        case .dailyAt: "Every day at a set time"
        }
    }

    /// The trigger row's value: "After 10 cleans", "Bin full", "Daily at 21:00".
    static func trigger(_ rule: AutoPackRule) -> String {
        switch rule.trigger {
        case .afterCleanings: rule.cleanings == 1 ? "After every clean" : "After \(rule.cleanings) cleans"
        case .binFull: "When the bin is full"
        case .dailyAt: "Daily at \(rule.at)"
        }
    }

    /// The footnote under the switch, as in the artboard.
    static func summary(_ rule: AutoPackRule) -> String {
        var text = "\(trigger(rule)), only when no cat is near and bags are left."
        if let quiet = rule.quietHours { text += " Never \(quiet.start) – \(quiet.end)." }
        return text
    }

    /// One line on what the rule last did, newest fact first. Times are in the
    /// device's zone.
    static func status(_ status: AutoPackStatus?, enabled: Bool, zone: TimeZone?, now: Date) -> String? {
        guard let status else { return nil }
        let at = { (seconds: Double) in DeviceFindings.since(Date(timeIntervalSince1970: seconds), zone: zone, now: now) }
        if let reason = status.disabledReason {
            if reason == "no_response" { return "Turned off by the server: the box did not answer two packs." }
            let message = reason.hasPrefix("pack_error:") ? reason.dropFirst("pack_error:".count)
                .trimmingCharacters(in: .whitespaces) : reason
            return "Turned off by the server after a pack error: \(message)."
        }
        if let pending = status.pendingSince { return "Pack sent at \(at(pending)), waiting for the box to finish." }
        var parts: [String] = []
        if let packed = status.lastPackedAt { parts.append("Last packed \(at(packed))") }
        if status.lastResult == "no_response" { parts.append("the last pack got no answer") }
        if enabled, status.awaitingBinClear == true {
            parts.append("waiting for the bin to be emptied before it counts again")
        } else if enabled, let held = status.heldBackBy {
            parts.append(heldBack(held))
        }
        guard !parts.isEmpty else { return enabled ? "Not packed yet." : nil }
        let line = parts.joined(separator: " · ")
        return line.prefix(1).uppercased() + line.dropFirst() + "."
    }

    static func heldBack(_ reason: String) -> String {
        switch reason {
        case "not_due": "not due yet"
        case "quiet_hours": "waiting out quiet hours"
        case "cooldown": "waiting a moment after the last try"
        case "not_delivered": "the last pack could not be sent"
        case "pet_in_box", "visit_open", "pet_nearby": "held back while a cat is near"
        case "no_bags": "held back: no bags left"
        case "device_offline", "not_on_mqtt", "state_stale": "held back: the box is not connected"
        case "presence_unknown": "held back until the box reports whether a cat is inside"
        case "device_busy": "held back while the box is busy"
        case "device_fault": "held back by a device error"
        default: "held back (\(reason.replacingOccurrences(of: "_", with: " ")))"
        }
    }
}
