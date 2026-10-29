import Foundation
import PetkitCore

// The read models of the devices screens, decoded leniently from the same JSON
// the generated client describes. The generated `DeviceEntity` reads
// `option_values` as an object only, so a device detail carrying the array form
// (every enum sensor and select does) fails to decode as a whole; these types
// read just the fields the screens use, and accept each shape the spec allows.

/// A device from `GET /api/devices` (summary) or `GET /api/devices/{id}`
/// (detail). The detail-only fields are empty on a summary.
struct DeviceRecord: Decodable, Identifiable, Hashable, Sendable {
    let id: Int
    let type: String
    let name: String
    var firmware = ""
    var online = false
    var mqttConnected = false
    var isCamera = false
    var isFeeder = false
    var supportsAi = false
    var lastHeartbeat: JSONValue?
    var lastStateReport: JSONValue?
    var lastSeen: JSONValue?
    var lastMqtt: JSONValue?
    var ble: [BleChild] = []
    var state: JSONValue?
    var streams: [String: JSONValue] = [:]
    var schedules: [ScheduleTarget] = []
    var entities: [DeviceEntity] = []
    var actions: [DeviceAction] = []
    var timezoneInfo: TimezoneInfo?

    struct BleChild: Decodable, Hashable, Sendable {
        let id: Int
        let type: String
    }

    enum CodingKeys: String, CodingKey {
        case id, type, name, firmware, online, ble, state, streams, schedules, entities, actions, timezoneInfo
        case mqttConnected = "mqtt_connected"
        case isCamera = "is_camera"
        case isFeeder = "is_feeder"
        case supportsAi = "supports_ai"
        case lastHeartbeat = "last_heartbeat"
        case lastStateReport = "last_state_report"
        case lastSeen = "last_seen"
        case lastMqtt = "last_mqtt"
    }

    init(id: Int, type: String, name: String) {
        self.id = id
        self.type = type
        self.name = name
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(Int.self, forKey: .id)
        type = try c.decode(String.self, forKey: .type)
        name = try c.decode(String.self, forKey: .name)
        firmware = try c.decodeIfPresent(String.self, forKey: .firmware) ?? ""
        online = try c.decodeIfPresent(Bool.self, forKey: .online) ?? false
        mqttConnected = try c.decodeIfPresent(Bool.self, forKey: .mqttConnected) ?? false
        isCamera = try c.decodeIfPresent(Bool.self, forKey: .isCamera) ?? false
        isFeeder = try c.decodeIfPresent(Bool.self, forKey: .isFeeder) ?? false
        supportsAi = try c.decodeIfPresent(Bool.self, forKey: .supportsAi) ?? false
        lastHeartbeat = try c.decodeIfPresent(JSONValue.self, forKey: .lastHeartbeat)
        lastStateReport = try c.decodeIfPresent(JSONValue.self, forKey: .lastStateReport)
        lastSeen = try c.decodeIfPresent(JSONValue.self, forKey: .lastSeen)
        lastMqtt = try c.decodeIfPresent(JSONValue.self, forKey: .lastMqtt)
        ble = try c.decodeIfPresent([BleChild].self, forKey: .ble) ?? []
        state = try c.decodeIfPresent(JSONValue.self, forKey: .state)
        streams = (try? c.decodeIfPresent([String: JSONValue].self, forKey: .streams)) ?? [:]
        schedules = try c.decodeIfPresent([ScheduleTarget].self, forKey: .schedules) ?? []
        // A summary carries the entity COUNT here; only a detail carries the list.
        entities = (try? c.decodeIfPresent([DeviceEntity].self, forKey: .entities)) ?? []
        actions = try c.decodeIfPresent([DeviceAction].self, forKey: .actions) ?? []
        timezoneInfo = try c.decodeIfPresent(TimezoneInfo.self, forKey: .timezoneInfo)
    }
}

/// One published entity with its resolved value.
struct DeviceEntity: Decodable, Hashable, Sendable {
    let component: String
    let key: String
    let name: String
    var valuePath = ""
    var unit: String?
    var options: [JSONValue]?
    /// The device values behind `options`, by index; nil when the options are the values.
    var optionValues: [JSONValue]?
    var settable = false
    var entityCategory: String?
    var min: Double?
    var max: Double?
    var step: Double?
    var value: JSONValue?

    enum CodingKeys: String, CodingKey {
        case component, key, name, unit, options, settable, min, max, step, value
        case valuePath = "value_path"
        case optionValues = "option_values"
        case entityCategory = "entity_category"
    }

    init(component: String, key: String, name: String, value: JSONValue?) {
        self.component = component
        self.key = key
        self.name = name
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        component = try c.decode(String.self, forKey: .component)
        key = try c.decode(String.self, forKey: .key)
        name = try c.decode(String.self, forKey: .name)
        valuePath = try c.decodeIfPresent(String.self, forKey: .valuePath) ?? ""
        unit = try c.decodeIfPresent(String.self, forKey: .unit)
        options = try? c.decodeIfPresent([JSONValue].self, forKey: .options)
        // The spec allows an object here too; no entity uses one as a map.
        optionValues = try? c.decodeIfPresent([JSONValue].self, forKey: .optionValues)
        settable = try c.decodeIfPresent(Bool.self, forKey: .settable) ?? false
        entityCategory = try c.decodeIfPresent(String.self, forKey: .entityCategory)
        min = try c.decodeIfPresent(Double.self, forKey: .min)
        max = try c.decodeIfPresent(Double.self, forKey: .max)
        step = try c.decodeIfPresent(Double.self, forKey: .step)
        value = try c.decodeIfPresent(JSONValue.self, forKey: .value)
    }
}

/// A named button the model has.
struct DeviceAction: Decodable, Hashable, Sendable {
    let key: String
    let name: String
    let destructive: Bool
}

/// A schedule field `POST /schedule` accepts, with its current value.
struct ScheduleTarget: Decodable, Hashable, Sendable {
    let target: String
    let name: String
    let kind: String
    var value: JSONValue?
    var dual: Bool?
}

/// Which zone the server decided the device lives in, and why.
struct TimezoneInfo: Decodable, Hashable, Sendable {
    let effective: Double
    var override: Double?
    var reported: Double?
    var locale: String
    var source: String
}

/// A Bluetooth accessory from `GET /api/ble`.
struct BleAccessoryRecord: Decodable, Identifiable, Hashable, Sendable {
    let petkitID: Int
    let bleType: String
    let name: String
    var linkWith: Int?
    var parentName: String?
    var parentOnline = false
    var lastSeen: JSONValue?
    var interval: Double = 0

    var id: Int { petkitID }

    enum CodingKeys: String, CodingKey {
        case name, interval
        case petkitID = "petkit_id"
        case bleType = "ble_type"
        case linkWith = "link_with"
        case parentName = "parent_name"
        case parentOnline = "parent_online"
        case lastSeen = "last_seen"
    }

    init(petkitID: Int, bleType: String, name: String) {
        self.petkitID = petkitID
        self.bleType = bleType
        self.name = name
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        petkitID = try c.decode(Int.self, forKey: .petkitID)
        bleType = try c.decode(String.self, forKey: .bleType)
        name = try c.decode(String.self, forKey: .name)
        linkWith = try c.decodeIfPresent(Int.self, forKey: .linkWith)
        parentName = try c.decodeIfPresent(String.self, forKey: .parentName)
        parentOnline = try c.decodeIfPresent(Bool.self, forKey: .parentOnline) ?? false
        lastSeen = try c.decodeIfPresent(JSONValue.self, forKey: .lastSeen)
        interval = (try? c.decodeIfPresent(Double.self, forKey: .interval)) ?? 0
    }
}

struct BleAccessoryList: Decodable, Sendable {
    let accessories: [BleAccessoryRecord]
}

/// A pet from `GET /api/pets`, with the first face photo as its picture.
struct PetRecord: Decodable, Identifiable, Hashable, Sendable {
    struct Face: Decodable, Hashable, Sendable {
        let id: Int
        let url: String
    }

    let id: Int
    let name: String
    var weight: Double?
    var faces: [Face] = []

    /// A server path for the photo (`url` comes without its leading slash).
    var photoPath: String? {
        faces.first.map { $0.url.hasPrefix("/") ? $0.url : "/" + $0.url }
    }
}

struct PetList: Decodable, Sendable {
    let pets: [PetRecord]
}

/// One session of `GET /api/timeline`, only the fields the strip and counts read.
struct TimelineSessionRecord: Decodable, Hashable, Sendable {
    let kind: String
    var deviceID: Int?
    var ts: Double?
    var displayTs: Double?
    var petID: Int?
    var petName: String?
    var label: String?
    var eventKind: String?
    var durationSec: Double?

    enum CodingKeys: String, CodingKey {
        case kind, ts, label
        case deviceID = "device_id"
        case displayTs = "display_ts"
        case petID = "pet_id"
        case petName = "pet_name"
        case eventKind = "event_kind"
        case durationSec = "duration_sec"
    }

    /// When to show it: the visit's entry time, else the event time.
    var date: Date? { (displayTs ?? ts).map { Date(timeIntervalSince1970: $0) } }
    var isVisit: Bool { kind == "visit" }
}

struct TimelineDayRecord: Decodable, Sendable {
    let date: String
    let sessions: [TimelineSessionRecord]
}
