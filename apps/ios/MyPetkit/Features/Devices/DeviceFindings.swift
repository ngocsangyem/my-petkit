import Foundation
import PetkitCore

/// How a sentence about a device is coloured: only the lead word(s) carry it.
enum FindingTone: Equatable, Sendable {
    case positive, warning, negative, neutral
}

/// One thing a person needs to act on.
struct Attention: Equatable, Sendable {
    let text: String
    let tone: FindingTone
}

/// A sentence with a coloured lead: "Silent for 8 h 37 m." + "Check that…".
struct StateSentence: Equatable, Sendable {
    let lead: String
    let tone: FindingTone
    var rest: String?
}

/// A consumable counted in days left, with the life a fresh one starts from
/// (PetKit's own nominal life; the device reports only the days left).
struct ConsumableSpec: Sendable {
    let key: String
    let label: String
    let lifeDays: Double
}

/// The judgements the devices screens make: what needs you, and the one
/// sentence that says what a device is doing. Pure, so they are tested.
enum DeviceFindings {
    static var consumables: [ConsumableSpec] {
        [
            ConsumableSpec(key: "n60_spray_days", label: L10n.string("N60 deodorizer"), lifeDays: 30),
            ConsumableSpec(key: "n50_durability", label: L10n.string("N50 deodorant"), lifeDays: 30), // gitleaks:allow (an entity key)
            ConsumableSpec(key: "desiccant_days", label: L10n.string("Desiccant"), lifeDays: 30),
            ConsumableSpec(key: "filter_days", label: L10n.string("Filter"), lifeDays: 30),
        ]
    }
    /// At or under this many days a consumable needs you.
    static let consumableWarnDays: Double = 7

    /// Problem flags that, when on, are the first thing to know.
    static var problemFlags: [(key: String, text: String)] {
        [
            ("waste_bin", L10n.string("Waste bin full")),
            ("food_low", L10n.string("Food low")),
            ("water_lack", L10n.string("Water low")),
            ("replace_filter", L10n.string("Replace the filter")),
        ]
    }

    // MARK: Attention

    /// The first thing to act on for a device, or nil when it is fine.
    static func attention(_ device: DeviceRecord, zone: TimeZone?, now: Date) -> Attention? {
        if !device.online, let last = DeviceFacts.lastReport(device) {
            return Attention(text: L10n.string("Silent since \(since(last, zone: zone, now: now))"), tone: .negative)
        }
        if let error = errorText(device) { return Attention(text: error, tone: .negative) }
        for flag in problemFlags where DeviceFacts.isOn(DeviceFacts.entity(device, flag.key)) == true {
            return Attention(text: flag.text, tone: .warning)
        }
        if let low = lowConsumables(device).first {
            return Attention(text: consumableText(low.label, days: low.days), tone: .warning)
        }
        return nil
    }

    /// The Home header: the worst finding as one sentence, then the rest.
    static func homeFinding(_ findings: [(name: String, attention: Attention)]) -> (lead: Attention?, tail: String) {
        let ordered = findings.filter { $0.attention.tone == .negative } + findings.filter { $0.attention.tone != .negative }
        guard let first = ordered.first else { return (nil, L10n.string("Everything is fine.")) }
        let text = first.attention.text
        let silent = silentPrefix
        let sentence = text.hasPrefix(silent)
            ? L10n.string("\(first.name) has been silent since \(String(text.dropFirst(silent.count))).")
            : L10n.string("\(first.name): \(text).")
        let more = ordered.count - 1
        let tail = more == 0 ? L10n.string("Everything else is fine.") : L10n.string("\(more) more things need you.")
        return (Attention(text: sentence, tone: first.attention.tone), tail)
    }

    /// "Silent since " in the current language: the attention text with its
    /// time cut off, so the Home header can rephrase it.
    private static var silentPrefix: String { L10n.string("Silent since \(String())") }

    /// Days-left consumables that are running low, worst first.
    static func lowConsumables(_ device: DeviceRecord) -> [(label: String, days: Double)] {
        consumables.compactMap { spec in
            guard let days = DeviceFacts.number(DeviceFacts.entity(device, spec.key)),
                  days <= consumableWarnDays else { return nil }
            return (spec.label, days)
        }
        .sorted { $0.days < $1.days }
    }

    static func consumableText(_ label: String, days: Double) -> String {
        if days <= 0 { return L10n.string("\(label) used up") }
        return L10n.string("\(label) in \(daysText(days))")
    }

    static func daysText(_ days: Double) -> String {
        L10n.string("\(Int(days.rounded())) days")
    }

    // MARK: Card line and hero sentence

    /// The one line under a device card's name.
    static func cardLine(_ device: DeviceRecord, zone: TimeZone?, now: Date, nextMeal: PlannedMeal?) -> (String, FindingTone)? {
        if let attention = attention(device, zone: zone, now: now) { return (attention.text, attention.tone) }
        if !device.online { return (L10n.string("Has not reported yet"), .neutral) }
        switch DeviceFamily(deviceType: device.type) {
        case .litter:
            let mode = pause(device).map { L10n.string("Paused while \($0.mode)") } ?? workLabel(device)
            let bags = DeviceFacts.number(DeviceFacts.entity(device, "package_count")).map { L10n.string("\(Int($0)) bags") }
            let parts = [mode, bags].compactMap { $0 }
            return parts.isEmpty ? nil : (parts.joined(separator: " · "), .neutral)
        case .feeder:
            if let nextMeal { return (L10n.string("Next meal \(DayStripLayout.clock(minute: nextMeal.minute))"), .neutral) }
            return workLabel(device).map { ($0, .neutral) }
        default:
            return workLabel(device).map { ($0, .neutral) }
        }
    }

    /// The hero sentence of a device's detail.
    static func sentence(_ device: DeviceRecord, zone: TimeZone?, now: Date, nextMeal: PlannedMeal?) -> StateSentence {
        guard let last = DeviceFacts.lastReport(device) else {
            return StateSentence(lead: L10n.string("Not reported yet."), tone: .neutral,
                                 rest: L10n.string("It shows here once it checks in."))
        }
        if !device.online {
            return StateSentence(lead: L10n.string("Silent for \(duration(now.timeIntervalSince(last)))."), tone: .negative,
                                 rest: L10n.string("Check that it has power and is on Wi-Fi."))
        }
        if let error = errorText(device) { return StateSentence(lead: "\(error).", tone: .negative) }
        if let paused = pause(device) {
            return StateSentence(lead: L10n.string("Paused while \(paused.mode)."), tone: .warning, rest: paused.reason)
        }
        if let attention = attention(device, zone: zone, now: now) {
            return StateSentence(lead: "\(attention.text).", tone: attention.tone)
        }
        switch DeviceFamily(deviceType: device.type) {
        case .feeder:
            let fed = DeviceFacts.number(DeviceFacts.entity(device, "total_dispensed")).map { L10n.string("Fed \(Int($0)) g today.") }
            if let nextMeal {
                return StateSentence(lead: L10n.string("Next meal at \(DayStripLayout.clock(minute: nextMeal.minute))."),
                                     tone: .neutral, rest: fed)
            }
            return StateSentence(lead: "\(workLabel(device) ?? L10n.string("Online")).", tone: .positive, rest: fed)
        case .litter:
            let cleaned = lastClean(device, zone: zone, now: now).map { L10n.string("Cleaned at \($0).") }
            return StateSentence(lead: "\(workLabel(device) ?? L10n.string("Idle")).", tone: .positive, rest: cleaned)
        default:
            return StateSentence(lead: "\(workLabel(device) ?? L10n.string("Online")).", tone: .positive)
        }
    }

    // MARK: Pieces

    /// A litter box's cycle paused for safety: `workState.workProcess` tens
    /// digit 2 or 4, with `safeWarn` saying why.
    static func pause(_ device: DeviceRecord) -> (mode: String, reason: String?)? {
        guard let work = device.state?["workState"], let process = work["workProcess"]?.number else { return nil }
        let phase = Int(process) / 10
        guard phase == 2 || phase == 4 else { return nil }
        // The status label is the server's word; only the fallback is ours.
        let mode = DeviceFacts.label(DeviceFacts.entity(device, "device_status")).map { $0.lowercased() } ?? "idle"
        let reason: String? = switch work["safeWarn"]?.number.map(Int.init) {
        case 0: L10n.string("A cat came close.")
        case 1: L10n.string("A cat is inside.")
        case 3: L10n.string("The cover is open.")
        default: nil
        }
        return (mode == "idle" ? L10n.string("working") : mode, reason)
    }

    static func errorText(_ device: DeviceRecord) -> String? {
        guard case .string(let text)? = DeviceFacts.entity(device, "error")?.value else { return nil }
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    /// "Idle", "Cleaning", from the device-status sensor.
    static func workLabel(_ device: DeviceRecord) -> String? {
        DeviceFacts.label(DeviceFacts.entity(device, "device_status")).map(capitalisedFirst)
    }

    static func lastClean(_ device: DeviceRecord, zone: TimeZone?, now: Date) -> String? {
        guard let zone, let seconds = DeviceFacts.epochSeconds(DeviceFacts.entity(device, "last_clean")?.value)
        else { return nil }
        return since(Date(timeIntervalSince1970: seconds), zone: zone, now: now)
    }

    /// "06:10" when it was today in the device's zone, else "27 Oct".
    static func since(_ date: Date, zone: TimeZone?, now: Date) -> String {
        let zone = zone ?? TimeZone(secondsFromGMT: 0) ?? .gmt
        if DayStripLayout.isSameDay(date, now, in: zone) { return DayStripLayout.clock(date, in: zone) }
        let formatter = DateFormatter()
        formatter.locale = L10n.deviceClockLocale
        formatter.timeZone = zone
        formatter.dateFormat = "d MMM"
        return formatter.string(from: date)
    }

    /// "8 h 37 m", "12 m", "40 s", "2 d".
    static func duration(_ seconds: TimeInterval) -> String {
        let total = max(Int(seconds), 0)
        if total < 60 { return L10n.string("\(total) s") }
        if total < 3600 { return L10n.string("\(total / 60) m") }
        if total < 86400 { return L10n.string("\(total / 3600) h \(total % 3600 / 60) m") }
        return L10n.string("\(total / 86400) d")
    }

    private static func capitalisedFirst(_ text: String) -> String { text.prefix(1).uppercased() + text.dropFirst() }
}
