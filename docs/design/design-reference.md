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
| Title | 28/600 (24 under 900px; §8) | 24/600 |
| Section | 16/600 | 16/600 |
| Figure | 30/500 (§8) | 28/400 |
| Body | 14 | 15 |
| Small | 12–13 | 12–13 |

Nothing is smaller than 11px. Every number uses `font-variant-numeric: tabular-nums` on the web and `.monospacedDigit()` on iOS.

On the web, `tokens.css` holds every token twice: light under `:root` and dark under `.dark` (§7.5 and §8.4). `theme.css` maps shadcn's theme variables onto them; the type scale uses Tailwind's size names (`text-xs` caption 12, `text-sm` small 13, `text-base` body 14, `text-md` lede and fields 15, `text-lg` section 17, `text-xl` dialog title 22, `text-2xl` page title 28, `text-3xl` figure 30), per §8.

## 3. Shared components

Build these once (`apps/web/src/shared/ui/`, `MyPetkit/Shared/`) and use them everywhere. On the web they are shadcn/ui components on Base UI (`shared/ui/shadcn/`), edited to these rules: app shell → Sidebar and Sheet; table → Table; buttons → Button; device command → Dialog with the alertdialog role (Base UI's AlertDialog ignores a backdrop click, which cancels here); step-up → Dialog and Field; settings section → Card and Field; empty, error, loading → Empty, Alert, Skeleton (no pulse); pills → Badge; ratio bar → Progress; toasts on Base UI's Toast primitive and selects native, because Sonner and Base UI's Select inject `<style>`, which the CSP blocks. The drum mark, status mark, figure container and day strip stay hand-written.

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
- web sounds (reuse the layout of `ios-sounds`);
- sprays and the other device models without their own artboard (reuse `ios-device-feeder`);
- web dark mode: no separate artboards per screen; the web takes its dark values from §7.5 and §8.4 (`tokens.css`, `.dark`). iOS dark mode is designed: see §7.5.

## 5. How to check a screen against the design

1. **Open the reference**: `screenshots/<artboard>.webp`, and `artboards/<artboard>.dc.html` for exact values (colour, size, spacing, copy). To render the HTML yourself, from the plan folder (the repo copy has no `assets/`, so photos stay blank there):

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

## 7. iOS v3 (2026-10-29): supersedes the iOS rows above

The user asked for a mobile app that looks better than PetKit's and Catlink's own apps. v3 replaces the iOS visual layer only; the web keeps §2–§6. All 24 iOS artboards are drawn in v3: the first 14, plus 10 added on 2026-10-29 (§7.4, marked *new*). Research and reasoning: `../../reports/design-261029-0135-ios-v3-mobbin-research.md`. The previous iOS artboards and screenshots are kept in `archive-v2/`.

**Source for the 10 new screens is `tools/ios-v3/bodies/` here, not the live canvas.** The canvas (https://claude.ai/artifact/Dk4xYHQmxdev8Vj22uLQbE) still holds the first 14 iOS boards, checked 2026-10-29. `artboards/` was rebuilt from the bodies and `screenshots/` re-rendered for all 10 on 2026-10-29 (headless Chromium at 390 × the height in each body's first line, then `cwebp -q 85`).

Generator: `tools/ios-v3/build_artboards.py` writes the `ios-*.dc.html` files from `tools/ios-v3/bodies/` and `head.css`, so the mark, tab bar and device drawings stay identical on every screen. Edit the bodies, then rebuild; do not hand-edit the generated artboards.

### 7.1 What changed

| Area | v2 | v3 |
|---|---|---|
| Ground | white screen, tinted header and tab bar | `ground.ios #edf2f1` behind everything; content sits on white cards |
| Cards | 1px border, radius 8, rows split by rules | white, **radius 20**, no border, no shadow (tone step only); inner panels `raised #f4f7f6` radius 14–16 |
| Controls | 44px rectangles, radius 6 | **full pills**: primary 50px near-black, secondary on `raised`; segmented control on `#e3e8e7` |
| Pets | 20–24px avatars | real photos as the hero: 120px tiles on Home, 230px on Pets, thumbnails on Timeline |
| Devices | text rows | a card per device with its **line drawing** (drum, dual hopper, fountain, spray) on a `raised` panel; the drawing shows real state (litter level, hopper levels, water level) |
| Device detail | a long list | hero drawing, one-sentence state with the coloured word, one primary command, four quick actions, then a 2×2 figure container |
| Timeline | text rows | latest visit as a large video card; the rest as rows with a 76×56 clip thumbnail |
| Pets | list of cats | cat switcher chips, photo, weight line chart with 1W/2W/3M, visits per day bars, face photos grid |
| Live | dark header, light body | full dark screen (`#0e0f10`), large "Hold to talk" pill, round controls on `#202325` |
| Tab bar | 5 tabs: Devices, Timeline, Pets, Logs, Settings | **4 tabs: Home, Timeline, Pets, Server**. Server holds Logs, Capture, Patchers, Setup and app settings |

### 7.2 New tokens (iOS only)

| Token | Value | Use |
|---|---|---|
| `ground.ios` | `#edf2f1` | screen background |
| `raised` | `#f4f7f6` | panels inside cards, device drawing panel, quick actions |
| `segment` | `#e3e8e7` | segmented-control track |
| `food` | `#e9d9b8` | food inside the feeder drawing only |
| `water` | `#cfe0f2` | water inside the fountain drawing only |
| `litter` | `#cfe5e2` | litter inside the drum drawing; also the light bars of a bar chart |
| `live.ground`, `live.control`, `live.text` | `#0e0f10`, `#202325`, `#f2f4f4` | live view only |

Radius: card 20, inner panel 14–16, thumbnail 10–14, controls and pills 999, sheet top 24.
Type: unchanged faces. Title 24/600, section 17/600, figure 30/500 (22–24 inside rows), body 15, small 13, extra small 12.

### 7.3 Rules kept and rules relaxed

- Kept: no gradients, no glass or blur, no emoji, no icons in tinted squares as decoration, accent only on data and the one selected state, red once per object, every number in tabular figures, mono only for IDs and firmware.
- Relaxed for the phone, with their limit:
  - Radius 20 cards and pill controls (the soft mode of `app-screens.md` §9.4, chosen once for iOS).
  - Quick-action buttons may carry an icon above the label; they are buttons, not decoration, and sit on `raised`, never a hue.
  - Photos may carry a dark pill label (`rgba(0,0,0,.55)`) over them; the pill is the only overlay.
  - Bottom sheets get a shadow (they float).
- The device drawings are line art made from geometry. They are not product renders and never imitate PetKit's product photography.

### 7.4 Screen map (iOS)

| Artboard | iOS feature | Notes |
|---|---|---|
| `ios-devices` | `Devices` (Home) | cats first, then devices, then the day strip |
| `ios-device-t6` | `Devices` (litter-box detail) | includes Automation (auto clean, auto-pack) and Bluetooth accessories |
| `ios-device-t6-paused` | `Devices` (paused state) | force continue sheet; R3 step-up comes first |
| `ios-device-feeder` | `Devices` (feeder detail) | per-hopper portions, today's meals, feeder settings; fountains and sprays reuse this layout |
| `ios-schedules` | `Schedules` | meal cards with a now line |
| `ios-timeline` | `Timeline` | video card plus clip rows |
| `ios-pets` | `Pets` | needs per-pet weight history and visits per day from the API (listed as a known gap in `apps/web/PARITY.md`) |
| `ios-live` | `Live`, `Talk` | |
| `ios-pairing` | `Onboarding` | dark scanner card, server card with the fingerprint on a `raised` panel |
| `ios-provision` | `Provision` | drum, Bluetooth and phone drawn on one panel; four steps with check discs; fields on `raised` |
| `ios-patcher` | `Patchers` | step-up pill, one warning panel, what changes and how to undo; only the final button is red |
| `ios-logs` | `Logs` (pushed from Server) | Server / Device logs segment, filter field, log lines with a 2px level edge |
| `ios-capture` | `Capture` (pushed from Server) | warning panel, record toggle, files with sizes, last lines in mono |
| `ios-settings` | `Settings` (the Server tab) | server card with Devices and Need you figures; Activity, Advanced (step-up rows) and This phone groups |
| `ios-first-run` *new* | `Onboarding` (step 2 of 2) | setup code from the server log, admin name, password with strength; this iPhone becomes the first paired client |
| `ios-step-up` *new* | `Shared/StepUpScreen` | the generic R3 re-auth screen every step-up row opens: user, server, password, "valid for 5 minutes, for this phone only", the wait after failures. Its `<title>` line reads "Patcher (R3 step-up)", but the screen is shared |
| `ios-server-setup` *new* | `Setup` (pushed from Server) | cloud guards (firmware, shell, log upload), proxy mode with region and blocked count, retention per kind with space used |
| `ios-ble-pair` *new* | `Ble` (pair sheet from the parent device) | type chips, MAC, secret, serial, K3 link, interval, guessed scan type; Import from cloud |
| `ios-sounds` *new* | `Devices` → Sounds | built-in and uploaded sounds, volume, voice language, the 10 × 2 MB upload limit |
| `ios-device-fountain` *new* | `Devices` (fountain detail) | offline variant: last known values, Retry connection, commands disabled until it reports, today's drinks, fountain settings |
| `ios-pet-edit` *new* | `Pets` (edit) | name, registered weight, weight matching, light visits, per-device face photos against the 15-cat limit, remove |
| `ios-change-cat` *new* | `Timeline` → change cat sheet | who used the box: candidates by weight, "no cat, just passing", optional weight update, "changes this record only" |
| `ios-states` *new* | `Shared` | empty Home with Add a device, loading bars, error inside a block, zero and missing, server unreachable |
| `ios-devices-dark` *new* | `Devices` (Home, dark) | the dark-mode reference; every other screen derives from §7.5 |

### 7.5 Dark mode (iOS only)

Drawn only on `ios-devices-dark`. The other screens take their dark colours from the `.dark` rules in `tools/ios-v3/head.css`, which map each light token to one dark value:

| Light | Dark | Use |
|---|---|---|
| `ground.ios` `#edf2f1` | `#0e0f10` | screen (same as `live.ground`) |
| `surface` `#ffffff` | `#1a1c1e` | cards, tab bar, chips, icon buttons; white inside drawings |
| `raised` `#f4f7f6` | `#232628` | panels, drawing panel, quick actions |
| `segment` / drawing base `#e3e8e7` | `#3a3e41` | drawing base fill |
| `text` `#131416` | `#f2f4f4`; strokes `#e9eded` | ink, drawing strokes |
| `muted` | `#a1a8a8`; lede `#c9cfcf` | secondary text, inactive tab |
| `accent` | `#4fc2b6` | links, data |
| `positive` / `negative` | `#5fd39b` / `#ff7a72` | status words |
| `pill.positive`, `pill.negative`, `pill.neutral` | `#123824/#bdf2d3`, `#43191a/#ffc9c4`, `#2c3032/#d5dbda` | pills |

`Theme.Color` declares each token once with its light and dark value (asset catalog colour sets or `UIColor(dynamicProvider:)`). The app follows the system setting; there is no in-app switch. The web has its own dark mode: see §8.4.

## 8. Web v3 (2026-10-30): supersedes the web rows above

The web dashboard now uses the iOS v3 language, so the two clients look like one product. v3 replaces the web visual layer: §2's colour values stay, §3's web components and §6's rules change as listed below. The web v2 artboards and screenshots are kept in `archive-v2/`. Source: `tools/web-v3/` (`web.css` on top of `tools/ios-v3/head.css`, one body per screen, `build_artboards.py` wraps them). Rebuild with `python3 tools/web-v3/build_artboards.py artboards`.

Synced into the repository on 2026-10-31: `apps/web` implements every board in §8.3, checked at 1440 and 390 in light and dark (the per-screen ticks and deliberate deviations are in `apps/web/PARITY.md`).

### 8.1 What changed from web v2

- **Frame.** A 248px sidebar on `ground` (`#edf2f1`) with the mark, pill nav items (Home, Timeline, Pets · Server: Logs, Add a device, Settings · Advanced, needs step-up: Capture, Patchers) and a foot panel with the live dot, address and "TLS pinned". The active item is a white pill. Under 900px the sidebar becomes a top bar with a menu button.
- **Content.** White cards, radius 20, on `ground`; inner panels on `raised` (`#f4f7f6`), radius 14. No sheet with an L-frame, no 1px card borders.
- **Page header.** Back link (when pushed), 28/600 title with a status word beside it, one finding sentence, and the actions on the right.
- **Devices are drawn**, not listed: the iOS v3 line drawings (drum, feeder, fountain, spray) on Home and at the top of each device page, with the figures in a split panel beside them.
- **Controls are pills**: buttons 40px high (48 for the main action of a form), chips 36, segmented controls, iOS-style switches. Primary is near-black, secondary is white on `ground` and `ground`-tinted inside a card, the R3 final action is red.
- **Overlays**: dialogs (radius 24, centred) for confirmations, step-up, sounds and change-cat; a right sheet (radius 24 on the left edge) for editors (meal, Bluetooth pairing).
- **Photos** of the cats appear on Home, Timeline and Pets; video thumbnails carry the dark caption pill (§7.3).

### 8.2 Rules

§7.3 applies to the web too: kept rules unchanged, the same relaxations (radius 20 cards, pill controls, icons above quick-action labels, the dark caption pill over photos, shadows on dialogs and sheets only). Web-only:
- The sidebar is the only navigation; there are no tabs at the bottom on the web.
- Tables stay for lists of records (capture files, phones and tokens, logs); rows are 1px `rule`, no zebra.
- Mono only for IDs, firmware, addresses, file names, keys and log lines.

### 8.3 Screen map (web)

| Artboard | Web feature | Phase |
|---|---|---|
| `web-home` | `devices` overview: cats, needs-you, device drawings, today strip | 15 |
| `web-home-phone` | the same at 390px | 15 |
| `web-home-dark` | dark mode (§8.4) | 15 |
| `web-states` | empty, loading, error, zero, unreachable, out of date, toast | 15 |
| `web-device-t6` | `devices` litter box: commands, figures, live link, consumables, automation incl. auto-pack, settings incl. camera pan, Bluetooth accessories, patches, raw entities | 15 (13, 10) |
| `web-device-t6-paused` | force continue dialog | 15 (13) |
| `web-live` | `live`: WebRTC/MSE/HLS, controls, camera pan; no talk on the web | 15 (10) |
| `web-sounds` | `devices` sounds dialog | 15 |
| `web-device-feeder` | `devices` feeder: feed now, today's meals, settings | 15 |
| `web-schedules` | `schedules`: list, deferred feed, meal editor sheet | 15 |
| `web-device-fountain` | `devices` fountain, offline state | 15 |
| `web-ble-pair` | `devices` Bluetooth accessory sheet | 15 |
| `web-timeline` | `timeline`: filters incl. light visits and not recognised, list, selected visit with media and debug | 15 (14) |
| `web-change-cat` | change-cat dialog | 15 (14) |
| `web-pets` | `pets`: profile and recognition, weight, visits, face photos, unbound faces | 15 (14) |
| `web-logs` | `log`: live server log, device logs | 15 |
| `web-capture` | `capture` (R3) | 15 |
| `web-patchers` | `patchers` (R3), seven patchers | 15 |
| `web-step-up` | step-up dialog | 15 |
| `web-provision` | `provision` over Web Bluetooth | 15 |
| `web-server` | `setup` and `tokens`: server, guards, proxy, retention, phones and tokens, appearance, connection, account | 15 |
| `web-sign-in`, `web-first-run` | `auth` | 15 |

### 8.4 Dark mode (web)

Drawn on `web-home-dark`. Same mapping as §7.5, extended to the frame: the active nav pill, secondary buttons and chips use `#1a1c1e`; panels, lanes, inputs and the sidebar foot use `#232628`; primary buttons and selected chips invert to `#f2f4f4` on `#0e0f10`; the day-strip pet ticks lighten to `#8fb4e6` (Miso) and `#e0b26a` (Mochi); the fountain band becomes `#1f3a37`; `warning` text becomes `#f0b35a`. Approved by the user on 2026-10-30. Phase 09.5 uses these values for the tokens §7.5 does not cover, instead of proposing its own.

The web video frame (`live-ground`) is `#1b1d1e` in both modes, as the artboards' video block draws it, instead of iOS's `#0e0f10`, which equals the dark ground (set 2026-10-31).
