import Observation
import PetkitAPI
import PetkitCore
import SwiftUI

/// One device log: a server-side grep over the whole file, read a window at
/// a time, and the raw file to share (which needs a fresh step-up).
@MainActor
@Observable
final class DeviceLogFileModel {
    let session: ServerSession
    let file: DeviceLogFileRef
    var query = ""
    var offset = 0
    var window: Loadable<DeviceLogWindow> = .loading
    /// The grep the current window answers, so an unchanged query is not re-read.
    var loadedQuery: String?
    var download: SharedFile?
    var downloading = false
    var downloadError: String?

    init(session: ServerSession, file: DeviceLogFileRef) {
        self.session = session
        self.file = file
    }

    func load() async {
        do {
            let data = try await session.rawGET(
                segments: ["api", "devicelogs"] + DeviceLogRules.segments(of: file.rel),
                query: [
                    URLQueryItem(name: "q", value: query.trimmingCharacters(in: .whitespaces)),
                    URLQueryItem(name: "offset", value: "\(offset)"),
                    URLQueryItem(name: "limit", value: "\(DeviceLogRules.pageSize)"),
                ]
            )
            window = .loaded(try JSONDecoder().decode(DeviceLogWindow.self, from: data))
            loadedQuery = query
        } catch {
            // A newer keystroke cancelled this read; its own read follows.
            if Task.isCancelled { return }
            window = .failed(Loadable<DeviceLogWindow>.message(for: error))
        }
    }

    func fetchRawFile() async {
        downloading = true
        downloadError = nil
        defer { downloading = false }
        do {
            let segments = ["api", "devicelogs"] + DeviceLogRules.segments(of: file.rel)
            let data = try await session.call(purpose: L10n.string("Downloading the raw log shows everything the device wrote.")) {
                try await self.session.rawGET(segments: segments, query: [URLQueryItem(name: "download", value: "1")])
            }
            download = try SharedFile.write(data, named: file.name)
        } catch {
            downloadError = Loadable<Void>.message(for: error)
        }
    }
}

struct DeviceLogFileView: View {
    @Environment(ServerSession.self) private var session
    let file: DeviceLogFileRef
    @State private var model: DeviceLogFileModel?

    var body: some View {
        Group {
            if let model {
                DeviceLogFileScreen(model: model)
            } else {
                Theme.Color.ground.ignoresSafeArea()
            }
        }
        .onAppear {
            if model == nil { model = DeviceLogFileModel(session: session, file: file) }
        }
    }
}

struct DeviceLogFileScreen: View {
    @Bindable var model: DeviceLogFileModel

    var body: some View {
        ScreenScroll {
            PushedScreenHeader(title: model.file.name, lede: lede) { downloadButton }
        } content: {
            LogFilterField(prompt: L10n.string("Grep, for example error"), text: $model.query)
            if let error = model.downloadError {
                Text(error).font(Theme.Font.small).foregroundStyle(Theme.Color.negative)
            }
            LoadableBlock(state: model.window, loadingHeight: 240, retry: { Task { await model.load() } }, content: { window in
                lines(window)
            })
        }
        .toolbar(.hidden, for: .navigationBar)
        // Grep runs on the server; a short pause keeps a fast typist to one request.
        .task(id: model.query) {
            guard model.loadedQuery != model.query else { return }
            try? await Task.sleep(for: .milliseconds(300))
            guard !Task.isCancelled else { return }
            model.offset = 0
            await model.load()
        }
        .onDisappear { SharedFile.removeAll() }
    }

    private var lede: String {
        let device = model.file.device.map(String.init) ?? L10n.string("Unknown device")
        return "\(device) · \(ByteSize.format(model.file.size))"
    }

    @ViewBuilder private var downloadButton: some View {
        if let download = model.download {
            ShareLink(item: download.url) {
                Image(systemName: "square.and.arrow.up").font(Theme.Font.icon).foregroundStyle(Theme.Color.text)
                    .frame(width: Theme.Space.control, height: Theme.Space.control)
                    .background(Theme.Color.surface, in: Circle())
            }
            .accessibilityLabel("Share the raw log")
        } else if model.downloading {
            ProgressView().frame(width: Theme.Space.control, height: Theme.Space.control)
        } else {
            IconButton(systemImage: "arrow.down.to.line", label: L10n.string("Download the raw log")) {
                Task { await model.fetchRawFile() }
            }
        }
    }

    @ViewBuilder private func lines(_ window: DeviceLogWindow) -> some View {
        Text("\(window.matched) of \(window.total) lines match")
            .font(Theme.Font.small).monospacedDigit().foregroundStyle(Theme.Color.muted).padding(.horizontal, 4)
        if window.lines.isEmpty {
            Card { EmptyBlock(title: L10n.string("No line matches"), message: L10n.string("Every word typed must appear in a line.")) }
        } else {
            LazyVStack(alignment: .leading, spacing: 4) {
                ForEach(window.lines) { line in
                    LogLineRow(time: String(line.number), text: line.text, level: .info)
                }
            }
            .padding(EdgeInsets(top: 14, leading: 12, bottom: 14, trailing: 14))
            .background(Theme.Color.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
            HStack(spacing: Theme.Space.gap) {
                Button("Earlier") { page(-1) }.buttonStyle(.secondary).disabled(!window.hasEarlier)
                Button("Later") { page(1) }.buttonStyle(.secondary).disabled(!window.hasLater)
            }
        }
    }

    private func page(_ direction: Int) {
        model.offset = max(0, model.offset + direction * DeviceLogRules.pageSize)
        model.window = .loading
        Task { await model.load() }
    }
}

#if DEBUG
#Preview("Device log") {
    let model = DeviceLogFileModel(
        session: ServerPreviewFixtures.session,
        file: DeviceLogFileRef(rel: "100234567/devRun.log", name: "devRun.log", device: 100_234_567,
                               size: 184_320, modified: .now)
    )
    model.window = .loaded(DeviceLogWindow(
        lines: [.init(number: 41, text: "[net] mqtt connect ok keepalive=62"),
                .init(number: 42, text: "[ota] check skipped: no url")],
        total: 1_204, matched: 2, offset: 0, limit: 500))
    model.loadedQuery = ""
    return NavigationStack { DeviceLogFileScreen(model: model) }
        .environment(ServerPreviewFixtures.session)
}
#endif
