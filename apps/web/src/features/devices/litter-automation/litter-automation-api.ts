import { useQuery } from '@tanstack/react-query';
import type { components } from '@/api/schema';
import { api, unwrap } from '@/shared/api/client';
import { deviceKeys } from '../api';

export type LitterAutomation = components['schemas']['LitterAutomationView'];
export type ForceContinueBlocker = components['schemas']['ForceContinueBlocker'];
export type ForceContinueReason = components['schemas']['ForceContinueReason'];
export type AutoPackRule = components['schemas']['AutoPackRule'];
export type AutoPackStatus = components['schemas']['AutoPackStatus'];
export type AutoPackResult = components['schemas']['AutoPackResult'];
export type AutoPackTrigger = AutoPackRule['trigger'];

/**
 * Nested under the device's detail key on purpose: every refresh of the detail
 * (a hub event, a command, the idle ping) invalidates by prefix, so the
 * force-continue guards and the auto-pack status refresh with it.
 */
export const litterAutomationKey = (id: number) =>
  [...deviceKeys.detail(id), 'litter-automation'] as const;

const path = (id: number) => ({ params: { path: { id } } });

/** `GET /api/devices/{id}/litter-automation`: what force continue and auto-pack can do now. */
export function useLitterAutomation(id: number, enabled = true) {
  return useQuery({
    queryKey: litterAutomationKey(id),
    enabled,
    queryFn: () => unwrap(api.GET('/api/devices/{id}/litter-automation', path(id))),
  });
}

/**
 * `POST /api/devices/{id}/force-continue` (R3). A failed guard is a 409 whose
 * code is the guard's reason and whose message is one sentence for the person.
 */
export function sendForceContinue(id: number) {
  return unwrap(api.POST('/api/devices/{id}/force-continue', path(id)));
}

/** `PUT /api/devices/{id}/auto-pack`: replaces the whole rule; answers the rule and its status. */
export function saveAutoPackRule(id: number, rule: AutoPackRule): Promise<AutoPackResult> {
  return unwrap(api.PUT('/api/devices/{id}/auto-pack', { ...path(id), body: rule }));
}
