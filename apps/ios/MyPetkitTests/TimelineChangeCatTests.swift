import PetkitAPI
import PetkitCore
import XCTest
@testable import MyPetkit

final class TimelineChangeCatTests: XCTestCase {
    private let pets = [
        TimelineSubject(id: 1, name: "Miso", weightG: 5430),
        TimelineSubject(id: 2, name: "Mochi", weightG: 3860),
        TimelineSubject(id: 3, name: "Tofu"),
        TimelineSubject(id: 4, name: "Kuro", weightG: 5100),
    ]

    private func visit(petID: Int? = nil, petName: String? = nil, source: String? = nil, passing: Bool = false,
                       weight: Double? = 5400, ref: Int? = nil, eventID: Int? = 6) -> TimelineEntry {
        TimelineEntry(kind: "visit", eventID: eventID, deviceID: 10, deviceName: "Litter box",
                      ts: TimelineFixtures.dayStart + 871 * 60, displayTs: TimelineFixtures.dayStart + 871 * 60,
                      petID: petID, petName: petName, petPhotoPath: nil, label: nil, eventKind: "toilet_visit",
                      eventType: "10", durationSec: 122, weight: weight, bits: [], steps: [], media: TimelineMedia(),
                      index: 0, petSource: source, passing: passing, unboundPetRef: ref)
    }

    private func json(_ request: TimelineVisitPetRequest) throws -> [String: Any] {
        let data = try JSONEncoder().encode(request)
        return try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? [String: Any])
    }

    // MARK: Candidates

    func testCandidatesSortByClosenessWithUnweighedPetsLast() {
        let candidates = TimelineChangeCatRules.candidates(pets: pets, visitGrams: 5400)
        XCTAssertEqual(candidates.map(\.id), [1, 4, 2, 3])
        XCTAssertEqual(candidates.map(\.isClosest), [true, false, false, false])
        // The tint follows the household order, not the sorted one.
        XCTAssertEqual(candidates.map(\.tintIndex), [0, 3, 1, 2])
    }

    func testWithoutAReadingTheServerOrderStaysAndNothingIsClosest() {
        let candidates = TimelineChangeCatRules.candidates(pets: pets, visitGrams: nil)
        XCTAssertEqual(candidates.map(\.id), [1, 2, 3, 4])
        XCTAssertFalse(candidates.contains(where: \.isClosest))
    }

    func testRegisteredLine() {
        let candidates = TimelineChangeCatRules.candidates(pets: pets, visitGrams: 5400)
        XCTAssertEqual(TimelineChangeCatRules.registeredLine(candidates[0]), "5.43 kg registered · closest weight")
        XCTAssertEqual(TimelineChangeCatRules.registeredLine(candidates[2]), "3.86 kg registered")
        XCTAssertEqual(TimelineChangeCatRules.registeredLine(candidates[3]), "No registered weight")
    }

    // MARK: Copy

    func testTitleAndContext() {
        XCTAssertEqual(TimelineChangeCatRules.title(visit(), tzOffset: 25_200), "Who used the box at 14:31?")
        XCTAssertEqual(TimelineChangeCatRules.context(visit()),
                       "The camera did not recognise the cat. The scale read 5.40 kg.")
        XCTAssertEqual(TimelineChangeCatRules.context(visit(petID: 2, petName: "Mochi", source: "weight", weight: nil)),
                       "Matched to Mochi by weight; the camera did not recognise the cat.")
        XCTAssertEqual(TimelineChangeCatRules.context(visit(petID: 1, petName: "Miso", source: "device")),
                       "The camera recognised Miso. The scale read 5.40 kg.")
        XCTAssertEqual(TimelineChangeCatRules.context(visit(source: "manual", passing: true, weight: nil)),
                       "You marked this visit as no cat.")
    }

    func testRowsSayNotRecognisedAndLightVisit() {
        XCTAssertEqual(TimelineFormat.sentence(visit()), "A cat used the litter box")
        XCTAssertEqual(TimelineFormat.metaLine(visit(), tzOffset: 25_200), "14:31 · 2 min 2 s · 5.40 kg · not recognised")
        XCTAssertEqual(TimelineFormat.sentence(visit(passing: true)), "Light visit")
        XCTAssertFalse(TimelineFormat.metaLine(visit(passing: true), tzOffset: 25_200).contains("not recognised"))
        XCTAssertTrue(visit(petID: 2, petName: "Mochi", source: "weight").isMatchedByWeight)
        XCTAssertFalse(visit(petID: 2, petName: "Mochi", source: "device").isMatchedByWeight)
    }

    // MARK: Request bodies

    func testPassingSendsAnExplicitNullPet() throws {
        let request = try XCTUnwrap(TimelineChangeCatRules.request(choice: .passing, useWeight: true, applyToRef: true,
                                                                   entry: visit(ref: 7)))
        let body = try json(request)
        XCTAssertTrue(body["pet_id"] is NSNull)
        XCTAssertEqual(body["passing"] as? Bool, true)
        XCTAssertEqual(body["use_weight"] as? Bool, false)
        XCTAssertEqual(body["apply_to_ref"] as? Bool, false)
    }

    func testPetWithWeightAndIdentity() throws {
        let request = try XCTUnwrap(TimelineChangeCatRules.request(choice: .pet(1), useWeight: true, applyToRef: true,
                                                                   entry: visit(ref: 7_301_552)))
        let body = try json(request)
        XCTAssertEqual(body["pet_id"] as? Int, 1)
        XCTAssertEqual(body["passing"] as? Bool, false)
        XCTAssertEqual(body["use_weight"] as? Bool, true)
        XCTAssertEqual(body["apply_to_ref"] as? Bool, true)
    }

    func testSwitchesThatAreNotOfferedAreNeverSent() throws {
        let entry = visit(weight: nil, ref: nil)
        XCTAssertFalse(TimelineChangeCatRules.offersWeight(.pet(1), entry: entry))
        XCTAssertFalse(TimelineChangeCatRules.offersRef(.pet(1), entry: entry))
        let request = try XCTUnwrap(TimelineChangeCatRules.request(choice: .pet(1), useWeight: true, applyToRef: true,
                                                                   entry: entry))
        XCTAssertFalse(request.useWeight)
        XCTAssertFalse(request.applyToRef)
        XCTAssertNil(TimelineChangeCatRules.request(choice: nil, useWeight: false, applyToRef: false, entry: entry))
        // A reading the server would refuse as a registered weight is not offered.
        XCTAssertFalse(TimelineChangeCatRules.offersWeight(.pet(1), entry: visit(weight: 120)))
        XCTAssertTrue(TimelineChangeCatRules.offersWeight(.pet(1), entry: visit(weight: 5400)))
    }

    func testSaveIsOfferedOnlyForAChange() {
        let recognised = visit(petID: 1, petName: "Miso", source: "device")
        func request(_ choice: TimelineCatChoice, weight: Bool = false, on entry: TimelineEntry) -> Bool {
            TimelineChangeCatRules.changesSomething(
                TimelineChangeCatRules.request(choice: choice, useWeight: weight, applyToRef: false, entry: entry),
                entry: entry)
        }
        XCTAssertFalse(request(.pet(1), on: recognised))
        XCTAssertTrue(request(.pet(1), weight: true, on: recognised))
        XCTAssertTrue(request(.pet(2), on: recognised))
        XCTAssertTrue(request(.pet(2), on: visit(petID: 2, petName: "Mochi", source: "weight")))
        XCTAssertTrue(request(.passing, on: visit(passing: true)))
        XCTAssertFalse(request(.passing, on: visit(source: "manual", passing: true)))
        XCTAssertEqual(TimelineChangeCatRules.initialChoice(recognised), .pet(1))
        XCTAssertEqual(TimelineChangeCatRules.initialChoice(visit(passing: true)), .passing)
        XCTAssertNil(TimelineChangeCatRules.initialChoice(visit()))
        XCTAssertFalse(TimelineChangeCatRules.canChange(visit(eventID: nil)))
    }

    // MARK: Decoding and the light-visits chip

    func testSessionFieldsAndPassingCountDecode() throws {
        let data = Data("""
        {"date": "2026-10-28", "tz_offset": 25200,
         "counts": {"all": 1, "toileting": 1, "passing": 2},
         "sessions": [{"kind": "visit", "id": 6, "ts": 1793172660, "pet_id": null, "pet_source": null,
                       "passing": false, "unbound_pet_ref": 7301552, "weight": 5400}]}
        """.utf8)
        let json = try JSONDecoder().decode(JSONValue.self, from: data)
        let day = try XCTUnwrap(TimelineJSON.day(json))
        XCTAssertEqual(day.passingCount, 2)
        XCTAssertEqual(day.entries.first?.unboundPetRef, 7_301_552)
        XCTAssertEqual(day.entries.first?.passing, false)
        XCTAssertNil(day.entries.first?.petSource)
    }

    func testLightVisitsChipFollowsTheCount() {
        let chips = TimelineFilterRules.chips(pets: Array(pets.prefix(2)), devices: [], passingCount: 2)
        XCTAssertEqual(chips.map(\.filter), [.all, .pet(1), .pet(2), .passing])
        XCTAssertEqual(chips.last?.title, "Light visits · 2")
        XCTAssertNil(TimelineFilterRules.passingChipCount(dayCount: 0, filter: .all))
        XCTAssertEqual(TimelineFilterRules.passingChipCount(dayCount: 0, filter: .passing), 0)
        XCTAssertEqual(TimelineFilterRules.query(for: .passing), TimelineQuery(filter: "passing"))
        XCTAssertEqual(TimelineFilterRules.reconciled(.passing, chips: []), .passing)
    }
}
