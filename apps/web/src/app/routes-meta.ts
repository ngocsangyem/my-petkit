// Screen paths and nav titles, shared by the router and the frame's navigation. The paths
// are kept from earlier versions so bookmarks and shared links keep working; the titles
// are the web v3 nav labels (Home, Logs, Add a device, Settings).

export interface ScreenDef {
  path: string;
  title: string;
}

export const SCREENS = {
  devices: { path: 'devices', title: 'Home' },
  timeline: { path: 'timeline', title: 'Timeline' },
  pets: { path: 'pets', title: 'Pets' },
  provision: { path: 'provision', title: 'Add a device' },
  log: { path: 'log', title: 'Logs' },
  setup: { path: 'setup', title: 'Settings' },
  capture: { path: 'capture', title: 'Capture' },
  patchers: { path: 'patchers', title: 'Patchers' },
} satisfies Record<string, ScreenDef>;
