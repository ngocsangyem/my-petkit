import Foundation
import Testing
@testable import PetkitBLE

/// The decoders against the exact frames the hardware reports describe; the
/// vectors are the web panel's (`apps/web/src/ble/*.test.ts`), so both ports
/// agree byte for byte.
struct FramingTests {
    private let ack = Data(#"{"key":151,"payload":{"state":1}}"#.utf8)

    private func hex(_ data: Data) -> String { DiagnosticLog.hex(data) }

    /// An inbound (type 0x13) frame of the ack, with the given length field.
    private func framedAck(length: Int) -> Data {
        let crc = Crc16CcittFalse.checksum(ack)
        var out = Data([0xFA, 0xFC, 0xFD, 0x46, 0x13, 0, UInt8(length & 0xFF), UInt8(length >> 8)])
        out.append(ack)
        out.append(contentsOf: [UInt8(crc & 0xFF), UInt8(crc >> 8), 0xFB])
        return out
    }

    @Test func crcIsCcittFalse() {
        #expect(Crc16CcittFalse.checksum(Data("123456789".utf8)) == 0x29B1)
        #expect(Crc16CcittFalse.checksum(PetkitCommand.identify.json) == 0x3234)
    }

    @Test func framesKey110ByteForByte() {
        #expect(hex(IngenicFrame.frame(seq: 0, json: PetkitCommand.identify.json))
            == "FA FC FD 46 18 00 0D 00 7B 22 6B 65 79 22 3A 31 31 30 7D 34 32 FB")
    }

    @Test func wrapsTheSequenceAtOneByte() {
        #expect(IngenicFrame.frame(seq: 257, json: PetkitCommand.joinStatus.json)[5] == 1)
    }

    @Test func acceptsBothLengthReadingsBareJsonAndRejectsGarbage() {
        // A T6 counts the JSON alone; a D4H counts the JSON plus its two CRC bytes.
        #expect(IngenicFrame.parse(framedAck(length: ack.count + 2))?.payload?.state == 1)
        #expect(IngenicFrame.parse(framedAck(length: ack.count))?.payload?.state == 1)
        #expect(IngenicFrame.parse(ack)?.key == 151)
        #expect(IngenicFrame.parse(Data([1, 2, 3])) == nil)
    }

    @Test func reassemblesANotificationSplitByTheMtu() {
        var reassembler = IngenicReassembler()
        let frame = framedAck(length: ack.count + 2)
        #expect(reassembler.append(frame.prefix(20)).message == nil)
        #expect(reassembler.append(frame.dropFirst(20).prefix(10)).message == nil)
        let whole = reassembler.append(frame.dropFirst(30))
        #expect(whole.message?.payload?.state == 1)
        #expect(!whole.discarded)
        // A bare document split in two.
        #expect(reassembler.append(ack.prefix(9)).message == nil)
        #expect(reassembler.append(ack.dropFirst(9)).message?.key == 151)
    }

    @Test func resyncsAfterTheTailOfAFrameSplitRightAfterItsJson() {
        // A D4H frame split after the JSON: the second notification is CRC
        // and tail. A CRC byte of `{` (0x7B) or 0xFA used to block every
        // later reply.
        var reassembler = IngenicReassembler()
        #expect(reassembler.append(Data([0x7B, 0xFA, 0xFB])).message == nil)
        let next = reassembler.append(framedAck(length: ack.count + 2).prefix(25))
        #expect(next.message == nil)
        let rest = reassembler.append(framedAck(length: ack.count + 2).dropFirst(25))
        #expect(rest.message?.payload?.state == 1)
        #expect(rest.discarded)
        // And a lone malformed notification is dropped, not kept.
        #expect(reassembler.append(Data("garbage".utf8)).discarded)
        #expect(reassembler.append(framedAck(length: ack.count)).message?.key == 151)
    }

    @Test func readsBooleansAsNotNumbers() {
        #expect(PetkitMessage(json: Data(#"{"key":112,"payload":{"state":true}}"#.utf8))?.payload?.state == nil)
    }

    @Test func withholdsAnEchoedPassword() throws {
        let message = try #require(PetkitMessage(json: Data(#"{"key":111,"payload":{"ssid":"Home","pwd":"hunter2"}}"#.utf8)))
        #expect(message.withheldSecret)
        #expect(message.payload?.text.contains("hunter2") == false)
    }

    @Test func joinReport() {
        #expect(JoinReport.joined(PetkitPayload(state: 7)))
        #expect(JoinReport.joined(PetkitPayload(state: 10)))
        #expect(!JoinReport.joined(PetkitPayload(state: 6)))
        #expect(!JoinReport.joined(nil))
        #expect(JoinReport.describe(nil) == "never reported")
        // An ESP32 reported 3/2, then recovered with unchanged credentials.
        #expect(!JoinReport.failed(PetkitPayload(state: 3, code: 2)))
        #expect(JoinReport.warns(PetkitPayload(state: 3, code: 2)))
        #expect(JoinReport.describe(PetkitPayload(state: 3, code: 2)) == "the Wi-Fi password is wrong (code 2)")
        #expect([4, 5, 8].allSatisfy { JoinReport.failed(PetkitPayload(state: $0)) })
        #expect(!JoinReport.failed(PetkitPayload(state: 9)))
        #expect(JoinReport.describe(PetkitPayload(state: 4)) == "that Wi-Fi network was not found")
        #expect(JoinReport.describe(PetkitPayload(state: 42)) == "state 42")
    }

    // MARK: BLUFI

    @Test func sendsTwelveBytesOrFewerAsOneFrame() {
        var seq = 0
        let frames = BlufiFrame.frames(seq: &seq, message: PetkitCommand.identify.json)
        #expect(frames.map(hex) == ["4D 00 00 0B 7B 22 6B 65 79 22 3A 31 31 30 7D"])
        #expect(seq == 1)
    }

    @Test func splitsIntoTwelveByteChunksPrefixedWithWhatRemains() {
        var seq = 0
        let frames = BlufiFrame.frames(seq: &seq, message: Data("0123456789abcdefghijklmn".utf8))
        #expect(frames.map(hex) == [
            "4D 10 00 0E 18 00 30 31 32 33 34 35 36 37 38 39 61 62",
            "4D 00 01 0C 63 64 65 66 67 68 69 6A 6B 6C 6D 6E",
        ])
        #expect(seq == 2)
    }

    @Test func countsRemainingLengthPerChunk() {
        var seq = 7
        let frames = BlufiFrame.frames(seq: &seq, message: Data(count: 30))
        #expect(frames.count == 3)
        #expect(frames[0][4] == 30 && frames[1][4] == 18)
        #expect(frames.map { $0[2] } == [7, 8, 9])
        #expect(frames[2][1] == 0)
        #expect(seq == 10)
    }

    private func blufiPacket(_ subtype: UInt8, _ control: UInt8, _ data: [UInt8]) -> Data {
        Data([1 | subtype << 2, control, 0, UInt8(data.count)] + data)
    }

    @Test func reassemblesAFragmentedCustomDataReply() {
        var reassembler = BlufiReassembler()
        let bytes = [UInt8](ack)
        let parts = [Array(bytes[0..<12]), Array(bytes[12..<24]), Array(bytes[24...])]
        var line = ""
        for (index, part) in parts.enumerated() {
            let last = index == parts.count - 1
            let data = last ? part : [UInt8(bytes.count & 0xFF), UInt8(bytes.count >> 8)] + part
            line = reassembler.explain(blufiPacket(0x13, last ? 0 : 0x10, data))
            #expect(reassembler.isPartial == !last)
        }
        #expect(reassembler.replies[151]?.state == 1)
        #expect(line.hasPrefix("key 151"))
    }

    @Test func namesBlufiReportsAndOddFrames() {
        var reassembler = BlufiReassembler()
        #expect(reassembler.explain(blufiPacket(0x0F, 0, [1, 0, 0])).contains("CONNECTED"))
        #expect(reassembler.explain(blufiPacket(0x0F, 0, [1, 2, 0])).contains("not connected (2)"))
        #expect(reassembler.explain(blufiPacket(0x12, 0, [7])).contains("error report, code 7"))
        #expect(reassembler.explain(Data([1, 0])) == "short frame (2B)")
        #expect(reassembler.explain(blufiPacket(0x13, 0, Array("hi".utf8))) == "custom data, not a PetKit document: hi")
        #expect(reassembler.explain(Data([1 | 0x05 << 2, 0, 0, 0])) == "ignored ESP32 packet type 1 subtype 0x5")
    }
}
