// What a command result means to the person who pressed the button. A device on
// MQTT gets it now; one polling the HTTP heartbeat takes it on its next poll.

/** After a named device action (`{action}`). */
export function actionDeliveryText(delivered: string): string {
  if (delivered === 'mqtt') return 'Sent over MQTT';
  if (delivered === 'local') return 'Saved';
  return 'Queued — delivers on the next heartbeat (about 10 s)';
}

/** After an entity write (`{entity, value}`), device or accessory. */
export function entityDeliveryText(delivered: string): string {
  switch (delivered) {
    case 'mqtt':
      return 'Updated over MQTT';
    case 'local':
      return 'Saved';
    case 'ble':
      return 'Sent over Bluetooth';
    default:
      return 'Queued for the next heartbeat';
  }
}

/** After a timezone write: "sent" is not "visible" until the next property post. */
export function timezoneDeliveryText(delivered: string): string {
  return delivered === 'mqtt' ? 'Sent to the device' : 'Saved — applies on its next check-in';
}

/** Why debug-log collection cannot work, from `logInfo.reason`. */
export const LOG_REASONS: Readonly<Record<string, string>> = {
  no_log_root: 'no log directory is configured',
  no_bucket_endpoint: 'this app has no bucket address, so there is nowhere to send the device',
  authority_not_splittable:
    'the bucket address cannot be split into a host the device can build; it needs a dotted name or IP',
};
