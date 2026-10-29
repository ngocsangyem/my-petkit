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
                PushedScreenHeader(title: "Sounds", lede: lede, actionImage: "plus",
                                   actionLabel: "Upload a sound", action: startUpload)
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
        let noun = device.isFeeder ? "feeder" : "device"
        return Text("\(device.name) plays the selected sound. Play sends a sound to the \(noun) once, so you hear it there.")
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
        Text("Up to \(SoundUploadPolicy.maxSounds) uploads, 2 MB each\(storedCount).")
            .font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted).padding(.horizontal, 4)
    }

    private var storedCount: String {
        model.sounds.value.map { "; \($0.count) stored" } ?? ""
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
                    question: "Upload \(file.name)?",
                    detail: "\(SoundUploadPolicy.formatSize(file.data.count)). The device downloads it and can play it from then on.",
                    confirmTitle: "Upload"
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
        case .play: ("Play \(sound.name)?", "The device plays it once through its speaker.", "Play")
        case .select: ("Use \(sound.name)?", "The device plays this sound from now on.", "Use this sound")
        case .delete: ("Delete \(sound.name)?", "It is removed from this server and from the device's list.", "Delete")
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
        CommandConfirmation(question: "Set \(label)?", detail: "The device is sent the new setting.",
                            confirmTitle: "Set") { [session, model] in
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
            return .failure(FormProblem(message: "\(name) could not be read."))
        }
    }
}

#Preview("Sounds") {
    SoundsView(model: SoundsFixtures.model())
}
