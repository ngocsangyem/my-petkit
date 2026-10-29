#if DEBUG
import PetkitAPI
import PetkitCore
import SwiftUI

extension ServerSetupModel {
    /// Guards on, proxy off, default caps: never contacted.
    static func preview() -> ServerSetupModel {
        let model = ServerSetupModel(session: ServerPreviewFixtures.session)
        model.hasLoaded = true
        let values = ServerLiveSettings(
            proxyMode: false, proxyUpstream: "", proxyDns: "", proxyBlockRunCmd: true, proxyBlockOta: true,
            proxyBlockLogUpload: true, proxyMediaRealOss: false, proxyLocalCvrWindow: false,
            proxyMqttBridge: true, proxyOnly: "", capture: false)
        model.settings = .loaded(Settings(values: values, writable: true,
                                          presets: ["petkit-asia", "petkit-eu", "petkit-americas"],
                                          defaultPreset: "petkit-asia"))
        model.blocked = .loaded([
            SetupBlockedAttempt(id: 1, deviceId: 100_234_567, kind: "ota", transport: .mqtt,
                                endpoint: "/ota/device/upgrade", payloadJson: "{\"url…(212)", upstream: nil,
                                fieldPath: "params.url", detailJson: nil,
                                createdAt: Date.now.timeIntervalSince1970 - 7_200),
        ])
        func cap(_ megabytes: Double?, _ days: Double?) -> Components.Schemas.SetupRetentionCap {
            .init(maxMb: megabytes, maxDays: days)
        }
        model.retention = .loaded(SetupRetentionCaps(
            fullVideo: cap(10_240, 30), eventImage: cap(512, 30), highLight: cap(512, 30),
            dynamicVideo: cap(512, 7), cloudDouble: cap(256, 3), wasteCheck: cap(512, 90),
            healthPic: cap(256, 90), events: cap(nil, 180), blocked: cap(nil, 365),
            deviceLog: cap(18, 14), rawUpload: cap(2_048, 2), thumbnail: cap(256, 30)))
        model.deviceLogBytes = 3_355_443
        return model
    }
}

#Preview("Server setup") {
    NavigationStack { ServerSetupScreen(model: .preview()) }
        .environment(ServerPreviewFixtures.session)
}
#endif
