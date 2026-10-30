import AVFoundation
import PetkitLive
import SwiftUI
import UIKit

/// The picture of whichever stream is running, filling its frame like the
/// artboard's video area. Nothing at all while there is no stream.
struct LiveVideoSurface: View {
    let stream: (any LiveStream)?

    var body: some View {
        switch stream {
        case let hls as HLSLiveStream:
            PlayerLayerView(player: hls.player)
        case let webrtc as WebRTCLiveStream:
            WebRTCVideoView(receiver: webrtc.receiver)
        default:
            EmptyView()
        }
    }
}

/// A bare AVPlayerLayer: no transport controls, since a live picture has
/// nothing to seek.
private struct PlayerLayerView: UIViewRepresentable {
    let player: AVPlayer

    final class LayerView: UIView {
        override static var layerClass: AnyClass { AVPlayerLayer.self }
        var playerLayer: AVPlayerLayer? { layer as? AVPlayerLayer }
    }

    func makeUIView(context: Context) -> LayerView {
        let view = LayerView()
        view.playerLayer?.videoGravity = .resizeAspectFill
        view.playerLayer?.player = player
        return view
    }

    func updateUIView(_ view: LayerView, context: Context) {
        view.playerLayer?.player = player
    }
}

/// WebRTC's Metal renderer, attached to the remote video track as soon as
/// the receiver has one, and moved over if SwiftUI reuses the view for a
/// new receiver.
private struct WebRTCVideoView: UIViewRepresentable {
    let receiver: WebRTCReceiver

    @MainActor
    final class Coordinator {
        weak var view: RTCMTLVideoView?
        var receiver: WebRTCReceiver?
        var track: RTCVideoTrack?

        func follow(_ next: WebRTCReceiver) {
            guard receiver !== next else { return }
            receiver?.onVideoTrack = nil
            detach()
            receiver = next
            if let track = next.videoTrack { attach(track) }
            next.onVideoTrack = { [weak self] track in self?.attach(track) }
        }

        func attach(_ next: RTCVideoTrack) {
            guard let view, track !== next else { return }
            track?.remove(view)
            next.add(view)
            track = next
        }

        func detach() {
            if let view { track?.remove(view) }
            track = nil
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> RTCMTLVideoView {
        let view = RTCMTLVideoView()
        view.videoContentMode = .scaleAspectFill
        view.clipsToBounds = true
        context.coordinator.view = view
        context.coordinator.follow(receiver)
        return view
    }

    func updateUIView(_ view: RTCMTLVideoView, context: Context) {
        context.coordinator.follow(receiver)
    }

    static func dismantleUIView(_ view: RTCMTLVideoView, coordinator: Coordinator) {
        coordinator.receiver?.onVideoTrack = nil
        coordinator.detach()
        coordinator.receiver = nil
    }
}
