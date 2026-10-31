import PetkitAPI
import PetkitCore
import SwiftUI
import UniformTypeIdentifiers

/// A device's sounds (`ios-sounds`), pushed from its detail: the device's own
/// sound and uploads, play, select, delete and upload, then volume and voice
/// language when the model has them. Every write asks first.
struct SoundsView: View {
    let deviceID: String
    @Environment(ServerSession.self) private var session: ServerSession?
    @State private var model: SoundsModel
    @State private var confirmation: CommandConfirmation?
    @State private var importing = false
    private let loadsFromServer: Bool

    init(deviceID: String) {
        self.deviceID = deviceID
        _model = State(initialValue: SoundsModel(deviceID: deviceID))
        loadsFromServer = true
    }

    /// A screen over a prepared model, for previews.
    init(model: SoundsModel) {
        deviceID = model.deviceID
        _model = State(initialValue: model)
        loadsFromServer = false
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ScheduleScreenHeader(title: L10n.string("Sounds"), lede: lede, actionImage: "plus",
                                   actionLabel: L10n.string("Upload a sound"), action: startUpload)
                VStack(alignment: .leading, spacing: Theme.Space.gap) { content }
                    .padding(.horizontal, Theme.Space.screenEdge)
                    .padding(.bottom, Theme.Space.pad)
            }
        }
        .refreshable { await reload() }
        .background(Theme.Color.ground.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .task { await reload() }
        .sheet(item: $confirmation) { ConfirmCommandSheet(confirmation: $0) }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.audio]) { picked($0) }
    }

    private var lede: Text? {
        guard let device = model.device.value else { return nil }
        return device.isFeeder
            ? Text("\(device.name) plays the selected sound. Play sends a sound to the feeder once, so you hear it there.")
            : Text("\(device.name) plays the selected sound. Play sends a sound to the device once, so you hear it there.")
    }

    @ViewBuilder
    private var content: some View {
        LoadableBlock(state: model.sounds, retry: retrySounds) { _ in
            Card(padding: 4) {
                VStack(spacing: 0) {
                    ForEach(Array(model.rows.enumerated()), id: \.element.id) { index, sound in
                        if index > 0 { RowRule() }
                        SoundRow(sound: sound, isSelected: model.isSelected(sound),
                                 onPlay: { ask(.play, sound) }, onSelect: { ask(.select, sound) },
                                 onDelete: { ask(.delete, sound) })
                    }
                }
                .padding(.horizontal, 12)
            }
        }
        if let problem = model.uploadProblem {
            WarningPanel(text: problem)
        }
        LoadableBlock(state: model.device, loadingHeight: 52, retry: retryDevice) { device in
            SoundSettingsCard(volume: device.volume, language: device.language) { key, value, label in
                confirmation = settingConfirmation(key: key, value: value, label: label)
            }
        }
        limits
            .font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted).padding(.horizontal, 4)
    }

    private var limits: Text {
        guard let stored = model.sounds.value?.count else { return Text("Up to \(SoundUploadPolicy.maxSounds) uploads, 2 MB each.") }
        return Text("Up to \(SoundUploadPolicy.maxSounds) uploads, 2 MB each; \(stored) stored.")
    }

    // MARK: Upload

    private func startUpload() {
        model.uploadProblem = nil
        // Refused before the picker opens, exactly as the server would refuse it.
        if let count = model.sounds.value?.count, count >= SoundUploadPolicy.maxSounds {
            model.uploadProblem = SoundUploadPolicy.problem(existingCount: count, byteCount: 1, fileName: "")
            return
        }
        importing = true
    }

    private func picked(_ result: Result<URL, any Error>) {
        switch result {
        case .failure(let error):
            model.uploadProblem = error.localizedDescription
        case .success(let url):
            switch SoundFileReader.read(url, existingCount: model.sounds.value?.count ?? 0) {
            case .failure(let problem):
                model.uploadProblem = problem.message
            case .success(let file):
                confirmation = CommandConfirmation(
                    question: L10n.string("Upload \(file.name)?"),
                    detail: L10n.string(
                        "\(SoundUploadPolicy.formatSize(file.data.count)). The device downloads it and can play it from then on."
                    ),
                    confirmTitle: L10n.string("Upload")
                ) { [session, model] in
                    guard let session else { throw APIError.notPaired }
                    try await model.upload(file, using: session)
                }
            }
        }
    }

    // MARK: Confirmations

    private enum Command { case play, select, delete }

    private func ask(_ command: Command, _ sound: DeviceSound) {
        let (question, detail, title): (String, String, String) = switch command {
        case .play: (L10n.string("Play \(sound.name)?"), L10n.string("The device plays it once through its speaker."),
                     L10n.string("Play"))
        case .select: (L10n.string("Use \(sound.name)?"), L10n.string("The device plays this sound from now on."),
                       L10n.string("Use this sound"))
        case .delete: (L10n.string("Delete \(sound.name)?"),
                       L10n.string("It is removed from this server and from the device's list."), L10n.string("Delete"))
        }
        confirmation = CommandConfirmation(question: question, detail: detail, confirmTitle: title) { [session, model] in
            guard let session else { throw APIError.notPaired }
            switch command {
            case .play: try await model.play(sound, using: session)
            case .select: try await model.select(sound, using: session)
            case .delete: try await model.delete(sound, using: session)
            }
        }
    }

    private func settingConfirmation(key: String, value: String, label: String) -> CommandConfirmation {
        CommandConfirmation(question: L10n.string("Set \(label)?"), detail: L10n.string("The device is sent the new setting."),
                            confirmTitle: L10n.string("Set")) { [session, model] in
            guard let session else { throw APIError.notPaired }
            try await model.setEntity(key, value: value, using: session)
        }
    }

    // MARK: Loading

    private func retrySounds() { Task { await reloadSounds() } }
    private func retryDevice() { Task { await reloadDevice() } }

    private func reload() async {
        guard loadsFromServer, let session else { return }
        await model.load(using: session)
    }

    private func reloadSounds() async {
        guard loadsFromServer, let session else { return }
        await model.loadSounds(using: session)
    }

    private func reloadDevice() async {
        guard loadsFromServer, let session else { return }
        await model.loadDevice(using: session)
    }
}

/// Reads a file picked in Files. The size is checked from its metadata first,
/// so a file over the limit is never read into memory.
enum SoundFileReader {
    static func read(_ url: URL, existingCount: Int) -> Result<SoundFile, FormProblem> {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        let name = url.lastPathComponent
        let size = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
        if size > SoundUploadPolicy.maxBytes || existingCount >= SoundUploadPolicy.maxSounds,
           let problem = SoundUploadPolicy.problem(existingCount: existingCount, byteCount: size, fileName: name) {
            return .failure(FormProblem(message: problem))
        }
        do {
            let data = try Data(contentsOf: url, options: .mappedIfSafe)
            if let problem = SoundUploadPolicy.problem(existingCount: existingCount, byteCount: data.count, fileName: name) {
                return .failure(FormProblem(message: problem))
            }
            return .success(SoundFile(name: name, data: data))
        } catch {
            return .failure(FormProblem(message: L10n.string("\(name) could not be read.")))
        }
    }
}

#Preview("Sounds") {
    SoundsView(model: SoundsFixtures.model())
}
