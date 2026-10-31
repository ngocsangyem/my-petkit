import PetkitCore
import SwiftUI

/// The device drawings, in the 100 × 100 geometry of the v3 design
/// (`docs/design/DESIGN.md`, Device drawings): every number below is a
/// coordinate on that grid, scaled to the drawn size. Single feeder, purifier and
/// unknown have no reference drawing and are drawn in the same language.
struct DrawingArt {
    let scale: CGFloat
    let context: GraphicsContext

    private var line: CGFloat { 3 * scale }

    private func rect(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat) -> CGRect {
        CGRect(x: x * scale, y: y * scale, width: w * scale, height: h * scale)
    }

    private func rounded(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ r: CGFloat) -> Path {
        Path(roundedRect: rect(x, y, w, h), cornerRadius: r * scale)
    }

    private func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: x * scale, y: y * scale) }

    private func outline(_ path: Path, width: CGFloat? = nil) {
        context.stroke(path, with: .color(Theme.Color.stroke),
                       style: StrokeStyle(lineWidth: width ?? line, lineCap: .round, lineJoin: .round))
    }

    /// Fills `fill` from `top` down inside `shape`.
    private func fillBelow(_ top: CGFloat, in shape: Path, color: Color) {
        var clipped = context
        clipped.clip(to: shape)
        clipped.fill(Path(rect(0, top, 100, 100 - top)), with: .color(color))
    }

    /// The Purobot drum: a sphere on a base, litter in its lower part, the
    /// front opening as an oval.
    func drum(level: Double) {
        let base = rounded(16, 80, 68, 12, 6)
        context.fill(base, with: .color(Theme.Color.segment))
        outline(base)
        let sphere = Path(ellipseIn: rect(16, 12, 68, 68))
        context.fill(sphere, with: .color(Theme.Color.surface))
        if level > 0 { fillBelow(82 - 64 * level * 0.6, in: sphere, color: Theme.Color.litter) }
        outline(sphere)
        let opening = Path(ellipseIn: rect(31, 35, 38, 30))
        context.fill(opening, with: .color(Theme.Color.surface.opacity(0.55)))
        outline(opening)
    }

    /// Two hopper windows whose fill is each hopper's level.
    func dualFeeder(first: Double, second: Double) {
        feederBody()
        window(x: 27, width: 20, level: first)
        window(x: 53, width: 20, level: second)
        feederBase()
    }

    func singleFeeder(level: Double) {
        feederBody()
        window(x: 32, width: 36, level: level)
        feederBase()
    }

    private func feederBody() {
        let body = rounded(22, 10, 56, 62, 12)
        context.fill(body, with: .color(Theme.Color.surface))
        outline(body)
    }

    private func window(x: CGFloat, width: CGFloat, level: Double) {
        let frame = rounded(x, 22, width, 34, 5)
        context.fill(frame, with: .color(Theme.Color.surface))
        let food = 34 * level
        if food > 0 { context.fill(rounded(x, 56 - food, width, food, 4), with: .color(Theme.Color.food)) }
        outline(frame, width: 2.5 * scale)
    }

    private func feederBase() {
        var tray = Path()
        tray.move(to: point(18, 80))
        tray.addLine(to: point(82, 80))
        tray.addLine(to: point(76, 90))
        tray.addLine(to: point(24, 90))
        tray.closeSubpath()
        context.fill(tray, with: .color(Theme.Color.segment))
        outline(tray)
    }

    func fountain(level: Double) {
        let tank = rounded(20, 30, 60, 54, 14)
        context.fill(tank, with: .color(Theme.Color.surface))
        if level > 0 { fillBelow(82 - 50 * level, in: tank, color: Theme.Color.water) }
        outline(tank)
        var spout = Path()
        spout.move(to: point(50, 30))
        spout.addLine(to: point(50, 16))
        spout.move(to: point(42, 16))
        spout.addLine(to: point(58, 16))
        outline(spout)
    }

    func spray() {
        let body = rounded(34, 18, 32, 68, 16)
        context.fill(body, with: .color(Theme.Color.surface))
        outline(body)
        outline(Path(ellipseIn: rect(44, 32, 12, 12)))
    }

    /// A tower with an intake grille, on the feeder's base.
    func purifier() {
        let body = rounded(26, 12, 48, 70, 14)
        context.fill(body, with: .color(Theme.Color.surface))
        outline(body)
        var grille = Path()
        for y in stride(from: 28 as CGFloat, through: 52, by: 8) {
            grille.move(to: point(36, y))
            grille.addLine(to: point(64, y))
        }
        outline(grille, width: 2.5 * scale)
        let base = rounded(22, 82, 56, 8, 4)
        context.fill(base, with: .color(Theme.Color.segment))
        outline(base)
    }

    /// A plain rounded box: a model with no drawing yet.
    func unknown() {
        let body = rounded(24, 20, 52, 60, 12)
        context.fill(body, with: .color(Theme.Color.surface))
        outline(body)
        let base = rounded(20, 80, 60, 10, 5)
        context.fill(base, with: .color(Theme.Color.segment))
        outline(base)
    }
}
