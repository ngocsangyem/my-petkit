@preconcurrency import AVFoundation
import Foundation

/// The talk wire format: raw signed 16-bit little-endian PCM, 16 kHz mono,
/// what the server's `pcm_s16le` input expects.
enum TalkAudioFormat {
    static let sampleRate: Double = 16_000
    static let bytesPerFrame = 2
    /// About 250 ms of audio per binary frame.
    static let chunkBytes = 8_000

    static func make() -> AVAudioFormat? {
        AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: sampleRate, channels: 1, interleaved: true)
    }
}

enum TalkPCMError: Error {
    case unsupportedInput
    case conversionFailed
}

/// Converts microphone buffers (any rate, any channel count, float) to the
/// talk wire format. Not thread-safe: use it from one audio tap.
final class TalkPCMConverter {
    let output: AVAudioFormat
    private let converter: AVAudioConverter

    init(input: AVAudioFormat) throws {
        guard let output = TalkAudioFormat.make(),
              let converter = AVAudioConverter(from: input, to: output)
        else { throw TalkPCMError.unsupportedInput }
        self.output = output
        self.converter = converter
    }

    /// The bytes for `buffer`. The converter keeps resampler state between
    /// calls, so consecutive buffers join without a click.
    func convert(_ buffer: AVAudioPCMBuffer) throws -> Data {
        let ratio = output.sampleRate / buffer.format.sampleRate
        // A few frames of headroom for the resampler's filter delay.
        let capacity = AVAudioFrameCount((Double(buffer.frameLength) * ratio).rounded(.up)) + 32
        guard let converted = AVAudioPCMBuffer(pcmFormat: output, frameCapacity: capacity) else {
            throw TalkPCMError.conversionFailed
        }
        var supplied = false
        var failure: NSError?
        let status = converter.convert(to: converted, error: &failure) { _, inputStatus in
            if supplied {
                inputStatus.pointee = .noDataNow
                return nil
            }
            supplied = true
            inputStatus.pointee = .haveData
            return buffer
        }
        guard status != .error, failure == nil, let samples = converted.int16ChannelData else {
            throw TalkPCMError.conversionFailed
        }
        // Int16 in memory is little-endian on every iOS device.
        return Data(bytes: samples[0], count: Int(converted.frameLength) * TalkAudioFormat.bytesPerFrame)
    }
}

/// Cuts a byte stream into fixed-size frames, keeping the remainder for the
/// next call.
struct PCMChunker {
    let size: Int
    private var pending = Data()

    init(size: Int = TalkAudioFormat.chunkBytes) {
        self.size = size
    }

    /// Every whole frame `data` completes.
    mutating func append(_ data: Data) -> [Data] {
        pending.append(data)
        var chunks: [Data] = []
        while pending.count >= size {
            chunks.append(Data(pending.prefix(size)))
            pending.removeFirst(size)
        }
        return chunks
    }

    /// What is left, shorter than a frame, or nil when nothing is.
    mutating func flush() -> Data? {
        defer { pending = Data() }
        return pending.isEmpty ? nil : pending
    }
}
