import PetkitCore
import SwiftUI

/// Where a patcher row leads.
struct PatcherRoute: Hashable {
    let deviceID: Int
    let patcherID: String
}

/// Device patches, pushed from Server: each device with the patches it can
/// take and whether they are in place. Only Linux devices can be patched.
struct PatchersView: View {
    @Environment(ServerSession.self) private var session
    @State private var model: PatchersModel?

    var body: some View {
        Group {
            if let model {
                PatchersScreen(model: model)
            } else {
                Theme.Color.ground.ignoresSafeArea()
            }
        }
        .onAppear {
            if model == nil { model = PatchersModel(session: session) }
        }
    }
}

struct PatchersScreen: View {
    let model: PatchersModel

    var body: some View {
        ScreenScroll {
            PushedScreenHeader(
                title: L10n.string("Device patches"),
                lede: L10n.string("Patches change files on the device itself. Each one says what it changes and how to undo it.")
            ) { StepUpPill() }
        } content: {
            LoadableBlock(state: model.rows, retry: { Task { await model.load() } }, content: { rows in
                if rows.isEmpty {
                    Card {
                        EmptyBlock(title: L10n.string("No devices"),
                                   message: L10n.string("Devices appear here once they talk to the server."))
                    }
                }
                ForEach(rows) { row in
                    deviceCard(row)
                }
            })
        }
        .refreshable { await model.load() }
        .task { await model.loadIfNeeded() }
        .toolbar(.hidden, for: .navigationBar)
        .privacyShielded()
        .navigationDestination(for: PatcherRoute.self) { route in
            PatcherDetailView(model: model, route: route)
        }
    }

    private func deviceCard(_ row: PatchersModel.Row) -> some View {
        Card(padding: 0) {
            HStack(spacing: 12) {
                DeviceDrawing(kind: DeviceKind(deviceType: row.device.type), height: 36)
                    .frame(width: 44)
                VStack(alignment: .leading, spacing: 2) {
                    Text(row.device.name).font(Theme.Font.bodyMedium).foregroundStyle(Theme.Color.text)
                    Text(row.device.detailLine).font(Theme.Font.mono).foregroundStyle(Theme.Color.muted).lineLimit(1)
                }
            }
            .padding(.horizontal, Theme.Space.pad)
            .padding(.top, 14)
            Group {
                switch row.patchers {
                case .loading: LoadingBars(lines: 0, height: 52)
                case .failed(let message):
                    BlockError(message: message) { Task { await model.reload(deviceID: row.id) } }
                case .loaded(let state): patcherRows(row.device, state)
                }
            }
            .padding(.horizontal, Theme.Space.pad)
            .padding(.bottom, 8)
        }
    }

    @ViewBuilder private func patcherRows(_ device: PatchableDevice, _ state: DevicePatchers) -> some View {
        if !state.supported {
            Text("Cannot be patched: only Linux devices run the patches. This one is reached by DNS alone.")
                .font(Theme.Font.small).foregroundStyle(Theme.Color.muted)
                .padding(.vertical, 10)
        } else {
            VStack(spacing: 0) {
                ForEach(Array(state.patchers.enumerated()), id: \.element.id) { index, patcher in
                    if index > 0 { RowRule() }
                    NavigationLink(value: PatcherRoute(deviceID: device.id, patcherID: patcher.id.rawValue)) {
                        patcherRow(patcher)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func patcherRow(_ patcher: PatcherEntry) -> some View {
        let status = PatcherRules.status(applied: patcher.applied, greyed: patcher.greyed,
                                         unavailable: patcher.unavailable)
        return HStack(spacing: 12) {
            Text(patcher.name).font(Theme.Font.body).foregroundStyle(Theme.Color.text)
            Spacer(minLength: 8)
            Text(status.text).font(Theme.Font.small).foregroundStyle(PatcherStatusColor.color(status.tone))
                .lineLimit(1)
            Image(systemName: "chevron.right").font(Theme.Font.chevron).foregroundStyle(Theme.Color.muted)
                .accessibilityHidden(true)
        }
        .frame(minHeight: Theme.Space.rowHeight)
        .contentShape(Rectangle())
    }
}

enum PatcherStatusColor {
    static func color(_ tone: PatcherStatusWord.Tone) -> Color {
        switch tone {
        case .positive: Theme.Color.positive
        case .warning: Theme.Color.warning
        case .neutral: Theme.Color.muted
        }
    }
}

#if DEBUG
#Preview("Device patches") {
    NavigationStack { PatchersScreen(model: .preview()) }
        .environment(ServerPreviewFixtures.session)
}
#endif
