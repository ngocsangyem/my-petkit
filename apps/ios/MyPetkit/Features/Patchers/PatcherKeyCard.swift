import PetkitCore
import SwiftUI

/// The SSH key field (only for the ssh patch) and whether the server can
/// reach the box: its known address, or the reason it cannot patch yet.
struct PatcherKeyCard: View {
    @Bindable var run: PatcherRunModel
    let needsKey: Bool
    let deviceIP: String
    let blocker: String?

    var body: some View {
        Card {
            if needsKey {
                LabeledField(label: L10n.string("SSH public key"),
                             footnote: L10n.string("Root SSH on port 22 accepts this key only: ssh-ed25519, ssh-rsa or ecdsa-sha2.")) {
                    TextField("ssh-ed25519 AAAA… you@laptop", text: $run.pubkey, axis: .vertical)
                        .font(Theme.Font.mono)
                        .lineLimit(1...4)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .padding(.vertical, 12)
                }
            }
            reachability
        }
    }

    private var reachability: some View {
        let (text, color): (String, Color) = if let blocker {
            (blocker, Theme.Color.negative)
        } else {
            (L10n.string("The server knows the box at \(deviceIP) on the home network."), Theme.Color.positive)
        }
        return HStack(alignment: .firstTextBaseline, spacing: 6) {
            Circle().fill(color).frame(width: 8, height: 8).accessibilityHidden(true)
            Text(text).font(Theme.Font.small).foregroundStyle(color).fixedSize(horizontal: false, vertical: true)
        }
    }
}
