// Types `t()` keys from the English resources. A new namespace needs one import
// and one `resources` line here, besides its two JSON files; see index.ts.
import 'i18next';
import type app from './locales/en/app.json';
import type auth from './locales/en/auth.json';
import type ble from './locales/en/ble.json';
import type capture from './locales/en/capture.json';
import type common from './locales/en/common.json';
import type devices from './locales/en/devices.json';
import type log from './locales/en/log.json';
import type patchers from './locales/en/patchers.json';
import type pets from './locales/en/pets.json';
import type provision from './locales/en/provision.json';
import type setup from './locales/en/setup.json';
import type timeline from './locales/en/timeline.json';
import type tokens from './locales/en/tokens.json';
import type ui from './locales/en/ui.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      app: typeof app;
      auth: typeof auth;
      ble: typeof ble;
      capture: typeof capture;
      common: typeof common;
      devices: typeof devices;
      log: typeof log;
      patchers: typeof patchers;
      pets: typeof pets;
      provision: typeof provision;
      setup: typeof setup;
      timeline: typeof timeline;
      tokens: typeof tokens;
      ui: typeof ui;
    };
  }
}
