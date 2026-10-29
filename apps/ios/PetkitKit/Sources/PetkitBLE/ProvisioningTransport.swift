import Foundation

/// A characteristic as the session sees it: its short UUID ("AAA1") and what it allows.
public struct GattCharacteristic: Equatable, Sendable {
    public var uuid: String
    public var notifies: Bool
    public var writes: Bool

    public init(uuid: String, notifies: Bool, writes: Bool) {
        self.uuid = uuid.uppercased()
        self.notifies = notifies
        self.writes = writes
    }
}

public enum ProvisioningTransportError: Error, Equatable, Sendable {
    case bluetoothOff
    case bluetoothUnauthorized
    case connectFailed(String)
    case disconnected
    case timedOut(String)
}

/// One connected device, as the session drives it. The CoreBluetooth
/// transport is the real one; tests script a fake device behind the same
/// calls, so the session runs without a radio or real time.
@MainActor
public protocol ProvisioningTransport: AnyObject {
    /// Short UUIDs of the services found among `candidates`, in discovery order.
    /// Asks for each by name: a device need not advertise the service it provisions on.
    func discoverServices(_ candidates: [String]) async throws -> [String]
    /// Every service the device exposes, for the "nothing here" message.
    func allServices() async -> [String]
    func characteristics(of service: String) async throws -> [GattCharacteristic]
    /// Starts notifications; `onValue` gets each notified value, in order.
    func subscribe(service: String, characteristic: String, onValue: @escaping @MainActor (Data) -> Void) async throws
    /// Writes with response when the characteristic allows it.
    func write(_ data: Data, service: String, characteristic: String) async throws
    var isConnected: Bool { get }
    func disconnect()
}

/// Time, injected so tests run the minute-long joins instantly.
public struct SessionClock: Sendable {
    public var sleep: @Sendable @MainActor (_ milliseconds: Int) async -> Void
    public var now: @Sendable @MainActor () -> Double

    public init(sleep: @escaping @Sendable @MainActor (Int) async -> Void, now: @escaping @Sendable @MainActor () -> Double) {
        self.sleep = sleep
        self.now = now
    }

    public static let live = SessionClock(
        sleep: { try? await Task.sleep(for: .milliseconds($0)) },
        now: { Date().timeIntervalSince1970 * 1000 }
    )
}
