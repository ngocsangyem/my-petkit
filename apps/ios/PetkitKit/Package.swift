// swift-tools-version: 6.0
// Shared code for the iOS app.
// - `PetkitAPI` is the user-plane client, generated at build time from
//   `Sources/PetkitAPI/openapi.yaml` (a copy of packages/contracts/openapi.yaml
//   made by scripts/gen-clients.sh); the generated code is never committed.
// - `PetkitCore` is everything testable without UI: pairing, Keychain, TLS
//   pinning, the pinned media loader, display models.
import PackageDescription

let package = Package(
    name: "PetkitKit",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "PetkitAPI", targets: ["PetkitAPI"]),
        .library(name: "PetkitCore", targets: ["PetkitCore"]),
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-openapi-generator", exact: "1.9.0"),
        .package(url: "https://github.com/apple/swift-openapi-runtime", exact: "1.12.2"),
        .package(url: "https://github.com/apple/swift-openapi-urlsession", exact: "1.4.0"),
        .package(url: "https://github.com/apple/swift-http-types", exact: "1.8.0"),
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
        .testTarget(name: "PetkitCoreTests", dependencies: ["PetkitCore"]),
        .testTarget(name: "PetkitAPITests", dependencies: ["PetkitAPI"]),
    ]
)
