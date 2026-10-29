import Foundation

/// Timeouts from real ESP32 captures. Observed worst cases: 110 reply 161 ms,
/// 151 ack 270 ms, credentials ack to state 7 about 11 s (to state 10, which
/// is not waited for, 114 s).
enum BlufiTiming {
    static let ident = 5000
    static let ack = 10000
    static let join = 120_000
    static let identRetryAfter = 2000
    static let joinStep = 1000
}

extension ProvisioningSession {
    func runBlufi() async throws -> Exchange {
        let service = BlufiFrame.service
        var reassembler = BlufiReassembler()
        let replies = ReplyBox()
        var inbound = InboundFrames()
        try await transport.subscribe(service: service, characteristic: BlufiFrame.notify) { [log] data in
            inbound.hold(data)
            let line = reassembler.explain(data)
            replies.byKey = reassembler.replies
            guard !reassembler.isPartial else { return }
            inbound.flush(to: log, format: "BLUFI", secret: reassembler.lastWasSecret)
            log.note("device: \(line)")
        }
        reach(.connected)

        var seq = 0
        func send(_ command: PetkitCommand) async throws {
            let json = command.json
            log.note("ESP32: key \(command.key) custom data (\(json.count) bytes)")
            // One frame at a time, each awaited: the device reassembles in order.
            for frame in BlufiFrame.frames(seq: &seq, message: json) {
                log.frame(.sent, frame, format: "BLUFI custom", secret: command.carriesSecret)
                try await transport.write(frame, service: service, characteristic: BlufiFrame.write)
            }
        }
        func waitFor(_ milliseconds: Int, until done: () -> Bool) async {
            let end = clock.now() + Double(milliseconds)
            while transport.isConnected, clock.now() < end, !done() { await clock.sleep(250) }
        }

        log.note("asking the device who it is (key 110)…")
        try await send(.identify)
        await clock.sleep(BlufiTiming.identRetryAfter)
        if transport.isConnected, replies[110] == nil {
            log.note("no identity reply yet — retrying key 110 once…")
            try await send(.identify)
        }
        await waitFor(BlufiTiming.ident) { replies[110] != nil }
        guard replies[110] != nil else {
            guard transport.isConnected else { throw ProvisioningTransportError.disconnected }
            log.note("timed out waiting for the device identity.")
            return .silent
        }
        reach(.identified)

        log.note("sending Wi-Fi credentials and server address (key 151)…")
        try await send(.credentials(payload))
        await waitFor(BlufiTiming.ack) { replies[151]?.state == 1 || JoinReport.failed(replies[151]) }
        if JoinReport.failed(replies[151]) {
            log.note("the device refused the credentials: \(JoinReport.describe(replies[151]))")
            return .failed("The device refused the Wi-Fi details: \(JoinReport.describe(replies[151])).")
        }
        guard replies[151]?.state == 1 else {
            guard transport.isConnected else { throw ProvisioningTransportError.disconnected }
            log.note("timed out waiting for the device to accept the credentials.")
            return .failed("The device did not accept the Wi-Fi details.")
        }
        reach(.credentialsAccepted)

        return try await blufiJoin(replies, send: send)
    }

    /// Polls key 112 (and 111 once on Wi-Fi) until the device joins, gives up or the time runs out.
    private func blufiJoin(_ replies: ReplyBox, send: (PetkitCommand) async throws -> Void) async throws -> Exchange {
        log.note("credentials accepted — waiting for the device to join the network…")
        try await send(.joinStatus)
        var shown: Int?? = .none
        var askedWifiDetails = false
        let end = clock.now() + Double(BlufiTiming.join)
        while transport.isConnected, clock.now() < end {
            await clock.sleep(BlufiTiming.joinStep)
            let report = replies[112]
            if shown != .some(report?.state) {
                shown = .some(report?.state)
                log.note("device: \(JoinReport.describe(report))")
                if JoinReport.warns(report) { log.note(JoinReport.wrongPasswordWarning) }
            }
            if JoinReport.failed(report) {
                log.note("the device gave up: \(JoinReport.describe(report))")
                return .failed("The device gave up: \(JoinReport.describe(report)).")
            }
            if JoinReport.joined(report) {
                reach(.joined)
                try await send(.language(language))
                log.note("device joined — sending completion (key 101)…")
                try await send(.finish)
                return .joined
            }
            if report?.state == 6, !askedWifiDetails {
                askedWifiDetails = true
                try await send(.wifiDetails)
            } else {
                try await send(.joinStatus)
            }
        }
        guard transport.isConnected else { throw ProvisioningTransportError.disconnected }
        let last = JoinReport.describe(replies[112])
        log.note("timed out waiting for the device to join (last status: \(last)).")
        return .failed("The device did not join in time (last status: \(last)).")
    }
}
