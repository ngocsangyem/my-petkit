import PetkitCore
import SwiftUI

/// Where a row on the Server tab leads.
enum ServerRoute: Hashable {
    case log(LogsView.Segment)
    case capture
    case patchers
    case setup
}

/// The Server tab: the server card, Activity, Advanced and This phone.
struct ServerView: View {
    @Environment(ServerSession.self) private var session
    @State private var model: ServerModel?

    var body: some View {
        Group {
            if let model {
                ServerScreen(model: model)
            } else {
                Theme.Color.ground.ignoresSafeArea()
            }
        }
        .onAppear {
            if model == nil { model = ServerModel(session: session) }
        }
    }
}

struct ServerScreen: View {
    @Environment(ServerSession.self) private var session
    let model: ServerModel

    var body: some View {
        ScreenScroll {
            ScreenHeader(title: "Server")
        } content: {
            ServerCard(model: model)
            SectionHeader("Activity").accessibilityAddTraits(.isHeader)
            activity
            SectionHeader("Advanced").accessibilityAddTraits(.isHeader)
            advanced
            ThisPhoneSection(model: model)
        }
        .refreshable { await model.load() }
        .task { await model.loadIfNeeded() }
        .toolbar(.hidden, for: .navigationBar)
        .navigationDestination(for: ServerRoute.self) { route in
            switch route {
            case .log(let segment): LogsView(segment: segment)
            case .capture: CaptureView()
            case .patchers: PatchersView()
            case .setup: ServerSetupView()
            }
        }
    }

    private var activity: some View {
        RowsCard {
            NavigationLink(value: ServerRoute.log(.server)) {
                ServerNavRow(systemImage: "text.alignleft", title: "Log",
                             value: session.connection == .live ? "Live" : "Reconnecting",
                             valueColor: session.connection == .live ? Theme.Color.positive : Theme.Color.muted)
            }
            RowRule()
            NavigationLink(value: ServerRoute.log(.device)) {
                ServerNavRow(systemImage: "doc", title: "Device logs")
            }
        }
        .buttonStyle(.plain)
    }

    private var advanced: some View {
        let facts = model.facts.value
        return RowsCard {
            NavigationLink(value: ServerRoute.capture) {
                ServerNavRow(systemImage: "doc.text.magnifyingglass", title: "Capture",
                             value: facts.map { $0.capture ? "On" : "Off" }, needsStepUp: true)
            }
            RowRule()
            NavigationLink(value: ServerRoute.patchers) {
                ServerNavRow(systemImage: "wrench.adjustable", title: "Device patches",
                             value: model.patchesApplied.map { "\($0) applied" }, needsStepUp: true)
            }
            RowRule()
            NavigationLink(value: ServerRoute.setup) {
                ServerNavRow(systemImage: "cloud", title: "Cloud guards",
                             footnote: "Block firmware, shell commands and log upload from PetKit.",
                             value: facts.map { guardsText($0.guardsOn) })
            }
            RowRule()
            NavigationLink(value: ServerRoute.setup) {
                ServerNavRow(systemImage: "shield", title: "Keep events and videos",
                             value: facts.flatMap(keepText))
            }
        }
        .buttonStyle(.plain)
    }

    private func guardsText(_ on: Int) -> String {
        switch on {
        case 3: "All on"
        case 0: "All off"
        default: "\(on) of 3 on"
        }
    }

    private func keepText(_ facts: ServerModel.Facts) -> String? {
        guard let events = facts.eventDays, let videos = facts.videoDays else { return nil }
        return "\(Int(events)) / \(Int(videos)) days"
    }
}

#if DEBUG
#Preview("Server") {
    NavigationStack {
        ServerScreen(model: .preview())
    }
    .environment(ServerPreviewFixtures.session)
    .environment(AppModel())
}
#endif
