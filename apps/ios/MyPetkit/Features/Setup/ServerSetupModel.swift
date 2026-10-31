import Foundation
import Observation
import PetkitAPI
import PetkitCore

typealias SetupRetentionCaps = Components.Schemas.SetupRetention
typealias SetupBlockedAttempt = Components.Schemas.SetupBlockedAttempt

/// Server setup: live settings (guards, proxy, upstream), the blocked
/// attempts proxy mode recorded, and retention caps. Each block loads and
/// fails on its own; every `proxy_*` or `capture` write goes through step-up.
@MainActor
@Observable
final class ServerSetupModel {
    struct Settings: Equatable {
        var values: ServerLiveSettings
        var writable: Bool
        /// Upstream preset keys, the server's default first-class.
        var presets: [String]
        var defaultPreset: String
    }

    let session: ServerSession
    var settings: Loadable<Settings> = .loading
    var blocked: Loadable<[SetupBlockedAttempt]> = .loading
    var retention: Loadable<SetupRetentionCaps> = .loading
    /// Bytes the device logs use, the one "space used" the API reports.
    var deviceLogBytes: Int?
    /// The key being written, so its control waits instead of flickering.
    var saving: String?
    var settingError: String?
    /// Set once loading has started; previews set it to keep their fixture.
    var hasLoaded = false

    init(session: ServerSession) {
        self.session = session
    }

    func loadIfNeeded() async {
        guard !hasLoaded else { return }
        await load()
    }

    func load() async {
        hasLoaded = true
        async let settings: Void = loadSettings()
        async let blocked: Void = loadBlocked()
        async let retention: Void = loadRetention()
        _ = await (settings, blocked, retention)
    }

    func loadSettings() async {
        do {
            async let live = session.client.getLiveSettings().ok.body.json
            async let info = session.client.getServerInfo().ok.body.json
            let (current, facts) = try await (live, info)
            let preset = facts.upstreams.first(where: \._default)?.key ?? facts.upstreams.first?.key ?? ""
            settings = .loaded(Settings(values: current.settings, writable: current.writable,
                                        presets: facts.upstreams.map(\.key), defaultPreset: preset))
        } catch {
            settings = .failed(Loadable<Settings>.message(for: error))
        }
    }

    func loadBlocked() async {
        do {
            let body = try await session.client.listBlockedAttempts(query: .init(limit: SetupRules.blockedLimit))
                .ok.body.json
            blocked = .loaded(body.records)
        } catch {
            blocked = .failed(Loadable<[SetupBlockedAttempt]>.message(for: error))
        }
    }

    func loadRetention() async {
        do {
            retention = .loaded(try await session.client.getRetention().ok.body.json.retention)
        } catch {
            retention = .failed(Loadable<SetupRetentionCaps>.message(for: error))
        }
        deviceLogBytes = try? await session.client.listDeviceLogs().ok.body.json.totalBytes
    }

    // MARK: Writes

    func set(_ setting: BoolSetting, to value: Bool) async {
        await write(setting.patch(value), key: setting.wireKey, purpose: setting.purpose(turningOn: value))
    }

    func set(_ setting: TextSetting, to value: String) async {
        guard let current = settings.value else { return }
        let trimmed = setting == .only ? SetupRules.normalisedEndpointList(value)
            : value.trimmingCharacters(in: .whitespaces)
        guard SetupRules.isChange(key: setting.wireKey, saved: current.values[keyPath: setting.keyPath],
                                  edited: trimmed, defaultUpstream: current.defaultPreset)
        else { return }
        await write(setting.patch(trimmed), key: setting.wireKey,
                    purpose: L10n.string("Changing the \(setting.title.lowercased()) changes where device traffic goes."))
    }

    private func write(_ patch: ServerLiveSettingsPatch, key: String, purpose: String) async {
        saving = key
        settingError = nil
        defer { saving = nil }
        do {
            let session = self.session
            let send: @MainActor () async throws -> Operations.UpdateLiveSettings.Output.Ok.Body.JsonPayload = {
                try await session.client.updateLiveSettings(body: .json(patch)).ok.body.json
            }
            let result = SetupRules.needsStepUp(key)
                ? try await session.call(purpose: purpose, send)
                : try await send()
            if case .loaded(var current) = settings {
                current.values = result.settings
                settings = .loaded(current)
            }
        } catch {
            settingError = Loadable<Void>.message(for: error)
        }
    }

    /// Saves one category's caps (R1) and returns the server's message on refusal.
    func saveRetention(_ kind: RetentionKind, days: Double?, megabytes: Double?) async -> String? {
        let cap = Components.Schemas.SetupRetentionPatch.AdditionalPropertiesPayload(
            maxMb: kind.isSized ? megabytes : nil, maxDays: days)
        do {
            let body = try await session.client.updateRetention(
                body: .json(.init(additionalProperties: [kind.key: cap]))).ok.body.json
            retention = .loaded(body.retention)
            return nil
        } catch {
            return Loadable<Void>.message(for: error)
        }
    }
}

extension SetupRetentionCaps {
    func cap(for key: String) -> Components.Schemas.SetupRetentionCap? {
        switch key {
        case "fullVideo": fullVideo
        case "eventImage": eventImage
        case "highLight": highLight
        case "dynamicVideo": dynamicVideo
        case "cloudDouble": cloudDouble
        case "wasteCheck": wasteCheck
        case "healthPic": healthPic
        case "events": events
        case "blocked": blocked
        case "deviceLog": deviceLog
        case "rawUpload": rawUpload
        case "thumbnail": thumbnail
        default: nil
        }
    }
}
