@preconcurrency import CoreBluetooth
import Foundation
import Observation

/// A PetKit device heard advertising.
public struct DiscoveredDevice: Identifiable, Equatable, Sendable {
    public let id: UUID
    public let name: String
    public let rssi: Int

    public init(id: UUID, name: String, rssi: Int) {
        self.id = id
        self.name = name
        self.rssi = rssi
    }

    /// A Bluetooth-only accessory: listed, but refused.
    public var isAccessory: Bool { ProvisioningRules.isAccessory(name) }
}

/// Scans for devices whose advertised name starts with "Petkit". Not filtered
/// by service: a device need not advertise the one it provisions on.
@MainActor
@Observable
public final class PetkitScanner: NSObject {
    public enum Radio: Equatable, Sendable { case unknown, on, off, unauthorized, unsupported }

    public private(set) var radio: Radio = .unknown
    public private(set) var devices: [DiscoveredDevice] = []
    public private(set) var isScanning = false

    @ObservationIgnored private var central: CBCentralManager?
    @ObservationIgnored private var peripherals: [UUID: CBPeripheral] = [:]
    @ObservationIgnored private var connection: CoreBluetoothTransport?
    @ObservationIgnored private var wantsScan = false

    override public init() { super.init() }

    /// Creating the manager is what asks for Bluetooth permission, so it waits
    /// until the screen actually wants to scan.
    public func start() {
        wantsScan = true
        if central == nil {
            central = CBCentralManager(delegate: self, queue: nil)
        } else {
            beginScan()
        }
    }

    public func stop() {
        wantsScan = false
        central?.stopScan()
        isScanning = false
    }

    /// Connects to one heard device; the transport is ready for a session.
    public func connect(_ device: DiscoveredDevice) async throws -> CoreBluetoothTransport {
        guard let central, radio == .on else { throw ProvisioningTransportError.bluetoothOff }
        guard let peripheral = peripherals[device.id] else {
            throw ProvisioningTransportError.connectFailed("the device is no longer in range")
        }
        stop()
        // One link at a time: a previous one still open would hold its device.
        connection?.disconnect()
        let transport = CoreBluetoothTransport(central: central, peripheral: peripheral)
        connection = transport
        try await transport.connect()
        return transport
    }

    private func beginScan() {
        guard wantsScan, let central, central.state == .poweredOn, !isScanning else { return }
        devices.removeAll()
        central.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: false])
        isScanning = true
    }
}

extension PetkitScanner: @preconcurrency CBCentralManagerDelegate {
    public func centralManagerDidUpdateState(_ central: CBCentralManager) {
        switch central.state {
        case .poweredOn: radio = .on
        case .poweredOff: radio = .off
        case .unauthorized: radio = .unauthorized
        case .unsupported: radio = .unsupported
        default: radio = .unknown
        }
        if radio == .on {
            beginScan()
        } else {
            isScanning = false
            connection?.linkLost()
        }
    }

    public func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral,
                               advertisementData: [String: Any], rssi RSSI: NSNumber) {
        let name = advertisementData[CBAdvertisementDataLocalNameKey] as? String ?? peripheral.name ?? ""
        guard ProvisioningRules.isPetkit(name) else { return }
        peripherals[peripheral.identifier] = peripheral
        let device = DiscoveredDevice(id: peripheral.identifier, name: name, rssi: RSSI.intValue)
        if let index = devices.firstIndex(where: { $0.id == device.id }) {
            devices[index] = device
        } else {
            devices.append(device)
        }
    }

    public func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        connection?.didConnect(peripheral)
    }

    public func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        connection?.didFailToConnect(peripheral, error: error)
    }

    public func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral,
                               error: Error?) {
        connection?.didDisconnect(peripheral)
    }
}
