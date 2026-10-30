import PetkitCore
import SwiftUI

/// The top of a device's detail: drawing, name, the one-sentence state, model
/// line, one primary command and up to four quick actions. Commands are
/// disabled while the device is offline: there is nothing to deliver them to.
struct DeviceHeroCard: View {
    let device: DeviceRecord
    let sentence: StateSentence
    let commands: CommandLayout
    let lastCommand: String?
    let ask: (DeviceAction) -> Void
    let showMore: ([DeviceAction]) -> Void
    /// Set only while the server offers force continue on a paused box; the
    /// paused hero then shows that one command (`ios-device-t6-paused`).
    var continueCleaning: (() -> Void)?

    var body: some View {
        let kind = DeviceKind(deviceType: device.type)
        let levels = DeviceFacts.drawingLevels(device)
        Card(padding: 8) {
            VStack(spacing: 8) {
                DeviceDrawing(kind: kind, level: levels.0, secondLevel: levels.1, height: 168)
                    .opacity(device.online ? 1 : 0.7)
                if let caption = levelCaption(kind: kind, levels: levels) {
                    Text(caption).font(Theme.Font.small).monospacedDigit().foregroundStyle(Theme.Color.muted)
                }
            }
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity)
            .background(Theme.Color.raised, in: RoundedRectangle(cornerRadius: Theme.Radius.panel))

            VStack(alignment: .leading, spacing: 6) {
                Text(device.name).font(Theme.Font.title).foregroundStyle(Theme.Color.text)
                    .accessibilityAddTraits(.isHeader)
                sentenceText.font(Theme.Font.body).fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 4) {
                    Text(DeviceFacts.modelLine(type: device.type))
                    if !device.firmware.isEmpty {
                        Text("· firmware")
                        Text(device.firmware).font(Theme.Font.mono)
                    }
                }
                .font(Theme.Font.extraSmall)
                .foregroundStyle(Theme.Color.muted)
            }
            .padding(.horizontal, 8)

            if let continueCleaning {
                continueBlock(continueCleaning).padding(.horizontal, 8).padding(.bottom, 8)
            } else if commands.primary != nil || !commands.quick.isEmpty {
                commandBlock.padding(.horizontal, 8).padding(.bottom, 8)
            }
        }
    }

    private var sentenceText: Text {
        let lead = Text(sentence.lead).fontWeight(.medium)
            .foregroundStyle(sentence.tone == .neutral ? Theme.Color.text : sentence.tone.color)
        guard let rest = sentence.rest else { return lead }
        return lead + Text(" \(rest)").foregroundStyle(Theme.Color.lede)
    }

    /// "Last known: 40% water" offline; "Hopper 1 · has food" for hoppers.
    private func levelCaption(kind: DeviceKind, levels: (Double?, Double?)) -> String? {
        switch kind {
        case .feederDual:
            let words = { (level: Double?) in level.map { $0 > DeviceFacts.lowFill ? "has food" : "low" } ?? "—" }
            return "Hopper 1 · \(words(levels.0))    Hopper 2 · \(words(levels.1))"
        case .litterBox:
            guard !device.online, let litter = levels.0 else { return nil }
            return "Last known: \(Int((litter * 100).rounded()))% litter"
        default:
            return nil
        }
    }

    private var commandBlock: some View {
        VStack(spacing: 10) {
            if let primary = commands.primary {
                Button { ask(primary) } label: {
                    Label(primary.name, systemImage: CommandLayout.symbol(for: primary.key))
                }
                .buttonStyle(.primary)
            }
            if !commands.quick.isEmpty || !commands.more.isEmpty {
                HStack(spacing: 8) {
                    ForEach(commands.quick, id: \.key) { action in
                        QuickAction(title: action.name, symbol: CommandLayout.symbol(for: action.key)) { ask(action) }
                    }
                    if !commands.more.isEmpty {
                        QuickAction(title: "More", symbol: "ellipsis") { showMore(commands.more) }
                    }
                }
            }
            Text(footnote).font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
                .multilineTextAlignment(.center).frame(maxWidth: .infinity)
        }
        .disabled(!device.online)
    }

    private func continueBlock(_ action: @escaping () -> Void) -> some View {
        VStack(spacing: 10) {
            Button(action: action) { Text("Continue cleaning") }
                .buttonStyle(.primary)
            Text("The box also continues by itself once the cat walks away.")
                .font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
                .multilineTextAlignment(.center).frame(maxWidth: .infinity)
        }
    }

    private var footnote: String {
        if !device.online { return "Commands wait until the \(DeviceFamily(deviceType: device.type).noun) reports again." }
        return ["Each command asks before it runs.", lastCommand.map { "\($0)." }].compactMap { $0 }.joined(separator: " ")
    }
}

/// A square quick-action button on `raised`: icon above the label.
private struct QuickAction: View {
    let title: String
    let symbol: String
    let action: () -> Void
    @Environment(\.isEnabled) private var isEnabled

    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: symbol).font(Theme.Font.iconLarge).accessibilityHidden(true)
                Text(title).font(Theme.Font.smallMedium).lineLimit(1).minimumScaleFactor(0.8)
            }
            .foregroundStyle(Theme.Color.text)
            .frame(maxWidth: .infinity, minHeight: 64)
            .background(Theme.Color.raised, in: RoundedRectangle(cornerRadius: Theme.Radius.panel))
            .opacity(isEnabled ? 1 : 0.45)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
    }
}

/// Every action that did not fit the quick row; the ones that cannot be undone
/// in their own group. Choosing one asks for confirmation like any command.
struct MoreActionsSheet: View {
    let actions: [DeviceAction]
    let choose: (DeviceAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("More commands").font(Theme.Font.section).accessibilityAddTraits(.isHeader)
            group(actions.filter { !$0.destructive })
            let destructive = actions.filter(\.destructive)
            if !destructive.isEmpty {
                Text("Cannot be undone").font(Theme.Font.small).foregroundStyle(Theme.Color.muted)
                group(destructive)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 20)
        .padding(.top, 24)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(Theme.Radius.sheetTop)
        .presentationBackground(Theme.Color.surface)
    }

    @ViewBuilder
    private func group(_ list: [DeviceAction]) -> some View {
        if !list.isEmpty {
            VStack(spacing: 0) {
                ForEach(Array(list.enumerated()), id: \.element.key) { index, action in
                    if index > 0 { RowRule() }
                    Button { choose(action) } label: {
                        HStack(spacing: 12) {
                            Image(systemName: CommandLayout.symbol(for: action.key)).font(Theme.Font.icon)
                                .frame(width: 24).accessibilityHidden(true)
                            SettingsRow(title: action.name, showsChevron: false)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 14)
            .background(Theme.Color.raised, in: RoundedRectangle(cornerRadius: Theme.Radius.hero))
        }
    }
}

#Preview("Hero") {
    let device = DevicePreviewFixtures.litterBox
    ScrollView {
        DeviceHeroCard(device: device,
                       sentence: DeviceFindings.sentence(device, zone: DevicePreviewFixtures.zone,
                                                         now: DevicePreviewFixtures.now, nextMeal: nil),
                       commands: CommandLayout(actions: device.actions, family: .litter),
                       lastCommand: "Last: Scoop · Sent over MQTT", ask: { _ in }, showMore: { _ in })
            .padding()
    }
    .background(Theme.Color.ground)
}

#Preview("More commands") {
    MoreActionsSheet(actions: DevicePreviewFixtures.litterBox.actions) { _ in }
}
