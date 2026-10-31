// Screen paths and nav title keys (`app` namespace), shared by the router and the frame's
// navigation. The paths are kept from earlier versions so bookmarks and shared links keep
// working; the titles are the web v3 nav labels (Home, Logs, Add a device, Settings).

export const SCREENS = {
  devices: { path: 'devices', titleKey: 'nav.home' },
  timeline: { path: 'timeline', titleKey: 'nav.timeline' },
  pets: { path: 'pets', titleKey: 'nav.pets' },
  provision: { path: 'provision', titleKey: 'nav.provision' },
  log: { path: 'log', titleKey: 'nav.log' },
  setup: { path: 'setup', titleKey: 'nav.setup' },
  capture: { path: 'capture', titleKey: 'nav.capture' },
  patchers: { path: 'patchers', titleKey: 'nav.patchers' },
} as const;
