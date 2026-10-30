import PetkitCore
import SnapshotTesting
import SwiftUI
import XCTest
@testable import MyPetkit

/// The force-continue sheet and the auto-pack block, light and dark, from the
/// preview fixtures. Compared by eye with ios-device-t6-paused and
/// ios-device-t6 in docs/design/screenshots.
@MainActor
final class LitterAutomationSnapshotTests: XCTestCase {
    func testForceContinueSheetOffered() {
        assertComponent(ForceContinueSheet(info: DevicePreviewFixtures.pausedOffered.forceContinue) {}
            .background(Theme.Color.surface), named: "force-continue-sheet", width: 390)
    }

    func testForceContinueSheetRefused() {
        assertComponent(ForceContinueSheet(info: DevicePreviewFixtures.pausedRefused.forceContinue) {}
            .background(Theme.Color.surface), named: "force-continue-sheet-refused", width: 390)
    }

    func testAutoPackSection() throws {
        let automation = DevicePreviewFixtures.autoPackOn
        let rule = try XCTUnwrap(automation.autoPack.rule)
        assertComponent(VStack(alignment: .leading, spacing: Theme.Space.gap) {
            AutoPackCard(rule: rule, status: automation.autoPack.status, zone: DevicePreviewFixtures.zone,
                         now: DevicePreviewFixtures.now, busy: false, error: nil, save: { _ in }, askEnable: { _ in })
        }, named: "auto-pack")
    }
}
