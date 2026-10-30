# Web app parity with the legacy panel

The legacy panel (`services/api/src/my_petkit/web/templates`, `web/static/js`,
`web/static/styles.css`) is deleted and `/` serves this app; `/app/`, where it
was mounted beside the panel, is a permanent redirect to `/`. That change merges
only when every row below is ticked. The panel's files were last present at
`c050ad0`, which the "Old panel source" column refers to.

- **Done (commit):** the short hash of the commit that made it work in `apps/web`,
  checked against a running API.
- **Done (commit)** `n/a` marks a route this app deliberately does not call, with
  the reason.
- **Done (commit)** `pending`: work of the web v3 redesign branch; the hash is
  filled in when it merges.
- **Design:** ticked against the web v3 artboard named in the cell
  (`docs/design/screenshots/web-*.webp`, design-reference §8.3) when the screen
  matches it at 1440×1000 and 390×844, in light and dark mode, in layout,
  hierarchy, spacing and colour; copy and data may differ. Evidence: the
  screenshots and side-by-side comparisons in `plans/reports/web-v3-final/`
  (git-ignored), taken from the fixture preview (`preview/`) served with the
  production CSP, with no CSP violation or console error on any screen or
  dialog (2026-10-31). The v2 ticks were dropped; the v2 boards are kept in
  `docs/design/archive-v2/`. Rows with no screen of their own (a background
  call) carry `n/a`. Deliberate deviations are listed under "Known gaps".

Sources: the router (every `/api` operation in `packages/contracts/openapi.yaml`,
which the contract test keeps equal to the router) and the old panel's calls
(`git grep -oE "api\(['\`][^'\`]*" c050ad0 -- 'services/api/src/my_petkit/web/static/js/*.js'`); the UI checklist is the
legacy panel ledger's §11.1. Talk has no web client in the old panel and gets none here.

## Routes

| Feature | Route | operationId | Old panel source | Done (commit) | Design |
|---|---|---|---|---|---|
| auth | `POST /api/auth/login` | `authLogin` | — | bf3a909 | ✓ `web-sign-in` |
| auth | `POST /api/auth/logout` | `authLogout` | — | bf3a909 | n/a |
| auth | `POST /api/auth/media-url` | `authMediaUrl` | — | n/a: the session cookie authorises media; for clients that cannot send one | n/a |
| auth | `POST /api/auth/setup` | `authSetup` | — | bf3a909 | ✓ `web-first-run` |
| auth | `POST /api/auth/step-up` | `authStepUp` | — | bf3a909 | ✓ `web-step-up` |
| capture | `DELETE /api/capture/{name}` | `deleteCaptureFile` | capture.js, nav.js, setup.js | b6c372c | ✓ `web-capture` |
| capture | `GET /api/capture/{name}/download` | `downloadCaptureFile` | capture.js, nav.js, setup.js | b6c372c | ✓ `web-capture` |
| capture | `GET /api/capture/{name}` | `readCaptureFile` | capture.js, nav.js, setup.js | b6c372c | ✓ `web-capture` |
| capture | `GET /api/capture` | `listCaptureFiles` | capture.js, nav.js, setup.js | b6c372c | ✓ `web-capture` |
| devices | `DELETE /api/ble/{id}` | `deleteBleAccessory` | commands.js, devices.js | 28c8703 | ✓ `web-device-t6` |
| devices | `DELETE /api/devices/{id}/deferred-feed/{feed_id}` | `deleteDeferredFeed` | commands.js, delegate.js, devices.js | 415da52 | ✓ `web-schedules` |
| devices | `DELETE /api/devices/{id}/sounds/{sound_id}` | `deleteDeviceSound` | commands.js, delegate.js, devices.js | 28c8703 | ✓ `web-sounds` |
| devices | `DELETE /api/devices/{id}` | `deleteDevice` | commands.js, delegate.js, devices.js | 28c8703 | ✓ `web-device-t6` |
| devices | `GET /api/ble` | `listBleAccessories` | commands.js, devices.js | 28c8703 | ✓ `web-device-t6` |
| devices | `GET /api/devices/{id}/ai` | `getDeviceAi` | commands.js, delegate.js, devices.js | 28c8703 | ✓ `web-device-t6` |
| devices | `GET /api/devices/{id}/capabilities` | `getDeviceCapabilities` | commands.js, delegate.js, devices.js | 28c8703 | ✓ `web-device-t6` |
| devices | `GET /api/devices/{id}/deferred-feed` | `listDeferredFeeds` | commands.js, delegate.js, devices.js | 415da52 | ✓ `web-schedules` |
| devices | `GET /api/devices/{id}/logs` | `getDeviceLogSettings` | commands.js, delegate.js, devices.js | 28c8703 | ✓ `web-device-t6` |
| devices | `GET /api/devices/{id}/sounds` | `listDeviceSounds` | commands.js, delegate.js, devices.js | 28c8703 | ✓ `web-sounds` |
| devices | `GET /api/devices/{id}/timezone` | `getDeviceTimezone` | commands.js, delegate.js, devices.js | 28c8703 | ✓ `web-device-t6` |
| devices | `GET /api/devices/{id}` | `getDevice` | commands.js, delegate.js, devices.js | 28c8703 | ✓ `web-device-t6` |
| devices | `GET /api/devices` | `listDevices` | commands.js, delegate.js, devices.js | 28c8703 | ✓ `web-home` |
| devices | `POST /api/ble/import` | `importBleAccessories` | devices.js, pets.js | 28c8703 | ✓ `web-ble-pair` |
| devices | `POST /api/ble/{id}/command` | `sendBleCommand` | commands.js, devices.js | 28c8703 | ✓ `web-device-t6` |
| devices | `POST /api/ble/{id}/poll` | `pollBleAccessory` | commands.js, devices.js | 28c8703 | ✓ `web-device-t6` |
| devices | `POST /api/ble` | `pairBleAccessory` | commands.js, devices.js | 28c8703 | ✓ `web-ble-pair` |
| devices | `POST /api/devices/{id}/ai` | `setDeviceAi` | commands.js, delegate.js, devices.js | 28c8703 | ✓ `web-device-t6` |
| devices | `POST /api/devices/{id}/capabilities` | `setDeviceCapabilities` | commands.js, delegate.js, devices.js | 28c8703 | ✓ `web-device-t6` |
| devices | `POST /api/devices/{id}/command` | `sendDeviceCommand` | commands.js, delegate.js, devices.js | 28c8703 | ✓ `web-device-t6` |
| devices | `POST /api/devices/{id}/deferred-feed` | `addDeferredFeed` | commands.js, delegate.js, devices.js | 415da52 | ✓ `web-schedules` |
| devices | `POST /api/devices/{id}/logs` | `setDeviceLogSettings` | commands.js, delegate.js, devices.js | 28c8703 | ✓ `web-device-t6` |
| devices | `POST /api/devices/{id}/schedule` | `saveDeviceSchedule` | commands.js, delegate.js, devices.js | 415da52 | ✓ `web-schedules` |
| devices | `POST /api/devices/{id}/sounds/{sound_id}/play` | `playDeviceSound` | commands.js, delegate.js, devices.js | 28c8703 | ✓ `web-sounds` |
| devices | `POST /api/devices/{id}/sounds/{sound_id}/select` | `selectDeviceSound` | commands.js, delegate.js, devices.js | 28c8703 | ✓ `web-sounds` |
| devices | `POST /api/devices/{id}/sounds` | `uploadDeviceSound` | commands.js, delegate.js, devices.js | 28c8703 | ✓ `web-sounds` |
| devices | `POST /api/devices/{id}/timezone` | `setDeviceTimezone` | commands.js, delegate.js, devices.js | 28c8703 | ✓ `web-device-t6` |
| log | `GET /api/devicelogs/{path}` | `readDeviceLog` | log.js | b6c372c | ✓ `web-logs` |
| log | `GET /api/devicelogs` | `listDeviceLogs` | log.js | b6c372c | ✓ `web-logs` |
| log | `GET /api/events` | `listHubEvents` | — | b6c372c | ✓ `web-logs` |
| patchers | `GET /api/devices/{id}/patcher` | `getDevicePatcherStatus` | commands.js, delegate.js, devices.js | a456137 | ✓ `web-patchers` |
| patchers | `POST /api/devices/{id}/patcher` | `applyDevicePatcher` | commands.js, delegate.js, devices.js | a456137 | ✓ `web-patchers` |
| pets | `DELETE /api/pets/{id}/faces/{face_id}` | `deletePetFace` | cropper.js, nav.js, pets.js | ebc9088 | ✓ `web-pets` |
| pets | `DELETE /api/pets/{id}` | `deletePet` | cropper.js, nav.js, pets.js | ebc9088 | ✓ `web-pets` |
| pets | `GET /api/pets/unbound` | `listUnboundPetRefs` | pets.js | ebc9088 | ✓ `web-pets` |
| pets | `GET /api/pets/{id}/faces/{face_id}/photo` | `getPetFacePhoto` | nav.js, pets.js, timeline.js | ebc9088 | ✓ `web-pets` |
| pets | `GET /api/pets/{id}/faces` | `listPetFaces` | cropper.js, nav.js, pets.js | n/a: faces come embedded in `GET /api/pets`, as in the legacy panel | n/a |
| pets | `GET /api/pets/{id}` | `getPet` | cropper.js, nav.js, pets.js | ebc9088 | ✓ `web-pets` |
| pets | `GET /api/pets` | `listPets` | cropper.js, nav.js, pets.js | ebc9088 | ✓ `web-pets` |
| pets | `POST /api/pets/import` | `importPetsFromPetkit` | devices.js, pets.js | ebc9088 | ✓ `web-pets` |
| pets | `POST /api/pets/{id}/faces` | `addPetFace` | cropper.js, nav.js, pets.js | ebc9088 | ✓ `web-pets` |
| pets | `POST /api/pets/{id}` | `updatePet` | cropper.js, nav.js, pets.js | ebc9088 | ✓ `web-pets` |
| pets | `POST /api/pets` | `createPet` | cropper.js, nav.js, pets.js | ebc9088 | ✓ `web-pets` |
| setup | `GET /api/blocked` | `listBlockedAttempts` | provision.js, setup.js | bcf3653 | ✓ `web-server` |
| setup | `GET /api/info` | `getServerInfo` | main.js, pets.js, provision.js | bcf3653 | ✓ `web-server` |
| setup | `GET /api/retention` | `getRetention` | setup.js | bcf3653 | ✓ `web-server` |
| setup | `GET /api/settings` | `getLiveSettings` | setup.js | bcf3653 | ✓ `web-server` |
| setup | `POST /api/retention` | `updateRetention` | setup.js | bcf3653 | ✓ `web-server` |
| setup | `POST /api/settings` | `updateLiveSettings` | setup.js | bcf3653 | ✓ `web-server` |
| timeline | `GET /api/media/thumb/{path}` | `getMediaThumb` | media.js | abd0764 | ✓ `web-timeline` |
| timeline | `GET /api/media/{path}` | `getMediaFile` | cropper.js, media.js, setup.js | abd0764 | ✓ `web-timeline` |
| timeline | `GET /api/timeline/{id}` | `getTimelineEventDetail` | nav.js, timeline.js | abd0764 | ✓ `web-timeline` |
| timeline | `GET /api/timeline` | `getTimeline` | nav.js, timeline.js | abd0764 | ✓ `web-timeline` |
| timeline | `PUT /api/timeline/{id}/pet` | `setVisitPet` | — (new) | 1c41030 | ✓ `web-change-cat` |
| tokens | `DELETE /api/auth/tokens/{id}` | `authRevokeToken` | — | a0f2e26 | ✓ `web-server` |
| tokens | `GET /api/auth/tokens` | `authListTokens` | — | a0f2e26 | ✓ `web-server` |
| tokens | `POST /api/auth/pairing/redeem` | `authPairingRedeem` | — | n/a: the iOS app's call | n/a |
| tokens | `POST /api/auth/pairing` | `authPairingCreate` | — | a0f2e26 | ✓ `web-server` |
| log | `GET /api/ws` (WebSocket) | — | ws.js | b6c372c | ✓ `web-logs` |

## Behaviour

| Feature | Item | Old panel source | Done (commit) | Design |
|---|---|---|---|---|
| shell | Eight tabs: Devices, Timeline, AI/Pets, Provision, Log, Capture, Patchers, Setup; now the v3 sidebar (Home, Timeline, Pets · Server: Logs, Add a device, Settings · Advanced: Capture, Patchers), a top bar with a menu under 900px | nav.js, index.html | bf3a909, pending | ✓ `web-home`, `web-home-phone` |
| shell | Works under any mount point (Ingress prefix, `/app/`): relative URLs, hash routing | core.js `BASE` | bf3a909, 5970fb0 | n/a |
| shell | "This page is out of date" banner when `/api/info` names a newer build | main.js `checkPageIsCurrent` | bf3a909 | ✓ `web-states` |
| shell | Empty, loading, error and unreachable states; toast | — | bf3a909, pending | ✓ `web-states` |
| shell | Live indicator for the event stream; reconnect backoff 2 → 30 s | ws.js | bf3a909 | ✓ `web-home` (sidebar foot) |
| shell | Every string from a device rendered as text only; no inline handlers or styles (CSP) | core.js `esc` | bf3a909 | n/a |
| shell | Dark mode: System, Light, Dark; set before the first paint (new, not in the old panel) | — | 306e7d2, pending | ✓ `web-home-dark`; the Appearance control in `web-server` |
| shell | Accessibility: tablist roles, real `disabled`, focus ring, dialogs trap focus | index.html | bf3a909 | n/a |
| auth | Sign in; first run with the setup token from the log | auth.js | bf3a909, pending | ✓ `web-sign-in`, `web-first-run` |
| auth | Step-up prompt on `step_up_required`, then the request is replayed | core.js `api`, auth.js | bf3a909 | ✓ `web-step-up` |
| tokens | Pair the iOS app: pairing code + QR; list and revoke client tokens | — | a0f2e26 | ✓ `web-server` (Phones and apps) |
| devices | One collapsible panel per device, open state remembered; accessories as their own panels. Now Home's device cards with drawings, and one page per device and per accessory (`?device=`), the raw card's open state remembered | devices.js | 28c8703, pending | ✓ `web-home`, `web-device-t6`, `web-device-feeder`, `web-device-fountain` |
| devices | No repaint while the user is editing a control (`PENDING_EDITS`) | devices.js | 28c8703 | n/a |
| devices | Entity table and controls: switch, number, select, time, button, text, event, camera, image | entities.js, commands.js | 28c8703 | ✓ `web-device-t6` (Entities and raw command) |
| devices | Values formatted as Home Assistant formats them | format.js | 28c8703 | n/a |
| devices | Commands: confirm before running; destructive actions last | commands.js | 28c8703 | ✓ `web-device-t6` |
| devices | Copy stream URL | devices.js | 28c8703 | ✓ `web-live` |
| devices | Deferred feed (time in the device's zone) | schedules.js | 415da52 | ✓ `web-schedules` (One-off feeds) |
| devices | Sounds: upload (≤ 2 MB, ≤ 10), list, delete, play, select | devices.js | 28c8703 | ✓ `web-sounds` |
| devices | Schedule editors: ranges, weekly, points, feed | schedules.js | 415da52, pending | ✓ `web-schedules` (feed, with the meal editor sheet; the other editors follow it) |
| devices | Timezone, capabilities, AI and log-upload toggles | devices.js | 28c8703 | ✓ `web-device-t6` |
| devices | BLE accessories: pair, unpair, command, poll, import from cloud | devices.js | 28c8703 | ✓ `web-ble-pair`, `web-device-t6` |
| devices | Household day strip, positions in the device's time zone | — (new) | 28c8703 | ✓ `web-home` |
| devices | Force continue on a litter box paused for a cat nearby: offered only when every guard passes, confirm with the guard checklist (step-up prompt when the server asks for one), refusal shown in the block (new, not in the old panel) | — (new) | 86591f4, pending | ✓ `web-device-t6-paused` |
| devices | T6 auto-pack rule (experimental): on/off with a confirmation, trigger, threshold, quiet hours, and the server's status line (new, not in the old panel) | — (new) | 86591f4, pending | ✓ `web-device-t6` (Automation) |
| timeline | Day picker, kind chips with counts before filtering, device and pet filters (now one chip row: All, a chip per cat and per device, the kinds) | timeline.js | abd0764, pending | ✓ `web-timeline` |
| timeline | Visit cards with sub-events, lazy video, waste/health gallery, "assembling…" (now a list with the selected visit's card beside it) | timeline.js, media.js | abd0764, pending | ✓ `web-timeline` |
| timeline | Debug expander with the raw event | timeline.js | abd0764 | ✓ `web-timeline` |
| timeline | Change cat on a visit (a centred dialog at every width; "Who was it?" on an unrecognised visit opens it): cats nearest the visit weight first with "closest weight", "No cat, just passing", "Use this for <name>'s weight" (only for a reading the server accepts), bind the box's unclaimed identity, "Nothing is sent to the litter box"; "by weight" pill and "not recognised" beside a visit (new, not in the old panel) | — (new) | 1c41030, pending | ✓ `web-change-cat` |
| timeline | "Light visits" chip with its count: visits too light for any registered cat, never under All or Toileting (new, not in the old panel) | — (new) | 1c41030 | ✓ `web-timeline` |
| timeline | "Not recognised" chip with its count: visits with no cat that are not light visits, counted on the client from the day (new, not in the old panel) | — (new) | pending | ✓ `web-timeline` |
| pets | Pets CRUD, rename, faces with the 224² cropper and its rules (now one profile at a time, picked with chips) | pets.js, cropper.js | ebc9088, pending | ✓ `web-pets` |
| pets | Bind an unbound reference; import pets from the cloud | pets.js | ebc9088 | ✓ `web-pets` |
| pets | Weight per pet: registered weight in kg with when it last changed, "Match by weight when the camera cannot" with the real guard distance (twice the tolerance), weight tolerance ± g; the match switch also saves inline (new, not in the old panel) | — (new) | 1c41030, pending | ✓ `web-pets` (without its "Hide light visits" switch, which the Timeline chip replaces) |
| pets | Weight chart (1W, 2W) and seven days of litter-box visits per pet, read from the existing timeline route one day at a time (new, not in the old panel) | — (new) | pending | ✓ `web-pets` (no 3M range) |
| pets | 15 cats per box: "N of 15 cats on this box", a full box cannot be picked when adding, "Add a pet" disabled with a tooltip when every box is full, the server's `too_many_pets` refusal and an import's "device full" results shown in words (new, not in the old panel) | — (new) | 1c41030 | n/a |
| provision | Web Bluetooth provisioning, with the secure-context / URL / port 80 warnings | provision.js | fd3704c | ✓ `web-provision` |
| provision | Protocol in TypeScript with the same test vectors as the old tests, plus CRC `{"key":110}` seq 0 → `0x3234` | provision.js, test_provision_js.py | fd3704c | n/a |
| log | Live log: cap 600 lines, hide heartbeats, autoscroll, copy and download | log.js | b6c372c | ✓ `web-logs` |
| log | Device logs viewer with grep and download (download needs step-up) | log.js | b6c372c | ✓ `web-logs` |
| capture | Capture list, read the tail, download (step-up), delete; secret warning | capture.js | b6c372c | ✓ `web-capture` |
| patchers | Status per device, apply/remove with step-up, live progress from the stream | patchers.js | a456137 | ✓ `web-patchers` |
| setup | Settings and guards, upstream and DNS, status counters (Theme and Sign out now live on this screen) | setup.js | bcf3653, pending | ✓ `web-server` |
| setup | Blocked table (masked; reveal with step-up) and retention | setup.js | bcf3653 | ✓ `web-server` |

## Known gaps (not blocking parity with the legacy panel)

The legacy panel had none of these; the artboards show them. Each needs data
the API does not provide yet:

- Devices and Timeline day strips: no fountain "reporting" history (the band is
  drawn from the last report only) and Timeline has no planned meals.
- Pets: the weight chart has 1W and 2W but no 3M (there is no history route; it
  reads 14 timeline days), and there is no per-pet "samples / last seen".
- Log: no "Last hour" chart; the hub has kinds, not log levels.
- Capture: no per-file "started" or "device".
- Keyboard: the timeline filter chips and the Appearance chips are one Tab stop,
  moved through with the arrow keys (a toolbar), where each chip used to be its
  own Tab stop.
- Client tokens: the list is a table with a Phone column, as the setup tables are.

## Deliberate deviations from the web v3 artboards

Checked on 2026-10-31; each keeps existing behaviour or avoids claiming what the
server does not know.

- Frame and Settings say "TLS", not "TLS pinned": a browser cannot see pinning.
- Dialogs are centred vertically; the artboards place them near the top. In dark
  mode the backdrop is black at 55 %, as the artboards draw no dark dialog.
- Device pages are views of the Home route (`?device=…&view=live|schedules`),
  not routes of their own.
- Feeding schedule: the meal editor keeps a working copy and Save; its portions
  are number fields, not steppers. Feeder portions are shown, not grams (grams
  per portion are unknown), and past meals read "Past" (no fed/missed data).
- Fountain offline: "Open its log" instead of "Retry connection" (no such call).
- Timeline: the video keeps the whole fisheye frame (`object-contain`); the
  "day in figures" panel is replaced by the kind chips' counts.
- Logs: both cards stay visible, without the "Server, live / Device logs"
  switch, the "Errors only" chip (no levels) or Pause (Auto-scroll covers it).
- Settings: the server card's second figure is "Blocked" (there is no needs-you
  count for the server); retention rows stay editable fields.
- Capture: Download and Delete act on the selected file; there is no "Delete all".
- Add a device: three steps, not four, and no drawing before the device is known.
- Sign-in and first run: the repeat-password field stays; the meter measures
  length against the server's minimum and does not judge strength.
