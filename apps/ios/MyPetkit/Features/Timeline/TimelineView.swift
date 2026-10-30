import PetkitCore
import SwiftUI

/// The Timeline tab: one server day of visits and events, newest first. The
/// latest visit is a large video card; the rest are rows with a thumbnail.
struct TimelineView: View {
    @State private var model: TimelineModel

    init() {
        _model = State(initialValue: TimelineModel())
    }

    init(model: TimelineModel) {
        _model = State(initialValue: model)
    }

    var body: some View {
        TimelineScreen(model: model)
    }
}

private struct TimelineScreen: View {
    @Environment(ServerSession.self) private var session
    @Environment(TabRouter.self) private var router
    let model: TimelineModel

    @State private var cover: TimelineCover?
    @State private var detail: TimelineEntry?
    @State private var changeCat: TimelineEntry?

    var body: some View {
        ScreenScroll {
            ScreenHeader(title: "Timeline", lede: lede) { dayPicker }
        } content: {
            chipRow
            LoadableBlock(state: model.day, loadingHeight: 200, retry: retryDay) { day in
                dayContent(day)
            }
        }
        .refreshable { await model.load() }
        .toolbar(.hidden, for: .navigationBar)
        .task {
            model.attach(session)
            model.prefer(requestedDeviceID: router.timelineDeviceID)
            router.timelineDeviceID = nil
            await model.load()
        }
        .onChange(of: router.timelineDeviceID) { _, requested in
            guard requested != nil else { return }
            router.timelineDeviceID = nil
            Task { await model.apply(requestedDeviceID: requested) }
        }
        .onChange(of: session.lastEvent) { _, event in model.liveEventArrived(event) }
        .sheet(item: $detail) { entry in
            TimelineDetailSheet(entry: entry, tzOffset: model.day.value?.tzOffset ?? 0,
                                tintIndex: model.petTint(id: entry.petID),
                                deviceType: model.device(id: entry.deviceID)?.deviceType,
                                loadDetail: { try await model.eventDetail(id: $0) },
                                catCandidates: model.catCandidates(for: entry),
                                saveCat: { try await model.setVisitPet(entry, $0) })
        }
        .sheet(item: $changeCat) { entry in
            TimelineChangeCatSheet(entry: entry, tzOffset: model.day.value?.tzOffset ?? 0,
                                   candidates: model.catCandidates(for: entry),
                                   save: { try await model.setVisitPet(entry, $0) })
        }
        .timelineCovers($cover)
    }

    private func retryDay() {
        Task { await model.loadDay() }
    }

    private var lede: String? {
        model.day.value.flatMap { TimelineFormat.daySummary($0, isToday: model.isToday) }
    }

    private var dayPicker: some View {
        Menu {
            ForEach(model.pickerDates, id: \.self) { date in
                Button(TimelineFormat.dayTitle(date, today: model.serverToday)) {
                    Task { await model.select(date: date) }
                }
            }
        } label: {
            HStack(spacing: 6) {
                Text(model.dayTitle).font(Theme.Font.control).monospacedDigit()
                Image(systemName: "chevron.right").font(Theme.Font.chevron).accessibilityHidden(true)
            }
            .foregroundStyle(Theme.Color.text)
            .padding(.horizontal, 14)
            .frame(height: Theme.Space.chip)
            .background(Theme.Color.surface, in: Capsule())
        }
        .disabled(model.pickerDates.isEmpty)
        .accessibilityLabel("Day: \(model.dayTitle)")
        .accessibilityHint("Choose another day")
    }

    private var chipRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(model.chips) { chip in
                    TimelineFilterChip(chip: chip, isSelected: model.filter == chip.filter) {
                        Task { await model.select(chip.filter) }
                    }
                }
            }
        }
        .scrollClipDisabled()
    }

    @ViewBuilder
    private func dayContent(_ day: TimelineDayResult) -> some View {
        let latest = day.entries.first(where: \.isVisit)
        let rest = day.entries.filter { $0.id != latest?.id }
        if day.entries.isEmpty {
            Card {
                EmptyBlock(title: "Nothing on this day",
                           message: "No visits or events were stored for \(TimelineFormat.dayTitle(day.date, today: model.serverToday)).")
                    .padding(.vertical, 24)
            }
        }
        if let latest {
            TimelineLatestCard(entry: latest, tzOffset: day.tzOffset, tintIndex: model.petTint(id: latest.petID),
                               open: open)
        }
        if !rest.isEmpty {
            VStack(spacing: 0) {
                ForEach(Array(rest.enumerated()), id: \.element.id) { index, entry in
                    if index > 0 { RowRule() }
                    TimelineRow(entry: entry, tzOffset: day.tzOffset, tintIndex: model.petTint(id: entry.petID),
                                deviceType: model.device(id: entry.deviceID)?.deviceType, open: open)
                }
            }
            .padding(.horizontal, Theme.Space.pad)
            .padding(.vertical, 4)
            .background(Theme.Color.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
        }
    }

    private func open(_ action: TimelineAction) {
        switch action {
        case .detail(let entry): detail = entry
        case .changeCat(let entry): changeCat = entry
        case .play, .gallery: cover = TimelineCover(action)
        }
    }

}

/// A 36pt filter chip; pets carry their photo.
struct TimelineFilterChip: View {
    let chip: TimelineChip
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if case .pet = chip.filter {
                    PetPhoto(name: chip.title, photoPath: chip.photoPath, tintIndex: chip.tintIndex)
                        .frame(width: 22, height: 22)
                        .clipShape(Circle())
                        .accessibilityHidden(true)
                }
                Text(chip.title).font(Theme.Font.control).lineLimit(1)
            }
            .padding(.leading, isPet ? 7 : 14)
            .padding(.trailing, 14)
            .frame(height: Theme.Space.chip)
            .foregroundStyle(isSelected ? Theme.Color.onPrimary : Theme.Color.text)
            .background(isSelected ? Theme.Color.text : Theme.Color.surface, in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private var isPet: Bool {
        if case .pet = chip.filter { true } else { false }
    }
}

#Preview {
    PetsPreview.wrap {
        TimelineView(model: TimelineModel(fixture: TimelineFixtures.day, pets: TimelineFixtures.pets,
                                          devices: TimelineFixtures.devices))
    }
}
