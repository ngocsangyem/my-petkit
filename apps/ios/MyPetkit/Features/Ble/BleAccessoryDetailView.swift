import PetkitCore
import SwiftUI

/// One accessory as its own device: its drawing and status, its readings, its
/// controls and its pairing details. Everything reaches it through the parent,
/// which must be on MQTT; a command is sent now or refused, never queued.
struct BleAccessoryDetailView: View {
    @Environment(ServerSession.self) private var session
    @Environment(\.dismiss) private var dismiss
    let model: BleAccessoriesModel
    let accessoryID: Int

    @State private var confirmation: CommandConfirmation?

    var body: some View {
        Group {
            if let accessory = model.accessory(id: accessoryID) {
                content(accessory)
            } else {
                EmptyBlock(title: L10n.string("Not paired"),
                           message: L10n.string("This accessory is no longer paired with the server."))
                    .frame(maxHeight: .infinity)
                    .background(Theme.Color.ground.ignoresSafeArea())
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await model.load(session: session, quiet: true) }
        .sheet(item: $confirmation, onDismiss: {
            // Unpairing removes the accessory; there is nothing left to show.
            if model.accessory(id: accessoryID) == nil { dismiss() }
        }, content: { ConfirmCommandSheet(confirmation: $0) })
    }

    private func content(_ accessory: BleAccessory) -> some View {
        let summary = BleAccessorySummary(accessory)
        let items = accessory.entities.map(BleEntityItem.init)
        let sensors = items.filter { $0.kind == .sensor }
        let controls = items.filter { $0.settable && [.toggle, .choice, .number].contains($0.kind) }
        let actions = items.filter { $0.kind == .action }
        return ScreenScroll {
            ScreenHeader(title: summary.name, finding: finding(summary), lede: summary.relayLine)
        } content: {
            hero(summary, actions: actions)
            if !sensors.isEmpty {
                FigureGrid(figures: sensors.map { Figure(label: $0.name, value: $0.valueText, unit: $0.unit) })
            }
            if !controls.isEmpty {
                SectionHeader(L10n.string("Controls"))
                BleEntityControlsCard(items: controls) { change in confirm(change, summary: summary) }
                Text("""
                    Settings travel as one block, so a change needs a reading first; \
                    before the accessory has reported, the server refuses the write.
                    """)
                    .font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted).padding(.horizontal, 4)
            }
            if summary.type?.isSpray == true { linkCard(accessory, summary: summary) }
            SectionHeader(L10n.string("Pairing"))
            BlePairingFactsCard(summary: summary)
            if summary.scanTypeIsGuessed {
                WarningPanel(text: L10n.string("""
                    The scan type for a \(summary.typeCode) is a guess, borrowed from its product line. \
                    If this accessory never reports, unpair it and pair it again with another scan type \
                    under Advanced.
                    """))
            }
            unpairCard(summary)
        }
    }

    private func finding(_ summary: BleAccessorySummary) -> Text {
        if !summary.isLinked {
            return Text("Not linked. ").foregroundStyle(Theme.Color.negative)
                + Text("No device relays for it.").foregroundStyle(Theme.Color.text)
        }
        if !summary.parentOnline {
            return Text("Unreachable. ").foregroundStyle(Theme.Color.negative)
                + Text(summary.parentName.isEmpty ? L10n.string("Its parent is offline.")
                       : L10n.string("The \(summary.parentName) is offline."))
                .foregroundStyle(Theme.Color.text)
        }
        if summary.lastSeen == nil {
            return Text("Never reported. ").foregroundStyle(Theme.Color.warning)
                + Text("Read now, then check the scan type if it stays silent.").foregroundStyle(Theme.Color.text)
        }
        return Text("Reporting. ").foregroundStyle(Theme.Color.positive)
            + Text(verbatim: "\(summary.lastReport()).").foregroundStyle(Theme.Color.text)
    }

    private func hero(_ summary: BleAccessorySummary, actions: [BleEntityItem]) -> some View {
        Card {
            DeviceDrawing(kind: summary.drawing, height: 112)
                .frame(maxWidth: .infinity, minHeight: 140)
                .background(Theme.Color.raised, in: RoundedRectangle(cornerRadius: Theme.Radius.panel))
                .accessibilityHidden(true)
            Button("Read now") {
                confirmation = CommandConfirmation(
                    question: L10n.string("Read the \(summary.name) now?"),
                    detail: L10n.string("""
                        The \(parentLabel(summary)) opens a Bluetooth session to it now instead of waiting up to \
                        \(summary.interval) s. It is sent now or refused; nothing is queued.
                        """),
                    confirmTitle: L10n.string("Read now"),
                    run: { try await model.poll(id: summary.id, session: session) }
                )
            }
            .buttonStyle(.primary)
            .accessibilityHint("Asks the parent device to read this accessory now.")
            if !actions.isEmpty {
                HStack(spacing: 8) {
                    ForEach(actions) { action in
                        Button(action.name) {
                            confirm(BleEntityChange(item: action, value: "", description: L10n.string("\(action.name) runs now.")),
                                    summary: summary)
                        }
                        .buttonStyle(SecondaryButtonStyle(fill: Theme.Color.raised))
                    }
                }
            }
            Text("""
                Each command asks before it runs. It travels over Bluetooth through the \(parentLabel(summary)), \
                which must be on MQTT.
                """)
                .font(Theme.Font.small).foregroundStyle(Theme.Color.muted)
                .multilineTextAlignment(.center).frame(maxWidth: .infinity)
        }
    }

    private func linkCard(_ accessory: BleAccessory, summary: BleAccessorySummary) -> some View {
        Card {
            Text("Litter box link").font(Theme.Font.section).accessibilityAddTraits(.isHeader)
            if summary.isLinked {
                Text("""
                    Linked to the \(parentLabel(summary)); the spray runs after the box cleans. \
                    To unlink it, unpair it: the server then tells the litter box to forget the spray.
                    """)
                    .font(Theme.Font.small).foregroundStyle(Theme.Color.lede)
            } else if model.parent?.isLitterBox == true {
                Text("No litter box owns this spray yet.").font(Theme.Font.small).foregroundStyle(Theme.Color.lede)
                Button("Link to this litter box") {
                    confirmation = CommandConfirmation(
                        question: L10n.string("Link the \(summary.name) to this litter box?"),
                        detail: L10n.string("The litter box is told it owns this spray. The stored pairing secret is kept."),
                        confirmTitle: L10n.string("Link"),
                        run: { try await model.link(accessory, session: session) }
                    )
                }
                .buttonStyle(SecondaryButtonStyle(fill: Theme.Color.raised))
            } else {
                Text("Open a litter box to link this spray to it.").font(Theme.Font.small)
                    .foregroundStyle(Theme.Color.lede)
            }
        }
    }

    private func unpairCard(_ summary: BleAccessorySummary) -> some View {
        Card(padding: 0) {
            Button {
                confirmation = CommandConfirmation(
                    question: L10n.string("Unpair the \(summary.name)?"),
                    detail: L10n.string("""
                        The \(parentLabel(summary)) stops reading it. Its old Home Assistant entities stay \
                        until you delete the device there.
                        """),
                    confirmTitle: L10n.string("Unpair"),
                    run: { try await model.unpair(id: summary.id, session: session) }
                )
            } label: {
                SettingsRow(title: L10n.string("Unpair accessory"), isDestructive: true).padding(.horizontal, Theme.Space.pad)
            }
            .buttonStyle(.plain)
        }
    }

    private func confirm(_ change: BleEntityChange, summary: BleAccessorySummary) {
        let isAction = change.item.kind == .action
        confirmation = CommandConfirmation(
            question: isAction ? "\(change.item.name)?" : L10n.string("Change \(change.item.name)?"),
            detail: L10n.string("""
                \(change.description) It is sent now through the \(parentLabel(summary)) or refused; \
                nothing is queued.
                """),
            confirmTitle: isAction ? L10n.string("Run") : L10n.string("Send"),
            run: {
                try await model.send(entity: change.item.key, value: isAction ? nil : change.value,
                                     to: summary.id, session: session)
            }
        )
    }

    private func parentLabel(_ summary: BleAccessorySummary) -> String {
        summary.parentName.isEmpty ? L10n.string("parent device") : summary.parentName
    }
}

/// The pairing facts of an accessory: what the parent is told to scan for.
/// The secret is not among them.
struct BlePairingFactsCard: View {
    let summary: BleAccessorySummary

    var body: some View {
        Card(padding: 0) {
            VStack(alignment: .leading, spacing: 0) {
                fact(L10n.string("MAC address"), summary.mac, mono: true)
                RowRule()
                fact(L10n.string("Serial number"), summary.serialNumber.isEmpty ? nil : summary.serialNumber)
                RowRule()
                fact(L10n.string("Report interval"), "\(summary.interval) s")
                RowRule()
                HStack(spacing: 8) {
                    Text("Scan type").font(Theme.Font.body)
                    if summary.scanTypeIsGuessed { Pill(text: L10n.string("Guessed"), tone: .warning) }
                    Spacer()
                    Text(verbatim: "\(summary.wireScanType)").font(Theme.Font.mono).foregroundStyle(Theme.Color.muted)
                }
                .frame(minHeight: Theme.Space.rowHeight)
                .accessibilityElement(children: .combine)
                RowRule()
                fact(L10n.string("Accessory id"), "\(summary.id)", mono: true)
                RowRule()
                fact(L10n.string("Relayed by"), summary.isLinked
                     ? "\(summary.parentName.isEmpty ? L10n.string("Device") : summary.parentName) · \(summary.parentID)" : nil)
            }
            .padding(.horizontal, Theme.Space.pad)
        }
    }

    private func fact(_ title: String, _ value: String?, mono: Bool = false) -> some View {
        HStack(spacing: 12) {
            Text(title).font(Theme.Font.body)
            Spacer(minLength: 8)
            Text(display(value)).font(mono ? Theme.Font.mono : Theme.Font.body)
                .foregroundStyle(Theme.Color.muted).monospacedDigit().lineLimit(1)
        }
        .frame(minHeight: Theme.Space.rowHeight)
        .accessibilityElement(children: .combine)
    }
}

#Preview("Fountain") {
    NavigationStack {
        BleAccessoryDetailView(model: BlePreviewFixtures.model(), accessoryID: 900002)
    }
    .environment(BlePreviewFixtures.session)
}

#Preview("Spray, never reported") {
    NavigationStack {
        BleAccessoryDetailView(model: BlePreviewFixtures.model(), accessoryID: 900001)
    }
    .environment(BlePreviewFixtures.session)
}
