import Foundation

/// Preview data shaped like the art-direction sample (a dual-hopper kitchen
/// feeder in Asia/Saigon, a litter box). Previews only; screens show API data.
enum SchedulesFixtures {
    static let zone = DeviceZone(clock: DeviceClock(offsetHours: 7), locale: "Asia/Saigon")

    static let dinner = FeedMeal(mealID: .string("n_64800"), second: 18 * 3600, hopper1: 2, hopper2: 0)

    static let feedGroups = [
        FeedGroup(days: .everyDay, meals: [
            FeedMeal(mealID: .string("n_25200"), second: 7 * 3600, hopper1: 2, hopper2: 0),
            FeedMeal(mealID: .string("n_43200"), second: 12 * 3600, hopper1: 1, hopper2: 1),
            dinner,
            FeedMeal(mealID: .string("n_79200"), second: 22 * 3600, hopper1: 0, hopper2: 1),
        ]),
    ]

    static let weekly = [
        WeeklyEntry(enabled: true, days: .weekdays, ranges: [ScheduleRange(start: 480, end: 1080)]),
        WeeklyEntry(enabled: false, days: .weekend, ranges: [.allDay]),
    ]

    static let points = [
        PointEntry(serverID: 1, type: 0, days: .everyDay, minute: 9 * 60 + 30),
        PointEntry(serverID: 2, type: 1, days: .weekend, minute: 21 * 60),
    ]

    static let deferred = [
        DeferredFeedItem(id: "d_20261030_61500", hopper1: 1, hopper2: 1, fireAt: 1_793_354_700),
    ]

    static var feederDevice: SchedulesDevice {
        SchedulesDevice(name: "Kitchen feeder", isFeeder: true, targets: [
            ScheduleTargetInfo(target: "feed_schedule", name: "Feeding Schedule", kind: .feed,
                               value: ScheduleDraft.feed(feedGroups).wire(), dual: true),
            ScheduleTargetInfo(target: "lightMultiRange", name: "Indicator Light Period", kind: .ranges,
                               value: .array([.array([.int(1320), .int(420)])]), dual: false),
        ])
    }

    static var litterDevice: SchedulesDevice {
        SchedulesDevice(name: "Hallway box", isFeeder: false, targets: [
            ScheduleTargetInfo(target: "schedule", name: "Scheduled Cleaning & Deodorizing", kind: .points,
                               value: ScheduleDraft.points(points).wire(), dual: false),
            ScheduleTargetInfo(target: "cameraMultiNew", name: "Shooting Period", kind: .weekly,
                               value: ScheduleDraft.weekly(weekly).wire(), dual: false),
            ScheduleTargetInfo(target: "distrubMultiRange", name: "Cleaning Do Not Disturb", kind: .ranges,
                               value: .array([]), dual: false),
        ])
    }

    @MainActor
    static func model(_ device: SchedulesDevice) -> SchedulesModel {
        let model = SchedulesModel(deviceID: "10001")
        model.device = .loaded(device)
        model.zone = .loaded(zone)
        model.deferred = .loaded(deferred)
        return model
    }
}
