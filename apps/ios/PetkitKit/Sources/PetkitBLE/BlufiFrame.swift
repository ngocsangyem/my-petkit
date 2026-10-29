import Foundation

/// PetKit ESP32 provisioning (T4, D4): PetKit JSON carried as BLUFI custom
/// data on service 0xFFFF, written to 0xFF01, answered on 0xFF02.
///
/// Only custom data is ever sent. The native BLUFI Wi-Fi frames make ESP-IDF
/// join Wi-Fi on its own while PetKit's firmware never reads `apiServers`, so
/// a T4 came online on PetKit's cloud without ever calling this server.
public enum BlufiFrame {
    public static let service = "FFFF"
    /// App → device, write.
    public static let write = "FF01"
    /// Device → app, notify.
    public static let notify = "FF02"

    static let typeData: UInt8 = 0x01
    static let subtypeCustom: UInt8 = 0x13
    static let fragmentFlag: UInt8 = 0x10
    // Read, never sent: a device that fails at the BLUFI layer says so in one
    // of these (values from ESP-IDF's `btc_blufi_prf.h`).
    static let subtypeWifiReport: UInt8 = 0x0F
    static let subtypeErrorInfo: UInt8 = 0x12
    /// PetKit's ESP32 firmware takes custom data in 12-byte chunks; a larger
    /// write went out as an ATT long write, which the GATT server swallowed.
    public static let chunkLength = 12

    /// One frame: type|subtype, frame control, seq, data length, then data. A
    /// fragment that is not the last carries a 2-byte little-endian remaining
    /// length before its chunk, counted in the data length.
    static func frame(seq: Int, chunk: ArraySlice<UInt8>, fragment: Bool, remaining: Int) -> Data {
        var out = Data([
            typeData | subtypeCustom << 2,
            fragment ? fragmentFlag : 0x00,
            UInt8(seq & 0xFF),
            UInt8(fragment ? chunk.count + 2 : chunk.count),
        ])
        if fragment { out.append(contentsOf: [UInt8(remaining & 0xFF), UInt8((remaining >> 8) & 0xFF)]) }
        out.append(contentsOf: chunk)
        return out
    }

    /// Splits one custom-data message into frames, in order. `seq` is the
    /// session-wide frame counter and advances by one per frame.
    public static func frames(seq: inout Int, message: Data) -> [Data] {
        let bytes = [UInt8](message)
        defer { seq += max(1, (bytes.count + chunkLength - 1) / chunkLength) }
        guard bytes.count > chunkLength else {
            return [frame(seq: seq, chunk: bytes[...], fragment: false, remaining: 0)]
        }
        return stride(from: 0, to: bytes.count, by: chunkLength).enumerated().map { index, offset in
            let end = min(offset + chunkLength, bytes.count)
            // What REMAINS including this chunk, which the device reassembles
            // against — not the length of the whole message.
            return frame(seq: seq + index, chunk: bytes[offset..<end], fragment: end < bytes.count,
                         remaining: bytes.count - offset)
        }
    }
}

/// Reassembles one session's notifications and keeps the PetKit replies by key.
public struct BlufiReassembler: Sendable {
    private var fragments: [UInt8] = []
    public private(set) var replies: [Int: PetkitPayload] = [:]

    public init() {}

    /// True while a fragmented message is half received.
    public var isPartial: Bool { !fragments.isEmpty }
    /// The last completed message held, or may have held, the Wi-Fi password:
    /// its raw frames are logged by length only.
    public private(set) var lastWasSecret = false

    /// Reads one notification and says, for the log, what it was.
    public mutating func explain(_ data: Data) -> String {
        let bytes = [UInt8](data)
        lastWasSecret = false
        guard bytes.count >= 4 else { return "short frame (\(bytes.count)B)" }
        let type = bytes[0] & 0x03
        let subtype = bytes[0] >> 2
        let body = Array(bytes[4..<min(bytes.count, 4 + Int(bytes[3]))])

        guard type == BlufiFrame.typeData else {
            return "ignored ESP32 packet type \(type) subtype 0x\(String(subtype, radix: 16))"
        }
        switch subtype {
        case BlufiFrame.subtypeCustom:
            if bytes[1] & BlufiFrame.fragmentFlag != 0 {
                fragments.append(contentsOf: body.dropFirst(2))
                return "custom data, partial (\(max(0, body.count - 2))B)"
            }
            fragments.append(contentsOf: body)
            let whole = Data(fragments)
            fragments.removeAll()
            guard let message = IngenicFrame.parse(whole), let key = message.key else {
                let text = String(bytes: whole, encoding: .utf8)
                lastWasSecret = text?.contains("pwd") ?? true
                guard let text, !lastWasSecret else {
                    return "custom data, not a PetKit document (\(whole.count) bytes, withheld)"
                }
                return "custom data, not a PetKit document: \(text)"
            }
            lastWasSecret = message.withheldSecret
            let payload = message.payload ?? PetkitPayload()
            replies[key] = payload
            return "key \(key) \(payload.text)"
        case BlufiFrame.subtypeWifiReport:
            // opmode, sta_conn_state, softap_conn_num, then TLVs
            let connection = body.count > 1 ? Int(body[1]) : nil
            return connection == 0 ? "wifi status: CONNECTED" : "wifi status: not connected (\(connection.map(String.init) ?? "?"))"
        case BlufiFrame.subtypeErrorInfo:
            return "BLUFI error report, code \(body.first.map(String.init) ?? "?")"
        default:
            return "ignored ESP32 packet type \(type) subtype 0x\(String(subtype, radix: 16))"
        }
    }
}
