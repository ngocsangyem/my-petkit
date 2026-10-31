import PetkitCore
import SwiftUI

/// "This phone" (address, certificate, pairing date, pairing another phone,
/// sign out) and the list of clients signed in to this server.
struct ThisPhoneSection: View {
    @Environment(ServerSession.self) private var session
    @Environment(AppModel.self) private var app
    private let language = AppLanguageStore.shared
    let model: ServerModel
    @State private var pairing: PairingCode?
    @State private var pairingBusy = false
    @State private var pairingError: String?
    @State private var confirmSignOut = false
    @State private var revoking: ServerModel.Token?

    var body: some View {
        SectionHeader(L10n.string("This phone")).accessibilityAddTraits(.isHeader)
        RowsCard {
            valueRow(L10n.string("Address"), value: address, mono: true)
            RowRule()
            valueRow(L10n.string("Certificate"), value: certificate, mono: session.isPinned)
            RowRule()
            valueRow(L10n.string("Paired"),
                     value: session.paired.pairedAt.formatted(.dateTime.day().month(.abbreviated).year().locale(L10n.locale)))
            RowRule()
            valueRow(L10n.string("App version"), value: "\(appVersion) · GPL-3.0")
            RowRule()
            NavigationLink(value: ServerRoute.language) {
                SettingsRow(title: L10n.string("Language"), value: language.language.nativeName)
            }
            .buttonStyle(.plain)
            RowRule()
            Button { Task { await startPairing() } } label: {
                ServerNavRow(systemImage: "qrcode", title: L10n.string("Pair another phone"),
                             footnote: pairingError, needsStepUp: true)
            }
            .buttonStyle(.plain)
            .disabled(pairingBusy)
            RowRule()
            Button { confirmSignOut = true } label: {
                SettingsRow(title: L10n.string("Sign out of this server"), isDestructive: true)
            }
            .buttonStyle(.plain)
        }
        .sheet(item: $pairing) { code in
            PairPhoneSheet(code: code) { Task { await startPairing() } }
        }
        .confirmationDialog("Sign out of this server?", isPresented: $confirmSignOut, titleVisibility: .visible) {
            Button("Sign out", role: .destructive) { Task { await app.signOut() } }
        } message: {
            Text("This phone's token is revoked. Pair again from the server to come back.")
        }

        SectionHeader(L10n.string("Signed-in clients")).accessibilityAddTraits(.isHeader)
        LoadableBlock(state: model.tokens, loadingHeight: 52, retry: { Task { await model.loadTokens() } }, content: { tokens in
            tokenList(tokens)
        })
    }

    /// The code is made before the sheet opens: the step-up screen is
    /// presented by the root and cannot appear over a sheet.
    private func startPairing() async {
        pairing = nil
        pairingBusy = true
        pairingError = nil
        defer { pairingBusy = false }
        do {
            pairing = try await PairingCode.create(with: session)
        } catch {
            pairingError = Loadable<Void>.message(for: error)
        }
    }

    private func tokenList(_ tokens: [ServerModel.Token]) -> some View {
        RowsCard {
            ForEach(Array(tokens.enumerated()), id: \.element.id) { index, token in
                if index > 0 { RowRule() }
                tokenRow(token)
            }
            if let error = model.tokenError {
                Text(error).font(Theme.Font.small).foregroundStyle(Theme.Color.negative).padding(.vertical, 8)
            }
        }
        .confirmationDialog(
            L10n.string("Revoke \(revoking?.name ?? L10n.string("this client"))?"),
            isPresented: Binding(get: { revoking != nil }, set: { if !$0 { revoking = nil } }),
            titleVisibility: .visible,
            presenting: revoking
        ) { token in
            Button("Revoke", role: .destructive) { Task { await model.revoke(token) } }
        } message: { _ in
            Text("It is signed out at once and has to be paired again.")
        }
    }

    private func tokenRow(_ token: ServerModel.Token) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 8) {
                    Text(token.name).font(Theme.Font.body).foregroundStyle(Theme.Color.text).lineLimit(1)
                    if token.id == model.currentTokenID { Pill(text: L10n.string("This phone")) }
                }
                Text("Last used \(token.lastUsed.formatted(.relative(presentation: .named).locale(L10n.locale)))")
                    .font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
            }
            Spacer(minLength: 8)
            if token.id != model.currentTokenID {
                Button("Revoke") { revoking = token }
                    .font(Theme.Font.control)
                    .foregroundStyle(Theme.Color.negative)
                    .frame(minHeight: Theme.Space.control)
                    .accessibilityLabel("Revoke \(token.name)")
            }
        }
        .frame(minHeight: Theme.Space.rowHeight)
    }

    private func valueRow(_ title: String, value: String, mono: Bool = false) -> some View {
        HStack(spacing: 12) {
            Text(title).font(Theme.Font.body).foregroundStyle(Theme.Color.text)
            Spacer(minLength: 8)
            Text(value).font(mono ? Theme.Font.mono : Theme.Font.body)
                .foregroundStyle(Theme.Color.muted).lineLimit(1)
        }
        .frame(minHeight: Theme.Space.rowHeight)
        .accessibilityElement(children: .combine)
    }

    private var address: String {
        let base = session.paired.address.baseURL
        return base.port.map { "\(session.serverName):\($0)" } ?? session.serverName
    }

    /// Only the short form of the pin is ever shown.
    private var certificate: String {
        if case .pinned(let pin) = session.paired.address.trust { return pin.shortHex }
        return L10n.string("System-trusted")
    }

    private var appVersion: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "—"
    }
}
