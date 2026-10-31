import { i18n } from '@/i18n';
import type { PatcherEntry } from './api';

/** A run's progress lines are keyed by device and patcher. */
export function runKey(deviceId: number | string, patcherId: string): string {
  return `${String(deviceId)}:${patcherId}`;
}

/** Every `patcher` hub summary starts with `[patcher_id]`. */
export function patcherIdOf(summary: string): string | null {
  return /^\[(\w+)\]/.exec(summary)?.[1] ?? null;
}

/**
 * A line that ends a run. `done` and `FAILED` are what the old panel waited
 * for; `removal queued` and `cancelled` are the other two last lines the
 * server writes, so a removal also refreshes the status.
 */
export function isFinalLine(summary: string): boolean {
  return /done|FAILED|removal queued|cancelled/.test(summary);
}

/**
 * Descriptions hold real newlines and, in places, the two characters `\n`.
 * Both become real line breaks; the text is rendered as text either way.
 */
export function normaliseDescription(text: string): string {
  return text.replace(/\\n/g, '\n');
}

/** The first paragraph, for the table row. */
export function firstParagraph(text: string): string {
  return (
    normaliseDescription(text)
      .split(/\n\s*\n/)[0]
      ?.trim() ?? ''
  );
}

export type StatusTone = 'positive' | 'warning' | 'muted';

/**
 * The status word of a patcher, its colour, and whether it is the plain "Applied" state (which
 * the row shows as a pill instead). Why a patch is unavailable is the server's own text.
 */
export function statusOf(p: PatcherEntry): { text: string; tone: StatusTone; applied: boolean } {
  if (p.unavailable) return { text: p.unavailable, tone: 'warning', applied: false };
  if (p.greyed) return { text: i18n.t('patchers:status.active'), tone: 'positive', applied: false };
  if (p.applied)
    return { text: i18n.t('patchers:status.applied'), tone: 'positive', applied: true };
  return { text: i18n.t('patchers:status.notApplied'), tone: 'muted', applied: false };
}

/** The row's one action: remove what is in place, apply what is not. */
export function primaryAction(p: PatcherEntry): 'apply' | 'remove' {
  return p.applied || p.greyed ? 'remove' : 'apply';
}

/** Why Apply cannot run right now, or null. */
export function applyBlocker(p: PatcherEntry, deviceIp: string): string | null {
  if (p.greyed) return i18n.t('patchers:blocker.greyed');
  if (!deviceIp) return i18n.t('patchers:blocker.noIp');
  return null;
}

/** Lines kept per run; a run writes a few dozen. */
export const MAX_LINES = 300;
