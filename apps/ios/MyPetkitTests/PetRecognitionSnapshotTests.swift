import PetkitCore
import SnapshotTesting
import SwiftUI
import XCTest
@testable import MyPetkit

/// The change-cat sheet over the Timeline and the pet edit screen, light and
/// dark, from the preview fixtures. Compared by eye with ios-change-cat and
/// ios-pet-edit in docs/design/screenshots. The zone is pinned so "updated
/// 13:58" and the visit times do not move with the machine running them.
@MainActor
final class PetRecognitionSnapshotTests: XCTestCase {
    private let zone = TimeZone(secondsFromGMT: 25_200) ?? .gmt
    /// An hour after the fixture weight was registered, the same server day.
    private let now = Date(timeIntervalSince1970: PetsModel.fixtureWeightUpdatedAt + 3_600)

    private func changeCatSheet(_ entry: TimelineEntry, preselect: TimelineCatChoice? = nil,
                                useWeight: Bool = false) -> some View {
        TimelineChangeCatSheet(entry: entry, tzOffset: TimelineFixtures.reassignDay.tzOffset,
                               candidates: TimelineChangeCatRules.candidates(
                                   pets: TimelineFixtures.pets, visitGrams: TimelineChangeCatRules.visitGrams(entry)),
                               preselect: preselect, useWeight: useWeight, save: { _ in })
            .fixedSize(horizontal: false, vertical: true)
    }

    /// The Timeline with "Light visits · 2", an unrecognised visit and a
    /// weight match, and the sheet open on the unrecognised one.
    func testChangeCatOverTimeline() throws {
        let session = try XCTUnwrap(PetsPreview.session)
        let timeline = TimelineView(model: TimelineModel(fixture: TimelineFixtures.reassignDay,
                                                         pets: TimelineFixtures.pets, devices: TimelineFixtures.devices))
        assertScreen(ZStack(alignment: .bottom) {
            timeline
            Theme.Color.scrim.ignoresSafeArea()
            changeCatSheet(TimelineFixtures.unrecognised, preselect: .pet(1), useWeight: true)
                .padding(.bottom, 34)
                .background(Theme.Color.surface,
                            in: UnevenRoundedRectangle(topLeadingRadius: Theme.Radius.sheetTop,
                                                       topTrailingRadius: Theme.Radius.sheetTop))
        }
        .ignoresSafeArea(edges: .bottom)
        .environment(session).environment(TabRouter()), named: "ios-change-cat")
    }

    /// A visit the camera recognised opens on its own cat, with nothing to save yet.
    func testChangeCatRecognisedVisit() throws {
        let session = try XCTUnwrap(PetsPreview.session)
        assertComponent(changeCatSheet(TimelineFixtures.day.entries[0])
            .background(Theme.Color.surface).environment(session), named: "change-cat-recognised", width: 390)
    }

    func testPetEdit() throws {
        let session = try XCTUnwrap(PetsPreview.session)
        assertScreen(NavigationStack { PetEditView(model: .fixture(), petID: 1, now: now) }
            .environment(\.timeZone, zone)
            .environment(session).environment(TabRouter()), named: "ios-pet-edit")
    }

    /// Below the fold of the edit screen: matching, tolerance and devices.
    func testPetEditRecognitionAndDevices() {
        let model = PetsModel.fixture()
        guard let pet = model.pets.value?.first else { return XCTFail("fixture has no pet") }
        var draft = PetEditDraft(pet: pet)
        assertComponent(VStack(alignment: .leading, spacing: Theme.Space.gap) {
            PetRecognitionSection(draft: Binding(get: { draft }, set: { draft = $0 })) {}
            PetDevicesSection(draft: Binding(get: { draft }, set: { draft = $0 }), pet: pet,
                              pets: model.pets.value ?? [], devices: model.devices)
        }, named: "pet-edit-recognition-devices")
    }
}
