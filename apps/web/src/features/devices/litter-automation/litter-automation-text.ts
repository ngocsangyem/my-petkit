// Words for the force-continue checklist and the auto-pack status line. The API
// sends stable codes; the person reads these sentences.
import { formatDateTime } from '@/shared/format/format';
import type {
  AutoPackRule,
  AutoPackStatus,
  AutoPackTrigger,
  ForceContinueBlocker,
  ForceContinueReason,
} from './litter-automation-api';

/** One line of the confirm sheet's checklist, and the guard reasons that untick it. */
export interface ChecklistItem {
  label: string;
  blockedBy: readonly ForceContinueReason[];
}

/** No gram reading on purpose: the box's live weight is not something this app has. */
export const FORCE_CONTINUE_CHECKLIST: readonly ChecklistItem[] = [
  { label: 'No pet in the box', blockedBy: ['pet_in_box', 'pet_entered', 'presence_unknown'] },
  { label: 'No visit in progress', blockedBy: ['visit_open', 'history_unavailable'] },
  { label: 'Lid closed, no fault', blockedBy: ['cover_open', 'device_fault'] },
];

/** True when none of the item's reasons is among the current blockers. */
export function checklistPasses(
  item: ChecklistItem,
  blockers: readonly ForceContinueBlocker[],
): boolean {
  return !blockers.some(b => item.blockedBy.includes(b.reason));
}

/**
 * The box is paused but a guard refuses: worth one quiet sentence. A box that is
 * simply not paused says nothing.
 */
export function pausedButBlocked(blockers: readonly ForceContinueBlocker[]): boolean {
  return blockers.length > 0 && !blockers.some(b => b.reason === 'not_paused');
}

/** Blockers no checklist row covers (the device not live, an unknown pause), said as sentences. */
export function uncoveredBlockers(
  blockers: readonly ForceContinueBlocker[],
): ForceContinueBlocker[] {
  return blockers.filter(b => !FORCE_CONTINUE_CHECKLIST.some(i => i.blockedBy.includes(b.reason)));
}

export const TRIGGER_LABELS: Readonly<Record<AutoPackTrigger, string>> = {
  after_cleanings: 'After a number of cleanings',
  bin_full: 'When the bin is full',
  daily_at: 'Every day at a set time',
};

/** Guard reasons the auto-pack evaluation can be held back by, besides its own three. */
const HELD_BACK: Readonly<Record<string, string>> = {
  not_due: 'not due yet',
  quiet_hours: 'inside quiet hours',
  cooldown: 'waiting a little after the last attempt',
  not_delivered: 'the last pack command could not be sent',
  state_stale: 'the box has not sent a state report in the last 2 minutes',
  presence_unknown: 'the box has not said whether a pet is inside',
  device_offline: 'the box has not been heard from in the last 90 seconds',
  not_on_mqtt: 'the box is not connected over MQTT',
  pet_in_box: 'the box reports a pet inside',
  visit_open: 'a pet entered in the last 10 minutes and has not left',
  pet_nearby: 'a pet was near the box in the last 2 minutes',
  device_fault: 'the box reports an error',
  device_busy: 'the box is running a cycle',
  no_bags: 'the box reports no bags left, or has not reported a bag count',
  history_unavailable: 'the visit history could not be read',
};

/** Why the server turned the rule off, as a clause. */
export function disabledText(reason: string): string {
  if (reason === 'no_response') return 'the box did not answer two packs in a row';
  const packError = /^pack_error:\s*(.*)$/s.exec(reason);
  if (packError) return `the box reported a packing error: ${packError[1] || 'no detail'}`;
  return reason;
}

/** "Held back: inside quiet hours · Last packed 28/10/2026, 08:12:00", in the browser's time. */
export function autoPackStatusLine(rule: AutoPackRule, status: AutoPackStatus): string {
  const parts: string[] = [];
  if (status.disabledReason) {
    parts.push(`Turned off by the server because ${disabledText(status.disabledReason)}`);
  } else if (status.pendingSince) {
    parts.push(`Pack sent at ${formatDateTime(status.pendingSince)}, waiting for the box`);
  } else if (rule.enabled && rule.trigger === 'bin_full' && status.awaitingBinClear) {
    parts.push('Waiting for the bin to be emptied before it counts again');
  } else if (rule.enabled && status.heldBackBy) {
    parts.push(`Held back: ${HELD_BACK[status.heldBackBy] ?? status.heldBackBy}`);
  }
  if (status.lastPackedAt) parts.push(`Last packed ${formatDateTime(status.lastPackedAt)}`);
  else if (rule.enabled) parts.push('Not packed by this rule yet');
  if (status.lastResult === 'no_response' && !status.disabledReason) {
    parts.push('the last pack got no answer');
  }
  return parts.join(' · ');
}

/** What the rule will do, said in the turn-on confirmation. */
export function ruleSummary(rule: AutoPackRule): string {
  const when =
    rule.trigger === 'after_cleanings'
      ? `after every ${rule.cleanings} ${rule.cleanings === 1 ? 'cleaning' : 'cleanings'}`
      : rule.trigger === 'bin_full'
        ? 'whenever the bin reports full'
        : `every day at ${rule.at}, in the device's time zone`;
  const quiet = rule.quietHours
    ? `, never between ${rule.quietHours.start} and ${rule.quietHours.end}`
    : '';
  return `The box packs and seals the waste bag on its own ${when}${quiet}.`;
}
