import PetkitCore
import SwiftUI

/// The header of a screen pushed from Server: a round back button, an
/// optional trailing mark (the step-up pill, the Live pill), the 24/600
/// title and one lede sentence. The navigation bar stays hidden, as on the
/// tab roots, so every screen keeps the same header geometry.
struct PushedScreenHeader<Trailing: View>: View {
    @Environment(\.dismiss) private var dismiss
    let title: String
    var lede: String?
    @ViewBuilder var trailing: Trailing

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                IconButton(systemImage: "chevron.left", label: "Back") { dismiss() }
                Spacer()
                trailing
            }
            .frame(minHeight: Theme.Space.control)
            Text(title).font(Theme.Font.title).foregroundStyle(Theme.Color.text)
                .accessibilityAddTraits(.isHeader)
            if let lede {
                Text(lede).font(Theme.Font.body).foregroundStyle(Theme.Color.lede)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.horizontal, Theme.Space.headerEdge)
        .padding(.top, 8)
        .padding(.bottom, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

extension PushedScreenHeader where Trailing == EmptyView {
    init(title: String, lede: String? = nil) {
        self.init(title: title, lede: lede) { EmptyView() }
    }
}

/// "Step-up required" (or the short "Step-up" on a row): this screen or row
/// asks for the password again before it changes anything.
struct StepUpPill: View {
    var short = false

    var body: some View {
        Pill(text: short ? "Step-up" : "Step-up required", tone: .negative)
            .accessibilityLabel("Needs your password again")
    }
}

/// A grouped row with a leading symbol, a title with an optional footnote,
/// a muted value, an optional step-up pill and a chevron.
struct ServerNavRow: View {
    let systemImage: String
    let title: String
    var footnote: String?
    var value: String?
    var valueColor: Color = Theme.Color.muted
    var needsStepUp = false

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: systemImage).font(Theme.Font.icon).foregroundStyle(Theme.Color.muted)
                .frame(width: 20).accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(Theme.Font.body).foregroundStyle(Theme.Color.text)
                if let footnote {
                    Text(footnote).font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: 8)
            if let value {
                // Values are short ("All on", "180 / 7 days"); the title wraps instead.
                Text(value).font(Theme.Font.body).foregroundStyle(valueColor).lineLimit(1).monospacedDigit()
                    .fixedSize()
            }
            if needsStepUp {
                StepUpPill(short: true)
            } else {
                Image(systemName: "chevron.right").font(Theme.Font.chevron)
                    .foregroundStyle(Theme.Color.muted).accessibilityHidden(true)
            }
        }
        .frame(minHeight: Theme.Space.rowHeight)
        .contentShape(Rectangle())
    }
}

/// A grouped row holding an on/off setting with a footnote under its title.
struct SettingToggleRow: View {
    let title: String
    var footnote: String?
    @Binding var isOn: Bool
    var isBusy = false

    var body: some View {
        Toggle(isOn: $isOn) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(Theme.Font.body).foregroundStyle(Theme.Color.text)
                    .fixedSize(horizontal: false, vertical: true)
                if let footnote {
                    Text(footnote).font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .tint(Theme.Color.text)
        .disabled(isBusy)
        .frame(minHeight: Theme.Space.rowHeight)
    }
}

/// A card of grouped rows; callers put a `RowRule` between rows (iOS 17 has
/// no API to interleave them automatically).
struct RowsCard<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(spacing: 0) { content }
        .padding(.horizontal, Theme.Space.pad)
        .padding(.vertical, 4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
    }
}
