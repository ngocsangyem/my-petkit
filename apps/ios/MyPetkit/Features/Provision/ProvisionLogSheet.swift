import PetkitBLE
import PetkitCore
import SwiftUI

/// Trouble connecting: what usually goes wrong, then the session log with the
/// raw BLE frames in mono. The frame holding the Wi-Fi password is logged by
/// length alone, so the log is safe to share.
struct ProvisionLogSheet: View {
    @Environment(\.dismiss) private var dismiss
    let log: DiagnosticLog
    let deviceName: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Space.gap) {
                HStack {
                    IconButton(systemImage: "xmark", label: L10n.string("Close")) { dismiss() }
                    Spacer()
                    ShareLink("Share", item: Self.export(log, deviceName: deviceName))
                        .font(Theme.Font.smallMedium).tint(Theme.Color.accent)
                        .disabled(log.lines.isEmpty)
                }
                .frame(minHeight: Theme.Space.control)
                Text("Trouble connecting?").font(Theme.Font.title).foregroundStyle(Theme.Color.text)
                    .accessibilityAddTraits(.isHeader)
                Card {
                    ForEach(Self.tips, id: \.self) { tip in
                        Text("• \(tip)").font(Theme.Font.small).foregroundStyle(Theme.Color.lede)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                SectionHeader(L10n.string("Bluetooth log"))
                Card {
                    if log.lines.isEmpty {
                        Text("Nothing yet. The log fills in once you send to a device.")
                            .font(Theme.Font.small).foregroundStyle(Theme.Color.muted)
                    } else {
                        ForEach(log.lines) { line in
                            Text(line.text)
                                .font(line.isFrame ? Theme.Font.mono : Theme.Font.small)
                                .foregroundStyle(line.isFrame ? Theme.Color.muted : Theme.Color.text)
                                .textSelection(.enabled)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }
            .padding(.horizontal, Theme.Space.screenEdge)
            .padding(.bottom, Theme.Space.pad)
        }
        .background(Theme.Color.ground.ignoresSafeArea())
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(Theme.Radius.sheetTop)
    }

    static var tips: [String] {
        [
            L10n.string("Put the device in pairing mode again: most models leave it after a few minutes."),
            L10n.string("Use a 2.4 GHz network. The devices cannot see 5 GHz ones."),
            L10n.string("Keep the phone within a few metres of the device until it says it reached the server."),
            L10n.string("ESP32 models (T4, D4) need the server on port 80 over plain http."),
        ]
    }

    /// The text the share sheet sends.
    static func export(_ log: DiagnosticLog, deviceName: String?) -> String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?"
        return log.export(header: [
            "My Petkit provisioning log",
            "device: \(deviceName ?? "none chosen")",
            "app: \(version), iOS \(ProcessInfo.processInfo.operatingSystemVersionString)",
        ])
    }
}

#Preview {
    let log = DiagnosticLog()
    log.note("protocol: PetKit (0xAAA0)")
    log.frame(.sent, Data([0xFA, 0xFC, 0xFD, 0x46, 0x18, 0x00]), format: "framed 0x18")
    return ProvisionLogSheet(log: log, deviceName: "PETKIT_T6_8F2A")
}
