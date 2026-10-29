@preconcurrency import CoreBluetooth
import Foundation

/// The real transport: one connected peripheral. Calls are awaited one at a
/// time by the session, so one pending continuation is enough; a disconnect
/// or a timeout fails it instead of leaving the session hanging. Each pending
/// call names the callback it waits for, so a late callback from an earlier
/// call cannot complete it.
@MainActor
public final class CoreBluetoothTransport: NSObject, ProvisioningTransport {
    enum Operation: String {
        case connecting, discoveringServices = "discovering services"
        case discoveringCharacteristics = "discovering characteristics"
        case startingNotifications = "starting notifications", writing
        case waitingToWrite = "waiting to write"
    }

    private let central: CBCentralManager
    private let peripheral: CBPeripheral
    private var pending: (token: Int, operation: Operation, continuation: CheckedContinuation<Void, Error>)?
    private var nextToken = 0
    private var handlers: [String: @MainActor (Data) -> Void] = [:]
    public private(set) var isConnected = false

    init(central: CBCentralManager, peripheral: CBPeripheral) {
        self.central = central
        self.peripheral = peripheral
        super.init()
        peripheral.delegate = self
    }

    func connect() async throws {
        do {
            try await perform(.connecting, timeout: 15) { central.connect(peripheral) }
        } catch {
            // CoreBluetooth's own connect never times out: without this, a
            // connect that completes after ours gave up holds the device,
            // which then stops advertising until the app is killed.
            central.cancelPeripheralConnection(peripheral)
            throw error
        }
        isConnected = true
    }

    public func discoverServices(_ candidates: [String]) async throws -> [String] {
        try await perform(.discoveringServices) { peripheral.discoverServices(candidates.map { CBUUID(string: $0) }) }
        let found = Set((peripheral.services ?? []).map(\.uuid.uuidString))
        return candidates.filter { found.contains($0.uppercased()) }
    }

    public func allServices() async -> [String] {
        try? await perform(.discoveringServices) { peripheral.discoverServices(nil) }
        return (peripheral.services ?? []).map(\.uuid.uuidString)
    }

    public func characteristics(of service: String) async throws -> [GattCharacteristic] {
        let found = try self.service(service)
        try await perform(.discoveringCharacteristics) { peripheral.discoverCharacteristics(nil, for: found) }
        return (found.characteristics ?? []).map {
            GattCharacteristic(uuid: $0.uuid.uuidString,
                               notifies: $0.properties.contains(.notify) || $0.properties.contains(.indicate),
                               writes: $0.properties.contains(.write) || $0.properties.contains(.writeWithoutResponse))
        }
    }

    public func subscribe(service: String, characteristic: String,
                          onValue: @escaping @MainActor (Data) -> Void) async throws {
        let target = try await self.characteristic(characteristic, in: service)
        // The handler goes on before notifications start, so no early reply is lost.
        handlers[target.uuid.uuidString] = onValue
        try await perform(.startingNotifications) { peripheral.setNotifyValue(true, for: target) }
    }

    public func write(_ data: Data, service: String, characteristic: String) async throws {
        let target = try await self.characteristic(characteristic, in: service)
        if target.properties.contains(.write) {
            try await perform(.writing) { peripheral.writeValue(data, for: target, type: .withResponse) }
            return
        }
        // Without a response nothing reports a frame that was too long or
        // dropped, so both are checked before writing.
        let limit = peripheral.maximumWriteValueLength(for: .withoutResponse)
        guard data.count <= limit else {
            throw ProvisioningTransportError.connectFailed(
                "a \(data.count)-byte frame does not fit this device's \(limit)-byte write without response")
        }
        if !peripheral.canSendWriteWithoutResponse {
            try await perform(.waitingToWrite) {}
        }
        guard isConnected else { throw ProvisioningTransportError.disconnected }
        peripheral.writeValue(data, for: target, type: .withoutResponse)
    }

    public func disconnect() {
        handlers.removeAll()
        if isConnected || peripheral.state == .connecting { central.cancelPeripheralConnection(peripheral) }
        linkLost()
    }

    // MARK: Central callbacks, forwarded by the scanner that owns the manager.

    func didConnect(_ peripheral: CBPeripheral) {
        guard peripheral == self.peripheral else { return }
        finish(.connecting, nil)
    }

    func didFailToConnect(_ peripheral: CBPeripheral, error: Error?) {
        guard peripheral == self.peripheral else { return }
        finish(.connecting, ProvisioningTransportError.connectFailed(error?.localizedDescription ?? "unknown error"))
    }

    func didDisconnect(_ peripheral: CBPeripheral) {
        // Before this transport connected, a disconnect is the late echo of
        // an earlier attempt's cancel, not this link dropping.
        guard peripheral == self.peripheral, isConnected else { return }
        linkLost()
    }

    /// Bluetooth went off or the peripheral dropped.
    func linkLost() {
        isConnected = false
        finish(nil, ProvisioningTransportError.disconnected)
    }

    // MARK: Plumbing

    private func service(_ uuid: String) throws -> CBService {
        guard let found = peripheral.services?.first(where: { $0.uuid == CBUUID(string: uuid) }) else {
            throw ProvisioningTransportError.connectFailed("service \(uuid) is not open")
        }
        return found
    }

    private func characteristic(_ uuid: String, in service: String) async throws -> CBCharacteristic {
        let parent = try self.service(service)
        if parent.characteristics == nil { _ = try await characteristics(of: service) }
        guard let found = parent.characteristics?.first(where: { $0.uuid == CBUUID(string: uuid) }) else {
            throw ProvisioningTransportError.connectFailed("characteristic \(uuid) not found")
        }
        return found
    }

    private func perform(_ operation: Operation, timeout seconds: Int = 10, _ start: () -> Void) async throws {
        guard isConnected || operation == .connecting else { throw ProvisioningTransportError.disconnected }
        // The session awaits one call at a time; a second would orphan the first.
        guard pending == nil else { throw ProvisioningTransportError.connectFailed("another Bluetooth call is still running") }
        nextToken += 1
        let token = nextToken
        Task { [weak self] in
            try? await Task.sleep(for: .seconds(seconds))
            guard let self, self.pending?.token == token else { return }
            self.finish(nil, ProvisioningTransportError.timedOut(operation.rawValue))
        }
        try await withCheckedThrowingContinuation { continuation in
            pending = (token, operation, continuation)
            start()
        }
    }

    /// Completes the pending call if it waits for `operation` (nil: whatever is pending).
    private func finish(_ operation: Operation?, _ error: Error?) {
        guard let current = pending, operation == nil || current.operation == operation else { return }
        let continuation = current.continuation
        pending = nil
        if let error { continuation.resume(throwing: error) } else { continuation.resume() }
    }
}

extension CoreBluetoothTransport: @preconcurrency CBPeripheralDelegate {
    public func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        finish(.discoveringServices, error)
    }

    public func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        finish(.discoveringCharacteristics, error)
    }

    public func peripheral(_ peripheral: CBPeripheral, didUpdateNotificationStateFor characteristic: CBCharacteristic,
                           error: Error?) {
        finish(.startingNotifications, error)
    }

    public func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
        finish(.writing, error)
    }

    public func peripheralIsReady(toSendWriteWithoutResponse peripheral: CBPeripheral) {
        finish(.waitingToWrite, nil)
    }

    public func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        guard error == nil, let value = characteristic.value else { return }
        handlers[characteristic.uuid.uuidString]?(value)
    }
}
