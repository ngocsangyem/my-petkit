import PetkitCore
import SnapshotTesting
import SwiftUI
import XCTest
@testable import MyPetkit

/// Every phase screen rendered from its preview fixtures at iPhone 16 size,
/// light and dark. These images are what PARITY.md's Design column compares
/// with docs/design/screenshots/<artboard>.webp.
@MainActor
final class ScreenSnapshotTests: XCTestCase {
    func testHome() {
        assertScreen(NavigationStack { HomeView(model: DevicePreviewFixtures.home) }
            .environment(ServerSession.preview).environment(TabRouter()), named: "ios-devices")
    }

    func testHomeStates() {
        assertScreen(NavigationStack {
            HomeView(model: HomeModel(devices: .loaded([]), pets: .loaded([]),
                                      sessions: .failed("Could not load today's visits. The server did not answer.")))
        }.environment(ServerSession.preview).environment(TabRouter()), named: "ios-states")
    }

    func testLitterBoxDetail() {
        assertScreen(NavigationStack {
            DeviceDetailView(model: DeviceDetailModel(device: DevicePreviewFixtures.litterBox,
                                                      sessions: DevicePreviewFixtures.sessions))
        }.environment(ServerSession.preview), named: "ios-device-t6")
    }

    func testLitterBoxPausedOffersContinue() {
        assertScreen(NavigationStack {
            DeviceDetailView(model: DeviceDetailModel(device: DevicePreviewFixtures.pausedLitterBox, sessions: [],
                                                      automation: DevicePreviewFixtures.pausedOffered))
        }.environment(ServerSession.preview), named: "ios-device-t6-paused")
    }

    /// Paused but refused by the server: no "Continue cleaning" anywhere.
    func testLitterBoxPausedRefusedHidesContinue() {
        assertScreen(NavigationStack {
            DeviceDetailView(model: DeviceDetailModel(device: DevicePreviewFixtures.pausedLitterBox, sessions: [],
                                                      automation: DevicePreviewFixtures.pausedRefused))
        }.environment(ServerSession.preview), named: "ios-device-t6-paused-refused")
    }

    func testFeederDetail() {
        assertScreen(NavigationStack {
            DeviceDetailView(model: DeviceDetailModel(device: DevicePreviewFixtures.feeder,
                                                      sessions: DevicePreviewFixtures.sessions))
        }.environment(ServerSession.preview), named: "ios-device-feeder")
    }

    func testFountainOffline() {
        assertScreen(NavigationStack {
            DeviceDetailView(model: DeviceDetailModel(device: DevicePreviewFixtures.fountain, sessions: []))
        }.environment(ServerSession.preview), named: "ios-device-fountain")
    }

    func testLive() {
        assertScreen(NavigationStack {
            LiveView(model: LivePreviewFixtures.playing, talk: TalkModel(deviceID: 1), title: "Litter box")
        }.environment(ServerSession.preview), named: "ios-live")
    }

    func testLiveUnavailable() {
        assertScreen(NavigationStack {
            LiveView(model: LivePreviewFixtures.unavailable,
                     talk: TalkModel(deviceID: 1, state: .failed(TalkModel.deniedSentence)), title: "Litter box")
        }.environment(ServerSession.preview), named: "ios-live-unavailable")
    }

    func testSchedules() {
        assertScreen(SchedulesView(model: SchedulesFixtures.model(SchedulesFixtures.feederDevice)),
                     named: "ios-schedules")
    }

    func testSounds() {
        assertScreen(SoundsView(model: SoundsFixtures.model()), named: "ios-sounds")
    }

    func testBlePair() {
        assertScreen(BlePairSheet(model: BlePreviewFixtures.model(), onImport: {})
            .environment(BlePreviewFixtures.session), named: "ios-ble-pair")
    }

    func testTimeline() throws {
        let session = try XCTUnwrap(PetsPreview.session)
        assertScreen(TimelineView(model: TimelineModel(fixture: TimelineFixtures.day, pets: TimelineFixtures.pets,
                                                       devices: TimelineFixtures.devices))
            .environment(session).environment(TabRouter()), named: "ios-timeline")
    }

    func testPets() throws {
        let session = try XCTUnwrap(PetsPreview.session)
        assertScreen(NavigationStack { PetsView(model: .fixture()) }
            .environment(session).environment(TabRouter()), named: "ios-pets")
    }

    func testServerTab() {
        assertScreen(NavigationStack { ServerScreen(model: .preview()) }
            .environment(ServerPreviewFixtures.session).environment(AppModel()), named: "ios-settings")
    }

    func testLogs() {
        assertScreen(NavigationStack { LogsScreen(model: .preview(), segment: .server) }
            .environment(ServerPreviewFixtures.session), named: "ios-logs")
    }

    func testServerSetup() {
        assertScreen(NavigationStack { ServerSetupScreen(model: .preview()) }
            .environment(ServerPreviewFixtures.session), named: "ios-server-setup")
    }

    func testPatchers() {
        assertScreen(NavigationStack { PatchersScreen(model: .preview()) }
            .environment(ServerPreviewFixtures.session), named: "ios-patcher")
    }

    func testOnboarding() {
        assertScreen(OnboardingView(model: OnboardingModel { _ in }), named: "ios-pairing")
    }

    func testProvision() {
        assertScreen(NavigationStack {
            ProvisionView(model: .fixture(done: 2, status: "Joining Wi-Fi… Keep the phone near the device."))
        }.environment(ServerSession.preview), named: "ios-provision")
    }
}
