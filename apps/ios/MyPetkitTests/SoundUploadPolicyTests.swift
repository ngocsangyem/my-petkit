import XCTest
@testable import MyPetkit

/// The client-side copy of the server's sound limits and the settings rows.
final class SoundUploadPolicyTests: XCTestCase {
    func testLimitsMatchTheServer() {
        XCTAssertEqual(SoundUploadPolicy.maxSounds, 10)
        XCTAssertEqual(SoundUploadPolicy.maxBytes, 2_097_152)
    }

    func testRefusesInTheServersOrder() {
        // Full device first, even for a file that is also too large.
        XCTAssertEqual(SoundUploadPolicy.problem(existingCount: 10, byteCount: 5_000_000, fileName: "a.mp3"),
                       "A device holds at most 10 sounds. Delete one first.")
        XCTAssertEqual(SoundUploadPolicy.problem(existingCount: 9, byteCount: 2_097_153, fileName: "a.mp3"),
                       "a.mp3 is larger than 2 MB.")
        XCTAssertEqual(SoundUploadPolicy.problem(existingCount: 0, byteCount: 0, fileName: "a.mp3"), "a.mp3 is empty.")
    }

    func testAcceptsUpToTheLimit() {
        XCTAssertNil(SoundUploadPolicy.problem(existingCount: 9, byteCount: 2_097_152, fileName: "a.mp3"))
        XCTAssertNil(SoundUploadPolicy.problem(existingCount: 0, byteCount: 1, fileName: "a.mp3"))
    }

    func testVolumeRowComesFromTheEntity() throws {
        let entities = try decode(#"[{"key": "volume", "component": "number", "min": 0, "max": 9, "value": 6, "settable": true}]"#)
        let volume = try XCTUnwrap(SoundSettings.volume(in: entities))
        XCTAssertEqual(volume.display, "6 of 9")
        XCTAssertEqual(volume.range, 0...9)
        XCTAssertTrue(volume.isSettable)
        XCTAssertNil(SoundSettings.language(in: entities), "no row for a field the model does not have")
    }

    func testVolumeNeverReportedPrintsADash() throws {
        let entities = try decode(#"[{"key": "volume", "component": "number", "min": 0, "max": 9, "value": null, "settable": true}]"#)
        XCTAssertEqual(SoundSettings.volume(in: entities)?.display, "—")
    }

    func testLanguageMapsThroughOptionValues() throws {
        let entities = try decode(#"[{"key": "voice_language", "component": "select", "options": ["English", "Chinese"],"#
            + #""option_values": ["en_US", "zh_CN"], "value": "zh_CN", "settable": true}]"#)
        let language = try XCTUnwrap(SoundSettings.language(in: entities))
        XCTAssertEqual(language.display, "Chinese")
        let unknown = try decode(#"[{"key": "voice_language", "component": "select", "options": ["English"],"#
            + #""option_values": ["en_US"], "value": "de_DE", "settable": true}]"#)
        XCTAssertEqual(SoundSettings.language(in: unknown)?.display, "Not reported")
    }

    func testLanguageWithoutOptionValuesMapsByIndex() throws {
        let entities = try decode(#"[{"key": "voice_language", "component": "select", "options": ["English", "Chinese"],"#
            + #""option_values": null, "value": 1, "settable": false}]"#)
        let language = try XCTUnwrap(SoundSettings.language(in: entities))
        XCTAssertEqual(language.display, "Chinese")
        XCTAssertFalse(language.isSettable)
    }

    func testSizesReadAsFileSizes() {
        XCTAssertEqual(SoundUploadPolicy.formatSize(184_320), ByteCountFormatter.string(fromByteCount: 184_320, countStyle: .file))
    }

    private func decode(_ text: String) throws -> [ScheduleJSON] {
        try JSONDecoder().decode([ScheduleJSON].self, from: Data(text.utf8))
    }
}
