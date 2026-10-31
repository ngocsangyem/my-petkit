// What a command result means to the person who pressed the button. A device on
// MQTT gets it now; one polling the HTTP heartbeat takes it on its next poll.
import { i18n } from '@/i18n';

/** After a named device action (`{action}`). */
export function actionDeliveryText(delivered: string): string {
  if (delivered === 'mqtt') return i18n.t('devices:delivery.action.mqtt');
  if (delivered === 'local') return i18n.t('devices:delivery.saved');
  return i18n.t('devices:delivery.action.queued');
}

/** After an entity write (`{entity, value}`), device or accessory. */
export function entityDeliveryText(delivered: string): string {
  switch (delivered) {
    case 'mqtt':
      return i18n.t('devices:delivery.entity.mqtt');
    case 'local':
      return i18n.t('devices:delivery.saved');
    case 'ble':
      return i18n.t('devices:delivery.entity.ble');
    default:
      return i18n.t('devices:delivery.entity.queued');
  }
}

/** After a timezone write: "sent" is not "visible" until the next property post. */
export function timezoneDeliveryText(delivered: string): string {
  return delivered === 'mqtt'
    ? i18n.t('devices:delivery.timezone.mqtt')
    : i18n.t('devices:delivery.timezone.queued');
}

/** Why debug-log collection cannot work, from `logInfo.reason`; the server's code when unknown. */
export function logReasonText(reason: string): string {
  switch (reason) {
    case 'no_log_root':
      return i18n.t('devices:delivery.logReason.noLogRoot');
    case 'no_bucket_endpoint':
      return i18n.t('devices:delivery.logReason.noBucketEndpoint');
    case 'authority_not_splittable':
      return i18n.t('devices:delivery.logReason.authorityNotSplittable');
    default:
      return reason;
  }
}
