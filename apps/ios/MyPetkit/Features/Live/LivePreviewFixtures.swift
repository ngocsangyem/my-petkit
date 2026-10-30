import Foundation

/// Live screen states for previews and snapshots; nothing here calls a server.
@MainActor
enum LivePreviewFixtures {
    static var playing: LiveModel {
        LiveModel(deviceID: DevicePreviewFixtures.litterBox.id, phase: .playing,
                  modes: [.webrtc, .hls], mode: .webrtc, talkAllowed: true)
    }

    static var unavailable: LiveModel {
        LiveModel(deviceID: DevicePreviewFixtures.litterBox.id, phase: .unavailable(reason: "sidecar_down"),
                  talkAllowed: true)
    }
}
