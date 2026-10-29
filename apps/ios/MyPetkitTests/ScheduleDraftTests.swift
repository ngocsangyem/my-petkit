import XCTest
@testable import MyPetkit

/// Reading the served schedules, what the server would refuse, and the value
/// that goes on the wire.
final class ScheduleDraftTests: XCTestCase {
    private func json(_ text: String) throws -> ScheduleJSON {
        try JSONDecoder().decode(ScheduleJSON.self, from: Data(text.utf8))
    }

    func testRangesRoundTripWithoutTidying() throws {
        // A window across midnight, a one-minute window and the whole day: all real, none touched.
        let served = try json("[[1320, 420], [0, 1], [0, 1440]]")
        let draft = ScheduleDraft(kind: .ranges, value: served)
        XCTAssertNil(draft.problem)
        XCTAssertEqual(draft.wire(), served)
        guard case .ranges(let ranges) = draft else { return XCTFail("not ranges") }
        XCTAssertTrue(ranges[0].crossesMidnight)
        XCTAssertTrue(ranges[2].isAllDay)
        XCTAssertEqual(ranges[2].label, "All day")
    }

    func testRangeOutsideTheDayIsRefused() {
        XCTAssertNotNil(ScheduleDraft.ranges([ScheduleRange(start: 0, end: 1441)]).problem)
        XCTAssertNotNil(ScheduleDraft.ranges([ScheduleRange(start: -1, end: 10)]).problem)
        XCTAssertNil(ScheduleDraft.ranges([]).problem)
    }

    func testWeeklyReadsDaysAndSwitch() throws {
        let draft = ScheduleDraft(kind: .weekly, value: try json(#"[{"enable": 0, "rpt": "7,1", "time": [[480, 1080]]}]"#))
        guard case .weekly(let entries) = draft else { return XCTFail("not weekly") }
        XCTAssertEqual(entries.first?.enabled, false)
        XCTAssertEqual(entries.first?.days, .weekend)
        XCTAssertEqual(draft.wire(), try json(#"[{"enable": 0, "rpt": "1,7", "time": [[480, 1080]]}]"#))
    }

    func testWeeklyWithoutDaysIsRefused() {
        let entry = WeeklyEntry(enabled: true, days: [], ranges: [.allDay])
        XCTAssertEqual(ScheduleDraft.weekly([entry]).problem, "Pick at least one day for each entry.")
    }

    func testPointsKeepEveryTypeAndRefuseEndOfDay() throws {
        let served = try json(#"[{"id": 1, "repeats": "1,2,3,4,5,6,7", "time": 570, "type": 0},"#
            + #"{"id": 2, "repeats": "1", "time": 1260, "type": 5}]"#)
        let draft = ScheduleDraft(kind: .points, value: served)
        XCTAssertNil(draft.problem)
        XCTAssertEqual(draft.wire(), served)
        XCTAssertEqual(draft.nextPointID, 3)
        let atMidnight = PointEntry(serverID: 1, type: 0, days: .everyDay, minute: 1440)
        XCTAssertEqual(ScheduleDraft.points([atMidnight]).problem, "A time is outside the day.")
    }

    func testFeedSaveKeepsTheKeysItDoesNotOwn() throws {
        // The editor took its copy before a one-off feed was added; the save
        // must carry the CURRENT one-off feeds, not drop them.
        let editedFrom = try json(#"{"schedule": [{"re": "1,2,3,4,5,6,7", "it": "#
            + #"[{"id": "n_25200", "t": 25200, "a1": 2, "a2": 0}]}], "v": 2}"#)
        var draft = ScheduleDraft(kind: .feed, value: editedFrom)
        draft.put(FeedMeal(mealID: .int(draft.nextMealID), second: 64_800, hopper1: 1, hopper2: 1), group: 0, at: nil)
        let current = try json(#"{"schedule": [], "v": 2, "deferred": [{"id": "d_1", "a1": 1, "a2": 0, "fire_at": 1}]}"#)
        let wire = draft.wire(current: current)
        XCTAssertEqual(wire["deferred"], current["deferred"])
        XCTAssertEqual(wire["v"], .int(2))
        let meals = wire["schedule"].array.first?["it"].array ?? []
        XCTAssertEqual(meals.count, 2)
        XCTAssertEqual(meals[0]["id"], .string("n_25200"))
        XCTAssertEqual(meals[1]["id"], .int(1))
        XCTAssertEqual(meals[1]["t"], .int(64_800))
    }

    func testFeedPortionBounds() {
        let meal = { (first: Int, second: Int) in
            ScheduleDraft.feed([FeedGroup(days: .everyDay, meals: [FeedMeal(mealID: .int(1), second: 0, hopper1: first, hopper2: second)])])
        }
        XCTAssertNil(meal(0, 255).problem)
        XCTAssertNotNil(meal(256, 0).problem)
        XCTAssertNotNil(meal(1, -1).problem)
    }

    func testFeedGroupWithoutDaysAndMealOutsideTheDay() {
        let noDays = ScheduleDraft.feed([FeedGroup(days: [], meals: [])])
        XCTAssertEqual(noDays.problem, "Pick at least one day for each set of meals.")
        let lateMeal = FeedMeal(mealID: .int(1), second: 86_400, hopper1: 1, hopper2: 0)
        let late = ScheduleDraft.feed([FeedGroup(days: .everyDay, meals: [lateMeal])])
        XCTAssertEqual(late.problem, "A meal time is outside the day.")
    }

    func testMealAddedToAnEmptyFeederStartsAnEveryDaySet() {
        var draft = ScheduleDraft.feed([])
        draft.put(FeedMeal(mealID: .int(1), second: 3600, hopper1: 1, hopper2: 0), group: 0, at: nil)
        guard case .feed(let groups) = draft else { return XCTFail("not feed") }
        XCTAssertEqual(groups.count, 1)
        XCTAssertEqual(groups[0].days, .everyDay)
        XCTAssertEqual(groups[0].meals.count, 1)
    }

    func testRowEditsIgnoreStaleIndexesAndOtherKinds() {
        var draft = ScheduleDraft.ranges([.allDay])
        draft.put(ScheduleRange(start: 1, end: 2), at: 5)
        draft.removeRow(.range(index: 9))
        draft.put(PointEntry(serverID: 1, type: 0, days: .everyDay, minute: 0), at: nil)
        XCTAssertEqual(draft, .ranges([.allDay]))
        draft.removeRow(.range(index: 0))
        XCTAssertEqual(draft, .ranges([]))
    }

    func testNextIDSkipsTheCloudsStringIDs() {
        XCTAssertEqual(ScheduleDraft.nextID([.string("n_46560"), .int(4), .string("7")]), 5)
        XCTAssertEqual(ScheduleDraft.nextID([]), 1)
    }

    func testNextMealAndNowLine() {
        let groups = [
            FeedGroup(days: .everyDay, meals: [
                FeedMeal(mealID: .int(1), second: 7 * 3600, hopper1: 1, hopper2: 0),
                FeedMeal(mealID: .int(2), second: 18 * 3600, hopper1: 1, hopper2: 0),
            ]),
        ]
        let now = 14 * 3600 + 47 * 60
        let next = ScheduleFeedPlan.nextMeal(groups: groups, weekday: 5, nowSecond: now)
        XCTAssertEqual(next?.second, 18 * 3600)
        XCTAssertEqual(next?.daysAhead, 0)
        XCTAssertEqual(ScheduleFeedPlan.sentence(for: next), "Next meal at 18:00, in 3 h 13 m.")
        let tomorrow = ScheduleFeedPlan.nextMeal(groups: groups, weekday: 5, nowSecond: 20 * 3600)
        XCTAssertEqual(ScheduleFeedPlan.sentence(for: tomorrow), "Next meal tomorrow at 07:00.")
        let mondays = [FeedGroup(days: .day(2), meals: groups[0].meals)]
        let later = ScheduleFeedPlan.nextMeal(groups: mondays, weekday: 5, nowSecond: now)
        XCTAssertEqual(later?.daysAhead, 4)
        XCTAssertEqual(ScheduleFeedPlan.sentence(for: later), "Next meal on Mon at 07:00.")
        XCTAssertNil(ScheduleFeedPlan.nextMeal(groups: [], weekday: 1, nowSecond: 0))
        XCTAssertEqual(ScheduleFeedPlan.nowLineIndex(sortedSeconds: [25_200, 64_800], nowSecond: now), 1)
        XCTAssertEqual(ScheduleFeedPlan.nowLineIndex(sortedSeconds: [25_200], nowSecond: now), 1)
    }

    func testPortionDescriptions() {
        XCTAssertEqual(PortionRules.describe(hopper1: 1, hopper2: 1, dual: true), "Hopper 1 × 1 · Hopper 2 × 1")
        XCTAssertEqual(PortionRules.describe(hopper1: 0, hopper2: 2, dual: true), "Hopper 2 × 2")
        XCTAssertEqual(PortionRules.describe(hopper1: 1, hopper2: 0, dual: false), "1 portion")
        XCTAssertEqual(PortionRules.describe(hopper1: 3, hopper2: 9, dual: false), "3 portions")
    }

    func testJSONKeepsWholeNumbersWhole() throws {
        let value = try json(#"{"t": 5, "x": 5.5, "s": "1,2", "b": true, "n": null}"#)
        XCTAssertEqual(value["t"], .int(5))
        XCTAssertEqual(value["x"], .double(5.5))
        XCTAssertEqual(value["b"], .bool(true))
        XCTAssertEqual(value["n"], .null)
        let encoded = String(bytes: try JSONEncoder().encode(ScheduleJSON.int(5)), encoding: .utf8)
        XCTAssertEqual(encoded, "5")
    }
}
