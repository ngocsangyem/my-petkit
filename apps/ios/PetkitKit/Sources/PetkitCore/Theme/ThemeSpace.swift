import CoreGraphics

/// Spacing and radius (design-reference §2, §7.2).
public extension Theme {
    enum Space {
        public static let gap: CGFloat = 12
        public static let pad: CGFloat = 16
        public static let screenEdge: CGFloat = 16
        public static let headerEdge: CGFloat = 20
        public static let rowHeight: CGFloat = 52
        public static let control: CGFloat = 44
        public static let button: CGFloat = 50
        public static let field: CGFloat = 50
        public static let chip: CGFloat = 36
        public static let pill: CGFloat = 22
    }

    enum Radius {
        public static let card: CGFloat = 20
        public static let panel: CGFloat = 14
        public static let hero: CGFloat = 16
        public static let thumbnail: CGFloat = 14
        public static let sheetTop: CGFloat = 24
    }
}
