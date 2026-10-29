import Foundation
import PetkitCore

/// Sample data for the devices previews, shaped like the art-direction
/// sample day (Tue 28 Oct 2026, 14:47 in Asia/Saigon). Never sent anywhere.
enum DevicePreviewFixtures {
    static let zone = TimeZone(identifier: "Asia/Saigon") ?? .gmt
    /// 2026-10-28 14:47 in Asia/Saigon.
    static let now = Date(timeIntervalSince1970: 1_793_173_620)

    static func at(_ hour: Int, _ minute: Int) -> Double {
        now.timeIntervalSince1970 - Double((14 * 60 + 47 - (hour * 60 + minute)) * 60)
    }

    static let saigon = TimezoneInfo(effective: 7, override: nil, reported: 7, locale: "Asia/Saigon", source: "locale")

    static var litterBox: DeviceRecord {
        var device = DeviceRecord(id: 100_234_567, type: "t6", name: "Litter box")
        device.firmware = "1.2.86"
        device.online = true
        device.mqttConnected = true
        device.isCamera = true
        device.supportsAi = true
        device.lastMqtt = .number(at(14, 47) - 12)
        device.timezoneInfo = saigon
        device.streams = ["rtsp": .string("rtsp://192.168.1.20:8554/100234567")]
        device.entities = [
            sensor("device_status", "Device Status", .number(-1), options: ["idle", "cleaning"], values: [-1, 0]),
            sensor("litter_percent", "Litter Level", .number(62), unit: "%"),
            sensor("package_count", "Bags Left", .number(14)),
            sensor("n60_spray_days", "N60 Spray Days Left", .number(3), unit: "days"),
            sensor("n50_durability", "N50 Days Left", .number(19), unit: "days"),
            sensor("last_clean", "Last Cleaned", .number(at(14, 5))),
            control("switch", "auto_work", "Auto Clean", .number(1)),
            control("number", "cleaning_delay", "Clean Delay", .number(5), unit: "min", range: (0, 60)),
            DeviceEntity(component: "select", key: "sand_type", name: "Litter Type", value: .number(1))
                .settable(options: ["Bentonite", "Tofu", "Mixed"]),
        ]
        device.actions = [
            DeviceAction(key: "cleaning_start", name: "Scoop", destructive: false),
            DeviceAction(key: "pack_waste", name: "Pack Waste", destructive: false),
            DeviceAction(key: "level_litter", name: "Level Litter", destructive: false),
            DeviceAction(key: "deodorize", name: "Deodorize", destructive: false),
            DeviceAction(key: "dump_litter", name: "Dump Litter", destructive: true),
        ]
        device.ble = [.init(id: 300_001, type: "k3")]
        return device
    }

    static var feeder: DeviceRecord {
        var device = DeviceRecord(id: 100_198_342, type: "d4sh", name: "Kitchen feeder")
        device.firmware = "1.3.12"
        device.online = true
        device.isCamera = true
        device.isFeeder = true
        device.lastHeartbeat = .number(at(14, 47) - 40)
        device.timezoneInfo = saigon
        device.entities = [
            sensor("hopper1_level", "Hopper 1", .number(2), options: ["Empty", "Has food"], values: [0, 2]),
            sensor("hopper2_level", "Hopper 2", .number(0), options: ["Empty", "Has food"], values: [0, 2]),
            sensor("food_in_bowl", "Food in Bowl", .number(12), unit: "g"),
            sensor("amount_eaten", "Amount Eaten", .number(23), unit: "g"),
            sensor("total_dispensed", "Total Dispensed", .number(35), unit: "g"),
            sensor("desiccant_days", "Desiccant Days Left", .number(12), unit: "days"),
            control("switch", "child_lock", "Child Lock", .number(0)),
        ]
        device.actions = [
            DeviceAction(key: "feed", name: "Feed", destructive: false),
            DeviceAction(key: "food_replenished", name: "Food Replenished", destructive: false),
            DeviceAction(key: "reset_desiccant", name: "Reset Desiccant", destructive: true),
        ]
        let meal = { (t: Int, a1: Int, a2: Int) -> JSONValue in
            .object(["t": .number(Double(t)), "a1": .number(Double(a1)), "a2": .number(Double(a2))])
        }
        device.schedules = [ScheduleTarget(target: "feed", name: "Meals", kind: "feed", value: .object([
            "schedule": .array([.object(["re": .string("1,2,3,4,5,6,7"), "it": .array([
                meal(25200, 1, 1), meal(43200, 1, 0), meal(64800, 1, 1), meal(79200, 1, 0),
            ])])]),
        ]), dual: true)]
        return device
    }

    static var fountain: DeviceRecord {
        var device = DeviceRecord(id: 100_155_021, type: "w7h", name: "Water fountain")
        device.firmware = "2.1.4"
        device.isCamera = true
        device.lastStateReport = .number(at(6, 10))
        device.timezoneInfo = saigon
        device.entities = [
            sensor("filter_percent", "Filter Level", .number(31), unit: "%"),
            sensor("filter_days", "Filter Days Left", .number(9), unit: "days"),
            sensor("drink_times", "Drinks Today", .number(3)),
            DeviceEntity(component: "binary_sensor", key: "water_lack", name: "Water Lack", value: .number(0)),
            control("switch", "heater", "Heater", .number(0)),
        ]
        device.actions = [
            DeviceAction(key: "fountain_refill", name: "Refill", destructive: false),
            DeviceAction(key: "fountain_flush", name: "Flush", destructive: false),
            DeviceAction(key: "pause_fountain", name: "Pause", destructive: false),
        ]
        return device
    }

    static var spray: BleAccessoryRecord {
        var spray = BleAccessoryRecord(petkitID: 300_001, bleType: "k3", name: "Pura Air spray")
        spray.linkWith = litterBox.id
        spray.parentName = "Litter box"
        spray.parentOnline = true
        spray.lastSeen = .number(at(14, 47) - 2 * 86400)
        spray.interval = 600
        return spray
    }

    static let pets = [
        HomePetRecord(id: 1, name: "Miso", weight: 5.42),
        HomePetRecord(id: 2, name: "Mochi", weight: 3.86),
    ]

    static var sessions: [TimelineSessionRecord] {
        let visit = { (pet: Int, hour: Int, minute: Int) in
            TimelineSessionRecord(kind: "visit", deviceID: litterBox.id, ts: at(hour, minute), petID: pet)
        }
        let feed = { (hour: Int, minute: Int) in
            TimelineSessionRecord(kind: "event", deviceID: feeder.id, ts: at(hour, minute), eventKind: "feeding")
        }
        return [visit(1, 1, 12), visit(2, 3, 47), visit(1, 8, 31), visit(2, 11, 5), visit(1, 13, 58),
                feed(7, 0), feed(12, 0)]
    }

    @MainActor static var home: HomeModel {
        HomeModel(devices: .loaded([litterBox, feeder, fountain]), accessories: [spray],
                  pets: .loaded(pets), sessions: .loaded(sessions))
    }

    private static func sensor(_ key: String, _ name: String, _ value: JSONValue, unit: String? = nil,
                               options: [String]? = nil, values: [Double]? = nil) -> DeviceEntity {
        var entity = DeviceEntity(component: "sensor", key: key, name: name, value: value)
        entity.unit = unit
        entity.options = options?.map(JSONValue.string)
        entity.optionValues = values?.map(JSONValue.number)
        return entity
    }

    private static func control(_ component: String, _ key: String, _ name: String, _ value: JSONValue,
                                unit: String? = nil, range: (Double, Double)? = nil) -> DeviceEntity {
        var entity = DeviceEntity(component: component, key: key, name: name, value: value)
        entity.settable = true
        entity.unit = unit
        entity.min = range?.0
        entity.max = range?.1
        entity.step = range == nil ? nil : 1
        return entity
    }
}

private extension DeviceEntity {
    func settable(options: [String]) -> DeviceEntity {
        var entity = self
        entity.settable = true
        entity.options = options.map(JSONValue.string)
        return entity
    }
}

extension ServerSession {
    /// A session for previews: it is never asked to load anything.
    static let preview: ServerSession = {
        let url = URL(string: "https://home.example.com") ?? URL(fileURLWithPath: "/")
        guard let address = try? ServerAddress(url: url, pin: nil) else {
            preconditionFailure("A public https host never needs a pin")
        }
        return ServerSession(paired: PairedServer(address: address, token: "preview", tokenID: 0))
    }()
}
