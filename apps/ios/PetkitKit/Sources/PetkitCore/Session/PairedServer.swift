import Foundation

/// The one server this phone is paired with: where it is, how to trust it,
/// and the client token it was issued. Persisted as a whole in the Keychain,
/// since the token is a credential and the pin decides who gets it.
public struct PairedServer: Sendable, Hashable, Codable {
    public let address: ServerAddress
    public let token: String
    public let tokenID: Int
    public let pairedAt: Date

    public init(address: ServerAddress, token: String, tokenID: Int, pairedAt: Date = .now) {
        self.address = address
        self.token = token
        self.tokenID = tokenID
        self.pairedAt = pairedAt
    }
}

/// Loads, saves and forgets the paired server.
public struct PairedServerStore: Sendable {
    static let account = "paired-server"
    private let keychain: KeychainStore

    public init(keychain: KeychainStore = KeychainStore(service: "dev.mypetkit.app")) {
        self.keychain = keychain
    }

    public func load() throws -> PairedServer? {
        guard let data = try keychain.read(Self.account) else { return nil }
        return try JSONDecoder().decode(PairedServer.self, from: data)
    }

    public func save(_ server: PairedServer) throws {
        try keychain.write(JSONEncoder().encode(server), for: Self.account)
    }

    public func forget() throws {
        try keychain.delete(Self.account)
    }
}
