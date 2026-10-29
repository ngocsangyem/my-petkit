import PetkitCore
import SwiftUI

/// Onboarding until a server is paired, then the tabs. The step-up screen is
/// presented from here so any screen's R3 call can raise it.
struct RootView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        switch model.phase {
        case .loading:
            Theme.Color.ground.ignoresSafeArea()
        case .unpaired:
            OnboardingView(model: OnboardingModel { model.didPair($0) })
        case .paired(let session):
            PairedRoot(session: session)
                .environment(session)
                .id(session.paired)
        }
    }
}

private struct PairedRoot: View {
    @Environment(AppModel.self) private var model
    @Environment(\.scenePhase) private var scenePhase
    @Bindable var session: ServerSession

    var body: some View {
        MainTabView()
            .fullScreenCover(item: $session.stepUp) { request in
                StepUpScreen(request: request).environment(session)
            }
            .alert("This phone was signed out", isPresented: .constant(session.tokenRevoked)) {
                Button("Pair again") { model.forget() }
            } message: {
                Text("The server no longer accepts this phone's token. It may have been revoked from the dashboard.")
            }
            .task(id: scenePhase) {
                // Live updates run only in the foreground.
                guard scenePhase == .active else { return }
                await session.runLiveEvents()
            }
    }
}
