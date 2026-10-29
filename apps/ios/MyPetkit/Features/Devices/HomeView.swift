import PetkitCore
import SwiftUI

struct HomeView: View {
    var body: some View {
        ScreenScroll {
            ScreenHeader(title: "Home")
        } content: {
            EmptyView()
        }
        .toolbar(.hidden, for: .navigationBar)
    }
}
