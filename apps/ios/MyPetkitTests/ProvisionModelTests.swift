import XCTest
@testable import MyPetkit

@MainActor
final class ProvisionModelTests: XCTestCase {
    func testSendNeedsNetworkPasswordAndServer() {
        let model = ProvisionModel.fixture(done: 0, status: "")
        XCTAssertNil(model.missing)
        model.password = ""
        XCTAssertEqual(model.missing, "Enter the Wi-Fi password: an open network cannot be provisioned this way.")
        model.password = "x"
        model.server = "  "
        XCTAssertEqual(model.missing, "Enter the server address.")
        model.ssid = ""
        XCTAssertEqual(model.missing, "Enter the Wi-Fi network name.")
    }

    func testCountsStagesAgainstAllFour() {
        XCTAssertEqual(ProvisionModel.fixture(done: 2, status: "").progressLabel, "2 of 4 done")
        XCTAssertEqual(ProvisionStage.allCases.map(\.title), [
            "Connected over Bluetooth", "Device identified", "Joining Wi-Fi…", "Waiting for it to reach the server",
        ])
    }

    func testDefaultsToThePhonesZoneInQuarterHours() throws {
        let zone = try XCTUnwrap(TimeZone(identifier: "Asia/Kathmandu"))
        let model = ProvisionModel(zone: zone)
        XCTAssertEqual(model.offsetHours, 5.75)
        XCTAssertEqual(model.zoneName, "Asia/Kathmandu")
    }

    func testWarnsAboutAServerSomeDevicesCannotReach() {
        let model = ProvisionModel.fixture(done: 0, status: "", server: "http://petkit.local:8080/6/")
        XCTAssertEqual(model.warnings, [.mdnsHost, .notPort80])
    }
}
