import Foundation

/// Rules of the Server setup screen that need no UI: which writes need a
/// step-up, how settings and caps are validated, labelled and compared.
enum SetupRules {
    /// Every `proxy_*` key and `capture` need a fresh step-up to write (the
    /// server's `setting_key_tier`); any other live key is R1.
    static func needsStepUp(_ key: String) -> Bool {
        key.hasPrefix("proxy_") || key == "capture"
    }

    // MARK: Text settings

    /// `proxy_dns`: empty, or an IPv4 address with an optional port. A
    /// hostname is refused, as the server refuses it.
    static func isValidDNS(_ value: String) -> Bool {
        let text = value.trimmingCharacters(in: .whitespaces)
        if text.isEmpty { return true }
        let parts = text.split(separator: ":", omittingEmptySubsequences: false)
        guard parts.count <= 2 else { return false }
        if parts.count == 2 {
            guard let port = Int(parts[1]), (1...65_535).contains(port), parts[1].allSatisfy(\.isASCII) else {
                return false
            }
        }
        let octets = parts[0].split(separator: ".", omittingEmptySubsequences: false)
        return octets.count == 4 && octets.allSatisfy { octet in
            (1...3).contains(octet.count) && octet.allSatisfy { $0.isASCII && $0.isNumber }
                && (Int(octet) ?? 256) < 256
        }
    }

    /// `proxy_upstream`: empty, a preset key, or at least an http(s) URL with
    /// a host (the server checks the host against its allow-list).
    static func isValidUpstream(_ value: String, presets: [String]) -> Bool {
        let text = value.trimmingCharacters(in: .whitespaces)
        if text.isEmpty || presets.contains(text) { return true }
        guard let url = URL(string: text), let scheme = url.scheme?.lowercased(),
              scheme == "http" || scheme == "https", let host = url.host(), !host.isEmpty
        else { return false }
        return true
    }

    /// `proxy_only`: endpoint names separated by commas, as the server splits
    /// them; spaces and empty entries are dropped.
    static func normalisedEndpointList(_ value: String) -> String {
        value.split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
            .joined(separator: ",")
    }

    /// Whether an edited text setting differs from what the server holds.
    /// An empty upstream means the default preset, so naming that preset
    /// explicitly is not a change.
    static func isChange(key: String, saved: String, edited: String, defaultUpstream: String) -> Bool {
        let trimmed = edited.trimmingCharacters(in: .whitespaces)
        if key == "proxy_upstream" {
            let resolve = { (text: String) in text.isEmpty ? defaultUpstream : text }
            return resolve(saved) != resolve(trimmed)
        }
        if key == "proxy_only" {
            return normalisedEndpointList(saved) != normalisedEndpointList(trimmed)
        }
        return saved != trimmed
    }

    /// How an upstream reads on the Region row: a preset by its region, a
    /// typed URL by its host, empty as the default preset's region.
    static func upstreamLabel(_ value: String, defaultPreset: String) -> String {
        if value.isEmpty { return regionName(defaultPreset) }
        if !value.contains("://") { return regionName(value) }
        return URL(string: value)?.host() ?? value
    }

    static func regionName(_ preset: String) -> String {
        switch preset {
        case "petkit-eu": "Europe"
        case "petkit-americas": "Americas"
        case "petkit-asia": "Asia"
        case "petkit-cn": "China"
        case "petkit-ru": "Russia"
        case "": "Default"
        default: preset
        }
    }

    // MARK: Blocked attempts

    static let blockedLimit = 200

    /// Attempts recorded in the last seven days, from their `created_at`.
    static func blockedThisWeek(_ createdAt: [Double], now: Date = .now) -> Int {
        let cutoff = now.addingTimeInterval(-7 * 86_400).timeIntervalSince1970
        return createdAt.filter { $0 >= cutoff }.count
    }

    /// Blocking rule names as a person reads them.
    static func ruleLabel(_ kind: String?) -> String {
        switch kind {
        case "rce": "Shell command"
        case "ota": "Firmware push"
        case "secret": "Credential swap"
        case "log_upload": "Log upload"
        case "server": "Server address"
        case "mqtt": "Broker address"
        case "oss_sts": "Media upload"
        case "locale": "Timezone"
        case .some(let other) where !other.isEmpty: other
        default: "Unknown"
        }
    }
}
