import PetkitAPI
import XCTest
@testable import MyPetkit

/// Force continue's gate and checklist, and the auto-pack rule the form sends.
final class LitterAutomationTests: XCTestCase {
    private typealias Fixtures = DevicePreviewFixtures

    // MARK: Force continue

    func testContinueIsHiddenUnlessTheServerOffersIt() {
        XCTAssertTrue(ForceContinueRules.isOffered(Fixtures.pausedOffered))
        XCTAssertFalse(ForceContinueRules.isOffered(Fixtures.pausedRefused))
        XCTAssertFalse(ForceContinueRules.isOffered(Fixtures.autoPackOn))
        XCTAssertFalse(ForceContinueRules.isOffered(.unsupported))
        XCTAssertFalse(ForceContinueRules.isOffered(nil))
        var unsupported = Fixtures.pausedOffered
        unsupported.forceContinue.supported = false
        XCTAssertFalse(ForceContinueRules.isOffered(unsupported))
    }

    func testEveryRowIsTickedWhenNothingBlocks() {
        let rows = ForceContinueRules.rows([])
        XCTAssertEqual(rows.map(\.title), ["No pet in the box", "No visit in progress", "Lid closed, no fault"])
        XCTAssertTrue(rows.allSatisfy(\.isClear))
    }

    func testRowsCarryTheBlockersSentences() {
        let rows = ForceContinueRules.rows(Fixtures.pausedRefused.forceContinue.blockers)
        XCTAssertTrue(rows[0].isClear)
        XCTAssertEqual(rows[1].refusal, "A pet entered in the last 10 minutes and has not left.")
        XCTAssertEqual(rows[2].refusal, "The device paused because its cover is open.")
    }

    func testEachReasonLandsOnItsRow() {
        let blocker = { (reason: String) in [ForceContinueBlocker(reason: reason, message: reason)] }
        XCTAssertFalse(ForceContinueRules.rows(blocker("pet_in_box"))[0].isClear)
        XCTAssertFalse(ForceContinueRules.rows(blocker("pet_entered"))[0].isClear)
        XCTAssertFalse(ForceContinueRules.rows(blocker("presence_unknown"))[0].isClear)
        XCTAssertFalse(ForceContinueRules.rows(blocker("history_unavailable"))[1].isClear)
        XCTAssertFalse(ForceContinueRules.rows(blocker("device_fault"))[2].isClear)
        XCTAssertTrue(ForceContinueRules.rows(blocker("device_offline")).allSatisfy(\.isClear))
        XCTAssertEqual(ForceContinueRules.otherRefusals(blocker("device_offline")), ["device_offline"])
        XCTAssertEqual(ForceContinueRules.otherRefusals(blocker("cover_open")), [])
    }

    func testABoxThatIsNotLiveIsRefusedWithItsSentenceFirst() {
        let blockers = [ForceContinueBlocker(reason: "not_paused", message: "Not paused."),
                        ForceContinueBlocker(reason: "state_stale", message: "Stale."),
                        ForceContinueBlocker(reason: "not_on_mqtt", message: "Not on MQTT.")]
        XCTAssertTrue(ForceContinueRules.rows(blockers).allSatisfy(\.isClear))
        XCTAssertEqual(ForceContinueRules.otherRefusals(blockers), ["Stale.", "Not on MQTT.", "Not paused."])
    }

    @MainActor
    func testRefusalsShowTheServersSentence() {
        let undelivered = DevicesAPI.refusal(status: 503, data: Data("""
        {"error": {"code": "unavailable", "message": "The command could not be sent; nothing was queued."}}
        """.utf8))
        XCTAssertEqual(ForceContinueSheet.message(for: undelivered), "The command could not be sent; nothing was queued.")
        let guarded = APIError(status: 409, code: "pet_in_box", message: "The device reports a pet inside.")
        XCTAssertEqual(ForceContinueSheet.message(for: guarded), "The device reports a pet inside.")
        let expired = APIError(status: 403, code: "step_up_required", message: "Step-up required.")
        XCTAssertTrue(ForceContinueSheet.message(for: expired).hasPrefix("Your password check has run out."))
    }

    func testViewDecodesADeviceWithoutAutoPack() throws {
        let json = """
        {"forceContinue": {"supported": true, "offered": false,
          "blockers": [{"reason": "not_paused", "message": "The device is not paused for a pet nearby."}]},
         "autoPack": {"supported": false}}
        """
        let view = try JSONDecoder().decode(LitterAutomationRecord.self, from: Data(json.utf8))
        XCTAssertEqual(view.forceContinue.blockers.first?.reason, "not_paused")
        XCTAssertFalse(view.autoPack.supported)
        XCTAssertNil(view.autoPack.rule)
    }

    // MARK: Auto-pack

    func testDraftRoundTripsTheSavedRule() {
        XCTAssertEqual(AutoPackDraft(Fixtures.autoPackRule).rule(enabled: true), Fixtures.autoPackRule)
    }

    func testFormBuildsTheFullRule() throws {
        var draft = AutoPackDraft(Fixtures.autoPackRule)
        draft.trigger = .dailyAt
        draft.atMinute = 6 * 60 + 5
        draft.quietHours = false
        let rule = draft.rule(enabled: false)
        XCTAssertEqual(rule, AutoPackRule(enabled: false, trigger: .dailyAt, cleanings: 10, at: "06:05", quietHours: nil))

        let sent = try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder().encode(rule)) as? [String: Any])
        XCTAssertEqual(Set(sent.keys), ["enabled", "trigger", "cleanings", "at", "quietHours"])
        XCTAssertTrue(sent["quietHours"] is NSNull)
        XCTAssertEqual(sent["trigger"] as? String, "daily_at")
        XCTAssertEqual(sent["at"] as? String, "06:05")
    }

    func testFormSendsQuietHoursAndClampsCleanings() throws {
        var draft = AutoPackDraft(AutoPackRule(enabled: false, trigger: .binFull, cleanings: 99, at: "nonsense",
                                               quietHours: nil))
        XCTAssertEqual(draft.cleanings, 50)
        XCTAssertEqual(draft.atMinute, AutoPackDraft.defaultAt)
        draft.quietHours = true
        draft.quietStart = 23 * 60
        draft.quietEnd = 6 * 60 + 30
        let rule = draft.rule(enabled: true)
        XCTAssertEqual(rule.quietHours, AutoPackQuietHours(start: "23:00", end: "06:30"))
        XCTAssertEqual(rule.at, "21:00")
        let sent = try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder().encode(rule)) as? [String: Any])
        XCTAssertEqual(sent["quietHours"] as? [String: String], ["start": "23:00", "end": "06:30"])
    }

    func testSummaryAndTriggerWords() {
        XCTAssertEqual(AutoPackText.summary(Fixtures.autoPackRule),
                       "After 10 cleans, only when no cat is near and bags are left. Never 22:00 – 07:00.")
        let bin = AutoPackRule(enabled: true, trigger: .binFull, cleanings: 10, at: "21:00", quietHours: nil)
        XCTAssertEqual(AutoPackText.trigger(bin), "When the bin is full")
    }

    func testStatusLineSaysWhatTheRuleLastDid() {
        let zone = Fixtures.zone, now = Fixtures.now
        XCTAssertEqual(AutoPackText.status(Fixtures.autoPackStatus, enabled: true, zone: zone, now: now),
                       "Last packed 11:21 · not due yet.")
        var status = Fixtures.autoPackStatus
        status.pendingSince = Fixtures.at(14, 40)
        XCTAssertEqual(AutoPackText.status(status, enabled: true, zone: zone, now: now),
                       "Pack sent at 14:40, waiting for the box to finish.")
        status.disabledReason = "pack_error: bag jammed"
        XCTAssertEqual(AutoPackText.status(status, enabled: false, zone: zone, now: now),
                       "Turned off by the server after a pack error: bag jammed.")
        status.disabledReason = "no_response"
        XCTAssertEqual(AutoPackText.status(status, enabled: false, zone: zone, now: now),
                       "Turned off by the server: the box did not answer two packs.")
        XCTAssertNil(AutoPackText.status(nil, enabled: true, zone: zone, now: now))

        var binFull = Fixtures.autoPackStatus
        binFull.awaitingBinClear = true
        XCTAssertEqual(AutoPackText.status(binFull, enabled: true, zone: zone, now: now),
                       "Last packed 11:21 · waiting for the bin to be emptied before it counts again.")
        binFull.awaitingBinClear = false
        binFull.heldBackBy = "not_delivered"
        XCTAssertEqual(AutoPackText.status(binFull, enabled: true, zone: zone, now: now),
                       "Last packed 11:21 · the last pack could not be sent.")
    }
}
