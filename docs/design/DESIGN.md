---
version: alpha
name: my-petkit v3
description: >-
  One visual language for the my-petkit iOS app and web dashboard: soft white cards on a
  tinted ground, pill controls, the pets as photos, the devices as line drawings, and colour
  spent only on data and status.
colors:
  # Surfaces and ink (light)
  ground: "#edf2f1"
  surface: "#ffffff"
  raised: "#f4f7f6"
  active: "#e8eded"
  border: "#e3e8e7"
  rule: "#eef1f1"
  control: "#cdd3d2"
  segment: "#e3e8e7"
  track: "#e8eded"
  switch-off: "#d5dbda"
  primary: "#131416"
  on-primary: "#ffffff"
  on-surface: "#131416"
  muted: "#5d6262"
  lede: "#3b4040"
  # Data and status
  accent: "#0f6e66"
  accent-hover: "#0a4f4a"
  chart2: "#2f70bb"
  chart3: "#a86f0c"
  positive: "#1e7b4f"
  warning: "#92400e"
  error: "#c4242a"
  log-info-edge: "#d9dedd"
  fountain-reporting: "#cfe5e2"
  # Pills: background / ink
  pill-positive-bg: "#dcfae5"
  pill-positive-ink: "#04250e"
  pill-negative-bg: "#ffedea"
  pill-negative-ink: "#831c1e"
  pill-warning-bg: "#fffbeb"
  pill-warning-ink: "#92400e"
  pill-neutral-bg: "#e8eded"
  pill-neutral-ink: "#353736"
  # Per-pet identity, assigned by pet index: tint / ink
  pet-0-tint: "#e4edf8"
  pet-0-ink: "#24548f"
  pet-1-tint: "#f8eedb"
  pet-1-ink: "#7a4f08"
  # Device line drawings
  drawing-stroke: "#131416"
  drawing-fill: "#ffffff"
  drawing-base: "#e3e8e7"
  litter: "#cfe5e2"
  food: "#e9d9b8"
  water: "#cfe0f2"
  # Live view (same in light and dark)
  live-ground: "#1b1d1e"
  live-ground-ios: "#0e0f10"
  live-control: "#202325"
  live-text: "#f2f4f4"
  # Dark mode (one dark value per light token)
  dark-ground: "#0e0f10"
  dark-surface: "#1a1c1e"
  dark-raised: "#232628"
  dark-active: "#1a1c1e"
  dark-border: "#3a3e41"
  dark-rule: "#2c3032"
  dark-control: "#3a3e41"
  dark-segment: "#3a3e41"
  dark-track: "#2c3032"
  dark-switch-off: "#3a3e41"
  dark-primary: "#f2f4f4"
  dark-on-primary: "#0e0f10"
  dark-muted: "#a1a8a8"
  dark-lede: "#c9cfcf"
  dark-accent: "#4fc2b6"
  dark-accent-hover: "#7fd6cc"
  dark-chart2: "#6aa3e6"
  dark-chart3: "#d9a441"
  dark-positive: "#5fd39b"
  dark-warning: "#f0b35a"
  dark-error: "#ff7a72"
  dark-fountain-reporting: "#1f3a37"
  dark-pill-positive-bg: "#123824"
  dark-pill-positive-ink: "#bdf2d3"
  dark-pill-negative-bg: "#43191a"
  dark-pill-negative-ink: "#ffc9c4"
  dark-pill-warning-bg: "#3d2a0c"
  dark-pill-warning-ink: "#f0b35a"
  dark-pill-neutral-bg: "#2c3032"
  dark-pill-neutral-ink: "#d5dbda"
  dark-pet-0-tint: "#1d2c40"
  dark-pet-0-ink: "#8fb4e6"
  dark-pet-1-tint: "#3a2c12"
  dark-pet-1-ink: "#e0b26a"
  dark-drawing-stroke: "#e9eded"
  dark-drawing-fill: "#1a1c1e"
  dark-drawing-base: "#3a3e41"
typography:
  headline-lg:
    fontFamily: IBM Plex Sans
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.2
  headline-md:
    fontFamily: IBM Plex Sans
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.2
  headline-sm:
    fontFamily: IBM Plex Sans
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.25
  title-section:
    fontFamily: IBM Plex Sans
    fontSize: 17px
    fontWeight: 600
    lineHeight: 1.3
  figure-lg:
    fontFamily: IBM Plex Sans
    fontSize: 30px
    fontWeight: 500
    lineHeight: 1.1
    fontFeature: '"tnum"'
  figure-md:
    fontFamily: IBM Plex Sans
    fontSize: 22px
    fontWeight: 500
    lineHeight: 1.1
    fontFeature: '"tnum"'
  body-lg:
    fontFamily: IBM Plex Sans
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.4
  body-md:
    fontFamily: IBM Plex Sans
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.45
  body-sm:
    fontFamily: IBM Plex Sans
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.4
  label-lg:
    fontFamily: IBM Plex Sans
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1
  label-md:
    fontFamily: IBM Plex Sans
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1
  label-sm:
    fontFamily: IBM Plex Sans
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.2
  label-tab:
    fontFamily: IBM Plex Sans
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.2
  mono-md:
    fontFamily: IBM Plex Mono
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.45
rounded:
  none: 0px
  sm: 8px
  md: 14px
  lg: 16px
  xl: 20px
  2xl: 24px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  base: 16px
  lg: 20px
  xl: 24px
  2xl: 36px
  gutter-web: 20px
  gutter-ios: 12px
  margin-web: 36px
  margin-ios: 16px
  sidebar-width: 248px
  content-max: 1180px
  settings-label-width: 360px
  row-height: 52px
  row-height-web: 56px
  row-height-web-compact: 48px
  breakpoint-phone: 900px
components:
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: 16px
  card-web:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: 20px
  panel:
    backgroundColor: "{colors.raised}"
    rounded: "{rounded.md}"
    padding: 14px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.full}"
    height: 50px
  button-primary-web:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    height: 40px
  button-primary-web-large:
    height: 48px
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
  button-secondary-in-card:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.primary}"
  button-destructive-final:
    backgroundColor: "{colors.error}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    height: 36px
  chip-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
  segmented-control:
    backgroundColor: "{colors.segment}"
    rounded: "{rounded.full}"
    padding: 3px
  segmented-control-selected:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    height: 32px
  switch:
    backgroundColor: "{colors.primary}"
    rounded: "{rounded.full}"
    width: 51px
    height: 31px
  switch-off:
    backgroundColor: "{colors.switch-off}"
  field:
    backgroundColor: "{colors.raised}"
    typography: "{typography.body-lg}"
    rounded: "{rounded.md}"
    height: 50px
  field-web:
    height: 44px
  pill:
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    height: 22px
  pill-positive:
    backgroundColor: "{colors.pill-positive-bg}"
    textColor: "{colors.pill-positive-ink}"
  pill-negative:
    backgroundColor: "{colors.pill-negative-bg}"
    textColor: "{colors.pill-negative-ink}"
  pill-warning:
    backgroundColor: "{colors.pill-warning-bg}"
    textColor: "{colors.pill-warning-ink}"
  pill-neutral:
    backgroundColor: "{colors.pill-neutral-bg}"
    textColor: "{colors.pill-neutral-ink}"
  icon-button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
    size: 44px
  quick-action:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.primary}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
  progress-track:
    backgroundColor: "{colors.track}"
    rounded: "{rounded.full}"
    height: 6px
  progress-fill:
    backgroundColor: "{colors.accent}"
  nav-item:
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
    height: 40px
  nav-item-active:
    backgroundColor: "{colors.surface}"
  dialog:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.2xl}"
    padding: 24px
    width: 480px
  side-sheet:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.2xl}"
    padding: 24px
    width: 440px
  bottom-sheet:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.2xl}"
  tab-bar:
    backgroundColor: "{colors.surface}"
    typography: "{typography.label-tab}"
  caption-pill:
    textColor: "{colors.on-primary}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    height: 22px
  day-strip-lane:
    backgroundColor: "{colors.raised}"
    rounded: "{rounded.sm}"
    height: 28px
---

# my-petkit design

This file is the visual contract for `apps/web` and `apps/ios`. Code must match it. The front
matter holds the normative token values; the prose says how to apply them. The rendered
reference for every screen is in `screenshots/` (see [Screen map](#screen-map)).

## Overview

my-petkit is a self-hosted stand-in for the PetKit cloud. Its two clients, the iOS app and the
web dashboard, look like one product: the v3 language, drawn first for the phone (2026-10-29)
and carried to the web (2026-10-30). The goal set by the user was a mobile app that looks
better than PetKit's and Catlink's own apps.

The personality is calm, domestic and exact. The cats appear as themselves (real photos as the
hero), the devices appear as clean line drawings that show their real state, and each screen
states its one finding in a plain sentence ("The fountain has been silent since 06:10.
Everything else is fine."). Colour goes on data, not on chrome. Mono has one job. The one
element only this product has is the household day strip: every visit, meal and drink on a
single 24-hour line.

Sources of truth, in order:

1. **Feature parity** (`apps/web/PARITY.md`, `apps/ios/PARITY.md`) decides *what* a screen
   contains. A design that omits a feature never removes it from the app; add it in the style
   of the nearest screen.
2. **This file and `screenshots/`** decide *how* it looks.
3. **Where no screenshot exists**, compose the screen from these tokens and components. Never
   invent a new style.

**Binding:** tokens, the shell, the type scale, component shapes, layout per screen, copy tone,
and the state rules (empty, zero, error, risk). **Not binding, never hard-coded:** the sample
data in the screenshots (Miso and Mochi, 14:47, 192.168.1.20, device IDs, weights, log lines).
Screens render real API data; the sample data becomes test fixtures only.

## Colors

A cool, near-neutral palette: a sea-glass tinted ground, white content, near-black ink, and a
single deep teal for data.

- **Ground (#edf2f1):** the frame behind everything: the iOS screen and the web sidebar.
- **Surface (#ffffff):** white cards, tab bar, chips, icon buttons, dialogs and sheets.
- **Raised (#f4f7f6):** panels inside cards, device-drawing panels, quick actions, fields,
  warning boxes, empty day-strip lanes.
- **Ink / Primary (#131416):** text and the primary button fill. Primary buttons are ink, never
  the accent.
- **Muted (#5d6262):** labels, units, secondary text, inactive tabs. **Lede (#3b4040)** is the
  finding sentence under a page title.
- **Accent, Deep Teal (#0f6e66):** data only — the main chart series, the now line, progress
  fills, links, the focus ring, and the one selected state. Never on chrome or button fills.
- **Chart 2 (#2f70bb)** second series and the "Polling" status; **Chart 3 (#a86f0c)** third
  series.
- **Status:** positive (#1e7b4f) = Online; warning (#92400e) = running low; error (#c4242a) =
  Offline, the failing fact, the final R3 action, destructive text.
- **Pills** pair a pale fill with a dark ink of the same hue (positive, negative, warning,
  neutral). They sit only beside a value or a title.
- **Pet identity:** each pet gets a tint/ink pair by index (blue for the first, amber for the
  second, at least 60° apart in hue). Used for day-strip ticks and identity tints, never in
  chart legends.
- **Drawing fills** are reserved for inside the device drawings: litter (#cfe5e2, also the
  light bars of a bar chart and the fountain's "reporting" band), food (#e9d9b8), water
  (#cfe0f2).
- **Live view** is dark in both modes: frame #1b1d1e on the web (#0e0f10 on iOS), round
  controls on #202325, text #f2f4f4.

Tokens live in exactly one file per client: `apps/web/src/shared/ui/tokens.css` (light under
`:root`, dark under `.dark`) and `apps/ios/PetkitKit/Sources/PetkitCore/Theme/`
(`Theme.Color`, `Theme.Font`, `Theme.Space`). No other file may contain a hex value; CI
enforces it (`apps/web/scripts/check-no-hex.mjs`).

### Dark mode

Every light token maps to one dark value (the `dark-*` tokens above). The reference screens are
`ios-devices-dark` and `web-home-dark`. Ground becomes #0e0f10, cards #1a1c1e, panels #232628;
primary buttons and selected chips invert to #f2f4f4 on #0e0f10; accent lightens to #4fc2b6;
status words to #5fd39b / #ff7a72 / #f0b35a; day-strip pet ticks to #8fb4e6 and #e0b26a; the
fountain band to #1f3a37. Drawing strokes lighten to #e9eded while litter, food and water keep
their light tints. iOS follows the system setting with no in-app switch; the web sets `.dark`
on `<html>` before first paint.

## Typography

Two faces, both OFL, self-hosted on the web (CSP `font-src 'self'`) and bundled on iOS.

- **IBM Plex Sans 400/500/600** for everything.
- **IBM Plex Mono 400/500** only for IDs, firmware versions, URLs, addresses, fingerprints,
  keys, file names, hex frames and log lines.

| Role | Token | Web | iOS |
|---|---|---|---|
| Page title | `headline-lg` / `headline-md` | 28/600 (24 under 900px) | 24/600 |
| Dialog title | `headline-sm` | 22/600 | — |
| Section | `title-section` | 17/600 | 17/600 |
| Figure | `figure-lg` / `figure-md` | 30/500 | 30/500 (22–24 inside rows) |
| Lede, fields | `body-lg` | 15 | 15 (body) |
| Body | `body-md` | 14 | — |
| Small | `body-sm` | 13 | 13 |
| Caption, pill | `label-sm` | 12 | 12 |
| Tab label | `label-tab` | — | 11 |

Nothing is smaller than 11px. Every number uses tabular figures (`font-variant-numeric:
tabular-nums` on the web, `.monospacedDigit()` on iOS). A figure's unit is 15px muted, 400.
On the web the scale maps to Tailwind names: `text-xs` 12, `text-sm` 13, `text-base` 14,
`text-md` 15, `text-lg` 17, `text-xl` 22, `text-2xl` 28, `text-3xl` 30.

## Layout

**iOS.** A 390pt-wide screen on `ground`. Header: 54px top inset, a bar row (server line or
back button, icon buttons), the 24/600 title and one lede sentence. Content in a column of
white cards, 16px side margins, 12px between cards. Four tabs at the bottom on a white bar:
**Home, Timeline, Pets, Server** (Server holds Logs, Capture, Patchers, Setup and app
settings). Pushed screens get a back button and no tab bar.

**Web.** A 248px sidebar on `ground` with the mark, pill nav items (Home, Timeline, Pets ·
Server: Logs, Add a device, Settings · Advanced, needs step-up: Capture, Patchers) and a foot
panel on `raised` with the live dot, server address and "TLS pinned". The sidebar is the only
navigation. Content padding 28px 36px 56px, max width 1180px, 20px gaps. The page header is a
back link when pushed, the 28/600 title with a status word beside it, one finding sentence, and
actions on the right. Grids: 1.4fr/1fr columns, even halves, 4-up and 3-up device grids.
Under 900px the sidebar becomes a top bar with a menu button, columns stack, the 4-up grid
becomes 2-up, and the title drops to 24.

Rows are 52px on iOS and 48–56px on the web, split by a 1px `rule`. Settings sections on the
web use a 360px label column with the config key in mono under the label.

## Elevation & Depth

Depth is tonal, not shadowed: `ground` → white `surface` card → `raised` inner panel. Resting
elements have no shadow and no border. Only floating layers carry a shadow:

- Dialogs and menus: `0 8px 30px rgba(0,0,0,.14)` (dark: `.5`).
- Side sheets: `-8px 0 30px rgba(0,0,0,.12)`; iOS bottom sheets: `0 -8px 30px rgba(0,0,0,.12)`.
- Backdrop scrim: `rgba(19,20,22,.35)` (dark: `rgba(0,0,0,.55)`).

The figure container splits a `raised` panel into cells with 1px `border` hairlines drawn as
inset box-shadows, never as separate tiles.

## Shapes

Soft and rounded: radius 20 cards, full pills for every control.

| Element | Radius |
|---|---|
| Card | 20 (`xl`) |
| Inner panel, field, thumbnail, photo | 14 (`md`) |
| Quick action, warning box, sidebar foot, toast, video | 16 (`lg`) |
| Dialog, side sheet inner edge, bottom sheet top | 24 (`2xl`) |
| Day-strip lane | 8 (`sm`) |
| Buttons, chips, segmented control, switch, pill, nav item | full |
| Avatar, round controls | 50% |

## Components

Built once per client (`apps/web/src/shared/ui/`, `apps/ios/MyPetkit/Shared/`) and reused. On
the web they are shadcn/ui on Base UI (`shared/ui/shadcn/`) edited to these rules; toasts use
Base UI's Toast primitive and selects are native, because Sonner and Base UI's Select inject
`<style>`, which the CSP blocks.

- **Buttons.** Pills. Primary is ink with white text, at most one per screen (iOS 50px, web 40px,
  48px for the main action of a form). Secondary is white on `ground` and `ground`-tinted inside
  a card or dialog. Destructive is red text. Only the final R3 action has a red fill.
- **Chips and segmented controls.** 36px pill chips (32 small), selected chip inverts to ink.
  Segmented control: a `segment` track with 3px padding, selected segment white and 600.
- **Switch.** iOS-style 51×31, ink when on, #d5dbda when off.
- **Fields.** Borderless, `raised` fill, radius 14, 50px on iOS and 44px on the web; label 13px
  muted above.
- **Status mark.** 8px dot plus words: Online · MQTT, Polling · heartbeat, Offline, Unknown
  (hollow). The status word is the only colour in a row.
- **Pills.** 22px, 12/500, beside a value or a title only (e.g. "Step-up required",
  "41 face samples", "Fed").
- **Figure container.** One `raised` panel split into a 2×2 (or row) of cells: a 13px muted
  label over a 30/500 value with a 15px muted unit. Never tiles, icons or sparklines.
- **Progress / ratio bar.** 6px track, accent fill at the true ratio, label at the right.
- **Device card.** A drawing on a `raised` panel (112px tall on iOS) with the status pill top
  left, then the name and one state line.
- **Device detail.** Hero drawing, one-sentence state with the coloured word, model and
  firmware in mono, one primary command, four quick actions (icon above label on `raised`),
  then the figure container. Commands carry the note "Each command asks before it runs".
- **Pet tile.** Photo (120px on iOS Home, 180px on the web, 230px on Pets) with name, weight and
  visits. Photos may carry the dark caption pill (`rgba(0,0,0,.55)`, white 12/500), the only
  overlay allowed on a photo.
- **Timeline.** The latest visit as a large video card with a play button; the rest as rows with
  a 76×56 clip thumbnail.
- **Household day strip.** A 24h axis, one lane per pet plus feeder and fountain lanes on
  `raised`. Visit = 3×16 tick in the pet's ink; meal = 8px square, filled when fed, outlined when
  planned; fountain = `fountain-reporting` band, then a hatch in `error` (SVG pattern, not a
  gradient); now = 1px accent line with its time label. Positions use minutes since midnight in
  the **device's timezone**, never the browser's.
- **Tables and lists.** 12px muted sentence-case headers, 1px `rule` rows, no zebra, numbers
  right-aligned, one status mark and one trailing action. A selected row gets a 2px accent inset
  left edge. Log lines are mono 12 with a 2px left edge in the level colour, never a row fill.
- **Device command (R2).** A confirm dialog (web) or bottom sheet (iOS): the title is a question,
  the body says what moves and lists the pre-checks, the confirm button is ink.
- **Step-up (R3).** Its own screen or dialog. A "Step-up required" pill beside the title, one
  warning paragraph on `raised` with a single 16px red icon, what changes and how to undo it.
  Only the last action is red.
- **Overlays.** Web: centred dialogs (480px, radius 24) for confirmations, step-up, sounds and
  change-cat; a right sheet (440px) for editors (meal, Bluetooth pairing). iOS: bottom sheets
  with a grab handle.
- **Empty, zero, error, loading.** A zero prints as 0; missing is a muted em dash. An error stays
  inside its block: one sentence plus Retry. Loading is grey bars at final size on `raised`, no
  shimmer, no layout shift.
- **The mark.** A circle with a 2px accent stroke and its lower third filled: the litter-box drum.
  Used as the favicon, app icon base and shell mark.

## Do's and Don'ts

These are review-blocking (`apps/web/scripts/check-design-rules.mjs` checks the web).

- Do keep every hex value in the token files only.
- Do spend the accent only on data and the one selected state; never on chrome or button fills.
- Do use red once per object, and fill only the final R3 action.
- Do use tabular figures for every number.
- Do state each screen's finding in one plain sentence with the hue on the single word that
  matters.
- Do render device strings as text only (security rule).
- Don't use `letter-spacing` or uppercase labels.
- Don't use gradients (the fountain hatch is an SVG pattern), glass, blur or emoji.
- Don't put a shadow or a 1px border on resting elements; only dialogs, sheets, menus and toasts
  get a shadow.
- Don't put icons in tinted squares as decoration; quick actions are buttons on `raised`.
- Don't build KPI tile grids; use the figure container.
- Don't use mono outside IDs, firmware, addresses, file names, keys and log lines.
- Don't add bottom tabs on the web; the sidebar is the only navigation.
- Don't imitate PetKit's product photography; device drawings are line art from geometry.
- Don't ship the sample cat photos in either app bundle.

## Device drawings

Line drawings of the drum (litter box), dual hopper (feeder), fountain and spray, built from
simple geometry on a 100 × 100 grid with a 2px ink stroke, white body and `drawing-base` foot.
The drawing shows real state: litter level, hopper levels and water level filled with the
`litter`, `food` and `water` tints. Web: `apps/web/src/shared/ui/device-drawings/`; iOS:
`apps/ios/MyPetkit/Shared/Drawings/`. Models without their own drawing (single feeder,
purifier, unknown) are drawn in the same language.

## Screen map

Each reference renders at 390×844 (iOS; taller boards for long screens) or 1440×1000 (web) in
`screenshots/`. `ios-v3-overview.png` and `ios-v3-overview-admin.png` show the main iOS screens
side by side.

| Area | iOS | Web |
|---|---|---|
| Home / devices overview | `ios-devices`, `ios-devices-dark` | `web-home`, `web-home-phone`, `web-home-dark` |
| States (empty, loading, error, zero, unreachable) | `ios-states` | `web-states` |
| Litter box | `ios-device-t6`, `ios-device-t6-paused` | `web-device-t6`, `web-device-t6-paused` |
| Feeder | `ios-device-feeder` | `web-device-feeder` |
| Fountain (offline) | `ios-device-fountain` | `web-device-fountain` |
| Sounds | `ios-sounds` | `web-sounds` |
| Bluetooth accessory pairing | `ios-ble-pair` | `web-ble-pair` |
| Live view | `ios-live` | `web-live` |
| Schedules | `ios-schedules` | `web-schedules` |
| Timeline, change cat | `ios-timeline`, `ios-change-cat` | `web-timeline`, `web-change-cat` |
| Pets | `ios-pets`, `ios-pet-edit` | `web-pets` |
| Logs | `ios-logs` | `web-logs` |
| Capture (R3) | `ios-capture` | `web-capture` |
| Patchers (R3) | `ios-patcher` | `web-patchers` |
| Step-up | `ios-step-up` | `web-step-up` |
| Provision | `ios-provision` | `web-provision` |
| Server settings | `ios-settings`, `ios-server-setup` | `web-server` |
| Pairing, sign-in, first run | `ios-pairing`, `ios-first-run` | `web-sign-in`, `web-first-run` |

Screens with no reference (sprays and other device models) reuse the feeder layout.

## Checking a screen

1. Open `screenshots/<screen>.webp`.
2. Screenshot the built screen at the same size with fixture data: Playwright at 1440×1000 and
   390×844 for the web; `xcrun simctl io booted screenshot` on an iPhone 16 Simulator for iOS.
3. Compare side by side. Layout, hierarchy, spacing, colour use and type must match; text and
   data may differ.
4. Put before and after screenshots in the PR for any screen whose layout changed.

The cat photos in the screenshots are mockup-only: Miso is "Tabby cat with blue eyes-3336579"
by AdinaVoicu (CC0), Mochi is "White Cat with black patch" by Sree4707 (CC BY-SA 4.0), both via
Wikimedia Commons.
