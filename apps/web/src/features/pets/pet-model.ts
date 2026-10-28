// Pure rules of the Pets screen: what the server's JSON-in-a-string columns
// hold, which devices are recognising, and whether a pet's photos reached a box.
import type { components } from '@/api/schema';
import type { DeviceStatus } from '@/shared/ui';

export type Pet = components['schemas']['PetWithFaces'];
export type PetRow = components['schemas']['Pet'];
export type DeviceDetail = components['schemas']['DeviceDetail'];
export type DeviceSummary = components['schemas']['DeviceSummary'];
export type UnboundRef = components['schemas']['PetUnboundRef'];
export type ImportResult = components['schemas']['PetImportResult'];

/**
 * The device holds at most this many face photos per pet. Mirrors the server's
 * `MAX_FACES_PER_PET` (events/store_base.py), which refuses the seventh upload.
 */
export const MAX_FACES = 6;

/** "1 pet", "2 pets". */
export function plural(n: number, word: string, many = `${word}s`): string {
  return `${n} ${n === 1 ? word : many}`;
}

/**
 * The numbers inside a JSON-array column such as `device_ids_json`. An
 * unreadable value reads as an empty list: a pet linked to nothing reads
 * better than a broken card.
 */
export function parseIdList(json: string | null | undefined): number[] {
  if (!json) return [];
  try {
    const value: unknown = JSON.parse(json);
    if (!Array.isArray(value)) return [];
    return value.map(Number).filter(n => Number.isFinite(n));
  } catch {
    return [];
  }
}

/**
 * A device is recognising unless it says otherwise: `ai_enabled` defaults to on
 * when unset, which is what a device that has never been touched reports.
 */
export function isRecognising(device: DeviceDetail): boolean {
  return device.aiInfo?.ai_enabled !== false;
}

/**
 * The face ids a device says it downloaded (`discernPic` in its state report),
 * or null when it has not reported that readback at all.
 */
export function cachedFaceIds(device: DeviceDetail): string[] | null {
  const cached = device.state?.discernPic;
  if (!Array.isArray(cached)) return null;
  return cached.map(String);
}

/** What one pet's photos are doing, as a status mark. */
export interface PetStatus {
  status: DeviceStatus;
  label: string;
  /** True once every photo is on at least one recognising device. */
  loaded: boolean;
  /** True when photos exist but no recognising device holds them all yet. */
  waiting: boolean;
}

/**
 * Whether a pet's photos reached a device. `discernPic` is the only proof a
 * device accepted our photos: an id it does not list has not been fetched yet.
 */
export function petStatus(pet: Pet, devices: readonly DeviceDetail[]): PetStatus {
  const idle = (label: string): PetStatus => ({
    status: 'unknown',
    label,
    loaded: false,
    waiting: false,
  });
  if (pet.faces.length === 0) return idle('No face photos yet');
  const assigned = parseIdList(pet.device_ids_json);
  if (assigned.length === 0) return idle('No device assigned');
  const recognising = devices.filter(d => assigned.includes(d.id) && isRecognising(d));
  if (recognising.length === 0) return idle('Recognition is off on its devices');

  const ours = pet.faces.map(f => String(f.id));
  const holding = recognising.filter(d => {
    const cached = cachedFaceIds(d);
    return cached !== null && ours.every(id => cached.includes(id));
  });
  if (holding.length > 0) {
    return {
      status: 'online',
      label: `Loaded on ${holding.map(d => d.name || `#${d.id}`).join(', ')}`,
      loaded: true,
      waiting: false,
    };
  }
  return { status: 'polling', label: 'Waiting for device to fetch', loaded: false, waiting: true };
}

/** What a device's `discernPic` readback says about whose photos it is matching. */
export function cacheVerdict(
  device: DeviceDetail,
  ourFaceIds: readonly number[],
): { kind: 'none' | 'empty' | 'ours' | 'foreign' | 'unknown'; ids: string[] } {
  const cached = cachedFaceIds(device);
  if (cached === null) return { kind: 'none', ids: [] };
  if (cached.length === 0) return { kind: 'empty', ids: [] };
  const ours = ourFaceIds.map(String);
  if (ours.length === 0) return { kind: 'unknown', ids: cached };
  const foreign = cached.some(id => !ours.includes(id));
  return { kind: foreign ? 'foreign' : 'ours', ids: cached };
}

/**
 * The alias list after binding `ref`. Additive: binding a second identity must
 * not drop the first, so the current list is read before it is written.
 */
export function withAlias(current: string | null | undefined, ref: number): number[] {
  const ids = parseIdList(current);
  return ids.includes(ref) ? ids : [...ids, ref];
}

/**
 * The sentence after an import. Both numbers matter and neither is obvious: a
 * photo can be refused after it downloads (it has to be a real JPEG), and the
 * bound count is history that just got named.
 */
export function importSummary(results: readonly ImportResult[]): string {
  const imported = results.filter(r => r.outcome === 'imported');
  if (imported.length === 0) {
    return 'Nothing new: PetKit lists no pets this device does not already have.';
  }
  const photos = imported.reduce((n, r) => n + (r.faces_imported ?? 0), 0);
  const offered = imported.reduce((n, r) => n + (r.faces_offered ?? 0), 0);
  const named = imported.reduce((n, r) => n + (r.bound_events ?? 0), 0);
  return (
    `Imported ${plural(imported.length, 'pet')}, ${photos} of ${plural(offered, 'photo')}` +
    (named ? `, named ${plural(named, 'past event')}.` : '.')
  );
}

/** "Miso", "Miso and Mochi", "Miso, Mochi and Tofu". */
export function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1] ?? ''}`;
}
