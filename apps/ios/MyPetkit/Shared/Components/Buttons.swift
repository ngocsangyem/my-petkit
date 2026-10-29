import PetkitCore
import SwiftUI

/// Near-black pill, at most one per screen.
struct PrimaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.Font.button)
            .foregroundStyle(Theme.Color.onPrimary)
            .frame(maxWidth: .infinity, minHeight: Theme.Space.button)
            .padding(.horizontal, 22)
            .background(Theme.Color.text, in: Capsule())
            .opacity(isEnabled ? (configuration.isPressed ? 0.8 : 1) : 0.4)
    }
}

/// Pill on `raised` (or `ground` inside a card).
struct SecondaryButtonStyle: ButtonStyle {
    var fill: Color = Theme.Color.raised
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.Font.button)
            .foregroundStyle(Theme.Color.text)
            .frame(maxWidth: .infinity, minHeight: Theme.Space.button)
            .padding(.horizontal, 22)
            .background(configuration.isPressed ? Theme.Color.segment : fill, in: Capsule())
            .opacity(isEnabled ? 1 : 0.4)
    }
}

/// Red fill: only the final action of an R3 flow.
struct FinalDestructiveButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.Font.button)
            .foregroundStyle(Theme.Color.onNegative)
            .frame(maxWidth: .infinity, minHeight: Theme.Space.button)
            .background(Theme.Color.negative, in: Capsule())
            .opacity(isEnabled ? (configuration.isPressed ? 0.8 : 1) : 0.4)
    }
}

/// Round 44pt icon button on `surface`, for header actions.
struct IconButton: View {
    let systemImage: String
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(.body, weight: .medium))
                .foregroundStyle(Theme.Color.text)
                .frame(width: Theme.Space.control, height: Theme.Space.control)
                .background(Theme.Color.surface, in: Circle())
        }
        .accessibilityLabel(label)
    }
}

extension ButtonStyle where Self == PrimaryButtonStyle {
    static var primary: PrimaryButtonStyle { PrimaryButtonStyle() }
}

extension ButtonStyle where Self == SecondaryButtonStyle {
    static var secondary: SecondaryButtonStyle { SecondaryButtonStyle() }
}

extension ButtonStyle where Self == FinalDestructiveButtonStyle {
    static var finalDestructive: FinalDestructiveButtonStyle { FinalDestructiveButtonStyle() }
}
