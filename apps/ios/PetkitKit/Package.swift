// swift-tools-version: 5.9
// Shared code for the iOS app. `PetkitAPI` is the user-plane client, generated
// at build time from `Sources/PetkitAPI/openapi.yaml` (a copy of
// packages/contracts/openapi.yaml made by scripts/gen-clients.sh); the
// generated code is never committed.
import PackageDescription

let package = Package(
    name: "PetkitKit",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "PetkitAPI", targets: ["PetkitAPI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-openapi-generator", exact: "1.9.0"),
        .package(url: "https://github.com/apple/swift-openapi-runtime", exact: "1.12.2"),
        .package(url: "https://github.com/apple/swift-openapi-urlsession", exact: "1.4.0"),
    ],
    targets: [
        .target(
            name: "PetkitAPI",
            dependencies: [
                .product(name: "OpenAPIRuntime", package: "swift-openapi-runtime"),
                .product(name: "OpenAPIURLSession", package: "swift-openapi-urlsession"),
            ],
            plugins: [
                .plugin(name: "OpenAPIGenerator", package: "swift-openapi-generator"),
            ]
        ),
    ]
)
