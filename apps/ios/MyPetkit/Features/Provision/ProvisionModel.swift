import Foundation
import Observation
import PetkitBLE
import PetkitCore

/// The rows of the progress card, in order. Copy shared with the web panel.
enum ProvisionStage: Int, CaseIterable, Identifiable {
    case bluetooth, identified, wifi, server

    var id: Int { rawValue }

    var title: String {
        switch self {
        case .bluetooth: "Connected over Bluetooth"
        case .identified: "Device identified"
        case .wifi: "Joining Wi-Fi…"
        case .server: "Waiting for it to reach the server"
        }
    }
}

/// One provisioning visit: the form, the chosen device, the session's
/// progress and its log. The server address is the one `/api/info` tells
/// devices to use, never the URL this phone reaches the server on.
@MainActor
@Observable
final class ProvisionModel {
    enum Phase: Equatable {
        case idle
        case running
        case finished(ProvisioningOutcome)
    }

    var ssid = ""
    var password = ""
    var server = ""
    var offsetHours: Double
    let zoneName: String
    private(set) var serverState: Loadable<String> = .loading

    private(set) var device: DiscoveredDevice?
    private(set) var phase: Phase = .idle
    /// Stages done, counting the server one once a new device registers.
    private(set) var done = 0
    private(set) var status = ""
    let log: DiagnosticLog
    let scanner: PetkitScanner
    @ObservationIgnored private var watcher: Task<Void, Never>?
    @ObservationIgnored private var sending: Task<Void, Never>?
    @ObservationIgnored private var transport: CoreBluetoothTransport?

    init(zone: TimeZone = .current, log: DiagnosticLog = DiagnosticLog(), scanner: PetkitScanner = PetkitScanner()) {
        offsetHours = ProvisioningRules.offsetHours(of: zone)
        zoneName = zone.identifier
        self.log = log
        self.scanner = scanner
    }

    var isRunning: Bool { phase == .running }

    /// "2 of 4 done" for the header.
    var progressLabel: String { "\(done) of \(ProvisionStage.allCases.count) done" }

    var warnings: [ProvisioningRules.ServerWarning] { ProvisioningRules.serverWarnings(server) }

    /// Why Send is off, if it is.
    var missing: String? {
        if ssid.isEmpty { return "Enter the Wi-Fi network name." }
        if password.isEmpty { return "Enter the Wi-Fi password: an open network cannot be provisioned this way." }
        if server.trimmingCharacters(in: .whitespaces).isEmpty { return "Enter the server address." }
        return nil
    }

    func loadServer(_ session: ServerSession) async {
        serverState = .loading
        do {
            guard let address = try await session.client.getServerInfo().ok.body.json.apiUrl, !address.isEmpty else {
                serverState = .failed("the server does not say which address devices should use")
                return
            }
            serverState = .loaded(address)
            if server.isEmpty { server = address }
        } catch {
            serverState = .failed(Loadable<String>.message(for: error))
        }
    }

    func choose(_ device: DiscoveredDevice) {
        self.device = device
        log.note("selected: \(device.name)")
    }

    /// Starts `send` as a task the screen can stop.
    func start(_ session: ServerSession) {
        guard sending == nil else { return }
        sending = Task { [weak self] in
            await self?.send(session)
            self?.sending = nil
        }
    }

    /// Connects to the chosen device, runs the session, then watches the
    /// device list for the new device.
    func send(_ session: ServerSession) async {
        guard let device, missing == nil, !isRunning else { return }
        watcher?.cancel()
        log.clear()
        done = 0
        phase = .running
        if let refusal = ProvisioningSession.refusal(for: device.name, log: log) {
            finish(refusal)
            return
        }
        // Read alongside the connect, so a slow server never delays Bluetooth.
        async let before = try? session.client.listDevices().ok.body.json.count
        status = "Connecting…"
        log.note("connecting to \(device.name)…")
        do {
            let transport = try await scanner.connect(device)
            self.transport = transport
            defer { self.transport = nil }
            status = "Connected. Keep the phone near the device."
            let payload = ProvisioningPayload(ssid: ssid, password: password,
                                              server: server.trimmingCharacters(in: .whitespaces),
                                              offsetHours: offsetHours, zoneName: zoneName)
            let run = ProvisioningSession(transport: transport, payload: payload,
                                          language: ProvisioningRules.language(Locale.preferredLanguages.first), log: log)
            run.onStep = { [weak self] step in self?.reached(step) }
            let outcome = await run.run()
            guard !Task.isCancelled else { return }
            finish(outcome)
            if outcome == .provisioned || outcome == .unanswered { watch(session, before: await before) }
        } catch let error as ProvisioningTransportError {
            log.note("ERROR \(ProvisioningSession.describe(error))")
            finish(.failed(ProvisioningSession.describe(error)))
        } catch {
            finish(.failed(error.localizedDescription))
        }
    }

    /// Leaving the screen ends everything it started: the session (dropping
    /// the link ends every wait in it), the watch and the scan.
    func stop() {
        sending?.cancel()
        transport?.disconnect()
        watcher?.cancel()
        scanner.stop()
    }

    private func reached(_ step: ProvisioningStep) {
        switch step {
        case .connected: done = max(done, 1); status = "Connected over Bluetooth."
        case .identified: done = max(done, 2); status = "Joining Wi-Fi… Keep the phone near the device."
        case .credentialsAccepted: status = "Joining Wi-Fi… Keep the phone near the device."
        case .joined: done = max(done, 3); status = "Waiting for it to reach the server."
        }
    }

    private func finish(_ outcome: ProvisioningOutcome) {
        phase = .finished(outcome)
        switch outcome {
        case .accessory: status = "This is a Bluetooth-only accessory: it has no Wi-Fi."
        case .unknownDevice: status = "This device has no Bluetooth setup this app knows."
        case .provisioned:
            done = max(done, 3)
            status = "Provisioned. The device restarts and joins Wi-Fi."
        case .unanswered: status = "Sent, but the device never answered."
        case .failed(let reason): status = reason
        }
    }

    /// Polls the device list until it grows past `before`: the first sign the
    /// device reached this server. Gives up after five minutes.
    private func watch(_ session: ServerSession, before: Int?) {
        guard let before else {
            log.note("(could not read the device list to watch it)")
            return
        }
        watcher = Task { [weak self] in
            for _ in 0..<60 {
                try? await Task.sleep(for: .seconds(5))
                guard !Task.isCancelled, let self else { return }
                guard let list = try? await session.client.listDevices().ok.body.json else { continue }
                if list.count > before, let newest = list.last {
                    done = ProvisionStage.allCases.count
                    status = "\(newest.name) reached the server."
                    log.note("device connected: \(newest.name) #\(newest.id)")
                    return
                }
            }
            self?.log.note("(still waiting — check Logs for its first HTTP call)")
        }
    }
}

extension ProvisionModel {
    /// A model frozen mid-provisioning, for previews and snapshots; it never
    /// touches Bluetooth or the server.
    static func fixture(done: Int, status: String, server: String = "http://192.168.1.20/6/") -> ProvisionModel {
        let zone = TimeZone(identifier: "Asia/Saigon") ?? .current
        let model = ProvisionModel(zone: zone)
        model.ssid = "Nha-2.4G"
        model.password = "correct horse"
        model.server = server
        model.serverState = .loaded(server)
        model.device = DiscoveredDevice(id: UUID(), name: "PETKIT_T6_8F2A", rssi: -52)
        model.done = done
        model.status = status
        model.phase = done == 0 ? .idle : .running
        return model
    }
}
