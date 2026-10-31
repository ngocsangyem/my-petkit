import PetkitBLE
import PetkitCore

// The packages word their errors in English for logs and tests; the screens
// show these sentences instead, in the app language. A device's or the
// system's own detail (`why`, `what`) is passed through as it came.

extension ProvisioningTransportError {
    var localizedSentence: String {
        switch self {
        case .bluetoothOff: L10n.string("Bluetooth is off. Turn it on in Control Center and try again.")
        case .bluetoothUnauthorized:
            L10n.string("My Petkit may not use Bluetooth. Allow it in Settings › Privacy & Security › Bluetooth.")
        case .connectFailed(let why): L10n.string("Could not connect to the device: \(why)")
        case .disconnected: L10n.string("The device disconnected. Make sure it is still in pairing mode and near the phone.")
        case .timedOut(let what): L10n.string("Timed out \(what).")
        }
    }
}

extension PairingError {
    var localizedSentence: String {
        switch self {
        case .notAPairingCode: L10n.string("This QR code is not a my-petkit pairing code.")
        case .notHTTPS: L10n.string("The server address must be an https URL.")
        case .pinRequired:
            L10n.string("A local server needs its certificate fingerprint. Scan the QR code from Server, Pair a phone.")
        }
    }
}
