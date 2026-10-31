import Foundation
import PetkitAPI

typealias BleAccessory = Components.Schemas.BleAccessory
typealias BleAccessoryEntity = Components.Schemas.BleAccessoryEntity

/// What the app shows about one accessory. Built from the server's view and
/// deliberately without its `secret`: the server already masks it, and leaving
/// the field out here means no screen can render even the mask by accident.
struct BleAccessorySummary: Identifiable, Equatable {
    let id: Int
    let type: BleAccessoryType?
    let typeCode: String
    let name: String
    /// The parent this accessory relays through; 0 when unlinked.
    let parentID: Int
    let parentName: String
    let parentOnline: Bool
    let lastSeen: Date?
    let mac: String
    let serialNumber: String
    let interval: Int
    /// The `type` the parent is told to scan for, after any override.
    let wireScanType: Int
    let scanTypeIsGuessed: Bool

    init(_ accessory: BleAccessory) {
        id = accessory.petkitId
        type = BleAccessoryType(accessory.bleType)
        typeCode = accessory.bleType.rawValue.uppercased()
        name = accessory.name
        parentID = accessory.linkWith
        parentName = accessory.parentName
        parentOnline = accessory.parentOnline
        // The server stores 0 for "never decoded a frame".
        lastSeen = accessory.lastSeen.flatMap { $0 > 0 ? Date(timeIntervalSince1970: $0) : nil }
        mac = BleMACAddress.display(accessory.mac)
        serialNumber = accessory.serialNumber
        interval = accessory.interval
        wireScanType = accessory.wireEntry._type
        scanTypeIsGuessed = accessory.scanTypeIsGuessed
    }

    var isLinked: Bool { parentID != 0 }

    var drawing: DeviceKind { type?.drawing ?? .unknown }

    /// "Never reported" or "Reported 5 minutes ago".
    func lastReport(now: Date = .now) -> String {
        guard let lastSeen else { return L10n.string("Never reported") }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
        formatter.locale = L10n.locale
        return L10n.string("Reported \(formatter.localizedString(for: lastSeen, relativeTo: now))")
    }

    /// Who relays for it, in a row's second line.
    var relayLine: String {
        guard isLinked else { return L10n.string("\(typeCode) · not linked to a device") }
        let parent = parentName.isEmpty ? L10n.string("device \(parentID)") : parentName
        return L10n.string("\(typeCode) · relayed by \(parent)")
    }
}

/// One entity of an accessory, flattened for display and for building a
/// command value the server accepts.
struct BleEntityItem: Identifiable, Equatable {
    enum Kind: Equatable { case sensor, toggle, choice, number, action, other }

    let key: String
    let name: String
    let kind: Kind
    let settable: Bool
    let unit: String?
    let options: [String]
    let min: Double?
    let max: Double?
    let step: Double?
    /// The value as text, nil when the accessory has not reported it.
    let valueText: String?
    /// For a toggle: whether it reads on.
    let isOn: Bool?

    var id: String { key }

    init(_ entity: BleAccessoryEntity) {
        key = entity.key
        name = entity.name
        settable = entity.settable
        unit = entity.unit
        min = entity.min
        max = entity.max
        step = entity.step
        options = (entity.options ?? []).map { Self.text($0.value) ?? "" }
        switch entity.component {
        case "sensor", "binary_sensor": kind = .sensor
        case "switch": kind = .toggle
        case "select": kind = .choice
        case "number": kind = .number
        case "button": kind = .action
        default: kind = .other
        }

        let raw = entity.value.value
        let rawText = Self.text(raw)
        let on = Self.truth(raw)
        isOn = kind == .toggle ? on : nil
        if kind == .choice, let rawText {
            // A select reports the option VALUE; the label is what a person reads
            // and what the server expects back.
            let values = (entity.optionValues ?? []).map { Self.text($0.value) }
            if let index = values.firstIndex(of: rawText), index < options.count {
                valueText = options[index]
            } else if let index = Int(rawText), values.isEmpty, options.indices.contains(index) {
                valueText = options[index]
            } else {
                valueText = rawText
            }
        } else if kind == .toggle || entity.component == "binary_sensor" {
            valueText = on.map { $0 ? L10n.string("On") : L10n.string("Off") }
        } else {
            valueText = rawText
        }
    }

    /// A reported scalar as text; nil for null, arrays and objects.
    static func text(_ value: (any Sendable)?) -> String? {
        switch value {
        case let bool as Bool: bool ? "true" : "false"
        case let int as Int: String(int)
        case let double as Double:
            if double.rounded() == double, abs(double) < 1e15 { String(Int(double)) } else { String(double) }
        case let string as String: string
        default: nil
        }
    }

    static func truth(_ value: (any Sendable)?) -> Bool? {
        switch value {
        case let bool as Bool: bool
        case let int as Int: int != 0
        case let double as Double: double != 0
        case let string as String:
            switch string.uppercased() {
            case "ON", "1", "TRUE": true
            case "OFF", "0", "FALSE": false
            default: nil
            }
        default: nil
        }
    }
}

/// How a refused accessory command reads. A 409 is the server saying why the
/// accessory cannot be reached right now (no parent, bridge down, parent off
/// MQTT); there is no queue behind it, so the sentence says nothing waits.
enum BleRefusal {
    static func explain(_ error: any Error) -> any Error {
        guard let api = APIError.from(error) else { return error }
        switch api.status {
        case 409:
            return APIError(status: api.status, code: api.code,
                            message: L10n.string("Not sent, and nothing is queued: \(api.message)"))
        case 502:
            return APIError(status: api.status, code: api.code,
                            message: L10n.string("The parent did not take the command. Nothing was sent. (\(api.message))"))
        default:
            return api
        }
    }
}
