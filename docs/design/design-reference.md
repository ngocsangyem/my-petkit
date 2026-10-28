# Design reference for implementation

This is the visual contract for phase 07 (web), 08 (iOS), 09 (provisioning) and 10 (live). Code must match it. Read it together with the art direction in `../../reports/design-261028-1447-my-petkit-taste-art-direction.md`, which holds the reasoning, the Mobbin references and the banned list.

## 1. Sources of truth, in order

1. **Feature parity** (`ledger-261028-web-panel-patchers.md` §11, `PARITY.md` of each app) decides *what* a screen contains. A design that omits a feature never removes it from the app. Add it in the style of the nearest artboard.
2. **This folder** decides *how* it looks.
   - `artboards/*.dc.html` is the source: every colour, size, spacing and string.
   - `screenshots/*.webp` is how each artboard renders: 1440×1000 web, 390×844 iOS, 390×1600 T6.
3. **The live canvas** is https://claude.ai/artifact/Dk4xYHQmxdev8Vj22uLQbE (private).
   - If it changes after 2026-10-28, re-copy it into `artboards/` and re-render the screenshots before coding from it.
   - The copy here is what the plan was reviewed against.
4. **Where no artboard exists**, compose the screen from these tokens and components and from `design-taste-frontend/references/app-screens.md`. Never invent a new style.

**Binding:** tokens, the shell, type scale, component shapes, layout per screen, copy tone, and the state rules (empty, zero, error, risk).

**Not binding, and never to be hard-coded:** the sample data. That covers Miso and Mochi, 14:47, 192.168.1.20, the device IDs, the weights and the log lines. Screens render real API data. The sample data becomes test fixtures only, kept in the same shape as `../../reports/design-261028-1447-my-petkit-taste-art-direction.md` §7.

The cat photos in `assets/` are for mockups and fixtures only. Credits are in `assets/credits.json`. Mochi's photo is CC BY-SA 4.0, so ship neither photo in the app bundle.

## 2. Tokens

The web defines these once in `apps/web/src/shared/ui/tokens.css`. iOS defines them once in `PetkitKit/Sources/PetkitCore/Theme/` (`Theme.Color`, `Theme.Font`, `Theme.Space`). No other file may contain a hex value; a lint rule or grep in CI enforces this.

| Token | Value | Use |
|---|---|---|
| `ground` | `#f2f6f5` | frame: web sidebar and top bar; iOS header and tab bar |
| `surface` | `#ffffff` | the sheet, the content |
| `raised` | `#f5f7f7` | inset panels, settings panels, figure containers, empty lanes |
| `active` | `#e8eded` | active nav pill, pressed row |
| `border` | `#e3e8e7` | sheet edge, cards |
| `rule` | `#eef1f1` | table and list row rules |
| `control` | `#cdd3d2` | input and secondary-button borders |
| `text` | `#131416` | ink, primary button fill |
| `muted` | `#5d6262` | secondary text, labels |
| `accent` | `#0f6e66` | data (main series, now line, bars), links, focus ring, the one selected state. Never on chrome or button fills |
| `chart2` | `#2f70bb` | second series; "Polling" status |
| `chart3` | `#a86f0c` | third series |
| `positive` | `#1e7b4f` | Online |
| `warning` | `#92400e` | running low (consumables) |
| `negative` | `#c4242a` | Offline, the failing fact, R3 final action, destructive text |
| `pill.positive`, `pill.negative`, `pill.warning`, `pill.neutral` | `#dcfae5/#04250e`, `#ffedea/#831c1e`, `#fffbeb/#92400e`, `#e8eded/#353736` | 20px pills beside a value or title only |
| `cat.miso`, `cat.mochi` | `#e4edf8/#24548f`, `#f8eedb/#7a4f08` | per-pet identity tint; assigned by pet index, at least 60° apart in hue. Never in chart legends |
| `fountain.reporting` | `#cfe5e2` | "reporting" band on the day strip |

Radius tokens:

| Element | Radius |
|---|---|
| sheet | 16 |
| card | 8 |
| control | 6 |
| pill | 999 |
| avatar | 50% |

Spacing tokens:

| Token | Web | iOS |
|---|---|---|
| gap | 24 | 16 |
| pad | 24 | 16 |
| row height | 48–56 | 52 |

Type is IBM Plex Sans 400, 500 and 600. IBM Plex Mono 400 and 500 is used only for IDs, firmware, URLs, fingerprints, keys, file names, hex frames and log lines. Both fonts are OFL. Self-host them on the web (CSP `font-src 'self'`) and bundle them on iOS.

| Role | Web | iOS |
|---|---|---|
| Title | 22/600 | 24/600 |
| Section | 16/600 | 16/600 |
| Figure | 28/400 | 28/400 |
| Body | 14 | 15 |
| Small | 12–13 | 12–13 |

Nothing is smaller than 11px. Every number uses `font-variant-numeric: tabular-nums` on the web and `.monospacedDigit()` on iOS.

## 3. Shared components

Build these once (`apps/web/src/shared/ui/`, `MyPetkit/Shared/`) and use them everywhere.

| Component | Artboard to copy | Rules |
|---|---|---|
| App shell (web) | `web-devices` | Tinted L-frame: 228px sidebar with the drum mark, nav groups (Home / Tools / Advanced · needs step-up), and a 48px top bar with search, Live dot and server + "TLS pinned". The sheet is inset 8px right and bottom, 1px edge, radius 16, no shadow. Under 900px the sidebar becomes a 48px phone bar with a menu sheet. |
| App shell (iOS) | `ios-devices` | Header on `ground` with the mark row, a 24/600 title and one finding line. Content on white. The 5-tab bar (Devices, Timeline, Pets, Logs, Settings) is on `ground`. Pushed screens get a back button and no tab bar. |
| Drum mark | `Main` | Inline SVG: a circle with a 2px accent stroke and the lower third filled. Use it as the web favicon, the iOS app icon base and the shell mark. |
| Status mark | `Main`, `web-devices` | 8px dot plus words: Online · MQTT, Polling · heartbeat, Offline, Unknown (hollow). The status word is the only colour in a row. |
| Figure container | `web-devices` (Litter box) | One `raised` container split by 1px `border` lines. Each cell has a 12/500 muted label over a 28/400 value with a 14px muted unit. Never tiles, icons or sparklines. |
| Ratio bar | consumables, feeder | 6px track on `rule`, fill at the true ratio, label at the right. |
| Household day strip | `web-devices`, `web-timeline`, `ios-devices`, `ios-timeline` | 24h axis with one lane per pet, plus feeder and fountain lanes. Visit = 3×16 tick in the pet's ink. Meal = 8px square, filled when fed, outlined when planned. Fountain = `fountain.reporting` band, then a hatch in `negative` (SVG pattern, not a gradient). Now = 1px `accent` line with the time label. The legend uses the marks themselves. Positions come from minutes since midnight in the **device's timezone** (phase 04 V4), never the browser's. |
| Table / list | `web-devices`, `web-log` | 12px muted sentence-case headers, no band, 1px `rule` rows, no zebra striping. Numbers right-aligned. One status mark and one trailing action. A selected row gets a 2px `accent` inset left edge. Log levels use a 2px left edge in the level colour, never a row fill. |
| Buttons | `Main` | Primary is `text` fill with white text, at most one per screen. Secondary is white with a `control` border. Destructive is red text. Only the final R3 action button has a `negative` fill. Web height 32, iOS ≥ 44. |
| Device command (R2) | `web-devices`, `ios-device-t6` | Secondary buttons or rows, with the note "Each command asks before it runs". The confirm sheet title is a question, the body says what moves, the confirm button is near-black. |
| Step-up (R3) | `web-patchers`, `web-capture`, `ios-patcher` | Own screen. A 20px "Step-up required" pill beside the title. One warning paragraph on `raised` with a single 16px red icon. Only the last action is red. Include an undo sentence. |
| Settings section | `web-setup`, `ios-settings` | Web: 360px label column, then a panel on `raised` (radius 16, no border); sections split by a `rule` with 32px each side; the config key shown in mono under the label. iOS: grouped rows, value right in muted, destructive as red text at the end. |
| Empty, zero, error | — | Follow `app-screens.md` §11. A zero prints as 0. Missing is a muted em dash. An error stays inside its block: one sentence plus Retry. Loading is grey bars at final size, with no shimmer and no layout shift. |

## 4. Screen map

| Artboard | Web feature `apps/web/src/features/` | iOS feature `MyPetkit/Features/` | Phase |
|---|---|---|---|
| `Main` | `shared/ui` tokens and components | `Shared`, `PetkitCore/Theme` | 07, 08 |
| `web-login` | `auth` (sign in, first run, pair the app, step-up dialog) | — | 07 |
| `ios-pairing` | — | `Onboarding` | 08 |
| `web-devices` | `devices` (overview, day strip, list, litter box, feeder, fountain) | — | 07 |
| `ios-devices` | — | `Devices` (list) | 08 |
| `ios-device-t6` | the litter-box block of `web-devices` | `Devices` (detail; other models reuse this layout with their entities) | 07, 08 |
| `ios-schedules` | `schedules` (no web artboard: reuse the iOS layout inside the sheet) | `Schedules` | 07, 08 |
| `web-timeline` | `timeline` | — | 07 |
| `ios-timeline` | — | `Timeline` | 08 |
| `web-pets` | `pets` | — | 07 |
| `ios-pets` | — | `Pets` | 08 |
| `web-log` | `log` | — | 07 |
| `ios-logs` | — | `Logs` | 08 |
| `web-setup` | `setup` (plus the client tokens section) | — | 07 |
| `ios-settings` | — | `Settings` | 08 |
| `web-capture` | `capture` | — | 07 |
| `ios-capture` | — | `Capture` | 08 |
| `web-patchers` | `patchers` | — | 07 |
| `ios-patcher` | — | `Patchers` | 08 |
| `web-provision` | `provision` | — | 07 |
| `ios-provision` | — | `Provision` | 09 |
| `ios-live` | live view inside `devices` (no web artboard: reuse the iOS layout) | `Live` | 10 |

Screens with no artboard are built from §3 and the nearest row above:
- web schedules editor;
- web live view;
- other device models (feeders, fountains, sprays);
- sounds;
- dark mode (not designed; ship light only unless a later design pass adds it).

## 5. How to check a screen against the design

1. **Render the reference**, from the plan folder:

   ```bash
   node design/tools/render-dc.mjs design/artboards /tmp/dc-out design/assets
   ```

   This needs Node 22+. Open `/tmp/dc-out/<artboard>.html`, or use `screenshots/<artboard>.webp`.
2. **Screenshot the built screen at the same size**, loaded with the fixture data from §1.
   - Web: Playwright at 1440×1000 and 390×844. Headless Chrome cannot go below a 500px window.
   - iOS: `xcrun simctl io booted screenshot` on an iPhone 16 Simulator.
3. **Compare side by side.** Layout, hierarchy, spacing, colour use and type must match. Text and data may differ.
4. **Run the taste gate on the web build.** Fix every FAIL; each WARN needs a one-line reason in the PR.

   ```bash
   node <petkit-app>/.claude/skills/design-taste-frontend/scripts/inspect.mjs --app <url>
   node <petkit-app>/.claude/skills/design-taste-frontend/scripts/lint.mjs --app apps/web/src
   ```

5. **Put the before and after screenshots in the PR** for any screen whose layout changed.

## 6. Hard rules carried into code review

These rules are review-blocking:
- No hex outside the token files.
- No `letter-spacing` or uppercase labels.
- No gradients (the hatch is an SVG pattern).
- No shadow on resting elements; only sheets, menus and dialogs get one.
- No glass or blur, and no emoji.
- No icons in tinted squares.
- No KPI tile grids; use the figure container.
- No accent fill on buttons.
- Mono only for the jobs listed in §2.
- Red once per object.
- Device strings render as text only (security rule, phase 07).
