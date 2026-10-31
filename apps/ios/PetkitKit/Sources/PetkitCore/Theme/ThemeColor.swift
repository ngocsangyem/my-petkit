import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

/// Every colour the app paints with, declared once with its light and dark
/// value (docs/design/DESIGN.md). No view may carry
/// a colour literal; SwiftLint enforces it outside this folder.
public enum Theme {}

public extension Theme {
    enum Color {
        // Surfaces
        public static let ground = pair(0xEDF2F1, 0x0E0F10)
        public static let surface = pair(0xFFFFFF, 0x1A1C1E)
        public static let raised = pair(0xF4F7F6, 0x232628)
        public static let segment = pair(0xE3E8E7, 0x3A3E41)
        public static let rule = pair(0xEEF1F1, 0x2A2D2F)
        public static let track = pair(0xE8EDED, 0x2C3032)
        public static let toggleOff = pair(0xD5DBDA, 0x3A3E41)

        // Ink
        public static let text = pair(0x131416, 0xF2F4F4)
        public static let stroke = pair(0x131416, 0xE9EDED)
        public static let muted = pair(0x5D6262, 0xA1A8A8)
        public static let lede = pair(0x3B4040, 0xC9CFCF)
        /// Text on a primary (ink-filled) button.
        public static let onPrimary = pair(0xFFFFFF, 0x131416)

        // Data and status
        public static let accent = pair(0x0F6E66, 0x4FC2B6)
        public static let chart2 = pair(0x2F70BB, 0x6EA6E8)
        public static let chart3 = pair(0xA86F0C, 0xE0A646)
        public static let positive = pair(0x1E7B4F, 0x5FD39B)
        public static let warning = pair(0x92400E, 0xF0B35A)
        public static let negative = pair(0xC4242A, 0xFF7A72)
        public static let onNegative = pair(0xFFFFFF, 0x131416)

        // Pills: background then foreground
        public static let pillPositive = (pair(0xDCFAE5, 0x123824), pair(0x04250E, 0xBDF2D3))
        public static let pillNegative = (pair(0xFFEDEA, 0x43191A), pair(0x831C1E, 0xFFC9C4))
        public static let pillWarning = (pair(0xFFFBEB, 0x3A2A10), pair(0x92400E, 0xF0C98A))
        public static let pillNeutral = (pair(0xE8EDED, 0x2C3032), pair(0x353736, 0xD5DBDA))

        /// Per-pet identity tints, assigned by pet index: background then ink.
        public static let catTints = [
            (pair(0xE4EDF8, 0x1C2A3B), pair(0x24548F, 0x9DC0EA)),
            (pair(0xF8EEDB, 0x352A16), pair(0x7A4F08, 0xE6C383)),
        ]

        // Device drawings
        public static let food = pair(0xE9D9B8, 0x6B5B3D)
        public static let water = pair(0xCFE0F2, 0x2E4A66)
        public static let litter = pair(0xCFE5E2, 0x2E5550)
        public static let fountainReporting = litter

        // Live view (always dark)
        public static let liveGround = fixed(0x0E0F10)
        public static let liveControl = fixed(0x202325)
        public static let liveText = fixed(0xF2F4F4)

        /// The one overlay allowed on a photo: a dark pill label.
        public static let photoLabel = SwiftUI.Color.black.opacity(0.55)
        public static let scrim = fixed(0x131416).opacity(0.35)
    }
}

extension Theme.Color {
    static func components(_ hex: UInt32) -> (Double, Double, Double) {
        (Double((hex >> 16) & 0xFF) / 255, Double((hex >> 8) & 0xFF) / 255, Double(hex & 0xFF) / 255)
    }

    static func fixed(_ hex: UInt32) -> SwiftUI.Color {
        let (r, g, b) = components(hex)
        return SwiftUI.Color(.sRGB, red: r, green: g, blue: b)
    }

    static func pair(_ light: UInt32, _ dark: UInt32) -> SwiftUI.Color {
        #if canImport(UIKit)
        func ui(_ hex: UInt32) -> UIColor {
            let (r, g, b) = components(hex)
            return UIColor(red: r, green: g, blue: b, alpha: 1)
        }
        let lightColor = ui(light), darkColor = ui(dark)
        return SwiftUI.Color(UIColor { $0.userInterfaceStyle == .dark ? darkColor : lightColor })
        #else
        return fixed(light)
        #endif
    }
}
