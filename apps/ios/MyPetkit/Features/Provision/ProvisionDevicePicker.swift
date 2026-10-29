import PetkitBLE
import PetkitCore
import SwiftUI

/// The devices heard advertising as "Petkit…". Bluetooth-only accessories are
/// listed but marked, since choosing one can only end in a refusal.
struct ProvisionDevicePicker: View {
    @Environment(\.dismiss) private var dismiss
    let scanner: PetkitScanner
    let choose: (DiscoveredDevice) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Space.gap) {
                HStack {
                    IconButton(systemImage: "xmark", label: "Close") { dismiss() }
                    Spacer()
                    if scanner.isScanning { ProgressView().tint(Theme.Color.muted) }
                }
                .frame(minHeight: Theme.Space.control)
                Text("Choose the device").font(Theme.Font.title).foregroundStyle(Theme.Color.text)
                    .accessibilityAddTraits(.isHeader)
                Text("Hold its pairing button until it beeps. It shows up here while it is in pairing mode.")
                    .font(Theme.Font.body).foregroundStyle(Theme.Color.lede)
                    .fixedSize(horizontal: false, vertical: true)
                content
            }
            .padding(.horizontal, Theme.Space.screenEdge)
            .padding(.bottom, Theme.Space.pad)
        }
        .background(Theme.Color.ground.ignoresSafeArea())
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(Theme.Radius.sheetTop)
        .onAppear { scanner.start() }
        .onDisappear { scanner.stop() }
    }

    @ViewBuilder
    private var content: some View {
        if let problem = radioProblem {
            WarningPanel(text: problem)
        } else if scanner.devices.isEmpty {
            Card {
                EmptyBlock(title: "Looking for devices…",
                           message: "Keep the phone within a few metres of the device.") { EmptyView() }
            }
        } else {
            RowsCard {
                ForEach(Array(scanner.devices.enumerated()), id: \.element.id) { index, device in
                    if index > 0 { RowRule() }
                    Button {
                        choose(device)
                        dismiss()
                    } label: {
                        row(device)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func row(_ device: DiscoveredDevice) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "dot.radiowaves.left.and.right").font(Theme.Font.icon)
                .foregroundStyle(Theme.Color.muted).accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(device.name).font(Theme.Font.body).foregroundStyle(Theme.Color.text)
                if device.isAccessory {
                    Text("Bluetooth-only accessory: no Wi-Fi to set up")
                        .font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
                }
            }
            Spacer(minLength: 8)
            Text("\(device.rssi) dBm").font(Theme.Font.small).monospacedDigit().foregroundStyle(Theme.Color.muted)
            Image(systemName: "chevron.right").font(Theme.Font.chevron)
                .foregroundStyle(Theme.Color.muted).accessibilityHidden(true)
        }
        .frame(minHeight: Theme.Space.rowHeight)
        .contentShape(Rectangle())
    }

    private var radioProblem: String? {
        switch scanner.radio {
        case .off: "Bluetooth is off. Turn it on in Control Center to find the device."
        case .unauthorized: "My Petkit may not use Bluetooth. Allow it in Settings › Privacy & Security › Bluetooth."
        case .unsupported: "This device has no Bluetooth Low Energy."
        case .on, .unknown: nil
        }
    }
}

#Preview {
    ProvisionDevicePicker(scanner: PetkitScanner()) { _ in }
}
