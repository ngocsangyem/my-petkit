import PetkitCore
import SwiftUI

struct PetsView: View {
    var body: some View {
        ScreenScroll {
            ScreenHeader(title: "Pets")
        } content: {
            EmptyView()
        }
        .toolbar(.hidden, for: .navigationBar)
    }
}
