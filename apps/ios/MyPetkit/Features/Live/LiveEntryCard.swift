import PetkitCore
import SwiftUI

/// The way into a camera's live view from its device detail.
struct LiveEntryCard: View {
    let device: DeviceRecord

    var body: some View {
        Card(padding: 0) {
            NavigationLink { LiveView(deviceID: device.id, title: device.name) } label: {
                SettingsRow(title: "Live", value: "Watch and talk")
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 16)
        }
    }
}
