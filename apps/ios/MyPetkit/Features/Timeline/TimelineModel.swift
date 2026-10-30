import Foundation
import Observation
import PetkitCore

/// State of the Timeline tab: which server day, which chip, and the day's
/// cards. Pets and devices only name the chips; when they fail the row shows
/// just "All" and the day still loads.
@MainActor
@Observable
final class TimelineModel {
    private(set) var day: Loadable<TimelineDayResult> = .loading
    private(set) var pets: [TimelineSubject] = []
    private(set) var devices: [TimelineSubject] = []
    private(set) var filter: TimelineFilter = .all
    /// The day asked for; nil means the server's today.
    private(set) var date: String?
    /// The server's today, learned from the first answer for "today".
    private(set) var serverToday: String?

    /// How many days back the picker offers.
    static let pickerDays = 14
    /// Kinds of live event that change what the day shows.
    static let refreshKinds: Set<String> = ["media", "event"]

    @ObservationIgnored private let isFixture: Bool
    @ObservationIgnored private var api: TimelineAPI?
    /// Drops an answer that arrives after a newer request was made.
    @ObservationIgnored private var generation = 0
    @ObservationIgnored private var refreshTask: Task<Void, Never>?

    init() {
        isFixture = false
    }

    init(fixture: TimelineDayResult, pets: [TimelineSubject], devices: [TimelineSubject]) {
        isFixture = true
        day = .loaded(fixture)
        self.pets = pets
        self.devices = devices
        serverToday = fixture.date
        date = fixture.date
    }

    var chips: [TimelineChip] {
        TimelineFilterRules.chips(pets: pets, devices: devices, passingCount: TimelineFilterRules.passingChipCount(
            dayCount: day.value?.passingCount, filter: filter))
    }

    /// The household pets offered for a visit, nearest weight first.
    func catCandidates(for entry: TimelineEntry) -> [TimelineCatCandidate] {
        TimelineChangeCatRules.candidates(pets: pets, visitGrams: TimelineChangeCatRules.visitGrams(entry))
    }

    var shownDate: String? { day.value?.date ?? date ?? serverToday }

    var isToday: Bool { shownDate != nil && shownDate == serverToday }

    var dayTitle: String {
        guard let shown = shownDate else { return "Today" }
        return TimelineFormat.dayTitle(shown, today: serverToday)
    }

    /// Today first, then the previous days, as server day names.
    var pickerDates: [String] {
        guard let today = serverToday else { return [] }
        return (0..<Self.pickerDays).compactMap { TimelineFormat.shiftDay(today, by: -$0) }
    }

    func device(id: Int?) -> TimelineSubject? {
        devices.first { $0.id == id }
    }

    func petTint(id: Int?) -> Int {
        pets.firstIndex { $0.id == id } ?? 0
    }

    func attach(_ session: ServerSession) {
        if api == nil { api = TimelineAPI(session: session) }
    }

    func load() async {
        guard !isFixture, let api else { return }
        async let subjects: Void = loadSubjects(api)
        async let day: Void = loadDay()
        _ = await (subjects, day)
    }

    private func loadSubjects(_ api: TimelineAPI) async {
        async let loadedPets = try? api.pets()
        async let loadedDevices = try? api.devices()
        let (newPets, newDevices) = await (loadedPets, loadedDevices)
        pets = newPets ?? pets
        devices = newDevices ?? devices
        // Only reconcile against lists that actually loaded; a failed list
        // would otherwise throw away a selection that is still valid.
        guard newPets != nil, newDevices != nil else { return }
        let reconciled = TimelineFilterRules.reconciled(filter, chips: chips)
        if reconciled != filter {
            filter = reconciled
            await loadDay()
        }
    }

    func loadDay() async {
        guard !isFixture, let api else { return }
        generation += 1
        let mine = generation
        if day.value == nil { day = .loading }
        do {
            let result = try await api.day(date: date, query: TimelineFilterRules.query(for: filter))
            guard mine == generation else { return }
            if date == nil { serverToday = result.date }
            day = .loaded(result)
        } catch is CancellationError {
            return
        } catch {
            guard mine == generation else { return }
            day = .failed(Loadable<Void>.message(for: error))
        }
    }

    func select(_ filter: TimelineFilter) async {
        guard filter != self.filter else { return }
        self.filter = filter
        day = .loading
        await loadDay()
    }

    func select(date: String) async {
        self.date = date == serverToday ? nil : date
        day = .loading
        await loadDay()
    }

    /// Starts on the device another tab asked for, before the first load.
    func prefer(requestedDeviceID: String?) {
        if let requested = TimelineFilterRules.requested(deviceID: requestedDeviceID) { filter = requested }
    }

    /// A device another tab asked to show while the screen is already loaded.
    func apply(requestedDeviceID: String?) async {
        guard let requested = TimelineFilterRules.requested(deviceID: requestedDeviceID) else { return }
        await select(requested)
    }

    /// Refetch shortly after a new event or a media file lands. Media turns
    /// ready (and a stitched video stops assembling) well after the request
    /// that caused it; bursts collapse into one request.
    func liveEventArrived(_ event: LiveEvent?) {
        guard let event, Self.refreshKinds.contains(event.kind), !isFixture else { return }
        refreshTask?.cancel()
        refreshTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(400))
            guard !Task.isCancelled else { return }
            await self?.loadDay()
        }
    }

    /// Names the cat of a visit, then reloads the day; the pets too when a
    /// registered weight or an identity changed with it.
    func setVisitPet(_ entry: TimelineEntry, _ request: TimelineVisitPetRequest) async throws {
        guard let api, let eventID = entry.eventID else { throw URLError(.cannotConnectToHost) }
        try await api.setVisitPet(eventID: eventID, request)
        if request.useWeight || request.applyToRef {
            async let subjects: Void = loadSubjects(api)
            async let day: Void = loadDay()
            _ = await (subjects, day)
        } else {
            await loadDay()
        }
    }

    func eventDetail(id: Int) async throws -> TimelineEventDetail {
        guard let api else { throw URLError(.cannotConnectToHost) }
        return try await api.eventDetail(id: id)
    }
}
