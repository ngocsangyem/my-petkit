import PetkitCore
import SwiftUI

/// The four tabs: Home, Timeline, Pets, Server. Server holds Logs, Capture,
/// Patchers, Setup and the app's own settings.
struct MainTabView: View {
    typealias Tab = TabRouter.Tab

    @State private var router = TabRouter()

    var body: some View {
        TabView(selection: $router.tab) {
            NavigationStack { HomeView() }
                .tabItem { Label("Home", systemImage: "house") }
                .tag(Tab.home)
            NavigationStack { TimelineView() }
                .tabItem { Label("Timeline", systemImage: "list.bullet.below.rectangle") }
                .tag(Tab.timeline)
            NavigationStack { PetsView() }
                .tabItem { Label("Pets", systemImage: "pawprint") }
                .tag(Tab.pets)
            NavigationStack { ServerView() }
                .tabItem { Label("Server", systemImage: "server.rack") }
                .tag(Tab.server)
        }
        .tint(Theme.Color.text)
        .toolbarBackground(Theme.Color.surface, for: .tabBar)
        .toolbarBackground(.visible, for: .tabBar)
        .environment(router)
    }
}
