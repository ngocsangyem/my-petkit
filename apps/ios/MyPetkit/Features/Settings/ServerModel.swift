import Foundation
import Observation
import PetkitAPI
import PetkitCore

/// What the Server tab shows. Each block loads and fails on its own: the
/// server facts, the device figures, the client tokens.
@MainActor
@Observable
final class ServerModel {
    /// Facts from `/api/info` and `/api/retention` for the card and the rows.
    struct Facts: Equatable {
        var version: String
        var proxyMode: Bool
        var capture: Bool
        var guardsOn: Int
        /// The events and recordings age caps, for "Keep events and videos".
        var eventDays: Double?
        var videoDays: Double?
    }

    struct DeviceFigures: Equatable {
        var total: Int
        /// Devices that are offline: the ones that need a person to look.
        var needYou: Int
    }

    struct Token: Identifiable, Equatable {
        let id: Int
        let name: String
        let createdAt: Date
        let lastUsed: Date
    }

    let session: ServerSession
    var facts: Loadable<Facts> = .loading
    var devices: Loadable<DeviceFigures> = .loading
    var tokens: Loadable<[Token]> = .loading
    /// Patches recorded as applied across every device; nil until counted.
    var patchesApplied: Int?
    var tokenError: String?
    private var hasLoaded = false

    init(session: ServerSession) {
        self.session = session
    }

    func loadIfNeeded() async {
        guard !hasLoaded else { return }
        await load()
    }

    func load() async {
        hasLoaded = true
        async let facts: Void = loadFacts()
        async let devices: Void = loadDevices()
        async let tokens: Void = loadTokens()
        _ = await (facts, devices, tokens)
    }

    func loadFacts() async {
        do {
            let info = try await session.client.getServerInfo().ok.body.json
            let retention = try? await session.client.getRetention().ok.body.json.retention
            let settings = info.settings
            facts = .loaded(Facts(
                version: info.version,
                proxyMode: settings.proxyMode,
                capture: settings.capture,
                guardsOn: [settings.proxyBlockOta, settings.proxyBlockRunCmd, settings.proxyBlockLogUpload]
                    .filter { $0 }.count,
                eventDays: retention?.events.maxDays,
                videoDays: retention?.fullVideo.maxDays
            ))
        } catch {
            facts = .failed(Loadable<Facts>.message(for: error))
        }
    }

    func loadDevices() async {
        do {
            let list = try await session.client.listDevices().ok.body.json
            devices = .loaded(DeviceFigures(total: list.count, needYou: list.filter { !$0.online }.count))
            await countPatches(deviceIDs: list.map(\.id))
        } catch {
            devices = .failed(Loadable<DeviceFigures>.message(for: error))
        }
    }

    /// The count is only a hint on a row, so a device that fails to answer
    /// is skipped rather than failing the block.
    private func countPatches(deviceIDs: [Int]) async {
        var applied = 0
        for id in deviceIDs {
            guard let status = try? await session.client.getDevicePatcherStatus(path: .init(id: id)).ok.body.json,
                  status.supported
            else { continue }
            applied += status.patchers.additionalProperties.values.filter(\.applied).count
        }
        patchesApplied = applied
    }

    func loadTokens() async {
        do {
            let list = try await session.client.authListTokens().ok.body.json.tokens
            tokens = .loaded(list.map {
                Token(id: $0.id, name: $0.name,
                      createdAt: Date(timeIntervalSince1970: $0.createdAt),
                      lastUsed: Date(timeIntervalSince1970: $0.lastUsed))
            }
            .sorted { $0.lastUsed > $1.lastUsed })
        } catch {
            tokens = .failed(Loadable<[Token]>.message(for: error))
        }
    }

    func revoke(_ token: Token) async {
        tokenError = nil
        do {
            _ = try await session.call(purpose: "Revoking signs \(token.name) out of this server.") {
                try await self.session.client.authRevokeToken(path: .init(id: token.id)).ok
            }
            if case .loaded(let list) = tokens {
                tokens = .loaded(list.filter { $0.id != token.id })
            }
        } catch {
            tokenError = Loadable<Void>.message(for: error)
        }
    }

    var currentTokenID: Int { session.paired.tokenID }
}

#if DEBUG
extension ServerModel {
    static func preview() -> ServerModel {
        let model = ServerModel(session: ServerPreviewFixtures.session)
        model.hasLoaded = true
        model.facts = .loaded(Facts(version: "2.1.0", proxyMode: false, capture: false, guardsOn: 3,
                                    eventDays: 180, videoDays: 7))
        model.devices = .loaded(DeviceFigures(total: 4, needYou: 1))
        model.patchesApplied = 1
        let now = Date()
        model.tokens = .loaded([
            Token(id: 1, name: "iPhone", createdAt: now.addingTimeInterval(-86_400), lastUsed: now),
            Token(id: 2, name: "iPad", createdAt: now.addingTimeInterval(-864_000),
                  lastUsed: now.addingTimeInterval(-7_200)),
        ])
        return model
    }
}
#endif
