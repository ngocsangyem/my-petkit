import XCTest
@testable import MyPetkit

/// Every codename the server knows draws as its family.
final class DrawingDeviceKindTests: XCTestCase {
    func testLitterBoxes() {
        for code in ["t3", "t4", "t5", "t6", "t7"] {
            XCTAssertEqual(DeviceKind(deviceType: code), .litterBox, code)
        }
    }

    func testFeedersAndTheDualHopper() {
        for code in ["feeder", "feedermini", "d3", "d4", "d4s", "d4h"] {
            XCTAssertEqual(DeviceKind(deviceType: code), .feeder, code)
        }
        XCTAssertEqual(DeviceKind(deviceType: "d4sh"), .feederDual)
    }

    func testFountains() {
        for code in ["w4", "w5", "ctw2", "ctw3", "w7h"] {
            XCTAssertEqual(DeviceKind(deviceType: code), .fountain, code)
        }
    }

    func testPuraAirIsASprayNotAPurifier() {
        XCTAssertEqual(DeviceKind(deviceType: "k2"), .spray)
        XCTAssertEqual(DeviceKind(deviceType: "k3"), .spray)
    }

    func testCaseInsensitiveAndUnknown() {
        XCTAssertEqual(DeviceKind(deviceType: "T6"), .litterBox)
        XCTAssertEqual(DeviceKind(deviceType: "D4SH"), .feederDual)
        XCTAssertEqual(DeviceKind(deviceType: "x9"), .unknown)
        XCTAssertEqual(DeviceKind(deviceType: ""), .unknown)
    }
}
