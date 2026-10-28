// Screen paths and titles, shared by the router and the frame's navigation.

export interface ScreenDef {
  path: string;
  title: string;
}

export const SCREENS = {
  devices: { path: 'devices', title: 'Devices' },
  timeline: { path: 'timeline', title: 'Timeline' },
  pets: { path: 'pets', title: 'Pets' },
  provision: { path: 'provision', title: 'Provision' },
  log: { path: 'log', title: 'Log' },
  setup: { path: 'setup', title: 'Setup' },
  capture: { path: 'capture', title: 'Capture' },
  patchers: { path: 'patchers', title: 'Patchers' },
} satisfies Record<string, ScreenDef>;
