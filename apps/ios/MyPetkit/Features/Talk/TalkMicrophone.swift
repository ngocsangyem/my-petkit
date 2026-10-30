@preconcurrency import AVFoundation
import Foundation

/// The microphone as a stream of talk-format PCM. The tap runs on the audio
/// render thread and owns the converter alone; `start` and `stop` are called
/// from the main actor, never at the same time as each other.
final class TalkMicrophone: @unchecked Sendable {
    private let engine = AVAudioEngine()
    private var continuation: AsyncStream<Data>.Continuation?
    /// The session as the player had it, put back when talk ends.
    private var previous: (category: AVAudioSession.Category, mode: AVAudioSession.Mode,
                           options: AVAudioSession.CategoryOptions)?

    /// Starts capture. The stream ends when `stop()` is called.
    func start() throws -> AsyncStream<Data> {
        let audio = AVAudioSession.sharedInstance()
        previous = (audio.category, audio.mode, audio.categoryOptions)
        // The speaker, not the earpiece, is where a viewer listens; A2DP keeps
        // Bluetooth headphones in stereo rather than forcing the call profile.
        try audio.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetoothA2DP])
        try audio.setActive(true)

        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        // A Simulator without an input device reports a zero sample rate.
        guard format.sampleRate > 0, format.channelCount > 0 else { throw TalkPCMError.unsupportedInput }
        let converter = try TalkPCMConverter(input: format)

        let (stream, continuation) = AsyncStream<Data>.makeStream(bufferingPolicy: .bufferingNewest(64))
        self.continuation = continuation
        input.installTap(onBus: 0, bufferSize: 4_096, format: format) { buffer, _ in
            guard let data = try? converter.convert(buffer), !data.isEmpty else { return }
            continuation.yield(data)
        }
        engine.prepare()
        do {
            try engine.start()
        } catch {
            input.removeTap(onBus: 0)
            continuation.finish()
            throw error
        }
        return stream
    }

    func stop() {
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        continuation?.finish()
        continuation = nil
        if let previous {
            try? AVAudioSession.sharedInstance().setCategory(previous.category, mode: previous.mode,
                                                             options: previous.options)
            self.previous = nil
        }
    }
}
