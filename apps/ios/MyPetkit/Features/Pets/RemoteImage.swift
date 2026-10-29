import PetkitCore
import SwiftUI
import UIKit

/// Server paths for pictures. The API hands out media paths relative to the
/// media root and face URLs without a leading slash; both become absolute
/// server paths here so `ServerSession.url(forPath:)` resolves them the same way.
enum MediaPath {
    /// `api/pets/1/faces/2/photo` or `/api/...` → `/api/...`.
    static func absolute(_ path: String) -> String {
        path.hasPrefix("/") ? path : "/" + path
    }

    /// The cached frame grab (or the still itself) for a media-root path.
    static func thumbnail(_ relative: String) -> String {
        "/api/media/thumb/" + encoded(relative)
    }

    /// The file itself, for a full-size still.
    static func file(_ relative: String) -> String {
        "/api/media/" + encoded(relative)
    }

    /// Folder names can hold `#` and spaces: encode each segment, keep the slashes.
    static func encoded(_ relative: String) -> String {
        var allowed = CharacterSet.urlPathAllowed
        allowed.remove(charactersIn: "/?#%")
        return relative
            .split(separator: "/", omittingEmptySubsequences: true)
            .map { String($0).addingPercentEncoding(withAllowedCharacters: allowed) ?? String($0) }
            .joined(separator: "/")
    }
}

/// A small in-memory cache of decoded pictures, keyed by server path. Thumbnails
/// and face photos repeat across rows and tabs; refetching each one on every
/// scroll costs a request through the pinned session for nothing.
@MainActor
final class MediaImageCache {
    static let shared = MediaImageCache()

    private let cache = NSCache<NSString, UIImage>()

    init() {
        cache.countLimit = 300
    }

    func image(for path: String) -> UIImage? {
        cache.object(forKey: path as NSString)
    }

    func store(_ image: UIImage, for path: String) {
        cache.setObject(image, forKey: path as NSString)
    }

    func remove(_ path: String) {
        cache.removeObject(forKey: path as NSString)
    }
}

/// A picture loaded over the paired session, filling whatever frame it is
/// given. The placeholder stays while loading, without a path, or when the
/// server has no such file (a thumbnail that ffmpeg could not grab is a 404).
struct RemoteImage<Placeholder: View>: View {
    @Environment(ServerSession.self) private var session
    /// An absolute server path (`/api/...`), or nil for the placeholder.
    let path: String?
    /// Fill and crop (thumbnails, avatars) or fit whole (a gallery still).
    var fills = true
    @ViewBuilder var placeholder: Placeholder

    @State private var loaded: UIImage?

    var body: some View {
        let image = loaded ?? path.flatMap { MediaImageCache.shared.image(for: $0) }
        Color.clear
            .overlay {
                if let image {
                    Image(uiImage: image).resizable().aspectRatio(contentMode: fills ? .fill : .fit)
                } else {
                    placeholder
                }
            }
            .clipped()
            .task(id: path) { await load() }
    }

    private func load() async {
        loaded = nil
        guard let path else { return }
        if let cached = MediaImageCache.shared.image(for: path) {
            loaded = cached
            return
        }
        guard let url = session.url(forPath: path) else { return }
        do {
            let data = try await session.data(at: url)
            guard let image = UIImage(data: data) else { return }
            MediaImageCache.shared.store(image, for: path)
            loaded = image
        } catch {
            // The placeholder already says "no picture"; a missing thumbnail
            // is normal (no ffmpeg, a clip not yet written) and not an error.
        }
    }
}
