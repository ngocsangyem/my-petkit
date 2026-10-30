import PetkitCore
import SwiftUI

/// The live view's talk pill (`ios-live`): press and hold to talk, release to
/// stop. VoiceOver cannot hold, so its activation toggles instead.
struct HoldToTalkButton: View {
    let state: TalkModel.State
    let press: () -> Void
    let release: () -> Void

    /// Resets on its own when the system cancels the touch (an alert,
    /// Control Center, a call), where `onEnded` would never run.
    @GestureState private var pressing = false

    var body: some View {
        let active = state == .connecting || state == .talking || state == .stopping
        Label(title, systemImage: active ? "mic.fill" : "mic")
            .font(Theme.Font.section)
            .foregroundStyle(active ? Theme.Color.liveText : Theme.Color.liveGround)
            .frame(maxWidth: .infinity, minHeight: 64)
            .background(active ? Theme.Color.liveControl : Theme.Color.liveText, in: Capsule())
            .contentShape(Capsule())
            .gesture(DragGesture(minimumDistance: 0).updating($pressing) { _, pressing, _ in pressing = true })
            .onChange(of: pressing) { _, down in down ? press() : release() }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(active ? "Stop talking" : "Hold to talk")
            .accessibilityAddTraits(.isButton)
            .accessibilityAction { active ? release() : press() }
    }

    private var title: String {
        switch state {
        case .connecting: "Connecting…"
        case .talking: "Talking. Release to stop"
        case .stopping: "Finishing…"
        case .idle, .failed: "Hold to talk"
        }
    }
}
