import { describe, expect, it } from 'vitest';
import type { HubEvent } from '@/shared/ws/hub-event';
import { mergeEvents } from './hooks/use-live-log';
import { matchesGrep } from './hooks/use-live-log-filters';
import { detailText, entriesText, isHeartbeat, levelOf } from './log-format';

const ev = (seq: number, extra: Partial<HubEvent> = {}): HubEvent => ({
  seq,
  ts: 1_761_700_000 + seq,
  kind: 'http',
  device_id: 100234567,
  summary: `POST /6/t6/dev_state_report -> 200`,
  ...extra,
});

describe('detailText', () => {
  it('renders an HTTP exchange with headers, bodies and the proxy block', () => {
    const text = detailText({
      method: 'POST',
      path: '/6/t6/dev_heartbeat',
      status: 200,
      headers: { 'X-Device': 'masked' },
      query: { id: '1' },
      req_body: '{"a":1}',
      resp_body: 'not json',
      proxy: { upstream: 'https://api', status: 200, served: 'upstream', redactions: ['sts'] },
    });
    expect(text).toContain('POST /6/t6/dev_heartbeat → 200');
    expect(text).toContain('X-Device: masked');
    expect(text).toContain('id = 1');
    expect(text).toContain('{\n  "a": 1\n}');
    expect(text).toContain('the cloud’s reply');
    expect(text).toContain('redacted: sts');
    expect(text).toContain('── Sent to the device ──\nnot json');
  });

  it('renders an MQTT frame with its full topic', () => {
    const text = detailText({
      topic: '/sys/a/b/thing/event/property/post',
      direction: 'device → server',
      client: 'c1',
      payload: '{"x":2}',
    });
    expect(text.split('\n').slice(0, 3)).toEqual([
      'device → server',
      'client: c1',
      '/sys/a/b/thing/event/property/post',
    ]);
  });

  it('shows a non-HTTP detail as JSON instead of "undefined → undefined"', () => {
    expect(detailText({ rule: 'sts', note: 'n' })).toBe('{\n  "rule": "sts",\n  "note": "n"\n}');
    expect(detailText(undefined)).toBe('');
  });
});

describe('row rules', () => {
  it('treats an http row naming the heartbeat as a heartbeat, nothing else', () => {
    expect(isHeartbeat(ev(1, { summary: 'GET /6/t6/dev_heartbeat -> 200' }))).toBe(true);
    expect(isHeartbeat(ev(1, { kind: 'mqtt', summary: 'heartbeat' }))).toBe(false);
  });

  it('derives a level from status and kind', () => {
    expect(levelOf(ev(1, { detail: { status: 502 } }))).toBe('error');
    expect(levelOf(ev(1, { kind: 'blocked' }))).toBe('error');
    expect(levelOf(ev(1, { detail: { status: 404 } }))).toBe('warn');
    expect(levelOf(ev(1, { kind: 'redact' }))).toBe('warn');
    expect(levelOf(ev(1))).toBe('info');
  });

  it('greps kind, device and summary with every term required', () => {
    expect(matchesGrep(ev(1), 'STATE 1002345')).toBe(true);
    expect(matchesGrep(ev(1), 'state feeder')).toBe(false);
    expect(matchesGrep(ev(1, { device_id: null }), 'server')).toBe(true);
  });

  it('joins entries with a rule and a header per entry', () => {
    const text = entriesText([ev(1), ev(2, { device_id: null, kind: 'connect' })]);
    expect(text).toContain('http #100234567 — POST /6/t6/dev_state_report -> 200');
    expect(text).toContain('─'.repeat(70));
    expect(text).toContain('connect — ');
  });
});

describe('mergeEvents', () => {
  it('drops duplicates from the replay and keeps the newest rows under the cap', () => {
    const first = mergeEvents([], [ev(1), ev(2)]);
    expect(mergeEvents(first, [ev(2)])).toBe(first);
    const many = mergeEvents(
      [],
      Array.from({ length: 605 }, (_, i) => ev(i + 1)),
    );
    expect(many).toHaveLength(600);
    expect(many[0]?.seq).toBe(6);
    expect(many.at(-1)?.seq).toBe(605);
  });

  it('puts a late backfill before the live rows it predates', () => {
    const merged = mergeEvents([ev(5)], [ev(3), ev(4)]);
    expect(merged.map(e => e.seq)).toEqual([3, 4, 5]);
  });

  it('keeps an event from a restarted server whose seq was seen before', () => {
    const merged = mergeEvents([ev(1)], [{ ...ev(1), ts: ev(1).ts + 3600 }]);
    expect(merged).toHaveLength(2);
  });
});
