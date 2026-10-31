import PetkitAPI
import PetkitCore
import SwiftUI

/// "Continue cleaning now?" (`ios-device-t6-paused`). Opens only after the
/// password was confirmed, ticks its rows from the server's blockers and
/// sends the one continue from here. A refusal stays in the sheet, in the
/// server's words.
struct ForceContinueSheet: View {
    @Environment(\.dismiss) private var dismiss
    let info: ForceContinueInfo
    let run: @MainActor () async throws -> Void
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(ForceContinueRules.question).font(Theme.Font.sheetTitle).accessibilityAddTraits(.isHeader)
            Text(ForceContinueRules.detail).font(Theme.Font.body).foregroundStyle(Theme.Color.lede)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 8).padding(.bottom, 14)
            checklist
            ForEach(ForceContinueRules.otherRefusals(info.blockers), id: \.self) { message in
                Text(message).font(Theme.Font.small).foregroundStyle(Theme.Color.negative).padding(.top, 8)
            }
            warning.padding(.top, 14).padding(.bottom, 16)
            if let error {
                Text(error).font(Theme.Font.small).foregroundStyle(Theme.Color.negative).padding(.bottom, 10)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Button(action: send) {
                if busy { ProgressView().tint(Theme.Color.onPrimary) } else { Text("Continue cleaning") }
            }
            .buttonStyle(.primary)
            .disabled(busy || !info.offered)
            Button("Not now") { dismiss() }
                .font(Theme.Font.button)
                .foregroundStyle(Theme.Color.text)
                .frame(maxWidth: .infinity, minHeight: Theme.Space.button)
                .padding(.top, 4)
            Text(ForceContinueRules.footnote).font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
                .multilineTextAlignment(.center).frame(maxWidth: .infinity)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 6)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 20)
        .padding(.top, 24)
        .presentationDetents([.fraction(0.66), .large])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(Theme.Radius.sheetTop)
        .presentationBackground(Theme.Color.surface)
    }

    private var checklist: some View {
        VStack(spacing: 0) {
            ForEach(Array(ForceContinueRules.rows(info.blockers).enumerated()), id: \.element.id) { index, row in
                if index > 0 { RowRule() }
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    Image(systemName: row.isClear ? "checkmark" : "xmark")
                        .font(Theme.Font.chevron)
                        .foregroundStyle(row.isClear ? Theme.Color.positive : Theme.Color.negative)
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(row.title).font(Theme.Font.body).foregroundStyle(Theme.Color.text)
                        if let refusal = row.refusal {
                            Text(refusal).font(Theme.Font.small).foregroundStyle(Theme.Color.muted)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    Spacer(minLength: 0)
                }
                .padding(.vertical, 12)
                .frame(minHeight: Theme.Space.control)
                .accessibilityElement(children: .combine)
                .accessibilityValue(row.isClear ? L10n.string("Checked") : L10n.string("Not clear"))
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 4)
        .background(Theme.Color.raised, in: RoundedRectangle(cornerRadius: Theme.Radius.hero))
    }

    private var warning: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "exclamationmark.triangle").font(Theme.Font.icon)
                .foregroundStyle(Theme.Color.negative).accessibilityHidden(true)
            Text(ForceContinueRules.warning).font(Theme.Font.control.weight(.regular))
                .foregroundStyle(Theme.Color.lede).fixedSize(horizontal: false, vertical: true)
        }
    }

    private func send() {
        busy = true
        error = nil
        Task {
            defer { busy = false }
            do {
                try await run()
                dismiss()
            } catch {
                self.error = Self.message(for: error)
            }
        }
    }

    /// The server's sentence; an expired password check reads as what to do,
    /// because the password screen cannot open over this sheet.
    static func message(for error: any Error) -> String {
        if let api = APIError.from(error), api.needsStepUp {
            return L10n.string("Your password check has run out. Close this and tap Continue cleaning again.")
        }
        return Loadable<Void>.message(for: error)
    }
}

#Preview("Offered") {
    Color.clear.sheet(isPresented: .constant(true)) {
        ForceContinueSheet(info: DevicePreviewFixtures.pausedOffered.forceContinue) {}
    }
}

#Preview("Refused") {
    Color.clear.sheet(isPresented: .constant(true)) {
        ForceContinueSheet(info: DevicePreviewFixtures.pausedRefused.forceContinue) {}
    }
}
