import SwiftUI

@main
struct MyPetkitApp: App {
    @State private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .task { model.start() }
        }
    }
}
