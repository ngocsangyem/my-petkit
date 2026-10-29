import PhotosUI
import SwiftUI
import UIKit

/// A photo picked or taken, waiting for its crop.
struct PetFaceCropRequest: Identifiable {
    let id = UUID()
    let image: UIImage
}

/// The add-a-face flow shared by the Pets screen and the edit screen: choose
/// camera or library, crop to 224², upload the raw JPEG.
struct PetFaceAdder: ViewModifier {
    @Binding var isChoosing: Bool
    let petName: String
    let upload: @MainActor (Data) async throws -> Void

    @State private var showsLibrary = false
    @State private var showsCamera = false
    @State private var pickerItem: PhotosPickerItem?
    @State private var taken: UIImage?
    @State private var crop: PetFaceCropRequest?
    @State private var pickError: String?

    func body(content: Content) -> some View {
        content
            .confirmationDialog("Add a face photo of \(petName)", isPresented: $isChoosing, titleVisibility: .visible) {
                if PetCameraCapture.isAvailable {
                    Button("Take a photo") { showsCamera = true }
                }
                Button("Choose from library") { showsLibrary = true }
            }
            .photosPicker(isPresented: $showsLibrary, selection: $pickerItem, matching: .images)
            .onChange(of: pickerItem) { _, item in
                guard let item else { return }
                pickerItem = nil
                Task { await loadPicked(item) }
            }
            .fullScreenCover(isPresented: $showsCamera, onDismiss: {
                // The crop sheet can only present once the camera is gone.
                if let taken { crop = PetFaceCropRequest(image: taken) }
                taken = nil
            }, content: {
                PetCameraCapture(onImage: { image in
                    taken = image
                    showsCamera = false
                }, onCancel: { showsCamera = false })
                .ignoresSafeArea()
            })
            .sheet(item: $crop) { request in
                PetFaceCropperView(image: request.image, petName: petName, upload: upload)
            }
            .alert("Photo not added", isPresented: Binding(get: { pickError != nil },
                                                         set: { if !$0 { pickError = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(pickError ?? "")
            }
    }

    private func loadPicked(_ item: PhotosPickerItem) async {
        do {
            guard let data = try await item.loadTransferable(type: Data.self), let image = UIImage(data: data) else {
                pickError = "That file is not a photo this phone can read."
                return
            }
            crop = PetFaceCropRequest(image: image)
        } catch {
            pickError = "The photo could not be loaded from the library."
        }
    }
}

extension View {
    func petFaceAdder(isChoosing: Binding<Bool>, petName: String,
                      upload: @escaping @MainActor (Data) async throws -> Void) -> some View {
        modifier(PetFaceAdder(isChoosing: isChoosing, petName: petName, upload: upload))
    }
}
