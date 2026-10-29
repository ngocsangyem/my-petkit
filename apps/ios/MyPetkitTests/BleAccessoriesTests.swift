import PetkitAPI
import XCTest
@testable import MyPetkit

/// MAC handling, the pair request the sheet builds, and decoding `/api/ble`
/// without ever surfacing an accessory's secret. No network.
@MainActor
final class BleAccessoriesTests: XCTestCase {
    // MARK: MAC addresses

    func testMACAcceptsCommonSeparatorsAndCase() {
        let expected = "A4C1382F7B10"
        for raw in ["A4:C1:38:2F:7B:10", "a4-c1-38-2f-7b-10", "a4c1.382f.7b10", " A4C1382F7B10 ", "a4 c1 38 2f 7b 10"] {
            XCTAssertEqual(BleMACAddress.normalize(raw), expected, raw)
        }
    }

    func testMACRejectsWrongLengthAndNonHex() {
        for raw in ["", "A4:C1:38:2F:7B", "A4:C1:38:2F:7B:10:22", "A4:C1:38:2F:7B:1G", "ＡＡＢＢＣＣＤＤＥＥＦＦ", "é4C1382F7B10"] {
            XCTAssertNil(BleMACAddress.normalize(raw), raw)
        }
    }

    func testMACDisplayAddsColonsAndLeavesInvalidInputAlone() {
        XCTAssertEqual(BleMACAddress.display("a4c1382f7b10"), "A4:C1:38:2F:7B:10")
        XCTAssertEqual(BleMACAddress.display("nope"), "nope")
    }

    // MARK: Pair request

    func testPairRequestForAFountainIsAlwaysLinkedAndOmitsEmptyFields() throws {
        var draft = BlePairDraft()
        draft.type = .w5
        draft.mac = "c8-47-8c-1a-2b-3c"
        draft.linkK3 = false
        let request = try draft.request(parentID: 100_234_567).get()
        let json = try encoded(request)
        XCTAssertEqual(json["ble_type"] as? String, "w5")
        XCTAssertEqual(json["mac"] as? String, "C8478C1A2B3C")
        XCTAssertEqual(json["link_with"] as? Int, 100_234_567)
        XCTAssertEqual(json["interval"] as? Int, 240)
        for absent in ["petkit_id", "secret", "serial_number", "scan_type"] {
            XCTAssertNil(json[absent], "\(absent) should be left to the server")
        }
    }

    func testPairRequestCarriesEveryTypedField() throws {
        var draft = BlePairDraft()
        draft.type = .k3
        draft.mac = "A4:C1:38:2F:7B:10"
        draft.secret = " 0000000000000000 "
        draft.serialNumber = "K3-1"
        draft.interval = "120"
        draft.accessoryID = "900010"
        draft.scanType = "7"
        let json = try encoded(draft.request(parentID: 42).get())
        XCTAssertEqual(json["ble_type"] as? String, "k3")
        XCTAssertEqual(json["secret"] as? String, "0000000000000000")
        XCTAssertEqual(json["serial_number"] as? String, "K3-1")
        XCTAssertEqual(json["interval"] as? Int, 120)
        XCTAssertEqual(json["petkit_id"] as? Int, 900_010)
        XCTAssertEqual(json["scan_type"] as? Int, 7)
        XCTAssertEqual(json["link_with"] as? Int, 42)
    }

    func testUnlinkedSprayOmitsLinkWith() throws {
        var draft = BlePairDraft()
        draft.type = .k3
        draft.mac = "A4C1382F7B10"
        draft.linkK3 = false
        XCTAssertNil(try encoded(draft.request(parentID: 42).get())["link_with"])
    }

    func testPairRequestRefusesBadFieldsBeforeSending() {
        func problem(_ edit: (inout BlePairDraft) -> Void) -> BlePairDraft.Problem? {
            var draft = BlePairDraft()
            draft.mac = "A4C1382F7B10"
            edit(&draft)
            if case .failure(let found) = draft.request(parentID: 1) { return found }
            return nil
        }
        XCTAssertEqual(problem { $0.mac = "A4C1382F7B" }, .mac)
        XCTAssertEqual(problem { $0.interval = "0" }, .interval)
        XCTAssertEqual(problem { $0.interval = "four" }, .interval)
        XCTAssertEqual(problem { $0.accessoryID = "-3" }, .accessoryID)
        XCTAssertEqual(problem { $0.scanType = "-1" }, .scanType)
        XCTAssertNil(problem { $0.interval = "" })
    }

    // MARK: Decoding /api/ble

    func testDecodesListAndNeverSurfacesTheSecret() throws {
        let list = try JSONDecoder().decode(Components.Schemas.BleAccessoryList.self, from: Data(Self.fixture.utf8))
        XCTAssertEqual(list.accessories.count, 2)
        let spray = try XCTUnwrap(list.accessories.first)
        XCTAssertEqual(spray.bleType, .k3)
        XCTAssertTrue(spray.scanTypeIsGuessed)
        XCTAssertEqual(spray.linkWith, 100_234_567)

        // The server only ever sends the mask or nothing.
        for accessory in list.accessories {
            for secret in [accessory.secret, accessory.wireEntry.secret] {
                XCTAssertTrue(secret.isEmpty || secret.hasPrefix("[redacted "), secret)
            }
        }

        // What the screens render carries no secret field at all, masked or not.
        for accessory in list.accessories {
            let summary = BleAccessorySummary(accessory)
            let labels = Mirror(reflecting: summary).children.compactMap(\.label)
            XCTAssertFalse(labels.contains { $0.lowercased().contains("secret") }, "\(labels)")
            let rendered = Mirror(reflecting: summary).children.map { String(describing: $0.value) }
                + [summary.relayLine, BleAccessoryRow.stateLine(accessory)]
            XCTAssertFalse(rendered.contains { $0.contains("redacted") })
        }
    }

    func testSummaryAndEntityValues() throws {
        let list = try JSONDecoder().decode(Components.Schemas.BleAccessoryList.self, from: Data(Self.fixture.utf8))
        let spray = BleAccessorySummary(list.accessories[0])
        XCTAssertNil(spray.lastSeen, "last_seen 0 means it never reported")
        XCTAssertEqual(spray.lastReport(), "Never reported")
        XCTAssertEqual(spray.mac, "A4:C1:38:2F:7B:10")
        XCTAssertEqual(spray.wireScanType, 0)

        let items = list.accessories[1].entities.map(BleEntityItem.init)
        let byKey = Dictionary(uniqueKeysWithValues: items.map { ($0.key, $0) })
        XCTAssertEqual(byKey["w5_filter"]?.valueText, "62")
        XCTAssertEqual(byKey["w5_power"]?.isOn, true)
        XCTAssertEqual(byKey["w5_power"]?.valueText, "On")
        XCTAssertEqual(byKey["w5_mode"]?.valueText, "smart", "a select shows the label for its option value")
        XCTAssertEqual(byKey["w5_reset_filter"]?.kind, .action)
        XCTAssertNil(byKey["w5_pump_today"]?.valueText)
    }

    func testRefusalSaysNothingIsQueued() {
        let refused = BleRefusal.explain(APIError(status: 409, code: "conflict",
                                                  message: "MQTT bridge is not running"))
        XCTAssertEqual((refused as? APIError)?.message, "Not sent, and nothing is queued: MQTT bridge is not running")
        let other = APIError(status: 400, code: "bad_request", message: "unknown entity x")
        XCTAssertEqual(BleRefusal.explain(other) as? APIError, other)
    }

    // MARK: Helpers

    private func encoded(_ request: Components.Schemas.BleAccessoryPairRequest) throws -> [String: Any] {
        let data = try JSONEncoder().encode(request)
        return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    }

    private static let fixture = """
    {"accessories": [
      {"petkit_id": 900001, "ble_type": "k3", "name": "Pura Air K3", "parent_name": "Purobot Ultra T6",
       "parent_type": "t6", "parent_online": true, "last_seen": 0, "entities": [],
       "mac": "A4C1382F7B10", "secret": "[redacted 16 chars]", "interval": 240, "link_with": 100234567,
       "serial_number": "", "scan_type": 0, "scan_type_is_guessed": true,
       "wire_entry": {"id": 900001, "secret": "[redacted 16 chars]", "type": 0, "mac": "A4C1382F7B10",
                      "interval": 240},
       "state": {}},
      {"petkit_id": 900002, "ble_type": "w5", "name": "EverSweet 3 Pro", "parent_name": "Purobot Ultra T6",
       "parent_type": "t6", "parent_online": false, "last_seen": 1793256300.5, "mac": "C8478C1A2B3C",
       "secret": "", "interval": 240, "link_with": 100234567, "serial_number": "W5-1",
       "scan_type": 0, "scan_type_is_guessed": false,
       "wire_entry": {"id": 900002, "secret": "", "type": 14, "mac": "C8478C1A2B3C", "interval": 240},
       "state": {"states": {"powerStatus": 1, "mode": 2}, "consumables": {"filterPercentage": 62}},
       "entities": [
         {"component": "sensor", "key": "w5_filter", "name": "Filter", "value_path": "consumables.filterPercentage",
          "unit": "%", "device_class": null, "icon": "mdi:filter", "options": null, "option_values": null,
          "settable": false, "entity_category": null, "min": null, "max": null, "step": null, "value": 62},
         {"component": "sensor", "key": "w5_pump_today", "name": "Pump Runtime Today",
          "value_path": "states.pumpToday", "unit": "min", "device_class": null, "icon": null, "options": null,
          "option_values": null, "settable": false, "entity_category": null, "min": null, "max": null,
          "step": null, "value": null},
         {"component": "switch", "key": "w5_power", "name": "Power", "value_path": "states.powerStatus",
          "unit": null, "device_class": null, "icon": null, "options": null, "option_values": null,
          "settable": true, "entity_category": null, "min": null, "max": null, "step": null, "value": 1},
         {"component": "select", "key": "w5_mode", "name": "Mode", "value_path": "states.mode", "unit": null,
          "device_class": null, "icon": null, "options": ["normal", "smart"], "option_values": [1, 2],
          "settable": true, "entity_category": null, "min": null, "max": null, "step": null, "value": 2},
         {"component": "button", "key": "w5_reset_filter", "name": "Reset Filter", "value_path": null,
          "unit": null, "device_class": null, "icon": null, "options": null, "option_values": null,
          "settable": true, "entity_category": null, "min": null, "max": null, "step": null, "value": null}
       ]}
    ]}
    """
}
