import PetkitCore
import XCTest
@testable import MyPetkit

/// Decoding, entity reading, status and the drawing levels of a device.
final class DevicesFactsTests: XCTestCase {
    private typealias Fixtures = DevicePreviewFixtures

    func testDetailDecodesTheArrayFormOfOptionValues() throws {
        let json = """
        {"id": 5, "type": "d4sh", "name": "Feeder", "firmware": "1.3.12", "online": true,
         "mqtt_connected": false, "is_camera": true, "is_feeder": true, "supports_ai": false,
         "last_heartbeat": 1793173580.5, "last_state_report": 0, "last_seen": null, "last_mqtt": "",
         "ble": [], "state": {"food1": 2}, "streams": {}, "schedules": [],
         "actions": [{"key": "feed", "name": "Feed", "destructive": false}],
         "timezoneInfo": {"effective": 7, "override": null, "reported": 7, "locale": "Asia/Saigon", "source": "locale"},
         "entities": [{"component": "sensor", "key": "hopper1_level", "name": "Hopper 1", "value_path": "state.food1",
           "unit": null, "device_class": null, "icon": null, "options": ["Empty", "Has food"],
           "option_values": [0, 2], "settable": false, "entity_category": null, "min": null, "max": null,
           "step": null, "value": 2}]}
        """
        let device = try JSONDecoder().decode(DeviceRecord.self, from: Data(json.utf8))
        XCTAssertEqual(device.entities.first?.optionValues, [.number(0), .number(2)])
        XCTAssertEqual(DeviceFacts.label(device.entities.first), "Has food")
        XCTAssertEqual(device.actions.map(\.key), ["feed"])
        XCTAssertEqual(DeviceFacts.lastReport(device), Date(timeIntervalSince1970: 1_793_173_580.5))
    }

    func testSummaryCarriesAnEntityCount() throws {
        let json = """
        {"id": 1, "type": "t6", "name": "Box", "online": false, "mqtt_connected": false, "entities": 42,
         "last_heartbeat": 0, "last_state_report": null, "last_seen": null, "last_mqtt": null, "ble": []}
        """
        let device = try JSONDecoder().decode(DeviceRecord.self, from: Data(json.utf8))
        XCTAssertTrue(device.entities.isEmpty)
        XCTAssertEqual(DeviceFacts.status(device), .unknown)
    }

    func testEpochSecondsReadsEveryStoredShape() {
        XCTAssertNil(DeviceFacts.epochSeconds(.number(0)))
        XCTAssertNil(DeviceFacts.epochSeconds(.null))
        XCTAssertEqual(DeviceFacts.epochSeconds(.number(1_793_173_620_000)), 1_793_173_620)
        XCTAssertEqual(DeviceFacts.epochSeconds(.string("1793173620")), 1_793_173_620)
        XCTAssertEqual(DeviceFacts.epochSeconds(.string("2026-10-28T07:47:00Z")), 1_793_173_620)
    }

    func testStatusFollowsTheTransport() {
        XCTAssertEqual(DeviceFacts.status(Fixtures.litterBox), .online(transport: "MQTT"))
        XCTAssertEqual(DeviceFacts.status(Fixtures.feeder), .polling)
        XCTAssertEqual(DeviceFacts.status(Fixtures.fountain), .offline)
    }

    func testAccessoryStatusIsItsParents() {
        var spray = Fixtures.spray
        XCTAssertEqual(DeviceFacts.status(spray), .online(transport: "Bluetooth"))
        spray.parentOnline = false
        XCTAssertEqual(DeviceFacts.status(spray), .offline)
        spray.parentName = nil
        XCTAssertEqual(DeviceFacts.status(spray), .unknown)
    }

    func testBinaryAndNumberReading() {
        let on = DeviceEntity(component: "binary_sensor", key: "x", name: "X", value: .string("1"))
        let off = DeviceEntity(component: "binary_sensor", key: "x", name: "X", value: .bool(false))
        let unset = DeviceEntity(component: "binary_sensor", key: "x", name: "X", value: .null)
        XCTAssertEqual(DeviceFacts.isOn(on), true)
        XCTAssertEqual(DeviceFacts.isOn(off), false)
        XCTAssertNil(DeviceFacts.isOn(unset))
        XCTAssertNil(DeviceFacts.number(DeviceEntity(component: "sensor", key: "n", name: "N", value: .string(" "))))
        XCTAssertEqual(DeviceFacts.number(DeviceEntity(component: "sensor", key: "n", name: "N", value: .string("12"))), 12)
    }

    func testZoneUsesTheReportedNameElseTheOffset() {
        XCTAssertEqual(DeviceFacts.zone(Fixtures.saigon)?.identifier, "Asia/Saigon")
        let fixed = TimezoneInfo(effective: 5.75, override: 5.75, reported: nil, locale: "", source: "override")
        XCTAssertEqual(DeviceFacts.zone(fixed)?.secondsFromGMT(), 20700)
        XCTAssertEqual(DeviceFacts.zoneLabel(fixed), "UTC+5.75")
        XCTAssertEqual(DeviceFacts.offsetLabel(-3), "UTC-3")
        XCTAssertNil(DeviceFacts.zone(nil))
    }

    func testDrawingLevelsComeFromWhatTheDeviceReports() {
        XCTAssertEqual(DeviceFacts.drawingLevels(Fixtures.litterBox).0, 0.62)
        let feeder = DeviceFacts.drawingLevels(Fixtures.feeder)
        XCTAssertEqual(feeder.0, DeviceFacts.reportedFill)
        XCTAssertEqual(feeder.1, 0)
        XCTAssertEqual(DeviceFacts.drawingLevels(Fixtures.fountain).0, DeviceFacts.reportedFill)
        XCTAssertNil(DeviceFacts.drawingLevels(DeviceRecord(id: 1, type: "t6", name: "Box")).0)
    }

    func testModelLineAndRelays() {
        XCTAssertEqual(DeviceFacts.modelLine(type: "t6"), "Purobot Ultra T6")
        XCTAssertEqual(DeviceFacts.modelLine(type: "x9"), "X9")
        XCTAssertTrue(DeviceFacts.relaysBluetooth(type: "t4"))
        XCTAssertTrue(DeviceFacts.relaysBluetooth(type: "d4sh"))
        XCTAssertFalse(DeviceFacts.relaysBluetooth(type: "w7h"))
    }

    func testPreviousDayIsCalendarArithmetic() {
        XCTAssertEqual(DevicesAPI.previousDay("2026-03-01"), "2026-02-28")
        XCTAssertEqual(DevicesAPI.previousDay("2026-01-01"), "2025-12-31")
        XCTAssertNil(DevicesAPI.previousDay("today"))
    }

    func testRefusalReadsTheErrorEnvelope() {
        let data = Data(#"{"error": {"code": "device_busy", "message": "The box is cleaning."}}"#.utf8)
        let refusal = DevicesAPI.refusal(status: 409, data: data)
        XCTAssertEqual(refusal.code, "device_busy")
        XCTAssertEqual(refusal.message, "The box is cleaning.")
        XCTAssertEqual(DevicesAPI.refusal(status: 500, data: Data()).code, "http_500")
    }
}
