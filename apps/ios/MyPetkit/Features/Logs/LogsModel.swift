import Foundation
import Observation
import PetkitAPI
import PetkitCore

/// The Log screen: the server's live log (catch-up plus the live stream)
/// and the list of logs the devices uploaded.
@MainActor
@Observable
final class LogsModel {
    struct DeviceLogListing: Equatable {
        var files: [DeviceLogFileRef]
        var totalBytes: Int
        /// Set when the listing is empty: why, in one sentence.
        var emptyReason: String?
    }

    let session: ServerSession
    var backfill: Loadable<[LiveEvent]> = .loading
    var filter = ""
    var hideHeartbeats = true
    var expanded: Set<String> = []
    var deviceLogs: Loadable<DeviceLogListing> = .loading
    var exported: SharedFile?
    var exportError: String?

    init(session: ServerSession) {
        self.session = session
    }

    /// Every line known: the catch-up merged with what arrived live.
    var allEvents: [LiveEvent] {
        ServerLogRules.merge(backfill: backfill.value ?? [], live: session.recentEvents)
    }

    var visibleEvents: [LiveEvent] {
        ServerLogRules.visible(allEvents, filter: filter, hideHeartbeats: hideHeartbeats)
    }

    var hiddenHeartbeats: Int {
        guard hideHeartbeats else { return 0 }
        return allEvents.filter(ServerLogRules.isHeartbeat).count
    }

    /// The socket replays only its last 80 events, so the hub's ring is read
    /// once to fill the screen; the stream keeps it current after that.
    func loadBackfill() async {
        if backfill.value == nil { backfill = .loading }
        do {
            let data = try await session.rawGET(segments: ["api", "events"],
                                                query: [URLQueryItem(name: "limit", value: "\(ServerLogRules.limit)")])
            backfill = .loaded(try JSONDecoder().decode([LiveEvent].self, from: data))
        } catch {
            backfill = .failed(Loadable<[LiveEvent]>.message(for: error))
        }
    }

    func loadDeviceLogs() async {
        do {
            let listing = try await session.client.listDeviceLogs().ok.body.json
            let files = listing.files.map {
                DeviceLogFileRef(rel: $0.rel, name: $0.name, device: $0.device, size: $0.size,
                                 modified: Date(timeIntervalSince1970: $0.mtime))
            }
            deviceLogs = .loaded(DeviceLogListing(
                files: files,
                totalBytes: listing.totalBytes,
                emptyReason: files.isEmpty || !listing.reason.isEmpty
                    ? DeviceLogRules.emptyReason(reason: listing.reason, enabledDevices: listing.enabledDevices.count)
                    : nil
            ))
        } catch {
            deviceLogs = .failed(Loadable<DeviceLogListing>.message(for: error))
        }
    }

    func toggle(_ event: LiveEvent) {
        if expanded.remove(event.id) == nil { expanded.insert(event.id) }
    }

    /// The visible lines as a text file, ready for `ShareLink`.
    func exportVisible() {
        exportError = nil
        do {
            let stamp = Date.now.formatted(.iso8601.year().month().day().time(includingFractionalSeconds: false))
            exported = try SharedFile.write(Data(ServerLogRules.exportText(visibleEvents).utf8),
                                            named: "my-petkit-log-\(stamp).txt")
        } catch {
            exportError = "The log could not be saved for sharing."
        }
    }
}

#if DEBUG
extension LogsModel {
    static func preview() -> LogsModel {
        let model = LogsModel(session: ServerPreviewFixtures.session)
        let start = Date.now.timeIntervalSince1970 - 3_600
        let rows: [(String, String?, String, JSONValue?)] = [
            ("mqtt", "100234567", "event pet_in", nil),
            ("media", "100234567", "upload EVENT_VIDEO chunks=4", nil),
            ("http", "100234567", "POST /6/t6/dev_heartbeat -> 200", .object(["status": .number(200)])),
            ("cmd", "100234567", "-> mqtt: start_action clean", nil),
            ("redact", "100155021", "server address rewritten", nil),
            ("http", "100155021", "POST /6/w5/dev_signup -> 503", .object(["status": .number(503)])),
        ]
        model.backfill = .loaded(rows.enumerated().map { index, row in
            LiveEvent(seq: index + 1, ts: start + Double(index * 97), kind: row.0, deviceID: row.1,
                      summary: row.2, detail: row.3)
        })
        model.deviceLogs = .loaded(DeviceLogListing(
            files: [DeviceLogFileRef(rel: "100234567/devRun.log", name: "devRun.log", device: 100_234_567,
                                     size: 184_320, modified: .now.addingTimeInterval(-1_800))],
            totalBytes: 184_320, emptyReason: nil))
        return model
    }
}
#endif
