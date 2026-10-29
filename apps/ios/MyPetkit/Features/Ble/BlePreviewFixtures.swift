import Foundation
import PetkitAPI
import PetkitCore

/// Fixture data for the BLE previews, shaped like a real `/api/ble` reply:
/// a K3 linked to a T6 that has never reported (guessed scan type), and a W5
/// fountain on the same box that reports. Secrets are masked as the server does.
enum BlePreviewFixtures {
    static let parentID = "100234567"

    static let json = """
    {"accessories": [
      {"petkit_id": 900001, "ble_type": "k3", "name": "Pura Air K3", "parent_name": "Purobot Ultra T6",
       "parent_type": "t6", "parent_online": true, "last_seen": 0, "entities": [],
       "mac": "A4C1382F7B10", "secret": "[redacted 16 chars]", "interval": 240, "link_with": 100234567,
       "serial_number": "", "scan_type": 0, "scan_type_is_guessed": true,
       "wire_entry": {"id": 900001, "secret": "[redacted 16 chars]", "type": 0, "mac": "A4C1382F7B10",
                      "interval": 240},
       "state": {}},
      {"petkit_id": 900002, "ble_type": "w5", "name": "EverSweet 3 Pro", "parent_name": "Purobot Ultra T6",
       "parent_type": "t6", "parent_online": true, "last_seen": 1793256300, "mac": "C8478C1A2B3C",
       "secret": "", "interval": 240, "link_with": 100234567, "serial_number": "W5-20231104",
       "scan_type": 0, "scan_type_is_guessed": false,
       "wire_entry": {"id": 900002, "secret": "", "type": 14, "mac": "C8478C1A2B3C", "interval": 240},
       "state": {"states": {"powerStatus": 1, "mode": 1}, "consumables": {"filterPercentage": 62}},
       "entities": [
         {"component": "sensor", "key": "w5_filter", "name": "Filter", "value_path": "consumables.filterPercentage",
          "unit": "%", "device_class": null, "icon": null, "options": null, "option_values": null,
          "settable": false, "entity_category": null, "min": null, "max": null, "step": null, "value": 62},
         {"component": "sensor", "key": "w5_pump_today", "name": "Pump Runtime Today",
          "value_path": "states.pump_runtime", "unit": "min", "device_class": null, "icon": null, "options": null,
          "option_values": null, "settable": false, "entity_category": null, "min": null, "max": null,
          "step": null, "value": null},
         {"component": "switch", "key": "w5_power", "name": "Power", "value_path": "states.powerStatus", "unit": null,
          "device_class": null, "icon": null, "options": null, "option_values": null, "settable": true,
          "entity_category": null, "min": null, "max": null, "step": null, "value": 1},
         {"component": "select", "key": "w5_mode", "name": "Mode", "value_path": "states.mode", "unit": null,
          "device_class": null, "icon": null, "options": ["normal", "smart"], "option_values": [1, 2],
          "settable": true, "entity_category": null, "min": null, "max": null, "step": null, "value": 1},
         {"component": "button", "key": "w5_reset_filter", "name": "Reset Filter", "value_path": null, "unit": null,
          "device_class": null, "icon": null, "options": null, "option_values": null, "settable": true,
          "entity_category": null, "min": null, "max": null, "step": null, "value": null}
       ]}
    ]}
    """

    static var accessories: [BleAccessory] {
        let data = Data(json.utf8)
        return (try? JSONDecoder().decode(Components.Schemas.BleAccessoryList.self, from: data))?.accessories ?? []
    }

    static let parent = BleParentInfo(name: "Purobot Ultra T6", isLitterBox: true, onMQTT: true)

    @MainActor
    static func model(_ state: Loadable<[BleAccessory]>? = nil) -> BleAccessoriesModel {
        BleAccessoriesModel(parentDeviceID: parentID, accessories: state ?? .loaded(accessories), parent: parent)
    }

    /// A session that is never called: previews render from the model's state.
    @MainActor
    static var session: ServerSession? {
        guard let url = URL(string: "https://petkit.example.org"),
              let address = try? ServerAddress(url: url, pin: nil) else { return nil }
        return ServerSession(paired: PairedServer(address: address, token: "preview", tokenID: 0))
    }
}
