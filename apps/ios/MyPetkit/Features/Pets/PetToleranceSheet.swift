import PetkitCore
import SwiftUI

/// The tolerance on a wheel, 50 g steps inside what the server accepts.
struct PetToleranceSheet: View {
    @Environment(\.dismiss) private var dismiss
    let petName: String
    let choose: (Int) -> Void
    @State private var selection: Int

    init(petName: String, current: Int, choose: @escaping (Int) -> Void) {
        self.petName = petName
        self.choose = choose
        let choices = PetWeightRules.toleranceChoices
        _selection = State(initialValue: choices.min { abs($0 - current) < abs($1 - current) } ?? current)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Weight tolerance").font(Theme.Font.sheetTitle).accessibilityAddTraits(.isHeader)
            Text("How far a visit may sit from \(petName)'s registered weight and still be \(petName).")
                .font(Theme.Font.body).foregroundStyle(Theme.Color.lede)
            Picker("Weight tolerance", selection: $selection) {
                ForEach(PetWeightRules.toleranceChoices, id: \.self) { grams in
                    Text(PetWeightRules.toleranceText(grams)).font(Theme.Font.body).monospacedDigit().tag(grams)
                }
            }
            .pickerStyle(.wheel)
            .frame(maxWidth: .infinity, minHeight: 180)
            .background(Theme.Color.raised, in: RoundedRectangle(cornerRadius: Theme.Radius.panel))
            Button("Done") {
                choose(selection)
                dismiss()
            }
            .buttonStyle(.primary)
            Button("Cancel") { dismiss() }
                .font(Theme.Font.button).foregroundStyle(Theme.Color.text)
                .frame(maxWidth: .infinity, minHeight: Theme.Space.control)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 20)
        .padding(.top, 24)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(Theme.Radius.sheetTop)
        .presentationBackground(Theme.Color.surface)
    }
}
