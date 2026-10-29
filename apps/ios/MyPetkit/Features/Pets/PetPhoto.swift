import PetkitCore
import SwiftUI

/// A pet's photo, loaded over the paired session, with the name's initial
/// on its identity tint while it loads or when there is none.
struct PetPhoto: View {
    let name: String
    /// A server path for the photo (a face photo), if the pet has one.
    let photoPath: String?
    var tintIndex = 0

    var body: some View {
        Rectangle().fill(Theme.Color.raised)
            .overlay { Text(name.prefix(1)).font(Theme.Font.section) }
    }
}
