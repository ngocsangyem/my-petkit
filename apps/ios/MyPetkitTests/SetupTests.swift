import PetkitAPI
import XCTest
@testable import MyPetkit

final class SetupTests: XCTestCase {
    func testEveryProxyKeyAndCaptureNeedStepUp() {
        for key in ["proxy_mode", "proxy_upstream", "proxy_dns", "proxy_block_ota", "proxy_only", "capture"] {
            XCTAssertTrue(SetupRules.needsStepUp(key), key)
        }
        XCTAssertFalse(SetupRules.needsStepUp("timezone"))
    }

    func testBoolSettingsAllWriteStepUpKeys() {
        for setting in BoolSetting.allCases {
            XCTAssertTrue(SetupRules.needsStepUp(setting.wireKey), setting.wireKey)
        }
    }

    func testOneKeyPatchesNameOnlyThatKey() throws {
        let data = try JSONEncoder().encode(BoolSetting.blockOTA.patch(false))
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(object.count, 1)
        XCTAssertEqual(object["proxy_block_ota"] as? Bool, false)

        let text = try JSONEncoder().encode(TextSetting.dns.patch("10.0.0.1:53"))
        let textObject = try XCTUnwrap(JSONSerialization.jsonObject(with: text) as? [String: Any])
        XCTAssertEqual(textObject.keys.sorted(), ["proxy_dns"])
    }

    // MARK: DNS and upstream

    func testDNSAcceptsEmptyOrIPv4WithOptionalPort() {
        XCTAssertTrue(SetupRules.isValidDNS(""))
        XCTAssertTrue(SetupRules.isValidDNS("192.168.1.1"))
        XCTAssertTrue(SetupRules.isValidDNS(" 1.1.1.1:53 "))
    }

    func testDNSRefusesHostnamesBadOctetsAndPorts() {
        XCTAssertFalse(SetupRules.isValidDNS("dns.google"))
        XCTAssertFalse(SetupRules.isValidDNS("256.1.1.1"))
        XCTAssertFalse(SetupRules.isValidDNS("1.1.1"))
        XCTAssertFalse(SetupRules.isValidDNS("1.1.1.1:0"))
        XCTAssertFalse(SetupRules.isValidDNS("1.1.1.1:70000"))
        XCTAssertFalse(SetupRules.isValidDNS("1.1.1.1:53:1"))
        XCTAssertFalse(SetupRules.isValidDNS("1..1.1"))
    }

    func testUpstreamIsAPresetOrAnHTTPURL() {
        let presets = ["petkit-asia", "petkit-eu"]
        XCTAssertTrue(SetupRules.isValidUpstream("", presets: presets))
        XCTAssertTrue(SetupRules.isValidUpstream("petkit-eu", presets: presets))
        XCTAssertTrue(SetupRules.isValidUpstream("https://api.eu-pet.com/6/", presets: presets))
        XCTAssertFalse(SetupRules.isValidUpstream("petkit-mars", presets: presets))
        XCTAssertFalse(SetupRules.isValidUpstream("ftp://api.eu-pet.com", presets: presets))
    }

    func testUpstreamLabels() {
        XCTAssertEqual(SetupRules.upstreamLabel("", defaultPreset: "petkit-asia"), "Asia")
        XCTAssertEqual(SetupRules.upstreamLabel("petkit-eu", defaultPreset: "petkit-asia"), "Europe")
        XCTAssertEqual(SetupRules.upstreamLabel("https://api.eu-pet.com/6/", defaultPreset: ""), "api.eu-pet.com")
    }

    // MARK: Settings diff

    func testNamingTheDefaultPresetIsNotAChange() {
        XCTAssertFalse(SetupRules.isChange(key: "proxy_upstream", saved: "", edited: "petkit-asia",
                                           defaultUpstream: "petkit-asia"))
        XCTAssertTrue(SetupRules.isChange(key: "proxy_upstream", saved: "", edited: "petkit-eu",
                                          defaultUpstream: "petkit-asia"))
    }

    func testEndpointListsCompareNormalised() {
        XCTAssertEqual(SetupRules.normalisedEndpointList(" dev_device_info, ,dev_signup "), "dev_device_info,dev_signup")
        XCTAssertFalse(SetupRules.isChange(key: "proxy_only", saved: "a,b", edited: "a, b", defaultUpstream: ""))
        XCTAssertTrue(SetupRules.isChange(key: "proxy_only", saved: "a,b", edited: "a", defaultUpstream: ""))
    }

    func testOtherTextSettingsCompareTrimmed() {
        XCTAssertFalse(SetupRules.isChange(key: "proxy_dns", saved: "1.1.1.1", edited: " 1.1.1.1 ", defaultUpstream: ""))
        XCTAssertTrue(SetupRules.isChange(key: "proxy_dns", saved: "1.1.1.1", edited: "", defaultUpstream: ""))
    }

    // MARK: Blocked attempts

    func testBlockedThisWeekCountsTheLastSevenDays() {
        let now = Date(timeIntervalSince1970: 1_000_000)
        let times = [now.timeIntervalSince1970 - 60, now.timeIntervalSince1970 - 6 * 86_400,
                     now.timeIntervalSince1970 - 8 * 86_400]
        XCTAssertEqual(SetupRules.blockedThisWeek(times, now: now), 2)
    }

    func testRuleLabels() {
        XCTAssertEqual(SetupRules.ruleLabel("rce"), "Shell command")
        XCTAssertEqual(SetupRules.ruleLabel("weird"), "weird")
        XCTAssertEqual(SetupRules.ruleLabel(nil), "Unknown")
    }

    // MARK: Retention

    func testRetentionKindsCarryTheServerDefaults() throws {
        let video = try XCTUnwrap(RetentionRules.kinds.first { $0.key == "fullVideo" })
        XCTAssertEqual(video.defaultDays, 7)
        XCTAssertEqual(video.defaultMegabytes, 1024)
        let events = try XCTUnwrap(RetentionRules.kinds.first { $0.key == "events" })
        XCTAssertFalse(events.isSized)
        XCTAssertFalse(RetentionRules.kinds.contains { $0.key == "rawUpload" })
    }

    func testRetentionText() {
        XCTAssertEqual(RetentionRules.text(days: 30, megabytes: 10_240), "30 days · 10 GB max")
        XCTAssertEqual(RetentionRules.text(days: 1, megabytes: nil), "1 day")
        XCTAssertEqual(RetentionRules.text(days: nil, megabytes: nil), "No limit")
        XCTAssertEqual(RetentionRules.text(days: 0.5, megabytes: nil), "0.5 days")
    }

    func testRetentionCapsParse() {
        XCTAssertEqual(RetentionRules.parseCap(""), .some(nil))
        XCTAssertEqual(RetentionRules.parseCap("14"), .some(14))
        XCTAssertEqual(RetentionRules.parseCap("0,5"), .some(0.5))
        XCTAssertNil(RetentionRules.parseCap("0"))
        XCTAssertNil(RetentionRules.parseCap("-3"))
        XCTAssertNil(RetentionRules.parseCap("lots"))
        XCTAssertNil(RetentionRules.parseCap("inf"))
    }

    func testRetentionFieldText() {
        XCTAssertEqual(RetentionRules.fieldText(nil), "")
        XCTAssertEqual(RetentionRules.fieldText(180), "180")
        XCTAssertEqual(RetentionRules.fieldText(0.5), "0.5")
    }
}
