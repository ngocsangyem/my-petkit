import PetkitCore
import SwiftUI

/// Grey bars at their final size: no shimmer, no layout shift.
struct LoadingBars: View {
    var lines = 2
    var height: CGFloat = 112

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            RoundedRectangle(cornerRadius: Theme.Radius.panel).fill(Theme.Color.raised).frame(height: height)
            ForEach(0..<lines, id: \.self) { index in
                RoundedRectangle(cornerRadius: 4).fill(Theme.Color.raised)
                    .frame(width: index == 0 ? 100 : 130, height: 12)
            }
        }
        .accessibilityLabel("Loading")
    }
}

/// An error that stays inside its block: one sentence plus Retry.
struct BlockError: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle").foregroundStyle(Theme.Color.negative)
                .accessibilityHidden(true)
            Text(message).font(Theme.Font.control).foregroundStyle(Theme.Color.text)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button("Retry", action: retry)
                .font(Theme.Font.control.weight(.semibold))
                .foregroundStyle(Theme.Color.text)
                .padding(.horizontal, 14)
                .frame(height: 36)
                .background(Theme.Color.surface, in: Capsule())
                .buttonStyle(.plain)
        }
        .padding(14)
        .background(Theme.Color.raised, in: RoundedRectangle(cornerRadius: Theme.Radius.panel))
    }
}

/// An empty block: what is missing and the one thing to do about it.
struct EmptyBlock<Art: View>: View {
    let title: String
    let message: String
    var actionTitle: String?
    var action: (() -> Void)?
    @ViewBuilder var art: Art

    var body: some View {
        VStack(spacing: 12) {
            art
            Text(title).font(Theme.Font.section).foregroundStyle(Theme.Color.text)
            Text(message).font(Theme.Font.small).foregroundStyle(Theme.Color.muted)
                .multilineTextAlignment(.center)
            if let actionTitle, let action {
                Button(actionTitle, action: action).buttonStyle(.primary)
            }
        }
        .frame(maxWidth: .infinity)
    }
}

extension EmptyBlock where Art == EmptyView {
    init(title: String, message: String, actionTitle: String? = nil, action: (() -> Void)? = nil) {
        self.init(title: title, message: message, actionTitle: actionTitle, action: action) { EmptyView() }
    }
}

/// Renders a `Loadable` block: bars while loading, the error with Retry, or content.
struct LoadableBlock<Value, Content: View>: View {
    let state: Loadable<Value>
    var loadingHeight: CGFloat = 112
    let retry: () -> Void
    @ViewBuilder var content: (Value) -> Content

    var body: some View {
        switch state {
        case .loading: LoadingBars(height: loadingHeight)
        case .failed(let message): BlockError(message: message, retry: retry)
        case .loaded(let value): content(value)
        }
    }
}

/// Formats a value the device may never have sent: nil prints an em dash.
func display(_ value: String?) -> String { value ?? "—" }
