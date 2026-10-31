import type { components } from '@/api/schema';
import { i18n } from '@/i18n';

// Retention categories and blocked-attempt rules, as the Setup screen names them.

export type RetentionCaps = components['schemas']['SetupRetention'];
export type BlockedAttempt = components['schemas']['SetupBlockedAttempt'];

/**
 * Categories with both a size and an age cap, in display order: the single
 * source for the retention table and for its save. `rawUpload` is left out on
 * purpose (staged files are deleted inline and by the sweeper, with a one-hour
 * floor a panel edit cannot lower), so the server default stays. Each is named
 * by `setup:retention.kind.{key}`.
 */
export const RETENTION_SIZED = [
  'fullVideo',
  'eventImage',
  'highLight',
  'dynamicVideo',
  'cloudDouble',
  'wasteCheck',
  'healthPic',
  'deviceLog',
  'thumbnail',
] as const satisfies readonly (keyof RetentionCaps)[];

/** Age-only categories: they carry no size cap. */
export const RETENTION_AGE_ONLY = [
  'events',
  'blocked',
] as const satisfies readonly (keyof RetentionCaps)[];

/** Blocking rules this screen names (`setup:blocked.kind.{kind}`); any other shows as sent. */
const REDACT_KINDS = [
  'rce',
  'ota',
  'secret',
  'log_upload',
  'server',
  'mqtt',
  'oss_sts',
  'locale',
] as const;
type RedactKind = (typeof REDACT_KINDS)[number];

function isRedactKind(kind: string): kind is RedactKind {
  return (REDACT_KINDS as readonly string[]).includes(kind);
}

/** A blocking rule name as a person reads it, in the active language. */
export function redactLabel(kind: string | null): string {
  if (!kind) return i18n.t('setup:blocked.unknown');
  return isRedactKind(kind) ? i18n.t(`setup:blocked.kind.${kind}`) : kind;
}

/** How many blocked attempts the table asks for. */
export const BLOCKED_LIMIT = 25;
