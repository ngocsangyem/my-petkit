import XCTest
@testable import MyPetkit

final class TimelineFilterTests: XCTestCase {
    private let pets = [TimelineSubject(id: 1, name: "Miso", photoPath: "/api/pets/1/faces/1/photo"),
                        TimelineSubject(id: 2, name: "  ")]
    private let devices = [TimelineSubject(id: 10, name: "Litter box", deviceType: "t6"),
                           TimelineSubject(id: 11, name: "", deviceType: "d4h")]

    func testChipsAreAllThenPetsThenDevices() {
        let chips = TimelineFilterRules.chips(pets: pets, devices: devices)
        XCTAssertEqual(chips.map(\.filter), [.all, .pet(1), .pet(2), .device(10), .device(11)])
        XCTAssertEqual(chips.map(\.title), ["All", "Miso", "Pet 2", "Litter box", "Device 11"])
        XCTAssertEqual(chips[1].photoPath, "/api/pets/1/faces/1/photo")
        XCTAssertEqual(chips[2].tintIndex, 1)
    }

    func testOnlyAllWhenNothingLoaded() {
        XCTAssertEqual(TimelineFilterRules.chips(pets: [], devices: []).map(\.filter), [.all])
    }

    func testQueryCarriesOnlyTheSelectedSubject() {
        XCTAssertEqual(TimelineFilterRules.query(for: .all), TimelineQuery())
        XCTAssertEqual(TimelineFilterRules.query(for: .pet(2)), TimelineQuery(pet: 2))
        XCTAssertEqual(TimelineFilterRules.query(for: .device(10)), TimelineQuery(device: 10))
    }

    func testRequestedDeviceFromAnotherTab() {
        XCTAssertEqual(TimelineFilterRules.requested(deviceID: "10"), .device(10))
        XCTAssertEqual(TimelineFilterRules.requested(deviceID: " 42 "), .device(42))
        XCTAssertNil(TimelineFilterRules.requested(deviceID: nil))
        XCTAssertNil(TimelineFilterRules.requested(deviceID: "litter"))
    }

    func testReconcileKeepsExistingChipAndDropsAVanishedOne() {
        let chips = TimelineFilterRules.chips(pets: pets, devices: devices)
        XCTAssertEqual(TimelineFilterRules.reconciled(.device(10), chips: chips), .device(10))
        XCTAssertEqual(TimelineFilterRules.reconciled(.pet(99), chips: chips), .all)
    }

    @MainActor
    func testModelPrefersRequestedDeviceAndNamesPickerDays() {
        let model = TimelineModel(fixture: TimelineFixtures.day, pets: TimelineFixtures.pets,
                                  devices: TimelineFixtures.devices)
        model.prefer(requestedDeviceID: "12")
        XCTAssertEqual(model.filter, .device(12))
        XCTAssertEqual(model.pickerDates.prefix(2), ["2026-10-28", "2026-10-27"])
        XCTAssertEqual(model.pickerDates.count, TimelineModel.pickerDays)
        XCTAssertEqual(model.dayTitle, "Today, 28 Oct")
    }
}
