import PetkitBLE
import PetkitCore
import SwiftUI

/// The Network card: labelled Wi-Fi fields on `raised`, the server address
/// this server tells devices to use, and the time zone the device will keep.
struct ProvisionNetworkCard: View {
    @Bindable var model: ProvisionModel
    let retryServer: () -> Void

    var body: some View {
        Card {
            Text("Network").font(Theme.Font.section).foregroundStyle(Theme.Color.text)
                .accessibilityAddTraits(.isHeader)
            LabeledField(label: "Wi-Fi network") {
                HStack(spacing: 10) {
                    Image(systemName: "wifi").font(Theme.Font.icon).foregroundStyle(Theme.Color.muted)
                        .accessibilityHidden(true)
                    TextField("Network name", text: $model.ssid)
                        .textInputAutocapitalization(.never).autocorrectionDisabled()
                }
            }
            LabeledField(label: "Password") {
                SecureField("Wi-Fi password", text: $model.password).textContentType(.password)
            }
            LabeledField(label: "Server", footnote: serverFootnote) {
                TextField("http://192.168.1.20/6/", text: $model.server)
                    .font(Theme.Font.mono)
                    .keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
            }
            if case .failed = model.serverState {
                Button("Retry reading the server address", action: retryServer).buttonStyle(.secondary)
            }
            ForEach(warnings, id: \.self) { WarningPanel(text: $0) }
            RowRule()
            Picker(selection: $model.offsetHours) {
                ForEach(ProvisioningRules.offsetChoices, id: \.self) { hours in
                    Text(ProvisioningRules.offsetLabel(hours)).tag(hours)
                }
            } label: {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Time zone").font(Theme.Font.body).foregroundStyle(Theme.Color.text)
                    Text(model.zoneName).font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
                }
            }
            .pickerStyle(.navigationLink)
            .tint(Theme.Color.muted)
            Text("The server address comes from your server, not from this phone. 2.4 GHz networks only.")
                .font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .disabled(model.isRunning)
    }

    private var serverFootnote: String? {
        switch model.serverState {
        case .loading: "Reading the address from your server…"
        case .failed(let message): "Could not read this server's address (\(message)). Type it in, or retry."
        case .loaded: nil
        }
    }

    private var warnings: [String] {
        model.warnings.map {
            switch $0 {
            case .mdnsHost: "Most devices cannot resolve a .local name. Use the server's IP address."
            case .notPort80: "ESP32 devices (T4, D4) only reach a server on port 80 over plain http."
            }
        }
    }
}

#Preview {
    NavigationStack {
        ScrollView {
            ProvisionNetworkCard(model: .fixture(done: 0, status: "", server: "http://petkit.local:8080/6/")) {}
                .padding()
        }
        .background(Theme.Color.ground)
    }
}
