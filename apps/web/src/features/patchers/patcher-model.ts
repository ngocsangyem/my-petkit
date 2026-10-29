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

/** The status word of a patcher, and its colour. */
export function statusOf(p: PatcherEntry): { text: string; tone: StatusTone } {
  if (p.unavailable) return { text: p.unavailable, tone: 'warning' };
  if (p.greyed) return { text: 'Active · MQTT connected', tone: 'positive' };
  if (p.applied) return { text: 'Applied', tone: 'positive' };
  return { text: 'Not applied', tone: 'muted' };
}

/** The row's one action: remove what is in place, apply what is not. */
export function primaryAction(p: PatcherEntry): 'apply' | 'remove' {
  return p.applied || p.greyed ? 'remove' : 'apply';
}

/** Why Apply cannot run right now, or null. */
export function applyBlocker(p: PatcherEntry, deviceIp: string): string | null {
  if (p.greyed)
    return 'The device already holds an MQTT session, which proves this patch is in place.';
  if (!deviceIp)
    return 'Device IP unknown. Wait for the device to send a state report before patching.';
  return null;
}

/** Lines kept per run; a run writes a few dozen. */
export const MAX_LINES = 300;
