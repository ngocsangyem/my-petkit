import Foundation
import PetkitCore

/// What a household calls a kind of device.
enum DeviceFamily: Hashable, Sendable {
    case litter, feeder, fountain, spray, other

    init(kind: DeviceKind) {
        switch kind {
        case .litterBox: self = .litter
        case .feeder, .feederDual: self = .feeder
        case .fountain: self = .fountain
        case .spray, .purifier: self = .spray
        case .unknown: self = .other
        }
    }

    init(deviceType: String) { self.init(kind: DeviceKind(deviceType: deviceType)) }

    var noun: String {
        switch self {
        case .litter: L10n.string("litter box")
        case .feeder: L10n.string("feeder")
        case .fountain: L10n.string("water fountain")
        case .spray: L10n.string("spray")
        case .other: L10n.string("device")
        }
    }
}

/// Facts read straight off a device record, with no judgement in them.
enum DeviceFacts {
    /// Commercial product names per codename, as the server's `DEVICE_NAMES`.
    static let productNames: [String: String] = [
        "feeder": "Feeder", "feedermini": "Feeder Mini", "d3": "Feeder D3", "d4": "Fresh Element Solo",
        "d4s": "Feeder D4s", "d4h": "YumShare Solo", "d4sh": "YumShare Dual-Hopper", "t3": "Pura X",
        "t4": "Pura Max", "t5": "Purobot Max Pro 2", "t6": "Purobot Ultra", "t7": "Purobot Crystal Duo",
        "w4": "EverSweet", "w5": "EverSweet 3 Pro", "ctw2": "EverSweet Solo 2", "ctw3": "EverSweet Max Cordless",
        "w7h": "EverSweet Ultra AI", "k2": "Pura Air", "k3": "Pura Air K3",
    ]

    /// "Purobot Ultra T6" (product name and codename), or just the codename.
    static func modelLine(type: String) -> String {
        let code = type.uppercased()
        return productNames[type.lowercased()].map { "\($0) \(code)" } ?? code
    }

    /// Models that relay Bluetooth accessories: the Wi-Fi litter boxes and feeders.
    static func relaysBluetooth(type: String) -> Bool {
        switch DeviceFamily(deviceType: type) {
        case .litter, .feeder: true
        default: false
        }
    }

    /// Models with the sounds screen: the camera feeders.
    static func hasSounds(_ device: DeviceRecord) -> Bool { device.isCamera && device.isFeeder }

    // MARK: Entities

    static func entity(_ device: DeviceRecord, _ key: String) -> DeviceEntity? {
        device.entities.first { $0.key == key }
    }

    /// A number out of an entity value, or nil.
    static func number(_ entity: DeviceEntity?) -> Double? {
        guard let value = entity?.value, let number = value.number, number.isFinite else { return nil }
        if case .string(let text) = value, text.trimmingCharacters(in: .whitespaces).isEmpty { return nil }
        return number
    }

    /// Whether a binary entity reads "on"; nil when the device never sent it.
    static func isOn(_ entity: DeviceEntity?) -> Bool? {
        guard let value = entity?.value else { return nil }
        switch value {
        case .null: return nil
        case .bool(let on): return on
        case .number(let number): return number != 0
        case .string(let text): return !(text == "0" || text.isEmpty || text.lowercased() == "off")
        default: return true
        }
    }

    /// The label of an enum entity's value (`options` by way of `option_values`), else its text.
    static func label(_ entity: DeviceEntity?) -> String? {
        guard let entity, let value = entity.value, value != .null else { return nil }
        if let options = entity.options, !options.isEmpty {
            let values: [JSONValue] = entity.optionValues ?? options.indices.map { .number(Double($0)) }
            if let index = values.firstIndex(where: { $0.string == value.string }), index < options.count {
                return options[index].string
            }
        }
        return value.string
    }

    // MARK: Time

    /// Epoch seconds out of a device timestamp: 0 means never, milliseconds are scaled down.
    static func epochSeconds(_ value: JSONValue?) -> Double? {
        guard let value else { return nil }
        if let number = value.number, number.isFinite {
            guard number > 0 else { return nil }
            return number > 1e12 ? number / 1000 : number
        }
        if let text = value.string, let date = ISO8601DateFormatter().date(from: text) {
            return date.timeIntervalSince1970
        }
        return nil
    }

    /// When the device last said anything, over any channel. A device on MQTT
    /// stops polling the heartbeat, so the heartbeat alone would call the
    /// healthiest device stale.
    static func lastReport(_ device: DeviceRecord) -> Date? {
        [device.lastHeartbeat, device.lastStateReport, device.lastSeen, device.lastMqtt]
            .compactMap(epochSeconds).max().map { Date(timeIntervalSince1970: $0) }
    }

    /// The zone the device's day is read in. A zone NAME the device reported is
    /// used as such (DST-correct); anything else is the fixed offset the server
    /// settled on. Nil until the detail is loaded.
    static func zone(_ info: TimezoneInfo?) -> TimeZone? {
        guard let info else { return nil }
        if info.source == "locale", info.locale.contains("/"), let named = TimeZone(identifier: info.locale) {
            return named
        }
        guard info.effective.isFinite else { return nil }
        return TimeZone(secondsFromGMT: Int((info.effective * 3600).rounded()))
    }

    /// "Asia/Saigon", or "UTC+7" / "UTC-3.5" for a fixed offset.
    static func zoneLabel(_ info: TimezoneInfo) -> String {
        if info.source == "locale", info.locale.contains("/") { return info.locale }
        return offsetLabel(info.effective)
    }

    static func offsetLabel(_ hours: Double) -> String {
        let text = hours.rounded() == hours ? String(Int(hours)) : String(hours)
        return "UTC\(hours >= 0 ? "+" : "")\(text)"
    }

    // MARK: Status

    /// The status mark: which transport a command will take, or why none will.
    static func status(_ device: DeviceRecord) -> DeviceStatus {
        if !device.online { return lastReport(device) == nil ? .unknown : .offline }
        return device.mqttConnected ? .online(transport: "MQTT") : .polling
    }

    /// An accessory has no transport of its own: its parent decides.
    static func status(_ accessory: BleAccessoryRecord) -> DeviceStatus {
        guard accessory.linkWith != nil, accessory.parentName != nil, accessory.parentOnline else {
            return accessory.parentName == nil ? .unknown : .offline
        }
        return epochSeconds(accessory.lastSeen) == nil ? .unknown : .online(transport: "Bluetooth")
    }

    // MARK: Drawing levels

    /// The fill of each container in the drawing, from what the device reports.
    /// Litter is a real percentage. Hoppers and fountains report only "has food"
    /// / "low", so the drawing shows that much: mostly full, nearly empty, or
    /// empty when nothing was reported.
    static func drawingLevels(_ device: DeviceRecord) -> (Double?, Double?) {
        switch DeviceKind(deviceType: device.type) {
        case .litterBox:
            return (number(entity(device, "litter_percent")).map { $0 / 100 }, nil)
        case .feederDual:
            return (hopperLevel(entity(device, "hopper1_level"), low: nil),
                    hopperLevel(entity(device, "hopper2_level"), low: nil))
        case .feeder:
            let low = isOn(entity(device, "food_low"))
            return (hopperLevel(entity(device, "hopper_level"), low: low), nil)
        case .fountain:
            let lacking = isOn(entity(device, "water_lack")) ?? isOn(entity(device, "w5_water_missing"))
                ?? isOn(entity(device, "ctw3_water_lack"))
            return (lacking.map { $0 ? lowFill : reportedFill }, nil)
        default:
            return (nil, nil)
        }
    }

    static let reportedFill = 0.7
    static let lowFill = 0.12

    /// A hopper level sensor reads 0 (empty) or 2 (has food); `low` is the
    /// family's food-low flag for a single hopper without one.
    private static func hopperLevel(_ sensor: DeviceEntity?, low: Bool?) -> Double? {
        if let reading = number(sensor) { return reading > 0 ? reportedFill : 0 }
        return low.map { $0 ? lowFill : reportedFill }
    }
}
