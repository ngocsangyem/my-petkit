import PetkitCore
import SwiftUI

/// "Who used the box at 14:31?": names the cat of one stored visit, or marks
/// it as no cat. Only the server's record changes; the footnote says so.
struct TimelineChangeCatSheet: View {
    @Environment(ServerSession.self) private var session
    @Environment(\.dismiss) private var dismiss
    let entry: TimelineEntry
    let tzOffset: Int
    let candidates: [TimelineCatCandidate]
    /// Sends the answer and refreshes what it changed.
    let save: (TimelineVisitPetRequest) async throws -> Void

    @State private var choice: TimelineCatChoice?
    @State private var useWeight = false
    @State private var applyToRef = false
    @State private var busy = false
    @State private var error: String?

    /// `preselect` and `useWeight` start the sheet part-way through an
    /// answer (previews and snapshots); otherwise it opens on the visit's own.
    init(entry: TimelineEntry, tzOffset: Int, candidates: [TimelineCatCandidate],
         preselect: TimelineCatChoice? = nil, useWeight: Bool = false,
         save: @escaping (TimelineVisitPetRequest) async throws -> Void) {
        self.entry = entry
        self.tzOffset = tzOffset
        self.candidates = candidates
        self.save = save
        _choice = State(initialValue: preselect ?? TimelineChangeCatRules.initialChoice(entry))
        _useWeight = State(initialValue: useWeight)
    }

    private var request: TimelineVisitPetRequest? {
        TimelineChangeCatRules.request(choice: choice, useWeight: useWeight, applyToRef: applyToRef, entry: entry)
    }

    private var chosenName: String {
        guard case .pet(let id) = choice else { return "" }
        return candidates.first { $0.id == id }?.pet.name ?? ""
    }

    var body: some View {
        ScrollView {
            content
                .padding(.horizontal, 20)
                .padding(.top, 24)
                .padding(.bottom, 12)
        }
        .scrollBounceBehavior(.basedOnSize)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(Theme.Radius.sheetTop)
        .presentationBackground(Theme.Color.surface)
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(TimelineChangeCatRules.title(entry, tzOffset: tzOffset))
                .font(Theme.Font.sheetTitle).foregroundStyle(Theme.Color.text)
                .accessibilityAddTraits(.isHeader)
            Text(TimelineChangeCatRules.context(entry))
                .font(Theme.Font.body).foregroundStyle(Theme.Color.lede)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 6)
                .padding(.bottom, 14)
            VStack(spacing: 8) {
                ForEach(candidates) { candidate in
                    TimelineCatOption(option: .pet(candidate.id), selection: $choice, minHeight: 64) {
                        PetPhoto(name: candidate.pet.name, photoPath: candidate.pet.photoPath,
                                 tintIndex: candidate.tintIndex)
                            .frame(width: 40, height: 40)
                            .clipShape(Circle())
                        VStack(alignment: .leading, spacing: 2) {
                            Text(candidate.pet.name).font(Theme.Font.bodyMedium.weight(.semibold))
                            Text(TimelineChangeCatRules.registeredLine(candidate))
                                .font(Theme.Font.small).monospacedDigit().foregroundStyle(Theme.Color.muted)
                        }
                    }
                }
                TimelineCatOption(option: .passing, selection: $choice, minHeight: Theme.Space.rowHeight) {
                    Text("No cat, just passing").font(Theme.Font.body)
                }
            }
            switches.padding(.top, 6)
            if let error {
                Text(error).font(Theme.Font.small).foregroundStyle(Theme.Color.negative).padding(.top, 8)
            }
            Button { send() } label: {
                if busy { ProgressView().tint(Theme.Color.onPrimary) } else { Text("Save") }
            }
            .buttonStyle(.primary)
            .disabled(busy || !TimelineChangeCatRules.changesSomething(request, entry: entry))
            .padding(.top, 8)
            Text("Changes this record only. Nothing is sent to the litter box.")
                .font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
                .padding(.top, 8)
        }
    }

    @ViewBuilder
    private var switches: some View {
        if TimelineChangeCatRules.offersWeight(choice, entry: entry),
           let reading = TimelineFormat.weight(TimelineChangeCatRules.visitGrams(entry)) {
            SettingToggleRow(title: L10n.string("Use this for \(chosenName)'s weight"),
                             footnote: L10n.string("Updates the registered weight to \(reading)."), isOn: $useWeight)
        }
        if TimelineChangeCatRules.offersRef(choice, entry: entry) {
            SettingToggleRow(title: L10n.string("Also name its later visits"),
                             footnote: L10n.string("The id the box gave this cat will mean \(chosenName) from now on."),
                             isOn: $applyToRef)
        }
    }

    private func send() {
        guard let request else { return }
        busy = true
        error = nil
        Task {
            defer { busy = false }
            do {
                try await session.call(purpose: L10n.string("Change the cat of this visit")) { try await save(request) }
                dismiss()
            } catch {
                self.error = Loadable<Void>.message(for: error)
            }
        }
    }
}

/// One answer in the sheet: a row on `raised`, an ink ring and a filled
/// check when it is the chosen one.
private struct TimelineCatOption<Label: View>: View {
    let option: TimelineCatChoice
    @Binding var selection: TimelineCatChoice?
    let minHeight: CGFloat
    @ViewBuilder var label: Label

    private var isSelected: Bool { selection == option }

    var body: some View {
        Button { selection = option } label: {
            HStack(spacing: 12) {
                label
                Spacer(minLength: 8)
                ZStack {
                    if isSelected {
                        Circle().fill(Theme.Color.text)
                        Image(systemName: "checkmark").font(Theme.Font.chevron).foregroundStyle(Theme.Color.onPrimary)
                    } else {
                        Circle().strokeBorder(Theme.Color.toggleOff, lineWidth: 2)
                    }
                }
                .frame(width: 22, height: 22)
                .accessibilityHidden(true)
            }
            .foregroundStyle(Theme.Color.text)
            .padding(.horizontal, 14)
            .frame(maxWidth: .infinity, minHeight: minHeight, alignment: .leading)
            .background(Theme.Color.raised, in: RoundedRectangle(cornerRadius: Theme.Radius.hero))
            .overlay {
                if isSelected {
                    RoundedRectangle(cornerRadius: Theme.Radius.hero).strokeBorder(Theme.Color.text, lineWidth: 2)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

#Preview {
    PetsPreview.wrap {
        Color.clear.sheet(isPresented: .constant(true)) {
            TimelineChangeCatSheet(entry: TimelineFixtures.unrecognised, tzOffset: TimelineFixtures.day.tzOffset,
                                   candidates: TimelineChangeCatRules.candidates(
                                       pets: TimelineFixtures.pets, visitGrams: TimelineFixtures.unrecognised.weight),
                                   preselect: .pet(1), useWeight: true, save: { _ in })
        }
    }
}
