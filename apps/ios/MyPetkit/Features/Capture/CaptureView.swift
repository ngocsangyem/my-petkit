import PetkitCore
import SwiftUI

/// Capture, pushed from Server: a warning, the record switch, the files with
/// their sizes, the last lines of one file, and delete.
struct CaptureView: View {
    @Environment(ServerSession.self) private var session
    @State private var model: CaptureModel?

    var body: some View {
        Group {
            if let model {
                CaptureScreen(model: model)
            } else {
                Theme.Color.ground.ignoresSafeArea()
            }
        }
        .onAppear {
            if model == nil { model = CaptureModel(session: session) }
        }
    }
}

struct CaptureScreen: View {
    let model: CaptureModel
    @State private var confirmDelete: [String]?

    var body: some View {
        ScreenScroll {
            PushedScreenHeader(title: L10n.string("Capture"), lede: lede) { StepUpPill() }
        } content: {
            WarningPanel(text: L10n.string("""
                Captures are exact copies of traffic. They hold your Wi-Fi name, device secrets and, \
                in proxy mode, cloud credentials. Read one before you share it.
                """))
            if let error = model.error {
                Text(error).font(Theme.Font.small).foregroundStyle(Theme.Color.negative)
            }
            LoadableBlock(state: model.listing, retry: { Task { await model.load() } }, content: { listing in
                RowsCard {
                    SettingToggleRow(
                        title: L10n.string("Record traffic"), footnote: L10n.string("Turning on asks for your password."),
                        isOn: Binding(get: { listing.recording },
                                      set: { value in Task { await model.setRecording(value) } }),
                        isBusy: model.savingRecord)
                }
                SectionHeader(title: L10n.string("Files")) {
                    Text(ByteSize.format(listing.totalBytes)).font(Theme.Font.small).monospacedDigit()
                        .foregroundStyle(Theme.Color.muted)
                }
                .accessibilityAddTraits(.isHeader)
                if listing.files.isEmpty {
                    Card { EmptyBlock(title: L10n.string("No captures"), message: L10n.string("Files appear here while recording is on.")) }
                } else {
                    CaptureFilesCard(model: model, files: listing.files) { confirmDelete = [$0] }
                    tailSection
                    RowsCard {
                        Button { confirmDelete = listing.files.map(\.name) } label: {
                            SettingsRow(title: L10n.string("Delete all captures"), isDestructive: true)
                        }
                        .buttonStyle(.plain)
                    }
                }
            })
        }
        .refreshable { await model.load() }
        .task { await model.loadIfNeeded() }
        .toolbar(.hidden, for: .navigationBar)
        .privacyShielded()
        .onDisappear { SharedFile.removeAll() }
        .confirmationDialog(
            deleteTitle,
            isPresented: Binding(get: { confirmDelete != nil }, set: { if !$0 { confirmDelete = nil } }),
            titleVisibility: .visible,
            presenting: confirmDelete
        ) { names in
            Button("Delete", role: .destructive) { Task { await model.delete(names) } }
        } message: { _ in
            Text("There is no other copy on the server.")
        }
    }

    private var lede: String? {
        model.listing.value.map { CaptureRules.summary(recording: $0.recording, fileCount: $0.files.count) }
    }

    private var deleteTitle: String {
        guard let names = confirmDelete else { return L10n.string("Delete?") }
        return names.count == 1 ? L10n.string("Delete \(names[0])?") : L10n.string("Delete all \(names.count) captures?")
    }

    @ViewBuilder private var tailSection: some View {
        if let tail = model.tail {
            switch tail {
            case .loading: LoadingBars(lines: 0, height: 96)
            case .failed(let message):
                BlockError(message: message) {
                    if let name = model.tailName { Task { await model.showTail(of: name) } }
                }
            case .loaded(let value):
                SectionHeader(L10n.string("Last lines of \(value.name)")).accessibilityAddTraits(.isHeader)
                ScrollView(.horizontal) {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(Array(value.lines.enumerated()), id: \.offset) { _, line in
                            Text(line).font(Theme.Font.mono).foregroundStyle(Theme.Color.text)
                                .lineLimit(1).fixedSize().textSelection(.enabled)
                        }
                        if value.lines.isEmpty {
                            Text("The file is empty.").font(Theme.Font.small).foregroundStyle(Theme.Color.muted)
                        }
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.Color.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
            }
        }
    }
}

/// The capture files: tap one to read its last lines; the trailing button
/// downloads it (step-up) and then becomes the share button.
private struct CaptureFilesCard: View {
    let model: CaptureModel
    let files: [CaptureModel.File]
    let delete: (String) -> Void

    var body: some View {
        RowsCard {
            ForEach(Array(files.enumerated()), id: \.element.id) { index, file in
                if index > 0 { RowRule() }
                row(file)
            }
        }
    }

    private func row(_ file: CaptureModel.File) -> some View {
        HStack(spacing: 12) {
            Button { Task { await model.showTail(of: file.name) } } label: {
                HStack(spacing: 12) {
                    Image(systemName: "doc").foregroundStyle(Theme.Color.muted).accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(file.name).font(Theme.Font.monoMedium).foregroundStyle(Theme.Color.text).lineLimit(1)
                        Text(subtitle(file)).font(Theme.Font.extraSmall).monospacedDigit()
                            .foregroundStyle(Theme.Color.muted).lineLimit(1)
                    }
                    Spacer(minLength: 8)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityHint("Shows its last lines")
            .contextMenu {
                Button("Delete \(file.name)", systemImage: "trash", role: .destructive) { delete(file.name) }
            }
            trailing(file)
        }
        .frame(minHeight: Theme.Space.rowHeight)
    }

    @ViewBuilder private func trailing(_ file: CaptureModel.File) -> some View {
        if let shared = model.downloads[file.name] {
            ShareLink(item: shared.url) {
                Image(systemName: "square.and.arrow.up").foregroundStyle(Theme.Color.text)
                    .frame(width: Theme.Space.control, height: Theme.Space.control)
            }
            .accessibilityLabel("Share \(file.name)")
        } else if model.downloading == file.name {
            ProgressView().frame(width: Theme.Space.control, height: Theme.Space.control)
        } else {
            Button { Task { await model.download(file) } } label: {
                Image(systemName: "arrow.down.to.line").foregroundStyle(Theme.Color.muted)
                    .frame(width: Theme.Space.control, height: Theme.Space.control)
            }
            .disabled(model.downloading != nil)
            .accessibilityLabel("Download \(file.name)")
        }
    }

    private func subtitle(_ file: CaptureModel.File) -> String {
        let parts = [ByteSize.format(file.size), L10n.string("\(file.lines) lines"), CaptureRules.describe(file.name)]
        return parts.compactMap { $0 }.joined(separator: " · ")
    }
}

#if DEBUG
#Preview("Capture") {
    let model = CaptureModel(session: ServerPreviewFixtures.session)
    model.hasLoaded = true
    model.listing = .loaded(.init(files: [
        .init(name: "requests.jsonl", size: 2_516_582, lines: 4_120),
        .init(name: "mqtt.jsonl", size: 6_396_313, lines: 11_204),
        .init(name: "state_report.jsonl", size: 901_120, lines: 812),
    ], recording: false))
    model.tail = .loaded(.init(name: "requests.jsonl", lines: [
        #"{"dev":"100198342","m":"POST","path":"/6/t6/dev_heartbeat","ts":1761720374}"#,
        #"{"dev":"100234567","m":"POST","path":"/6/t6/dev_state_report","ts":1761720333}"#,
    ], total: 4_120))
    return NavigationStack { CaptureScreen(model: model) }
        .environment(ServerPreviewFixtures.session)
}
#endif
