import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { components } from '@/api/schema';
import { api, unwrap } from '@/shared/api/client';
import type { FilterKey } from './timeline-model';

export type TimelineDevice = components['schemas']['DeviceSummary'];
export type TimelinePet = components['schemas']['PetWithFaces'];
export type VisitPetRequest = components['schemas']['VisitPetRequest'];

export interface TimelineQuery {
  date: string;
  filter: FilterKey;
  /** Device id as the select holds it; '' for every device. */
  device: string;
  /** Pet id as the select holds it; '' for every pet. */
  pet: string;
}

export const timelineKeys = {
  all: ['timeline'] as const,
  day: (q: TimelineQuery) => ['timeline', 'day', q] as const,
  event: (id: number) => ['timeline', 'event', id] as const,
  devices: ['timeline', 'devices'] as const,
  pets: ['timeline', 'pets'] as const,
};

function idParam(value: string): number | undefined {
  const n = Number(value);
  return value !== '' && Number.isInteger(n) ? n : undefined;
}

/** One local day of grouped sessions; `counts` ignore the chip but honour device and pet. */
export function useTimelineDay(q: TimelineQuery) {
  return useQuery({
    queryKey: timelineKeys.day(q),
    queryFn: () =>
      unwrap(
        api.GET('/api/timeline', {
          params: {
            query: {
              date: q.date,
              filter: q.filter,
              device: idParam(q.device),
              pet: idParam(q.pet),
            },
          },
        }),
      ),
  });
}

/**
 * Everything stored about one event, for Debug info. An event never changes after ingest, so
 * one answer is kept for the session: a live refresh costs no request and shows no flicker.
 */
export function useTimelineEvent(id: number, enabled: boolean) {
  return useQuery({
    queryKey: timelineKeys.event(id),
    queryFn: () => unwrap(api.GET('/api/timeline/{id}', { params: { path: { id } } })),
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useTimelineDevices() {
  return useQuery({
    queryKey: timelineKeys.devices,
    queryFn: () => unwrap(api.GET('/api/devices')),
  });
}

/** Pets for the filter and the strip lanes; a failure reads as "no pets", as the legacy panel did. */
export function useTimelinePets() {
  return useQuery({
    queryKey: timelineKeys.pets,
    queryFn: async (): Promise<TimelinePet[]> => {
      try {
        return (await unwrap(api.GET('/api/pets'))).pets;
      } catch {
        return [];
      }
    },
  });
}

/** The Pets screen's cache root; spelled out because features do not import each other. */
const PETS_SCREEN_KEY = ['pets'] as const;
const PET_HISTORY_KEY = ['pet-history'] as const;

/**
 * Change which pet a visit belongs to (or mark it as nobody). Only the server's record moves;
 * nothing goes to the box. The day is refetched either way, and the pets too when the visit's
 * reading became a registered weight.
 */
export function useSetVisitPet() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: VisitPetRequest }) =>
      unwrap(api.PUT('/api/timeline/{id}/pet', { params: { path: { id } }, body })),
    onSettled: async (_data, _error, { body }) => {
      const pending = [
        client.invalidateQueries({ queryKey: timelineKeys.all }),
        // The Pets charts count this visit under whichever cat it belongs to.
        client.invalidateQueries({ queryKey: PET_HISTORY_KEY }),
      ];
      if (body.use_weight || body.apply_to_ref) {
        pending.push(client.invalidateQueries({ queryKey: PETS_SCREEN_KEY }));
      }
      await Promise.all(pending);
    },
  });
}
