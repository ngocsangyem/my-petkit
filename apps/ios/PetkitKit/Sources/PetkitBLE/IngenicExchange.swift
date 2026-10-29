import Foundation

/// Inter-step delays transcribed from captures of the official app, each
/// confirmed across two sessions. Do not round these.
enum IngenicTiming {
    /// Key 110 reply → key 151 write (1.054 s, 1.048 s).
    static let identToCredentials = 1045
    /// Key 151 ack → first key 112 poll (3.344 s, 3.342 s).
    static let ackToFirstPoll = 3340
    /// First joined state → confirming key 112 poll (5.879 s, 5.792 s).
    static let joinedToConfirm = 5780
    /// Confirmed joined → key 101 (1.101 s, 1.038 s).
    static let confirmToDone = 1030
    static let joinPolls = 25
    static let joinPollInterval = 3000
}

/// How documents go out to an Ingenic device. Framed is what every capture
/// shows; a D4H was reported to take bare JSON only, so bare is tried when
/// framed draws no answer at all.
enum IngenicWriteFormat: String {
    case framed = "framed 0x18"
    case bare = "bare JSON"
}

extension ProvisioningSession {
    func runIngenic() async throws -> Exchange {
        let service = IngenicFrame.service
        let chars = try await transport.characteristics(of: service)
        // By property when the UUIDs are not the usual ones.
        guard let notify = chars.first(where: { $0.uuid == IngenicFrame.notify }) ?? chars.first(where: \.notifies),
              let write = chars.first(where: { $0.uuid == IngenicFrame.write }) ?? chars.first(where: \.writes) else {
            let seen = chars.map { "\($0.uuid) [\($0.notifies ? "notify" : "")\($0.writes ? " write" : "")]" }
            log.note("could not find PetKit write/notify characteristics. Seen: \(seen.joined(separator: ", "))")
            return .failed("This device does not offer PetKit's write and notify characteristics.")
        }
        log.note("PetKit notify: \(notify.uuid), write: \(write.uuid)")

        let replies = ReplyBox()
        var reassembler = IngenicReassembler()
        var inbound = InboundFrames()
        try await transport.subscribe(service: service, characteristic: notify.uuid) { [log] data in
            inbound.hold(data)
            let result = reassembler.append(data)
            // Bytes that never became a document may have held the password,
            // so a batch with any discarded bytes is logged by length only.
            guard let message = result.message else {
                if result.discarded { inbound.flush(to: log, format: "notify", secret: true) }
                return
            }
            inbound.flush(to: log, format: "notify", secret: result.discarded || message.withheldSecret)
            guard let key = message.key else { return }
            let payload = message.payload ?? PetkitPayload()
            replies[key] = payload
            log.note("device: key \(key) \(payload.text)")
        }
        reach(.connected)

        var format = IngenicWriteFormat.framed
        var seq = 0
        func send(_ command: PetkitCommand) async throws {
            let json = command.json
            let bytes = format == .framed ? IngenicFrame.frame(seq: seq, json: json) : json
            seq += 1
            log.frame(.sent, bytes, format: format.rawValue, secret: command.carriesSecret)
            try await transport.write(bytes, service: service, characteristic: write.uuid)
        }

        log.note("asking the device who it is (key 110)…")
        try await send(.identify)
        await wait { replies[110] != nil }
        if replies[110] == nil, transport.isConnected {
            // A device can drop the first write after a fresh connect.
            log.note("no identity reply yet — retrying key 110 once…")
            try await send(.identify)
            await wait { replies[110] != nil }
        }
        if replies[110] == nil, transport.isConnected {
            format = .bare
            log.note("no reply to framed writes — trying bare JSON, which a D4H was reported to need…")
            try await send(.identify)
            await wait { replies[110] != nil }
        }
        guard replies[110] != nil else {
            guard transport.isConnected else { throw ProvisioningTransportError.disconnected }
            log.note("the device never answered — make sure it is still in pairing mode.")
            return .silent
        }
        log.note("write format: \(format.rawValue)")
        reach(.identified)
        await clock.sleep(IngenicTiming.identToCredentials)

        log.note("sending Wi-Fi credentials and server address (key 151)…")
        try await send(.credentials(payload))
        await wait { replies[151]?.state == 1 }
        guard replies[151]?.state == 1 else {
            guard transport.isConnected else { throw ProvisioningTransportError.disconnected }
            log.note("the device did not accept the credentials (no state:1).")
            return .failed("The device did not accept the Wi-Fi details.")
        }
        reach(.credentialsAccepted)

        return try await ingenicJoin(replies, send: send)
    }

    /// Polls key 112 until the device reports joining or giving up.
    private func ingenicJoin(_ replies: ReplyBox, send: (PetkitCommand) async throws -> Void) async throws -> Exchange {
        log.note("credentials accepted — waiting for the device to join the network…")
        var shown: Int?? = .none
        for poll in 0..<IngenicTiming.joinPolls {
            await clock.sleep(poll == 0 ? IngenicTiming.ackToFirstPoll : IngenicTiming.joinPollInterval)
            try await send(.joinStatus)
            // Read right after the poll, so this is the answer to the previous one.
            let report = replies[112]
            // Only on change: twenty-five identical lines would bury the one that matters.
            if shown != .some(report?.state) {
                shown = .some(report?.state)
                log.note("device: \(JoinReport.describe(report))")
                if JoinReport.warns(report) { log.note(JoinReport.wrongPasswordWarning) }
            }
            if JoinReport.joined(report) {
                await clock.sleep(IngenicTiming.joinedToConfirm)
                try await send(.joinStatus)
                await clock.sleep(IngenicTiming.confirmToDone)
                if JoinReport.joined(replies[112]) {
                    reach(.joined)
                    log.note("device joined — sending completion (key 101)…")
                    try await send(.finish)
                    return .joined
                }
            }
            if JoinReport.failed(report) {
                log.note("the device gave up: \(JoinReport.describe(report))")
                return .failed("The device gave up: \(JoinReport.describe(report)).")
            }
        }
        // Took the credentials and said so, but never reported joining. This
        // line keeps a device that never reached Wi-Fi from reading as done.
        log.note("the device did not report joining in time (last status: \(JoinReport.describe(replies[112]))). "
                 + "It may still get there on its own — watching the device list.")
        return .accepted
    }
}
