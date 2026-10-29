import PetkitCore
import SwiftUI

/// Covers an R3 screen while the app is not active, so the app switcher
/// snapshot shows the ground colour instead of keys, captures or patch output.
struct PrivacyShield: ViewModifier {
    @Environment(\.scenePhase) private var phase

    func body(content: Content) -> some View {
        content.overlay {
            if phase != .active {
                Theme.Color.ground.ignoresSafeArea()
                    .overlay { DrumMark(size: 44) }
            }
        }
    }
}

extension View {
    func privacyShielded() -> some View { modifier(PrivacyShield()) }
}
