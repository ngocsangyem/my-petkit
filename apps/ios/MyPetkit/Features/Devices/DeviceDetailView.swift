import PetkitCore
import SwiftUI

/// A device's detail, pushed from its Home card: litter box (`ios-device-t6`,
/// paused `ios-device-t6-paused`), feeder (`ios-device-feeder`), fountain
/// (`ios-device-fountain`, including offline); other models use the feeder's
/// layout. Every block below the hero appears only when the API has it.
struct DeviceDetailView: View {
    @Environment(ServerSession.self) private var session
    @Environment(\.dismiss) private var dismiss
    @State private var model: DeviceDetailModel
    @State private var sheet: DetailSheet?
    private let loadsOnAppear: Bool

    init(deviceID: Int) {
        _model = State(initialValue: DeviceDetailModel(deviceID: deviceID))
        loadsOnAppear = true
    }

    /// A detail showing `model` as it is, never calling the server (previews).
    init(model: DeviceDetailModel) {
        _model = State(initialValue: model)
        loadsOnAppear = false
    }

    var body: some View {
        SwiftUI.TimelineView(.periodic(from: .now, by: 15)) { context in
            let now = loadsOnAppear ? context.date : DevicePreviewFixtures.now
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Space.gap) {
                    topBar(now: now)
                    LoadableBlock(state: model.device, loadingHeight: 280, retry: reload) { device in
                        sections(device, now: now)
                    }
                }
                .padding(.horizontal, Theme.Space.screenEdge)
                .padding(.bottom, Theme.Space.pad)
            }
            .background(Theme.Color.ground.ignoresSafeArea())
        }
        .toolbar(.hidden, for: .navigationBar)
        .task {
            guard loadsOnAppear else { return }
            await model.load(session)
        }
        .refreshable {
            guard loadsOnAppear else { return }
            await model.load(session, quietly: true)
        }
        .onChange(of: session.lastEvent) { _, event in
            guard loadsOnAppear, let event, event.deviceID == String(model.deviceID) || event.kind == "connect"
            else { return }
            Task {
                await model.loadDevice(session)
                await model.loadAutomation(session)
            }
        }
        .sheet(item: $sheet) { sheet in
            switch sheet {
            case .confirm(let confirmation):
                ConfirmCommandSheet(confirmation: confirmation)
            case .timezone(let info):
                TimezoneSheet(info: info) { offset in
                    self.sheet = .confirm(timezoneConfirmation(offset))
                }
            case .more(let actions):
                MoreActionsSheet(actions: actions) { action in
                    self.sheet = .confirm(actionConfirmation(action))
                }
            case .forceContinue(let info):
                ForceContinueSheet(info: info) { [model, session] in
                    try await model.forceContinue(session: session)
                }
            case .pickNumber(let entity):
                let title = EntityGroups.automationLabels[entity.key]?.title ?? entity.name
                NumberPickerSheet(entity: entity, title: title) { value in
                    guard let device = model.device.value else { return }
                    self.sheet = .confirm(entityConfirmation(device, entity, .number(value)))
                }
            }
        }
    }

    private func reload() { Task { await model.load(session) } }

    private func topBar(now: Date) -> some View {
        HStack {
            IconButton(systemImage: "chevron.left", label: L10n.string("Back")) { dismiss() }
            Spacer()
            if let device = model.device.value {
                HStack(spacing: 0) {
                    StatusMark(status: DeviceFacts.status(device))
                    if let age = statusAge(device, now: now) {
                        Text(" · \(age)").font(Theme.Font.small).monospacedDigit().foregroundStyle(Theme.Color.muted)
                    }
                }
            }
        }
        .padding(.top, 8)
    }

    private func statusAge(_ device: DeviceRecord, now: Date) -> String? {
        guard let last = DeviceFacts.lastReport(device) else { return nil }
        if !device.online {
            let zone = DeviceFacts.zone(device.timezoneInfo)
            return L10n.string("no report since \(DeviceFindings.since(last, zone: zone, now: now))")
        }
        return L10n.string("\(DeviceFindings.duration(now.timeIntervalSince(last))) ago")
    }

    @ViewBuilder
    private func sections(_ device: DeviceRecord, now: Date) -> some View {
        let zone = DeviceFacts.zone(device.timezoneInfo)
        let meals = zone.map { FeedPlan.todaysMeals(device.schedules, zone: $0, now: now) } ?? []
        let nextMeal = zone.flatMap { FeedPlan.next(meals, after: DayStripLayout.minuteOfDay(now, in: $0)) }
        let today = DeviceToday(sessions: model.sessions.value ?? [], zone: zone, now: now)
        DeviceHeroCard(
            device: device,
            sentence: DeviceFindings.sentence(device, zone: zone, now: now, nextMeal: nextMeal),
            commands: CommandLayout(actions: device.actions, family: DeviceFamily(deviceType: device.type),
                                    paused: DeviceFindings.pause(device) != nil),
            lastCommand: model.lastCommand,
            ask: { sheet = .confirm(actionConfirmation($0)) },
            showMore: { sheet = .more($0) },
            continueCleaning: continueCleaning
        )
        if device.isCamera {
            LiveEntryCard(device: device)
        }
        let figures = DeviceFigures.figures(device, visitsToday: model.sessions.value.map { _ in today.visits })
        if !figures.isEmpty {
            Card(padding: 8) {
                FigureGrid(figures: figures)
                if !device.online, let last = DeviceFacts.lastReport(device) {
                    Text("Values from the last report at \(DeviceFindings.since(last, zone: zone, now: now)).")
                        .font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted).padding(.horizontal, 8)
                }
            }
        }
        DeviceTodayCard(device: device, sessions: model.sessions, today: today, meals: meals, zone: zone, now: now,
                        retry: { Task { await model.loadSessions(session) } })
        ConsumablesCard(rows: ConsumableRow.rows(device))
        LitterAutomationSection(model: model, device: device, now: now,
                                askEntity: { sheet = .confirm(entityConfirmation(device, $0, $1)) },
                                confirm: { sheet = .confirm($0) },
                                pickEntity: { sheet = .pickNumber($0) })
        EntityControlsCard(title: L10n.string("Settings"), entities: EntityGroups(device).controls, enabled: device.online,
                           ask: { sheet = .confirm(entityConfirmation(device, $0, $1)) })
        if device.supportsAi {
            AICard(enabled: model.aiEnabled, entities: EntityGroups(device).aiControls, deviceOnline: device.online,
                   setAI: { on in Task { await model.setAI(on, session: session) } },
                   ask: { sheet = .confirm(entityConfirmation(device, $0, $1)) },
                   retry: { Task { await model.loadAI(session) } })
        }
        if device.isCamera {
            CapabilitiesCard(capabilities: model.capabilities,
                             set: { flag, on in Task { await model.setCapability(flag, on, session: session) } },
                             retry: { Task { await model.loadCapabilities(session) } })
        }
        DeviceSettingsCard(device: device, timezone: model.timezone, logSettings: model.logSettings,
                           editTimezone: { sheet = .timezone($0) },
                           setLogUpload: { on in Task { await model.setLogUpload(on, session: session) } },
                           retry: {
                               Task {
                                   await model.loadTimezone(session)
                                   await model.loadLogSettings(session)
                               }
                           })
        if let error = model.settingsError {
            WarningPanel(text: error)
        }
        if DeviceFacts.relaysBluetooth(type: device.type) {
            BleAccessoriesSection(parentDeviceID: String(device.id))
        }
        RemoveDeviceCard(device: device) {
            try await model.delete(session: session)
            dismiss()
        }
    }

    /// The paused hero's one command, only while the server offers it.
    private var continueCleaning: (() -> Void)? {
        guard ForceContinueRules.isOffered(model.automation.value) else { return nil }
        return { startForceContinue() }
    }

    /// Password first, then the sheet with the guards read again.
    private func startForceContinue() {
        Task {
            guard await model.prepareForceContinue(session: session) else { return }
            switch model.automation {
            case .loaded(let automation): sheet = .forceContinue(automation.forceContinue)
            case .failed(let message): model.settingsError = message
            case .loading: break
            }
        }
    }

    // MARK: Confirmations

    private var route: String {
        guard let device = model.device.value else { return "" }
        return device.mqttConnected
            ? L10n.string("It is on MQTT, so it runs now.")
            : L10n.string("It is not on MQTT, so it waits for its next heartbeat, about 10 seconds.")
    }

    private var noun: String {
        model.device.value.map { DeviceFamily(deviceType: $0.type).noun } ?? L10n.string("device")
    }

    private func actionConfirmation(_ action: DeviceAction) -> CommandConfirmation {
        let undo = action.destructive ? L10n.string(" The device acts on it at once and it cannot be called back.") : ""
        return CommandConfirmation(
            question: L10n.string("\(action.name) on the \(noun)?"),
            detail: L10n.string("This sends \u{201C}\(action.name)\u{201D} to the \(noun). \(route)\(undo)"),
            confirmTitle: action.name
        ) { [model, session] in
            try await model.run(action, session: session)
        }
    }

    private func entityConfirmation(_ device: DeviceRecord, _ entity: DeviceEntity, _ value: EntityWrite) -> CommandConfirmation {
        CommandConfirmation(
            question: value.question(entity),
            detail: L10n.string("This changes the setting on the \(noun). \(route)"),
            confirmTitle: value.confirmTitle
        ) { [model, session] in
            try await model.set(entity, to: value.wire, session: session)
        }
    }

    private func timezoneConfirmation(_ offset: Double?) -> CommandConfirmation {
        let target = offset.map(DeviceFacts.offsetLabel) ?? L10n.string("automatic")
        return CommandConfirmation(
            question: L10n.string("Set the \(noun)'s timezone to \(target)?"),
            detail: L10n.string("Its days, schedules and video timestamps move to this zone. \(route)"),
            confirmTitle: L10n.string("Set timezone")
        ) { [model, session] in
            try await model.setTimezone(offset, session: session)
        }
    }
}

/// The one sheet a detail shows at a time; swapping the case swaps the sheet.
enum DetailSheet: Identifiable {
    case confirm(CommandConfirmation)
    case timezone(TimezoneInfo)
    case more([DeviceAction])
    case forceContinue(ForceContinueInfo)
    case pickNumber(DeviceEntity)

    var id: String {
        switch self {
        case .confirm(let confirmation): "confirm-\(confirmation.id)"
        case .timezone: "timezone"
        case .more: "more"
        case .forceContinue: "force-continue"
        case .pickNumber(let entity): "pick-\(entity.key)"
        }
    }
}

#Preview("Litter box") {
    NavigationStack {
        DeviceDetailView(model: DeviceDetailModel(device: DevicePreviewFixtures.litterBox,
                                                  sessions: DevicePreviewFixtures.sessions,
                                                  automation: DevicePreviewFixtures.autoPackOn))
    }
    .environment(ServerSession.preview)
}

#Preview("Litter box, paused") {
    NavigationStack {
        DeviceDetailView(model: DeviceDetailModel(device: DevicePreviewFixtures.pausedLitterBox, sessions: [],
                                                  automation: DevicePreviewFixtures.pausedOffered))
    }
    .environment(ServerSession.preview)
}

#Preview("Litter box, paused and refused") {
    NavigationStack {
        DeviceDetailView(model: DeviceDetailModel(device: DevicePreviewFixtures.pausedLitterBox, sessions: [],
                                                  automation: DevicePreviewFixtures.pausedRefused))
    }
    .environment(ServerSession.preview)
}

#Preview("Feeder") {
    NavigationStack {
        DeviceDetailView(model: DeviceDetailModel(device: DevicePreviewFixtures.feeder,
                                                  sessions: DevicePreviewFixtures.sessions))
    }
    .environment(ServerSession.preview)
}

#Preview("Fountain, offline") {
    NavigationStack {
        DeviceDetailView(model: DeviceDetailModel(device: DevicePreviewFixtures.fountain, sessions: []))
    }
    .environment(ServerSession.preview)
    .preferredColorScheme(.dark)
}
