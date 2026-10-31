import PetkitCore
import SwiftUI

/// Log, pushed from Server: the server's live log or the devices' own logs.
struct LogsView: View {
    enum Segment: Hashable { case server, device }

    @Environment(ServerSession.self) private var session
    let segment: Segment
    @State private var model: LogsModel?

    var body: some View {
        Group {
            if let model {
                LogsScreen(model: model, segment: segment)
            } else {
                Theme.Color.ground.ignoresSafeArea()
            }
        }
        .onAppear {
            if model == nil { model = LogsModel(session: session) }
        }
    }
}

struct LogsScreen: View {
    @Environment(ServerSession.self) private var session
    @Bindable var model: LogsModel
    @State var segment: LogsView.Segment

    var body: some View {
        ScreenScroll {
            PushedScreenHeader(title: L10n.string("Log")) { livePill }
        } content: {
            SegmentedPills(options: [(.server, L10n.string("Server")), (.device, L10n.string("Device logs"))], selection: $segment)
            switch segment {
            case .server: ServerLogSection(model: model)
            case .device: DeviceLogListSection(model: model)
            }
        }
        .refreshable {
            switch segment {
            case .server: await model.loadBackfill()
            case .device: await model.loadDeviceLogs()
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .navigationDestination(for: DeviceLogFileRef.self) { DeviceLogFileView(file: $0) }
        .task(id: segment) {
            switch segment {
            case .server: if model.backfill.value == nil { await model.loadBackfill() }
            case .device: if model.deviceLogs.value == nil { await model.loadDeviceLogs() }
            }
        }
        .onDisappear { SharedFile.removeAll() }
    }

    @ViewBuilder private var livePill: some View {
        if session.connection == .live {
            Pill(text: L10n.string("Live"), tone: .positive)
        } else {
            Pill(text: L10n.string("Reconnecting"))
        }
    }
}

/// The search field on white used by both log views.
struct LogFilterField: View {
    let prompt: String
    @Binding var text: String

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass").foregroundStyle(Theme.Color.muted).accessibilityHidden(true)
            TextField(prompt, text: $text)
                .font(Theme.Font.body)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.search)
            if !text.isEmpty {
                Button { text = "" } label: {
                    Image(systemName: "xmark.circle.fill").foregroundStyle(Theme.Color.muted)
                }
                .accessibilityLabel("Clear filter")
            }
        }
        .padding(.horizontal, 14)
        .frame(minHeight: Theme.Space.field)
        .background(Theme.Color.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.panel))
    }
}

/// One mono log line with its 2pt level edge (never a row fill).
struct LogLineRow: View {
    let time: String?
    let text: String
    let level: LogLevel
    var detail: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            (Text(time.map { "\($0)  " } ?? "").foregroundColor(Theme.Color.muted)
                + Text(text).foregroundColor(Theme.Color.text))
                .font(Theme.Font.mono)
                .fixedSize(horizontal: false, vertical: true)
                .textSelection(.enabled)
            if let detail {
                Text(detail).font(Theme.Font.mono).foregroundStyle(Theme.Color.lede)
                    .fixedSize(horizontal: false, vertical: true)
                    .textSelection(.enabled)
            }
        }
        .padding(.vertical, 6)
        .padding(.leading, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .leading) {
            Rectangle().fill(edge).frame(width: 2)
        }
        .accessibilityElement(children: .combine)
        .accessibilityHint(level == .info ? "" : (level == .error ? L10n.string("Error") : L10n.string("Warning")))
    }

    private var edge: Color {
        switch level {
        case .info: Theme.Color.toggleOff
        case .warning: Theme.Color.chart3
        case .error: Theme.Color.negative
        }
    }
}

#if DEBUG
#Preview("Log") {
    NavigationStack {
        LogsScreen(model: .preview(), segment: .server)
    }
    .environment(ServerPreviewFixtures.session)
}

#Preview("Device logs") {
    NavigationStack {
        LogsScreen(model: .preview(), segment: .device)
    }
    .environment(ServerPreviewFixtures.session)
}
#endif
