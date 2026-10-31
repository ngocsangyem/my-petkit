import PetkitCore
import SwiftUI

/// Import from cloud: says before anything is sent that the server will go
/// out to PetKit's cloud, signed with the parent's own secret, then lists what
/// happened to every accessory the account named, refusals included.
struct BleImportSheet: View {
    @Environment(ServerSession.self) private var session
    @Environment(\.dismiss) private var dismiss
    let model: BleAccessoriesModel

    @State private var busy = false
    @State private var error: String?
    @State private var outcome: BleImportOutcome?

    init(model: BleAccessoriesModel, outcome: BleImportOutcome? = nil) {
        self.model = model
        _outcome = State(initialValue: outcome)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(outcome == nil ? L10n.string("Import from PetKit's cloud?") : L10n.string("Import finished"))
                .font(Theme.Font.section).accessibilityAddTraits(.isHeader)
            if let outcome {
                results(outcome)
                Button("Done") { dismiss() }.buttonStyle(.primary)
            } else {
                WarningPanel(text: L10n.string("""
                    The server will contact PetKit's cloud on the internet and sign the request \
                    with the \(model.parent?.name ?? L10n.string("parent device"))'s secret, as if it were the device. \
                    It asks once, now, and copies each accessory's MAC and pairing secret here.
                    """))
                if let error {
                    Text(error).font(Theme.Font.small).foregroundStyle(Theme.Color.negative)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Button(action: run) {
                    if busy { ProgressView().tint(Theme.Color.onPrimary) } else { Text("Ask PetKit") }
                }
                .buttonStyle(.primary)
                .disabled(busy || model.parentID == nil)
                Button("Cancel") { dismiss() }
                    .font(Theme.Font.button)
                    .foregroundStyle(Theme.Color.text)
                    .frame(maxWidth: .infinity, minHeight: Theme.Space.control)
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 24)
        .padding(.bottom, 12)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(Theme.Radius.sheetTop)
        .presentationBackground(Theme.Color.surface)
        .interactiveDismissDisabled(busy)
    }

    private func results(_ outcome: BleImportOutcome) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(verbatim: "\(outcome.imported)").font(Theme.Font.figure).monospacedDigit()
                Text(outcome.imported == 1 ? L10n.string("accessory paired or changed") : L10n.string("accessories paired or changed"))
                    .font(Theme.Font.body).foregroundStyle(Theme.Color.muted)
            }
            .accessibilityElement(children: .combine)
            if outcome.lines.isEmpty {
                Text("PetKit's cloud named no accessories for this device.")
                    .font(Theme.Font.small).foregroundStyle(Theme.Color.muted)
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        ForEach(Array(outcome.lines.enumerated()), id: \.element.id) { index, line in
                            if index > 0 { RowRule() }
                            VStack(alignment: .leading, spacing: 2) {
                                Text(line.title).font(Theme.Font.mono).foregroundStyle(Theme.Color.text)
                                Text(line.outcome).font(Theme.Font.small).foregroundStyle(Theme.Color.lede)
                            }
                            .padding(.vertical, 8)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .accessibilityElement(children: .combine)
                        }
                    }
                }
                .padding(.horizontal, 14)
                .background(Theme.Color.raised, in: RoundedRectangle(cornerRadius: Theme.Radius.panel))
            }
        }
    }

    private func run() {
        busy = true
        error = nil
        Task {
            defer { busy = false }
            do {
                outcome = try await model.importFromCloud(session: session)
            } catch {
                self.error = Loadable<Void>.message(for: error)
            }
        }
    }
}

#Preview("Before import") {
    Text("Device").sheet(isPresented: .constant(true)) {
        BleImportSheet(model: BlePreviewFixtures.model())
    }
    .environment(BlePreviewFixtures.session)
}

#Preview("Results") {
    Text("Device").sheet(isPresented: .constant(true)) {
        BleImportSheet(model: BlePreviewFixtures.model(), outcome: BleImportOutcome(imported: 1, lines: [
            .init(id: 0, title: "W5 900002 · C8:47:8C:1A:2B:3C", outcome: "imported"),
            .init(id: 1, title: "dev_device_info", outcome: "PetKit answered 704"),
        ]))
    }
    .environment(BlePreviewFixtures.session)
}
