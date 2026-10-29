import Foundation
import Testing
@testable import PetkitBLE

/// Virtual time: sleeping advances the clock at once, so a two-minute join runs in microseconds.
@MainActor
final class FakeClock {
    var now: Double = 0
    var clock: SessionClock {
        SessionClock(sleep: { [self] in now += Double($0); await Task.yield() }, now: { [self] in now })
    }
}

/// A scripted device behind the transport calls. `reply` sees each complete
/// document written and returns the notifications to send back.
@MainActor
final class FakeDevice: ProvisioningTransport {
    var services: [String]
    var characteristics: [GattCharacteristic]
    var reply: (_ key: Int, _ framed: Bool) -> [Data] = { _, _ in [] }
    /// Drop the link when this key is written.
    var disconnectOnKey: Int?
    private(set) var written: [(key: Int, framed: Bool)] = []
    private(set) var isConnected = true
    private var notify: ((Data) -> Void)?
    private var blufiBuffer: [UInt8] = []

    init(services: [String], characteristics: [GattCharacteristic] = [
        GattCharacteristic(uuid: "AAA1", notifies: true, writes: false),
        GattCharacteristic(uuid: "AAA2", notifies: false, writes: true),
    ]) {
        self.services = services
        self.characteristics = characteristics
    }

    func discoverServices(_ candidates: [String]) async throws -> [String] { candidates.filter(services.contains) }
    func allServices() async -> [String] { services }
    func characteristics(of service: String) async throws -> [GattCharacteristic] { characteristics }
    func disconnect() { isConnected = false }

    func subscribe(service: String, characteristic: String, onValue: @escaping @MainActor (Data) -> Void) async throws {
        notify = onValue
    }

    func write(_ data: Data, service: String, characteristic: String) async throws {
        guard isConnected else { throw ProvisioningTransportError.disconnected }
        let document: (Data, Bool)?
        if service == BlufiFrame.service {
            let bytes = [UInt8](data)
            let fragment = bytes[1] & 0x10 != 0
            blufiBuffer += bytes[(fragment ? 6 : 4)...]
            document = fragment ? nil : (Data(blufiBuffer), true)
            if !fragment { blufiBuffer.removeAll() }
        } else {
            let framed = data.first == 0xFA
            document = (framed ? Data(data[8..<(data.count - 3)]) : data, framed)
        }
        guard let (json, framed) = document, let key = PetkitMessage(json: json)?.key else { return }
        written.append((key, framed))
        if key == disconnectOnKey {
            isConnected = false
            throw ProvisioningTransportError.disconnected
        }
        for notification in reply(key, framed) { notify?(notification) }
    }

    /// A framed Ingenic reply.
    static func ingenic(_ json: String) -> Data { IngenicFrame.frame(seq: 0, json: Data(json.utf8)) }

    /// A BLUFI custom-data reply, in as many 12-byte fragments as it takes.
    static func blufi(_ json: String) -> [Data] {
        var seq = 0
        return BlufiFrame.frames(seq: &seq, message: Data(json.utf8))
    }
}

@MainActor
struct SessionTests {
    private let payload = ProvisioningPayload(ssid: "Home", password: "hunter2", server: "http://192.168.1.20/6/",
                                              offsetHours: 7, zoneName: "Asia/Saigon")

    private func run(_ device: FakeDevice) async -> (ProvisioningOutcome, [ProvisioningStep], DiagnosticLog) {
        let log = DiagnosticLog()
        let session = ProvisioningSession(transport: device, payload: payload, language: "en_US",
                                          log: log, clock: FakeClock().clock)
        var steps: [ProvisioningStep] = []
        session.onStep = { steps.append($0) }
        return (await session.run(), steps, log)
    }

    /// Answers 110, acks 151, then reports `states` for successive 112 polls.
    private func scriptIngenic(_ device: FakeDevice, states: [Int], split: Bool = false) {
        var polls = 0
        device.reply = { key, _ in
            let json: String
            switch key {
            case 110: json = #"{"key":110,"payload":{"model":"T6"}}"#
            case 151: json = #"{"key":151,"payload":{"state":1}}"#
            case 112:
                json = #"{"key":112,"payload":{"state":\#(states[min(polls, states.count - 1)])}}"#
                polls += 1
            default: return []
            }
            let frame = FakeDevice.ingenic(json)
            // An MTU of 20 splits every reply.
            return split ? stride(from: 0, to: frame.count, by: 20).map { frame[$0..<min($0 + 20, frame.count)] } : [frame]
        }
    }

    @Test func ingenicProvisionsAndFinishes() async {
        let device = FakeDevice(services: ["AAA0"])
        scriptIngenic(device, states: [2, 7], split: true)
        let (outcome, steps, log) = await run(device)
        #expect(outcome == .provisioned)
        #expect(steps == [.connected, .identified, .credentialsAccepted, .joined])
        #expect(device.written.map(\.key) == [110, 151, 112, 112, 112, 101])
        #expect(device.written.allSatisfy { $0.framed })
        #expect(!device.isConnected)
        // The frame with the password is in the log by length only.
        #expect(!log.lines.contains { $0.text.contains("hunter2") || $0.text.contains(Self.hex("hunter2")) })
        #expect(log.lines.contains { $0.text.contains("withheld") })
    }

    @Test func anEchoedPasswordThatNeverParsesStaysOutOfTheLog() async {
        let device = FakeDevice(services: ["AAA0"])
        scriptIngenic(device, states: [7])
        let normal = device.reply
        // A malformed echo of the credentials, then the real replies.
        device.reply = { key, framed in
            let echo = key == 151 ? [Data(#"{"key":151,"payload":{"pwd":"hunter2""#.utf8)] : []
            return echo + normal(key, framed)
        }
        let (outcome, _, log) = await run(device)
        #expect(outcome == .provisioned)
        let export = log.export(header: [])
        #expect(!export.contains("hunter2"))
        // "hun" as hex, in any frame.
        #expect(!export.contains("68 75 6E"))
    }

    @Test func ingenicFallsBackToBareJsonWhenFramedDrawsNoAnswer() async {
        let device = FakeDevice(services: ["AAA0"])
        scriptIngenic(device, states: [10])
        let framedReply = device.reply
        device.reply = { key, framed in framed ? [] : framedReply(key, framed) }
        let (outcome, _, log) = await run(device)
        #expect(outcome == .provisioned)
        #expect(device.written.prefix(3).map(\.framed) == [true, true, false])
        #expect(device.written.dropFirst(2).allSatisfy { !$0.framed })
        #expect(log.lines.contains { $0.text == "write format: bare JSON" })
    }

    @Test func ingenicStopsOnAJoinFailureAndSaysWhy() async {
        let device = FakeDevice(services: ["AAA0"])
        scriptIngenic(device, states: [3, 4])
        let (outcome, _, log) = await run(device)
        #expect(outcome == .failed("The device gave up: that Wi-Fi network was not found."))
        #expect(log.lines.contains { $0.text.hasPrefix("warning: the device reported a wrong Wi-Fi password") })
    }

    @Test func ingenicSilentDeviceIsUnanswered() async {
        let device = FakeDevice(services: ["AAA0"])
        let (outcome, steps, _) = await run(device)
        #expect(outcome == .unanswered)
        #expect(steps == [.connected])
        #expect(device.written.map(\.key) == [110, 110, 110])
    }

    @Test func aLinkDroppedAfterTheCredentialsReadsAsRestarting() async {
        let device = FakeDevice(services: ["AAA0"])
        scriptIngenic(device, states: [2])
        device.disconnectOnKey = 112
        let (outcome, steps, _) = await run(device)
        #expect(outcome == .provisioned)
        #expect(steps.last == .credentialsAccepted)
    }

    @Test func aLinkDroppedBeforeTheCredentialsFails() async {
        let device = FakeDevice(services: ["AAA0"])
        scriptIngenic(device, states: [2])
        device.disconnectOnKey = 151
        let (outcome, _, _) = await run(device)
        #expect(outcome == .failed(ProvisioningSession.describe(.disconnected)))
    }

    @Test func blufiProvisionsInTwelveByteChunks() async {
        let device = FakeDevice(services: ["FFFF"])
        var polls = 0
        device.reply = { key, _ in
            switch key {
            case 110: return FakeDevice.blufi(#"{"key":110}"#)
            case 151: return FakeDevice.blufi(#"{"key":151,"payload":{"state":1}}"#)
            case 111: return []
            case 112:
                polls += 1
                return FakeDevice.blufi(#"{"key":112,"payload":{"state":\#(polls < 3 ? 6 : 7)}}"#)
            default: return []
            }
        }
        let (outcome, steps, _) = await run(device)
        #expect(outcome == .provisioned)
        #expect(steps == [.connected, .identified, .credentialsAccepted, .joined])
        // 111 once on reaching state 6, then 114 and 101 after joining.
        #expect(device.written.map(\.key).filter { $0 == 111 }.count == 1)
        #expect(Array(device.written.map(\.key).suffix(2)) == [114, 101])
    }

    @Test func unknownDeviceNamesWhatItSaw() async {
        let device = FakeDevice(services: ["180A"])
        let (outcome, _, log) = await run(device)
        #expect(outcome == .unknownDevice)
        #expect(log.lines.last?.text.hasSuffix("Services seen: 180A") == true)
    }

    @Test func refusesAnAccessoryBeforeConnecting() {
        let log = DiagnosticLog()
        #expect(ProvisioningSession.refusal(for: "Petkit_K3_01", log: log) == .accessory)
        #expect(ProvisioningSession.refusal(for: "PETKIT_T6_8F2A", log: log) == nil)
        #expect(log.lines.count == 1)
    }

    private static func hex(_ text: String) -> String { DiagnosticLog.hex(Data(text.utf8)) }
}
