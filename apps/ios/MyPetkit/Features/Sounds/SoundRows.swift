import PetkitCore
import SwiftUI

/// One sound: play at the left, name and source, then the check mark when it
/// is the selected one or Delete for an upload. Tapping the row selects it.
struct SoundRow: View {
    let sound: DeviceSound
    let isSelected: Bool
    let onPlay: () -> Void
    let onSelect: () -> Void
    let onDelete: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            if sound.id != SoundsModel.builtInID {
                Button(action: onPlay) {
                    Image(systemName: "play.fill")
                        .font(Theme.Font.extraSmall)
                        .foregroundStyle(Theme.Color.text)
                        .frame(width: 40, height: 40)
                        .background(Theme.Color.raised, in: Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Play \(sound.name) on the device")
            } else {
                Image(systemName: "speaker.wave.2")
                    .font(Theme.Font.extraSmall)
                    .foregroundStyle(Theme.Color.muted)
                    .frame(width: 40, height: 40)
                    .background(Theme.Color.raised, in: Circle())
                    .accessibilityHidden(true)
            }
            // Not disabled when selected: a disabled row would grey out the one
            // sound that matters; selecting it again simply does nothing.
            Button { if !isSelected { onSelect() } } label: {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(sound.name)
                            .font(sound.isBuiltIn ? (isSelected ? Theme.Font.section : Theme.Font.body) : Theme.Font.monoMedium)
                            .foregroundStyle(Theme.Color.text)
                            .lineLimit(1)
                        Text(source).font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted).monospacedDigit()
                    }
                    Spacer(minLength: 8)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(sound.name), \(source)")
            .accessibilityHint(isSelected ? "" : "Use this sound")
            .accessibilityAddTraits(isSelected ? .isSelected : [])
            if isSelected {
                Image(systemName: "checkmark")
                    .font(Theme.Font.chevron)
                    .foregroundStyle(Theme.Color.onPrimary)
                    .frame(width: 22, height: 22)
                    .background(Theme.Color.text, in: Circle())
                    .accessibilityHidden(true)
            } else if !sound.isBuiltIn {
                Button("Delete", action: onDelete)
                    .font(Theme.Font.control.weight(.semibold))
                    .foregroundStyle(Theme.Color.negative)
                    .accessibilityLabel("Delete \(sound.name)")
            }
        }
        .frame(minHeight: 60)
    }

    private var source: String {
        guard let size = sound.size else { return "Built in" }
        return "Uploaded · \(SoundUploadPolicy.formatSize(size))"
    }
}

/// Volume and voice language, each only when the model has the setting.
struct SoundSettingsCard: View {
    let volume: SoundVolumeSetting?
    let language: SoundLanguageSetting?
    /// Entity key, the value to write, and words for the confirmation.
    let onSet: (String, String, String) -> Void

    var body: some View {
        if volume != nil || language != nil {
            Card(padding: 4) {
                VStack(spacing: 0) {
                    if let volume {
                        Menu {
                            ForEach(Array(volume.range), id: \.self) { level in
                                Button("\(level)") { onSet(volume.key, String(level), "volume to \(level)") }
                            }
                        } label: {
                            SettingsRow(title: "Volume", value: volume.display, showsChevron: volume.isSettable)
                        }
                        .disabled(!volume.isSettable)
                        .monospacedDigit()
                    }
                    if volume != nil && language != nil { RowRule() }
                    if let language {
                        Menu {
                            ForEach(language.options, id: \.self) { option in
                                Button(option) { onSet(language.key, option, "voice language to \(option)") }
                            }
                        } label: {
                            SettingsRow(title: "Voice language", value: language.display,
                                        showsChevron: language.isSettable)
                        }
                        .disabled(!language.isSettable)
                    }
                }
                .padding(.horizontal, 12)
            }
        }
    }
}

/// Preview data shaped like the art-direction sample.
enum SoundsFixtures {
    @MainActor
    static func model() -> SoundsModel {
        let model = SoundsModel(deviceID: "10002")
        model.device = .loaded(SoundsDevice(
            name: "Hallway box", isFeeder: false, selectedSound: SoundsModel.builtInID,
            volume: SoundVolumeSetting(key: SoundSettings.volumeKey, value: 6, range: 0...9, isSettable: true),
            language: SoundLanguageSetting(key: SoundSettings.languageKey, options: ["English", "Chinese"],
                                           selectedIndex: 0, isSettable: true)
        ))
        model.sounds = .loaded([DeviceSound(id: 1, name: "miso-call", size: 184_320)])
        return model
    }
}
