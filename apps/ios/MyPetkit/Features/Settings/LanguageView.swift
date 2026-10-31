import PetkitCore
import SwiftUI

/// Language, pushed from Server › This phone: English or Tiếng Việt. The
/// choice applies at once; each language is named in itself.
struct LanguageView: View {
    var store = AppLanguageStore.shared

    var body: some View {
        ScreenScroll {
            PushedScreenHeader(title: L10n.string("Language"))
        } content: {
            RowsCard {
                ForEach(Array(AppLanguage.allCases.enumerated()), id: \.element) { index, language in
                    if index > 0 { RowRule() }
                    row(language)
                }
            }
            VStack(alignment: .leading, spacing: 6) {
                Text("Applies to the app right away. English is the default.")
                Text("Event names, device logs and server messages stay in English.")
            }
            .font(Theme.Font.small)
            .foregroundStyle(Theme.Color.muted)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 4)
        }
        .toolbar(.hidden, for: .navigationBar)
    }

    private func row(_ language: AppLanguage) -> some View {
        let isSelected = store.language == language
        return Button { store.language = language } label: {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(verbatim: language.nativeName).font(Theme.Font.body).foregroundStyle(Theme.Color.text)
                    if language == .default {
                        Text("Default").font(Theme.Font.extraSmall).foregroundStyle(Theme.Color.muted)
                    }
                }
                Spacer(minLength: 8)
                if isSelected {
                    Image(systemName: "checkmark")
                        .font(Theme.Font.chevron)
                        .foregroundStyle(Theme.Color.onPrimary)
                        .frame(width: 22, height: 22)
                        .background(Theme.Color.text, in: Circle())
                        .accessibilityHidden(true)
                }
            }
            .frame(minHeight: Theme.Space.rowHeight)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

#if DEBUG
#Preview("Language") {
    NavigationStack { LanguageView() }
}
#endif
