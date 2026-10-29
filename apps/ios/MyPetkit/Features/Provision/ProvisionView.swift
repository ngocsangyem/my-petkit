import PetkitBLE
import PetkitCore
import SwiftUI

/// Add a device (`ios-provision`), pushed from Home's "+" or its empty state: choose a device in pairing mode, send it
/// the Wi-Fi details, this server's address and the time zone over Bluetooth,
/// then watch for it to reach the server. One primary button; the BLE log is
/// shared from the footer.
struct ProvisionView: View {
    @Environment(ServerSession.self) private var session
    @State private var model: ProvisionModel
    @State private var picking = false
    @State private var showsLog = false
    private let live: Bool

    init() {
        _model = State(initialValue: ProvisionModel())
        live = true
    }

    /// Shows `model` as it is; never touches Bluetooth or the server (previews).
    init(model: ProvisionModel) {
        _model = State(initialValue: model)
        live = false
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                PushedScreenHeader(title: "Add a device") {
                    Text(model.progressLabel).font(Theme.Font.small).monospacedDigit().foregroundStyle(Theme.Color.muted)
                }
                VStack(alignment: .leading, spacing: Theme.Space.gap) {
                    ProvisionProgressCard(deviceName: model.device?.name, status: model.status, done: model.done,
                                          isRunning: model.isRunning, failed: failed)
                    ProvisionNetworkCard(model: model) { Task { await model.loadServer(session) } }
                    sendButton
                    footer
                }
                .padding(.horizontal, Theme.Space.screenEdge)
                .padding(.bottom, Theme.Space.pad)
            }
        }
        .background(Theme.Color.ground.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .scrollDismissesKeyboard(.interactively)
        .task {
            guard live else { return }
            await model.loadServer(session)
        }
        .onDisappear { if live { model.stop() } }
        .sheet(isPresented: $picking) {
            ProvisionDevicePicker(scanner: model.scanner) { device in
                model.choose(device)
                model.start(session)
            }
        }
        .sheet(isPresented: $showsLog) { ProvisionLogSheet(log: model.log, deviceName: model.device?.name) }
    }

    private var failed: Bool {
        if case .finished(let outcome) = model.phase { return outcome != .provisioned }
        return false
    }

    private var sendButton: some View {
        VStack(spacing: 8) {
            Button {
                // With nothing chosen yet, Send opens the chooser: one tap.
                if model.device == nil || model.phase != .idle { picking = true } else { model.start(session) }
            } label: {
                if model.isRunning { ProgressView().tint(Theme.Color.onPrimary) } else { Text("Send to device") }
            }
            .buttonStyle(.primary)
            .disabled(model.isRunning || model.missing != nil)
            if let missing = model.missing, !model.isRunning {
                Text(missing).font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
                    .multilineTextAlignment(.center).frame(maxWidth: .infinity)
            }
        }
    }

    private var footer: some View {
        HStack {
            Button("Trouble connecting?") { showsLog = true }
            Spacer()
            ShareLink("Share diagnostic log", item: ProvisionLogSheet.export(model.log, deviceName: model.device?.name))
                .disabled(model.log.lines.isEmpty)
        }
        .font(Theme.Font.smallMedium)
        .tint(Theme.Color.accent)
    }
}

#Preview("Joining Wi-Fi") {
    NavigationStack {
        ProvisionView(model: .fixture(done: 2, status: "Joining Wi-Fi… Keep the phone near the device."))
    }
    .environment(ServerPreviewFixtures.session)
}
