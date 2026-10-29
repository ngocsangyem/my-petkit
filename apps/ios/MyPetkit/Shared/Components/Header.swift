import PetkitCore
import SwiftUI

/// The drum mark: a circle with a 2pt accent stroke and the lower third filled.
struct DrumMark: View {
    var size: CGFloat = 18

    var body: some View {
        ZStack {
            Circle().fill(Theme.Color.surface)
            Circle().fill(Theme.Color.accent).mask(alignment: .bottom) {
                Rectangle().frame(height: size / 3)
            }
            Circle().stroke(Theme.Color.accent, lineWidth: 2)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// The header on `ground`: mark row with the server, a 24/600 title and one
/// finding line. `finding` is the one sentence that says what needs you.
struct ScreenHeader<Actions: View>: View {
    @Environment(ServerSession.self) private var session
    let title: String
    var finding: Text?
    var lede: String?
    @ViewBuilder var actions: Actions

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                HStack(spacing: 8) {
                    DrumMark()
                    Text(serverLine).font(Theme.Font.small).foregroundStyle(Theme.Color.muted)
                }
                Spacer()
                actions
            }
            .frame(minHeight: Theme.Space.control)
            Text(title).font(Theme.Font.title).foregroundStyle(Theme.Color.text)
                .accessibilityAddTraits(.isHeader)
            if let finding { finding.font(Theme.Font.bodyMedium) }
            if let lede { Text(lede).font(Theme.Font.body).foregroundStyle(Theme.Color.lede) }
        }
        .padding(.horizontal, Theme.Space.headerEdge)
        .padding(.top, 8)
        .padding(.bottom, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var serverLine: String {
        let trust = session.isPinned ? "TLS pinned" : "TLS"
        let live = session.connection == .live ? "" : " · reconnecting"
        return "\(session.serverName) · \(trust)\(live)"
    }
}

extension ScreenHeader where Actions == EmptyView {
    init(title: String, finding: Text? = nil, lede: String? = nil) {
        self.init(title: title, finding: finding, lede: lede) { EmptyView() }
    }
}

/// The standard scrolling screen: ground behind, header, then cards.
struct ScreenScroll<Header: View, Content: View>: View {
    @ViewBuilder var header: Header
    @ViewBuilder var content: Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                header
                VStack(alignment: .leading, spacing: Theme.Space.gap) { content }
                    .padding(.horizontal, Theme.Space.screenEdge)
                    .padding(.bottom, Theme.Space.pad)
            }
        }
        .background(Theme.Color.ground.ignoresSafeArea())
    }
}
