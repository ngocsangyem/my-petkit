import XCTest
@testable import MyPetkit

/// Time parsing and formatting on the device's clock, and the weekday bitmask.
final class ScheduleClockTests: XCTestCase {
    func testParsesTypedTimes() {
        XCTAssertEqual(ScheduleClock.parse("07:30"), 450)
        XCTAssertEqual(ScheduleClock.parse("7:05"), 425)
        XCTAssertEqual(ScheduleClock.parse("0730"), 450)
        XCTAssertEqual(ScheduleClock.parse("730"), 450)
        XCTAssertEqual(ScheduleClock.parse(" 23:59 "), 1439)
        XCTAssertEqual(ScheduleClock.parse("00:00"), 0)
    }

    func testRefusesWhatIsNotAMinuteOfTheDay() {
        for text in ["", " ", "24:01", "25:00", "12:60", "12:5", "1:2:3", "ab:cd", "-1:00", "12", "12345", "١٢:٣٠"] {
            XCTAssertNil(ScheduleClock.parse(text), text)
        }
    }

    func testEndOfDayOnlyWhereARangeEndMayBeIt() {
        XCTAssertNil(ScheduleClock.parse("24:00"))
        XCTAssertEqual(ScheduleClock.parse("24:00", allowsEndOfDay: true), 1440)
        XCTAssertNil(ScheduleClock.parse("24:30", allowsEndOfDay: true))
    }

    func testFormatsMinutesAndSeconds() {
        XCTAssertEqual(ScheduleClock.format(minute: 0), "00:00")
        XCTAssertEqual(ScheduleClock.format(minute: 1440), "24:00")
        XCTAssertEqual(ScheduleClock.format(minute: 1441), "")
        XCTAssertEqual(ScheduleClock.format(minute: -1), "")
        // A feeder meal counts seconds: the cloud's n_46560 fires at 12:56.
        XCTAssertEqual(ScheduleClock.format(second: 46_560), "12:56")
        XCTAssertEqual(ScheduleClock.format(second: 86_400), "")
    }

    func testFormatsOffsetsAndDurations() {
        XCTAssertEqual(ScheduleClock.format(offsetHours: 7), "UTC+7")
        XCTAssertEqual(ScheduleClock.format(offsetHours: 5.75), "UTC+5:45")
        XCTAssertEqual(ScheduleClock.format(offsetHours: -3.5), "UTC-3:30")
        XCTAssertEqual(ScheduleClock.format(durationMinutes: 193), "3 h 13 m")
        XCTAssertEqual(ScheduleClock.format(durationMinutes: 45), "45 m")
        XCTAssertEqual(ScheduleClock.format(durationMinutes: 120), "2 h")
    }

    func testDeviceClockIgnoresThePhonesZone() {
        // 2026-10-29 07:47:00 UTC is 14:47 on a Thursday in Asia/Saigon (UTC+7).
        let moment = Date(timeIntervalSince1970: 1_793_260_020)
        let saigon = DeviceClock(offsetHours: 7)
        XCTAssertEqual(saigon.minuteOfDay(moment), 14 * 60 + 47)
        XCTAssertEqual(saigon.weekday(moment), 5)
        XCTAssertEqual(saigon.wireDateTime(moment).date, "2026-10-29")
        XCTAssertEqual(saigon.wireDateTime(moment).time, "14:47")
        let honolulu = DeviceClock(offsetHours: -10)
        XCTAssertEqual(honolulu.wireDateTime(moment).date, "2026-10-28")
        XCTAssertEqual(honolulu.weekday(moment), 4)
    }

    func testWeekdayBitmaskFollowsTheWire() {
        let days = WeekdaySet(days: [1, 7])
        XCTAssertEqual(days.rawValue, 0b100_0001)
        XCTAssertEqual(days, .weekend)
        XCTAssertEqual(days.wire, "1,7")
        XCTAssertEqual(WeekdaySet.everyDay.wire, "1,2,3,4,5,6,7")
        XCTAssertEqual(WeekdaySet(wire: "3,1,3"), WeekdaySet(days: [1, 3]))
        XCTAssertEqual(WeekdaySet(wire: "3,1,3")?.wire, "1,3")
    }

    func testWeekdayWireRefusesWhatTheServerRefuses() {
        for wire in ["", "0", "8", "1,,2", "1,x", "mon"] {
            XCTAssertNil(WeekdaySet(wire: wire), wire)
        }
    }

    func testWeekdaySummaries() {
        XCTAssertEqual(WeekdaySet.everyDay.summary, "Every day")
        XCTAssertEqual(WeekdaySet.weekdays.summary, "Weekdays")
        XCTAssertEqual(WeekdaySet.weekend.summary, "Weekends")
        XCTAssertEqual(WeekdaySet(days: [1, 2, 4]).summary, "Mon, Wed, Sun")
        XCTAssertEqual(WeekdaySet().summary, "No days")
        var days = WeekdaySet.weekdays
        days.toggle(2)
        days.toggle(1)
        XCTAssertEqual(days.wire, "1,3,4,5,6")
    }
}
