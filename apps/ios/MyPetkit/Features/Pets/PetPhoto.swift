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
        RemoteImage(path: photoPath.map(MediaPath.absolute)) {
            initial
        }
        .accessibilityLabel(name)
    }

    private var initial: some View {
        let tint = PetTint.colors(for: tintIndex)
        return Rectangle().fill(tint.background)
            .overlay {
                Text(PetTint.initial(of: name))
                    .font(Theme.Font.section)
                    .foregroundStyle(tint.ink)
            }
    }
}

/// The identity tint and initial a pet shows without a photo.
enum PetTint {
    static func colors(for index: Int) -> (background: Color, ink: Color) {
        let tints = Theme.Color.catTints
        guard !tints.isEmpty else { return (Theme.Color.raised, Theme.Color.text) }
        let tint = tints[((index % tints.count) + tints.count) % tints.count]
        return (tint.0, tint.1)
    }

    static func initial(of name: String) -> String {
        name.trimmingCharacters(in: .whitespacesAndNewlines).first.map { String($0).uppercased() } ?? "?"
    }
}

#Preview {
    PetsPreview.wrap {
        HStack(spacing: 12) {
            PetPhoto(name: "Miso", photoPath: nil, tintIndex: 0)
                .frame(width: 120, height: 120)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.hero))
            PetPhoto(name: "Mochi", photoPath: nil, tintIndex: 1)
                .frame(width: 36, height: 36)
                .clipShape(Circle())
        }
        .padding()
    }
}
