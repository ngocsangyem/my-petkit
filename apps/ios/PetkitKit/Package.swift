// swift-tools-version: 6.0
// Shared code for the iOS app.
// - `PetkitAPI` is the user-plane client, generated at build time from
//   `Sources/PetkitAPI/openapi.yaml` (a copy of packages/contracts/openapi.yaml
//   made by scripts/gen-clients.sh); the generated code is never committed.
// - `PetkitCore` is everything testable without UI: pairing, Keychain, TLS
//   pinning, the pinned media loader, display models.
// - `PetkitBLE` provisions a device's Wi-Fi over Bluetooth (PetKit Ingenic
//   framing and ESP32 BLUFI), with the protocol kept apart from CoreBluetooth.
// - `PetkitLive` receives a camera's live WebRTC stream (Google's WebRTC as a
//   prebuilt xcframework from stasel/WebRTC, pinned to an exact release).
import PackageDescription

let package = Package(
    name: "PetkitKit",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "PetkitAPI", targets: ["PetkitAPI"]),
        .library(name: "PetkitCore", targets: ["PetkitCore"]),
        .library(name: "PetkitBLE", targets: ["PetkitBLE"]),
        .library(name: "PetkitLive", targets: ["PetkitLive"]),
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-openapi-generator", exact: "1.14.3"),
        .package(url: "https://github.com/apple/swift-openapi-runtime", exact: "1.12.2"),
        .package(url: "https://github.com/apple/swift-openapi-urlsession", exact: "1.4.0"),
        .package(url: "https://github.com/apple/swift-http-types", exact: "1.8.0"),
        .package(url: "https://github.com/stasel/WebRTC", exact: "155.0.0"),
    ],
    targets: [
        .target(
            name: "PetkitAPI",
            dependencies: [
                "PetkitCore",
                .product(name: "OpenAPIRuntime", package: "swift-openapi-runtime"),
                .product(name: "OpenAPIURLSession", package: "swift-openapi-urlsession"),
                .product(name: "HTTPTypes", package: "swift-http-types"),
            ],
            plugins: [
                .plugin(name: "OpenAPIGenerator", package: "swift-openapi-generator"),
            ]
        ),
        .target(name: "PetkitCore"),
        .target(name: "PetkitBLE"),
        .target(name: "PetkitLive", dependencies: [.product(name: "WebRTC", package: "WebRTC")]),
        .testTarget(name: "PetkitCoreTests", dependencies: ["PetkitCore"]),
        .testTarget(name: "PetkitAPITests", dependencies: ["PetkitAPI"]),
        .testTarget(name: "PetkitBLETests", dependencies: ["PetkitBLE"]),
    ]
)
