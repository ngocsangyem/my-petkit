// Words for the force-continue checklist and the auto-pack status line. The API
// sends stable codes; the person reads these sentences, in the active language.
import { i18n } from '@/i18n';
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

/**
 * No gram reading on purpose: the box's live weight is not something this app has. Labels are
 * getters, so each read is in the active language.
 */
export const FORCE_CONTINUE_CHECKLIST: readonly ChecklistItem[] = [
  {
    get label() {
      return i18n.t('devices:force.check.noPet');
    },
    blockedBy: ['pet_in_box', 'pet_entered', 'presence_unknown'],
  },
  {
    get label() {
      return i18n.t('devices:force.check.noVisit');
    },
    blockedBy: ['visit_open', 'history_unavailable'],
  },
  {
    get label() {
      return i18n.t('devices:force.check.lidClosed');
    },
    blockedBy: ['cover_open', 'device_fault'],
  },
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

/** The triggers a rule can use, in the order the picker lists them. */
export const TRIGGERS: readonly AutoPackTrigger[] = ['after_cleanings', 'bin_full', 'daily_at'];

/** A trigger's name in the picker. */
export function triggerLabel(trigger: AutoPackTrigger): string {
  return i18n.t(`devices:autoPack.trigger.${trigger}`);
}

/** Guard reasons the auto-pack evaluation can be held back by, besides its own three. */
const HELD_BACK = [
  'not_due',
  'quiet_hours',
  'cooldown',
  'not_delivered',
  'state_stale',
  'presence_unknown',
  'device_offline',
  'not_on_mqtt',
  'pet_in_box',
  'visit_open',
  'pet_nearby',
  'device_fault',
  'device_busy',
  'no_bags',
  'history_unavailable',
] as const;

/** A held-back reason as a clause; the server's code when this client does not know it. */
function heldBackText(reason: string): string {
  const known = HELD_BACK.find(r => r === reason);
  return known ? i18n.t(`devices:autoPack.heldBack.${known}`) : reason;
}

/** Why the server turned the rule off, as a clause. */
export function disabledText(reason: string): string {
  if (reason === 'no_response') return i18n.t('devices:autoPack.disabled.noResponse');
  const packError = /^pack_error:\s*(.*)$/s.exec(reason);
  if (packError) {
    return i18n.t('devices:autoPack.disabled.packError', {
      detail: packError[1] || i18n.t('devices:autoPack.disabled.noDetail'),
    });
  }
  return reason;
}

/** "Held back: inside quiet hours · Last packed 28/10/2026, 08:12:00", in the browser's time. */
export function autoPackStatusLine(rule: AutoPackRule, status: AutoPackStatus): string {
  const parts: string[] = [];
  if (status.disabledReason) {
    parts.push(
      i18n.t('devices:autoPack.status.turnedOff', {
        reason: disabledText(status.disabledReason),
      }),
    );
  } else if (status.pendingSince) {
    parts.push(
      i18n.t('devices:autoPack.status.pending', { at: formatDateTime(status.pendingSince) }),
    );
  } else if (rule.enabled && rule.trigger === 'bin_full' && status.awaitingBinClear) {
    parts.push(i18n.t('devices:autoPack.status.awaitingBinClear'));
  } else if (rule.enabled && status.heldBackBy) {
    parts.push(
      i18n.t('devices:autoPack.status.heldBack', { reason: heldBackText(status.heldBackBy) }),
    );
  }
  if (status.lastPackedAt) {
    parts.push(
      i18n.t('devices:autoPack.status.lastPacked', { at: formatDateTime(status.lastPackedAt) }),
    );
  } else if (rule.enabled) parts.push(i18n.t('devices:autoPack.status.notYet'));
  if (status.lastResult === 'no_response' && !status.disabledReason) {
    parts.push(i18n.t('devices:autoPack.status.noAnswer'));
  }
  return parts.join(' · ');
}

/** What the rule will do, said in the turn-on confirmation. */
export function ruleSummary(rule: AutoPackRule): string {
  const when =
    rule.trigger === 'after_cleanings'
      ? i18n.t('devices:autoPack.summary.afterCleanings', { count: rule.cleanings })
      : rule.trigger === 'bin_full'
        ? i18n.t('devices:autoPack.summary.binFull')
        : i18n.t('devices:autoPack.summary.dailyAt', { at: rule.at });
  return rule.quietHours
    ? i18n.t('devices:autoPack.summary.withQuiet', {
        when,
        start: rule.quietHours.start,
        end: rule.quietHours.end,
      })
    : i18n.t('devices:autoPack.summary.plain', { when });
}
