import PetkitCore
import SwiftUI

/// One card opened: its steps, its media and what the server stored about
/// the event (`getTimelineEventDetail`). Device strings render as text only.
struct TimelineDetailSheet: View {
    let entry: TimelineEntry
    let tzOffset: Int
    let tintIndex: Int
    let deviceType: String?
    /// Loads the stored detail; nil in previews.
    let loadDetail: ((Int) async throws -> TimelineEventDetail)?
    /// Pets offered by "Change cat", and what saves the answer; nil hides it.
    var catCandidates: [TimelineCatCandidate] = []
    var saveCat: ((TimelineVisitPetRequest) async throws -> Void)?

    @Environment(\.dismiss) private var dismiss
    @State private var changingCat = false
    /// The header still names the old cat once a change is saved, so the
    /// detail closes with the change sheet; the day behind shows the new one.
    @State private var savedChange = false

    @State private var cover: TimelineCover?
    @State private var detail: Loadable<TimelineEventDetail> = .loading
    @State private var showsLowLevel = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Space.gap) {
                header
                media
                if !entry.steps.isEmpty { steps }
                if let eventID = entry.eventID, let loadDetail {
                    debugInfo(eventID: eventID, load: loadDetail)
                }
            }
            .padding(Theme.Space.screenEdge)
        }
        .background(Theme.Color.ground)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(Theme.Radius.sheetTop)
        .timelineCovers($cover)
        .sheet(isPresented: $changingCat, onDismiss: closeIfChanged) {
            if let saveCat {
                TimelineChangeCatSheet(entry: entry, tzOffset: tzOffset, candidates: catCandidates) { request in
                    try await saveCat(request)
                    savedChange = true
                }
            }
        }
    }

    private func closeIfChanged() {
        if savedChange { dismiss() }
    }

    private func open(_ action: TimelineAction) {
        cover = TimelineCover(action)
    }

    private var header: some View {
        HStack(spacing: 12) {
            TimelineLeadingMark(entry: entry, tintIndex: tintIndex, deviceType: deviceType)
            VStack(alignment: .leading, spacing: 2) {
                Text(TimelineFormat.sentence(entry)).font(Theme.Font.section)
                    .foregroundStyle(TimelineFormat.isAlert(entry) ? Theme.Color.negative : Theme.Color.text)
                    .accessibilityAddTraits(.isHeader)
                TimelineMetaLine(entry: entry, tzOffset: tzOffset)
            }
            Spacer(minLength: 8)
            if saveCat != nil, TimelineChangeCatRules.canChange(entry) {
                Button("Change cat") { changingCat = true }
                    .font(Theme.Font.control)
                    .foregroundStyle(Theme.Color.text)
                    .padding(.horizontal, 14)
                    .frame(height: Theme.Space.chip)
                    .background(Theme.Color.surface, in: Capsule())
            }
        }
        .padding(.top, 8)
    }

    @ViewBuilder
    private var media: some View {
        let playable = TimelineFormat.playableSources(entry.media)
        let stills = TimelineFormat.stillGroups(entry)
        if !playable.isEmpty || !stills.isEmpty || TimelineFormat.isAssembling(entry.media)
            || TimelineFormat.isTransportStreamOnly(entry.media) {
            Card {
                if !playable.isEmpty {
                    Button(playable[0].label.playTitle) {
                        open(.play(title: TimelineFormat.sentence(entry), sources: playable))
                    }
                    .buttonStyle(.primary)
                }
                TimelineVideoNote(media: entry.media)
                TimelineStillPills(entry: entry, open: open)
            }
        }
    }

    private var steps: some View {
        let main = entry.steps.filter { !$0.isDetail }
        let lowLevel = entry.steps.filter(\.isDetail)
        return Card {
            Text("Steps").font(Theme.Font.section).accessibilityAddTraits(.isHeader)
            ForEach(main) { step in stepRow(step) }
            if !lowLevel.isEmpty {
                Button(showsLowLevel ? L10n.string("Hide low-level steps") : L10n.string("Show \(lowLevel.count) low-level steps")) {
                    showsLowLevel.toggle()
                }
                .font(Theme.Font.control)
                .foregroundStyle(Theme.Color.accent)
                if showsLowLevel {
                    ForEach(lowLevel) { step in stepRow(step) }
                }
            }
        }
    }

    private func stepRow(_ step: TimelineStep) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text(TimelineFormat.clock(step.ts, tzOffset: tzOffset) ?? "—")
                .font(Theme.Font.small).monospacedDigit().foregroundStyle(Theme.Color.muted)
                .frame(width: 44, alignment: .leading)
            Text(TimelineFormat.stepLabel(step)).font(Theme.Font.body).foregroundStyle(Theme.Color.text)
            Spacer(minLength: 0)
        }
    }

    private func debugInfo(eventID: Int, load: @escaping (Int) async throws -> TimelineEventDetail) -> some View {
        Card {
            Text("Debug info").font(Theme.Font.section).accessibilityAddTraits(.isHeader)
            LoadableBlock(state: detail, loadingHeight: 60, retry: retryDetail) { detail in
                VStack(alignment: .leading, spacing: 10) {
                    fieldList(detail.fields)
                    if !detail.code.isEmpty {
                        Text("Code table").font(Theme.Font.smallMedium).foregroundStyle(Theme.Color.muted)
                        fieldList(detail.code)
                    }
                    if !detail.decoded.isEmpty {
                        Text("Decoded").font(Theme.Font.smallMedium).foregroundStyle(Theme.Color.muted)
                        fieldList(detail.decoded)
                    }
                }
            }
        }
        .task(id: eventID) { await fetch(eventID, load) }
    }

    private func fieldList(_ fields: [TimelineEventDetail.Field]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(fields) { field in
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    Text(field.label).font(Theme.Font.small).foregroundStyle(Theme.Color.muted)
                        .frame(width: 120, alignment: .leading)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(field.value).font(Theme.Font.mono).foregroundStyle(Theme.Color.text)
                            .textSelection(.enabled)
                        if let note = field.note {
                            Text(note).font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
                        }
                    }
                }
            }
        }
    }

    private func retryDetail() {
        guard let id = entry.eventID, let loadDetail else { return }
        Task { await fetch(id, loadDetail) }
    }

    private func fetch(_ id: Int, _ load: (Int) async throws -> TimelineEventDetail) async {
        detail = .loading
        do {
            detail = .loaded(try await load(id))
        } catch {
            detail = .failed(Loadable<Void>.message(for: error))
        }
    }
}

#Preview {
    PetsPreview.wrap {
        TimelineDetailSheet(entry: TimelineFixtures.day.entries[0], tzOffset: 25_200, tintIndex: 0,
                            deviceType: "t6", loadDetail: { _ in TimelineFixtures.detail })
    }
}
