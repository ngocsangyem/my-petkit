import PetkitCore
import SwiftUI

/// Pairing: scan the dashboard's QR code (`ios-pairing`), or enter the
/// address by hand, then sign in or create the first admin (`ios-first-run`).
struct OnboardingView: View {
    @State var model: OnboardingModel

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Space.gap) {
            header
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Space.gap) { content }
            }
            .scrollBounceBehavior(.basedOnSize)
            if let error = model.error {
                Text(error).font(Theme.Font.small).foregroundStyle(Theme.Color.negative)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            footer
        }
        .padding(.horizontal, Theme.Space.screenEdge)
        .padding(.bottom, 8)
        .background(Theme.Color.ground.ignoresSafeArea())
        .animation(.default, value: model.step)
    }

    @ViewBuilder private var header: some View {
        HStack {
            if model.step != .scan {
                IconButton(systemImage: "chevron.left", label: "Back") { model.back() }
            }
            HStack(spacing: 8) {
                DrumMark()
                Text(serverLine).font(Theme.Font.small).foregroundStyle(Theme.Color.muted)
            }
            Spacer()
            if case .firstRun = model.step {
                Text("Step 2 of 2").font(Theme.Font.small).foregroundStyle(Theme.Color.muted)
            }
        }
        .frame(minHeight: Theme.Space.control)
        .padding(.top, 8)
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(Theme.Font.title).accessibilityAddTraits(.isHeader)
            Text(lede).font(Theme.Font.body).foregroundStyle(Theme.Color.lede)
        }
        .padding(.horizontal, 4)
    }

    @ViewBuilder private var content: some View {
        switch model.step {
        case .scan:
            ScannerCard { model.scanned($0) }
        case .found(_, let address):
            ScannerCard { model.scanned($0) }
            ServerFoundCard(address: address)
        case .manualAddress:
            Card {
                LabeledField(label: "Server address",
                             footnote: "The https address on the dashboard, with its port, such as 192.168.1.20:8443.") {
                    TextField("192.168.1.20:8443", text: $model.addressText)
                        .font(Theme.Font.mono)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .submitLabel(.go)
                        .onSubmit { model.submitAddress() }
                }
            }
        case .confirmFingerprint(let address, _):
            ServerFoundCard(address: address, scanned: false)
        case .signIn:
            SignInCard(busy: model.busy) { model.signIn(password: $0) }
        case .firstRun:
            FirstRunCard(busy: model.busy) { model.createAdmin(setupToken: $0, password: $1) }
        }
    }

    @ViewBuilder private var footer: some View {
        switch model.step {
        case .scan:
            Button("Enter address manually") { model.step = .manualAddress }
                .buttonStyle(.secondary)
        case .found:
            busyButton("Trust this server") { model.trustScanned() }
            Button("Enter address manually") { model.step = .manualAddress }
                .font(Theme.Font.button).foregroundStyle(Theme.Color.text)
                .frame(maxWidth: .infinity, minHeight: Theme.Space.control)
        case .manualAddress:
            busyButton("Continue") { model.submitAddress() }
                .disabled(model.addressText.trimmingCharacters(in: .whitespaces).isEmpty)
        case .confirmFingerprint:
            busyButton("Trust this server") { model.trustFingerprint() }
        case .signIn, .firstRun:
            EmptyView()
        }
    }

    private func busyButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            if model.busy { ProgressView().tint(Theme.Color.onPrimary) } else { Text(title) }
        }
        .buttonStyle(.primary)
        .disabled(model.busy)
    }

    private var serverLine: String {
        switch model.step {
        case .found(_, let address), .confirmFingerprint(let address, _), .signIn(let address),
             .firstRun(let address):
            "my-petkit · \(address.host)"
        default:
            "my-petkit"
        }
    }

    private var title: String {
        switch model.step {
        case .scan, .found, .confirmFingerprint: "Is this your server?"
        case .manualAddress: "Enter the server address"
        case .signIn: "Sign in to pair"
        case .firstRun: "Set up your server"
        }
    }

    private var lede: String {
        switch model.step {
        case .scan, .found:
            "On the dashboard, open Setup › Phones and scan the code. It carries the server address and its certificate fingerprint."
        case .manualAddress:
            "Use this when you cannot scan. The next step shows the server's certificate so you can check it."
        case .confirmFingerprint:
            "The server's log prints its certificate SHA-256 at start-up. Compare every block before you trust it."
        case .signIn:
            "Enter the admin password. This phone gets its own token; the password is not stored."
        case .firstRun:
            "This server has no admin yet. The setup code is printed once in the server's log."
        }
    }
}

/// The dark scanner card, or a note when there is no camera.
private struct ScannerCard: View {
    let onCode: (String) -> Void

    var body: some View {
        ZStack(alignment: .bottom) {
            RoundedRectangle(cornerRadius: Theme.Radius.card).fill(Theme.Color.liveControl)
            if QRScannerView.isAvailable {
                QRScannerView(onCode: onCode)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.card))
                ScanFrame().stroke(Theme.Color.liveText, style: .init(lineWidth: 4, lineCap: .round))
                    .frame(width: 124, height: 124)
                    .frame(maxHeight: .infinity)
                    .accessibilityHidden(true)
            }
            Text(QRScannerView.isAvailable ? "Point the camera at the code" : "No camera available. Enter the address manually.")
                .font(Theme.Font.smallMedium)
                .foregroundStyle(Theme.Color.liveText)
                .padding(.horizontal, 10).padding(.vertical, 4)
                .background(Theme.Color.photoLabel, in: Capsule())
                .padding(.bottom, 14)
        }
        .frame(height: 220)
    }
}

/// Four corner brackets.
private struct ScanFrame: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let arm = rect.width * 0.28, r: CGFloat = 14
        for (corner, dx, dy) in [(CGPoint(x: rect.minX, y: rect.minY), 1.0, 1.0),
                                 (CGPoint(x: rect.maxX, y: rect.minY), -1.0, 1.0),
                                 (CGPoint(x: rect.minX, y: rect.maxY), 1.0, -1.0),
                                 (CGPoint(x: rect.maxX, y: rect.maxY), -1.0, -1.0)] {
            path.move(to: CGPoint(x: corner.x, y: corner.y + dy * arm))
            path.addLine(to: CGPoint(x: corner.x, y: corner.y + dy * r))
            path.addQuadCurve(to: CGPoint(x: corner.x + dx * r, y: corner.y), control: corner)
            path.addLine(to: CGPoint(x: corner.x + dx * arm, y: corner.y))
        }
        return path
    }
}

/// Address and, for a pinned server, the certificate fingerprint in blocks.
private struct ServerFoundCard: View {
    let address: ServerAddress
    var scanned = true

    var body: some View {
        Card {
            HStack {
                Text("Server found").font(Theme.Font.section)
                Spacer()
                if scanned, case .pinned = address.trust {
                    Pill(text: "Certificate in code", tone: .positive)
                }
            }
            VStack(alignment: .leading, spacing: 2) {
                Text("Address").font(Theme.Font.small).foregroundStyle(Theme.Color.muted)
                Text(address.baseURL.absoluteString).font(Theme.Font.mono).textSelection(.enabled)
            }
            switch address.trust {
            case .pinned(let pin):
                Panel {
                    Text("Certificate SHA-256").font(Theme.Font.small).foregroundStyle(Theme.Color.muted)
                    Text(pin.grouped.joined(separator: "  "))
                        .font(Theme.Font.mono)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityLabel("Fingerprint \(pin.grouped.joined(separator: " "))")
                }
                Text("Compare these blocks with the ones on the dashboard before you trust it.")
                    .font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
            case .system:
                Text("This address has a certificate your iPhone already trusts, so nothing is pinned.")
                    .font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
            }
        }
    }
}

private struct SignInCard: View {
    let busy: Bool
    let submit: (String) -> Void
    @State private var password = ""

    var body: some View {
        Card {
            LabeledField(label: "Admin password") {
                SecureField("", text: $password).textContentType(.password)
                    .submitLabel(.go).onSubmit { submit(password) }
            }
        }
        Button { submit(password) } label: {
            if busy { ProgressView().tint(Theme.Color.onPrimary) } else { Text("Pair this phone") }
        }
        .buttonStyle(.primary)
        .disabled(password.isEmpty || busy)
    }
}

/// First run. The API takes the setup token and a password; there is no
/// admin name, so the screen asks for none.
private struct FirstRunCard: View {
    let busy: Bool
    let submit: (String, String) -> Void
    @State private var setupToken = ""
    @State private var password = ""

    var body: some View {
        Card {
            LabeledField(label: "Setup code") {
                TextField("", text: $setupToken)
                    .font(Theme.Font.mono)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            }
            LabeledField(label: "Password", footnote: "At least 10 characters.") {
                SecureField("", text: $password).textContentType(.newPassword)
            }
            RatioBar(ratio: PasswordStrength.ratio(password), label: PasswordStrength.label(password),
                     tint: PasswordStrength.ratio(password) < 0.5 ? Theme.Color.warning : Theme.Color.accent)
        }
        Card {
            HStack(spacing: 12) {
                Image(systemName: "iphone").accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("This iPhone becomes the first paired client").font(Theme.Font.bodyMedium)
                    Text("Revoke it later from Server › This phone.").font(Theme.Font.extraSmall)
                        .foregroundStyle(Theme.Color.muted)
                }
            }
        }
        Button { submit(setupToken, password) } label: {
            if busy { ProgressView().tint(Theme.Color.onPrimary) } else { Text("Create admin") }
        }
        .buttonStyle(.primary)
        .disabled(setupToken.isEmpty || password.count < 10 || busy)
        Text("The code works once. Restart the server for a new one, or run `my-petkit admin set-password` on it.")
            .font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
            .multilineTextAlignment(.center).frame(maxWidth: .infinity)
    }
}

/// A rough guide only; the server's own rule (at least 10 characters) decides.
enum PasswordStrength {
    static func ratio(_ password: String) -> Double {
        guard !password.isEmpty else { return 0 }
        let classes = [password.contains(where: \.isLowercase), password.contains(where: \.isUppercase),
                       password.contains(where: \.isNumber),
                       password.contains(where: { !$0.isLetter && !$0.isNumber })].filter { $0 }.count
        return min(1, Double(password.count) / 16 * 0.7 + Double(classes) / 4 * 0.3)
    }

    static func label(_ password: String) -> String {
        switch ratio(password) {
        case 0: ""
        case ..<0.5: "Weak"
        case ..<0.8: "Fair"
        default: "Strong"
        }
    }
}
