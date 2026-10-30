import PetkitCore
import XCTest
@testable import MyPetkit

/// What needs you, the state sentences, the meal plan, the household day and
/// where commands go on a detail.
final class DevicesFindingsTests: XCTestCase {
    private typealias Fixtures = DevicePreviewFixtures
    private let now = DevicePreviewFixtures.now
    private let zone = DevicePreviewFixtures.zone

    // MARK: Attention and the Home header

    func testSilentDeviceComesFirstWithItsLocalTime() {
        let attention = DeviceFindings.attention(Fixtures.fountain, zone: zone, now: now)
        XCTAssertEqual(attention, Attention(text: "Silent since 06:10", tone: .negative))
    }

    func testLowConsumableIsAWarning() {
        let attention = DeviceFindings.attention(Fixtures.litterBox, zone: zone, now: now)
        XCTAssertEqual(attention, Attention(text: "N60 deodorizer in 3 days", tone: .warning))
    }

    func testProblemFlagBeatsConsumables() {
        var box = Fixtures.litterBox
        box.entities.append(DeviceEntity(component: "binary_sensor", key: "waste_bin", name: "Bin", value: .number(1)))
        XCTAssertEqual(DeviceFindings.attention(box, zone: zone, now: now)?.text, "Waste bin full")
    }

    func testHomeFindingPutsTheWorstFirst() {
        let summary = DeviceFindings.homeFinding([
            ("Litter box", Attention(text: "N60 deodorizer in 3 days", tone: .warning)),
            ("Water fountain", Attention(text: "Silent since 06:10", tone: .negative)),
        ])
        XCTAssertEqual(summary.lead, Attention(text: "Water fountain has been silent since 06:10.", tone: .negative))
        XCTAssertEqual(summary.tail, "1 more thing needs you.")
    }

    func testHomeFindingWhenEverythingIsFine() {
        let summary = DeviceFindings.homeFinding([])
        XCTAssertNil(summary.lead)
        XCTAssertEqual(summary.tail, "Everything is fine.")
        let one = DeviceFindings.homeFinding([("Feeder", Attention(text: "Food low", tone: .warning))])
        XCTAssertEqual(one.lead?.text, "Feeder: Food low.")
        XCTAssertEqual(one.tail, "Everything else is fine.")
    }

    // MARK: Sentences

    func testOfflineSentenceSaysForHowLong() {
        let sentence = DeviceFindings.sentence(Fixtures.fountain, zone: zone, now: now, nextMeal: nil)
        XCTAssertEqual(sentence.lead, "Silent for 8 h 37 m.")
        XCTAssertEqual(sentence.tone, .negative)
    }

    func testNeverReportedIsNotOffline() {
        let sentence = DeviceFindings.sentence(DeviceRecord(id: 1, type: "t6", name: "Box"), zone: nil, now: now,
                                               nextMeal: nil)
        XCTAssertEqual(sentence.lead, "Not reported yet.")
    }

    func testPausedLitterBoxSaysWhy() {
        var box = Fixtures.litterBox
        box.entities.removeAll { $0.key == "n60_spray_days" }
        box.entities[0].value = .number(0)
        box.state = .object(["workState": .object(["workProcess": .number(22), "safeWarn": .number(0)])])
        let sentence = DeviceFindings.sentence(box, zone: zone, now: now, nextMeal: nil)
        XCTAssertEqual(sentence, StateSentence(lead: "Paused while cleaning.", tone: .warning, rest: "A cat came close."))
        XCTAssertNil(CommandLayout(actions: box.actions, family: .litter, paused: true).primary)
    }

    func testRunningCycleIsNotPaused() {
        var box = Fixtures.litterBox
        box.state = .object(["workState": .object(["workProcess": .number(11)])])
        XCTAssertNil(DeviceFindings.pause(box))
        box.state = .object(["workState": .number(0)])
        XCTAssertNil(DeviceFindings.pause(box))
    }

    func testIdleLitterBoxSaysWhenItCleaned() {
        var box = Fixtures.litterBox
        box.entities.removeAll { $0.key == "n60_spray_days" }
        let sentence = DeviceFindings.sentence(box, zone: zone, now: now, nextMeal: nil)
        XCTAssertEqual(sentence, StateSentence(lead: "Idle.", tone: .positive, rest: "Cleaned at 14:05."))
        XCTAssertEqual(DeviceFindings.cardLine(box, zone: zone, now: now, nextMeal: nil)?.0, "Idle · 14 bags")
    }

    func testFeederSentenceNamesTheNextMeal() {
        let meal = PlannedMeal(minute: 1080, first: 1, second: 1)
        let sentence = DeviceFindings.sentence(Fixtures.feeder, zone: zone, now: now, nextMeal: meal)
        XCTAssertEqual(sentence, StateSentence(lead: "Next meal at 18:00.", tone: .neutral, rest: "Fed 35 g today."))
    }

    func testDurations() {
        XCTAssertEqual(DeviceFindings.duration(40), "40 s")
        XCTAssertEqual(DeviceFindings.duration(12 * 60), "12 m")
        XCTAssertEqual(DeviceFindings.duration(8 * 3600 + 37 * 60), "8 h 37 m")
        XCTAssertEqual(DeviceFindings.duration(2 * 86400 + 5), "2 d")
        XCTAssertEqual(DeviceFindings.consumableText("Filter", days: 0), "Filter used up")
        XCTAssertEqual(DeviceFindings.consumableText("Filter", days: 1), "Filter in 1 day")
    }

    // MARK: Meals

    func testTodaysMealsReadSecondsAndSundayFirstWeekdays() {
        let meals = FeedPlan.todaysMeals(Fixtures.feeder.schedules, zone: zone, now: now)
        XCTAssertEqual(meals.map(\.minute), [420, 720, 1080, 1320])
        XCTAssertEqual(FeedPlan.next(meals, after: 887)?.minute, 1080)
        XCTAssertEqual(meals[0].portionsText(dual: true), "1 + 1 portions")
        XCTAssertEqual(meals[1].portionsText(dual: false), "1 portion")
    }

    func testMealsOnOtherWeekdaysAreSkipped() {
        // 28 Oct 2026 is a Wednesday: weekday 4 with Sunday = 1.
        let target = ScheduleTarget(target: "feed", name: "Meals", kind: "feed", value: .object(["schedule": .array([
            .object(["re": .string("1,7"), "it": .array([.object(["t": .number(3600), "a1": .number(1)])])]),
            .object(["re": .number(4), "it": .array([.object(["t": .number(7200), "a1": .number(2)])])]),
        ])]))
        XCTAssertEqual(FeedPlan.todaysMeals([target], zone: zone, now: now).map(\.minute), [120])
    }

    // MARK: Household day

    func testHouseholdDayCountsVisitsPerPetInTheDevicesDay() {
        let day = HouseholdDay(devices: [Fixtures.litterBox, Fixtures.feeder, Fixtures.fountain],
                               accessories: [Fixtures.spray], sessions: Fixtures.sessions, pets: Fixtures.pets, now: now)
        XCTAssertEqual(day.homeZone?.identifier, "Asia/Saigon")
        XCTAssertEqual(day.petDays[1]?.visits, 3)
        XCTAssertEqual(day.petDays[1]?.summary, "3 visits · last 13:58")
        XCTAssertEqual(day.petDays[2]?.summary, "2 visits · last 11:05")
        XCTAssertEqual(day.lanes.map(\.title), ["Miso", "Mochi", "Meals", "Water fountain"])
        guard case .meals(let meals) = day.lanes[2].marks else { return XCTFail("meals lane") }
        XCTAssertEqual(meals.filter(\.fed).map(\.minute), [420, 720])
        XCTAssertEqual(meals.filter { !$0.fed }.map(\.minute), [1080, 1320])
        guard case .fountain(let spans) = day.lanes[3].marks else { return XCTFail("fountain lane") }
        XCTAssertEqual(spans, [.init(start: 0, end: 370, reporting: true), .init(start: 370, end: 887, reporting: false)])
    }

    func testYesterdaysSessionsAndUnknownPetsAreKeptApart() {
        var sessions = Fixtures.sessions
        sessions.append(TimelineSessionRecord(kind: "visit", deviceID: Fixtures.litterBox.id,
                                              ts: Fixtures.at(14, 0) - 86400, petID: 1))
        sessions.append(TimelineSessionRecord(kind: "visit", deviceID: Fixtures.litterBox.id, ts: Fixtures.at(9, 0), petID: 99))
        let day = HouseholdDay(devices: [Fixtures.litterBox], accessories: [], sessions: sessions, pets: Fixtures.pets, now: now)
        XCTAssertEqual(day.petDays[1]?.visits, 3)
        XCTAssertEqual(day.lanes.last?.title, "Unknown")
    }

    func testNoZoneMeansNoStrip() {
        var box = Fixtures.litterBox
        box.timezoneInfo = nil
        let day = HouseholdDay(devices: [box], accessories: [], sessions: Fixtures.sessions, pets: Fixtures.pets, now: now)
        XCTAssertNil(day.homeZone)
        XCTAssertEqual(day.petDays[1]?.visits, nil)
    }

    // MARK: Commands

    func testCommandLayoutUsesOnlyTheModelsActions() {
        let layout = CommandLayout(actions: Fixtures.litterBox.actions, family: .litter)
        XCTAssertEqual(layout.primary?.key, "cleaning_start")
        XCTAssertEqual(layout.quick.map(\.key), ["pack_waste", "level_litter", "deodorize"])
        XCTAssertEqual(layout.more.map(\.key), ["dump_litter"])
    }

    func testFourRoutineActionsNeedNoMore() {
        let actions = ["feed", "a", "b", "c", "d"].map { DeviceAction(key: $0, name: $0, destructive: false) }
        let layout = CommandLayout(actions: actions, family: .feeder)
        XCTAssertEqual(layout.primary?.key, "feed")
        XCTAssertEqual(layout.quick.map(\.key), ["a", "b", "c", "d"])
        XCTAssertTrue(layout.more.isEmpty)
    }

    func testNoActionsDrawNoButtons() {
        let layout = CommandLayout(actions: [], family: .fountain)
        XCTAssertNil(layout.primary)
        XCTAssertTrue(layout.quick.isEmpty && layout.more.isEmpty)
    }

    func testEntityGroupsKeepCapabilitiesAndAIOut() {
        var box = Fixtures.litterBox
        var capability = DeviceEntity(component: "switch", key: "capability_full_video", name: "Video", value: .number(1))
        capability.settable = true
        capability.valuePath = "capabilities.fullVideo"
        var detection = DeviceEntity(component: "switch", key: "pet_detection", name: "Pet detection", value: .number(1))
        detection.settable = true
        box.entities += [capability, detection]
        let groups = EntityGroups(box)
        XCTAssertEqual(groups.controls.map(\.key), ["sand_type"])
        XCTAssertEqual(groups.automationControls.map(\.key), ["auto_work", "cleaning_delay"])
        XCTAssertEqual(groups.aiControls.map(\.key), ["pet_detection"])
    }

    func testAutomationRowsStayUnderSettingsOutsideALitterBox() {
        var feeder = Fixtures.feeder
        var autoWork = DeviceEntity(component: "switch", key: "auto_work", name: "Auto Clean", value: .number(1))
        autoWork.settable = true
        feeder.entities.append(autoWork)
        let groups = EntityGroups(feeder)
        XCTAssertTrue(groups.automationControls.isEmpty)
        XCTAssertTrue(groups.controls.contains { $0.key == "auto_work" })
    }

    func testEntityWritesAndSteps() {
        let delay = EntityGroups(Fixtures.litterBox).automationControls[1]
        XCTAssertEqual(EntityWrite.number(6).question(delay), "Set Clean Delay to 6 min?")
        XCTAssertEqual(EntityWrite.toggle(false).wire, "OFF")
        XCTAssertEqual(EntityWrite.stepped(60, by: 1, entity: delay), 60)
        XCTAssertEqual(EntityWrite.stepped(0, by: -1, entity: delay), 0)
    }

    func testFiguresOnlyForPublishedEntities() {
        let figures = DeviceFigures.figures(Fixtures.litterBox, visitsToday: 5)
        XCTAssertEqual(figures.map(\.label), ["Bags left", "Litter level", "Visits today"])
        XCTAssertEqual(figures.map(\.value), ["14", "62", "5"])
        XCTAssertEqual(ConsumableRow.rows(Fixtures.litterBox).map(\.isLow), [true, false])
    }
}
