import PetkitCore
import SwiftUI

/// Where a row on the Server tab leads.
enum ServerRoute: Hashable {
    case log(LogsView.Segment)
    case capture
    case patchers
    case setup
    case language
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
            ScreenHeader(title: L10n.string("Server"))
        } content: {
            ServerCard(model: model)
            SectionHeader(L10n.string("Activity")).accessibilityAddTraits(.isHeader)
            activity
            SectionHeader(L10n.string("Advanced")).accessibilityAddTraits(.isHeader)
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
            case .language: LanguageView()
            }
        }
    }

    private var activity: some View {
        RowsCard {
            NavigationLink(value: ServerRoute.log(.server)) {
                ServerNavRow(systemImage: "text.alignleft", title: L10n.string("Log"),
                             value: session.connection == .live ? L10n.string("Live") : L10n.string("Reconnecting"),
                             valueColor: session.connection == .live ? Theme.Color.positive : Theme.Color.muted)
            }
            RowRule()
            NavigationLink(value: ServerRoute.log(.device)) {
                ServerNavRow(systemImage: "doc", title: L10n.string("Device logs"))
            }
        }
        .buttonStyle(.plain)
    }

    private var advanced: some View {
        let facts = model.facts.value
        return RowsCard {
            NavigationLink(value: ServerRoute.capture) {
                ServerNavRow(systemImage: "doc.text.magnifyingglass", title: L10n.string("Capture"),
                             value: facts.map { $0.capture ? L10n.string("On") : L10n.string("Off") }, needsStepUp: true)
            }
            RowRule()
            NavigationLink(value: ServerRoute.patchers) {
                ServerNavRow(systemImage: "wrench.adjustable", title: L10n.string("Device patches"),
                             value: model.patchesApplied.map { L10n.string("\($0) applied") }, needsStepUp: true)
            }
            RowRule()
            NavigationLink(value: ServerRoute.setup) {
                ServerNavRow(systemImage: "cloud", title: L10n.string("Cloud guards"),
                             footnote: L10n.string("Block firmware, shell commands and log upload from PetKit."),
                             value: facts.map { guardsText($0.guardsOn) })
            }
            RowRule()
            NavigationLink(value: ServerRoute.setup) {
                ServerNavRow(systemImage: "shield", title: L10n.string("Keep events and videos"),
                             value: facts.flatMap(keepText))
            }
        }
        .buttonStyle(.plain)
    }

    private func guardsText(_ on: Int) -> String {
        switch on {
        case 3: L10n.string("All on")
        case 0: L10n.string("All off")
        default: L10n.string("\(on) of 3 on")
        }
    }

    private func keepText(_ facts: ServerModel.Facts) -> String? {
        guard let events = facts.eventDays, let videos = facts.videoDays else { return nil }
        return L10n.string("\(Int(events)) / \(Int(videos)) days")
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
