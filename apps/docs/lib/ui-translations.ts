import { uiTranslations } from 'fumadocs-ui/i18n';
import { i18n, localeLabels } from './i18n';

// Fumadocs UI strings. Keys are the component's English text plus its `(note)` context, as
// the UI package encodes them; English needs no entries because the keys are its own text.
export const translations = i18n
  .translations()
  .extend(uiTranslations())
  .add({
    en: { displayName: localeLabels.en.name },
    vi: {
      displayName: localeLabels.vi.name,
      'Search(search dialog)': 'Tìm kiếm',
      'Close Search(search dialog)(aria-label)': 'Đóng tìm kiếm',
      'Search(search trigger)': 'Tìm kiếm',
      'Open Search(search trigger)(aria-label)': 'Mở tìm kiếm',
      'On this page(table of contents)': 'Trên trang này',
      'No Headings(table of contents)': 'Không có tiêu đề',
      'Table of Contents(inline table of contents)': 'Mục lục',
      'Edit on GitHub(edit page)': 'Sửa trên GitHub',
      'Last updated on(page footer)': 'Cập nhật lần cuối',
      'Previous Page(pagination)': 'Trang trước',
      'Next Page(pagination)': 'Trang sau',
      'Copy Markdown(page actions)': 'Sao chép Markdown',
      'Copied Markdown(page actions)': 'Đã sao chép Markdown',
      'Open(page actions)': 'Mở',
      'Open in GitHub(page actions)': 'Mở trên GitHub',
      'View as Markdown(page actions)': 'Xem dạng Markdown',
      'Open in Scira AI(page actions)': 'Mở trong Scira AI',
      'Open in ChatGPT(page actions)': 'Mở trong ChatGPT',
      'Open in Claude(page actions)': 'Mở trong Claude',
      'Open in Cursor(page actions)': 'Mở trong Cursor',
      'Read {url}, I want to ask questions about it.(page actions)':
        'Đọc {url}, tôi muốn hỏi vài câu về trang này.',
      'Copy Text(code block)(aria-label)': 'Sao chép',
      'Copied Text(code block)(aria-label)': 'Đã sao chép',
      'Copy Anchor Link(heading anchor)(aria-label)': 'Sao chép liên kết mục',
      'Copied Anchor Link(heading anchor)(aria-label)': 'Đã sao chép liên kết mục',
      'Copy Link(accordion)(aria-label)': 'Sao chép liên kết',
      'Copied Link(accordion)(aria-label)': 'Đã sao chép liên kết',
      'Open Sidebar(sidebar)(aria-label)': 'Mở thanh bên',
      'Close Sidebar(sidebar)(aria-label)': 'Đóng thanh bên',
      'Collapse Sidebar(sidebar)(aria-label)': 'Thu gọn thanh bên',
      'Toggle Menu(home layout header)(aria-label)': 'Mở/đóng menu',
      'Light(theme switcher)(aria-label)': 'Sáng',
      'Dark(theme switcher)(aria-label)': 'Tối',
      'System(theme switcher)(aria-label)': 'Theo hệ thống',
      'Toggle Theme(theme switcher)(aria-label)': 'Đổi giao diện',
      'Choose a language(language switcher)': 'Chọn ngôn ngữ',
      'Choose a language(language switcher)(aria-label)': 'Chọn ngôn ngữ',
      'Image Viewer(image zoom)(aria-label)': 'Trình xem ảnh',
      'Close(image zoom)(aria-label)': 'Đóng',
      'Previous Image(image zoom)(aria-label)': 'Ảnh trước',
      'Next Image(image zoom)(aria-label)': 'Ảnh sau',
      'Close Banner(banner)(aria-label)': 'Đóng thông báo',
      'Page Not Found(404 not found page)': 'Không tìm thấy trang',
      'Back to Home(404 not found page)': 'Về trang chủ',
    },
  });
