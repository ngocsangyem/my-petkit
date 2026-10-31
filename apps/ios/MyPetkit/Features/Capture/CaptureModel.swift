import Foundation
import Observation
import PetkitAPI
import PetkitCore

/// Capture: the record switch (the `capture` live setting, R3), the files on
/// the server, the last lines of one, downloads (R3) and deletes (R1).
@MainActor
@Observable
final class CaptureModel {
    struct File: Identifiable, Equatable {
        let name: String
        let size: Int
        let lines: Int
        var id: String { name }
    }

    struct Listing: Equatable {
        var files: [File]
        var recording: Bool
        var totalBytes: Int { files.reduce(0) { $0 + $1.size } }
    }

    struct Tail: Equatable {
        let name: String
        let lines: [String]
        let total: Int
    }

    let session: ServerSession
    var listing: Loadable<Listing> = .loading
    var tail: Loadable<Tail>?
    /// The file the tail shows or is loading, so a failed read can retry.
    var tailName: String?
    var savingRecord = false
    var downloads: [String: SharedFile] = [:]
    var downloading: String?
    var error: String?
    var hasLoaded = false

    init(session: ServerSession) {
        self.session = session
    }

    func loadIfNeeded() async {
        guard !hasLoaded else { return }
        await load()
    }

    func load() async {
        hasLoaded = true
        do {
            let body = try await session.client.listCaptureFiles().ok.body.json
            let files = body.files.map { File(name: $0.name, size: $0.size, lines: $0.lines) }
            listing = .loaded(Listing(files: files, recording: body.enabled))
            if tail == nil, let first = files.first { await showTail(of: first.name) }
        } catch {
            listing = .failed(Loadable<Listing>.message(for: error))
        }
    }

    func setRecording(_ on: Bool) async {
        savingRecord = true
        error = nil
        defer { savingRecord = false }
        let purpose = on
            ? L10n.string("Recording saves every request, secrets included, to files on the server.")
            : L10n.string("Stopping recording leaves the files already written on the server.")
        do {
            let result = try await session.call(purpose: purpose) {
                try await self.session.client.updateLiveSettings(body: .json(.init(capture: on))).ok.body.json
            }
            if case .loaded(var current) = listing {
                current.recording = result.settings.capture
                listing = .loaded(current)
            }
        } catch {
            self.error = Loadable<Void>.message(for: error)
        }
    }

    func showTail(of name: String) async {
        tailName = name
        tail = .loading
        do {
            let body = try await session.client.readCaptureFile(
                path: .init(name: name), query: .init(limit: CaptureRules.tailLimit)).ok.body.json
            let decoder = JSONDecoder()
            let encoder = JSONEncoder()
            let lines = body.records.map { container -> String in
                guard let data = try? encoder.encode(container),
                      let value = try? decoder.decode(JSONValue.self, from: data)
                else { return "" }
                return CaptureRules.lineText(value)
            }
            tail = .loaded(Tail(name: name, lines: lines, total: body.total))
        } catch {
            tail = .failed(Loadable<Tail>.message(for: error))
        }
    }

    /// The raw, unmasked file (R3), saved for `ShareLink`.
    func download(_ file: File) async {
        downloading = file.name
        error = nil
        defer { downloading = nil }
        do {
            let purpose = L10n.string("Downloading \(file.name) copies it, secrets included, to this phone.")
            let data = try await session.call(purpose: purpose) {
                let body = try await self.session.client.downloadCaptureFile(path: .init(name: file.name)).ok.body.binary
                return try await Data(collecting: body, upTo: 512 * 1024 * 1024)
            }
            downloads[file.name] = try SharedFile.write(data, named: file.name)
        } catch {
            self.error = Loadable<Void>.message(for: error)
        }
    }

    /// Deletes files one by one; stops at the first refusal and says why.
    func delete(_ names: [String]) async {
        error = nil
        for name in names {
            do {
                _ = try await session.client.deleteCaptureFile(path: .init(name: name)).ok
                downloads[name] = nil
                if tailName == name {
                    tail = nil
                    tailName = nil
                }
            } catch {
                self.error = L10n.string("\(name) was not deleted: \(Loadable<Void>.message(for: error))")
                break
            }
        }
        await load()
    }
}
