#if DEBUG
import PetkitCore
import SwiftUI

extension PatchersModel {
    /// A litter box with two patches and an ESP32 feeder, never contacted.
    static func preview() -> PatchersModel {
        let model = PatchersModel(session: ServerPreviewFixtures.session)
        model.hasLoaded = true
        let camera = PatcherEntry(
            id: .camera, name: "Local camera streaming",
            description: "Stream the litter box camera from this server instead of PetKit's cloud relay.\\n\\n"
                + "Adds /system/app_init.sh, which starts the local video server at boot. Firmware files are not overwritten.",
            status: "not applied", applied: false, unavailable: "", greyed: false, needsBytes: 131_072)
        let ssh = PatcherEntry(
            id: .ssh, name: "SSH access", description: "Root SSH on port 22 with your key.",
            status: "applied", applied: true, unavailable: "", greyed: false, needsBytes: 262_144,
            needsPubkey: true, sshPubkey: "")
        model.rows = .loaded([
            Row(device: PatchableDevice(id: 100_234_567, name: "Litter box", type: "t6", firmware: "1.2.86"),
                patchers: .loaded(DevicePatchers(supported: true, deviceIP: "192.168.1.41", patchers: [camera, ssh]))),
            Row(device: PatchableDevice(id: 100_155_021, name: "Feeder", type: "d4", firmware: "1.0.9"),
                patchers: .loaded(DevicePatchers(supported: false, deviceIP: "", patchers: []))),
        ])
        return model
    }
}

#Preview("Patch") {
    let model = PatchersModel.preview()
    return NavigationStack {
        PatcherDetailView(model: model, route: PatcherRoute(deviceID: 100_234_567, patcherID: "camera"))
    }
    .environment(ServerPreviewFixtures.session)
}
#endif
