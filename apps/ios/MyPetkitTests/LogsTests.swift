import PetkitAPI
import PetkitCore
import XCTest
@testable import MyPetkit

final class LogsTests: XCTestCase {
    private func event(_ seq: Int?, ts: Double = 0, kind: String = "mqtt", device: String? = "100234567",
                       summary: String = "event pet_in", detail: JSONValue? = nil) -> LiveEvent {
        LiveEvent(seq: seq, ts: ts, kind: kind, deviceID: device, summary: summary, detail: detail)
    }

    // MARK: Levels

    func testLevelsFollowKindAndStatus() {
        XCTAssertEqual(ServerLogRules.level(kind: "blocked", status: nil), .error)
        XCTAssertEqual(ServerLogRules.level(kind: "http", status: 503), .error)
        XCTAssertEqual(ServerLogRules.level(kind: "redact", status: nil), .warning)
        XCTAssertEqual(ServerLogRules.level(kind: "http", status: 404), .warning)
        XCTAssertEqual(ServerLogRules.level(kind: "http", status: 200), .info)
        XCTAssertEqual(ServerLogRules.level(kind: "mqtt", status: nil), .info)
    }

    func testLevelReadsTheStatusFromTheDetail() {
        let failed = event(1, kind: "http", detail: .object(["status": .number(500)]))
        let quoted = event(2, kind: "http", detail: .object(["status": .string("401")]))
        XCTAssertEqual(ServerLogRules.level(of: failed), .error)
        XCTAssertEqual(ServerLogRules.level(of: quoted), .warning)
        XCTAssertEqual(ServerLogRules.level(of: event(3)), .info)
    }

    // MARK: Text and filter

    func testLineTextNamesTheDeviceOrServer() {
        XCTAssertEqual(ServerLogRules.text(of: event(1)), "mqtt 100234567 event pet_in")
        XCTAssertEqual(ServerLogRules.text(of: event(1, kind: "connect", device: nil, summary: "broker up")),
                       "connect server broker up")
    }

    func testFilterTermsAreAndedAndCaseInsensitive() {
        let text = "mqtt 100234567 event pet_in"
        XCTAssertTrue(ServerLogRules.matches(text, filter: ""))
        XCTAssertTrue(ServerLogRules.matches(text, filter: "PET_IN 100234567"))
        XCTAssertFalse(ServerLogRules.matches(text, filter: "pet_in 100155021"))
    }

    func testFilterIsNeverARegex() {
        XCTAssertFalse(ServerLogRules.matches("mqtt event", filter: "m.tt"))
        XCTAssertTrue(ServerLogRules.matches("GET /a.b", filter: "a.b"))
    }

    func testHeartbeatsAndPingsAreHidden() {
        let heartbeat = event(1, kind: "http", summary: "POST /6/t6/dev_heartbeat -> 200")
        let ping = event(nil, kind: "ping", summary: "")
        let other = event(2)
        let all = [heartbeat, ping, other]
        XCTAssertTrue(ServerLogRules.isHeartbeat(heartbeat))
        XCTAssertEqual(ServerLogRules.visible(all, filter: "", hideHeartbeats: true), [other])
        XCTAssertEqual(ServerLogRules.visible(all, filter: "", hideHeartbeats: false), [heartbeat, other])
    }

    // MARK: Merge

    func testMergeKeepsEachSequenceOnceInTimeOrder() {
        let backfill = [event(1, ts: 10), event(2, ts: 20), event(3, ts: 30)]
        let live = [event(3, ts: 30), event(4, ts: 40), event(nil, ts: 41, kind: "ping")]
        let merged = ServerLogRules.merge(backfill: backfill, live: live)
        XCTAssertEqual(merged.map(\.seq), [1, 2, 3, 4])
    }

    func testMergeKeepsOnlyTheNewestUpToTheLimit() {
        let backfill = (1...10).map { event($0, ts: Double($0)) }
        XCTAssertEqual(ServerLogRules.merge(backfill: backfill, live: [], limit: 3).map(\.seq), [8, 9, 10])
    }

    func testClockIsTwentyFourHourInTheGivenZone() throws {
        let zone = try XCTUnwrap(TimeZone(identifier: "Asia/Saigon"))
        // 2026-10-29 07:05:02 UTC is 14:05:02 in Saigon.
        XCTAssertEqual(ServerLogRules.clock(Date(timeIntervalSince1970: 1_793_257_502), timeZone: zone), "14:05:02")
    }

    func testExportWritesOneLinePerEvent() throws {
        let utc = try XCTUnwrap(TimeZone(identifier: "UTC"))
        let text = ServerLogRules.exportText([event(1, ts: 1_793_257_502)], timeZone: utc)
        XCTAssertEqual(text, "2026-10-29 07:05:02 mqtt 100234567 event pet_in\n")
    }

    // MARK: Device logs

    func testDeviceLogWindowDecodesLinePairsAndSkipsMalformedOnes() throws {
        let json = #"{"lines":[[41,"boot ok"],["x","bad"],[42,"mqtt up"]],"total":900,"matched":2,"offset":0,"limit":500,"size":1}"#
        let window = try JSONDecoder().decode(DeviceLogWindow.self, from: Data(json.utf8))
        XCTAssertEqual(window.lines, [.init(number: 41, text: "boot ok"), .init(number: 42, text: "mqtt up")])
        XCTAssertEqual(window.total, 900)
        XCTAssertFalse(window.hasEarlier)
        XCTAssertFalse(window.hasLater)
    }

    func testDeviceLogWindowPaging() {
        let lines = (1...500).map { DeviceLogWindow.Line(number: $0, text: "") }
        let window = DeviceLogWindow(lines: lines, total: 2_000, matched: 1_200, offset: 500, limit: 500)
        XCTAssertTrue(window.hasEarlier)
        XCTAssertTrue(window.hasLater)
    }

    func testDeviceLogPathSegmentsDropTraversal() {
        XCTAssertEqual(DeviceLogRules.segments(of: "100234567/2026/devRun.log"), ["100234567", "2026", "devRun.log"])
        XCTAssertEqual(DeviceLogRules.segments(of: "/../secret//x.log"), ["secret", "x.log"])
    }

    func testPathSegmentsArePercentEncodedOneByOne() {
        XCTAssertEqual(ServerSession.encodeSegment("dev run?.log"), "dev%20run%3F.log")
        XCTAssertEqual(ServerSession.encodeSegment("a/b"), "a%2Fb")
    }

    func testEmptyReasonExplainsWhyNothingArrives() {
        XCTAssertTrue(DeviceLogRules.emptyReason(reason: "", enabledDevices: 0).hasPrefix("No device"))
        XCTAssertTrue(DeviceLogRules.emptyReason(reason: "", enabledDevices: 1).hasPrefix("Collection is on"))
        XCTAssertEqual(DeviceLogRules.emptyReason(reason: "no_log_root", enabledDevices: 0),
                       "Cannot collect: no log directory is configured.")
        XCTAssertEqual(DeviceLogRules.emptyReason(reason: "new_token", enabledDevices: 0), "Cannot collect: new_token.")
    }

    func testEnvelopeErrorsKeepTheServersMessage() {
        let body = Data(#"{"error":{"code":"step_up_required","message":"Enter your password again."}}"#.utf8)
        let error = ServerSession.apiError(status: 403, data: body, retryAfter: nil)
        XCTAssertTrue(error.needsStepUp)
        XCTAssertEqual(error.message, "Enter your password again.")
        XCTAssertEqual(ServerSession.apiError(status: 404, data: Data(), retryAfter: "5").retryAfter, 5)
    }
}
