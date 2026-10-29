import PetkitCore
import SnapshotTesting
import SwiftUI
import XCTest

/// Renders `view` at iPhone 16 size (390×844, the artboards' size) in light
/// and dark and compares with the recorded images in `__Snapshots__`. The
/// tolerance absorbs anti-aliasing differences between Simulator runtimes.
@MainActor
func assertScreen<V: View>(_ view: V, named name: String,
                           file: StaticString = #filePath, testName: String = #function, line: UInt = #line) {
    for style in [UIUserInterfaceStyle.light, .dark] {
        let controller = UIHostingController(rootView: view)
        assertSnapshot(
            of: controller,
            as: .image(on: .iPhone13, precision: 0.99, perceptualPrecision: 0.98,
                       traits: UITraitCollection(userInterfaceStyle: style)),
            named: "\(name)-\(style == .dark ? "dark" : "light")",
            file: file, testName: testName, line: line
        )
    }
}

/// Renders a component at its own size, light and dark.
@MainActor
func assertComponent<V: View>(_ view: V, named name: String, width: CGFloat = 358,
                              file: StaticString = #filePath, testName: String = #function, line: UInt = #line) {
    for style in [ColorScheme.light, .dark] {
        let framed = view.frame(width: width).padding(16)
            .background(Theme.Color.ground)
            .environment(\.colorScheme, style)
        assertSnapshot(
            of: framed,
            as: .image(precision: 0.99, perceptualPrecision: 0.98, layout: .sizeThatFits,
                       traits: UITraitCollection(userInterfaceStyle: style == .dark ? .dark : .light)),
            named: "\(name)-\(style == .dark ? "dark" : "light")",
            file: file, testName: testName, line: line
        )
    }
}
