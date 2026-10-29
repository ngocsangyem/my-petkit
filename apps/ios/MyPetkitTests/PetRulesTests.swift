import XCTest
@testable import MyPetkit

final class PetRulesTests: XCTestCase {
    func testParseIDListReadsNumbersAndNumericStrings() {
        XCTAssertEqual(PetRules.parseIDList("[123, \"456\", 7.0]"), [123, 456, 7])
        XCTAssertEqual(PetRules.parseIDList(nil), [])
        XCTAssertEqual(PetRules.parseIDList("not json"), [])
        XCTAssertEqual(PetRules.parseIDList("{\"a\": 1}"), [])
        XCTAssertEqual(PetRules.parseIDList("[1.5, null]"), [])
    }

    func testWithAliasIsAdditiveAndIdempotent() {
        XCTAssertEqual(PetRules.withAlias("[5]", ref: 9), [5, 9])
        XCTAssertEqual(PetRules.withAlias("[5, 9]", ref: 9), [5, 9])
        XCTAssertEqual(PetRules.withAlias(nil, ref: 9), [9])
    }

    func testFaceIDStringsFromReadback() {
        XCTAssertEqual(PetRules.faceIDStrings([1, 2.0, "3"] as [Any?]), ["1", "2", "3"])
        XCTAssertNil(PetRules.faceIDStrings(nil))
        XCTAssertNil(PetRules.faceIDStrings("1,2"))
    }

    func testDeviceFaceLine() {
        let box = PetDevice(id: 1, name: "Box", deviceType: "t6", supportsAI: true, cachedFaceIDs: ["1", "3"])
        XCTAssertEqual(PetRules.deviceFaceLine(device: box, faceIDs: [1, 2, 3]), "Face photos sent · 2 of 3 loaded")
        let silent = PetDevice(id: 2, name: "Box", deviceType: "t6", supportsAI: true)
        XCTAssertEqual(PetRules.deviceFaceLine(device: silent, faceIDs: [1]), "Face photos sent · not confirmed yet")
        let feeder = PetDevice(id: 3, name: "Feeder", deviceType: "d4h", supportsAI: false)
        XCTAssertEqual(PetRules.deviceFaceLine(device: feeder, faceIDs: [1]), "No face recognition on this model")
    }

    func testRecognitionLine() {
        let faces = [PetFaceRef(id: 1, path: "/a"), PetFaceRef(id: 2, path: "/b")]
        let pet = PetRecord(id: 1, name: "Miso", deviceIDs: [10], aliasIDs: [], weight: nil, faces: faces)
        let holding = PetDevice(id: 10, name: "Box", deviceType: "t6", supportsAI: true, cachedFaceIDs: ["1", "2"])
        XCTAssertEqual(PetRules.recognitionLine(pet: pet, devices: [holding]), "on 1 device · recognised on the device")
        let waiting = PetDevice(id: 10, name: "Box", deviceType: "t6", supportsAI: true, cachedFaceIDs: ["1"])
        XCTAssertEqual(PetRules.recognitionLine(pet: pet, devices: [waiting]),
                       "on 1 device · waiting for the device to fetch")
        var bare = pet
        bare.faces = []
        bare.deviceIDs = []
        XCTAssertEqual(PetRules.recognitionLine(pet: bare, devices: []), "No device assigned · no face photos yet")
    }

    func testImportSummary() {
        XCTAssertEqual(PetRules.importSummary([]),
                       "Nothing new: PetKit lists no pets this device does not already have.")
        let results = [
            PetImportOutcome(imported: true, facesImported: 2, facesOffered: 3, boundEvents: 4),
            PetImportOutcome(imported: false, facesImported: 0, facesOffered: 0, boundEvents: 0),
        ]
        XCTAssertEqual(PetRules.importSummary(results), "Imported 1 pet, 2 of 3 photos, named 4 past events.")
        XCTAssertEqual(PetRules.importSummary([PetImportOutcome(imported: true, facesImported: 1, facesOffered: 1,
                                                                boundEvents: 0)]),
                       "Imported 1 pet, 1 of 1 photo.")
    }

    func testValidNameAndAverage() {
        XCTAssertEqual(PetRules.validName("  Miso "), "Miso")
        XCTAssertNil(PetRules.validName("   "))
        XCTAssertEqual(PetRules.averagePerDay([3, 4, 2]) ?? 0, 3, accuracy: 0.0001)
        XCTAssertNil(PetRules.averagePerDay([]))
    }
}
