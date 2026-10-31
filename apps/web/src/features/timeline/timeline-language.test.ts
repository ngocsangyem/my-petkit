import { afterEach, describe, expect, it } from 'vitest';
import { i18n } from '@/i18n';
import { day } from './timeline-fixtures';
import { kindTag, visibleFilters } from './timeline-model';
import { visitSummary } from './timeline-summary';

describe('timeline text in Vietnamese', () => {
  afterEach(() => i18n.changeLanguage('en'));

  it('reads the finding line, chips and kind tags in the active language', async () => {
    await i18n.changeLanguage('vi');
    expect(visitSummary(day({ sessions: [] }), true)).toBe(
      'Hôm nay chưa có lượt dùng máy dọn phân nào.',
    );
    expect(visitSummary(day(), false)).toMatch(
      /^Miso đã dùng máy dọn phân 1 lần và Mochi 1 lần\. Lần gần nhất lúc /,
    );
    expect(visibleFilters(undefined, 'all').map(f => f.label)).toEqual(['Tất cả']);
    expect(kindTag('cleaning')).toBe('Dọn dẹp');
    // A kind the client does not know stays the server's word.
    expect(kindTag('new_kind')).toBe('new kind');
  });
});
