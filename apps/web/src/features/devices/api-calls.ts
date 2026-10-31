import type { components } from '@/api/schema';
import { i18n } from '@/i18n';
import { api, unwrap } from '@/shared/api/client';
import { actionDeliveryText, entityDeliveryText, timezoneDeliveryText } from './lib/delivery-text';

// Every write the devices screen makes. Each resolves to the sentence to show
// the person who pressed the button, or throws an ApiError the caller shows.

type PairRequest = components['schemas']['BleAccessoryPairRequest'];
type CapabilityFlag = keyof components['schemas']['DeviceCapabilityFlags'];

const path = (id: number) => ({ params: { path: { id } } });

/** A named device action (`{action}`); destructive ones are confirmed by the caller. */
export async function sendAction(id: number, action: string): Promise<string> {
  const r = await unwrap(
    api.POST('/api/devices/{id}/command', { ...path(id), body: { action, transport: 'auto' } }),
  );
  return actionDeliveryText(r.delivered);
}

/** An entity write on a device. The server coerces and validates; the value goes as typed. */
export async function setEntity(id: number, entity: string, value: string): Promise<string> {
  const r = await unwrap(
    api.POST('/api/devices/{id}/command', {
      ...path(id),
      body: { entity, value, transport: 'auto' },
    }),
  );
  return entityDeliveryText(r.delivered);
}

/**
 * An entity write on a BLE accessory. It is reachable only while its parent is
 * on MQTT, so there is no queue to fall back to: the server answers 409 rather
 * than pretending to have queued something.
 */
export async function setBleEntity(id: number, entity: string, value: string): Promise<string> {
  const r = await unwrap(
    api.POST('/api/ble/{id}/command', { ...path(id), body: { entity, value } }),
  );
  return entityDeliveryText(r.delivered);
}

/** The raw `{suffix, payload}` escape hatch, published VERBATIM (needs step-up). */
export async function sendRaw(id: number, body: Record<string, unknown>): Promise<string> {
  const r = await unwrap(
    api.POST('/api/devices/{id}/command', {
      ...path(id),
      body: { transport: 'auto', ...body },
    }),
  );
  return i18n.t('devices:result.sentVia', { transport: r.delivered });
}

export async function pollBle(id: number): Promise<string> {
  await unwrap(api.POST('/api/ble/{id}/poll', path(id)));
  return i18n.t('devices:result.polled');
}

export async function pairBle(body: PairRequest): Promise<string> {
  await unwrap(api.POST('/api/ble', { body }));
  return i18n.t('devices:result.paired');
}

/** Asks PetKit, once, which accessories this device owns. Every refusal is named. */
export async function importBle(deviceId: number): Promise<string> {
  const r = await unwrap(api.POST('/api/ble/import', { body: { device_id: deviceId } }));
  const refused = r.results.filter(x => !['imported', 'updated', 'unchanged'].includes(x.outcome));
  const head = r.imported
    ? i18n.t('devices:result.imported', { count: r.imported })
    : i18n.t('devices:result.nothingToImport');
  return refused.length
    ? i18n.t('devices:result.skipped', {
        head,
        count: refused.length,
        outcomes: refused.map(x => x.outcome).join('; '),
      })
    : head;
}

export async function unpairBle(id: number): Promise<string> {
  const r = await unwrap(api.DELETE('/api/ble/{id}', path(id)));
  return r.note
    ? i18n.t('devices:result.unpairedNote', { note: r.note })
    : i18n.t('devices:result.unpaired');
}

export async function deleteDevice(id: number): Promise<string> {
  await unwrap(api.DELETE('/api/devices/{id}', path(id)));
  return i18n.t('devices:result.removed');
}

/** `null` clears the override and hands the device back to what it reported. */
export async function setTimezone(id: number, offset: number | null): Promise<string> {
  const r = await unwrap(
    api.POST('/api/devices/{id}/timezone', { ...path(id), body: { timezone: offset } }),
  );
  return timezoneDeliveryText(r.delivered);
}

export async function setLogUpload(id: number, on: boolean): Promise<string> {
  await unwrap(
    api.POST('/api/devices/{id}/logs', { ...path(id), body: { log_upload_enabled: on } }),
  );
  return i18n.t('devices:delivery.saved');
}

export async function setAi(id: number, on: boolean): Promise<string> {
  await unwrap(api.POST('/api/devices/{id}/ai', { ...path(id), body: { ai_enabled: on } }));
  return i18n.t('devices:delivery.saved');
}

export async function setCapability(id: number, flag: CapabilityFlag, on: boolean) {
  await unwrap(api.POST('/api/devices/{id}/capabilities', { ...path(id), body: { [flag]: on } }));
  return i18n.t('devices:result.capabilitySaved');
}

/** Uploads one sound as multipart field `file`, the first and only field. */
export async function uploadSound(id: number, file: File): Promise<string> {
  await unwrap(
    api.POST('/api/devices/{id}/sounds', {
      ...path(id),
      // The generated type says `string` for a binary part; the real body is the
      // FormData the serializer returns, so the placeholder is never sent.
      body: { file: file.name },
      bodySerializer: () => {
        const form = new FormData();
        form.append('file', file, file.name);
        return form;
      },
    }),
  );
  return i18n.t('devices:result.uploaded');
}

const soundPath = (id: number, soundId: number) => ({
  params: { path: { id, sound_id: soundId } },
});

export async function playSound(id: number, soundId: number): Promise<string> {
  await unwrap(api.POST('/api/devices/{id}/sounds/{sound_id}/play', soundPath(id, soundId)));
  return i18n.t('devices:result.playing');
}

export async function selectSound(id: number, soundId: number): Promise<string> {
  await unwrap(api.POST('/api/devices/{id}/sounds/{sound_id}/select', soundPath(id, soundId)));
  return i18n.t('devices:result.selected');
}

export async function deleteSound(id: number, soundId: number): Promise<string> {
  await unwrap(api.DELETE('/api/devices/{id}/sounds/{sound_id}', soundPath(id, soundId)));
  return i18n.t('devices:result.deleted');
}
