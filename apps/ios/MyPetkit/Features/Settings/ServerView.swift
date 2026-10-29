import PetkitCore
import SwiftUI

struct ServerView: View {
    var body: some View {
        ScreenScroll {
            ScreenHeader(title: "Server")
        } content: {
            EmptyView()
        }
        .toolbar(.hidden, for: .navigationBar)
    }
}
