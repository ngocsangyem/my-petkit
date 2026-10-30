import PetkitCore
import XCTest
@testable import MyPetkit

final class TimelineFormatTests: XCTestCase {
    private func entry(kind: String = "visit", petName: String? = "Miso", label: String? = nil,
                       eventKind: String? = "toilet_visit", deviceName: String = "Litter box",
                       ts: Double? = 1_761_634_680, duration: Double? = 115, weight: Double? = 5430,
                       bits: [String] = [], steps: [TimelineStep] = [], media: TimelineMedia = TimelineMedia())
        -> TimelineEntry {
        TimelineEntry(kind: kind, eventID: 1, deviceID: 10, deviceName: deviceName, ts: ts, displayTs: ts,
                      petID: 1, petName: petName, petPhotoPath: nil, label: label, eventKind: eventKind,
                      eventType: "10", durationSec: duration, weight: weight, bits: bits, steps: steps,
                      media: media, index: 0)
    }

    // MARK: Numbers

    func testDurationUnderAMinuteIsSecondsOnly() {
        XCTAssertEqual(TimelineFormat.duration(45), "45 s")
        XCTAssertEqual(TimelineFormat.duration(0), "0 s")
    }

    func testDurationOverAMinuteHasMinutesAndSeconds() {
        XCTAssertEqual(TimelineFormat.duration(115), "1 min 55 s")
        XCTAssertEqual(TimelineFormat.duration(119.6), "2 min 0 s")
    }

    func testDurationUnknownOrInvalidIsNil() {
        XCTAssertNil(TimelineFormat.duration(nil))
        XCTAssertNil(TimelineFormat.duration(-1))
        XCTAssertNil(TimelineFormat.duration(.nan))
    }

    func testClipLengthPadsSeconds() {
        XCTAssertEqual(TimelineFormat.clipLength(115), "1:55")
        XCTAssertEqual(TimelineFormat.clipLength(65), "1:05")
        XCTAssertNil(TimelineFormat.clipLength(nil))
    }

    func testWeightConvertsGramsToKilograms() {
        XCTAssertEqual(TimelineFormat.weight(5430), "5.43 kg")
        XCTAssertEqual(TimelineFormat.weight(3865), "3.87 kg")
        XCTAssertNil(TimelineFormat.weight(nil))
        XCTAssertNil(TimelineFormat.weight(.infinity))
    }

    func testClockUsesTheServerOffsetNotThePhoneZone() {
        // 2025-10-28 06:58 UTC is 13:58 at UTC+7 and 07:58 at UTC+1.
        XCTAssertEqual(TimelineFormat.clock(1_761_634_680, tzOffset: 25_200), "13:58")
        XCTAssertEqual(TimelineFormat.clock(1_761_634_680, tzOffset: 3_600), "07:58")
        XCTAssertNil(TimelineFormat.clock(0, tzOffset: 0))
    }

    // MARK: Lines

    func testVisitSentenceNamesThePet() {
        XCTAssertEqual(TimelineFormat.sentence(entry()), "Miso used the litter box")
        XCTAssertEqual(TimelineFormat.sentence(entry(petName: nil)), "A cat used the litter box")
    }

    func testEventSentenceUsesLabelThenKind() {
        XCTAssertEqual(TimelineFormat.sentence(entry(kind: "event", label: "Feeder dispensed 15 g")),
                       "Feeder dispensed 15 g")
        XCTAssertEqual(TimelineFormat.sentence(entry(kind: "event", label: nil, eventKind: "health_alert")),
                       "health alert")
        XCTAssertEqual(TimelineFormat.sentence(entry(kind: "event", label: "", eventKind: "error")), "Alert")
    }

    func testVisitMetaLineJoinsTimeDurationWeightAndFacts() {
        let line = TimelineFormat.metaLine(entry(bits: ["waste 42 g"]), tzOffset: 25_200)
        XCTAssertEqual(line, "13:58 · 1 min 55 s · 5.43 kg · waste 42 g")
    }

    func testVisitMetaLineSkipsUnknownValues() {
        XCTAssertEqual(TimelineFormat.metaLine(entry(duration: nil, weight: nil), tzOffset: 25_200), "13:58")
    }

    func testEventMetaLineNamesTheDeviceInsteadOfWeight() {
        let line = TimelineFormat.metaLine(entry(kind: "event", deviceName: "Fountain", weight: 999,
                                                 bits: ["water 40%"]), tzOffset: 25_200)
        XCTAssertEqual(line, "13:58 · Fountain · water 40%")
    }

    // MARK: Media

    func testAssemblingOnlyWhilePendingAndNothingPlayable() {
        XCTAssertTrue(TimelineFormat.isAssembling(TimelineMedia(snapshot: "s.jpg", videoPending: true)))
        XCTAssertFalse(TimelineFormat.isAssembling(TimelineMedia(highlight: "c.mp4", videoPending: true)))
        XCTAssertFalse(TimelineFormat.isAssembling(TimelineMedia()))
    }

    func testPlaybackPendingWhenClipPlaysButRecordingIsStitching() {
        XCTAssertTrue(TimelineFormat.isPlaybackPending(TimelineMedia(highlight: "c.mp4", videoPending: true)))
        XCTAssertFalse(TimelineFormat.isPlaybackPending(TimelineMedia(highlight: "c.mp4", playback: "p.m3u8",
                                                                      videoPending: true)))
    }

    func testTransportStreamDetection() {
        XCTAssertTrue(TimelineFormat.isTransportStream("Playback/2026/a.ts"))
        XCTAssertTrue(TimelineFormat.isTransportStream("a.TS?exp=1&sig=x"))
        XCTAssertFalse(TimelineFormat.isTransportStream("a.m3u8"))
        XCTAssertFalse(TimelineFormat.isTransportStream("cats.mp4"))
    }

    func testTransportStreamOnlyWhenEverySourceIsTS() {
        XCTAssertTrue(TimelineFormat.isTransportStreamOnly(TimelineMedia(playback: "p.ts")))
        XCTAssertFalse(TimelineFormat.isTransportStreamOnly(TimelineMedia(highlight: "c.mp4", playback: "p.ts")))
        XCTAssertFalse(TimelineFormat.isTransportStreamOnly(TimelineMedia()))
        XCTAssertEqual(TimelineFormat.playableSources(TimelineMedia(highlight: "c.mp4", playback: "p.ts")).map(\.label),
                       [.clip])
    }

    func testVideoSourcesOrderClipTimelapsePlayback() {
        let media = TimelineMedia(highlight: "c.mp4", playback: "p.m3u8", preview: "t.mp4")
        XCTAssertEqual(TimelineFormat.videoSources(media).map(\.label), [.clip, .timelapse, .playback])
    }

    func testPosterPrefersSnapshot() {
        XCTAssertEqual(TimelineFormat.posterPath(TimelineMedia(highlight: "c.mp4", snapshot: "s.jpg")), "s.jpg")
        XCTAssertEqual(TimelineFormat.posterPath(TimelineMedia(highlight: "c.mp4")), "c.mp4")
        XCTAssertNil(TimelineFormat.posterPath(TimelineMedia()))
    }

    func testStillGroupsMergeStepsAndDeduplicate() {
        let step = TimelineStep(eventID: 2, eventType: "8", ts: nil, label: nil, isDetail: false,
                                media: TimelineMedia(waste: ["w2.jpg", "w1.jpg"]), index: 0)
        let groups = TimelineFormat.stillGroups(entry(steps: [step], media: TimelineMedia(waste: ["w1.jpg"],
                                                                                          health: ["h1.jpg"])))
        XCTAssertEqual(groups.map(\.pill), ["2 waste photos", "1 stool photo"])
        XCTAssertEqual(groups.first?.paths, ["w1.jpg", "w2.jpg"])
    }

    // MARK: Days

    func testShiftDayIsCalendarArithmetic() {
        XCTAssertEqual(TimelineFormat.shiftDay("2026-10-28", by: -1), "2026-10-27")
        XCTAssertEqual(TimelineFormat.shiftDay("2026-03-01", by: -1), "2026-02-28")
        XCTAssertEqual(TimelineFormat.shiftDay("2026-12-31", by: 1), "2027-01-01")
        XCTAssertNil(TimelineFormat.shiftDay("2026-02-30", by: 0))
        XCTAssertNil(TimelineFormat.shiftDay("today", by: 0))
    }

    func testDayTitles() {
        XCTAssertEqual(TimelineFormat.dayTitle("2026-10-28", today: "2026-10-28"), "Today, 28 Oct")
        XCTAssertEqual(TimelineFormat.dayTitle("2026-10-27", today: "2026-10-28"), "Yesterday, 27 Oct")
        XCTAssertEqual(TimelineFormat.dayTitle("2026-10-26", today: "2026-10-28"), "Mon, 26 Oct")
    }

    func testDaySummary() {
        let day = TimelineDayResult(date: "2026-10-28", tzOffset: 0, toiletingCount: 5, feedingCount: 2,
                                    drinkingCount: 0, faultCount: 1, entries: [])
        XCTAssertEqual(TimelineFormat.daySummary(day, isToday: true), "5 visits, 2 meals, 1 fault so far.")
        XCTAssertEqual(TimelineFormat.daySummary(day, isToday: false), "5 visits, 2 meals, 1 fault.")
        let empty = TimelineDayResult(date: "2026-10-28", tzOffset: 0, toiletingCount: 0, feedingCount: 0,
                                      drinkingCount: 0, faultCount: 0, entries: [])
        XCTAssertNil(TimelineFormat.daySummary(empty, isToday: true))
    }

    // MARK: JSON

    func testDayJSONMapsSessionsNewestFirstAndKeepsStepMedia() throws {
        let body = """
        {"date": "2026-10-28", "tz_offset": 25200,
         "counts": {"all": 2, "pet": 0, "toileting": 1, "drinking": 0, "feeding": 1, "cleaning": 0,
                    "health_alert": 0, "fault": 0},
         "sessions": [
           {"kind": "event", "id": 7, "device_id": 11, "device_name": "Feeder", "ts": 100, "display_ts": 100,
            "pet_id": null, "event_type": 3, "label": "Fed", "event_kind": "feeding", "duration_sec": null,
            "weight": null, "bits": [], "sub_events": [],
            "media": {"highlight_url": null, "playback_url": null, "preview_url": null, "poster_url": null,
                      "waste": [], "health": [], "snapshot_url": null, "video_pending": false}},
           {"kind": "visit", "id": "9", "device_id": 10, "device_name": "", "ts": 200, "display_ts": 190,
            "pet_id": 1, "pet_name": "Miso", "pet_photo_url": "api/pets/1/faces/2/photo", "event_type": "10",
            "label": null, "event_kind": "toilet_visit", "duration_sec": 115, "weight": 5430,
            "bits": ["waste 42 g"],
            "sub_events": [{"id": 12, "event_type": "8", "ts": 260, "label": "Cleaning done", "detail": false,
                            "media": {"waste": ["w.jpg"], "health": [], "video_pending": false}}],
            "media": {"playback_url": "p.ts", "waste": [], "health": [], "video_pending": true}}
         ]}
        """
        let json = try JSONDecoder().decode(JSONValue.self, from: Data(body.utf8))
        let day = try XCTUnwrap(TimelineJSON.day(json))
        XCTAssertEqual(day.tzOffset, 25_200)
        XCTAssertEqual(day.toiletingCount, 1)
        XCTAssertEqual(day.entries.map(\.eventID), [9, 7])
        let visit = day.entries[0]
        XCTAssertEqual(visit.petPhotoPath, "/api/pets/1/faces/2/photo")
        XCTAssertEqual(day.entries[1].eventType, "3")
        XCTAssertEqual(visit.steps.first?.media?.waste, ["w.jpg"])
        XCTAssertTrue(TimelineFormat.isTransportStreamOnly(visit.media))
        XCTAssertEqual(TimelineFormat.stillGroups(visit).map(\.pill), ["1 waste photo"])
    }

    func testErrorEnvelopeBecomesTheServersSentence() {
        let error = TimelineJSON.apiError(status: 404,
                                          data: Data(#"{"error": {"code": "not_found", "message": "No such event."}}"#.utf8))
        XCTAssertEqual(error.message, "No such event.")
        XCTAssertEqual(error.code, "not_found")
        XCTAssertEqual(TimelineJSON.apiError(status: 400, data: Data(#"{"error": "invalid event id"}"#.utf8)).message,
                       "invalid event id")
    }
}
