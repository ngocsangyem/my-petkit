import XCTest
@testable import MyPetkit

final class PatcherTests: XCTestCase {
    func testPatcherIDComesFromTheSummaryPrefix() {
        XCTAssertEqual(PatcherRules.patcherID(fromSummary: "[camera] apply started"), "camera")
        XCTAssertEqual(PatcherRules.patcherID(fromSummary: "[ssh] FAILED: no key"), "ssh")
        XCTAssertNil(PatcherRules.patcherID(fromSummary: "camera apply started"))
        XCTAssertNil(PatcherRules.patcherID(fromSummary: "[] empty"))
        XCTAssertNil(PatcherRules.patcherID(fromSummary: "[a b] spaced"))
    }

    func testFinalLinesEndARun() {
        XCTAssertTrue(PatcherRules.isFinalLine("[mqtt] done - device will reboot"))
        XCTAssertTrue(PatcherRules.isFinalLine("[mqtt] FAILED: device IP unknown"))
        XCTAssertTrue(PatcherRules.isFinalLine("[cloud] removal queued"))
        XCTAssertTrue(PatcherRules.isFinalLine("[cloud] cancelled (shutting down)"))
        XCTAssertFalse(PatcherRules.isFinalLine("[cloud] apply started"))
        XCTAssertTrue(PatcherRules.isFailure("[cloud] FAILED: x"))
        XCTAssertFalse(PatcherRules.isFailure("[cloud] done"))
    }

    func testDescriptionsTurnLiteralNewlinesIntoBreaks() {
        XCTAssertEqual(PatcherRules.normaliseDescription(#"one\ntwo"#), "one\ntwo")
        XCTAssertEqual(PatcherRules.firstParagraph(#"First part.\n\nSecond part."#), "First part.")
        XCTAssertEqual(PatcherRules.firstParagraph("Only one."), "Only one.")
        XCTAssertEqual(PatcherRules.detailParagraphs(#"Lede.\n\nWhat it adds.\n\nHow."#), "What it adds.\n\nHow.")
        XCTAssertEqual(PatcherRules.detailParagraphs("Only one."), "Only one.")
    }

    func testStatusWords() {
        XCTAssertEqual(PatcherRules.status(applied: false, greyed: false, unavailable: ""),
                       PatcherStatusWord(text: "Not applied", tone: .neutral))
        XCTAssertEqual(PatcherRules.status(applied: true, greyed: false, unavailable: "").text, "Applied")
        XCTAssertEqual(PatcherRules.status(applied: false, greyed: true, unavailable: "").text,
                       "Active · MQTT connected")
        XCTAssertEqual(PatcherRules.status(applied: true, greyed: false, unavailable: "No room").tone, .warning)
    }

    func testPrimaryActionRemovesWhatIsInPlace() {
        XCTAssertEqual(PatcherRules.primaryAction(applied: false, greyed: false), .apply)
        XCTAssertEqual(PatcherRules.primaryAction(applied: true, greyed: false), .remove)
        XCTAssertEqual(PatcherRules.primaryAction(applied: false, greyed: true), .remove)
    }

    func testApplyBlockers() {
        XCTAssertNotNil(PatcherRules.applyBlocker(greyed: true, deviceIP: "192.168.1.4"))
        XCTAssertNotNil(PatcherRules.applyBlocker(greyed: false, deviceIP: ""))
        XCTAssertNil(PatcherRules.applyBlocker(greyed: false, deviceIP: "192.168.1.4"))
    }

    func testPublicKeyFormats() {
        XCTAssertTrue(PatcherRules.isValidPublicKey("ssh-ed25519 AAAAC3Nza me@laptop"))
        XCTAssertTrue(PatcherRules.isValidPublicKey("  ssh-rsa AAAAB3 me\n"))
        XCTAssertTrue(PatcherRules.isValidPublicKey("ecdsa-sha2-nistp256 AAAAE2"))
        XCTAssertFalse(PatcherRules.isValidPublicKey("-----BEGIN OPENSSH PRIVATE KEY-----"))
        XCTAssertFalse(PatcherRules.isValidPublicKey("ssh-ed25519 AAAA\nssh-rsa BBBB"))
        XCTAssertFalse(PatcherRules.isValidPublicKey(""))
    }
}
