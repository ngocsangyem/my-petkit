import PetkitCore
import SwiftUI

/// A camera's live picture and hold-to-talk (`ios-live`), pushed from the
/// device detail. Always dark: it renders in the dark scheme whatever the
/// phone uses, so the shared tokens take their dark values.
struct LiveView: View {
    @Environment(ServerSession.self) private var session
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State private var model: LiveModel
    @State private var talk: TalkModel
    private let title: String
    private let loadsOnAppear: Bool

    init(deviceID: Int, title: String) {
        _model = State(initialValue: LiveModel(deviceID: deviceID))
        _talk = State(initialValue: TalkModel(deviceID: deviceID))
        self.title = title
        loadsOnAppear = true
    }

    /// A screen showing `model` and `talk` as they are, never calling the
    /// server (previews and snapshots).
    init(model: LiveModel, talk: TalkModel, title: String) {
        _model = State(initialValue: model)
        _talk = State(initialValue: talk)
        self.title = title
        loadsOnAppear = false
    }

    var body: some View {
        VStack(spacing: 0) {
            topBar
            LiveVideoArea(model: model, retry: restart)
                .frame(height: 300)
            controls
                .padding(.horizontal, Theme.Space.screenEdge)
                .padding(.top, Theme.Space.pad)
            Spacer(minLength: 0)
        }
        .background(Theme.Color.liveGround.ignoresSafeArea())
        // The environment makes the shared tokens resolve dark here; the
        // preference turns the status bar light while the screen is up.
        .environment(\.colorScheme, .dark)
        .preferredColorScheme(.dark)
        .toolbar(.hidden, for: .navigationBar)
        .toolbar(.hidden, for: .tabBar)
        // Only the background stops the picture: `inactive` also covers the
        // microphone permission alert, which must not end the talk it guards.
        .task(id: scenePhase == .background) {
            guard loadsOnAppear else { return }
            if scenePhase != .background {
                await model.start(ServerLiveBackend(session: session))
            } else {
                // The server drops an HLS session nobody reads for five
                // seconds, so a backgrounded screen starts over on return.
                talk.cancel()
                model.leave()
            }
        }
        .onDisappear {
            guard loadsOnAppear else { return }
            talk.cancel()
            model.leave()
        }
        .onChange(of: talk.isActive) { _, active in model.setMuted(active) }
    }

    private func select(_ mode: LiveMode) {
        model.choose(mode)
    }

    private func restart() {
        model.restart(ServerLiveBackend(session: session))
    }

    private var topBar: some View {
        HStack {
            Button { dismiss() } label: {
                Image(systemName: "chevron.left")
                    .font(Theme.Font.icon.weight(.medium))
                    .foregroundStyle(Theme.Color.liveText)
                    .frame(width: Theme.Space.control, height: Theme.Space.control)
                    .background(Theme.Color.liveControl, in: Circle())
            }
            .accessibilityLabel("Back")
            Spacer()
            Text(title).font(Theme.Font.button).foregroundStyle(Theme.Color.liveText).lineLimit(1)
                .accessibilityAddTraits(.isHeader)
            Spacer()
            // Balances the back button so the title stays centred.
            Color.clear.frame(width: Theme.Space.control, height: Theme.Space.control)
        }
        .padding(.horizontal, Theme.Space.headerEdge)
        .padding(.top, 8)
        .padding(.bottom, 8)
    }

    @ViewBuilder
    private var controls: some View {
        VStack(alignment: .leading, spacing: Theme.Space.pad) {
            if model.modes.count > 1, let mode = model.mode {
                SegmentedPills(
                    options: model.modes.map { ($0, $0.title) },
                    selection: Binding(get: { mode }, set: { select($0) }),
                    track: Theme.Color.liveControl,
                    selectedFill: Theme.Color.segment
                )
            }
            if let sentence = model.sentence {
                Text(sentence).font(Theme.Font.small).foregroundStyle(Theme.Color.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if model.talkAllowed {
                VStack(spacing: Theme.Space.gap) {
                    HoldToTalkButton(state: talk.state,
                                     press: { talk.press(session: session) },
                                     release: { talk.release() })
                    Text(talk.failure ?? "Listening mutes while you talk. The box has no echo cancelling without PetKit's cloud.")
                        .font(Theme.Font.extraSmall)
                        .foregroundStyle(talk.failure == nil ? Theme.Color.muted : Theme.Color.negative)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.top, 8)
            }
        }
    }
}

/// The dark video area: the picture, its labels, or one sentence and Retry.
private struct LiveVideoArea: View {
    let model: LiveModel
    let retry: () -> Void

    var body: some View {
        ZStack {
            Theme.Color.liveControl
            LiveVideoSurface(stream: model.stream)
            switch model.phase {
            case .loading, .connecting:
                ProgressView().tint(Theme.Color.liveText)
            case .playing:
                labels
            case .unavailable(let reason):
                message(LiveUnavailable.sentence(for: reason))
            case .failed(let text):
                message(text)
            }
        }
        .clipped()
    }

    private var labels: some View {
        VStack {
            HStack {
                Pill(text: "Live", tone: .negative)
                Spacer()
                if let mode = model.mode {
                    Text(mode.title)
                        .font(Theme.Font.pill)
                        .foregroundStyle(Theme.Color.liveText)
                        .padding(.horizontal, 9)
                        .frame(height: Theme.Space.pill)
                        .background(Theme.Color.photoLabel, in: Capsule())
                }
            }
            Spacer()
        }
        .padding(14)
    }

    private func message(_ text: String) -> some View {
        VStack(spacing: Theme.Space.gap) {
            Text(text).font(Theme.Font.body).foregroundStyle(Theme.Color.liveText)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            Button("Retry", action: retry)
                .font(Theme.Font.control.weight(.semibold))
                .foregroundStyle(Theme.Color.liveText)
                .padding(.horizontal, 18)
                .frame(height: Theme.Space.chip)
                .background(Theme.Color.segment, in: Capsule())
                .buttonStyle(.plain)
        }
        .padding(Theme.Space.headerEdge)
    }
}

#Preview("WebRTC and HLS") {
    NavigationStack {
        LiveView(model: LivePreviewFixtures.playing, talk: TalkModel(deviceID: 1), title: "Litter box")
    }
    .environment(ServerSession.preview)
}

#Preview("Unavailable") {
    NavigationStack {
        LiveView(model: LivePreviewFixtures.unavailable, talk: TalkModel(deviceID: 1), title: "Litter box")
    }
    .environment(ServerSession.preview)
}
