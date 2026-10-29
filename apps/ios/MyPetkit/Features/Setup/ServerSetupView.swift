import PetkitCore
import SwiftUI

/// Server setup, pushed from Server: what PetKit's cloud may do through this
/// server, how proxy mode reaches it, and how long recordings stay.
struct ServerSetupView: View {
    @Environment(ServerSession.self) private var session
    @State private var model: ServerSetupModel?

    var body: some View {
        Group {
            if let model {
                ServerSetupScreen(model: model)
            } else {
                Theme.Color.ground.ignoresSafeArea()
            }
        }
        .onAppear {
            if model == nil { model = ServerSetupModel(session: session) }
        }
    }
}

struct ServerSetupScreen: View {
    let model: ServerSetupModel
    @State private var editingText: TextSetting?
    @State private var pendingText: (TextSetting, String)?
    @State private var editingRetention: RetentionKind?

    var body: some View {
        ScreenScroll {
            PushedScreenHeader(title: "Cloud guards and data",
                               lede: "What PetKit's cloud may do through this server, and how long your recordings stay.")
        } content: {
            LoadableBlock(state: model.settings, loadingHeight: 160,
                          retry: { Task { await model.loadSettings() } }, content: { settings in
                if !settings.writable {
                    WarningPanel(text: "This server has no live settings file, so these settings are read-only.")
                }
                if let error = model.settingError {
                    Text(error).font(Theme.Font.small).foregroundStyle(Theme.Color.negative)
                }
                guardsSection(settings)
                ProxySection(model: model, settings: settings, editingText: $editingText)
            })
            RetentionSection(model: model, editing: $editingRetention)
        }
        .refreshable { await model.load() }
        .task { await model.loadIfNeeded() }
        .toolbar(.hidden, for: .navigationBar)
        .privacyShielded()
        // A text setting is written after its sheet closes: the step-up screen
        // is presented by the root and cannot appear over a sheet.
        .sheet(item: $editingText, onDismiss: savePendingText) { setting in
            TextSettingSheet(
                setting: setting,
                initial: model.settings.value?.values[keyPath: setting.keyPath] ?? "",
                presets: model.settings.value?.presets ?? []
            ) { pendingText = (setting, $0) }
        }
        .sheet(item: $editingRetention) { kind in
            RetentionEditSheet(kind: kind, cap: model.retention.value?.cap(for: kind.key)) { days, megabytes in
                await model.saveRetention(kind, days: days, megabytes: megabytes)
            }
        }
    }

    private func savePendingText() {
        guard let (setting, value) = pendingText else { return }
        pendingText = nil
        Task { await model.set(setting, to: value) }
    }

    @ViewBuilder private func guardsSection(_ settings: ServerSetupModel.Settings) -> some View {
        let on = BoolSetting.guards.filter { settings.values[keyPath: $0.keyPath] }.count
        SectionHeader(title: "Cloud guards") {
            Text(on == BoolSetting.guards.count ? "All on" : "\(on) of \(BoolSetting.guards.count) on")
                .font(Theme.Font.small)
                .foregroundStyle(on == BoolSetting.guards.count ? Theme.Color.positive : Theme.Color.negative)
        }
        .accessibilityAddTraits(.isHeader)
        RowsCard {
            ForEach(Array(BoolSetting.guards.enumerated()), id: \.element) { index, setting in
                if index > 0 { RowRule() }
                SettingToggleRow(title: setting.title, footnote: setting.footnote,
                                 isOn: binding(setting), isBusy: busy(settings))
            }
        }
        WarningPanel(text: "Turning a guard off asks for your password, and applies only while proxy mode is on.")
    }

    private func binding(_ setting: BoolSetting) -> Binding<Bool> {
        Binding(
            get: { model.settings.value?.values[keyPath: setting.keyPath] ?? false },
            set: { value in Task { await model.set(setting, to: value) } }
        )
    }

    private func busy(_ settings: ServerSetupModel.Settings) -> Bool {
        model.saving != nil || !settings.writable
    }
}

/// Proxy mode: forwarding, region and upstream, the extra proxy options and
/// the attempts the guards blocked.
private struct ProxySection: View {
    let model: ServerSetupModel
    let settings: ServerSetupModel.Settings
    @Binding var editingText: TextSetting?

    var body: some View {
        SectionHeader("Proxy mode").accessibilityAddTraits(.isHeader)
        RowsCard {
            toggle(.proxyMode)
            RowRule()
            regionMenu
            RowRule()
            textRow(.dns, value: settings.values.proxyDns.isEmpty ? "System" : settings.values.proxyDns)
            RowRule()
            textRow(.only, value: settings.values.proxyOnly.isEmpty ? "Everything" : settings.values.proxyOnly)
            ForEach(BoolSetting.proxyOptions) { setting in
                RowRule()
                toggle(setting)
            }
            RowRule()
            NavigationLink { BlockedAttemptsView(model: model) } label: {
                SettingsRow(title: "Blocked attempts", value: blockedText)
            }
            .buttonStyle(.plain)
        }
    }

    private var blockedText: String {
        switch model.blocked {
        case .loading: "—"
        case .failed: "Not loaded"
        case .loaded(let records): "\(SetupRules.blockedThisWeek(records.map(\.createdAt))) this week"
        }
    }

    private func toggle(_ setting: BoolSetting) -> some View {
        SettingToggleRow(
            title: setting.title, footnote: setting.footnote,
            isOn: Binding(
                get: { model.settings.value?.values[keyPath: setting.keyPath] ?? false },
                set: { value in Task { await model.set(setting, to: value) } }
            ),
            isBusy: model.saving != nil || !settings.writable
        )
    }

    private var regionMenu: some View {
        Menu {
            ForEach(settings.presets, id: \.self) { preset in
                Button(SetupRules.regionName(preset) + (preset == settings.defaultPreset ? " (default)" : "")) {
                    Task { await model.set(.upstream, to: preset) }
                }
            }
            Button("Custom URL…") { editingText = .upstream }
        } label: {
            SettingsRow(title: "Region",
                        value: SetupRules.upstreamLabel(settings.values.proxyUpstream,
                                                        defaultPreset: settings.defaultPreset))
        }
        .buttonStyle(.plain)
        .disabled(model.saving != nil || !settings.writable)
        .accessibilityHint("Changing it asks for your password")
    }

    private func textRow(_ setting: TextSetting, value: String) -> some View {
        Button { editingText = setting } label: {
            SettingsRow(title: setting.title, value: value)
        }
        .buttonStyle(.plain)
        .disabled(model.saving != nil || !settings.writable)
    }
}
