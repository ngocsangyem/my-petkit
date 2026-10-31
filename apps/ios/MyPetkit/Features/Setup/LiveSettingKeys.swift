import Foundation
import PetkitAPI

typealias ServerLiveSettings = Components.Schemas.SetupLiveSettings
typealias ServerLiveSettingsPatch = Components.Schemas.SetupLiveSettingsPatch

/// The on/off live settings this app edits, with their labels, the sentence
/// shown on the step-up screen, and the one-key patch that writes them.
enum BoolSetting: CaseIterable, Identifiable {
    case blockOTA, blockRunCmd, blockLogUpload
    case proxyMode, mqttBridge, mediaRealOSS, localCVRWindow
    case capture

    static let guards: [BoolSetting] = [.blockOTA, .blockRunCmd, .blockLogUpload]
    static let proxyOptions: [BoolSetting] = [.mqttBridge, .mediaRealOSS, .localCVRWindow]

    var id: String { wireKey }

    var wireKey: String {
        switch self {
        case .blockOTA: "proxy_block_ota"
        case .blockRunCmd: "proxy_block_run_cmd"
        case .blockLogUpload: "proxy_block_log_upload"
        case .proxyMode: "proxy_mode"
        case .mqttBridge: "proxy_mqtt_bridge"
        case .mediaRealOSS: "proxy_media_real_oss"
        case .localCVRWindow: "proxy_local_cvr_window"
        case .capture: "capture"
        }
    }

    var keyPath: WritableKeyPath<ServerLiveSettings, Bool> {
        switch self {
        case .blockOTA: \.proxyBlockOta
        case .blockRunCmd: \.proxyBlockRunCmd
        case .blockLogUpload: \.proxyBlockLogUpload
        case .proxyMode: \.proxyMode
        case .mqttBridge: \.proxyMqttBridge
        case .mediaRealOSS: \.proxyMediaRealOss
        case .localCVRWindow: \.proxyLocalCvrWindow
        case .capture: \.capture
        }
    }

    var title: String {
        switch self {
        case .blockOTA: L10n.string("Block firmware updates")
        case .blockRunCmd: L10n.string("Block shell commands")
        case .blockLogUpload: L10n.string("Block log upload")
        case .proxyMode: L10n.string("Forward to PetKit's cloud")
        case .mqttBridge: L10n.string("Bridge MQTT upstream")
        case .mediaRealOSS: L10n.string("Send media to PetKit")
        case .localCVRWindow: L10n.string("Keep recording locally")
        case .capture: L10n.string("Record traffic")
        }
    }

    var footnote: String {
        switch self {
        case .blockOTA: L10n.string("The cloud cannot push new firmware.")
        case .blockRunCmd: L10n.string("Stops run_cmd, which runs as root on the box.")
        case .blockLogUpload: L10n.string("Device logs never leave your network.")
        case .proxyMode: L10n.string("For adding a model this server does not know yet.")
        case .mqttBridge: L10n.string("Also bridges the device's MQTT session to PetKit's broker.")
        case .mediaRealOSS: L10n.string("Recordings go to PetKit instead of this server; nothing lands here.")
        case .localCVRWindow:
            L10n.string("Tells the camera its cloud storage is active, so a lapsed plan does not stop recording.")
        case .capture: L10n.string("Turning on asks for your password.")
        }
    }

    /// What the step-up screen says the change will do.
    func purpose(turningOn: Bool) -> String {
        switch (self, turningOn) {
        case (.blockOTA, false): L10n.string("While proxy mode is on, PetKit's cloud could push firmware to your devices.")
        case (.blockRunCmd, false): L10n.string("While proxy mode is on, PetKit's cloud could run shell commands as root.")
        case (.blockLogUpload, false): L10n.string("While proxy mode is on, your devices could send their logs to PetKit.")
        case (.proxyMode, true): L10n.string("Proxy mode forwards every device request to PetKit's cloud.")
        case (.capture, true): L10n.string("Recording saves every request, secrets included, to files on the server.")
        default:
            if turningOn {
                L10n.string("Turning on \(title.lowercased()) changes how the server proxies.")
            } else {
                L10n.string("Turning off \(title.lowercased()) changes how the server proxies.")
            }
        }
    }

    func patch(_ value: Bool) -> ServerLiveSettingsPatch {
        var patch = ServerLiveSettingsPatch()
        switch self {
        case .blockOTA: patch.proxyBlockOta = value
        case .blockRunCmd: patch.proxyBlockRunCmd = value
        case .blockLogUpload: patch.proxyBlockLogUpload = value
        case .proxyMode: patch.proxyMode = value
        case .mqttBridge: patch.proxyMqttBridge = value
        case .mediaRealOSS: patch.proxyMediaRealOss = value
        case .localCVRWindow: patch.proxyLocalCvrWindow = value
        case .capture: patch.capture = value
        }
        return patch
    }
}

/// The text live settings this app edits.
enum TextSetting: String, Identifiable {
    case upstream, dns, only

    var id: String { rawValue }

    var wireKey: String {
        switch self {
        case .upstream: "proxy_upstream"
        case .dns: "proxy_dns"
        case .only: "proxy_only"
        }
    }

    var keyPath: WritableKeyPath<ServerLiveSettings, String> {
        switch self {
        case .upstream: \.proxyUpstream
        case .dns: \.proxyDns
        case .only: \.proxyOnly
        }
    }

    var title: String {
        switch self {
        case .upstream: L10n.string("Upstream URL")
        case .dns: L10n.string("Upstream resolver")
        case .only: L10n.string("Forward only these endpoints")
        }
    }

    var footnote: String {
        switch self {
        case .upstream: L10n.string("A PetKit or Aliyun IoT address the server allows. Empty uses the default region.")
        case .dns: L10n.string("An IPv4 address, optionally with a port. Empty uses the system resolver.")
        case .only: L10n.string("Endpoint names separated by commas, such as dev_device_info. Empty forwards everything.")
        }
    }

    func patch(_ value: String) -> ServerLiveSettingsPatch {
        var patch = ServerLiveSettingsPatch()
        switch self {
        case .upstream: patch.proxyUpstream = value
        case .dns: patch.proxyDns = value
        case .only: patch.proxyOnly = value
        }
        return patch
    }
}
