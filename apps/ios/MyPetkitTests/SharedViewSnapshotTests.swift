import PetkitCore
import SnapshotTesting
import SwiftUI
import XCTest
@testable import MyPetkit

/// The shared components every screen is built from, light and dark.
/// Reviewed by eye against docs/design/screenshots before first recording.
@MainActor
final class SharedViewSnapshotTests: XCTestCase {
    func testStatusMarksAndPills() {
        assertComponent(VStack(alignment: .leading, spacing: 10) {
            StatusMark(status: .online(transport: "MQTT"))
            StatusMark(status: .polling)
            StatusMark(status: .offline)
            StatusMark(status: .unknown)
            HStack {
                Pill(text: "Online", tone: .positive)
                Pill(text: "Offline", tone: .negative)
                Pill(text: "Low", tone: .warning)
                Pill(text: "Unknown")
            }
        }.frame(maxWidth: .infinity, alignment: .leading), named: "status")
    }

    func testFigureGridZeroAndMissing() {
        assertComponent(Card {
            FigureGrid(figures: [
                Figure(label: "Visits today", value: "0"),
                Figure(label: "Waste bin", value: nil),
                Figure(label: "Litter", value: "62", unit: "%"),
                Figure(label: "Weight", value: "5.42", unit: "kg"),
            ])
            RatioBar(ratio: 0.35, label: "14 bags")
        }, named: "figures")
    }

    func testButtonsAndPanels() {
        assertComponent(VStack(spacing: 12) {
            Button("Clean now") {}.buttonStyle(.primary)
            Button("Pause") {}.buttonStyle(.secondary)
            Button("Apply patch") {}.buttonStyle(.finalDestructive)
            WarningPanel(text: "Applying a patch runs commands on the litter box as root.")
            BlockError(message: "Could not load today's visits. The server did not answer.") {}
            LoadingBars(height: 60)
        }, named: "controls")
    }

    func testChipsSegmentsAndFields() {
        assertComponent(VStack(alignment: .leading, spacing: 12) {
            HStack { Chip(title: "All", isSelected: true) {}; Chip(title: "Miso", isSelected: false) {} }
            SegmentedPills(options: [(0, "Server"), (1, "Device logs")], selection: .constant(0))
            LabeledField(label: "Server address", footnote: "With its port.") { Text("192.168.1.20:8443") }
            Card {
                SettingsRow(title: "Timezone", value: "Asia/Saigon")
                RowRule()
                SettingsRow(title: "Remove device", isDestructive: true)
            }
        }, named: "inputs")
    }

    func testDeviceDrawings() {
        assertComponent(HStack(spacing: 12) {
            DeviceDrawing(kind: .litterBox, level: 0.6)
            DeviceDrawing(kind: .feederDual, level: 0.8, secondLevel: 0.2)
            DeviceDrawing(kind: .fountain, level: 0.4)
            DeviceDrawing(kind: .spray)
        }, named: "drawings")
    }
}
