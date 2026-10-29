import PetkitCore
import SwiftUI
import UIKit

/// What PetKit's own app tells its users: the conditions the matcher was
/// tuned for. A photo that breaks one costs accuracy on every future visit.
enum PetFaceRules {
    static let rules: [(ok: Bool, text: String)] = [
        (true, "Front view, both eyes visible, looking at the camera"),
        (true, "The whole head in frame, evenly lit"),
        (false, "No side or three-quarter views"),
        (false, "No night-vision or infrared shots"),
        (false, "No backlighting: the face must not be in shadow"),
        (false, "Nothing covering the face"),
        (false, "One cat per photo"),
    ]

    /// The 224² JPEG of what the frame shows. `UIImage.draw` honours the
    /// photo's orientation, so a camera shot comes out upright.
    static func jpeg(of image: UIImage, geometry: PetCropGeometry) -> Data? {
        let side = PetCropGeometry.faceSize
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: side, height: side), format: format)
        return renderer.jpegData(withCompressionQuality: PetCropGeometry.jpegQuality) { _ in
            image.draw(in: geometry.drawRect(onCanvas: side))
        }
    }
}

/// Square frame over a photo that pans and zooms underneath it; the result
/// is uploaded as the raw 224² JPEG the server stores for the device.
struct PetFaceCropperView: View {
    @Environment(\.dismiss) private var dismiss
    let image: UIImage
    let petName: String
    let upload: @MainActor (Data) async throws -> Void

    @State private var geometry: PetCropGeometry?
    @State private var dragBase: PetCropGeometry?
    @State private var zoomBase: PetCropGeometry?
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("Crop \(petName)'s face").font(Theme.Font.section).accessibilityAddTraits(.isHeader)
                Text("Drag and pinch until the face fills the square. It is sent as 224 × 224.")
                    .font(Theme.Font.small).foregroundStyle(Theme.Color.muted)
                stage
                zoomSlider
                rules
                if let error {
                    Text(error).font(Theme.Font.small).foregroundStyle(Theme.Color.negative)
                }
                Button { save() } label: {
                    if busy { ProgressView().tint(Theme.Color.onPrimary) } else { Text("Use this photo") }
                }
                .buttonStyle(.primary)
                .disabled(busy || geometry == nil)
                Button("Cancel") { dismiss() }
                    .font(Theme.Font.button).foregroundStyle(Theme.Color.text)
                    .frame(maxWidth: .infinity, minHeight: Theme.Space.control)
            }
            .padding(20)
        }
        .background(Theme.Color.surface)
    }

    private var stage: some View {
        GeometryReader { proxy in
            let side = proxy.size.width
            let current = geometry ?? PetCropGeometry(imageSize: image.size, frameSide: side)
            let rect = current.drawRect(onCanvas: side)
            ZStack(alignment: .topLeading) {
                Theme.Color.raised
                Image(uiImage: image)
                    .resizable()
                    .frame(width: rect.width, height: rect.height)
                    .offset(x: rect.minX, y: rect.minY)
            }
            .frame(width: side, height: side)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.hero))
            .contentShape(Rectangle())
            .gesture(drag.simultaneously(with: pinch(side: side)))
            .onAppear { if geometry == nil { geometry = current } }
            .accessibilityLabel("Crop area")
        }
        .aspectRatio(1, contentMode: .fit)
    }

    private var drag: some Gesture {
        DragGesture()
            .onChanged { value in
                guard let base = dragBase ?? geometry else { return }
                dragBase = base
                geometry = base.panned(by: value.translation)
            }
            .onEnded { _ in dragBase = nil }
    }

    private func pinch(side: CGFloat) -> some Gesture {
        MagnifyGesture()
            .onChanged { value in
                guard let base = zoomBase ?? geometry else { return }
                zoomBase = base
                geometry = base.zoomed(to: base.scale * value.magnification,
                                       anchor: CGPoint(x: side / 2, y: side / 2))
            }
            .onEnded { _ in zoomBase = nil }
    }

    private var zoomSlider: some View {
        HStack(spacing: 10) {
            Image(systemName: "minus.magnifyingglass").foregroundStyle(Theme.Color.muted).accessibilityHidden(true)
            Slider(value: Binding(
                get: { Double(geometry.map { $0.scale / $0.minScale } ?? 1) },
                set: { zoom in
                    guard let current = geometry else { return }
                    let center = CGPoint(x: current.frameSide / 2, y: current.frameSide / 2)
                    geometry = current.zoomed(to: current.minScale * CGFloat(zoom), anchor: center)
                }
            ), in: 1...Double(PetCropGeometry.maxZoom))
            .tint(Theme.Color.accent)
            .accessibilityLabel("Zoom")
            Text("\(geometry?.zoomPercent ?? 100)%").font(Theme.Font.small).monospacedDigit()
                .foregroundStyle(Theme.Color.muted)
        }
    }

    private var rules: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(PetFaceRules.rules, id: \.text) { rule in
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: rule.ok ? "checkmark" : "xmark")
                        .font(Theme.Font.chevron)
                        .foregroundStyle(rule.ok ? Theme.Color.positive : Theme.Color.muted)
                        .accessibilityLabel(rule.ok ? "Do" : "Avoid")
                    Text(rule.text).font(Theme.Font.small).foregroundStyle(Theme.Color.lede)
                }
            }
        }
    }

    private func save() {
        guard let geometry, let jpeg = PetFaceRules.jpeg(of: image, geometry: geometry) else {
            error = "This photo could not be cropped. Try another one."
            return
        }
        busy = true
        error = nil
        Task {
            defer { busy = false }
            do {
                try await upload(jpeg)
                dismiss()
            } catch {
                self.error = Loadable<Void>.message(for: error)
            }
        }
    }
}

#Preview {
    let renderer = UIGraphicsImageRenderer(size: CGSize(width: 400, height: 300))
    let sample = renderer.image { context in
        UIColor.systemTeal.setFill()
        context.fill(CGRect(x: 0, y: 0, width: 400, height: 300))
    }
    return PetFaceCropperView(image: sample, petName: "Miso") { _ in }
}
