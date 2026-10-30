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

    /// Auto clean and the clean delay (value and chevron), then auto-pack,
    /// under one "Automation".
    func testAutoPackSection() {
        let device = DevicePreviewFixtures.litterBox
        assertComponent(VStack(alignment: .leading, spacing: Theme.Space.gap) {
            LitterAutomationSection(
                model: DeviceDetailModel(device: device, sessions: [], automation: DevicePreviewFixtures.autoPackOn),
                device: device, now: DevicePreviewFixtures.now, askEntity: { _, _ in }, confirm: { _ in },
                pickEntity: { _ in })
        }.environment(ServerSession.preview), named: "auto-pack")
    }

    /// A litter box without auto-pack still gets its automation rows; a delay
    /// the box has not reported reads "—" and can still be chosen.
    func testAutomationWithoutAutoPackAndAnUnreportedDelay() {
        var device = DevicePreviewFixtures.litterBox
        device.entities = device.entities.map { entity in
            guard entity.key == "cleaning_delay" else { return entity }
            var unknown = entity
            unknown.value = nil
            return unknown
        }
        assertComponent(VStack(alignment: .leading, spacing: Theme.Space.gap) {
            LitterAutomationSection(model: DeviceDetailModel(device: device, sessions: []), device: device,
                                    now: DevicePreviewFixtures.now, askEntity: { _, _ in }, confirm: { _ in },
                                    pickEntity: { _ in })
        }.environment(ServerSession.preview), named: "automation-no-auto-pack")
    }

    func testCleanDelayPicker() throws {
        let delay = try XCTUnwrap(DeviceFacts.entity(DevicePreviewFixtures.litterBox, "cleaning_delay"))
        // A full screen, so the UIKit wheel is drawn: the sheet at the bottom.
        assertScreen(VStack(spacing: 0) {
            Spacer(minLength: 0)
            NumberPickerSheet(entity: delay, title: "Clean delay") { _ in }
                .fixedSize(horizontal: false, vertical: true)
                .padding(.bottom, 34)
                .background(Theme.Color.surface,
                            in: UnevenRoundedRectangle(topLeadingRadius: Theme.Radius.sheetTop,
                                                       topTrailingRadius: Theme.Radius.sheetTop))
        }
        .background(Theme.Color.scrim)
        .background(Theme.Color.ground)
        .ignoresSafeArea(edges: .bottom), named: "clean-delay-picker")
    }
}
