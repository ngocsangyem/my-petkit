import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { bluetoothErrorText } from '@/ble/provision-device';
import { i18n } from '@/i18n';
import { ApiError, errorMessage } from '@/shared/api/errors';
import { formatDateTime, formatDuration, formatValue, relativeTime } from '@/shared/format/format';
import { ConfirmDialog } from './confirm-dialog';
import { ErrorBlock, Missing } from './state-blocks';
import { LiveIndicator, StatusMark, statusLabel } from './status-mark';
import { ThemeModeControl, ThemeModeProvider } from './theme-mode';

describe('built-in words follow the active language', () => {
  it('labels the appearance control and its modes in Vietnamese after a switch', async () => {
    render(
      <ThemeModeProvider>
        <ThemeModeControl />
      </ThemeModeProvider>,
    );
    expect(screen.getByRole('group', { name: 'Appearance' })).toBeInTheDocument();
    await act(() => i18n.changeLanguage('vi'));
    expect(screen.getByRole('group', { name: 'Giao diện' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Theo hệ thống' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tối' })).toBeInTheDocument();
  });

  it('translates default buttons and state words, and keeps words passed in', async () => {
    await act(() => i18n.changeLanguage('vi'));
    const { unmount } = render(
      <>
        <ErrorBlock message="x" onRetry={() => undefined} />
        <StatusMark status="offline" />
        <StatusMark status="online" label="Online · HTTP" />
        <LiveIndicator state="connecting" />
        <Missing />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
    expect(screen.getByText('Ngoại tuyến')).toBeInTheDocument();
    expect(screen.getByText('Online · HTTP')).toBeInTheDocument();
    expect(screen.getByText('Đang kết nối')).toBeInTheDocument();
    expect(screen.getByText('Không có giá trị')).toBeInTheDocument();
    unmount();
    render(
      <ConfirmDialog
        open
        title="?"
        confirmLabel="OK"
        onConfirm={() => undefined}
        onCancel={() => undefined}
      >
        body
      </ConfirmDialog>,
    );
    expect(screen.getByRole('button', { name: 'Hủy' })).toBeInTheDocument();
  });

  it('formats relative times, durations, switches and dates for Vietnamese', async () => {
    await act(() => i18n.changeLanguage('vi'));
    expect(relativeTime(100, 130_000)).toBe('30 giây trước');
    expect(relativeTime(0)).toBe('chưa bao giờ');
    expect(formatDuration(142750)).toBe('1 ngày 15 giờ');
    expect(formatValue(true)).toBe('bật');
    expect(statusLabel('unknown')).toBe('Không rõ');
    const at = Date.UTC(2026, 9, 29, 8, 12);
    expect(formatDateTime(at / 1000)).toBe(new Date(at).toLocaleString('vi-VN'));
  });

  it('keeps the server message and translates only the words around it', async () => {
    await act(() => i18n.changeLanguage('vi'));
    expect(errorMessage(new ApiError(400, 'bad', 'bad value', 'c-1'))).toBe(
      'bad value (mã tham chiếu c-1)',
    );
    expect(errorMessage('boom')).toBe('Đã xảy ra lỗi.');
    expect(bluetoothErrorText(new DOMException('x', 'SecurityError'))).toContain('HTTPS');
    expect(bluetoothErrorText(new DOMException('x', 'NotFoundError'))).toContain('ghép nối');
    expect(bluetoothErrorText(new DOMException('gone', 'NetworkError'))).toBe('NetworkError: gone');
  });
});
