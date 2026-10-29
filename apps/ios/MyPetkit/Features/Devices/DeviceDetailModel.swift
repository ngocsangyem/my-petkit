import Foundation
import Observation
import PetkitAPI
import PetkitCore

/// A device's detail and its settings blocks. Each block loads and fails on
/// its own; every write reloads the device so the screen shows what the
/// server holds rather than what was asked for.
@MainActor
@Observable
final class DeviceDetailModel {
    typealias Capabilities = Components.Schemas.DeviceCapabilityFlags

    let deviceID: Int
    private(set) var device: Loadable<DeviceRecord> = .loading
    private(set) var sessions: Loadable<[TimelineSessionRecord]> = .loading
    private(set) var timezone: Loadable<TimezoneInfo> = .loading
    private(set) var aiEnabled: Loadable<Bool> = .loading
    private(set) var capabilities: Loadable<Capabilities> = .loading
    private(set) var logSettings: Loadable<(enabled: Bool, reason: String)> = .loading
    /// "Last: Scoop · Sent over MQTT", after a command went through.
    private(set) var lastCommand: String?
    /// A refused settings write, in the server's words, under its block.
    var settingsError: String?

    init(deviceID: Int) {
        self.deviceID = deviceID
    }

    /// A model already holding `device`, for previews.
    init(device: DeviceRecord, sessions: [TimelineSessionRecord]) {
        deviceID = device.id
        self.device = .loaded(device)
        self.sessions = .loaded(sessions)
        timezone = device.timezoneInfo.map(Loadable.loaded) ?? .failed("No timezone yet.")
        aiEnabled = .loaded(true)
        capabilities = .loaded(Capabilities(fullVideo: true, eventImage: true, highLight: false, dynamicVideo: true))
        logSettings = .loaded((false, ""))
    }

    func load(_ session: ServerSession, quietly: Bool = false) async {
        if !quietly { device = .loading }
        await loadDevice(session)
        guard device.value != nil else { return }
        async let sessionsDone: Void = loadSessions(session)
        async let timezoneDone: Void = loadTimezone(session)
        async let logsDone: Void = loadLogSettings(session)
        async let aiDone: Void = loadAI(session)
        async let capabilitiesDone: Void = loadCapabilities(session)
        _ = await (sessionsDone, timezoneDone, logsDone, aiDone, capabilitiesDone)
    }

    func loadDevice(_ session: ServerSession) async {
        do { device = .loaded(try await DevicesAPI(session: session).device(deviceID)) } catch {
            device = .failed(Loadable<Void>.message(for: error))
        }
    }

    func loadSessions(_ session: ServerSession) async {
        do { sessions = .loaded(try await DevicesAPI(session: session).recentSessions(device: deviceID)) } catch {
            sessions = .failed("Could not load today's activity. \(Loadable<Void>.message(for: error))")
        }
    }

    func loadTimezone(_ session: ServerSession) async {
        do {
            let view = try await session.client.getDeviceTimezone(path: .init(id: deviceID)).ok.body.json
            timezone = .loaded(TimezoneInfo(effective: view.effective, override: view.override, reported: view.reported,
                                            locale: view.locale, source: view.source.rawValue))
        } catch {
            timezone = .failed(Loadable<Void>.message(for: error))
        }
    }

    /// Only a device with on-device AI has the block.
    func loadAI(_ session: ServerSession) async {
        guard device.value?.supportsAi == true else { return }
        do {
            aiEnabled = .loaded(try await session.client.getDeviceAi(path: .init(id: deviceID)).ok.body.json.aiEnabled)
        } catch {
            aiEnabled = .failed(Loadable<Void>.message(for: error))
        }
    }

    /// Only a camera has media capabilities.
    func loadCapabilities(_ session: ServerSession) async {
        guard device.value?.isCamera == true else { return }
        do {
            capabilities = .loaded(try await session.client.getDeviceCapabilities(path: .init(id: deviceID))
                .ok.body.json.capabilities)
        } catch {
            capabilities = .failed(Loadable<Void>.message(for: error))
        }
    }

    func loadLogSettings(_ session: ServerSession) async {
        do {
            let settings = try await session.client.getDeviceLogSettings(path: .init(id: deviceID)).ok.body.json
            logSettings = .loaded((settings.logUploadEnabled, settings.reason))
        } catch {
            logSettings = .failed(Loadable<Void>.message(for: error))
        }
    }

    // MARK: Writes

    /// A named action (R2). Throws the refusal for the confirm sheet to show.
    func run(_ action: DeviceAction, session: ServerSession) async throws {
        let id = deviceID
        let said = try await session.call(purpose: "Send \(action.name) to the device") {
            try await DevicesAPI(session: session).runAction(id, action: action.key)
        }
        lastCommand = "Last: \(action.name) · \(said)"
        await loadDevice(session)
    }

    /// An entity write (R2).
    func set(_ entity: DeviceEntity, to value: String, session: ServerSession) async throws {
        let id = deviceID
        let said = try await session.call(purpose: "Change \(entity.name) on the device") {
            try await DevicesAPI(session: session).setEntity(id, entity: entity.key, value: value)
        }
        lastCommand = "\(entity.name) · \(said)"
        await loadDevice(session)
    }

    /// The fixed UTC offset override (R2); nil hands the device back to what it reported.
    func setTimezone(_ offset: Double?, session: ServerSession) async throws {
        let id = deviceID
        let said = try await session.call(purpose: "Change the device's timezone") {
            try await DevicesAPI(session: session).setTimezone(id, offset: offset)
        }
        lastCommand = "Timezone · \(said)"
        await loadTimezone(session)
        await loadDevice(session)
    }

    func setAI(_ on: Bool, session: ServerSession) async {
        await write(session, purpose: "Change pet recognition") {
            _ = try await session.client.setDeviceAi(path: .init(id: self.deviceID), body: .json(.init(aiEnabled: on))).ok
        }
        await loadAI(session)
    }

    func setCapability(_ flag: CapabilityFlag, _ on: Bool, session: ServerSession) async {
        var request = Components.Schemas.DeviceCapabilitiesRequest()
        switch flag {
        case .fullVideo: request.fullVideo = on
        case .eventImage: request.eventImage = on
        case .highLight: request.highLight = on
        case .dynamicVideo: request.dynamicVideo = on
        }
        await write(session, purpose: "Change what the camera uploads") {
            _ = try await session.client.setDeviceCapabilities(path: .init(id: self.deviceID), body: .json(request)).ok
        }
        await loadCapabilities(session)
    }

    func setLogUpload(_ on: Bool, session: ServerSession) async {
        await write(session, purpose: "Change debug log collection") {
            _ = try await session.client.setDeviceLogSettings(
                path: .init(id: self.deviceID), body: .json(.init(logUploadEnabled: on))).ok
        }
        await loadLogSettings(session)
    }

    /// Removes the device from the registry. Throws the refusal.
    func delete(session: ServerSession) async throws {
        let id = deviceID
        _ = try await session.call(purpose: "Remove this device") {
            try await session.client.deleteDevice(path: .init(id: id)).ok
        }
    }

    private func write(_ session: ServerSession, purpose: String,
                       _ operation: @escaping @MainActor () async throws -> Void) async {
        settingsError = nil
        do { try await session.call(purpose: purpose, operation) } catch {
            settingsError = Loadable<Void>.message(for: error)
        }
    }
}

/// The media upload switches of a camera, as the owner reads them.
enum CapabilityFlag: CaseIterable, Identifiable {
    case fullVideo, eventImage, highLight, dynamicVideo

    var id: Self { self }

    var label: String {
        switch self {
        case .fullVideo: "Recordings"
        case .eventImage: "Snapshots"
        case .highLight: "Highlights"
        case .dynamicVideo: "Motion clips"
        }
    }

    func isOn(_ flags: Components.Schemas.DeviceCapabilityFlags) -> Bool {
        switch self {
        case .fullVideo: flags.fullVideo
        case .eventImage: flags.eventImage
        case .highLight: flags.highLight
        case .dynamicVideo: flags.dynamicVideo
        }
    }
}
