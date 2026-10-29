import UIKit
import XCTest
@testable import MyPetkit

final class PetCropGeometryTests: XCTestCase {
    private let accuracy: CGFloat = 0.0001

    func testCoverFillsTheFrameAndCentres() {
        let crop = PetCropGeometry(imageSize: CGSize(width: 400, height: 300), frameSide: 300)
        XCTAssertEqual(crop.minScale, 1, accuracy: accuracy)
        XCTAssertEqual(crop.displayedSize.height, 300, accuracy: accuracy)
        let rect = crop.drawRect(onCanvas: 300)
        XCTAssertEqual(rect.minX, -50, accuracy: accuracy)
        XCTAssertEqual(rect.minY, 0, accuracy: accuracy)
        XCTAssertEqual(crop.zoomPercent, 100)
    }

    func testDrawRectScalesToTheFaceSize() {
        let crop = PetCropGeometry(imageSize: CGSize(width: 1000, height: 1000), frameSide: 320)
        let rect = crop.drawRect()
        XCTAssertEqual(rect, CGRect(x: 0, y: 0, width: 224, height: 224))
    }

    func testPanIsClampedSoNoBlankEdgeShows() {
        let crop = PetCropGeometry(imageSize: CGSize(width: 400, height: 300), frameSide: 300)
        let left = crop.panned(by: CGSize(width: 500, height: 80))
        XCTAssertEqual(left.drawRect(onCanvas: 300).minX, 0, accuracy: accuracy)
        XCTAssertEqual(left.drawRect(onCanvas: 300).minY, 0, accuracy: accuracy)
        let right = crop.panned(by: CGSize(width: -500, height: 0))
        XCTAssertEqual(right.drawRect(onCanvas: 300).maxX, 300, accuracy: accuracy)
    }

    func testZoomIsBoundedByCoverAndCeiling() {
        let crop = PetCropGeometry(imageSize: CGSize(width: 300, height: 300), frameSide: 300)
        let center = CGPoint(x: 150, y: 150)
        XCTAssertEqual(crop.zoomed(to: 0.1, anchor: center).scale, crop.minScale, accuracy: accuracy)
        XCTAssertEqual(crop.zoomed(to: 100, anchor: center).scale, crop.minScale * PetCropGeometry.maxZoom,
                       accuracy: accuracy)
    }

    func testZoomKeepsTheAnchorStill() {
        let crop = PetCropGeometry(imageSize: CGSize(width: 300, height: 300), frameSide: 300)
        let zoomed = crop.zoomed(to: 2, anchor: CGPoint(x: 150, y: 150))
        let visible = zoomed.visibleRect
        XCTAssertEqual(visible.midX, 150, accuracy: accuracy)
        XCTAssertEqual(visible.midY, 150, accuracy: accuracy)
        XCTAssertEqual(visible.width, 150, accuracy: accuracy)
        XCTAssertEqual(zoomed.zoomPercent, 200)
    }

    func testExportedJPEGIs224Square() throws {
        let image = UIGraphicsImageRenderer(size: CGSize(width: 640, height: 480)).image { context in
            UIColor.gray.setFill()
            context.fill(CGRect(x: 0, y: 0, width: 640, height: 480))
        }
        let crop = PetCropGeometry(imageSize: image.size, frameSide: 300).zoomed(to: 3, anchor: CGPoint(x: 10, y: 10))
        let data = try XCTUnwrap(PetFaceRules.jpeg(of: image, geometry: crop))
        XCTAssertEqual(Array(data.prefix(2)), [0xFF, 0xD8], "the server accepts JPEG magic bytes only")
        let decoded = try XCTUnwrap(UIImage(data: data)?.cgImage)
        XCTAssertEqual(decoded.width, 224)
        XCTAssertEqual(decoded.height, 224)
    }

    func testDegenerateImageDoesNotDivideByZero() {
        let crop = PetCropGeometry(imageSize: .zero, frameSide: 300)
        XCTAssertTrue(crop.minScale.isFinite)
    }
}
