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

    init(deviceType: String) {
        self = .unknown
    }
}

/// The line drawing of a device on a `raised` panel, showing real state:
/// `level` is litter, food or water (0...1), `secondLevel` the second hopper.
struct DeviceDrawing: View {
    let kind: DeviceKind
    var level: Double?
    var secondLevel: Double?
    var height: CGFloat = 80

    var body: some View {
        Image(systemName: "shippingbox").frame(height: height)
    }
}
