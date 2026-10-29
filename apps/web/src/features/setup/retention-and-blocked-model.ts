import type { components } from '@/api/schema';

// Retention categories and blocked-attempt rules, as the Setup screen labels them.

export type RetentionCaps = components['schemas']['SetupRetention'];
export type BlockedAttempt = components['schemas']['SetupBlockedAttempt'];

/**
 * Categories with both a size and an age cap, in display order: the single
 * source for the retention table and for its save. `rawUpload` is left out on
 * purpose (staged files are deleted inline and by the sweeper, with a one-hour
 * floor a panel edit cannot lower), so the server default stays.
 */
export const RETENTION_SIZED = [
  ['fullVideo', 'Recordings'],
  ['eventImage', 'Snapshots'],
  ['highLight', 'Highlights'],
  ['dynamicVideo', 'Motion clips'],
  ['cloudDouble', 'Timelapses'],
  ['wasteCheck', 'Waste photos'],
  ['healthPic', 'Health photos'],
  ['deviceLog', 'Device logs'],
  ['thumbnail', 'Thumbnail cache'],
] as const satisfies readonly (readonly [keyof RetentionCaps, string])[];

/** Age-only categories: they carry no size cap. */
export const RETENTION_AGE_ONLY = [
  ['events', 'Events (history)'],
  ['blocked', 'Blocked attempts'],
] as const satisfies readonly (readonly [keyof RetentionCaps, string])[];

/** Blocking rule names as a person reads them. */
export const REDACT_LABELS: Readonly<Record<string, string>> = {
  rce: 'Shell command',
  ota: 'Firmware push',
  secret: 'Credential swap',
  log_upload: 'Log upload',
  server: 'Server address',
  mqtt: 'Broker address',
  oss_sts: 'Media upload',
  locale: 'Timezone',
};

export function redactLabel(kind: string | null): string {
  if (!kind) return 'Unknown';
  return Object.hasOwn(REDACT_LABELS, kind) ? (REDACT_LABELS[kind] ?? kind) : kind;
}

/** How many blocked attempts the table asks for. */
export const BLOCKED_LIMIT = 25;
