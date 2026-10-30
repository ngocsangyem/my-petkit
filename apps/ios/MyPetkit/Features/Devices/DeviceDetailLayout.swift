import Foundation
import PetkitCore

/// Where each of a device's actions goes on its detail: one primary command,
/// up to four quick actions (the fourth is "More" when there are more), and
/// the rest behind More. Only actions the API lists for the model are placed,
/// so no button is ever drawn for a command the device does not have.
struct CommandLayout: Equatable {
    var primary: DeviceAction?
    var quick: [DeviceAction] = []
    var more: [DeviceAction] = []

    static let quickSlots = 4

    private static let primaryKeys: [DeviceFamily: [String]] = [
        .litter: ["cleaning_start"],
        .feeder: ["feed", "feed_hopper_1"],
        .fountain: ["fountain_refill", "resume_fountain", "fountain_flush"],
    ]

    private static let quickKeys: [DeviceFamily: [String]] = [
        .litter: ["pack_waste", "level_litter", "deodorize", "light", "maintenance_start", "maintenance_stop"],
        .feeder: ["food_replenished", "feed_hopper_2", "cancel_manual_feed", "play_sound"],
        .fountain: ["fountain_flush", "pause_fountain", "resume_fountain", "fountain_water_change"],
    ]

    /// `paused` hides the primary command: a paused cycle is shown, not driven, here.
    init(actions: [DeviceAction], family: DeviceFamily, paused: Bool = false) {
        let preferred = Self.primaryKeys[family] ?? []
        let chosen = preferred.lazy.compactMap { key in actions.first { $0.key == key } }.first
            ?? (family == .other ? actions.first { !$0.destructive } : nil)
        primary = paused ? nil : chosen
        let rest = actions.filter { $0 != chosen }
        let order = Self.quickKeys[family] ?? []
        let routine = rest.filter { !$0.destructive }.enumerated().sorted { lhs, rhs in
            let left = order.firstIndex(of: lhs.element.key) ?? order.count + lhs.offset
            let right = order.firstIndex(of: rhs.element.key) ?? order.count + rhs.offset
            return left < right
        }.map(\.element)
        let destructive = rest.filter(\.destructive)
        if destructive.isEmpty && routine.count <= Self.quickSlots {
            quick = routine
        } else {
            quick = Array(routine.prefix(Self.quickSlots - 1))
            more = Array(routine.dropFirst(Self.quickSlots - 1)) + destructive
        }
    }

    init(primary: DeviceAction?, quick: [DeviceAction], more: [DeviceAction]) {
        self.primary = primary
        self.quick = quick
        self.more = more
    }

    /// An SF Symbol for an action key; buttons, not decoration.
    static func symbol(for key: String) -> String {
        switch key {
        case "cleaning_start": "arrow.triangle.2.circlepath"
        case "pack_waste": "bag"
        case "level_litter": "water.waves"
        case "deodorize", "spray": "leaf"
        case "feed", "feed_hopper_1", "feed_hopper_2": "fork.knife"
        case "food_replenished": "checkmark.circle"
        case "cancel_manual_feed": "xmark.circle"
        case "fountain_refill": "drop"
        case "fountain_flush", "fountain_water_change": "arrow.clockwise"
        case "pause", "pause_fountain": "pause"
        case "resume", "resume_fountain": "play"
        case "light": "lightbulb"
        case "play_sound": "speaker.wave.2"
        case "power_off", "power_on": "power"
        case "maintenance_start", "maintenance_stop": "wrench"
        case "dump_litter": "trash"
        default: key.hasPrefix("reset") ? "arrow.counterclockwise" : "circle"
        }
    }
}

/// What a command result means to the person who pressed the button.
enum DeliveryText {
    static func command(_ delivered: String) -> String {
        switch delivered {
        case "mqtt": "Sent over MQTT"
        case "local": "Saved"
        case "heartbeat-queue": "Queued for the next heartbeat, about 10 s"
        default: "Sent"
        }
    }
}

/// A device's entities, split into the blocks of its detail.
struct EntityGroups: Equatable {
    /// Switches, selects and numbers the owner can set.
    var controls: [DeviceEntity] = []
    /// What the on-device AI watches for (only on a device that has the AI block).
    var aiControls: [DeviceEntity] = []
    /// A litter box's cleaning automation, shown under "Automation" in the
    /// artboard's order instead of under Settings.
    var automationControls: [DeviceEntity] = []

    static let editable: Set<String> = ["switch", "select", "number"]
    static let aiKeys: Set<String> = ["yowling_detection", "ph_detection", "pet_detection",
                                      "drink_detection", "vomit_detection"]
    static let automationKeys = ["auto_work", "cleaning_delay"]
    /// The artboard's words for the automation rows; the entity keys, names in
    /// confirmations and written values stay the server's.
    static let automationLabels: [String: EntityLabel] = [
        "auto_work": EntityLabel(title: "Auto clean after a visit", footnote: "Starts once the cat has left the box."),
        "cleaning_delay": EntityLabel(title: "Clean delay"),
    ]

    init(_ device: DeviceRecord) {
        // Capability switches have their own block, and AI detections live in
        // the AI block; both are kept out of the controls or they would show twice.
        let settable = device.entities.filter {
            Self.editable.contains($0.component) && $0.settable && !$0.valuePath.hasPrefix("capabilities.")
        }
        let isAI = { (entity: DeviceEntity) in device.supportsAi && Self.aiKeys.contains(entity.key) }
        if DeviceFamily(deviceType: device.type) == .litter {
            automationControls = Self.automationKeys.compactMap { key in
                settable.first { $0.key == key && !isAI($0) }
            }
        }
        let automation = Set(automationControls.map(\.key))
        controls = settable.filter { !isAI($0) && !automation.contains($0.key) }.enumerated()
            .sorted { ($0.element.entityCategory == nil ? 0 : 1, $0.offset) < ($1.element.entityCategory == nil ? 0 : 1, $1.offset) }
            .map(\.element)
        aiControls = settable.filter(isAI)
    }
}

/// The 2×2 figures of a device, by family. Only figures the device publishes
/// are drawn, so a model with fewer sensors gets fewer cells, not empty ones.
enum DeviceFigures {
    private struct Spec {
        let key: String
        let label: String
        var binary: (off: String, on: String)?
        var unit: String?
    }

    private static let specs: [DeviceFamily: [Spec]] = [
        .litter: [Spec(key: "package_count", label: "Bags left"),
                  Spec(key: "litter_percent", label: "Litter level", unit: "%"),
                  Spec(key: "waste_bin", label: "Waste bin", binary: ("Not full", "Full"))],
        .feeder: [Spec(key: "food_in_bowl", label: "In the bowl", unit: "g"),
                  Spec(key: "amount_eaten", label: "Eaten today", unit: "g"),
                  Spec(key: "total_dispensed", label: "Fed today", unit: "g"),
                  Spec(key: "food_low", label: "Hopper", binary: ("Has food", "Low"))],
        .fountain: [Spec(key: "filter_percent", label: "Filter", unit: "%"),
                    Spec(key: "drink_times", label: "Drinks today"),
                    Spec(key: "temperature", label: "Water", unit: "°C"),
                    Spec(key: "water_lack", label: "Water level", binary: ("OK", "Low"))],
    ]

    /// `visitsToday` is counted from the timeline, for a litter box.
    static func figures(_ device: DeviceRecord, visitsToday: Int?) -> [Figure] {
        let family = DeviceFamily(deviceType: device.type)
        var figures: [Figure] = (specs[family] ?? []).compactMap { spec in
            guard let entity = DeviceFacts.entity(device, spec.key) else { return nil }
            if let binary = spec.binary {
                return Figure(label: spec.label, value: DeviceFacts.isOn(entity).map { $0 ? binary.on : binary.off })
            }
            let value = DeviceFacts.number(entity).map(format)
            return Figure(label: spec.label, value: value, unit: value == nil ? nil : (spec.unit ?? entity.unit))
        }
        if family == .litter, let visitsToday {
            figures.insert(Figure(label: "Visits today", value: String(visitsToday)), at: min(2, figures.count))
        }
        return Array(figures.prefix(4))
    }

    static func format(_ number: Double) -> String {
        number.rounded() == number ? String(Int(number)) : String(format: "%.1f", number)
    }
}

/// One consumable bar: days left out of a fresh one's life.
struct ConsumableRow: Equatable, Identifiable {
    let label: String
    let days: Double
    let ratio: Double
    let isLow: Bool
    var id: String { label }

    static func rows(_ device: DeviceRecord) -> [ConsumableRow] {
        DeviceFindings.consumables.compactMap { spec in
            guard let days = DeviceFacts.number(DeviceFacts.entity(device, spec.key)) else { return nil }
            return ConsumableRow(label: spec.label, days: days, ratio: min(max(days / spec.lifeDays, 0), 1),
                                 isLow: days <= DeviceFindings.consumableWarnDays)
        }
    }
}
