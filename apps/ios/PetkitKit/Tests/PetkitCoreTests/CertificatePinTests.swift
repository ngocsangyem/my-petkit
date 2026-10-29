import Foundation
import Testing
@testable import PetkitCore

struct CertificatePinTests {
    private let hex = String(repeating: "ab", count: 32)

    @Test func parsesLowerUpperAndColonSeparatedHex() throws {
        let plain = try #require(CertificatePin(hex: hex))
        let upper = try #require(CertificatePin(hex: hex.uppercased()))
        let colons = stride(from: 0, to: 64, by: 2).map { i -> String in
            let start = hex.index(hex.startIndex, offsetBy: i)
            return String(hex[start..<hex.index(start, offsetBy: 2)])
        }.joined(separator: ":")
        #expect(plain == upper)
        #expect(plain == CertificatePin(hex: colons))
        #expect(plain.hex == hex)
    }

    @Test(arguments: ["", "abc", String(repeating: "zz", count: 32), String(repeating: "ab", count: 33)])
    func rejectsMalformedHex(_ value: String) {
        #expect(CertificatePin(hex: value) == nil)
    }

    @Test func shortHexNeverShowsTheWholeFingerprint() throws {
        let pin = try #require(CertificatePin(hex: hex))
        #expect(pin.shortHex.count < pin.hex.count)
    }

    @Test func rangeHeaderCoversBoundedOpenAndInfoOnlyRequests() {
        #expect(PinnedMediaLoader.rangeHeader(offset: 0, length: 2, toEnd: false, hasDataRequest: true) == "bytes=0-1")
        #expect(PinnedMediaLoader.rangeHeader(offset: 100, length: 50, toEnd: false, hasDataRequest: true) == "bytes=100-149")
        #expect(PinnedMediaLoader.rangeHeader(offset: 100, length: 50, toEnd: true, hasDataRequest: true) == "bytes=100-")
        #expect(PinnedMediaLoader.rangeHeader(offset: 0, length: 0, toEnd: false, hasDataRequest: false) == "bytes=0-1")
    }

    @Test func totalLengthReadsContentRangeOn206() throws {
        let url = try #require(URL(string: "https://example.invalid/a.mp4"))
        let partial = try #require(HTTPURLResponse(
            url: url, statusCode: 206, httpVersion: nil,
            headerFields: ["Content-Range": "bytes 0-1/12345", "Content-Length": "2"]))
        #expect(PinnedMediaLoader.totalLength(of: partial) == 12345)
    }
}
