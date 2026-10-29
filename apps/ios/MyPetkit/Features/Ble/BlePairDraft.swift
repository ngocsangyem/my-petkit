import Foundation
import PetkitAPI

/// A Bluetooth MAC address as the server compares it: twelve uppercase hex
/// digits with no separators. Mirrors the server's `normalize_mac`, which drops
/// every non-alphanumeric character first, so `aa:bb:cc:dd:ee:ff`,
/// `AA-BB-CC-DD-EE-FF` and `aabb.ccdd.eeff` are the same accessory. Checking
/// here only saves a round trip; the server stays the authority.
enum BleMACAddress {
    /// The canonical form, or nil when `raw` is not twelve hex digits.
    static func normalize(_ raw: String) -> String? {
        let kept = raw.unicodeScalars.filter { CharacterSet.alphanumerics.contains($0) }
        let cleaned = String(String.UnicodeScalarView(kept)).uppercased()
        // An explicit set: `Character.isHexDigit` also accepts full-width forms.
        guard cleaned.count == 12, cleaned.allSatisfy({ "0123456789ABCDEF".contains($0) }) else { return nil }
        return cleaned
    }

    /// `AABBCCDDEEFF` as `AA:BB:CC:DD:EE:FF`; anything else is returned as is.
    static func display(_ raw: String) -> String {
        guard let canonical = normalize(raw) else { return raw }
        var pairs: [String] = []
        var index = canonical.startIndex
        while index < canonical.endIndex {
            let next = canonical.index(index, offsetBy: 2)
            pairs.append(String(canonical[index..<next]))
            index = next
        }
        return pairs.joined(separator: ":")
    }
}

/// The accessory kinds the server accepts, with the names the panel shows.
enum BleAccessoryType: String, CaseIterable, Identifiable, Sendable {
    case k3, w5, w4, ctw3, ctw2

    var id: String { rawValue }

    init?(_ payload: Components.Schemas.BleAccessory.BleTypePayload) {
        self.init(rawValue: payload.rawValue)
    }

    /// The chip label in the pair sheet.
    var chipTitle: String {
        switch self {
        case .k3: "Pura Air K3"
        case .w5: "EverSweet W5"
        case .w4: "EverSweet W4"
        case .ctw3: "Max Cordless CTW3"
        case .ctw2: "Solo 2 CTW2"
        }
    }

    /// What the accessory is, in a row or a confirmation.
    var noun: String { self == .k3 ? "spray" : "fountain" }

    var isSpray: Bool { self == .k3 }

    var drawing: DeviceKind { isSpray ? .purifier : .fountain }

    var payload: Components.Schemas.BleAccessoryPairRequest.BleTypePayload {
        switch self {
        case .k3: .k3
        case .w5: .w5
        case .w4: .w4
        case .ctw3: .ctw3
        case .ctw2: .ctw2
        }
    }
}

/// The pair sheet's fields as typed, and the request they turn into.
struct BlePairDraft: Equatable {
    static let defaultInterval = 240

    /// A field the client refuses before anything is sent.
    enum Problem: Error, Equatable {
        case mac
        case interval
        case accessoryID
        case scanType

        var message: String {
            switch self {
            case .mac: "Enter 12 hex digits, for example A4:C1:38:2F:7B:10."
            case .interval: "The report interval is a whole number of seconds above 0."
            case .accessoryID: "The accessory id is a whole number above 0, or empty to let the server choose."
            case .scanType: "The scan type is a whole number, 0 or more, or empty for the default."
            }
        }
    }

    var type: BleAccessoryType = .w5
    var mac = ""
    var secret = ""
    var serialNumber = ""
    var interval = String(Self.defaultInterval)
    /// Empty asks the server to allocate one from 900001 upward.
    var accessoryID = ""
    /// Empty keeps the server's table value for the type.
    var scanType = ""
    /// Only read for a K3: whether the parent litter box is told it owns it.
    var linkK3 = true

    /// The request for a parent `parentID`, or the first field to fix.
    ///
    /// A fountain is always linked: `link_with` is the device that relays for
    /// it, and an unlinked fountain is never scanned for. A K3 is linked only
    /// when asked, because linking writes `k3Id` on the litter box.
    func request(parentID: Int) -> Result<Components.Schemas.BleAccessoryPairRequest, Problem> {
        guard let canonicalMAC = BleMACAddress.normalize(mac) else { return .failure(.mac) }

        let intervalText = interval.trimmingCharacters(in: .whitespaces)
        let intervalValue: Int
        if intervalText.isEmpty {
            intervalValue = Self.defaultInterval
        } else if let parsed = Int(intervalText), parsed > 0 {
            intervalValue = parsed
        } else {
            return .failure(.interval)
        }

        let idText = accessoryID.trimmingCharacters(in: .whitespaces)
        var idValue: Int?
        if !idText.isEmpty {
            guard let parsed = Int(idText), parsed > 0 else { return .failure(.accessoryID) }
            idValue = parsed
        }

        let scanText = scanType.trimmingCharacters(in: .whitespaces)
        var scanValue: Int?
        if !scanText.isEmpty {
            guard let parsed = Int(scanText), parsed >= 0 else { return .failure(.scanType) }
            scanValue = parsed
        }

        let secretText = secret.trimmingCharacters(in: .whitespacesAndNewlines)
        let serialText = serialNumber.trimmingCharacters(in: .whitespacesAndNewlines)
        let linked = !type.isSpray || linkK3

        return .success(.init(
            bleType: type.payload,
            petkitId: idValue,
            mac: canonicalMAC,
            linkWith: linked ? parentID : nil,
            secret: secretText.isEmpty ? nil : secretText,
            interval: intervalValue,
            serialNumber: serialText.isEmpty ? nil : serialText,
            scanType: scanValue
        ))
    }
}
