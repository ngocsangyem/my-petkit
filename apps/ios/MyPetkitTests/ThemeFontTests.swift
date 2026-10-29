import UIKit
import XCTest

/// The bundled IBM Plex faces register under the PostScript names
/// `Theme.Font` asks for (IBM's short ones, not the file names); a mismatch
/// would silently fall back to SF.
final class ThemeFontTests: XCTestCase {
    func testEveryPlexFaceIsRegistered() {
        for name in ["IBMPlexSans", "IBMPlexSans-Medm", "IBMPlexSans-SmBld",
                     "IBMPlexMono", "IBMPlexMono-Medm"] {
            XCTAssertNotNil(UIFont(name: name, size: 12), name)
        }
    }
}
