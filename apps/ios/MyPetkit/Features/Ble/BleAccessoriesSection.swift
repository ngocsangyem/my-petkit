import PetkitCore
import SwiftUI

/// The "Bluetooth accessories" block on a parent device's detail: the
/// accessories that relay through it, with Pair and Import from cloud. A row
/// pushes the accessory's own detail.
struct BleAccessoriesSection: View {
    let parentDeviceID: String

    @Environment(ServerSession.self) private var session
    @State private var model: BleAccessoriesModel
    @State private var showsPair = false
    @State private var showsImport = false
    @State private var confirmation: CommandConfirmation?

    init(parentDeviceID: String) {
        self.parentDeviceID = parentDeviceID
        _model = State(initialValue: BleAccessoriesModel(parentDeviceID: parentDeviceID))
    }

    /// For previews: renders a model that already holds its state.
    init(model: BleAccessoriesModel) {
        parentDeviceID = model.parentID.map(String.init) ?? ""
        _model = State(initialValue: model)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Space.gap) {
            SectionHeader(title: "Bluetooth accessories") {
                Button("Pair") { showsPair = true }
                    .foregroundStyle(Theme.Color.accent)
                    .disabled(model.parentID == nil)
                    .accessibilityLabel("Pair a Bluetooth accessory")
            }
            .accessibilityAddTraits(.isHeader)
            Card(padding: 0) {
                LoadableBlock(state: model.accessories, loadingHeight: 52, retry: reload) { _ in
                    content
                }
                .padding(Theme.Space.pad)
            }
        }
        // Already holding a list (back from an accessory, or a preview): refresh
        // it in place rather than flashing the loading bars.
        .task { await model.load(session: session, quiet: model.accessories.value != nil) }
        .onChange(of: session.lastEvent?.id) {
            guard let event = session.lastEvent, !event.isPing, model.concerns(deviceID: event.deviceID) else { return }
            Task { await model.load(session: session, quiet: true) }
        }
        .sheet(isPresented: $showsPair) {
            BlePairSheet(model: model, onImport: {
                showsPair = false
                showsImport = true
            })
        }
        .sheet(isPresented: $showsImport) { BleImportSheet(model: model) }
        .sheet(item: $confirmation) { ConfirmCommandSheet(confirmation: $0) }
    }

    @ViewBuilder private var content: some View {
        VStack(alignment: .leading, spacing: 0) {
            if model.relayed.isEmpty {
                Text("Nothing relays through this device yet. Pair an accessory by its MAC address, "
                     + "or import the ones PetKit's app already knows.")
                    .font(Theme.Font.small).foregroundStyle(Theme.Color.muted)
                    .padding(.bottom, 12)
            }
            ForEach(Array(model.relayed.enumerated()), id: \.element.petkitId) { index, accessory in
                if index > 0 { RowRule() }
                NavigationLink {
                    BleAccessoryDetailView(model: model, accessoryID: accessory.petkitId)
                } label: {
                    BleAccessoryRow(summary: BleAccessorySummary(accessory),
                                    stateLine: BleAccessoryRow.stateLine(accessory))
                }
                .buttonStyle(.plain)
            }
            if !model.unlinkedSprays.isEmpty {
                RowRule().padding(.vertical, 4)
                Text("Not linked to any litter box").font(Theme.Font.small).foregroundStyle(Theme.Color.muted)
                    .padding(.top, 8)
                ForEach(model.unlinkedSprays, id: \.petkitId) { accessory in
                    unlinkedRow(accessory)
                }
            }
            if let notice = model.notice {
                Text(notice).font(Theme.Font.small).foregroundStyle(Theme.Color.lede)
                    .padding(.top, 8)
            }
            Button("Import from cloud") { showsImport = true }
                .buttonStyle(SecondaryButtonStyle(fill: Theme.Color.ground))
                .padding(.top, 12)
                .accessibilityHint("Asks PetKit's cloud, as this device, which accessories it owns.")
        }
    }

    private func unlinkedRow(_ accessory: BleAccessory) -> some View {
        let summary = BleAccessorySummary(accessory)
        return HStack(spacing: 12) {
            BleAccessoryRow(summary: summary, stateLine: nil)
            Button("Link here") {
                confirmation = CommandConfirmation(
                    question: "Link the \(summary.name) to this litter box?",
                    detail: "The litter box is told it owns this spray, so the spray runs after the box cleans. "
                        + "The pairing secret already stored is kept.",
                    confirmTitle: "Link",
                    run: { try await model.link(accessory, session: session) }
                )
            }
            .font(Theme.Font.control)
            .foregroundStyle(Theme.Color.accent)
            .accessibilityLabel("Link \(summary.name) to this litter box")
        }
    }

    private func reload() {
        Task { await model.load(session: session) }
    }
}

/// One accessory in the parent's list: drawing, name with the guessed-scan
/// mark, who relays it and whether that parent is up, its last report and a
/// line of state. Never its secret.
struct BleAccessoryRow: View {
    let summary: BleAccessorySummary
    let stateLine: String?

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            DeviceDrawing(kind: summary.drawing, height: 36)
                .frame(width: 40)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(summary.name).font(Theme.Font.body).foregroundStyle(Theme.Color.text)
                    if summary.scanTypeIsGuessed {
                        Pill(text: "Scan type guessed", tone: .warning)
                    }
                }
                Text(summary.relayLine).font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
                HStack(spacing: 0) {
                    if summary.isLinked {
                        Text(summary.parentOnline ? "Parent online" : "Parent offline")
                            .foregroundStyle(summary.parentOnline ? Theme.Color.positive : Theme.Color.negative)
                        Text(" · ").foregroundStyle(Theme.Color.muted)
                    }
                    Text(summary.lastReport()).foregroundStyle(Theme.Color.muted)
                }
                .font(Theme.Font.extraSmall)
                if let stateLine {
                    Text(stateLine).font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.lede)
                        .monospacedDigit().lineLimit(2)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if summary.isLinked {
                Image(systemName: "chevron.right").font(Theme.Font.chevron)
                    .foregroundStyle(Theme.Color.muted).accessibilityHidden(true)
            }
        }
        .padding(.vertical, 10)
        .frame(minHeight: Theme.Space.rowHeight)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    /// Up to three reported readings from the decoded state, or a sentence
    /// saying none arrived yet.
    static func stateLine(_ accessory: BleAccessory) -> String {
        let readings = accessory.entities.map(BleEntityItem.init)
            .filter { $0.kind != .action }
            .compactMap { item -> String? in
                guard let value = item.valueText else { return nil }
                return "\(item.name) \(value)\(item.unit.map { " \($0)" } ?? "")"
            }
        guard !readings.isEmpty else { return "Nothing reported yet" }
        return readings.prefix(3).joined(separator: " · ")
    }
}

#Preview("Accessories") {
    NavigationStack {
        ScrollView {
            BleAccessoriesSection(model: BlePreviewFixtures.model()).padding(16)
        }
        .background(Theme.Color.ground)
    }
    .environment(BlePreviewFixtures.session)
}

#Preview("Empty") {
    BleAccessoriesSection(model: BlePreviewFixtures.model(.loaded([]))).padding(16)
        .background(Theme.Color.ground)
        .environment(BlePreviewFixtures.session)
}
