import { formatBytes, formatDuration, formatEntityValue, relativeTime } from './format';

describe('format', () => {
  it('renders bytes, durations and relative times like the old panel', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(null)).toBe('—');
    expect(formatDuration(142750)).toBe('1d 15h');
    expect(formatDuration(-1)).toBeNull();
    expect(relativeTime(100, 130_000)).toBe('30s ago');
    expect(relativeTime(0)).toBe('never');
  });

  it('maps option values to labels and keeps unmapped values visible', () => {
    const e = { options: ['idle', 'cleaning'], option_values: [0, 1], component: 'sensor' };
    expect(formatEntityValue({ ...e, value: 1 }).text).toBe('cleaning');
    expect(formatEntityValue({ ...e, value: 7 }).text).toBe('7');
  });

  it('does not append the raw unit to a formatted duration', () => {
    expect(formatEntityValue({ value: 3700, unit: 's', device_class: 'duration' })).toEqual({
      text: '1h 1m',
      unit: null,
    });
    expect(formatEntityValue({ value: 3.5, unit: 'kg' })).toEqual({ text: '3.5', unit: 'kg' });
    expect(formatEntityValue({ value: 0, component: 'binary_sensor' }).text).toBe('off');
  });
});
