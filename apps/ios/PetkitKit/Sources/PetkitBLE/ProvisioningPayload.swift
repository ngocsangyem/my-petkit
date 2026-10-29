import Foundation

/// The key-151 payload, field for field as PetKit's own app sends it:
/// `ssid, pwd, hide:1, locale, timezone, apiServers, ipServers`.
///
/// `hide` is the constant 1, not anything about the network. `locale` is a
/// time-zone NAME (the app fills it with the default zone's ID, and a D4
/// echoes `locale=Europe/Amsterdam` back), and `timezone` is a STRING of hours
/// east of UTC. The device has no zone of its own; this is the only path that
/// sets one.
public struct ProvisioningPayload: Equatable, Sendable {
    public var ssid: String
    public var password: String
    /// The address devices must call, from the server's `/api/info`; never
    /// derived from the URL this app reaches the server on.
    public var server: String
    /// Hours east of UTC, in quarter hours.
    public var offsetHours: Double
    /// IANA zone name, e.g. "Asia/Saigon".
    public var zoneName: String

    public init(ssid: String, password: String, server: String, offsetHours: Double, zoneName: String) {
        self.ssid = ssid
        self.password = password
        self.server = server
        self.offsetHours = offsetHours
        self.zoneName = zoneName
    }

    public var json: String {
        let servers = "[" + JSONText.string(server) + "]"
        return JSONText.object([
            ("ssid", JSONText.string(ssid)),
            ("pwd", JSONText.string(password)),
            ("hide", "1"),
            ("locale", JSONText.string(zoneName)),
            ("timezone", JSONText.string(Self.offsetText(offsetHours))),
            ("apiServers", servers),
            ("ipServers", servers),
        ])
    }

    /// The offset as the web panel writes it, `Number#toFixed(1)`: +7 → "7.0",
    /// +5:45 → "5.8". Not `String(format: "%.1f")`, which rounds half to even
    /// and would send "0.2" where the panel sends "0.3" for +0:15. The lost
    /// precision is the original panel's and is kept for parity; the hardware
    /// runbook checks what the firmware does with "5.75".
    public static func offsetText(_ hours: Double) -> String {
        let tenths = Int((abs(hours) * 10).rounded(.toNearestOrAwayFromZero))
        let sign = hours < 0 && tenths != 0 ? "-" : ""
        return "\(sign)\(tenths / 10).\(tenths % 10)"
    }
}

/// What the app needs before anything is sent: who to refuse, which offsets
/// to offer, what to warn about.
public enum ProvisioningRules {
    /// Every PetKit device advertises a name starting with this.
    public static let namePrefix = "petkit"

    /// BLE-only accessories: no Wi-Fi to configure, paired from a device's
    /// detail instead.
    static let accessoryPrefixes = ["petkit_w5", "petkit_w4x", "petkit_ctw2", "petkit_ctw3", "petkit_k2", "petkit_k3"]

    /// Case-insensitive: the web chooser filters on "Petkit", the advertised
    /// names seen so far are "PETKIT_…".
    public static func isPetkit(_ name: String) -> Bool { name.lowercased().hasPrefix(namePrefix) }

    public static func isAccessory(_ name: String) -> Bool {
        let lower = name.lowercased()
        return accessoryPrefixes.contains { lower.hasPrefix($0) }
    }

    /// UTC-12:00 to UTC+14:00 in quarter hours: the device stores one float of
    /// hours, so the picker shows exactly that, not a city list implying DST.
    public static let offsetChoices: [Double] = (-48...56).map { Double($0) / 4 }

    /// This phone's offset now, snapped to the nearest quarter hour.
    public static func offsetHours(of zone: TimeZone, at date: Date = Date()) -> Double {
        (Double(zone.secondsFromGMT(for: date)) / 900).rounded() / 4
    }

    /// "UTC+05:45" for 5.75.
    public static func offsetLabel(_ hours: Double) -> String {
        let minutes = Int((abs(hours) * 60).rounded())
        return String(format: "UTC%@%02d:%02d", hours < 0 ? "-" : "+", minutes / 60, minutes % 60)
    }

    /// The app's language tag as the device wants it: "en-US" → "en_US".
    public static func language(_ tag: String?) -> String {
        guard let tag, !tag.isEmpty else { return "en_US" }
        guard let dash = tag.firstIndex(of: "-") else { return tag }
        return tag.replacingCharacters(in: dash...dash, with: "_")
    }

    public enum ServerWarning: Equatable, Sendable {
        /// Most devices cannot resolve mDNS names.
        case mdnsHost
        /// ESP32 devices reach Wi-Fi and then fail to reach any port but 80;
        /// `https` is port 443, which is covered here too.
        case notPort80
    }

    /// Advisory only: the form stays usable.
    public static func serverWarnings(_ value: String) -> [ServerWarning] {
        var out: [ServerWarning] = []
        if value.range(of: #"\.local(?=[:/]|$)"#, options: [.regularExpression, .caseInsensitive]) != nil {
            out.append(.mdnsHost)
        }
        if let url = URL(string: value), let scheme = url.scheme?.lowercased(), url.host != nil {
            let port = url.port ?? (scheme == "http" ? 80 : scheme == "https" ? 443 : nil)
            if let port, port != 80 { out.append(.notPort80) }
        }
        return out
    }
}
