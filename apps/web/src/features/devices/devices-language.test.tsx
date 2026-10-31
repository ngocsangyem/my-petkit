import { act, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { i18n } from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { NeedsYouCard } from './components/needs-you-card';
import { consumableText } from './lib/device-status';
import { localDayLabel } from './lib/device-zone';
import { portionsText } from './lib/feed-plan';
import { REASON_SENTENCE, reasonSentence } from './live/live-copy';
import { formatDeviceMoment } from './schedules/schedule-clock';

// 2026-10-28 06:10 UTC, a Wednesday.
const WED = Date.UTC(2026, 9, 28, 6, 10) / 1000;
const UTC = { kind: 'offset', hours: 0 } as const;

describe('devices copy in Vietnamese', () => {
  it('keeps the design form of the day label in English and uses Intl in Vietnamese', async () => {
    expect(localDayLabel(WED, UTC)).toBe('Wed 28 Oct');
    await act(() => i18n.changeLanguage('vi'));
    const expected = new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'UTC',
      weekday: 'short',
      day: 'numeric',
      month: 'numeric',
    }).format(new Date(Date.UTC(2026, 9, 28)));
    expect(localDayLabel(WED, UTC)).toBe(expected);
  });

  it('formats a one-off feed in the active locale, not the one first used', async () => {
    const english = formatDeviceMoment(WED, 7);
    await act(() => i18n.changeLanguage('vi'));
    const vietnamese = formatDeviceMoment(WED, 7);
    expect(vietnamese).not.toBe(english);
    expect(vietnamese).toContain('13:10');
  });

  it('counts consumables and portions with both plural forms', async () => {
    expect(consumableText('Filter', 1)).toBe('Filter in 1 day');
    expect(consumableText('Filter', 3, true)).toBe('Filter runs out in 3 days');
    expect(consumableText('Filter', 0)).toBe('Filter used up');
    expect(portionsText({ minute: 0, a1: 1, a2: 0 }, false)).toBe('1 portion');
    await act(() => i18n.changeLanguage('vi'));
    expect(consumableText('Lõi lọc', 1)).toBe('Lõi lọc còn 1 ngày');
    expect(consumableText('Lõi lọc', 3, true)).toBe('Lõi lọc hết sau 3 ngày');
    expect(portionsText({ minute: 0, a1: 2, a2: 1 }, true)).toBe('2 + 1 phần');
  });

  it('reads live reasons in the language active at the time of reading', async () => {
    expect(REASON_SENTENCE.not_a_camera).toBe('This device has no camera.');
    await act(() => i18n.changeLanguage('vi'));
    expect(REASON_SENTENCE.not_a_camera).toBe('Thiết bị này không có camera.');
    expect(reasonSentence(null)).toBe('Hiện không xem trực tiếp được.');
  });

  it('re-renders a card when the language changes', async () => {
    renderWithProviders(<NeedsYouCard items={[]} blocked={2} />);
    expect(screen.getByText('Nothing needs you right now')).toBeInTheDocument();
    expect(screen.getByText('2 blocked cloud attempts this week')).toBeInTheDocument();
    await act(() => i18n.changeLanguage('vi'));
    expect(screen.getByText('Hiện không có gì cần bạn xử lý')).toBeInTheDocument();
    expect(screen.getByText('Tuần này đã chặn 2 lần kết nối đám mây')).toBeInTheDocument();
  });
});
