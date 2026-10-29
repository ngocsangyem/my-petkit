import XCTest
@testable import MyPetkit

/// The edit sheets' typed text: what is accepted, what is refused, and that a
/// cleared field stays cleared instead of snapping back to its old value.
final class ScheduleFormTests: XCTestCase {
    private let meal = FeedMeal(mealID: .string("n_64800"), second: 64_800, hopper1: 2, hopper2: 1)

    func testClearedMealTimeStaysClearedAndIsRefused() {
        var form = MealForm(meal, dual: true)
        XCTAssertEqual(form.time, "18:00")
        form.time = ""
        XCTAssertEqual(form.time, "", "a cleared field must not be refilled")
        XCTAssertEqual(form.validated(onto: meal), .failure(FormProblem(message: "Enter a time, such as 07:30.")))
        form.time = "18:30"
        XCTAssertEqual(try form.validated(onto: meal).get().second, 66_600)
    }

    func testClearedPortionIsRefusedNotRestored() {
        var form = MealForm(meal, dual: true)
        form.hopper1 = ""
        XCTAssertEqual(form.hopper1, "")
        XCTAssertEqual(form.validated(onto: meal), .failure(FormProblem(message: "Enter the portions for hopper 1.")))
    }

    func testMealPortionBounds() throws {
        var form = MealForm(meal, dual: true)
        form.hopper1 = "255"
        form.hopper2 = "0"
        XCTAssertEqual(try form.validated(onto: meal).get().hopper1, 255)
        for bad in ["256", "-1", "1.5", "a", "+3"] {
            form.hopper1 = bad
            XCTAssertThrowsError(try form.validated(onto: meal).get(), bad)
        }
    }

    func testSingleHopperKeepsTheServedSecondPortion() throws {
        var form = MealForm(meal, dual: false)
        form.hopper2 = "garbage nobody can see"
        let updated = try form.validated(onto: meal).get()
        XCTAssertEqual(updated.hopper2, 1)
        XCTAssertEqual(updated.mealID, .string("n_64800"))
    }

    func testMealTimeCannotBeEndOfDay() {
        var form = MealForm(dual: false)
        form.time = "24:00"
        XCTAssertThrowsError(try form.validated(onto: meal).get())
    }

    func testRangeFormAcceptsMidnightCrossingAndEndOfDay() throws {
        XCTAssertEqual(try RangeForm(start: "22:00", end: "07:00").validated().get(), ScheduleRange(start: 1320, end: 420))
        XCTAssertEqual(try RangeForm(start: "08:00", end: "24:00").validated().get(), ScheduleRange(start: 480, end: 1440))
        XCTAssertEqual(try RangeForm(isAllDay: true).validated().get(), .allDay)
        XCTAssertEqual(RangeForm(.allDay).isAllDay, true)
    }

    func testRangeFormNamesTheEmptyField() {
        XCTAssertEqual(RangeForm(start: "", end: "07:00").validated(),
                       .failure(FormProblem(message: "Enter a start time, such as 07:30.")))
        XCTAssertEqual(RangeForm(start: "07:00", end: "7").validated(),
                       .failure(FormProblem(message: "An end time must be a time from 00:00 to 24:00.")))
    }

    func testWeeklyFormNeedsDaysAndValidPeriods() {
        var form = WeeklyForm()
        form.days = []
        XCTAssertEqual(form.validated().failureMessage, "Pick at least one day.")
        form.days = .weekdays
        form.ranges = [RangeForm(start: "08:00", end: "")]
        XCTAssertEqual(form.validated().failureMessage, "Period 1: Enter an end time, such as 07:30.")
        form.ranges = []
        XCTAssertNil(form.validated().failureMessage)
    }

    func testPointFormNeedsATimeAndDays() throws {
        let point = PointEntry(serverID: 3, type: 1, days: .everyDay, minute: 0)
        var form = PointForm(point)
        form.time = "21:15"
        form.days = .weekend
        let updated = try form.validated(onto: point).get()
        XCTAssertEqual(updated.minute, 1275)
        XCTAssertEqual(updated.days, .weekend)
        XCTAssertEqual(updated.serverID, 3)
        form.days = []
        XCTAssertEqual(form.validated(onto: point).failureMessage, "Pick at least one day.")
    }

    func testOneOffFeedIsSentOnTheFeedersClock() throws {
        let clock = DeviceClock(offsetHours: 7)
        // 2026-10-29 07:47:30 UTC: 14:47:30 in Saigon.
        let now = Date(timeIntervalSince1970: 1_793_260_050)
        let form = DeferredFeedForm(moment: now.addingTimeInterval(3600), hopper1: "2", hopper2: "1", dual: true)
        let draft = try form.validated(clock: clock, now: now).get()
        XCTAssertEqual(draft, DeferredFeedDraft(date: "2026-10-29", time: "15:47", hopper1: 2, hopper2: 1))
    }

    func testOneOffFeedInTheSameMinuteIsInThePast() {
        let clock = DeviceClock(offsetHours: 7)
        let now = Date(timeIntervalSince1970: 1_793_260_050)
        // 20 s later is still 14:47, which the server reads as already gone.
        let form = DeferredFeedForm(moment: now.addingTimeInterval(20), dual: false)
        XCTAssertEqual(form.validated(clock: clock, now: now).failureMessage,
                       "Pick a time later than now on the feeder's clock.")
    }

    func testOneOffPortionsUseTheOneOffLimit() {
        let clock = DeviceClock(offsetHours: 7)
        let now = Date(timeIntervalSince1970: 1_793_260_050)
        var form = DeferredFeedForm(moment: now.addingTimeInterval(7200), dual: false)
        form.hopper1 = "21"
        XCTAssertEqual(form.validated(clock: clock, now: now).failureMessage,
                       "Portions for this feed are whole numbers from 0 to 20.")
        form.hopper1 = "20"
        form.hopper2 = "not shown"
        XCTAssertEqual(try? form.validated(clock: clock, now: now).get().hopper2, 0)
    }
}

private extension Result where Failure == FormProblem {
    var failureMessage: String? {
        if case .failure(let problem) = self { return problem.message }
        return nil
    }
}
