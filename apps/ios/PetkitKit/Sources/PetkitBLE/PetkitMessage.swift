import Foundation

/// What a device puts in a reply's payload. Only `state` and `code` drive the
/// session; `text` is the payload as JSON, for the log.
public struct PetkitPayload: Equatable, Sendable {
    public var state: Int?
    public var code: Int?
    public var text: String

    public init(state: Int? = nil, code: Int? = nil, text: String = "{}") {
        self.state = state
        self.code = code
        self.text = text
    }
}

/// One PetKit document: `{"key": <int>, "payload": {...}}`, payload optional.
public struct PetkitMessage: Equatable, Sendable {
    public var key: Int?
    public var payload: PetkitPayload?
    /// The payload held a Wi-Fi password, withheld from `payload.text`.
    public var withheldSecret = false

    /// Parses one JSON object; nil when the bytes are not a JSON object.
    public init?(json: Data) {
        guard let object = try? JSONSerialization.jsonObject(with: json) as? [String: Any] else { return nil }
        key = Self.integer(object["key"])
        if let payload = object["payload"] as? [String: Any] {
            // Never logged as sent: a device that echoes the Wi-Fi password
            // back must not put it in a log the user may share.
            var shown = payload
            if shown["pwd"] != nil {
                shown["pwd"] = "[withheld]"
                withheldSecret = true
            }
            let text = (try? JSONSerialization.data(withJSONObject: shown, options: [.sortedKeys, .withoutEscapingSlashes]))
                .flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
            self.payload = PetkitPayload(state: Self.integer(payload["state"]), code: Self.integer(payload["code"]), text: text)
        }
    }

    // JSON numbers only: a `true` is an NSNumber too, and the web panel never read it as 1.
    private static func integer(_ value: Any?) -> Int? {
        guard let number = value as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID() else { return nil }
        return number.intValue
    }
}

/// JSON text written by hand, because the device reads it byte for byte:
/// keys go out in the app's order, `/` is never escaped (`JSONEncoder` writes
/// `\/`, which changes the length the 12-byte BLUFI chunks are cut from), and
/// non-ASCII stays UTF-8 — what `JSON.stringify` produces in the web panel.
enum JSONText {
    static func string(_ value: String) -> String {
        var out = "\""
        for scalar in value.unicodeScalars {
            switch scalar {
            case "\"": out += "\\\""
            case "\\": out += "\\\\"
            case "\u{08}": out += "\\b"
            case "\u{0C}": out += "\\f"
            case "\n": out += "\\n"
            case "\r": out += "\\r"
            case "\t": out += "\\t"
            case _ where scalar.value < 0x20:
                out += String(format: "\\u%04x", scalar.value)
            default:
                out.unicodeScalars.append(scalar)
            }
        }
        return out + "\""
    }

    /// `{"a":1,"b":"x"}` from already-encoded values, in the given order.
    static func object(_ fields: [(String, String)]) -> String {
        "{" + fields.map { "\(string($0.0)):\($0.1)" }.joined(separator: ",") + "}"
    }
}

/// The documents the app sends, encoded exactly as the official app does.
public enum PetkitCommand: Equatable, Sendable {
    /// "Who are you?"
    case identify
    /// Wi-Fi credentials and the server to phone home to.
    case credentials(ProvisioningPayload)
    /// "How far has the join got?"
    case joinStatus
    /// ESP32 only: the Wi-Fi details, asked once the device is on Wi-Fi.
    case wifiDetails
    /// ESP32 only: the UI language, sent once joined.
    case language(String)
    /// "Done": the device leaves pairing mode.
    case finish

    public var key: Int {
        switch self {
        case .identify: 110
        case .credentials: 151
        case .joinStatus: 112
        case .wifiDetails: 111
        case .language: 114
        case .finish: 101
        }
    }

    /// True for the one document that holds the Wi-Fi password.
    public var carriesSecret: Bool {
        if case .credentials = self { return true }
        return false
    }

    public var json: Data {
        var fields = [("key", String(key))]
        switch self {
        case .credentials(let payload): fields.append(("payload", payload.json))
        case .language(let language): fields.append(("payload", JSONText.object([("language", JSONText.string(language))])))
        default: break
        }
        return Data(JSONText.object(fields).utf8)
    }
}
