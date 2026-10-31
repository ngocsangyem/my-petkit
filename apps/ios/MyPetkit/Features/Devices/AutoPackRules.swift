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
    static var advice: String {
        L10n.string("PetKit's advice: have someone nearby when it packs, and take the bag out promptly.")
    }
    static var confirmQuestion: String { L10n.string("Turn on auto-pack?") }
    static var confirmDetail: String {
        L10n.string("""
            The box packs the bin by itself when the rule fires, only when no cat is near \
            and bags are left. \(advice) The server turns it off after a pack error or two unanswered packs.
            """)
    }

    static func option(_ trigger: AutoPackTrigger) -> String {
        switch trigger {
        case .afterCleanings: L10n.string("After a number of cleans")
        case .binFull: L10n.string("When the bin is full")
        case .dailyAt: L10n.string("Every day at a set time")
        }
    }

    /// The trigger row's value: "After 10 cleans", "Bin full", "Daily at 21:00".
    static func trigger(_ rule: AutoPackRule) -> String {
        switch rule.trigger {
        case .afterCleanings: L10n.string(rule.cleanings == 1 ? "After every clean" : "After \(rule.cleanings) cleans")
        case .binFull: L10n.string("When the bin is full")
        case .dailyAt: L10n.string("Daily at \(rule.at)")
        }
    }

    /// The footnote under the switch, as in the artboard.
    static func summary(_ rule: AutoPackRule) -> String {
        var text = L10n.string("\(trigger(rule)), only when no cat is near and bags are left.")
        if let quiet = rule.quietHours { text += L10n.string(" Never \(quiet.start) – \(quiet.end).") }
        return text
    }

    /// One line on what the rule last did, newest fact first. Times are in the
    /// device's zone.
    static func status(_ status: AutoPackStatus?, enabled: Bool, zone: TimeZone?, now: Date) -> String? {
        guard let status else { return nil }
        let at = { (seconds: Double) in DeviceFindings.since(Date(timeIntervalSince1970: seconds), zone: zone, now: now) }
        if let reason = status.disabledReason {
            if reason == "no_response" { return L10n.string("Turned off by the server: the box did not answer two packs.") }
            let message = reason.hasPrefix("pack_error:") ? reason.dropFirst("pack_error:".count)
                .trimmingCharacters(in: .whitespaces) : reason
            return L10n.string("Turned off by the server after a pack error: \(message).")
        }
        if let pending = status.pendingSince { return L10n.string("Pack sent at \(at(pending)), waiting for the box to finish.") }
        var parts: [String] = []
        if let packed = status.lastPackedAt { parts.append(L10n.string("Last packed \(at(packed))")) }
        if status.lastResult == "no_response" { parts.append(L10n.string("the last pack got no answer")) }
        if enabled, status.awaitingBinClear == true {
            parts.append(L10n.string("waiting for the bin to be emptied before it counts again"))
        } else if enabled, let held = status.heldBackBy {
            parts.append(heldBack(held))
        }
        guard !parts.isEmpty else { return enabled ? L10n.string("Not packed yet.") : nil }
        let line = parts.joined(separator: " · ")
        return line.prefix(1).uppercased() + line.dropFirst() + "."
    }

    static func heldBack(_ reason: String) -> String {
        switch reason {
        case "not_due": L10n.string("not due yet")
        case "quiet_hours": L10n.string("waiting out quiet hours")
        case "cooldown": L10n.string("waiting a moment after the last try")
        case "not_delivered": L10n.string("the last pack could not be sent")
        case "pet_in_box", "visit_open", "pet_nearby": L10n.string("held back while a cat is near")
        case "no_bags": L10n.string("held back: no bags left")
        case "device_offline", "not_on_mqtt", "state_stale": L10n.string("held back: the box is not connected")
        case "presence_unknown": L10n.string("held back until the box reports whether a cat is inside")
        case "device_busy": L10n.string("held back while the box is busy")
        case "device_fault": L10n.string("held back by a device error")
        default: L10n.string("held back (\(reason.replacingOccurrences(of: "_", with: " ")))")
        }
    }
}
