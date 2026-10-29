import PetkitCore
import XCTest
@testable import MyPetkit

final class CaptureTests: XCTestCase {
    func testRecordsReadAsSortedCompactJSON() {
        let record = JSONValue.object([
            "path": .string("/6/t6/dev_heartbeat"),
            "dev": .string("100198342"),
            "ok": .bool(true),
        ])
        XCTAssertEqual(CaptureRules.lineText(record), #"{"dev":"100198342","ok":true,"path":"/6/t6/dev_heartbeat"}"#)
    }

    func testUnparsedLinesShowTheirRawText() {
        XCTAssertEqual(CaptureRules.lineText(.object(["raw": .string("not json {")])), "not json {")
        // A real record that happens to have a raw key among others stays JSON.
        XCTAssertEqual(CaptureRules.lineText(.object(["raw": .string("x"), "ts": .number(1)])),
                       #"{"raw":"x","ts":1}"#)
    }

    func testFileDescriptions() {
        XCTAssertEqual(CaptureRules.describe("requests.jsonl"), "HTTP from devices")
        XCTAssertEqual(CaptureRules.describe("mqtt.jsonl"), "broker frames")
        XCTAssertEqual(CaptureRules.describe("proxy_mqtt.jsonl"), "proxied MQTT frames")
        XCTAssertNil(CaptureRules.describe("mine.jsonl"))
    }

    func testSummary() {
        XCTAssertEqual(CaptureRules.summary(recording: false, fileCount: 4), "Recording is off. 4 files on the server.")
        XCTAssertEqual(CaptureRules.summary(recording: true, fileCount: 1), "Recording is on. 1 file on the server.")
        XCTAssertEqual(CaptureRules.summary(recording: false, fileCount: 0), "Recording is off. No files on the server.")
    }
}
