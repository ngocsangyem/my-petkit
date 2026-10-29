import PetkitCore
import SwiftUI

/// What an R2 command confirmation says: the title is a question, the body
/// says what will move, the confirm button is near-black.
struct CommandConfirmation: Identifiable {
    let id = UUID()
    let question: String
    let detail: String
    let confirmTitle: String
    let run: @MainActor () async throws -> Void
}

/// The confirm sheet for device commands. The command runs from here and any
/// refusal stays in the sheet, in the server's words.
struct ConfirmCommandSheet: View {
    @Environment(\.dismiss) private var dismiss
    let confirmation: CommandConfirmation
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(confirmation.question).font(Theme.Font.section).accessibilityAddTraits(.isHeader)
            Text(confirmation.detail).font(Theme.Font.body).foregroundStyle(Theme.Color.lede)
                .fixedSize(horizontal: false, vertical: true)
            if let error {
                Text(error).font(Theme.Font.small).foregroundStyle(Theme.Color.negative)
            }
            Button {
                run()
            } label: {
                if busy { ProgressView().tint(Theme.Color.onPrimary) } else { Text(confirmation.confirmTitle) }
            }
            .buttonStyle(.primary)
            .disabled(busy)
            Button("Cancel") { dismiss() }
                .font(Theme.Font.button)
                .foregroundStyle(Theme.Color.text)
                .frame(maxWidth: .infinity, minHeight: Theme.Space.control)
        }
        .padding(.horizontal, 20)
        .padding(.top, 24)
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(Theme.Radius.sheetTop)
        .presentationBackground(Theme.Color.surface)
    }

    private func run() {
        busy = true
        error = nil
        Task {
            defer { busy = false }
            do {
                try await confirmation.run()
                dismiss()
            } catch {
                self.error = Loadable<Void>.message(for: error)
            }
        }
    }
}
