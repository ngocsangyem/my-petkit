import Foundation
import Observation
import PetkitCore

/// Home's data: devices (each detail loaded after the list), accessories, pets
/// and today's sessions. Each block loads and fails on its own.
@MainActor
@Observable
final class HomeModel {
    /// Live event kinds that can change what Home shows.
    static let refreshKinds: Set<String> = ["event", "connect", "media"]

    private(set) var devices: Loadable<[DeviceRecord]> = .loading
    /// Details by device id; a card shows its summary until its detail arrives.
    private(set) var details: [Int: DeviceRecord] = [:]
    private(set) var accessories: Loadable<[BleAccessoryRecord]> = .loading
    private(set) var pets: Loadable<[HomePetRecord]> = .loading
    private(set) var sessions: Loadable<[TimelineSessionRecord]> = .loading
    /// True when the device list failed because the server did not answer at all.
    private(set) var unreachable = false

    @ObservationIgnored private var liveRefresh: Task<Void, Never>?

    init() {}

    /// A model already holding `devices` etc., for previews.
    init(devices: Loadable<[DeviceRecord]>, accessories: [BleAccessoryRecord] = [],
         pets: Loadable<[HomePetRecord]>, sessions: Loadable<[TimelineSessionRecord]>) {
        self.devices = devices
        for device in devices.value ?? [] { details[device.id] = device }
        self.accessories = .loaded(accessories)
        self.pets = pets
        self.sessions = sessions
    }

    /// The best record of each listed device: its detail once loaded.
    var shownDevices: [DeviceRecord] {
        (devices.value ?? []).map { details[$0.id] ?? $0 }
    }

    func day(now: Date) -> HouseholdDay {
        HouseholdDay(devices: shownDevices, accessories: accessories.value ?? [],
                     sessions: sessions.value ?? [], pets: pets.value ?? [], now: now)
    }

    /// Loads everything; `quietly` keeps what is on screen while it refreshes.
    func load(_ api: DevicesAPI, quietly: Bool = false) async {
        if !quietly {
            devices = .loading
            pets = .loading
            sessions = .loading
            accessories = .loading
        }
        async let devicesDone: Void = loadDevices(api)
        async let petsDone: Void = loadPets(api)
        async let sessionsDone: Void = loadSessions(api)
        async let accessoriesDone: Void = loadAccessories(api)
        _ = await (devicesDone, petsDone, sessionsDone, accessoriesDone)
    }

    func loadDevices(_ api: DevicesAPI) async {
        do {
            let list = try await api.devices()
            devices = .loaded(list)
            unreachable = false
            await withTaskGroup(of: DeviceRecord?.self) { group in
                for device in list {
                    group.addTask { try? await api.device(device.id) }
                }
                for await detail in group {
                    if let detail { details[detail.id] = detail }
                }
            }
        } catch {
            unreachable = Self.isUnreachable(error)
            devices = .failed(Loadable<Void>.message(for: error))
        }
    }

    func loadPets(_ api: DevicesAPI) async {
        do { pets = .loaded(try await api.pets()) } catch { pets = .failed(Loadable<Void>.message(for: error)) }
    }

    func loadSessions(_ api: DevicesAPI) async {
        do {
            sessions = .loaded(try await api.recentSessions())
        } catch {
            sessions = .failed("Could not load today's visits. \(Loadable<Void>.message(for: error))")
        }
    }

    func loadAccessories(_ api: DevicesAPI) async {
        do {
            accessories = .loaded(try await api.accessories())
        } catch {
            accessories = .failed(Loadable<Void>.message(for: error))
        }
    }

    /// Coalesces a burst of live events into one quiet refresh.
    func liveEvent(_ event: LiveEvent?, api: DevicesAPI) {
        guard let event, Self.refreshKinds.contains(event.kind) else { return }
        liveRefresh?.cancel()
        liveRefresh = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(400))
            guard !Task.isCancelled else { return }
            await self?.load(api, quietly: true)
        }
    }

    private static func isUnreachable(_ error: any Error) -> Bool {
        guard let url = error as? URLError else { return false }
        return [.notConnectedToInternet, .cannotConnectToHost, .timedOut, .networkConnectionLost, .cannotFindHost]
            .contains(url.code)
    }
}
