import PetkitCore
import SwiftUI

/// Pushes a device's detail from a Home card.
struct DeviceRoute: Hashable {
    let id: Int
}

/// Home (`ios-devices`, dark `ios-devices-dark`, states `ios-states`): the one
/// thing that needs you, cats first, then a card per device, then today's strip.
struct HomeView: View {
    @Environment(ServerSession.self) private var session
    @Environment(TabRouter.self) private var router
    @State private var model: HomeModel
    @State private var addingDevice = false
    private let loadsOnAppear: Bool

    init() {
        _model = State(initialValue: HomeModel())
        loadsOnAppear = true
    }

    /// A Home that shows `model` as it is and never calls the server (previews).
    init(model: HomeModel) {
        _model = State(initialValue: model)
        loadsOnAppear = false
    }

    var body: some View {
        SwiftUI.TimelineView(.everyMinute) { context in
            content(now: loadsOnAppear ? context.date : DevicePreviewFixtures.now)
        }
        .toolbar(.hidden, for: .navigationBar)
        .navigationDestination(for: DeviceRoute.self) { route in
            DeviceDetailView(deviceID: route.id)
        }
        .navigationDestination(isPresented: $addingDevice) { ProvisionView() }
        .task {
            guard loadsOnAppear else { return }
            await model.load(api)
        }
        .refreshable {
            guard loadsOnAppear else { return }
            await model.load(api, quietly: true)
        }
        .onChange(of: session.lastEvent) { _, event in
            guard loadsOnAppear else { return }
            model.liveEvent(event, api: api)
        }
    }

    private var api: DevicesAPI { DevicesAPI(session: session) }

    private func content(now: Date) -> some View {
        let day = model.day(now: now)
        return ScreenScroll {
            ScreenHeader(title: L10n.string("Home"), finding: finding(day: day, now: now)) {
                IconButton(systemImage: "plus", label: L10n.string("Add a device")) { addingDevice = true }
            }
        } content: {
            PetTiles(pets: model.pets, days: day.petDays) { Task { await model.loadPets(api) } }
            devices(day: day, now: now)
            TodayCard(sessions: model.sessions, day: day, now: now,
                      retry: { Task { await model.loadSessions(api) } },
                      openTimeline: { router.tab = .timeline })
        }
    }

    @ViewBuilder
    private func devices(day: HouseholdDay, now: Date) -> some View {
        let accessories = model.accessories.value ?? []
        SectionHeader(title: L10n.string("Devices")) {
            if let list = model.devices.value {
                Text("\(list.count + accessories.count)").foregroundStyle(Theme.Color.muted).monospacedDigit()
            }
        }
        switch model.devices {
        case .loading:
            DeviceGrid { DeviceCardPlaceholder(); DeviceCardPlaceholder() }
        case .failed(let message):
            if model.unreachable {
                UnreachableCard(server: session.serverName) { Task { await model.loadDevices(api) } }
            } else {
                BlockError(message: message) { Task { await model.loadDevices(api) } }
            }
        case .loaded(let list) where list.isEmpty && accessories.isEmpty:
            NoDevicesCard { addingDevice = true }
        case .loaded:
            DeviceGrid {
                ForEach(model.shownDevices) { device in
                    NavigationLink(value: DeviceRoute(id: device.id)) {
                        DeviceCard(device: device, zone: day.zones[device.id], now: now,
                                   nextMeal: day.nextMeal(device, now: now))
                    }
                    .buttonStyle(.plain)
                }
                ForEach(accessories) { accessory in
                    AccessoryCard(accessory: accessory, now: now)
                }
            }
            if case .failed(let message) = model.accessories {
                BlockError(message: L10n.string("Bluetooth accessories: \(message)")) {
                    Task { await model.loadAccessories(api) }
                }
            }
        }
    }

    /// The coloured sentence about the one thing that needs you, then the rest.
    private func finding(day: HouseholdDay, now: Date) -> Text? {
        guard let list = model.devices.value else { return nil }
        if list.isEmpty { return Text("No devices yet.").foregroundStyle(Theme.Color.text) }
        let findings = model.shownDevices.compactMap { device in
            DeviceFindings.attention(device, zone: day.zones[device.id], now: now).map { (device.name, $0) }
        }
        let summary = DeviceFindings.homeFinding(findings)
        let tail = Text(summary.tail).foregroundStyle(Theme.Color.text)
        guard let lead = summary.lead else { return tail }
        return Text(lead.text).foregroundStyle(lead.tone.color) + Text(" ") + tail
    }
}

#Preview("Home") {
    NavigationStack { HomeView(model: DevicePreviewFixtures.home) }
        .environment(ServerSession.preview)
        .environment(TabRouter())
}

#Preview("Home, dark") {
    NavigationStack { HomeView(model: DevicePreviewFixtures.home) }
        .environment(ServerSession.preview)
        .environment(TabRouter())
        .preferredColorScheme(.dark)
}

#Preview("Home, states") {
    NavigationStack {
        HomeView(model: HomeModel(devices: .loaded([]), pets: .loaded([]),
                                  sessions: .failed("Could not load today's visits. The server did not answer.")))
    }
    .environment(ServerSession.preview)
    .environment(TabRouter())
}
