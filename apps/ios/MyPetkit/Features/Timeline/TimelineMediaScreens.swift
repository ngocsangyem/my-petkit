import AVKit
import PetkitCore
import SwiftUI

/// A full-screen presentation a card can open.
enum TimelineCover: Identifiable {
    case play(title: String, sources: [TimelineVideoSource])
    case gallery(TimelineFormat.StillGroup)

    /// Nil for the actions that are not full-screen (the sheets).
    init?(_ action: TimelineAction) {
        switch action {
        case .play(let title, let sources): self = .play(title: title, sources: sources)
        case .gallery(let group): self = .gallery(group)
        case .detail, .changeCat: return nil
        }
    }

    var id: String {
        switch self {
        case .play(_, let sources): "play-" + sources.map(\.path).joined(separator: "|")
        case .gallery(let group): "gallery-" + group.paths.joined(separator: "|")
        }
    }
}

extension View {
    /// Presents the player or the photo pager for `cover`.
    func timelineCovers(_ cover: Binding<TimelineCover?>) -> some View {
        fullScreenCover(item: cover) { item in
            switch item {
            case .play(let title, let sources): TimelinePlayerScreen(title: title, sources: sources)
            case .gallery(let group): TimelineGalleryScreen(group: group)
            }
        }
    }
}

/// Full-screen playback of a session's video. Each source is fetched through
/// a five-minute signed URL and played through `playerAsset(for:)`, which
/// routes a pinned server through the pinned loader (AVPlayer would otherwise
/// refuse the self-signed certificate).
struct TimelinePlayerScreen: View {
    @Environment(ServerSession.self) private var session
    @Environment(\.dismiss) private var dismiss
    let title: String
    let sources: [TimelineVideoSource]

    @State private var selected: TimelineVideoSource.Label
    @State private var player: AVPlayer?
    @State private var error: String?

    init(title: String, sources: [TimelineVideoSource]) {
        self.title = title
        self.sources = sources
        _selected = State(initialValue: sources.first?.label ?? .clip)
    }

    var body: some View {
        VStack(spacing: 14) {
            HStack {
                Text(title).font(Theme.Font.section).foregroundStyle(Theme.Color.liveText)
                    .accessibilityAddTraits(.isHeader)
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(Theme.Font.icon)
                        .foregroundStyle(Theme.Color.liveText)
                        .frame(width: Theme.Space.control, height: Theme.Space.control)
                        .background(Theme.Color.liveControl, in: Circle())
                }
                .accessibilityLabel("Close")
            }
            .padding(.horizontal, Theme.Space.headerEdge)
            Spacer(minLength: 0)
            Group {
                if let player {
                    VideoPlayer(player: player)
                } else if let error {
                    Text(error).font(Theme.Font.body).foregroundStyle(Theme.Color.liveText)
                        .multilineTextAlignment(.center).padding(Theme.Space.pad)
                } else {
                    ProgressView().tint(Theme.Color.liveText)
                }
            }
            .frame(maxWidth: .infinity)
            .aspectRatio(16 / 9, contentMode: .fit)
            Spacer(minLength: 0)
            if sources.count > 1 {
                SegmentedPills(options: sources.map { ($0.label, $0.label.rawValue) }, selection: $selected)
                    .padding(.horizontal, Theme.Space.headerEdge)
            }
        }
        .padding(.vertical, Theme.Space.pad)
        .background(Theme.Color.liveGround.ignoresSafeArea())
        .task(id: selected) { await load() }
        .onDisappear { player?.pause() }
    }

    private func load() async {
        player?.pause()
        player = nil
        error = nil
        guard let source = sources.first(where: { $0.label == selected }) else { return }
        do {
            let url = try await session.signedMediaURL(path: source.path)
            guard let asset = session.playerAsset(for: url) else {
                error = "This video cannot be played on this phone."
                return
            }
            let next = AVPlayer(playerItem: AVPlayerItem(asset: asset))
            player = next
            next.play()
        } catch is CancellationError {
            return
        } catch {
            self.error = Loadable<Void>.message(for: error)
        }
    }
}

/// Full-screen pager over a session's waste or stool photos.
struct TimelineGalleryScreen: View {
    @Environment(\.dismiss) private var dismiss
    let group: TimelineFormat.StillGroup
    @State private var page = 0

    var body: some View {
        VStack(spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(group.title).font(Theme.Font.section).foregroundStyle(Theme.Color.liveText)
                        .accessibilityAddTraits(.isHeader)
                    Text("\(page + 1) of \(group.paths.count)").font(Theme.Font.small).monospacedDigit()
                        .foregroundStyle(Theme.Color.liveText.opacity(0.7))
                }
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(Theme.Font.icon)
                        .foregroundStyle(Theme.Color.liveText)
                        .frame(width: Theme.Space.control, height: Theme.Space.control)
                        .background(Theme.Color.liveControl, in: Circle())
                }
                .accessibilityLabel("Close")
            }
            .padding(.horizontal, Theme.Space.headerEdge)
            TabView(selection: $page) {
                ForEach(Array(group.paths.enumerated()), id: \.offset) { index, path in
                    RemoteImage(path: MediaPath.file(path), fills: false) {
                        ProgressView().tint(Theme.Color.liveText)
                    }
                    .accessibilityLabel("\(group.title) photo \(index + 1)")
                    .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: group.paths.count > 1 ? .always : .never))
        }
        .padding(.vertical, Theme.Space.pad)
        .background(Theme.Color.liveGround.ignoresSafeArea())
    }
}

#Preview("Gallery") {
    PetsPreview.wrap {
        TimelineGalleryScreen(group: .init(title: "Check waste", pill: "2 waste photos",
                                           paths: ["waste/a.jpg", "waste/b.jpg"]))
    }
}

#Preview("Player") {
    PetsPreview.wrap {
        TimelinePlayerScreen(title: "Miso used the litter box",
                             sources: [.init(label: .clip, path: "clips/a.mp4"),
                                       .init(label: .playback, path: "playback/a.m3u8")])
    }
}
