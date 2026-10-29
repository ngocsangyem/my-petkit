import PetkitCore
import SwiftUI

/// A device's sounds (`ios-sounds`), pushed from its detail.
struct SoundsView: View {
    let deviceID: String

    var body: some View {
        Text("Sounds").font(Theme.Font.body)
    }
}
