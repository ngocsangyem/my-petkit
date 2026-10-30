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

    /// Auto clean and the clean delay, then auto-pack, under one "Automation".
    func testAutoPackSection() {
        let device = DevicePreviewFixtures.litterBox
        assertComponent(VStack(alignment: .leading, spacing: Theme.Space.gap) {
            LitterAutomationSection(
                model: DeviceDetailModel(device: device, sessions: [], automation: DevicePreviewFixtures.autoPackOn),
                device: device, now: DevicePreviewFixtures.now, askEntity: { _, _ in }, confirm: { _ in })
        }.environment(ServerSession.preview), named: "auto-pack")
    }

    /// A litter box without auto-pack still gets its automation rows.
    func testAutomationWithoutAutoPack() {
        let device = DevicePreviewFixtures.litterBox
        assertComponent(VStack(alignment: .leading, spacing: Theme.Space.gap) {
            LitterAutomationSection(model: DeviceDetailModel(device: device, sessions: []), device: device,
                                    now: DevicePreviewFixtures.now, askEntity: { _, _ in }, confirm: { _ in })
        }.environment(ServerSession.preview), named: "automation-no-auto-pack")
    }
}
