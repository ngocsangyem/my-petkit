import PetkitCore
import SwiftUI

/// The "Bluetooth accessories" card on a parent device's detail: the
/// accessories that relay through it, with Pair and Import from cloud.
struct BleAccessoriesSection: View {
    let parentDeviceID: String

    var body: some View {
        Card { Text("Bluetooth accessories").font(Theme.Font.section) }
    }
}
