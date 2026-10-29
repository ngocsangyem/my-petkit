import PetkitCore
import SwiftUI

/// The v3 card: white, radius 20, no border and no shadow.
struct Card<Content: View>: View {
    var padding: CGFloat = Theme.Space.pad
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Space.gap) { content }
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
    }
}

/// An inset panel on `raised` inside a card.
struct Panel<Content: View>: View {
    var padding: CGFloat = 14
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) { content }
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.raised, in: RoundedRectangle(cornerRadius: Theme.Radius.panel))
    }
}

/// A section title between cards, with an optional trailing link or count.
struct SectionHeader<Trailing: View>: View {
    let title: String
    @ViewBuilder var trailing: Trailing

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title).font(Theme.Font.section).foregroundStyle(Theme.Color.text)
            Spacer()
            trailing.font(Theme.Font.control)
        }
        .padding(.horizontal, 4)
        .padding(.top, 8)
    }
}

extension SectionHeader where Trailing == EmptyView {
    init(_ title: String) {
        self.init(title: title) { EmptyView() }
    }
}
