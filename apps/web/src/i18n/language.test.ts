import { act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { currentLanguage, currentLocale, i18n, normalizeLanguage, setLanguage } from '@/i18n';

describe('language', () => {
  it('starts in English and treats anything unshipped as English', () => {
    expect(currentLanguage()).toBe('en');
    expect(normalizeLanguage('vi')).toBe('vi');
    expect(normalizeLanguage('fr')).toBe('en');
    expect(normalizeLanguage(null)).toBe('en');
  });

  it('stores the choice, marks the document and switches the strings', async () => {
    await act(async () => {
      setLanguage('vi');
      await Promise.resolve();
    });
    expect(localStorage.getItem('mp.language')).toBe('"vi"');
    expect(document.documentElement.lang).toBe('vi');
    expect(i18n.t('save')).toBe('Lưu');
    expect(currentLocale()).toBe('vi-VN');
  });

  it("formats English with the browser's own locale, whatever its language", () => {
    const browser = vi.spyOn(navigator, 'language', 'get').mockReturnValue('vi-VN');
    expect(currentLocale()).toBe('vi-VN');
    browser.mockReturnValue('en-GB');
    expect(currentLocale()).toBe('en-GB');
    browser.mockRestore();
  });

  it('counts in both languages, Vietnamese included for one', async () => {
    expect(i18n.t('auth:meter.atLeast', { count: 1 })).toBe('At least 1 character');
    expect(i18n.t('auth:meter.atLeast', { count: 10 })).toBe('At least 10 characters');
    await i18n.changeLanguage('vi');
    expect(i18n.t('auth:meter.atLeast', { count: 1 })).toBe('Tối thiểu 1 ký tự');
  });
});
