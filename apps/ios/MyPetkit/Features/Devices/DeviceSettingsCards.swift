import PetkitCore
import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

/// The device's own settings: timezone, schedules, sounds, debug logs and the
/// stream address, as grouped rows.
struct DeviceSettingsCard: View {
    let device: DeviceRecord
    let timezone: Loadable<TimezoneInfo>
    let logSettings: Loadable<(enabled: Bool, reason: String)>
    let editTimezone: (TimezoneInfo) -> Void
    let setLogUpload: (Bool) -> Void
    let retry: () -> Void

    /// Why debug-log collection cannot work, from the server's `reason`.
    static var logReasons: [String: String] {
        [
            "no_log_root": L10n.string("No log directory is configured on the server."),
            "no_bucket_endpoint": L10n.string("This server has no bucket address, so there is nowhere to send the device."),
            "authority_not_splittable": L10n.string("The bucket address needs a dotted name or an IP the device can use."),
        ]
    }

    var body: some View {
        SectionHeader(L10n.string("Device"))
        Card(padding: 0) {
            VStack(spacing: 0) {
                timezoneRow
                if !device.schedules.isEmpty {
                    RowRule()
                    NavigationLink { SchedulesView(deviceID: String(device.id)) } label: {
                        SettingsRow(title: L10n.string("Schedules"), value: "\(device.schedules.count)")
                    }
                    .buttonStyle(.plain)
                }
                if DeviceFacts.hasSounds(device) {
                    RowRule()
                    NavigationLink { SoundsView(deviceID: String(device.id)) } label: { SettingsRow(title: L10n.string("Sounds")) }
                        .buttonStyle(.plain)
                }
                RowRule()
                logRow
                ForEach(streams, id: \.0) { name, url in
                    RowRule()
                    StreamRow(name: name, url: url)
                }
            }
            .padding(.horizontal, 16)
        }
    }

    @ViewBuilder
    private var timezoneRow: some View {
        switch timezone {
        case .loading:
            SettingsRow(title: L10n.string("Timezone"), value: "…", showsChevron: false)
        case .failed(let message):
            BlockError(message: message, retry: retry).padding(.vertical, 12)
        case .loaded(let info):
            Button { editTimezone(info) } label: {
                SettingsRow(title: L10n.string("Timezone"), value: DeviceFacts.zoneLabel(info))
            }
            .buttonStyle(.plain)
            .disabled(!device.online)
        }
    }

    @ViewBuilder
    private var logRow: some View {
        switch logSettings {
        case .loading:
            SettingsRow(title: L10n.string("Collect debug logs"), value: "…", showsChevron: false)
        case .failed(let message):
            BlockError(message: message, retry: retry).padding(.vertical, 12)
        case .loaded(let settings):
            Toggle(isOn: Binding(get: { settings.enabled }, set: setLogUpload)) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Collect debug logs").font(Theme.Font.body)
                    Text(settings.reason.isEmpty
                         ? L10n.string("The firmware's own log, uploaded here when the device decides to send one.")
                         : L10n.string("Cannot collect right now. \(Self.logReasons[settings.reason] ?? settings.reason)"))
                        .font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
                }
            }
            .tint(Theme.Color.text)
            .frame(minHeight: Theme.Space.rowHeight)
            .padding(.vertical, 6)
        }
    }

    /// Stream addresses the server confirmed; the go2rtc one first.
    private var streams: [(String, String)] {
        let camera = L10n.string("Camera stream")
        return device.streams.compactMap { key, value in
            guard case .string(let url) = value, !url.isEmpty else { return nil }
            return (key == "rtsp" ? camera : key, url)
        }
        .sorted { ($0.0 == camera ? 0 : 1, $0.0) < ($1.0 == camera ? 0 : 1, $1.0) }
    }
}

/// A stream address with Copy: too long to select by hand, and the one thing
/// on this screen pasted elsewhere (Home Assistant, VLC).
private struct StreamRow: View {
    let name: String
    let url: String
    @State private var copied = false

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(name).font(Theme.Font.body)
                Text(url).font(Theme.Font.mono).foregroundStyle(Theme.Color.muted).lineLimit(1).truncationMode(.middle)
            }
            Spacer(minLength: 8)
            Button(copied ? L10n.string("Copied") : L10n.string("Copy")) {
                #if canImport(UIKit)
                UIPasteboard.general.string = url
                #endif
                copied = true
            }
            .font(Theme.Font.control.weight(.semibold)).foregroundStyle(Theme.Color.accent)
            .accessibilityLabel("Copy \(name) address")
        }
        .frame(minHeight: Theme.Space.rowHeight)
        .padding(.vertical, 4)
    }
}

/// Picks the timezone override. Sending it asks again, like every command.
struct TimezoneSheet: View {
    @Environment(\.dismiss) private var dismiss
    let info: TimezoneInfo
    let choose: (Double?) -> Void
    @State private var automatic: Bool
    @State private var offset: Double

    static var sources: [String: String] {
        [
            "override": L10n.string("the override set here"),
            "locale": L10n.string("the zone name the device reported"),
            "device": L10n.string("the offset the device reported"),
            "server": L10n.string("this server's clock"),
        ]
    }

    init(info: TimezoneInfo, choose: @escaping (Double?) -> Void) {
        self.info = info
        self.choose = choose
        _automatic = State(initialValue: info.override == nil)
        _offset = State(initialValue: info.override ?? info.effective)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Timezone").font(Theme.Font.section).accessibilityAddTraits(.isHeader)
            Text(L10n.string("""
                Now \(DeviceFacts.zoneLabel(info)), from \(Self.sources[info.source] ?? info.source). \
                The device has no clock of its own; this sets its day, schedules and video timestamps.
                """))
                .font(Theme.Font.body).foregroundStyle(Theme.Color.lede).fixedSize(horizontal: false, vertical: true)
            Panel {
                Toggle("Automatic", isOn: $automatic).font(Theme.Font.body).tint(Theme.Color.text)
                if !automatic {
                    Stepper(value: $offset, in: -12...14, step: 0.25) {
                        Text(DeviceFacts.offsetLabel(offset)).font(Theme.Font.figureInRow).monospacedDigit()
                    }
                }
            }
            Button("Continue") {
                let chosen = automatic ? nil : offset
                choose(chosen)
            }
            .buttonStyle(.primary)
            .disabled(automatic && info.override == nil || !automatic && offset == info.override)
            Button("Cancel") { dismiss() }
                .font(Theme.Font.button).foregroundStyle(Theme.Color.text)
                .frame(maxWidth: .infinity, minHeight: Theme.Space.control)
        }
        .padding(.horizontal, 20)
        .padding(.top, 24)
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(Theme.Radius.sheetTop)
        .presentationBackground(Theme.Color.surface)
    }
}

/// The device's id, then removal as red text at the end, with a confirmation.
struct RemoveDeviceCard: View {
    let device: DeviceRecord
    let remove: @MainActor () async throws -> Void
    @State private var asking = false
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        Card(padding: 0) {
            VStack(spacing: 0) {
                HStack {
                    Text("Device ID").font(Theme.Font.body)
                    Spacer()
                    Text(String(device.id)).font(Theme.Font.mono).foregroundStyle(Theme.Color.muted).textSelection(.enabled)
                }
                .frame(minHeight: Theme.Space.rowHeight)
                RowRule()
                Button { asking = true } label: {
                    SettingsRow(title: busy ? L10n.string("Removing…") : L10n.string("Remove device"), isDestructive: true)
                }
                .buttonStyle(.plain)
                .disabled(busy)
                if let error {
                    Text(error).font(Theme.Font.small).foregroundStyle(Theme.Color.negative)
                        .frame(maxWidth: .infinity, alignment: .leading).padding(.bottom, 12)
                }
            }
            .padding(.horizontal, 16)
        }
        .confirmationDialog("Remove \(device.name)?", isPresented: $asking, titleVisibility: .visible) {
            Button("Remove device", role: .destructive) { run() }
        } message: {
            Text("It leaves this app and Home Assistant. If it checks in again it comes back as a new device.")
        }
    }

    private func run() {
        busy = true
        error = nil
        Task {
            defer { busy = false }
            do { try await remove() } catch { self.error = Loadable<Void>.message(for: error) }
        }
    }
}

#Preview("Timezone") {
    TimezoneSheet(info: DevicePreviewFixtures.saigon) { _ in }
}

#Preview("Device settings") {
    NavigationStack {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                DeviceSettingsCard(device: DevicePreviewFixtures.litterBox, timezone: .loaded(DevicePreviewFixtures.saigon),
                                   logSettings: .loaded((false, "no_bucket_endpoint")),
                                   editTimezone: { _ in }, setLogUpload: { _ in }, retry: {})
                RemoveDeviceCard(device: DevicePreviewFixtures.litterBox) {}
            }
            .padding()
        }
        .background(Theme.Color.ground)
    }
}
