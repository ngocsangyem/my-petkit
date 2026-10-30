// Pure rules of the Timeline screen, ported from the legacy panel's
// timeline.js and media.js. Nothing here touches the DOM or the network.
import type { components } from '@/api/schema';

export type TimelineDay = components['schemas']['TimelineDay'];
export type TimelineSession = components['schemas']['TimelineSession'];
export type TimelineSubEvent = components['schemas']['TimelineSubEvent'];
export type MediaSlots = components['schemas']['TimelineMediaSlots'];
export type TimelineCounts = components['schemas']['TimelineCounts'];
export type FilterKey = keyof TimelineCounts;

/**
 * "Today" as the server means it when it cuts a day: at LOCAL midnight. `toISOString()` is UTC,
 * so east of Greenwich it named tomorrow late in the evening and yesterday just after midnight.
 */
export function todayLocal(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** `YYYY-MM-DD` moved by `n` calendar days (calendar arithmetic, immune to DST). */
export function shiftDay(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function isDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/**
 * One chip per bucket `filter_counts` fills, in the legacy order. "Light visits" are the ones too
 * light to be any registered cat: "All" and "Toileting" never show them, so this chip is where
 * they are found (a light visit that raised a health alert or fault also shows under that chip).
 */
export const FILTERS: readonly { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pet', label: 'Pet' },
  { key: 'toileting', label: 'Toileting' },
  { key: 'feeding', label: 'Feeding' },
  { key: 'drinking', label: 'Drinking' },
  { key: 'cleaning', label: 'Cleaning' },
  { key: 'health_alert', label: 'Health alert' },
  { key: 'fault', label: 'Faults' },
  { key: 'passing', label: 'Light visits' },
];

export function isFilterKey(value: unknown): value is FilterKey {
  return FILTERS.some(f => f.key === value);
}

/**
 * A chip with no events is shown only while it is the selected one (or it is "All"): a family
 * that produced nothing today would otherwise contribute a permanent zero, and you must still be
 * able to get back off a selected empty chip.
 */
export function visibleFilters(
  counts: TimelineCounts | undefined,
  selected: FilterKey,
): readonly { key: FilterKey; label: string }[] {
  return FILTERS.filter(f => f.key === 'all' || f.key === selected || (counts?.[f.key] ?? 0) > 0);
}

/** Keyed by `event_kind`, not `kind`: the tag is the thing the card is about. */
const KIND_TAG = new Map<string, string>(
  Object.entries({
    toilet_visit: 'Toilet visit',
    pet: 'Appeared',
    motion: 'Motion',
    cleaning: 'Cleaning',
    error: 'Alert',
    feeding: 'Feeding',
    drinking: 'Drinking',
    system: 'System',
  }),
);

export function kindTag(eventKind: string | null): string {
  const k = eventKind ?? 'event';
  return KIND_TAG.get(k) ?? k.replace(/_/g, ' ');
}

/** The headline of a session, as text. */
export function sessionSentence(s: TimelineSession): string {
  if (s.kind === 'visit') {
    return s.pet_name ? `${s.pet_name} used the litter box` : 'Litter-box visit';
  }
  return s.label || kindTag(s.event_kind);
}

export function subEventLabel(e: TimelineSubEvent): string {
  if (e.label) return e.label;
  return e.event_type === null ? 'Event' : String(e.event_type);
}

/** "45 s", "1 min 55 s"; `null` when the duration is unknown. */
export function formatVisitDuration(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return null;
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m ? `${m} min ${s} s` : `${s} s`;
}

/** Grams to "5.43 kg"; `null` when unknown. */
export function formatWeight(grams: number | null): string | null {
  if (grams === null || !Number.isFinite(grams)) return null;
  return `${(grams / 1000).toFixed(2)} kg`;
}

/**
 * A server-decoded fact ("waste 42 g", "litter 40%", "yowled") split into label and value. A
 * bit with no number has nothing to put in bold and keeps its whole text as the label.
 */
export function splitFact(bit: string): { label: string; value: string | null } {
  const m = /^(\D+?)\s+(\d.*)$/.exec(bit);
  return m?.[1] && m[2] ? { label: m[1], value: m[2] } : { label: bit, value: null };
}

/** Time in the reader's zone, as the legacy panel rendered every row. */
export function clockTime(ts: number | null, withSeconds = false): string | null {
  if (ts === null || !Number.isFinite(ts) || ts <= 0) return null;
  return new Date(ts * 1000).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
  });
}

/** Whether the reader's locale renders 12-hour times, which need a wider time column. */
export function usesTwelveHourClock(): boolean {
  try {
    return Boolean(
      new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' }).resolvedOptions().hour12,
    );
  } catch {
    return /[AaPp]\.?[Mm]/.test(new Date(2020, 0, 1, 13, 0, 0).toLocaleTimeString());
  }
}

/** True when a media slot-set is worth rendering at all (`video_pending` counts). */
export function hasMedia(m: MediaSlots | null | undefined): m is MediaSlots {
  return Boolean(
    m &&
    (m.playback_url ||
      m.highlight_url ||
      m.preview_url ||
      m.waste.length ||
      m.health.length ||
      m.snapshot_url ||
      m.video_pending),
  );
}

export interface VideoSource {
  label: 'Clip' | 'Timelapse' | 'Playback';
  path: string;
}

/**
 * Playable sources, in the order they are offered: the single-file clip first (a complete short
 * file, never a fragment), then the stitched timelapse, then the full playback.
 */
export function videoSources(m: MediaSlots): VideoSource[] {
  const out: VideoSource[] = [];
  if (m.highlight_url) out.push({ label: 'Clip', path: m.highlight_url });
  if (m.preview_url) out.push({ label: 'Timelapse', path: m.preview_url });
  if (m.playback_url) out.push({ label: 'Playback', path: m.playback_url });
  return out;
}

/** Best still to show as a poster: snapshot, else the clip or recording's own frame grab. */
export function posterPath(m: MediaSlots): string | null {
  return m.snapshot_url ?? m.highlight_url ?? m.playback_url ?? null;
}

/** Waste and health stills of a session and of its steps, one group per role. */
export function stillGroups(s: TimelineSession): { title: string; paths: string[] }[] {
  const all = [s.media, ...s.sub_events.map(e => e.media)].filter(hasMedia);
  const unique = (paths: string[]) => [...new Set(paths)];
  const groups = [
    { title: 'Check waste', paths: unique(all.flatMap(m => m.waste)) },
    { title: 'Health', paths: unique(all.flatMap(m => m.health)) },
  ];
  return groups.filter(g => g.paths.length > 0);
}

/** Unix seconds of the server's local midnight that starts `day`, from its `tz_offset`. */
export function dayStartSeconds(day: Pick<TimelineDay, 'date' | 'tz_offset'>): number | null {
  const t = Date.parse(`${day.date}T00:00:00Z`);
  return Number.isFinite(t) ? t / 1000 - day.tz_offset : null;
}

/** Minutes since the server's local midnight; `null` outside the day or when unknown. */
export function minuteOfDay(ts: number | null, start: number | null): number | null {
  if (ts === null || start === null || !Number.isFinite(ts)) return null;
  const minute = (ts - start) / 60;
  return minute >= 0 && minute <= 1440 ? minute : null;
}

export function sessionKey(s: TimelineSession, index: number): string {
  return s.id === null ? `i${index}` : `s${String(s.id)}`;
}
