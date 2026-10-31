import Foundation

/// The app's own strings in the language picked on the Language screen.
///
/// SwiftUI's `Text("…")`, `Button("…")` and friends take a localized key and
/// resolve it in the root's `\.locale`, which follows the choice. Everything
/// that ends up as a plain `String` (a component's title, a model's message,
/// a formatter's output) goes through here instead: `String(localized:)`
/// alone looks up the phone's language, not the app's. The lookup sets the
/// resource's locale, which picks both the `.lproj` and the plural rules.
enum L10n {
    /// `resource` in the current app language. Interpolated values become
    /// format specifiers in the String Catalog key (`%@`, `%lld`).
    static func string(_ resource: LocalizedStringResource) -> String {
        string(resource, in: AppLanguageStore.shared.language)
    }

    static func string(_ resource: LocalizedStringResource, in language: AppLanguage) -> String {
        var resource = resource
        resource.locale = language.locale()
        return String(localized: resource)
    }

    /// The locale for dates and numbers formatted outside a view's
    /// environment (`Date.formatted`, `DateFormatter`).
    static var locale: Locale { AppLanguageStore.shared.language.locale() }

    /// The locale for a device's 24-hour wall-clock times (schedules, the
    /// auto-pack time, "silent since").
    static var deviceClockLocale: Locale { AppLanguageStore.shared.language.deviceClockLocale() }
}
