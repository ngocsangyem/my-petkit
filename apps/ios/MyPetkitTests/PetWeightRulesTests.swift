import PetkitAPI
import XCTest
@testable import MyPetkit

final class PetWeightRulesTests: XCTestCase {
    private let zone = TimeZone(secondsFromGMT: 25_200) ?? .gmt
    private var miso: PetRecord {
        PetRecord(id: 1, name: "Miso", deviceIDs: [10], aliasIDs: [], weight: nil, faces: [], weightG: 5430)
    }

    func testKilogramsAndGrams() {
        XCTAssertEqual(PetWeightRules.kilogramText(5430), "5.43")
        XCTAssertEqual(PetWeightRules.kilogramText(5400), "5.40")
        XCTAssertEqual(PetWeightRules.kilogramText(nil), "")
        XCTAssertEqual(PetWeightRules.grams(fromKilograms: "5.43"), 5430)
        XCTAssertEqual(PetWeightRules.grams(fromKilograms: " 5,43 "), 5430)
        XCTAssertEqual(PetWeightRules.grams(fromKilograms: "5.4 kg"), 5400)
        XCTAssertEqual(PetWeightRules.grams(fromKilograms: "3.8649"), 3865)
        XCTAssertNil(PetWeightRules.grams(fromKilograms: ""))
        XCTAssertNil(PetWeightRules.grams(fromKilograms: "heavy"))
        XCTAssertNil(PetWeightRules.grams(fromKilograms: "-1"))
    }

    func testMatchSentencePrintsTwiceTheTolerance() {
        XCTAssertEqual(PetWeightRules.matchSentence(toleranceG: 300), "Only when no other cat is within 600 g.")
        XCTAssertEqual(PetWeightRules.matchSentence(toleranceG: 150), "Only when no other cat is within 300 g.")
        XCTAssertEqual(PetWeightRules.toleranceText(300), "± 300 g")
        XCTAssertEqual(PetWeightRules.tolerance(of: miso), 300)
    }

    func testUpdatedLine() {
        let ts = PetsModel.fixtureWeightUpdatedAt
        let sameDay = Date(timeIntervalSince1970: ts + 3_600)
        let nextDay = Date(timeIntervalSince1970: ts + 86_400)
        XCTAssertEqual(PetWeightRules.updatedLine(ts, now: sameDay, zone: zone), "updated 13:58")
        XCTAssertEqual(PetWeightRules.updatedLine(ts, now: nextDay, zone: zone), "updated 28 Oct")
        XCTAssertNil(PetWeightRules.updatedLine(nil, now: sameDay, zone: zone))
    }

    func testCatsOnDevice() {
        let mochi = PetRecord(id: 2, name: "Mochi", deviceIDs: [10], aliasIDs: [], weight: nil, faces: [])
        XCTAssertEqual(PetWeightRules.catsOnDevice(10, pets: [miso, mochi], editing: 1, isOn: true), 2)
        XCTAssertEqual(PetWeightRules.catsOnDevice(10, pets: [miso, mochi], editing: 1, isOn: false), 1)
        XCTAssertEqual(PetWeightRules.capacityLine(2), "2 of 15 cats on this box")
    }

    // MARK: Draft

    func testUnchangedDraftSendsNothing() throws {
        let pet = miso
        XCTAssertTrue(try PetEditDraft(pet: pet).changes(from: pet).isEmpty)
    }

    func testOnlyChangedFieldsAreSent() throws {
        let pet = miso
        var draft = PetEditDraft(pet: pet)
        draft.weightText = "5,2"
        draft.toleranceG = 250
        draft.matchesByWeight = false
        draft.deviceIDs = [10, 12]
        XCTAssertEqual(try draft.changes(from: pet), PetUpdate(name: nil, weightG: 5200, toleranceG: 250,
                                                               matchesByWeight: false, deviceIDs: [10, 12]))
        XCTAssertEqual(draft.addedDeviceIDs(from: pet), [12])
    }

    func testDraftValidation() {
        let pet = miso
        var draft = PetEditDraft(pet: pet)
        draft.weightText = "54.3"
        XCTAssertThrowsError(try draft.changes(from: pet)) { XCTAssertEqual($0 as? PetEditError, .weightOutOfRange) }
        draft.weightText = ""
        XCTAssertThrowsError(try draft.changes(from: pet)) { XCTAssertEqual($0 as? PetEditError, .weightOutOfRange) }
        draft = PetEditDraft(pet: pet)
        draft.name = "  "
        XCTAssertThrowsError(try draft.changes(from: pet)) { XCTAssertEqual($0 as? PetEditError, .missingName) }
    }

    func testAPetWithoutWeightMayStayWithout() throws {
        let pet = PetRecord(id: 3, name: "Tofu", deviceIDs: [], aliasIDs: [], weight: nil, faces: [])
        XCTAssertTrue(try PetEditDraft(pet: pet).changes(from: pet).isEmpty)
    }

    func testFullBoxIsNamed() {
        let box = PetDevice(id: 10, name: "Litter box", deviceType: "t6", supportsAI: true)
        let full = APIError(status: 409, code: "too_many_pets",
                            message: "A box recognises up to 15 pets; device 10 already has 15.")
        XCTAssertEqual(PetWeightRules.saveErrorMessage(full, addedDevices: [box]),
                       "A box recognises up to 15 cats, and Litter box already has that many. "
                       + "Turn it off for another cat first.")
        XCTAssertEqual(PetWeightRules.saveErrorMessage(full, addedDevices: []), full.message)
        let other = APIError(status: 400, code: "invalid_body", message: "Bad weight.")
        XCTAssertEqual(PetWeightRules.saveErrorMessage(other, addedDevices: [box]), "Bad weight.")
    }
}
