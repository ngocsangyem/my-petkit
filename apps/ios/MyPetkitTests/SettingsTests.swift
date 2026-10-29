import PetkitCore
import XCTest
@testable import MyPetkit

final class SettingsTests: XCTestCase {
    // MARK: Byte sizes

    func testByteSizeUsesBytesBelowOneKilobyte() {
        XCTAssertEqual(ByteSize.format(0), "0 B")
        XCTAssertEqual(ByteSize.format(1023), "1023 B")
        XCTAssertEqual(ByteSize.format(-5), "0 B")
    }

    func testByteSizeKeepsOneDecimalBelowTenUnits() {
        XCTAssertEqual(ByteSize.format(1024), "1 KB")
        XCTAssertEqual(ByteSize.format(2_516_582), "2.4 MB")
        XCTAssertEqual(ByteSize.format(6_396_313), "6.1 MB")
    }

    func testByteSizeDropsTheDecimalFromTenUnits() {
        XCTAssertEqual(ByteSize.format(901_120), "880 KB")
        XCTAssertEqual(ByteSize.format(10 * 1024 * 1024), "10 MB")
        XCTAssertEqual(ByteSize.format(3 * 1024 * 1024 * 1024 + 300 * 1024 * 1024), "3.3 GB")
    }

    func testByteSizeRoundsUpAcrossTheTenBoundaryWithoutADecimal() {
        // 9.96 KB rounds to 10, which is printed without ".0".
        XCTAssertEqual(ByteSize.format(10_199), "10 KB")
    }

    func testMegabyteCapsReadAsTheirUnit() {
        XCTAssertEqual(ByteSize.format(megabytes: 1024), "1 GB")
        XCTAssertEqual(ByteSize.format(megabytes: 512), "512 MB")
        XCTAssertEqual(ByteSize.format(megabytes: 18), "18 MB")
    }

    // MARK: Pairing QR

    func testPairingQRTextIsCompactSortedJSONWithUnescapedSlashes() throws {
        let text = try PairingQRCode.text(url: "https://192.168.1.20:8443", certSHA256: "ab12", code: "K7Q2")
        XCTAssertEqual(text, #"{"cert_sha256":"ab12","code":"K7Q2","url":"https://192.168.1.20:8443"}"#)
    }

    func testPairingQRTextIsReadBackByTheScanner() throws {
        let hex = String(repeating: "3fa9c2", count: 10) + "e741"
        let text = try PairingQRCode.text(url: "https://192.168.1.20:8443", certSHA256: hex, code: "one-time")
        let payload = try PairingPayload(qrText: text)
        XCTAssertEqual(payload.url.absoluteString, "https://192.168.1.20:8443")
        XCTAssertEqual(payload.certSHA256, hex)
        XCTAssertEqual(payload.code, "one-time")
    }

    func testPairingQRTextEscapesQuotesInTheCode() throws {
        let text = try PairingQRCode.text(url: "https://h", certSHA256: "", code: #"a"b"#)
        XCTAssertEqual(try PairingPayload(qrText: text).code, #"a"b"#)
    }

    func testPairingQRImageIsGenerated() throws {
        let image = try XCTUnwrap(PairingQRCode.image(for: "hello"))
        XCTAssertGreaterThan(image.size.width, 100)
    }

    // MARK: Shared files

    func testSharedFileNamesStayInsideTheFolder() {
        XCTAssertEqual(SharedFile.safeFileName("../../etc/passwd"), "passwd")
        XCTAssertEqual(SharedFile.safeFileName("100234567/devRun.log"), "devRun.log")
        XCTAssertEqual(SharedFile.safeFileName("log 2026-10-29T14:05:02.txt"), "log_2026-10-29T14_05_02.txt")
        XCTAssertEqual(SharedFile.safeFileName(".."), "download.txt")
        XCTAssertEqual(SharedFile.safeFileName(""), "download.txt")
    }
}
