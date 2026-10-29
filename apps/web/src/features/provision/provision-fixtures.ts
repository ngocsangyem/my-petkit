// Test fixtures in the contract's shapes. Never imported by the page.

import type { components } from '@/api/schema';

type ServerInfo = components['schemas']['SetupServerInfo'];

export function serverInfoFixture(apiUrl: string | null): ServerInfo {
  return {
    asset_version: 'a1b2c3',
    version: '2.1.0',
    web_entry: null,
    api_url: apiUrl,
    mqtt_tls: true,
    mqtt_tls_port: 443,
    mqtt_port: 1883,
    strict_auth: false,
    cert_exists: true,
    user_tls: { port: 8443, cert_sha256: 'ab:cd' },
    ha_publishing: false,
    ha_enabled: false,
    device_count: 1,
    settings: {
      proxy_mode: false,
      proxy_upstream: '',
      proxy_dns: '',
      proxy_block_run_cmd: true,
      proxy_block_ota: true,
      proxy_block_log_upload: true,
      proxy_media_real_oss: false,
      proxy_local_cvr_window: false,
      proxy_mqtt_bridge: true,
      proxy_only: '',
      capture: false,
    },
    settings_writable: true,
    capture: false,
    ai_device_names: [],
    upstreams: [],
    redactions: {},
    upstream: {},
  };
}
