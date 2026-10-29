import PetkitCore
import SwiftUI

struct TimelineView: View {
    var body: some View {
        ScreenScroll {
            ScreenHeader(title: "Timeline")
        } content: {
            EmptyView()
        }
        .toolbar(.hidden, for: .navigationBar)
    }
}
