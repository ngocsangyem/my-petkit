import PetkitCore
import SwiftUI

/// What a card asks the screen to open.
enum TimelineAction {
    case play(title: String, sources: [TimelineVideoSource])
    case gallery(TimelineFormat.StillGroup)
    case detail(TimelineEntry)
    /// "Who used the box?" for a stored visit.
    case changeCat(TimelineEntry)
}

/// The 36pt leading mark of a card: the pet's photo, a "?" for a visit
/// nobody was named for, else the device drawing.
struct TimelineLeadingMark: View {
    let entry: TimelineEntry
    let tintIndex: Int
    let deviceType: String?

    var body: some View {
        if let name = entry.petName, !name.isEmpty {
            PetPhoto(name: name, photoPath: entry.petPhotoPath, tintIndex: tintIndex)
                .frame(width: 36, height: 36)
                .clipShape(Circle())
        } else if entry.isVisit {
            Text("?").font(Theme.Font.bodyMedium).foregroundStyle(Theme.Color.muted)
                .frame(width: 36, height: 36)
                .background(Theme.Color.raised, in: Circle())
                .accessibilityHidden(true)
        } else {
            DeviceDrawing(kind: DeviceKind(deviceType: deviceType ?? ""), height: 30)
                .frame(width: 36, height: 36)
                .accessibilityHidden(true)
        }
    }
}

/// The notes under a card's meta line about its video.
struct TimelineVideoNote: View {
    let media: TimelineMedia

    var body: some View {
        if TimelineFormat.isAssembling(media) {
            Text("Assembling video…").font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
        } else if TimelineFormat.isTransportStreamOnly(media) {
            Text("Saved as .ts, which iPhone cannot play.").font(Theme.Font.extraSmall)
                .foregroundStyle(Theme.Color.muted)
        } else if TimelineFormat.isPlaybackPending(media) {
            Text("Full playback still processing…").font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
        }
    }
}

/// "2 waste photos", "1 stool photo": each opens its gallery.
struct TimelineStillPills: View {
    let entry: TimelineEntry
    let open: (TimelineAction) -> Void

    var body: some View {
        let groups = TimelineFormat.stillGroups(entry)
        if !groups.isEmpty {
            HStack(spacing: 8) {
                ForEach(groups) { group in
                    Button { open(.gallery(group)) } label: { Pill(text: group.pill) }
                        .buttonStyle(.plain)
                        .accessibilityHint("Opens the photos")
                }
            }
        }
    }
}

/// The latest visit as a large video card.
struct TimelineLatestCard: View {
    let entry: TimelineEntry
    let tzOffset: Int
    let tintIndex: Int
    let open: (TimelineAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            poster
            Button { open(.detail(entry)) } label: {
                HStack(spacing: 12) {
                    TimelineLeadingMark(entry: entry, tintIndex: tintIndex, deviceType: nil)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(TimelineFormat.sentence(entry)).font(Theme.Font.bodyMedium.weight(.semibold))
                            .foregroundStyle(Theme.Color.text)
                        TimelineMetaLine(entry: entry, tzOffset: tzOffset)
                        TimelineVideoNote(media: entry.media)
                    }
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, Theme.Space.pad)
                .padding(.top, 12)
                .padding(.bottom, 14)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .modifier(TimelineChangeCatMenu(entry: entry, open: open))
            TimelineStillPills(entry: entry, open: open)
                .padding(.horizontal, Theme.Space.pad)
                .padding(.bottom, 14)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.card))
    }

    private var poster: some View {
        let playable = TimelineFormat.playableSources(entry.media)
        return RemoteImage(path: TimelineFormat.posterPath(entry.media).map(MediaPath.thumbnail)) {
            Theme.Color.raised
        }
        .frame(height: 200)
        .overlay {
            if !playable.isEmpty {
                Button {
                    open(.play(title: TimelineFormat.sentence(entry), sources: playable))
                } label: {
                    Image(systemName: "play.fill")
                        .font(Theme.Font.iconLarge)
                        .foregroundStyle(Theme.Color.text)
                        .frame(width: 52, height: 52)
                        .background(Theme.Color.surface, in: Circle())
                }
                .accessibilityLabel("Play the video")
            } else if TimelineFormat.isAssembling(entry.media) {
                TimelinePhotoLabel(text: L10n.string("Assembling video…"))
            }
        }
        .overlay(alignment: .bottomTrailing) {
            if !playable.isEmpty, let length = TimelineFormat.clipLength(entry.durationSec) {
                TimelinePhotoLabel(text: length).padding(12)
            }
        }
        .clipShape(UnevenRoundedRectangle(topLeadingRadius: Theme.Radius.card, topTrailingRadius: Theme.Radius.card))
    }
}

/// The one overlay allowed on a photo: a dark pill label.
struct TimelinePhotoLabel: View {
    let text: String

    var body: some View {
        Text(text)
            .font(Theme.Font.pill)
            .monospacedDigit()
            .foregroundStyle(Theme.Color.liveText)
            .padding(.horizontal, 9)
            .frame(height: Theme.Space.pill)
            .background(Theme.Color.photoLabel, in: Capsule())
    }
}

/// One card row with a 76×56 thumbnail.
struct TimelineRow: View {
    let entry: TimelineEntry
    let tzOffset: Int
    let tintIndex: Int
    let deviceType: String?
    let open: (TimelineAction) -> Void

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Button { open(.detail(entry)) } label: {
                    HStack(spacing: 12) {
                        TimelineLeadingMark(entry: entry, tintIndex: tintIndex, deviceType: deviceType)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(TimelineFormat.sentence(entry)).font(Theme.Font.bodyMedium)
                                .foregroundStyle(TimelineFormat.isAlert(entry) ? Theme.Color.negative : Theme.Color.text)
                            TimelineMetaLine(entry: entry, tzOffset: tzOffset)
                            TimelineVideoNote(media: entry.media)
                        }
                        Spacer(minLength: 0)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .modifier(TimelineChangeCatMenu(entry: entry, open: open))
                TimelineStillPills(entry: entry, open: open).padding(.leading, 48)
            }
            thumbnail
        }
        .padding(.vertical, 10)
        .frame(minHeight: 72)
    }

    @ViewBuilder
    private var thumbnail: some View {
        let playable = TimelineFormat.playableSources(entry.media)
        if let poster = TimelineFormat.posterPath(entry.media) {
            Button {
                if !playable.isEmpty {
                    open(.play(title: TimelineFormat.sentence(entry), sources: playable))
                } else {
                    open(.detail(entry))
                }
            } label: {
                RemoteImage(path: MediaPath.thumbnail(poster)) { Theme.Color.raised }
                    .frame(width: 76, height: 56)
                    .overlay {
                        if !playable.isEmpty {
                            Image(systemName: "play.fill")
                                .font(Theme.Font.chevron)
                                .foregroundStyle(Theme.Color.text)
                                .frame(width: 26, height: 26)
                                .background(Theme.Color.surface, in: Circle())
                        }
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            .buttonStyle(.plain)
            .accessibilityLabel(playable.isEmpty ? L10n.string("Open the event") : L10n.string("Play the video"))
        }
    }
}
