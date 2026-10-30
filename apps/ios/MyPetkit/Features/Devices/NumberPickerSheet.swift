import PetkitCore
import SwiftUI

/// Picks a number entity's value on a wheel inside its range (the litter
/// box's clean delay). Continue hands the value on; the caller swaps this
/// sheet for the usual confirmation, which sends it.
struct NumberPickerSheet: View {
    @Environment(\.dismiss) private var dismiss
    let entity: DeviceEntity
    let title: String
    let choose: (Double) -> Void
    @State private var selection: Double

    init(entity: DeviceEntity, title: String, choose: @escaping (Double) -> Void) {
        self.entity = entity
        self.title = title
        self.choose = choose
        let choices = EntityWrite.choices(entity)
        let current = DeviceFacts.number(entity)
        // The wheel starts on the device's value, or the nearest allowed one.
        let start = current.flatMap { value in choices.min { abs($0 - value) < abs($1 - value) } }
        _selection = State(initialValue: start ?? choices.first ?? 0)
    }

    private var current: Double? { DeviceFacts.number(entity) }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(title).font(Theme.Font.sheetTitle).accessibilityAddTraits(.isHeader)
            Text("Now \(EntityWrite.valueText(entity)).")
                .font(Theme.Font.body).foregroundStyle(Theme.Color.lede)
            Picker(title, selection: $selection) {
                ForEach(EntityWrite.choices(entity), id: \.self) { value in
                    Text(label(value)).font(Theme.Font.body).monospacedDigit().tag(value)
                }
            }
            .pickerStyle(.wheel)
            .frame(maxWidth: .infinity, minHeight: 180)
            .background(Theme.Color.raised, in: RoundedRectangle(cornerRadius: Theme.Radius.panel))
            Button("Continue") { choose(selection) }
                .buttonStyle(.primary)
                .disabled(selection == current)
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

    private func label(_ value: Double) -> String {
        DeviceFigures.format(value) + (entity.unit.map { " \($0)" } ?? "")
    }
}

#Preview("Clean delay") {
    if let delay = DeviceFacts.entity(DevicePreviewFixtures.litterBox, "cleaning_delay") {
        NumberPickerSheet(entity: delay, title: "Clean delay") { _ in }
    }
}
