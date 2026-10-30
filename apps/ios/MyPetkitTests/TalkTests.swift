import AVFoundation
import XCTest
@testable import MyPetkit

/// The talk wire format and the talk message sequence.
final class TalkPCMTests: XCTestCase {
    private func floatBuffer(rate: Double, channels: AVAudioChannelCount, frames: AVAudioFrameCount,
                             value: (Int) -> Float) throws -> AVAudioPCMBuffer {
        let format = try XCTUnwrap(AVAudioFormat(standardFormatWithSampleRate: rate, channels: channels))
        let buffer = try XCTUnwrap(AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames))
        buffer.frameLength = frames
        let data = try XCTUnwrap(buffer.floatChannelData)
        for channel in 0..<Int(channels) {
            for frame in 0..<Int(frames) { data[channel][frame] = value(frame) }
        }
        return buffer
    }

    func testOutputIsSixteenKilohertzMonoInt16() throws {
        let input = try XCTUnwrap(AVAudioFormat(standardFormatWithSampleRate: 48_000, channels: 2))
        let converter = try TalkPCMConverter(input: input)
        XCTAssertEqual(converter.output.sampleRate, 16_000)
        XCTAssertEqual(converter.output.channelCount, 1)
        XCTAssertEqual(converter.output.commonFormat, .pcmFormatInt16)
        XCTAssertTrue(converter.output.isInterleaved)
    }

    func testOneSecondAtFortyEightKilohertzStereoBecomesOneSecondAtSixteen() throws {
        let input = try XCTUnwrap(AVAudioFormat(standardFormatWithSampleRate: 48_000, channels: 2))
        let converter = try TalkPCMConverter(input: input)
        var bytes = 0
        for chunk in 0..<10 {
            let buffer = try floatBuffer(rate: 48_000, channels: 2, frames: 4_800) { frame in
                Float(sin(Double(chunk * 4_800 + frame) * 2 * .pi * 440 / 48_000)) * 0.5
            }
            bytes += try converter.convert(buffer).count
        }
        // 16 000 frames × 2 bytes, less at most the resampler's priming delay.
        XCTAssertEqual(bytes % 2, 0)
        XCTAssertEqual(Double(bytes), 32_000, accuracy: 32_000 * 0.02)
    }

    func testSamplesAreSignedLittleEndianAtFullScale() throws {
        let input = try XCTUnwrap(AVAudioFormat(standardFormatWithSampleRate: 44_100, channels: 1))
        let converter = try TalkPCMConverter(input: input)
        var data = Data()
        for _ in 0..<4 {
            data += try converter.convert(floatBuffer(rate: 44_100, channels: 1, frames: 4_410) { _ in -0.5 })
        }
        let samples = data.withUnsafeBytes { raw in
            (0..<raw.count / 2).map { Int16(littleEndian: raw.loadUnaligned(fromByteOffset: $0 * 2, as: Int16.self)) }
        }
        // Past the resampler's ramp-in, a constant -0.5 reads as about -16 384.
        let settled = try XCTUnwrap(samples.dropFirst(samples.count / 2).first)
        XCTAssertEqual(Double(settled), -16_384, accuracy: 300)
    }

    func testChunkerCutsEightThousandByteFrames() {
        var chunker = PCMChunker()
        XCTAssertEqual(chunker.size, 8_000)
        XCTAssertTrue(chunker.append(Data(repeating: 1, count: 3_000)).isEmpty)
        let first = chunker.append(Data(repeating: 2, count: 6_000))
        XCTAssertEqual(first.map(\.count), [8_000])
        XCTAssertEqual(first.first?.first, 1)
        XCTAssertEqual(first.first?.last, 2)
        let more = chunker.append(Data(repeating: 3, count: 15_000))
        XCTAssertEqual(more.map(\.count), [8_000, 8_000])
        XCTAssertNil(chunker.flush())
    }

    func testChunkerFlushesTheRemainderOnce() {
        var chunker = PCMChunker()
        _ = chunker.append(Data(repeating: 0, count: 8_500))
        XCTAssertEqual(chunker.flush()?.count, 500)
        XCTAssertNil(chunker.flush())
    }
}

/// A socket that records what was sent and plays back scripted replies.
private final class FakeTalkSocket: TalkSocket, @unchecked Sendable {
    enum Frame: Equatable {
        case text(String)
        case binary(Int)
    }

    private let lock = NSLock()
    private var replies: [String]
    private var frames: [Frame] = []
    private var closed = false
    private var waiting: CheckedContinuation<String, Error>?

    init(replies: [String]) {
        self.replies = replies
    }

    var sent: [Frame] { lock.withLock { frames } }
    var isClosed: Bool { lock.withLock { closed } }

    func send(text: String) async throws { lock.withLock { frames.append(.text(text)) } }
    func send(data: Data) async throws { lock.withLock { frames.append(.binary(data.count)) } }

    /// Like `URLSessionWebSocketTask.receive()`, a pending receive ignores
    /// task cancellation and ends only when the socket closes.
    func receiveText() async throws -> String {
        try await withCheckedThrowingContinuation { continuation in
            let reply: String? = lock.withLock {
                if let next = replies.first {
                    replies.removeFirst()
                    return next
                }
                if !closed { waiting = continuation }
                return nil
            }
            if let reply {
                continuation.resume(returning: reply)
            } else if isClosed, lock.withLock({ waiting == nil }) {
                continuation.resume(throwing: URLError(.cancelled))
            }
        }
    }

    func close() {
        let pending: CheckedContinuation<String, Error>? = lock.withLock {
            closed = true
            defer { waiting = nil }
            return waiting
        }
        pending?.resume(throwing: URLError(.cancelled))
    }
}

final class TalkChannelTests: XCTestCase {
    private func json(_ frame: FakeTalkSocket.Frame?) throws -> [String: String] {
        struct NotText: Error {}
        guard case .text(let text) = frame else { throw NotText() }
        return try XCTUnwrap(JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: String])
    }

    func testStartStreamStopSequence() async throws {
        let socket = FakeTalkSocket(replies: [#"{"type":"talking"}"#, #"{"type":"stopped"}"#])
        let channel = TalkChannel(socket: socket)
        try await channel.start()
        try await channel.send(pcm: Data(count: 12_000))
        try await channel.send(pcm: Data(count: 8_000))
        try await channel.stop()

        let sent = socket.sent
        XCTAssertEqual(try json(sent.first), ["type": "talk_start", "format": "pcm_s16le"])
        XCTAssertEqual(Array(sent.dropFirst().dropLast()), [.binary(8_000), .binary(8_000), .binary(4_000)])
        XCTAssertEqual(try json(sent.last), ["type": "talk_stop"])
        XCTAssertTrue(socket.isClosed)
    }

    func testAudioBeforeTalkingIsNotSent() async throws {
        let socket = FakeTalkSocket(replies: [])
        let channel = TalkChannel(socket: socket)
        try await channel.send(pcm: Data(count: 16_000))
        XCTAssertTrue(socket.sent.isEmpty)
    }

    func testServerRefusalCarriesItsMessage() async throws {
        let socket = FakeTalkSocket(replies: [#"{"type":"error","msg":"device IP unknown"}"#])
        let channel = TalkChannel(socket: socket)
        do {
            try await channel.start()
            XCTFail("start should throw")
        } catch {
            XCTAssertEqual(error as? TalkError, .refused("device IP unknown"))
        }
        XCTAssertEqual(TalkModel.message(for: TalkError.refused("device IP unknown")),
                       "The server could not start talk: device IP unknown.")
    }

    func testNoAnswerTimesOutAndStopStillCloses() async throws {
        let socket = FakeTalkSocket(replies: [#"{"type":"talking"}"#])
        let channel = TalkChannel(socket: socket, timeout: .milliseconds(100))
        try await channel.start()
        do {
            try await channel.stop()
            XCTFail("stop should time out")
        } catch {
            XCTAssertEqual(error as? TalkError, .noAnswer)
        }
        XCTAssertEqual(try json(socket.sent.last), ["type": "talk_stop"])
        XCTAssertTrue(socket.isClosed)
    }

    func testTalkURLIsTheDevicesWebSocket() throws {
        let base = try XCTUnwrap(URL(string: "https://192.168.1.20:8443"))
        XCTAssertEqual(URLSessionTalkSocket.url(baseURL: base, deviceID: 100_234_567)?.absoluteString,
                       "wss://192.168.1.20:8443/api/devices/100234567/talk")
    }
}
