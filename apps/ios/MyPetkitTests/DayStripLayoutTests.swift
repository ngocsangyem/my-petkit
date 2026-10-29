import XCTest
@testable import MyPetkit

/// The day strip's math: device-local minutes, the axis, and edge clamping.
final class DayStripLayoutTests: XCTestCase {
    private func zone(_ name: String) -> TimeZone { TimeZone(identifier: name)! }

    private func date(_ iso: String) -> Date { ISO8601DateFormatter().date(from: iso)! }

    func testMinuteOfDayUsesTheDeviceZoneNotThePhones() {
        let instant = date("2026-10-28T07:47:00Z")
        XCTAssertEqual(DayStripLayout.minuteOfDay(instant, in: zone("Asia/Saigon")), 14 * 60 + 47)
        XCTAssertEqual(DayStripLayout.minuteOfDay(instant, in: zone("UTC")), 7 * 60 + 47)
        XCTAssertEqual(DayStripLayout.minuteOfDay(instant, in: TimeZone(secondsFromGMT: 5 * 3600 + 2700)!),
                       13 * 60 + 32)
    }

    func testSecondsAreKeptAsAFraction() {
        XCTAssertEqual(DayStripLayout.minuteOfDay(date("2026-10-28T00:00:30Z"), in: zone("UTC")), 0.5)
    }

    func testSpringForwardDayPlacesMarksOnTheWallClock() {
        // 2026-03-08 in New York is 23 hours long: 02:00 EST jumps to 03:00 EDT.
        let newYork = zone("America/New_York")
        let afterJump = date("2026-03-08T07:30:00Z") // 03:30 EDT, 2.5 h after midnight
        XCTAssertEqual(DayStripLayout.minuteOfDay(afterJump, in: newYork), 3 * 60 + 30)
        XCTAssertEqual(DayStripLayout.clock(afterJump, in: newYork), "03:30")
        let lastMinute = date("2026-03-09T03:59:00Z") // 23:59 EDT
        XCTAssertEqual(DayStripLayout.minuteOfDay(lastMinute, in: newYork), 23 * 60 + 59)
        XCTAssertTrue(DayStripLayout.isSameDay(afterJump, lastMinute, in: newYork))
    }

    func testFallBackDayKeepsTheRepeatedHourOnTheAxis() {
        // 2026-11-01 in New York is 25 hours long: 01:00–02:00 happens twice.
        let newYork = zone("America/New_York")
        let firstPass = date("2026-11-01T05:30:00Z") // 01:30 EDT
        let secondPass = date("2026-11-01T06:30:00Z") // 01:30 EST
        XCTAssertEqual(DayStripLayout.minuteOfDay(firstPass, in: newYork), 90)
        XCTAssertEqual(DayStripLayout.minuteOfDay(secondPass, in: newYork), 90)
        XCTAssertTrue(DayStripLayout.isSameDay(firstPass, date("2026-11-02T04:59:00Z"), in: newYork))
        XCTAssertFalse(DayStripLayout.isSameDay(firstPass, date("2026-11-02T05:00:00Z"), in: newYork))
    }

    func testSameDayIsCutAtTheDevicesMidnight() {
        let before = date("2026-10-28T16:59:00Z") // 23:59 in Saigon
        let after = date("2026-10-28T17:00:00Z") // 00:00 next day in Saigon
        XCTAssertFalse(DayStripLayout.isSameDay(before, after, in: zone("Asia/Saigon")))
        XCTAssertTrue(DayStripLayout.isSameDay(before, after, in: zone("UTC")))
    }

    func testXPositionsAndClamping() {
        XCTAssertEqual(DayStripLayout.x(minute: 0, width: 240), 0)
        XCTAssertEqual(DayStripLayout.x(minute: 720, width: 240), 120)
        XCTAssertEqual(DayStripLayout.x(minute: 1440, width: 240), 240)
        XCTAssertEqual(DayStripLayout.x(minute: -30, width: 240), 0)
        XCTAssertEqual(DayStripLayout.x(minute: 2000, width: 240), 240)
    }

    func testMarksStayWholeAtTheEdges() {
        XCTAssertEqual(DayStripLayout.markOrigin(minute: 0, markWidth: 8, width: 240), 0)
        XCTAssertEqual(DayStripLayout.markOrigin(minute: 1440, markWidth: 8, width: 240), 232)
        XCTAssertEqual(DayStripLayout.markOrigin(minute: 720, markWidth: 8, width: 240), 116)
    }

    func testSpanFrameDropsEmptySpans() {
        let frame = DayStripLayout.spanFrame(.init(start: 360, end: 720, reporting: true), width: 240)
        XCTAssertEqual(frame?.x, 60)
        XCTAssertEqual(frame?.width, 60)
        XCTAssertNil(DayStripLayout.spanFrame(.init(start: 600, end: 600, reporting: false), width: 240))
    }

    func testClockLabels() {
        XCTAssertEqual(DayStripLayout.clock(minute: 0), "00:00")
        XCTAssertEqual(DayStripLayout.clock(minute: 887.9), "14:47")
        XCTAssertEqual(DayStripLayout.clock(minute: 1440), "23:59")
    }
}
