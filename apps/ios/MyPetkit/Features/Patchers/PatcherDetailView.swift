import PetkitCore
import SwiftUI

/// One patch on one device: the firmware warning, what changes, how to undo
/// it, the key it needs, live progress, and the one red final action.
struct PatcherDetailView: View {
    @Environment(ServerSession.self) private var session
    let model: PatchersModel
    let route: PatcherRoute
    @State private var run: PatcherRunModel?

    var body: some View {
        Group {
            if let run, let device, let state, let patcher {
                PatcherDetailScreen(model: model, run: run, device: device, state: state, patcher: patcher)
            } else {
                ScreenScroll {
                    PushedScreenHeader(title: "Patch")
                } content: {
                    Card { EmptyBlock(title: "Not available", message: "This device no longer lists the patch.") }
                }
                .toolbar(.hidden, for: .navigationBar)
            }
        }
        .onAppear {
            if run == nil {
                run = PatcherRunModel(session: session, deviceID: route.deviceID, patcherID: route.patcherID,
                                      storedPubkey: patcher?.sshPubkey)
            }
        }
    }

    private var row: PatchersModel.Row? { model.rows.value?.first { $0.id == route.deviceID } }
    private var device: PatchableDevice? { row?.device }
    private var state: DevicePatchers? { row?.patchers.value }
    private var patcher: PatcherEntry? { state?.patchers.first { $0.id.rawValue == route.patcherID } }
}

struct PatcherDetailScreen: View {
    let model: PatchersModel
    @Bindable var run: PatcherRunModel
    let device: PatchableDevice
    let state: DevicePatchers
    let patcher: PatcherEntry

    private var action: PatcherAction {
        run.actionOverride ?? PatcherRules.primaryAction(applied: patcher.applied, greyed: patcher.greyed)
    }
    private var needsKey: Bool { action == .apply && patcher.needsPubkey == true }
    private var blocker: String? {
        action == .apply ? PatcherRules.applyBlocker(greyed: patcher.greyed, deviceIP: state.deviceIP) : nil
    }

    var body: some View {
        ScreenScroll {
            PushedScreenHeader(title: patcher.name, lede: PatcherRules.firstParagraph(patcher.description)) {
                StepUpPill()
            }
        } content: {
            deviceCard
            WarningPanel(text: "Runs commands on the box as root. A mistake can stop it booting, and it is outside the warranty.")
            explanation
            PatcherKeyCard(run: run, needsKey: needsKey, deviceIP: state.deviceIP, blocker: blocker)
            if !run.lines.isEmpty || run.accepted { progress }
            finalAction
        }
        .toolbar(.hidden, for: .navigationBar)
        .privacyShielded()
        .onChange(of: run.lines.last?.id) {
            guard let last = run.lines.last, PatcherRules.isFinalLine(last.summary) else { return }
            Task {
                // The device answers the status read only once the run has settled.
                try? await Task.sleep(for: .seconds(2))
                run.actionOverride = nil
                await model.reload(deviceID: device.id)
            }
        }
    }

    private var deviceCard: some View {
        Card {
            HStack(spacing: 12) {
                DeviceDrawing(kind: DeviceKind(deviceType: device.type), height: 36).frame(width: 44)
                VStack(alignment: .leading, spacing: 2) {
                    Text(device.name).font(Theme.Font.bodyMedium).foregroundStyle(Theme.Color.text)
                    Text(device.detailLine).font(Theme.Font.mono).foregroundStyle(Theme.Color.muted).lineLimit(1)
                }
                Spacer(minLength: 8)
                let status = PatcherRules.status(applied: patcher.applied, greyed: patcher.greyed,
                                                 unavailable: patcher.unavailable)
                Text(status.text).font(Theme.Font.small).foregroundStyle(PatcherStatusColor.color(status.tone))
            }
        }
    }

    private var explanation: some View {
        Card {
            block("What changes", PatcherRules.detailParagraphs(patcher.description))
            block("How to undo", PatcherRules.undoText(for: action))
            if action == .apply {
                HStack(alignment: .firstTextBaseline) {
                    Text("Space on the box").font(Theme.Font.section).accessibilityAddTraits(.isHeader)
                    Spacer()
                    Text("Needs about \(ByteSize.format(patcher.needsBytes)) free")
                        .font(Theme.Font.small).monospacedDigit().foregroundStyle(Theme.Color.text)
                }
                Text("Free space is measured on the box before anything is written; nothing is changed if it is short.")
                    .font(Theme.Font.small).foregroundStyle(Theme.Color.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func block(_ title: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(Theme.Font.section).accessibilityAddTraits(.isHeader)
            Text(text).font(Theme.Font.body).foregroundStyle(Theme.Color.lede)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var progress: some View {
        Card {
            Text("Progress").font(Theme.Font.section).accessibilityAddTraits(.isHeader)
            if run.lines.isEmpty {
                Text("Accepted. Progress arrives from the server; a run takes minutes.")
                    .font(Theme.Font.small).foregroundStyle(Theme.Color.muted)
            }
            ForEach(run.lines) { line in
                Text(line.summary).font(Theme.Font.mono)
                    .foregroundStyle(PatcherRules.isFailure(line.summary) ? Theme.Color.negative : Theme.Color.text)
                    .fixedSize(horizontal: false, vertical: true)
                    .textSelection(.enabled)
            }
        }
    }

    private var finalAction: some View {
        VStack(spacing: 10) {
            if let error = run.error {
                Text(error).font(Theme.Font.small).foregroundStyle(Theme.Color.negative)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            Button {
                Task { await run.start(action, needsKey: needsKey, deviceName: device.name, patcherName: patcher.name) }
            } label: {
                if run.busy {
                    ProgressView().tint(Theme.Color.onNegative)
                } else {
                    Label(action == .apply ? "Apply patch" : "Remove patch", systemImage: "lock")
                }
            }
            .buttonStyle(.finalDestructive)
            .disabled(run.busy || blocker != nil)
            Text("Asks for your password, then shows progress here step by step.")
                .font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
            Button(action == .apply ? "Remove instead" : "Apply again") {
                run.actionOverride = action == .apply ? .remove : .apply
                run.error = nil
            }
            .font(Theme.Font.control)
            .foregroundStyle(Theme.Color.text)
            .frame(minHeight: Theme.Space.control)
        }
        .padding(.top, 8)
    }
}
