import Foundation
import Testing
@testable import PetkitBLE

struct PayloadTests {
    private func payload(ssid: String = "Home", offset: Double = 5.75) -> ProvisioningPayload {
        ProvisioningPayload(ssid: ssid, password: "secret", server: "http://192.168.1.20/6/",
                            offsetHours: offset, zoneName: "Asia/Kathmandu")
    }

    @Test func isTheAppPayloadInItsKeyOrderWithoutEscapedSlashes() {
        let json = String(bytes: PetkitCommand.credentials(payload()).json, encoding: .utf8) ?? ""
        #expect(json == #"{"key":151,"payload":{"ssid":"Home","pwd":"secret","hide":1,"locale":"Asia/Kathmandu","#
            + #""timezone":"5.8","apiServers":["http://192.168.1.20/6/"],"ipServers":["http://192.168.1.20/6/"]}}"#)
        #expect(!json.contains(#"\/"#))
    }

    @Test func encodesANonAsciiSsidAsUtf8AndEscapesWhatJsonMust() {
        let json = PetkitCommand.credentials(payload(ssid: "Nhà \"2.4G\"\n")).json
        let text = String(bytes: json, encoding: .utf8) ?? ""
        #expect(text.contains(#""ssid":"Nhà \"2.4G\"\n""#))
        // "à" is two bytes on the wire.
        #expect(json.count == text.utf8.count)
        #expect(PetkitMessage(json: json)?.key == 151)
    }

    @Test(arguments: [(7.0, "7.0"), (5.75, "5.8"), (5.5, "5.5"), (0.25, "0.3"), (-3.5, "-3.5"),
                      (-9.75, "-9.8"), (0, "0.0"), (14, "14.0")])
    func writesTheOffsetAsTheWebPanelDoes(hours: Double, text: String) {
        #expect(ProvisioningPayload.offsetText(hours) == text)
    }

    @Test func offersUtcMinus12ToPlus14InQuarterHours() {
        let choices = ProvisioningRules.offsetChoices
        #expect(choices.count == 105)
        #expect(choices.first == -12 && choices.last == 14)
        #expect(ProvisioningRules.offsetLabel(5.75) == "UTC+05:45")
        #expect(ProvisioningRules.offsetLabel(-3.5) == "UTC-03:30")
        #expect(ProvisioningRules.offsetLabel(0) == "UTC+00:00")
    }

    @Test func snapsThePhoneOffsetToAQuarterHour() throws {
        let saigon = try #require(TimeZone(identifier: "Asia/Saigon"))
        let kathmandu = try #require(TimeZone(identifier: "Asia/Kathmandu"))
        #expect(ProvisioningRules.offsetHours(of: saigon) == 7)
        #expect(ProvisioningRules.offsetHours(of: kathmandu) == 5.75)
    }

    @Test func turnsTheLanguageTagIntoTheDevicesForm() {
        #expect(ProvisioningRules.language("en-US") == "en_US")
        #expect(ProvisioningRules.language("zh-Hans-CN") == "zh_Hans-CN")
        #expect(ProvisioningRules.language(nil) == "en_US")
        #expect(String(bytes: PetkitCommand.language("vi_VN").json, encoding: .utf8)
            == #"{"key":114,"payload":{"language":"vi_VN"}}"#)
    }

    @Test func warnsAboutServersSomeHardwareCannotUse() {
        #expect(ProvisioningRules.serverWarnings("http://192.168.50.29/6/").isEmpty)
        #expect(ProvisioningRules.serverWarnings("http://192.168.50.29:8080/6/") == [.notPort80])
        #expect(ProvisioningRules.serverWarnings("https://ha.example/6/") == [.notPort80])
        #expect(ProvisioningRules.serverWarnings("http://homeassistant.local/6/") == [.mdnsHost])
        #expect(ProvisioningRules.serverWarnings("http://homeassistant.local:8099/6/") == [.mdnsHost, .notPort80])
        #expect(ProvisioningRules.serverWarnings("http://192.168.").isEmpty)
        #expect(ProvisioningRules.serverWarnings("").isEmpty)
    }

    @Test func refusesBluetoothOnlyAccessoriesByName() {
        for name in ["Petkit_W5_1", "Petkit_W4X", "PETKIT_CTW2", "Petkit_CTW3", "Petkit_K2", "Petkit_K3_abc"] {
            #expect(ProvisioningRules.isAccessory(name), "\(name)")
        }
        #expect(!ProvisioningRules.isAccessory("PETKIT_T6_8F2A"))
        #expect(ProvisioningRules.isPetkit("PETKIT_T6_8F2A") && ProvisioningRules.isPetkit("Petkit_D4SH"))
        #expect(!ProvisioningRules.isPetkit("AirPods"))
    }
}
