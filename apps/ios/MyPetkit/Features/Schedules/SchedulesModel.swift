import Foundation
import Observation
import PetkitAPI

/// One schedule the server says this device has (`DeviceScheduleTarget`).
struct ScheduleTargetInfo: Identifiable, Equatable, Sendable {
    let target: String
    let name: String
    let kind: ScheduleKind
    /// The value the server serves now.
    let value: ScheduleJSON
    /// Feed targets only: a Dual-Hopper, whose meals carry two portions.
    let dual: Bool
    var id: String { target }
}

/// What the schedules screen needs from the device detail.
struct SchedulesDevice: Equatable, Sendable {
    let name: String
    let isFeeder: Bool
    let targets: [ScheduleTargetInfo]
}

/// The device's own time zone (`getDeviceTimezone`).
struct DeviceZone: Equatable, Sendable {
    let clock: DeviceClock
    /// The IANA name the device reported, when it reported one.
    let locale: String?

    var label: String {
        let offset = ScheduleClock.format(offsetHours: clock.offsetHours)
        guard let locale, !locale.isEmpty else { return offset }
        return "\(locale), \(offset)"
    }
}

/// A pending one-off feed.
struct DeferredFeedItem: Identifiable, Equatable, Sendable {
    let id: String
    let hopper1: Int
    let hopper2: Int
    /// Unix seconds.
    let fireAt: Double
}

/// The schedule editor's state. Each block (device, time zone, one-off feeds)
/// loads and fails on its own; unsaved working copies live per target so a
/// refresh after another save never throws away rows somebody just added.
@MainActor
@Observable
final class SchedulesModel {
    /// The tab of the one-off feeds; no schedule target uses this name.
    static let oneOffTab = "__one-off"

    let deviceID: String
    var device: Loadable<SchedulesDevice> = .loading
    var zone: Loadable<DeviceZone> = .loading
    var deferred: Loadable<[DeferredFeedItem]> = .loading
    /// Unsaved working copies by target.
    var drafts: [String: ScheduleDraft] = [:]
    var selectedTab = ""
    /// The last save's outcome, in words.
    var notice: String?

    init(deviceID: String) {
        self.deviceID = deviceID
    }

    /// The numeric id the API takes, or nil for a malformed one.
    var numericID: Int? { Int(deviceID) }

    // MARK: Derived

    var tabs: [(id: String, title: String)] {
        guard let device = device.value else { return [] }
        var tabs = device.targets.map { ($0.target, drafts[$0.target] == nil ? $0.name : "\($0.name) •") }
        if device.isFeeder { tabs.append((Self.oneOffTab, L10n.string("One-off"))) }
        return tabs
    }

    /// The tab shown: the chosen one while it exists, else the first.
    var currentTab: String {
        let ids = tabs.map(\.id)
        return ids.contains(selectedTab) ? selectedTab : (ids.first ?? "")
    }

    var currentTarget: ScheduleTargetInfo? {
        device.value?.targets.first { $0.target == currentTab }
    }

    var feedTarget: ScheduleTargetInfo? {
        device.value?.targets.first { $0.kind == .feed }
    }

    /// The working copy, or the server's value while nothing has changed.
    func shown(_ target: ScheduleTargetInfo) -> ScheduleDraft {
        drafts[target.target] ?? ScheduleDraft(kind: target.kind, value: target.value)
    }

    func edit(_ target: ScheduleTargetInfo, _ change: (inout ScheduleDraft) -> Void) {
        var draft = shown(target)
        change(&draft)
        notice = nil
        // Back to what the server holds means nothing is unsaved any more.
        let served = ScheduleDraft(kind: target.kind, value: target.value)
        if draft.wire(current: target.value) == served.wire(current: target.value) {
            drafts[target.target] = nil
        } else {
            drafts[target.target] = draft
        }
    }

    func discard(_ target: ScheduleTargetInfo) {
        drafts[target.target] = nil
        notice = nil
    }

    // MARK: Loading

    func load(using session: ServerSession) async {
        guard let id = numericID else {
            let message = L10n.string("This device id is not one the server uses.")
            device = .failed(message)
            zone = .failed(message)
            deferred = .failed(message)
            return
        }
        async let deviceLoad: Void = loadDevice(id: id, session: session)
        async let zoneLoad: Void = loadZone(id: id, session: session)
        _ = await (deviceLoad, zoneLoad)
        if device.value?.isFeeder == true { await loadDeferred(using: session) }
    }

    func loadDevice(using session: ServerSession) async {
        guard let id = numericID else { return }
        await loadDevice(id: id, session: session)
    }

    func loadZone(using session: ServerSession) async {
        guard let id = numericID else { return }
        await loadZone(id: id, session: session)
    }

    private func loadDevice(id: Int, session: ServerSession) async {
        if device.value == nil { device = .loading }
        do {
            let detail = try await session.client.getDevice(path: .init(id: id)).ok.body.json
            let targets = try detail.schedules.map { target in
                ScheduleTargetInfo(target: target.target, name: target.name,
                                   kind: ScheduleKind(rawValue: target.kind.rawValue) ?? .ranges,
                                   value: try ScheduleJSON.converting(target.value), dual: target.dual ?? false)
            }
            device = .loaded(SchedulesDevice(name: detail.name, isFeeder: detail.isFeeder, targets: targets))
        } catch {
            device = .failed(Loadable<Void>.message(for: error))
        }
    }

    private func loadZone(id: Int, session: ServerSession) async {
        if zone.value == nil { zone = .loading }
        do {
            let view = try await session.client.getDeviceTimezone(path: .init(id: id)).ok.body.json
            zone = .loaded(DeviceZone(clock: DeviceClock(offsetHours: view.effective), locale: view.locale))
        } catch {
            zone = .failed(Loadable<Void>.message(for: error))
        }
    }

    func loadDeferred(using session: ServerSession) async {
        guard let id = numericID else { return }
        if deferred.value == nil { deferred = .loading }
        do {
            let list = try await session.client.listDeferredFeeds(path: .init(id: id)).ok.body.json.deferred
            deferred = .loaded(list.map {
                DeferredFeedItem(id: $0.id, hopper1: $0.a1, hopper2: $0.a2, fireAt: $0.fireAt)
            }.sorted { $0.fireAt < $1.fireAt })
        } catch {
            deferred = .failed(Loadable<Void>.message(for: error))
        }
    }

    // MARK: Writes (each runs from a confirm sheet, which shows any refusal)

    func save(_ target: ScheduleTargetInfo, using session: ServerSession) async throws {
        guard let id = numericID, let draft = drafts[target.target] else { return }
        if let problem = draft.problem { throw APIError(status: 400, code: "invalid_schedule", message: problem) }
        let value = try OpenAPIValueContainer.fromSchedule(draft.wire(current: target.value))
        let name = target.target
        let delivered = try await session.call(purpose: L10n.string("Save \(target.name) and send it to the device.")) {
            try await session.client.saveDeviceSchedule(
                path: .init(id: id), body: .json(.init(target: name, value: value))
            ).ok.body.json.delivered.rawValue
        }
        drafts[target.target] = nil
        notice = delivered == "mqtt"
            ? L10n.string("Saved and sent to the device.")
            : L10n.string("Saved.") + " " + L10n.string("The device picks it up on its next check-in.")
        await loadDevice(id: id, session: session)
    }

    func addDeferred(_ feed: DeferredFeedDraft, using session: ServerSession) async throws {
        guard let id = numericID else { return }
        _ = try await session.call(purpose: L10n.string("Schedule a one-off feed.")) {
            try await session.client.addDeferredFeed(
                path: .init(id: id),
                body: .json(.init(date: feed.date, time: feed.time, a1: feed.hopper1, a2: feed.hopper2))
            ).ok.body.json.ok
        }
        await loadDeferred(using: session)
    }

    func deleteDeferred(_ feed: DeferredFeedItem, using session: ServerSession) async throws {
        guard let id = numericID else { return }
        let feedID = feed.id
        _ = try await session.call(purpose: L10n.string("Delete a one-off feed.")) {
            try await session.client.deleteDeferredFeed(path: .init(id: id, feedId: feedID)).ok.body.json.ok
        }
        await loadDeferred(using: session)
    }
}

extension APIError {
    /// Thrown inside a confirm sheet when there is no server to send to; an
    /// `APIError` so the sheet shows this sentence rather than a generic one.
    static var notPaired: APIError {
        APIError(status: 0, code: "not_paired", message: L10n.string("This phone is not paired with a server."))
    }
}

extension OpenAPIValueContainer {
    /// The generated client's free-form JSON, from a schedule value.
    static func fromSchedule(_ value: ScheduleJSON) throws -> OpenAPIValueContainer {
        try JSONDecoder().decode(OpenAPIValueContainer.self, from: JSONEncoder().encode(value))
    }
}
