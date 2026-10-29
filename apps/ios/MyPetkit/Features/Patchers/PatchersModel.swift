import Foundation
import Observation
import PetkitAPI
import PetkitCore

typealias PatcherEntry = Components.Schemas.PatcherEntry

/// A device as the patcher screens show it.
struct PatchableDevice: Identifiable, Hashable {
    let id: Int
    let name: String
    let type: String
    let firmware: String

    var detailLine: String { "\(type.uppercased()) · \(firmware) · \(id)" }
}

/// One device's patchers, in the server's order of the six patchers.
struct DevicePatchers: Equatable {
    static let order = ["mqtt", "cloud", "cacert", "camera", "ssh", "talk"]

    let supported: Bool
    let deviceIP: String
    let patchers: [PatcherEntry]

    init(_ status: Components.Schemas.PatcherStatus) {
        supported = status.supported
        deviceIP = status.deviceIp
        let all = status.patchers.additionalProperties
        patchers = Self.order.compactMap { all[$0] }
            + all.filter { !Self.order.contains($0.key) }.sorted { $0.key < $1.key }.map(\.value)
    }

    init(supported: Bool, deviceIP: String, patchers: [PatcherEntry]) {
        self.supported = supported
        self.deviceIP = deviceIP
        self.patchers = patchers
    }
}

/// The devices and, per device, its patchers. A device that fails to answer
/// fails only its own card.
@MainActor
@Observable
final class PatchersModel {
    struct Row: Identifiable {
        let device: PatchableDevice
        var patchers: Loadable<DevicePatchers>
        var id: Int { device.id }
    }

    let session: ServerSession
    var rows: Loadable<[Row]> = .loading
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
        do {
            let devices = try await session.client.listDevices().ok.body.json
            rows = .loaded(devices.map {
                Row(device: PatchableDevice(id: $0.id, name: $0.name, type: $0._type, firmware: $0.firmware),
                    patchers: .loading)
            })
            for device in devices { await reload(deviceID: device.id) }
        } catch {
            rows = .failed(Loadable<[Row]>.message(for: error))
        }
    }

    func reload(deviceID: Int) async {
        let state: Loadable<DevicePatchers>
        do {
            state = .loaded(DevicePatchers(
                try await session.client.getDevicePatcherStatus(path: .init(id: deviceID)).ok.body.json))
        } catch {
            state = .failed(Loadable<DevicePatchers>.message(for: error))
        }
        guard case .loaded(var list) = rows, let index = list.firstIndex(where: { $0.id == deviceID }) else { return }
        list[index].patchers = state
        rows = .loaded(list)
    }
}
