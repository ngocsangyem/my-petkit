import PetkitCore
import SwiftUI

/// A 36pt chip; the selected one is ink-filled.
struct Chip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(Theme.Font.control)
                .lineLimit(1)
                .padding(.horizontal, 14)
                .frame(height: Theme.Space.chip)
                .foregroundStyle(isSelected ? Theme.Color.onPrimary : Theme.Color.text)
                .background(isSelected ? Theme.Color.text : Theme.Color.surface, in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

/// Pill segmented control on the `segment` track.
struct SegmentedPills<Value: Hashable>: View {
    let options: [(Value, String)]
    @Binding var selection: Value

    var body: some View {
        HStack(spacing: 0) {
            ForEach(options, id: \.0) { value, title in
                Button { selection = value } label: {
                    Text(title)
                        .font(selection == value ? Theme.Font.control.weight(.semibold) : Theme.Font.control)
                        .foregroundStyle(selection == value ? Theme.Color.text : Theme.Color.lede)
                        .frame(maxWidth: .infinity, minHeight: 32)
                        .background(selection == value ? Theme.Color.surface : .clear, in: Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selection == value ? .isSelected : [])
            }
        }
        .padding(3)
        .background(Theme.Color.segment, in: Capsule())
    }
}

/// A 50pt field on `raised` with its label above.
struct LabeledField<Field: View>: View {
    let label: String
    var footnote: String?
    @ViewBuilder var field: Field

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(Theme.Font.small).foregroundStyle(Theme.Color.muted).padding(.leading, 4)
            field
                .font(Theme.Font.body)
                .padding(.horizontal, 14)
                .frame(minHeight: Theme.Space.field)
                .background(Theme.Color.raised, in: RoundedRectangle(cornerRadius: Theme.Radius.panel))
            if let footnote {
                Text(footnote).font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted).padding(.leading, 4)
            }
        }
    }
}

/// One warning paragraph on `raised` with a single red icon.
struct WarningPanel: View {
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "exclamationmark.triangle")
                .font(Theme.Font.icon)
                .foregroundStyle(Theme.Color.negative)
                .accessibilityHidden(true)
            Text(text).font(Theme.Font.control).foregroundStyle(Theme.Color.lede)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.raised, in: RoundedRectangle(cornerRadius: Theme.Radius.hero))
    }
}

/// A grouped settings row: label, muted value at the right, optional chevron.
struct SettingsRow: View {
    let title: String
    var value: String?
    var isDestructive = false
    var showsChevron = true

    var body: some View {
        HStack(spacing: 12) {
            Text(title).font(Theme.Font.body)
                .foregroundStyle(isDestructive ? Theme.Color.negative : Theme.Color.text)
            Spacer(minLength: 8)
            if let value {
                Text(value).font(Theme.Font.body).foregroundStyle(Theme.Color.muted).lineLimit(1)
            }
            if showsChevron && !isDestructive {
                Image(systemName: "chevron.right").font(Theme.Font.chevron)
                    .foregroundStyle(Theme.Color.muted).accessibilityHidden(true)
            }
        }
        .frame(minHeight: Theme.Space.rowHeight)
        .contentShape(Rectangle())
    }
}

/// The 1pt rule between rows inside a card.
struct RowRule: View {
    var body: some View {
        Rectangle().fill(Theme.Color.rule).frame(height: 1)
    }
}
