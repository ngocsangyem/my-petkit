import Foundation
import Observation
import PetkitAPI

/// One sound the device can play.
struct DeviceSound: Identifiable, Equatable, Sendable {
    /// `settings.selectedSound` when nothing was chosen: the device's own sound.
    static let builtInID = -1

    /// The id `play`/`select` take; `builtInID` is the device's own sound.
    let id: Int
    let name: String
    /// Nil for the built-in sound.
    let size: Int?

    var isBuiltIn: Bool { size == nil }

    /// The device's own sound: what `selectedSound` -1, the default, means.
    static let builtIn = DeviceSound(id: builtInID, name: "Device sound", size: nil)
}

/// What the screen shows about the device itself.
struct SoundsDevice: Equatable, Sendable {
    let name: String
    let isFeeder: Bool
    /// `settings.selectedSound`; nil when the device holds none.
    let selectedSound: Int?
    let volume: SoundVolumeSetting?
    let language: SoundLanguageSetting?
}

/// Sounds on a device: the list (`listDeviceSounds`) and the device's own
/// settings (`getDevice`) load and fail on their own.
@MainActor
@Observable
final class SoundsModel {
    static let builtInID = DeviceSound.builtInID

    let deviceID: String
    var device: Loadable<SoundsDevice> = .loading
    var sounds: Loadable<[DeviceSound]> = .loading
    /// A refusal made before anything was sent (the upload limits).
    var uploadProblem: String?

    init(deviceID: String) {
        self.deviceID = deviceID
    }

    var numericID: Int? { Int(deviceID) }

    /// The list as shown: the device's own sound first, then uploads. A
    /// selected id that is neither is still listed, so the check mark has a row.
    var rows: [DeviceSound] {
        guard let uploads = sounds.value else { return [] }
        var rows = [DeviceSound.builtIn]
        if let selected = device.value?.selectedSound, selected != Self.builtInID,
           !uploads.contains(where: { $0.id == selected }) {
            rows.append(DeviceSound(id: selected, name: "Sound \(selected)", size: nil))
        }
        return rows + uploads
    }

    func isSelected(_ sound: DeviceSound) -> Bool {
        (device.value?.selectedSound ?? Self.builtInID) == sound.id
    }

    // MARK: Loading

    func load(using session: ServerSession) async {
        guard let id = numericID else {
            device = .failed("This device id is not one the server uses.")
            sounds = .failed("This device id is not one the server uses.")
            return
        }
        async let first: Void = loadDevice(id: id, session: session)
        async let second: Void = loadSounds(id: id, session: session)
        _ = await (first, second)
    }

    func loadDevice(using session: ServerSession) async {
        guard let id = numericID else { return }
        await loadDevice(id: id, session: session)
    }

    func loadSounds(using session: ServerSession) async {
        guard let id = numericID else { return }
        await loadSounds(id: id, session: session)
    }

    private func loadDevice(id: Int, session: ServerSession) async {
        if device.value == nil { device = .loading }
        do {
            let detail = try await session.client.getDevice(path: .init(id: id)).ok.body.json
            let entities = try detail.entities.map { try ScheduleJSON.converting($0) }
            let settings = try ScheduleJSON.converting(detail.settings)
            device = .loaded(SoundsDevice(
                name: detail.name, isFeeder: detail.isFeeder, selectedSound: settings["selectedSound"].int,
                volume: SoundSettings.volume(in: entities), language: SoundSettings.language(in: entities)
            ))
        } catch {
            device = .failed(Loadable<Void>.message(for: error))
        }
    }

    private func loadSounds(id: Int, session: ServerSession) async {
        if sounds.value == nil { sounds = .loading }
        do {
            let list = try await session.client.listDeviceSounds(path: .init(id: id)).ok.body.json.sounds
            sounds = .loaded(list.map {
                DeviceSound(id: $0.id, name: $0.name.isEmpty ? "Sound \($0.id)" : $0.name, size: $0.size)
            })
        } catch {
            sounds = .failed(Loadable<Void>.message(for: error))
        }
    }

    // MARK: Writes (each runs from a confirm sheet, which shows any refusal)

    func play(_ sound: DeviceSound, using session: ServerSession) async throws {
        let id = try requireID()
        _ = try await session.call(purpose: "Play \(sound.name) on the device.") {
            try await session.client.playDeviceSound(path: .init(id: id, soundId: sound.id)).ok.body.json.ok
        }
    }

    func select(_ sound: DeviceSound, using session: ServerSession) async throws {
        let id = try requireID()
        _ = try await session.call(purpose: "Make \(sound.name) the device's sound.") {
            try await session.client.selectDeviceSound(path: .init(id: id, soundId: sound.id)).ok.body.json.ok
        }
        await loadDevice(id: id, session: session)
    }

    func delete(_ sound: DeviceSound, using session: ServerSession) async throws {
        let id = try requireID()
        _ = try await session.call(purpose: "Delete \(sound.name).") {
            try await session.client.deleteDeviceSound(path: .init(id: id, soundId: sound.id)).ok.body.json.ok
        }
        await loadSounds(id: id, session: session)
    }

    func upload(_ file: SoundFile, using session: ServerSession) async throws {
        let id = try requireID()
        if let problem = SoundUploadPolicy.problem(existingCount: sounds.value?.count ?? 0,
                                                   byteCount: file.data.count, fileName: file.name) {
            throw APIError(status: 400, code: "sound_refused", message: problem)
        }
        _ = try await session.call(purpose: "Upload \(file.name) to the device.") {
            let part = Operations.UploadDeviceSound.Input.Body.MultipartFormPayload.file(
                .init(payload: .init(body: HTTPBody(file.data)), filename: file.name)
            )
            return try await session.client.uploadDeviceSound(
                path: .init(id: id), body: .multipartForm(MultipartBody([part]))
            ).ok.body.json.ok
        }
        await loadSounds(id: id, session: session)
    }

    /// Writes an entity the way the device's settings do (`sendDeviceCommand`).
    func setEntity(_ key: String, value: String, using session: ServerSession) async throws {
        let id = try requireID()
        let body = Components.Schemas.DeviceCommandRequest(entity: key, value: OpenAPIValueContainer(stringLiteral: value))
        _ = try await session.call(purpose: "Change a device setting.") {
            try await session.client.sendDeviceCommand(path: .init(id: id), body: .json(body)).ok
        }
        await loadDevice(id: id, session: session)
    }

    private func requireID() throws -> Int {
        guard let id = numericID else {
            throw APIError(status: 404, code: "bad_device", message: "This device id is not one the server uses.")
        }
        return id
    }
}

/// A file picked for upload, read before anything is sent.
struct SoundFile: Equatable, Sendable {
    let name: String
    let data: Data
}
