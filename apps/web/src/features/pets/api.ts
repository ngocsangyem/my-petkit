// Server state of the Pets screen. Every mutation refetches what it changed,
// because the old panel rebuilt the whole view after each one and the user
// expects the same: a saved change is a visible change.
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';
import { ApiError } from '@/shared/api/errors';
import { historyDates, localDay, petDay, type PetDay } from './pet-history-model';
import { withAlias, type DeviceDetail, type DeviceSummary } from './pet-model';
import type { PetUpdateRequest } from './pet-weight-model';

export const petsKeys = {
  all: ['pets'] as const,
  list: ['pets', 'list'] as const,
  unbound: ['pets', 'unbound'] as const,
  aiDevices: ['pets', 'ai-devices'] as const,
  info: ['pets', 'info'] as const,
};

/**
 * A pet's last days, read from the timeline's day route narrowed to the pet. Kept apart from the
 * pets cache root, so saving a pet does not refetch two weeks of days; a minute old is fresh.
 */
export function usePetHistory(petId: number) {
  const dates = historyDates(localDay());
  const results = useQueries({
    queries: dates.map(date => ({
      queryKey: ['pet-history', petId, date] as const,
      queryFn: () =>
        unwrap(
          api.GET('/api/timeline', {
            params: { query: { date, pet: petId, filter: 'toileting' } },
          }),
        ),
      staleTime: 60_000,
    })),
  });
  const days: PetDay[] = dates.map((date, i) => petDay(date, results.at(i)?.data, petId));
  return {
    days,
    isPending: results.some(r => r.isPending),
    error: results.find(r => r.error)?.error ?? null,
    isFetching: results.some(r => r.isFetching),
    refetch: () => {
      for (const r of results) if (r.error) void r.refetch();
    },
  };
}

export function usePets() {
  return useQuery({
    queryKey: petsKeys.list,
    queryFn: async () => (await unwrap(api.GET('/api/pets'))).pets,
  });
}

export function useUnboundRefs() {
  return useQuery({
    queryKey: petsKeys.unbound,
    queryFn: async () => (await unwrap(api.GET('/api/pets/unbound'))).unbound,
  });
}

/** Product names that do on-device recognition; only used to explain an empty screen. */
export function useAiDeviceNames() {
  return useQuery({
    queryKey: petsKeys.info,
    queryFn: async () => (await unwrap(api.GET('/api/info'))).ai_device_names,
    staleTime: 5 * 60_000,
  });
}

/** The AI-capable devices: every summary, plus the detail of each one that can recognise. */
export interface AiDevices {
  /** Summaries of every registered device, for naming device ids. */
  all: DeviceSummary[];
  /** Summaries of the AI-capable ones. */
  capable: DeviceSummary[];
  /**
   * Their full detail: the summary carries no `aiInfo` and no state. A device
   * whose detail failed to load is left out, as the old panel did.
   */
  details: DeviceDetail[];
}

export function useAiDevices() {
  return useQuery({
    queryKey: petsKeys.aiDevices,
    queryFn: async (): Promise<AiDevices> => {
      const all = await unwrap(api.GET('/api/devices'));
      const capable = all.filter(d => d.supports_ai);
      // A household has one or two of these, so fetching them together costs nothing.
      const settled = await Promise.allSettled(
        capable.map(d => unwrap(api.GET('/api/devices/{id}', { params: { path: { id: d.id } } }))),
      );
      const details = settled.flatMap(r => (r.status === 'fulfilled' ? [r.value] : []));
      return { all, capable, details };
    },
  });
}

function useInvalidatePets() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: petsKeys.all });
}

export function useCreatePet() {
  const invalidate = useInvalidatePets();
  return useMutation({
    mutationFn: (body: { name: string; device_ids: number[] }) =>
      unwrap(api.POST('/api/pets', { body })),
    onSettled: invalidate,
  });
}

export function useRenamePet() {
  const invalidate = useInvalidatePets();
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      unwrap(api.POST('/api/pets/{id}', { params: { path: { id } }, body: { name } })),
    onSettled: invalidate,
  });
}

/** Save a pet's registered weight and weight-matching settings. */
export function useUpdatePetWeight() {
  const invalidate = useInvalidatePets();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: PetUpdateRequest }) =>
      unwrap(api.POST('/api/pets/{id}', { params: { path: { id } }, body })),
    onSettled: invalidate,
  });
}

export function useDeletePet() {
  const invalidate = useInvalidatePets();
  return useMutation({
    mutationFn: (id: number) => unwrap(api.DELETE('/api/pets/{id}', { params: { path: { id } } })),
    onSettled: invalidate,
  });
}

export function useDeleteFace() {
  const invalidate = useInvalidatePets();
  return useMutation({
    mutationFn: ({ petId, faceId }: { petId: number; faceId: number }) =>
      unwrap(
        api.DELETE('/api/pets/{id}/faces/{face_id}', {
          params: { path: { id: petId, face_id: faceId } },
        }),
      ),
    onSettled: invalidate,
  });
}

/** Upload one cropped face. The body is the raw JPEG, not a multipart form. */
export async function uploadFace(petId: number, jpeg: Blob) {
  try {
    return await unwrap(
      api.POST('/api/pets/{id}/faces', {
        params: { path: { id: petId } },
        headers: { 'Content-Type': 'image/jpeg' },
        // The contract types the binary body as a string; the serializer hands
        // the Blob to fetch untouched instead of JSON-encoding a placeholder.
        body: '',
        bodySerializer: () => jpeg,
      }),
    );
  } catch (error) {
    // A 413 is answered in text/plain before the handler runs, so it carries
    // no message of its own.
    if (error instanceof ApiError && error.status === 413) {
      throw new ApiError(413, error.code, 'That photo is too large.');
    }
    throw error;
  }
}

export function useAddFace() {
  const invalidate = useInvalidatePets();
  return useMutation({
    mutationFn: ({ petId, jpeg }: { petId: number; jpeg: Blob }) => uploadFace(petId, jpeg),
    onSettled: invalidate,
  });
}

/** Bind a device-reported identity to a pet; past events carrying it are named at once. */
export function useBindPetRef() {
  const invalidate = useInvalidatePets();
  return useMutation({
    mutationFn: async ({ petId, ref }: { petId: number; ref: number }) => {
      // Read first: the alias list is replaced wholesale, so binding without
      // the current list would silently drop an earlier binding.
      const { pet } = await unwrap(api.GET('/api/pets/{id}', { params: { path: { id: petId } } }));
      return unwrap(
        api.POST('/api/pets/{id}', {
          params: { path: { id: petId } },
          body: { device_pet_ids: withAlias(pet.device_pet_ids_json, ref) },
        }),
      );
    },
    onSettled: invalidate,
  });
}

/** Ask PetKit which pets a device recognises. Only ever on a button press. */
export function useImportPets() {
  const invalidate = useInvalidatePets();
  return useMutation({
    mutationFn: (deviceId: number) =>
      unwrap(api.POST('/api/pets/import', { body: { device_id: deviceId } })),
    onSettled: invalidate,
  });
}

/** Turn a device's pet recognition on or off. */
export function useSetRecognition() {
  const invalidate = useInvalidatePets();
  return useMutation({
    mutationFn: ({ deviceId, on }: { deviceId: number; on: boolean }) =>
      unwrap(
        api.POST('/api/devices/{id}/ai', {
          params: { path: { id: deviceId } },
          body: { ai_enabled: on },
        }),
      ),
    onSettled: invalidate,
  });
}
