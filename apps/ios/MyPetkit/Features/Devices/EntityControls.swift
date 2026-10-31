import PetkitCore
import SwiftUI

/// A value about to be written to an entity, with the words its confirmation uses.
enum EntityWrite: Equatable {
    case toggle(Bool)
    case option(String)
    case number(Double)

    /// What the server is sent: it parses and validates it.
    var wire: String {
        switch self {
        case .toggle(let on): on ? "ON" : "OFF"
        case .option(let label): label
        case .number(let value): DeviceFigures.format(value)
        }
    }

    func question(_ entity: DeviceEntity) -> String {
        switch self {
        case .toggle(let on): L10n.string(on ? "Turn on \(entity.name)?" : "Turn off \(entity.name)?")
        case .option(let label): L10n.string("Set \(entity.name) to \(label)?")
        case .number(let value):
            L10n.string("Set \(entity.name) to \(DeviceFigures.format(value))\(entity.unit.map { " \($0)" } ?? "")?")
        }
    }

    var confirmTitle: String {
        switch self {
        case .toggle(let on): L10n.string(on ? "Turn on" : "Turn off")
        case .option, .number: L10n.string("Set")
        }
    }

    /// The options an enum entity offers, as the labels the server accepts.
    static func options(_ entity: DeviceEntity) -> [String] {
        (entity.options ?? []).compactMap(\.string)
    }

    /// Every value a number entity may take, min to max by step. Without a
    /// range the 0–60 of a delay in minutes stands in; a bad step counts as 1.
    static func choices(_ entity: DeviceEntity) -> [Double] {
        let low = entity.min ?? 0, high = entity.max ?? 60
        let step = (entity.step ?? 1) > 0 ? (entity.step ?? 1) : 1
        guard high >= low else { return [low] }
        return Array(stride(from: low, through: high + step / 1000, by: step))
    }

    /// A number entity's value with its unit ("5 min"), or "—" when unknown.
    static func valueText(_ entity: DeviceEntity) -> String {
        guard let value = DeviceFacts.number(entity) else { return "—" }
        return DeviceFigures.format(value) + (entity.unit.map { " \($0)" } ?? "")
    }

    /// A number entity's next value one step up or down, kept inside its range.
    static func stepped(_ value: Double, by direction: Double, entity: DeviceEntity) -> Double {
        let next = value + direction * (entity.step ?? 1)
        return min(max(next, entity.min ?? -.infinity), entity.max ?? .infinity)
    }
}

/// Grouped rows for an entity list: a switch, a select or a number each. Every
/// change asks first (`ask`); the row shows the device's value until the
/// confirmed write comes back.
struct EntityControlsCard: View {
    let title: String
    let entities: [DeviceEntity]
    var enabled = true
    let ask: (DeviceEntity, EntityWrite) -> Void

    var body: some View {
        if !entities.isEmpty {
            SectionHeader(title)
            Card(padding: 0) {
                EntityRows(entities: entities, enabled: enabled, ask: ask).padding(.horizontal, 16)
            }
        }
    }
}

/// A row's own words in place of the entity's name, by entity key.
struct EntityLabel: Equatable {
    let title: String
    var footnote: String?
    /// A number shown as value and chevron that opens a picker, instead of −/+.
    var opensPicker = false
}

struct EntityRows: View {
    let entities: [DeviceEntity]
    let enabled: Bool
    var labels: [String: EntityLabel] = [:]
    /// Opens the picker for a number row whose label asks for one.
    var pick: ((DeviceEntity) -> Void)?
    let ask: (DeviceEntity, EntityWrite) -> Void

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(entities.enumerated()), id: \.element.key) { index, entity in
                if index > 0 { RowRule() }
                row(entity)
            }
        }
        .disabled(!enabled)
    }

    @ViewBuilder
    private func row(_ entity: DeviceEntity) -> some View {
        switch entity.component {
        case "switch":
            Toggle(isOn: Binding(get: { DeviceFacts.isOn(entity) ?? false },
                                 set: { ask(entity, .toggle($0)) })) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title(entity)).font(Theme.Font.body).foregroundStyle(Theme.Color.text)
                    if let footnote = labels[entity.key]?.footnote {
                        Text(footnote).font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            .tint(Theme.Color.text)
            .frame(minHeight: Theme.Space.rowHeight)
        case "select":
            Menu {
                ForEach(EntityWrite.options(entity), id: \.self) { label in
                    Button(label) { ask(entity, .option(label)) }
                }
            } label: {
                SettingsRow(title: title(entity), value: DeviceFacts.label(entity) ?? L10n.string("Not reported"))
            }
            .buttonStyle(.plain)
        default:
            if labels[entity.key]?.opensPicker == true, let pick {
                Button { pick(entity) } label: {
                    SettingsRow(title: title(entity), value: EntityWrite.valueText(entity))
                }
                .buttonStyle(.plain)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(title(entity))
                .accessibilityValue(EntityWrite.valueText(entity) == "—" ? L10n.string("Not reported") : EntityWrite.valueText(entity))
                .accessibilityAddTraits(.isButton)
            } else {
                NumberEntityRow(entity: entity, title: title(entity)) { ask(entity, .number($0)) }
            }
        }
    }

    private func title(_ entity: DeviceEntity) -> String { labels[entity.key]?.title ?? entity.name }
}

/// A number setting: − and + move a pending value inside the entity's range,
/// and Set asks to send it.
private struct NumberEntityRow: View {
    let entity: DeviceEntity
    let title: String
    let set: (Double) -> Void
    @State private var pending: Double?

    var body: some View {
        let current = DeviceFacts.number(entity)
        let shown = pending ?? current
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(Theme.Font.body).foregroundStyle(Theme.Color.text)
                if let min = entity.min, let max = entity.max {
                    Text("\(DeviceFigures.format(min))–\(DeviceFigures.format(max))\(entity.unit.map { " \($0)" } ?? "")")
                        .font(Theme.Font.extraSmall).monospacedDigit().foregroundStyle(Theme.Color.muted)
                }
            }
            Spacer(minLength: 8)
            stepButton("minus", label: L10n.string("Decrease \(entity.name)"), direction: -1, from: shown)
            Text(shown.map(DeviceFigures.format) ?? "—")
                .font(Theme.Font.figureInRow).monospacedDigit().frame(minWidth: 32)
            stepButton("plus", label: L10n.string("Increase \(entity.name)"), direction: 1, from: shown)
            if let pending, pending != current {
                Button("Set") { set(pending) }
                    .font(Theme.Font.control.weight(.semibold)).foregroundStyle(Theme.Color.accent)
            }
        }
        .frame(minHeight: Theme.Space.rowHeight)
        .onChange(of: current) { _, _ in pending = nil }
    }

    private func stepButton(_ symbol: String, label: String, direction: Double, from value: Double?) -> some View {
        Button {
            pending = EntityWrite.stepped(value ?? entity.min ?? 0, by: direction, entity: entity)
        } label: {
            Image(systemName: symbol).font(Theme.Font.icon).foregroundStyle(Theme.Color.text)
                .frame(width: 36, height: 36)
                .background(Theme.Color.raised, in: Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

#Preview("Entity controls") {
    ScrollView {
        VStack(alignment: .leading) {
            EntityControlsCard(title: "Settings", entities: EntityGroups(DevicePreviewFixtures.litterBox).controls) { _, _ in }
        }
        .padding()
    }
    .background(Theme.Color.ground)
}
