import Foundation
@_exported @preconcurrency import WebRTC

/// A receive-only WebRTC peer for a camera's live stream.
///
/// The server has no trickle ICE, so `makeOffer()` resolves only once local
/// candidate gathering has finished (or `gatherTimeout` passed, keeping what
/// was found). The caller posts that SDP, then hands the answer to
/// `accept(answer:)`. Media flows straight from the server's WebRTC port.
///
/// WebRTC calls the delegate on its signaling thread; every callback hops to
/// the main queue, in order, before touching state.
@MainActor
public final class WebRTCReceiver: NSObject {
    public enum State: Sendable, Equatable {
        case connecting
        case connected
        case failed
        case closed
    }

    public enum ReceiverError: Error {
        case peerConnectionUnavailable
        case noLocalDescription
    }

    private static let factory: RTCPeerConnectionFactory = {
        RTCInitializeSSL()
        return RTCPeerConnectionFactory(encoderFactory: RTCDefaultVideoEncoderFactory(),
                                        decoderFactory: RTCDefaultVideoDecoderFactory())
    }()

    /// Every state change, on the main actor.
    public var onState: ((State) -> Void)?
    /// The remote video track, once WebRTC starts receiving it.
    public var onVideoTrack: ((RTCVideoTrack) -> Void)?
    public private(set) var state: State = .connecting
    public private(set) var videoTrack: RTCVideoTrack?

    private var peer: RTCPeerConnection?
    private var gathered: CheckedContinuation<Void, Never>?
    private var audioEnabled = true

    override public init() {
        super.init()
    }

    /// The complete offer SDP, every local candidate included.
    public func makeOffer(gatherTimeout: Duration = .seconds(5)) async throws -> String {
        let configuration = RTCConfiguration()
        configuration.sdpSemantics = .unifiedPlan
        configuration.continualGatheringPolicy = .gatherOnce
        // No STUN: the server publishes the addresses viewers can reach.
        configuration.iceServers = []
        let constraints = RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: nil)
        guard let peer = Self.factory.peerConnection(with: configuration, constraints: constraints, delegate: self)
        else { throw ReceiverError.peerConnectionUnavailable }
        self.peer = peer

        let receiveOnly = RTCRtpTransceiverInit()
        receiveOnly.direction = .recvOnly
        peer.addTransceiver(of: .video, init: receiveOnly)
        peer.addTransceiver(of: .audio, init: receiveOnly)

        let offer = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<RTCSessionDescription, Error>) in
            peer.offer(for: constraints) { description, error in
                if let description {
                    continuation.resume(returning: description)
                } else {
                    continuation.resume(throwing: error ?? ReceiverError.noLocalDescription)
                }
            }
        }
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            peer.setLocalDescription(offer) { error in
                if let error { continuation.resume(throwing: error) } else { continuation.resume() }
            }
        }
        if peer.iceGatheringState != .complete {
            await waitForGathering(timeout: gatherTimeout)
        }
        guard let local = peer.localDescription else { throw ReceiverError.noLocalDescription }
        return local.sdp
    }

    public func accept(answer sdp: String) async throws {
        guard let peer else { throw ReceiverError.peerConnectionUnavailable }
        let answer = RTCSessionDescription(type: .answer, sdp: sdp)
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            peer.setRemoteDescription(answer) { error in
                if let error { continuation.resume(throwing: error) } else { continuation.resume() }
            }
        }
    }

    /// Mutes or unmutes the camera's sound (half-duplex talk).
    public func setAudioEnabled(_ enabled: Bool) {
        audioEnabled = enabled
        for transceiver in peer?.transceivers ?? [] where transceiver.mediaType == .audio {
            transceiver.receiver.track?.isEnabled = enabled
        }
    }

    public func close() {
        finishGathering()
        peer?.close()
        peer = nil
        videoTrack = nil
        update(.closed)
    }

    // MARK: Internals

    private func waitForGathering(timeout: Duration) async {
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            gathered = continuation
            Task { [weak self] in
                try? await Task.sleep(for: timeout)
                self?.finishGathering()
            }
        }
    }

    private func finishGathering() {
        gathered?.resume()
        gathered = nil
    }

    private func update(_ next: State) {
        guard state != next, state != .closed else { return }
        state = next
        onState?(next)
    }

    private func receive(_ transceiver: RTCRtpTransceiver) {
        switch transceiver.receiver.track {
        case let track as RTCVideoTrack:
            videoTrack = track
            onVideoTrack?(track)
        case let track?:
            track.isEnabled = audioEnabled
        case nil:
            break
        }
    }
}

extension WebRTCReceiver: RTCPeerConnectionDelegate {
    public nonisolated func peerConnection(_ peerConnection: RTCPeerConnection,
                                           didChange newState: RTCIceGatheringState) {
        guard newState == .complete else { return }
        onMain { $0.finishGathering() }
    }

    public nonisolated func peerConnection(_ peerConnection: RTCPeerConnection,
                                           didChange newState: RTCPeerConnectionState) {
        // `disconnected` is left out: ICE often recovers from it within
        // seconds, and one that does not becomes `failed`.
        let mapped: State? = switch newState {
        case .connected: .connected
        case .failed: .failed
        case .closed: .closed
        default: nil
        }
        guard let mapped else { return }
        onMain { $0.update(mapped) }
    }

    public nonisolated func peerConnection(_ peerConnection: RTCPeerConnection,
                                           didStartReceivingOn transceiver: RTCRtpTransceiver) {
        onMain { $0.receive(transceiver) }
    }

    /// The main queue is FIFO, unlike separate Tasks, so `connected` then
    /// `failed` cannot arrive swapped.
    private nonisolated func onMain(_ work: @escaping @MainActor (WebRTCReceiver) -> Void) {
        DispatchQueue.main.async {
            MainActor.assumeIsolated { work(self) }
        }
    }

    // Required by the protocol; a receive-only peer without data channels
    // has nothing to do in these.
    public nonisolated func peerConnection(_ peerConnection: RTCPeerConnection, didChange stateChanged: RTCSignalingState) {}
    public nonisolated func peerConnection(_ peerConnection: RTCPeerConnection, didAdd stream: RTCMediaStream) {}
    public nonisolated func peerConnection(_ peerConnection: RTCPeerConnection, didRemove stream: RTCMediaStream) {}
    public nonisolated func peerConnectionShouldNegotiate(_ peerConnection: RTCPeerConnection) {}
    public nonisolated func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceConnectionState) {}
    public nonisolated func peerConnection(_ peerConnection: RTCPeerConnection, didGenerate candidate: RTCIceCandidate) {}
    public nonisolated func peerConnection(_ peerConnection: RTCPeerConnection, didRemove candidates: [RTCIceCandidate]) {}
    public nonisolated func peerConnection(_ peerConnection: RTCPeerConnection, didOpen dataChannel: RTCDataChannel) {}
}
