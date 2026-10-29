import CoreText
import SwiftUI

/// The type scale (design-reference §2, §7.2). IBM Plex Sans for everything,
/// IBM Plex Mono only for IDs, firmware, URLs, fingerprints, keys, file names
/// and log lines. Sizes scale with Dynamic Type relative to a text style.
/// When the Plex files are not bundled the system face stands in.
public extension Theme {
    enum Font {
        public static let title = sans(24, .semibold, relativeTo: .title2)
        public static let section = sans(17, .semibold, relativeTo: .headline)
        public static let figure = sans(30, .medium, relativeTo: .largeTitle)
        public static let figureInRow = sans(22, .medium, relativeTo: .title2)
        public static let body = sans(15, .regular, relativeTo: .body)
        public static let bodyMedium = sans(15, .medium, relativeTo: .body)
        public static let button = sans(16, .semibold, relativeTo: .body)
        public static let control = sans(14, .medium, relativeTo: .subheadline)
        public static let small = sans(13, .regular, relativeTo: .footnote)
        public static let smallMedium = sans(13, .medium, relativeTo: .footnote)
        public static let extraSmall = sans(12, .regular, relativeTo: .caption)
        public static let pill = sans(12, .medium, relativeTo: .caption)
        public static let tab = sans(11, .medium, relativeTo: .caption2)
        public static let mono = monospaced(12, .regular, relativeTo: .caption)
        public static let monoMedium = monospaced(12, .medium, relativeTo: .caption)
        /// SF Symbols beside text (warning marks, quick-action icons).
        public static let icon = SwiftUI.Font.system(size: 16)
        public static let iconLarge = SwiftUI.Font.system(size: 22)
        public static let chevron = SwiftUI.Font.system(size: 13, weight: .semibold)

        static func sans(_ size: CGFloat, _ weight: SwiftUI.Font.Weight,
                         relativeTo style: SwiftUI.Font.TextStyle) -> SwiftUI.Font {
            let name = switch weight {
            case .semibold: "IBMPlexSans-SmBld"
            case .medium: "IBMPlexSans-Medm"
            default: "IBMPlexSans"
            }
            return isAvailable(name)
                ? .custom(name, size: size, relativeTo: style)
                : .system(style).weight(weight)
        }

        static func monospaced(_ size: CGFloat, _ weight: SwiftUI.Font.Weight,
                               relativeTo style: SwiftUI.Font.TextStyle) -> SwiftUI.Font {
            let name = weight == .medium ? "IBMPlexMono-Medm" : "IBMPlexMono"
            return isAvailable(name)
                ? .custom(name, size: size, relativeTo: style)
                : .system(style, design: .monospaced).weight(weight)
        }

        static func isAvailable(_ postScriptName: String) -> Bool {
            let font = CTFontCreateWithName(postScriptName as CFString, 12, nil)
            return CTFontCopyPostScriptName(font) as String == postScriptName
        }
    }
}
