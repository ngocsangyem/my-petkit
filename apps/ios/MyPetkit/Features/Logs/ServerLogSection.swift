import PetkitCore
import SwiftUI

/// The server's live log: filter, hide heartbeats, export, then the lines,
/// oldest first. Tapping a line shows its detail.
struct ServerLogSection: View {
    @Bindable var model: LogsModel

    var body: some View {
        LogFilterField(prompt: L10n.string("Filter lines, for example a device id"), text: $model.filter)
        toolbar
        if let error = model.exportError {
            Text(error).font(Theme.Font.small).foregroundStyle(Theme.Color.negative)
        }
        switch model.backfill {
        case .loading where model.session.recentEvents.isEmpty:
            LoadingBars(lines: 3, height: 240)
        case .failed(let message) where model.session.recentEvents.isEmpty:
            BlockError(message: message) { Task { await model.loadBackfill() } }
        default:
            lines
        }
    }

    private var toolbar: some View {
        HStack(spacing: 10) {
            Toggle(isOn: $model.hideHeartbeats) {
                HStack(spacing: 4) {
                    Text("Hide heartbeats").font(Theme.Font.body).foregroundStyle(Theme.Color.text)
                    if model.hiddenHeartbeats > 0 {
                        Text("· \(model.hiddenHeartbeats) hidden").font(Theme.Font.small)
                            .monospacedDigit().foregroundStyle(Theme.Color.muted)
                    }
                }
            }
            .toggleStyle(.switch)
            .tint(Theme.Color.text)
            .fixedSize()
            Spacer()
            if let exported = model.exported {
                ShareLink(item: exported.url) {
                    Image(systemName: "square.and.arrow.up").font(Theme.Font.icon)
                        .foregroundStyle(Theme.Color.text)
                        .frame(width: 40, height: 40)
                        .background(Theme.Color.surface, in: Circle())
                }
                .accessibilityLabel("Share the exported log")
            } else {
                IconButton(systemImage: "arrow.down.to.line", label: L10n.string("Export the visible lines")) {
                    model.exportVisible()
                }
            }
        }
        .padding(.horizontal, 4)
        .onChange(of: model.filter) { model.exported = nil }
        .onChange(of: model.hideHeartbeats) { model.exported = nil }
    }

    @ViewBuilder private var lines: some View {
        let events = model.visibleEvents
        if events.isEmpty {
            Card {
                EmptyBlock(title: model.filter.isEmpty ? L10n.string("No lines yet") : L10n.string("No line matches"),
                           message: model.filter.isEmpty
                               ? L10n.string("Lines appear here as devices talk to the server.")
                               : L10n.string("Nothing in the last \(ServerLogRules.limit) lines contains every word typed."))
            }
        } else {
            LazyVStack(alignment: .leading, spacing: 6) {
                ForEach(events) { event in
                    Button { model.toggle(event) } label: {
                        LogLineRow(
                            time: ServerLogRules.clock(event.date),
                            text: ServerLogRules.text(of: event),
                            level: ServerLogRules.level(of: event),
                            detail: model.expanded.contains(event.id) ? detailText(event.detail) : nil
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(EdgeInsets(top: 14, leading: 12, bottom: 14, trailing: 14))
            .background(Theme.Color.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
        }
    }

    /// The event's detail as indented JSON text; never rendered as markup.
    private func detailText(_ detail: JSONValue?) -> String {
        guard let detail, detail != .null else { return L10n.string("No detail.") }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        guard let data = try? encoder.encode(detail) else { return L10n.string("No detail.") }
        return String(bytes: data, encoding: .utf8) ?? ""
    }
}
