import CoreGraphics

/// Geometry of the face cropper: a fixed square frame with the photo panning
/// and zooming underneath it, the way every avatar cropper works. Shared rules
/// with the web cropper (`crop-geometry.ts`): the export is always
/// `faceSize`², the size the device's NPU is fed, so the server's normaliser
/// passes our crop through untouched.
struct PetCropGeometry: Equatable {
    /// The size the NPU is fed; every face PetKit's own cloud served was this.
    static let faceSize: CGFloat = 224
    /// The zoom ceiling as a multiple of "cover", so it means the same for a
    /// 12 MP photo and a small crop.
    static let maxZoom: CGFloat = 8
    /// JPEG quality of the uploaded crop.
    static let jpegQuality: CGFloat = 0.92

    /// Natural size of the photo, in points of the oriented image.
    let imageSize: CGSize
    /// Side of the square frame on screen.
    let frameSide: CGFloat
    /// Frame points per photo point.
    private(set) var scale: CGFloat
    /// The smallest scale at which the photo still covers the frame.
    let minScale: CGFloat
    /// Top-left of the photo relative to the frame's top-left.
    private(set) var origin: CGPoint

    /// The view that just covers the frame, centred.
    init(imageSize: CGSize, frameSide: CGFloat) {
        let width = max(imageSize.width, 1)
        let height = max(imageSize.height, 1)
        self.imageSize = CGSize(width: width, height: height)
        self.frameSide = frameSide
        minScale = max(frameSide / width, frameSide / height)
        scale = minScale
        origin = CGPoint(x: (frameSide - width * minScale) / 2, y: (frameSide - height * minScale) / 2)
        clamp()
    }

    var maxScale: CGFloat { minScale * Self.maxZoom }

    /// Displayed size of the photo.
    var displayedSize: CGSize {
        CGSize(width: imageSize.width * scale, height: imageSize.height * scale)
    }

    /// The zoom as a slider shows it: 100 at cover, 800 at the ceiling.
    var zoomPercent: Int { Int((scale / minScale * 100).rounded()) }

    /// Keep the photo covering the frame on every pan and zoom; otherwise the
    /// exported JPEG would have a blank edge.
    private mutating func clamp() {
        let size = displayedSize
        origin.x = min(0, max(frameSide - size.width, origin.x))
        origin.y = min(0, max(frameSide - size.height, origin.y))
    }

    /// Move the photo by a frame-point delta.
    func panned(by delta: CGSize) -> PetCropGeometry {
        var next = self
        next.origin.x += delta.width
        next.origin.y += delta.height
        next.clamp()
        return next
    }

    /// Zoom to `newScale` about `anchor` (frame points) so the thing being
    /// looked at stays put instead of sliding away.
    func zoomed(to newScale: CGFloat, anchor: CGPoint) -> PetCropGeometry {
        var next = self
        let target = min(maxScale, max(minScale, newScale))
        let ratio = target / scale
        next.scale = target
        next.origin.x = anchor.x - (anchor.x - origin.x) * ratio
        next.origin.y = anchor.y - (anchor.y - origin.y) * ratio
        next.clamp()
        return next
    }

    /// Where to draw the whole photo on a square canvas `side` points wide so
    /// the canvas shows exactly what the frame shows.
    func drawRect(onCanvas side: CGFloat = PetCropGeometry.faceSize) -> CGRect {
        let k = side / frameSide
        let size = displayedSize
        return CGRect(x: origin.x * k, y: origin.y * k, width: size.width * k, height: size.height * k)
    }

    /// The part of the photo inside the frame, in photo points.
    var visibleRect: CGRect {
        CGRect(x: -origin.x / scale, y: -origin.y / scale, width: frameSide / scale, height: frameSide / scale)
    }
}
