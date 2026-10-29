import PetkitCore
import SwiftUI

/// Previews render without a server: a session pointed at a name that never
/// answers, so views that load data show their own states and fixture-backed
/// models show the fixture.
@MainActor
enum PetsPreview {
    static let session: ServerSession? = {
        guard let url = URL(string: "https://my-petkit.example"),
              let address = try? ServerAddress(url: url, pin: nil) else { return nil }
        return ServerSession(paired: PairedServer(address: address, token: "preview", tokenID: 0))
    }()

    @ViewBuilder
    static func wrap<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        if let session {
            content()
                .environment(session)
                .environment(TabRouter())
        } else {
            Text("Preview session unavailable")
        }
    }
}
