import Foundation
import Observation

/// The language the app's own text is shown in. English is the default.
/// Text that comes from the server (event labels, error messages, device
/// logs) is never translated.
enum AppLanguage: String, CaseIterable, Identifiable, Sendable {
    case english = "en"
    case vietnamese = "vi"

    static let `default` = AppLanguage.english

    var id: String { rawValue }

    /// A stored value read back; anything unknown or missing is the default.
    init(stored: String?) {
        self = stored.flatMap(AppLanguage.init(rawValue:)) ?? .default
    }

    /// The language's name in that language, so it can be found by someone
    /// who cannot read the current one.
    var nativeName: String {
        switch self {
        case .english: "English"
        case .vietnamese: "Tiếng Việt"
        }
    }

    /// The locale strings are looked up and formatted in: the phone's own
    /// locale with only the language swapped, so its region, 24-hour
    /// setting, first weekday and custom formats all survive.
    func locale(base: Locale = .autoupdatingCurrent) -> Locale {
        var components = Locale.Components(locale: base)
        components.languageComponents.languageCode = Locale.LanguageCode(rawValue)
        components.languageComponents.script = nil
        return Locale(components: components)
    }

    /// The locale for a device's wall-clock times, which the app always
    /// prints as 24-hour without AM/PM: `en_GB` in English, as before, and
    /// this language with the hour cycle pinned otherwise (a 12-hour region
    /// would otherwise print 17:05 as "05:05").
    func deviceClockLocale(base: Locale = .autoupdatingCurrent) -> Locale {
        guard self != .english else { return Locale(identifier: "en_GB") }
        var components = Locale.Components(locale: locale(base: base))
        components.hourCycle = .zeroToTwentyThree
        return Locale(components: components)
    }
}

/// The chosen language, persisted in `UserDefaults`. It is observable by
/// hand rather than with `@Observable` so it can be read from any isolation:
/// every view whose body resolved a string through `L10n` reads `language`,
/// so changing it re-renders exactly those views, with no restart and no
/// loss of navigation state.
final class AppLanguageStore: Observable, @unchecked Sendable {
    /// The UserDefaults key the choice is stored under.
    static let storageKey = "appLanguage"
    static let shared = AppLanguageStore(defaults: .standard)

    private let registrar = ObservationRegistrar()
    // Guards `current`; `UserDefaults` is itself thread-safe.
    private let lock = NSLock()
    private let defaults: UserDefaults
    private let key: String
    private var current: AppLanguage

    /// `key` is for tests: the test scheme pins `-appLanguage en`, and an
    /// argument shadows that key in every `UserDefaults`, suites included.
    init(defaults: UserDefaults, key: String = storageKey) {
        self.defaults = defaults
        self.key = key
        current = AppLanguage(stored: defaults.string(forKey: key))
    }

    var language: AppLanguage {
        get {
            registrar.access(self, keyPath: \.language)
            return lock.withLock { current }
        }
        set {
            registrar.withMutation(of: self, keyPath: \.language) {
                lock.withLock { current = newValue }
                defaults.set(newValue.rawValue, forKey: key)
            }
        }
    }
}
