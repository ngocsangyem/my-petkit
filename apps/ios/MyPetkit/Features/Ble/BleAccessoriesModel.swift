import Foundation
import Observation
import PetkitAPI

/// The parent device as far as the accessory screens need it.
struct BleParentInfo: Equatable {
    let name: String
    let isLitterBox: Bool
    let onMQTT: Bool
}

/// The outcome of an import, kept to show under the warning that preceded it.
struct BleImportOutcome: Equatable {
    struct Line: Identifiable, Equatable {
        let id: Int
        let title: String
        let outcome: String
    }

    let imported: Int
    let lines: [Line]
}

/// Accessories relaying through one parent device, and every write to them.
/// Each write answers with the full list, so the list is replaced from the
/// reply instead of being fetched again.
@MainActor
@Observable
final class BleAccessoriesModel {
    /// The server's litter box codenames; a K3 is linked only to one of these.
    static let litterBoxTypes: Set<String> = ["t3", "t4", "t5", "t6", "t7"]

    let parentID: Int?
    private(set) var accessories: Loadable<[BleAccessory]>
    private(set) var parent: BleParentInfo?
    /// The last thing the server said after an unpair, shown on the section.
    var notice: String?

    init(parentDeviceID: String, accessories: Loadable<[BleAccessory]> = .loading, parent: BleParentInfo? = nil) {
        parentID = Int(parentDeviceID.trimmingCharacters(in: .whitespaces))
        self.accessories = parentID == nil ? .failed(L10n.string("This device id is not a number.")) : accessories
        self.parent = parent
    }

    // MARK: Reading

    /// Accessories this parent relays for.
    var relayed: [BleAccessory] {
        guard let parentID else { return [] }
        return (accessories.value ?? []).filter { $0.linkWith == parentID }
    }

    /// K3 sprays linked to no device: offered here only when this parent is
    /// a litter box, the one place a K3 can be linked.
    var unlinkedSprays: [BleAccessory] {
        guard parent?.isLitterBox == true else { return [] }
        return (accessories.value ?? []).filter { $0.linkWith == 0 && $0.bleType == .k3 }
    }

    func accessory(id: Int) -> BleAccessory? {
        accessories.value?.first { $0.petkitId == id }
    }

    /// Whether a live event is about this parent or one of its accessories.
    func concerns(deviceID: String?) -> Bool {
        guard let deviceID, let id = Int(deviceID) else { return false }
        return id == parentID || (accessories.value ?? []).contains { $0.petkitId == id }
    }

    /// Loads the list, and the parent once. `quiet` keeps what is shown while
    /// a live event refreshes it, so the block does not flash.
    func load(session: ServerSession, quiet: Bool = false) async {
        guard let parentID else { return }
        if !quiet || accessories.value == nil { accessories = .loading }
        do {
            let list = try await session.client.listBleAccessories().ok.body.json
            accessories = .loaded(list.accessories)
        } catch {
            if !quiet || accessories.value == nil { accessories = .failed(Loadable<Void>.message(for: error)) }
        }
        guard parent == nil else { return }
        // The parent's name and kind only shape copy; a failure leaves the
        // generic wording rather than failing the block.
        if let detail = try? await session.client.getDevice(path: .init(id: parentID)).ok.body.json {
            parent = BleParentInfo(
                name: detail.name.isEmpty ? L10n.string("device") : detail.name,
                isLitterBox: Self.litterBoxTypes.contains(detail._type.lowercased()),
                onMQTT: detail.mqttConnected
            )
        }
    }

    // MARK: Writing

    /// Pairs (or updates) from the sheet. Throws the server's refusal as is:
    /// a 400 names the bad type or MAC, a 409 the id or MAC already taken.
    func pair(_ request: Components.Schemas.BleAccessoryPairRequest, session: ServerSession) async throws {
        let list = try await session.call(purpose: L10n.string("Pair a Bluetooth accessory")) {
            try await session.client.pairBleAccessory(body: .json(request)).ok.body.json
        }
        accessories = .loaded(list.accessories)
    }

    /// Links an existing K3 to this litter box. The server updates by id and
    /// overwrites only non-empty fields, so the stored secret is kept.
    func link(_ accessory: BleAccessory, session: ServerSession) async throws {
        guard let parentID else { return }
        let request = Components.Schemas.BleAccessoryPairRequest(
            bleType: .init(rawValue: accessory.bleType.rawValue) ?? .k3,
            petkitId: accessory.petkitId,
            mac: accessory.mac,
            linkWith: parentID
        )
        try await pair(request, session: session)
    }

    /// Asks PetKit's cloud, as the parent, which accessories it owns.
    func importFromCloud(session: ServerSession) async throws -> BleImportOutcome {
        guard let parentID else { throw APIError(status: 400, code: "bad_request", message: L10n.string("No parent device.")) }
        let reply: Operations.ImportBleAccessories.Output.Ok.Body.JsonPayload
        do {
            reply = try await session.call(purpose: L10n.string("Ask PetKit's cloud for this device's accessories")) {
                try await session.client.importBleAccessories(body: .json(.init(deviceId: parentID))).ok.body.json
            }
        } catch {
            if let api = APIError.from(error), api.status == 502 {
                throw APIError(status: 502, code: api.code,
                               message: L10n.string("PetKit's cloud did not answer, so nothing was imported. (\(api.message))"))
            }
            throw error
        }
        accessories = .loaded(reply.accessories)
        let lines = reply.results.enumerated().map { index, result in
            BleImportOutcome.Line(id: index, title: Self.importTitle(result), outcome: result.outcome)
        }
        return BleImportOutcome(imported: reply.imported, lines: lines)
    }

    private static func importTitle(_ result: Components.Schemas.BleImportResult) -> String {
        if let endpoint = result.endpoint { return endpoint }
        let type = result.bleType?.uppercased() ?? L10n.string("Accessory")
        let id = result.petkitId.map { " \($0)" } ?? ""
        let mac = result.mac.map { " · \(BleMACAddress.display($0))" } ?? ""
        return "\(type)\(id)\(mac)"
    }

    /// Unpairs, keeping the server's note about Home Assistant for the section.
    func unpair(id: Int, session: ServerSession) async throws {
        let reply = try await session.call(purpose: L10n.string("Unpair a Bluetooth accessory")) {
            try await session.client.deleteBleAccessory(path: .init(id: id)).ok.body.json
        }
        accessories = .loaded(reply.accessories)
        notice = reply.note
    }

    /// Sets one entity now through the parent, or throws why it could not.
    func send(entity: String, value: String?, to id: Int, session: ServerSession) async throws {
        do {
            _ = try await session.call(purpose: L10n.string("Send a command to a Bluetooth accessory")) {
                try await session.client.sendBleCommand(
                    path: .init(id: id), body: .json(.init(entity: entity, value: value))
                ).ok.body.json
            }
        } catch {
            throw BleRefusal.explain(error)
        }
        await load(session: session, quiet: true)
    }

    /// Asks the parent to open a Bluetooth session to the accessory now.
    func poll(id: Int, session: ServerSession) async throws {
        do {
            _ = try await session.call(purpose: L10n.string("Ask the parent to read a Bluetooth accessory")) {
                try await session.client.pollBleAccessory(path: .init(id: id)).ok.body.json
            }
        } catch {
            throw BleRefusal.explain(error)
        }
    }
}
