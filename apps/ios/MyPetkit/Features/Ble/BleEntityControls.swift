import PetkitCore
import SwiftUI

/// A change the user picked on a control, before it is confirmed and sent.
struct BleEntityChange {
    let item: BleEntityItem
    /// What the server receives: ON/OFF, an option label, or a decimal.
    let value: String
    /// What the confirmation says will happen.
    let description: String
}

/// The settable entities of an accessory as rows. A row never changes state on
/// its own: it hands the picked change up, which asks first and then sends.
/// The shown value stays the accessory's until its next reading says otherwise.
struct BleEntityControlsCard: View {
    let items: [BleEntityItem]
    let onChange: (BleEntityChange) -> Void

    @State private var editing: BleEntityItem?
    @State private var numberText = ""

    var body: some View {
        Card(padding: 0) {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                    if index > 0 { RowRule() }
                    row(item)
                }
            }
            .padding(.horizontal, Theme.Space.pad)
            .padding(.vertical, 4)
        }
        .alert(editing?.name ?? "", isPresented: Binding(get: { editing != nil }, set: { if !$0 { editing = nil } })) {
            TextField(editing.map(range) ?? "", text: $numberText).keyboardType(.decimalPad)
            Button("Cancel", role: .cancel) { editing = nil }
            Button("Continue") { submitNumber() }
        } message: {
            Text(editing.map(prompt) ?? "")
        }
    }

    @ViewBuilder private func row(_ item: BleEntityItem) -> some View {
        switch item.kind {
        case .toggle:
            Toggle(isOn: Binding(
                get: { item.isOn ?? false },
                set: { on in
                    onChange(BleEntityChange(item: item, value: on ? "ON" : "OFF",
                                             description: on ? L10n.string("\(item.name) turns on.")
                                                 : L10n.string("\(item.name) turns off.")))
                }
            )) {
                Text(item.name).font(Theme.Font.body)
            }
            .tint(Theme.Color.text)
            .frame(minHeight: Theme.Space.rowHeight)
        case .choice:
            Menu {
                ForEach(item.options, id: \.self) { option in
                    Button(option) {
                        onChange(BleEntityChange(item: item, value: option,
                                                 description: L10n.string("\(item.name) changes to \(option).")))
                    }
                }
            } label: {
                SettingsRow(title: item.name, value: display(item.valueText))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(item.name), \(display(item.valueText))")
        case .number:
            Button {
                numberText = item.valueText ?? ""
                editing = item
            } label: {
                SettingsRow(title: item.name, value: display(item.valueText.map { v in
                    item.unit.map { "\(v) \($0)" } ?? v
                }))
            }
            .buttonStyle(.plain)
        case .sensor, .action, .other:
            SettingsRow(title: item.name, value: display(item.valueText), showsChevron: false)
        }
    }

    private func range(_ item: BleEntityItem) -> String {
        switch (item.min, item.max) {
        case let (low?, high?): "\(BleEntityItem.text(low) ?? "")–\(BleEntityItem.text(high) ?? "")"
        case let (low?, nil): L10n.string("at least \(BleEntityItem.text(low) ?? "")")
        case let (nil, high?): L10n.string("at most \(BleEntityItem.text(high) ?? "")")
        default: L10n.string("a number")
        }
    }

    private func prompt(_ item: BleEntityItem) -> String {
        guard let unit = item.unit else { return L10n.string("Enter a value (\(range(item))).") }
        return L10n.string("Enter a value in \(unit) (\(range(item))).")
    }

    private func submitNumber() {
        guard let item = editing else { return }
        editing = nil
        let text = numberText.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: ".")
        // The server parses the decimal and refuses anything unusable in its
        // own words, so an unparsable entry is still sent rather than guessed at.
        guard !text.isEmpty else { return }
        let unit = item.unit.map { " \($0)" } ?? ""
        onChange(BleEntityChange(item: item, value: text, description: L10n.string("\(item.name) changes to \(text + unit).")))
    }
}

#Preview("Controls") {
    BleEntityControlsCard(
        items: (BlePreviewFixtures.accessories.last?.entities ?? []).map(BleEntityItem.init)
            .filter { $0.settable && $0.kind != .action },
        onChange: { _ in }
    )
    .padding(16)
    .background(Theme.Color.ground)
}
