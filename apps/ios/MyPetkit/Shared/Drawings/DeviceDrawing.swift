import PetkitCore
import SwiftUI

/// What a device looks like in its line drawing.
enum DeviceKind: Hashable {
    case litterBox
    case feeder
    case feederDual
    case fountain
    case spray
    case purifier
    case unknown

    /// Codenames as the server knows them (`utils/const.py`, the DEVICE_TYPES_* sets).
    /// K2/K3 are in the server's "purifier" set, but they are the Pura Air spray
    /// (a Bluetooth deodoriser), so they draw as a spray. No codename the server
    /// knows is a real air purifier; `.purifier` is kept for one that appears.
    init(deviceType: String) {
        switch deviceType.lowercased() {
        case "t3", "t4", "t5", "t6", "t7": self = .litterBox
        case "d4sh": self = .feederDual
        case "feeder", "feedermini", "d3", "d4", "d4s", "d4h": self = .feeder
        case "w4", "w5", "ctw2", "ctw3", "w7h": self = .fountain
        case "k2", "k3": self = .spray
        default: self = .unknown
        }
    }
}

/// The line drawing of a device, showing real state: `level` is litter, food
/// or water (0...1), `secondLevel` the second hopper. A nil level draws the
/// container empty rather than guessing. The caller places it on its `raised`
/// panel (a device card, the detail hero) or bare in a row.
struct DeviceDrawing: View {
    let kind: DeviceKind
    var level: Double?
    var secondLevel: Double?
    var height: CGFloat = 80

    var body: some View {
        Canvas { context, size in
            let art = DrawingArt(scale: min(size.width, size.height) / 100, context: context)
            switch kind {
            case .litterBox: art.drum(level: clamp(level))
            case .feeder: art.singleFeeder(level: clamp(level))
            case .feederDual: art.dualFeeder(first: clamp(level), second: clamp(secondLevel))
            case .fountain: art.fountain(level: clamp(level))
            case .spray: art.spray()
            case .purifier: art.purifier()
            case .unknown: art.unknown()
            }
        }
        .frame(width: height, height: height)
        .accessibilityHidden(true)
    }

    private func clamp(_ value: Double?) -> Double { min(max(value ?? 0, 0), 1) }
}

#Preview("Drawings") {
    VStack(spacing: 16) {
        HStack(spacing: 12) {
            DeviceDrawing(kind: .litterBox, level: 0.62, height: 88)
            DeviceDrawing(kind: .feederDual, level: 0.7, secondLevel: 0.35, height: 88)
            DeviceDrawing(kind: .feeder, level: 0.5, height: 88)
        }
        HStack(spacing: 12) {
            DeviceDrawing(kind: .fountain, level: 0.4, height: 88)
            DeviceDrawing(kind: .spray, height: 88)
            DeviceDrawing(kind: .purifier, height: 88)
            DeviceDrawing(kind: .unknown, height: 88)
        }
    }
    .padding()
    .background(Theme.Color.raised)
}
