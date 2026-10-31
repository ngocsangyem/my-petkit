import Foundation

/// How far a provisioning attempt got, for the progress rows.
public enum ProvisioningStep: Int, Comparable, Sendable {
    /// Connected over Bluetooth and the provisioning service is open.
    case connected
    /// The device answered key 110.
    case identified
    /// The device took the credentials (key 151 `state: 1`).
    case credentialsAccepted
    /// The device reported reaching the server (key 112 state 7 or 10).
    case joined

    public static func < (lhs: Self, rhs: Self) -> Bool { lhs.rawValue < rhs.rawValue }
}

/// How an attempt ended.
public enum ProvisioningOutcome: Equatable, Sendable {
    /// A Bluetooth-only accessory: nothing to configure.
    case accessory
    /// Neither provisioning service answered.
    case unknownDevice
    /// The device took the credentials (and usually joined).
    case provisioned
    /// Written, but the device never said it took it.
    case unanswered
    /// The device or the link said no, in words.
    case failed(String)
}

/// One provisioning attempt on a connected device: ask which protocol it
/// speaks (by service, not by a model table, which would be wrong the first
/// time a model shipped another board), run that exchange, always disconnect.
@MainActor
public final class ProvisioningSession {
    let transport: any ProvisioningTransport
    let payload: ProvisioningPayload
    let language: String
    let log: DiagnosticLog
    let clock: SessionClock
    /// Called as each step is reached, in order.
    public var onStep: (ProvisioningStep) -> Void = { _ in }
    /// The sentence a failed run carries for a transport failure; the app
    /// swaps in its own wording in the user's language. The log keeps
    /// `describe`, so a report reads the same in every language.
    public var describeFailure: (ProvisioningTransportError) -> String = ProvisioningSession.describe
    /// The furthest step reached, so a link dropped after the credentials were
    /// taken reads as a device restarting onto Wi-Fi, not as a failure.
    private(set) var furthest: ProvisioningStep?

    func reach(_ step: ProvisioningStep) {
        furthest = step
        onStep(step)
    }

    public init(transport: any ProvisioningTransport, payload: ProvisioningPayload, language: String,
                log: DiagnosticLog, clock: SessionClock = .live) {
        self.transport = transport
        self.payload = payload
        self.language = language
        self.log = log
        self.clock = clock
    }

    /// What one exchange concluded.
    enum Exchange: Equatable {
        case joined
        /// Took the credentials but never reported joining; it may still get there.
        case accepted
        case silent
        case failed(String)
    }

    /// Refuses an accessory before connecting; the caller connects only when this is nil.
    public static func refusal(for name: String, log: DiagnosticLog) -> ProvisioningOutcome? {
        guard ProvisioningRules.isAccessory(name) else { return nil }
        log.note("\(name) is a Bluetooth-only accessory — there is no Wi-Fi on it to configure. "
                 + "Pair it from the detail of the litter box or feeder that will relay for it.")
        return .accessory
    }

    public func run() async -> ProvisioningOutcome {
        defer { transport.disconnect() }
        do {
            let found = try await transport.discoverServices([IngenicFrame.service, BlufiFrame.service])
            let exchange: Exchange
            if found.contains(IngenicFrame.service) {
                log.note("protocol: PetKit (0xAAA0)")
                exchange = try await runIngenic()
            } else if found.contains(BlufiFrame.service) {
                log.note("protocol: BLUFI (0xFFFF)")
                exchange = try await runBlufi()
            } else {
                let seen = await transport.allServices()
                log.note("This device answered to neither PetKit's provisioning service (0xAAA0) nor PetKit "
                         + "ESP32 provisioning (0xFFFF), so nothing here can configure it. Older models such as "
                         + "the Feeder Mini have no Bluetooth setup at all. Services seen: "
                         + (seen.isEmpty ? "none" : seen.joined(separator: ", ")))
                return .unknownDevice
            }
            switch exchange {
            case .joined, .accepted:
                log.note("done. watching for the device to reach the server…")
                return .provisioned
            case .silent:
                log.note("The payload was written and acknowledged at the Bluetooth level, but the device said "
                         + "nothing back. It may still join; if it does not, this log is what to report.")
                return .unanswered
            case .failed(let reason):
                return .failed(reason)
            }
        } catch ProvisioningTransportError.disconnected where (furthest ?? .connected) >= .credentialsAccepted {
            log.note("the device dropped Bluetooth after taking the credentials — usually it is restarting "
                     + "onto Wi-Fi. watching for it to reach the server…")
            return .provisioned
        } catch let error as ProvisioningTransportError {
            log.note("ERROR \(Self.describe(error))")
            return .failed(describeFailure(error))
        } catch {
            log.note("ERROR \(error.localizedDescription)")
            return .failed(error.localizedDescription)
        }
    }

    /// The sentence the screen shows for a transport failure.
    public nonisolated static func describe(_ error: ProvisioningTransportError) -> String {
        switch error {
        case .bluetoothOff: "Bluetooth is off. Turn it on in Control Center and try again."
        case .bluetoothUnauthorized: "My Petkit may not use Bluetooth. Allow it in Settings › Privacy › Bluetooth."
        case .connectFailed(let why): "Could not connect to the device: \(why)"
        case .disconnected: "The device disconnected. Make sure it is still in pairing mode and near the phone."
        case .timedOut(let what): "Timed out \(what)."
        }
    }

    /// Polls `done` every 250 ms for up to `steps` polls, or until the link drops.
    func wait(steps: Int = 20, until done: () -> Bool) async {
        var step = 0
        while step < steps, !done(), transport.isConnected {
            await clock.sleep(250)
            step += 1
        }
    }
}

/// Raw inbound frames held until the document they belong to is complete, so
/// a reply that echoes the Wi-Fi password is logged by length alone.
struct InboundFrames {
    private var pending: [Data] = []

    mutating func hold(_ data: Data) {
        pending.append(data)
        if pending.count > 32 { pending.removeFirst() }
    }

    @MainActor mutating func flush(to log: DiagnosticLog, format: String, secret: Bool) {
        for data in pending { log.frame(.received, data, format: format, secret: secret) }
        pending.removeAll()
    }
}

/// The replies by key, shared between the notification handler and the
/// exchange that waits on them.
@MainActor
final class ReplyBox {
    var byKey: [Int: PetkitPayload] = [:]

    subscript(key: Int) -> PetkitPayload? {
        get { byKey[key] }
        set { byKey[key] = newValue }
    }
}
