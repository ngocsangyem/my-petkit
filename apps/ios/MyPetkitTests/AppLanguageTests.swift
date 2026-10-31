import Foundation
import Observation
import XCTest
@testable import MyPetkit

final class AppLanguageTests: XCTestCase {
    private var defaults: UserDefaults!
    private var suiteName: String!
    // Not `AppLanguageStore.storageKey`: the scheme's `-appLanguage en`
    // argument shadows that key in every suite.
    private let key = "AppLanguageTests.language"

    override func setUp() {
        super.setUp()
        suiteName = "AppLanguageTests.\(UUID().uuidString)"
        defaults = UserDefaults(suiteName: suiteName)
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: suiteName)
        super.tearDown()
    }

    // MARK: Stored value

    func testMissingOrUnknownStoredValueIsEnglish() {
        XCTAssertEqual(AppLanguage(stored: nil), .english)
        XCTAssertEqual(AppLanguage(stored: ""), .english)
        XCTAssertEqual(AppLanguage(stored: "fr"), .english)
        XCTAssertEqual(AppLanguage.default, .english)
    }

    func testStoredCodesReadBack() {
        XCTAssertEqual(AppLanguage(stored: "en"), .english)
        XCTAssertEqual(AppLanguage(stored: "vi"), .vietnamese)
    }

    func testEachLanguageIsNamedInItself() {
        XCTAssertEqual(AppLanguage.english.nativeName, "English")
        XCTAssertEqual(AppLanguage.vietnamese.nativeName, "Tiếng Việt")
        XCTAssertEqual(AppLanguage.allCases, [.english, .vietnamese])
    }

    func testLocaleSwapsOnlyTheLanguage() {
        let locale = AppLanguage.vietnamese.locale(base: Locale(identifier: "en_GB@fw=sun"))
        XCTAssertEqual(locale.language.languageCode?.identifier, "vi")
        XCTAssertEqual(locale.region?.identifier, "GB")
        XCTAssertEqual(locale.firstDayOfWeek, .sunday)
    }

    func testEnglishFormatsExactlyAsThePhonesOwnLocale() {
        for identifier in ["en_US", "en_US@hours=h23", "en_GB", "en_AU"] {
            let base = Locale(identifier: identifier)
            XCTAssertEqual(clock(AppLanguage.english.locale(base: base)), clock(base), identifier)
        }
    }

    func testThePhonesTwentyFourHourSettingSurvives() {
        XCTAssertEqual(clock(AppLanguage.english.locale(base: Locale(identifier: "en_US@hours=h23"))), "17:05")
    }

    func testDeviceClockIsTwentyFourHourInVietnameseOnATwelveHourRegion() {
        let locale = AppLanguage.vietnamese.deviceClockLocale(base: Locale(identifier: "en_US"))
        XCTAssertEqual(locale.language.languageCode?.identifier, "vi")
        XCTAssertEqual(clock(locale), "17:05")
        let padded = moment.formatted(Date.FormatStyle(locale: locale, timeZone: .gmt)
            .hour(.twoDigits(amPM: .omitted)).minute(.twoDigits))
        XCTAssertEqual(padded, "17:05")
    }

    func testDeviceClockStaysBritishInEnglish() {
        XCTAssertEqual(AppLanguage.english.deviceClockLocale(base: Locale(identifier: "en_US")).identifier, "en_GB")
    }

    func testTheTestHostRunsInEnglish() {
        // The scheme passes `-appLanguage en`, so a language picked in the
        // Simulator cannot turn the English assertions of other tests red.
        XCTAssertEqual(AppLanguageStore.shared.language, .english)
    }

    private let moment = Date(timeIntervalSince1970: 17 * 3600 + 5 * 60)

    private func clock(_ locale: Locale) -> String {
        moment.formatted(Date.FormatStyle(locale: locale, timeZone: .gmt).hour().minute())
    }

    // MARK: Store

    func testStoreStartsInEnglishAndPersistsTheChoice() {
        let store = AppLanguageStore(defaults: defaults, key: key)
        XCTAssertEqual(store.language, .english)

        store.language = .vietnamese
        XCTAssertEqual(defaults.string(forKey: key), "vi")
        XCTAssertEqual(AppLanguageStore(defaults: defaults, key: key).language, .vietnamese)
    }

    func testStoreReadsAGarbageValueAsEnglish() {
        defaults.set("klingon", forKey: key)
        XCTAssertEqual(AppLanguageStore(defaults: defaults, key: key).language, .english)
    }

    func testChangingTheLanguageNotifiesWhoeverReadIt() {
        let store = AppLanguageStore(defaults: defaults, key: key)
        let changed = expectation(description: "observer told of the change")
        withObservationTracking {
            _ = store.language
        } onChange: {
            changed.fulfill()
        }
        store.language = .vietnamese
        wait(for: [changed], timeout: 1)
    }

    // MARK: Lookup

    func testLookupFollowsTheGivenLanguage() {
        XCTAssertEqual(L10n.string("Language", in: .english), "Language")
        XCTAssertEqual(L10n.string("Language", in: .vietnamese), "Ngôn ngữ")
    }

    func testInterpolatedValuesLandInTheTranslation() {
        let name = "iPad"
        XCTAssertEqual(L10n.string("Revoke \(name)?", in: .english), "Revoke iPad?")
        XCTAssertEqual(L10n.string("Revoke \(name)?", in: .vietnamese), "Thu hồi iPad?")
    }

    func testPluralsUseEachLanguagesRules() {
        XCTAssertEqual(L10n.string("\(1) files on the server.", in: .english), "1 file on the server.")
        XCTAssertEqual(L10n.string("\(3) files on the server.", in: .english), "3 files on the server.")
        // Vietnamese has one form only.
        XCTAssertEqual(L10n.string("\(1) files on the server.", in: .vietnamese), "1 tệp trên máy chủ.")
        XCTAssertEqual(L10n.string("\(3) files on the server.", in: .vietnamese), "3 tệp trên máy chủ.")
    }

    func testAMissingKeyFallsBackToTheEnglishText() {
        XCTAssertEqual(L10n.string("A sentence nobody translated.", in: .vietnamese), "A sentence nobody translated.")
    }
}
