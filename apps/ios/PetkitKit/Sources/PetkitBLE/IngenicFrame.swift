import Foundation

/// PetKit Ingenic provisioning (T5, T6, T7, D4H, D4SH, W7H): JSON in an
/// `FA FC FD 46 | type | seq | len | JSON | crc | FB` envelope, written to
/// 0xAAA2 and answered on 0xAAA1. Type 0x18 goes out, 0x13 comes back. The
/// length field counts the JSON plus the two CRC bytes; the CRC covers the
/// JSON only and is little-endian.
public enum IngenicFrame {
    public static let service = "AAA0"
    /// Device → app, notify. Named from the device's side.
    public static let notify = "AAA1"
    /// App → device, write.
    public static let write = "AAA2"

    static let magic: [UInt8] = [0xFA, 0xFC, 0xFD, 0x46]
    static let tail: UInt8 = 0xFB
    static let typeOut: UInt8 = 0x18

    public static func frame(seq: Int, json: Data) -> Data {
        let crc = Crc16CcittFalse.checksum(json)
        let length = json.count + 2
        var out = Data(magic)
        out.append(contentsOf: [typeOut, UInt8(seq & 0xFF), UInt8(length & 0xFF), UInt8((length >> 8) & 0xFF)])
        out.append(json)
        out.append(contentsOf: [UInt8(crc & 0xFF), UInt8(crc >> 8), tail])
        return out
    }

    /// One inbound reply: the framed envelope or bare JSON; nil when neither.
    ///
    /// Two hardware reports disagree about the length field: a T6 counts the
    /// JSON alone, a D4H the JSON plus its CRC. Both endings are tried. The
    /// inbound CRC is not checked, as the web panel never did.
    public static func parse(_ data: Data) -> PetkitMessage? {
        let bytes = [UInt8](data)
        if bytes.count >= 11, Array(bytes[0..<4]) == magic {
            let length = Int(bytes[6]) | Int(bytes[7]) << 8
            for end in [8 + length - 2, bytes.count - 3] where end > 8 && end <= bytes.count {
                if let message = PetkitMessage(json: Data(bytes[8..<end])) { return message }
            }
            return nil
        }
        return PetkitMessage(json: data)
    }
}

/// Joins notifications that the MTU split. A notification that is a whole
/// document on its own is read as one, as the web panel does; otherwise bytes
/// collect until they read as a framed or bare document. Bytes that can never
/// start one (the CRC and tail left over from a split frame, a malformed
/// notification) are dropped, so one bad notification cannot block the rest.
public struct IngenicReassembler: Sendable {
    public struct Result: Sendable {
        public var message: PetkitMessage?
        /// Some received bytes were thrown away unread.
        public var discarded = false
    }

    private var buffer: [UInt8] = []
    /// A runaway buffer is garbage, not a slow device.
    private static let limit = 4096

    public init() {}

    public mutating func append(_ data: Data) -> Result {
        if let message = IngenicFrame.parse(data) {
            defer { buffer.removeAll() }
            return Result(message: message, discarded: !buffer.isEmpty)
        }
        buffer.append(contentsOf: data)
        var result = Result()
        let starts = buffer.indices.filter { startsDocument(at: $0) }
        // The earliest start that parses to a PetKit document wins; whatever
        // precedes it was junk. Requiring a key keeps a nested object such as
        // `{"state":1}` inside a half-received frame from passing for one.
        for start in starts {
            if let message = IngenicFrame.parse(Data(buffer[start...])), message.key != nil {
                result.message = message
                result.discarded = start > 0
                buffer.removeAll()
                return result
            }
        }
        // Nothing parses yet: keep from the first plausible start, drop what came before.
        let keep = starts.first ?? buffer.count
        if keep > 0 {
            buffer.removeFirst(keep)
            result.discarded = true
        }
        if buffer.count > Self.limit {
            buffer.removeAll()
            result.discarded = true
        }
        return result
    }

    /// `{`, or the frame magic (as far as the bytes so far go).
    private func startsDocument(at index: Int) -> Bool {
        if buffer[index] == UInt8(ascii: "{") { return true }
        let available = min(IngenicFrame.magic.count, buffer.count - index)
        return Array(buffer[index..<(index + available)]) == Array(IngenicFrame.magic.prefix(available))
    }
}

/// Key 112, the join report. The table is PetKit's own app's, read off the log
/// line it prints per state, including the four failures — "the Wi-Fi password
/// is wrong" beats "state 3".
public enum JoinReport {
    static let states: [Int: String] = [
        0: "starting",
        1: "looking for the network",
        2: "connecting to the network",
        3: "the Wi-Fi password is wrong",
        4: "that Wi-Fi network was not found",
        5: "could not connect to the Wi-Fi",
        6: "on Wi-Fi, connecting to the server",
        7: "connected to the server",
        8: "could not connect to the server",
        9: "connecting to MQTT",
        10: "online",
    ]

    /// Connected to the server (7) or online (10). 9 is MQTT progress and keeps polling.
    public static func joined(_ payload: PetkitPayload?) -> Bool { [7, 10].contains(payload?.state ?? -1) }

    /// The states that mean stop waiting and say why.
    public static func failed(_ payload: PetkitPayload?) -> Bool { [4, 5, 8].contains(payload?.state ?? -1) }

    /// A wrong password is a warning, not a verdict: an ESP32 reported 3/2,
    /// then recovered and joined with unchanged credentials in the same session.
    public static func warns(_ payload: PetkitPayload?) -> Bool { payload?.state == 3 }

    /// "the Wi-Fi password is wrong (code 2)".
    public static func describe(_ payload: PetkitPayload?) -> String {
        guard let state = payload?.state else { return "never reported" }
        let base = states[state] ?? "state \(state)"
        if let code = payload?.code { return "\(base) (code \(code))" }
        return base
    }

    static let wrongPasswordWarning =
        "warning: the device reported a wrong Wi-Fi password. Seen on ESP32 to recover and join "
        + "with unchanged credentials, so this is not treated as fatal — still waiting."
}
