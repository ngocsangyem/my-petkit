import PetkitAPI
import PetkitCore
import SwiftUI

/// Pairing an accessory by hand. The parent never discovers accessories: it
/// asks the server for a list of MACs and scans for exactly those, so the MAC
/// and the pairing secret have to be typed here (or imported from the cloud).
struct BlePairSheet: View {
    @Environment(ServerSession.self) private var session
    @Environment(\.dismiss) private var dismiss
    let model: BleAccessoriesModel
    let onImport: () -> Void

    @State private var draft = BlePairDraft()
    @State private var problem: BlePairDraft.Problem?
    @State private var serverError: String?
    @State private var busy = false
    @State private var showsAdvanced = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Space.gap) {
                header
                routeCard
                fieldsCard
                optionsCard
                if let serverError {
                    Text(serverError).font(Theme.Font.small).foregroundStyle(Theme.Color.negative)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.horizontal, 4)
                }
                Button(action: submit) {
                    if busy { ProgressView().tint(Theme.Color.onPrimary) } else { Text("Pair") }
                }
                .buttonStyle(.primary)
                .disabled(busy || model.parentID == nil)
                Text("Import asks PetKit's cloud once, signed as the \(parentWord), for accessories you already paired there.")
                    .font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
                    .multilineTextAlignment(.center).frame(maxWidth: .infinity)
            }
            .padding(.horizontal, Theme.Space.screenEdge)
            .padding(.bottom, Theme.Space.pad)
        }
        .background(Theme.Color.ground.ignoresSafeArea())
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(Theme.Radius.sheetTop)
        .interactiveDismissDisabled(busy)
    }

    private var parentWord: String { model.parent?.isLitterBox == true ? L10n.string("litter box") : L10n.string("device") }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                IconButton(systemImage: "xmark", label: L10n.string("Close")) { dismiss() }
                Spacer()
            }
            .frame(minHeight: Theme.Space.control)
            Text("Pair an accessory").font(Theme.Font.title).foregroundStyle(Theme.Color.text)
                .accessibilityAddTraits(.isHeader)
            Text("It talks to the server through the **\(model.parent?.name ?? parentWord)**, which must stay on and nearby.")
                .font(Theme.Font.body).foregroundStyle(Theme.Color.lede)
        }
        .padding(.horizontal, 4)
        .padding(.top, 16)
        .padding(.bottom, 4)
    }

    private var routeCard: some View {
        Card {
            HStack(spacing: 14) {
                DeviceDrawing(kind: model.parent?.isLitterBox == true ? .litterBox : .unknown, height: 48)
                    .frame(width: 56)
                Image(systemName: "dot.radiowaves.left.and.right").font(Theme.Font.icon)
                    .foregroundStyle(Theme.Color.accent)
                DeviceDrawing(kind: draft.type.drawing, height: 48).frame(width: 56)
                Spacer(minLength: 0)
                Button("Import from cloud", action: onImport)
                    .font(Theme.Font.control.weight(.semibold))
                    .foregroundStyle(Theme.Color.text)
                    .padding(.horizontal, 14)
                    .frame(height: 40)
                    .background(Theme.Color.ground, in: Capsule())
                    .buttonStyle(.plain)
            }
            .accessibilityElement(children: .contain)
        }
    }

    private var fieldsCard: some View {
        Card {
            VStack(alignment: .leading, spacing: 6) {
                Text("Type").font(Theme.Font.small).foregroundStyle(Theme.Color.muted).padding(.leading, 4)
                BleChipFlow(spacing: 8) {
                    ForEach(BleAccessoryType.allCases) { type in
                        BleTypeChip(title: type.chipTitle, isSelected: draft.type == type) { draft.type = type }
                    }
                }
            }
            LabeledField(label: L10n.string("MAC address"),
                         footnote: problem == .mac ? BlePairDraft.Problem.mac.message : nil) {
                TextField("AA:BB:CC:DD:EE:FF", text: $draft.mac)
                    .font(Theme.Font.monoMedium)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .keyboardType(.asciiCapable)
            }
            LabeledField(label: L10n.string("Secret"),
                         footnote: L10n.string("From PetKit's app. A factory-fresh accessory accepts eight zero bytes.")) {
                SecureField("Optional", text: $draft.secret)
                    .textInputAutocapitalization(.never).autocorrectionDisabled()
            }
            LabeledField(label: L10n.string("Serial number")) {
                TextField("Optional", text: $draft.serialNumber)
                    .textInputAutocapitalization(.never).autocorrectionDisabled()
            }
        }
    }

    private var optionsCard: some View {
        Card(padding: 0) {
            VStack(alignment: .leading, spacing: 0) {
                if draft.type.isSpray {
                    Toggle(isOn: $draft.linkK3) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Link to this \(parentWord)").font(Theme.Font.body)
                            Text("The K3 sprays after the box cleans.").font(Theme.Font.extraSmall)
                                .foregroundStyle(Theme.Color.muted)
                        }
                    }
                    .tint(Theme.Color.text)
                    .frame(minHeight: Theme.Space.rowHeight)
                    RowRule()
                }
                numberRow(title: L10n.string("Report interval"), unit: "s", text: $draft.interval,
                          placeholder: String(BlePairDraft.defaultInterval), problem: .interval)
                RowRule()
                DisclosureGroup(isExpanded: $showsAdvanced) {
                    VStack(alignment: .leading, spacing: 0) {
                        numberRow(title: L10n.string("Scan type"), unit: nil, text: $draft.scanType,
                                  placeholder: L10n.string("Default"), problem: .scanType)
                        Text("""
                            Change this first if the \(draft.type.noun) never reports. \
                            Only some types have a captured value; the others are a guess.
                            """)
                            .font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
                            .padding(.bottom, 8)
                        RowRule()
                        numberRow(title: L10n.string("Accessory id"), unit: nil, text: $draft.accessoryID,
                                  placeholder: L10n.string("Server assigns"), problem: .accessoryID)
                    }
                } label: {
                    Text("Advanced").font(Theme.Font.body).foregroundStyle(Theme.Color.text)
                        .frame(minHeight: Theme.Space.rowHeight)
                }
                .tint(Theme.Color.muted)
            }
            .padding(.horizontal, Theme.Space.pad)
            .padding(.vertical, 4)
        }
    }

    private func numberRow(title: String, unit: String?, text: Binding<String>, placeholder: String,
                           problem rowProblem: BlePairDraft.Problem) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 8) {
                Text(title).font(Theme.Font.body)
                Spacer(minLength: 8)
                TextField(placeholder, text: text)
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing)
                    .font(Theme.Font.body).foregroundStyle(Theme.Color.muted).monospacedDigit()
                    .frame(maxWidth: 140)
                    .accessibilityLabel(title)
                if let unit { Text(unit).font(Theme.Font.body).foregroundStyle(Theme.Color.muted) }
            }
            .frame(minHeight: Theme.Space.rowHeight)
            if problem == rowProblem {
                Text(rowProblem.message).font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.negative)
                    .padding(.bottom, 8)
            }
        }
    }

    private func submit() {
        guard let parentID = model.parentID else { return }
        serverError = nil
        switch draft.request(parentID: parentID) {
        case .failure(let found):
            problem = found
            if found == .scanType || found == .accessoryID { showsAdvanced = true }
        case .success(let request):
            problem = nil
            busy = true
            Task {
                defer { busy = false }
                do {
                    try await model.pair(request, session: session)
                    dismiss()
                } catch {
                    // A 400 names the bad type or MAC, a 409 the id or MAC
                    // already taken: the server's own sentence says which.
                    serverError = Loadable<Void>.message(for: error)
                }
            }
        }
    }
}

/// A type chip on a white card: `raised` when not selected, ink when selected.
struct BleTypeChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(Theme.Font.control)
                .lineLimit(1)
                .padding(.horizontal, 14)
                .frame(height: Theme.Space.chip)
                .foregroundStyle(isSelected ? Theme.Color.onPrimary : Theme.Color.text)
                .background(isSelected ? Theme.Color.text : Theme.Color.raised, in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

/// Lays chips left to right and wraps them onto new lines.
struct BleChipFlow: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = arrange(width: proposal.width ?? .infinity, subviews: subviews)
        let height = rows.map(\.height).reduce(0, +) + spacing * CGFloat(max(rows.count - 1, 0))
        let width = rows.map(\.width).max() ?? 0
        return CGSize(width: proposal.width ?? width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for row in arrange(width: bounds.width, subviews: subviews) {
            var x = bounds.minX
            for index in row.indices {
                let size = subviews[index].sizeThatFits(.unspecified)
                subviews[index].place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
                x += size.width + spacing
            }
            y += row.height + spacing
        }
    }

    private struct Row {
        var indices: [Int] = []
        var width: CGFloat = 0
        var height: CGFloat = 0
    }

    private func arrange(width: CGFloat, subviews: Subviews) -> [Row] {
        var rows: [Row] = [Row()]
        for index in subviews.indices {
            let size = subviews[index].sizeThatFits(.unspecified)
            let last = rows[rows.count - 1]
            let needed = last.indices.isEmpty ? size.width : last.width + spacing + size.width
            if needed > width, !last.indices.isEmpty {
                rows.append(Row(indices: [index], width: size.width, height: size.height))
            } else {
                rows[rows.count - 1].indices.append(index)
                rows[rows.count - 1].width = needed
                rows[rows.count - 1].height = max(last.height, size.height)
            }
        }
        return rows
    }
}

#Preview("Pair") {
    BlePairSheet(model: BlePreviewFixtures.model(), onImport: {})
        .environment(BlePreviewFixtures.session)
}
