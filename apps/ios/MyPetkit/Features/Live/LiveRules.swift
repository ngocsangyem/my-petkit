import Foundation
import PetkitAPI

/// A way this app can watch a camera. MSE is a browser API, so the phone
/// offers WebRTC and HLS only.
enum LiveMode: String, CaseIterable, Hashable, Sendable {
    case webrtc
    case hls

    var title: String {
        switch self {
        case .webrtc: "WebRTC"
        case .hls: "HLS"
        }
    }

    /// The modes this phone can use, in the server's preference order.
    static func offered(_ wire: [String]) -> [LiveMode] {
        var seen = Set<LiveMode>()
        return wire.compactMap(LiveMode.init(rawValue:)).filter { seen.insert($0).inserted }
    }

    /// The person's pick when the server still offers it, else the server's first.
    static func initial(offered: [LiveMode], preferred: LiveMode?) -> LiveMode? {
        if let preferred, offered.contains(preferred) { return preferred }
        return offered.first
    }

    /// The mode to try after `failed` could not start, if any.
    static func fallback(after failed: LiveMode, offered: [LiveMode]) -> LiveMode? {
        offered.first { $0 != failed }
    }

    /// True when a WebRTC start failure means "this server has no WebRTC",
    /// so the mode is dropped for this visit rather than retried.
    static func isWebRTCUnavailable(_ error: any Error) -> Bool {
        guard let api = APIError.from(error) else { return false }
        return api.status == 409 && api.code == "webrtc_unavailable"
    }

    /// The one sentence under the segmented control.
    func explanation(alternatives: [LiveMode]) -> String {
        switch self {
        case .webrtc where alternatives.contains(.hls):
            L10n.string("""
                WebRTC is under a second behind. Switch to HLS if the picture stalls; \
                it is about 4 seconds behind but works on any network.
                """)
        case .webrtc:
            L10n.string("WebRTC is under a second behind.")
        case .hls:
            L10n.string("HLS is about 4 seconds behind but works on any network.")
        }
    }
}

/// What `GET /api/devices/{id}/live` said, in the app's terms.
struct LiveAvailability: Equatable, Sendable {
    var available: Bool
    var reason: String?
    var modes: [LiveMode]
    /// Root-absolute signed master playlist path, five minutes.
    var hlsPath: String?
}

/// Why nothing can be watched: one sentence per server reason.
enum LiveUnavailable {
    static func sentence(for reason: String?) -> String {
        switch reason {
        case "not_a_camera": L10n.string("This device has no camera to watch.")
        case "device_unreachable": L10n.string("The camera has not reported its address yet, so the server cannot reach it.")
        case "no_stream": L10n.string("The server has no stream set up for this camera yet.")
        case "sidecar_down": L10n.string("The server's video relay is not running right now.")
        default: L10n.string("Live video is not available right now.")
        }
    }

    /// Talk goes to the same device address, so it is pointless when the
    /// device is not a camera or cannot be reached.
    static func allowsTalk(reason: String?) -> Bool {
        reason != "not_a_camera" && reason != "device_unreachable"
    }

    static var webRTCMissing: String {
        L10n.string("WebRTC is not set up on this server, so this is HLS, about 4 seconds behind.")
    }

    static var webRTCFailed: String {
        L10n.string("WebRTC could not connect, so this is HLS, about 4 seconds behind.")
    }
}
