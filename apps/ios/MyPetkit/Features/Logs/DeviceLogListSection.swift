import PetkitCore
import SwiftUI

/// The logs the devices uploaded, newest first. Turning collection on and
/// off lives on each device's settings, not here.
struct DeviceLogListSection: View {
    let model: LogsModel

    var body: some View {
        LoadableBlock(state: model.deviceLogs, retry: { Task { await model.loadDeviceLogs() } }, content: { listing in
            if let reason = listing.emptyReason, listing.files.isEmpty {
                Card { EmptyBlock(title: "No device logs", message: reason) }
            } else {
                SectionHeader(title: "Files") {
                    Text(ByteSize.format(listing.totalBytes)).font(Theme.Font.small).monospacedDigit()
                        .foregroundStyle(Theme.Color.muted)
                }
                if let reason = listing.emptyReason {
                    WarningPanel(text: reason)
                }
                RowsCard {
                    ForEach(Array(listing.files.enumerated()), id: \.element.id) { index, file in
                        if index > 0 { RowRule() }
                        NavigationLink(value: file) { row(file) }
                            .buttonStyle(.plain)
                    }
                }
            }
        })
    }

    private func row(_ file: DeviceLogFileRef) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "doc").foregroundStyle(Theme.Color.muted).accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(file.name).font(Theme.Font.mono).foregroundStyle(Theme.Color.text).lineLimit(1)
                Text(subtitle(file)).font(Theme.Font.extraSmall).monospacedDigit()
                    .foregroundStyle(Theme.Color.muted).lineLimit(1)
            }
            Spacer(minLength: 8)
            Image(systemName: "chevron.right").font(Theme.Font.chevron).foregroundStyle(Theme.Color.muted)
                .accessibilityHidden(true)
        }
        .frame(minHeight: Theme.Space.rowHeight)
        .contentShape(Rectangle())
    }

    private func subtitle(_ file: DeviceLogFileRef) -> String {
        let device = file.device.map(String.init) ?? "unknown device"
        let when = file.modified.formatted(.relative(presentation: .named))
        return "\(device) · \(ByteSize.format(file.size)) · \(when)"
    }
}
