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
- **Design:** ticked when the screen matches its artboard (`docs/design/`) at
  1440×1000 and 390×844 in layout, hierarchy, spacing and colour. Rows with no
  screen of their own (a background call) carry `n/a`.

Sources: the router (every `/api` operation in `packages/contracts/openapi.yaml`,
which the contract test keeps equal to the router) and the old panel's calls
(`git grep -oE "api\(['\`][^'\`]*" c050ad0 -- 'services/api/src/my_petkit/web/static/js/*.js'`); the UI checklist is the
legacy panel ledger's §11.1. Talk has no web client in the old panel and gets none here.

## Routes

| Feature | Route | operationId | Old panel source | Done (commit) | Design |
|---|---|---|---|---|---|
| auth | `POST /api/auth/login` | `authLogin` | — | bf3a909 | ✓ |
| auth | `POST /api/auth/logout` | `authLogout` | — | bf3a909 | n/a |
| auth | `POST /api/auth/media-url` | `authMediaUrl` | — | n/a: the session cookie authorises media; for clients that cannot send one | n/a |
| auth | `POST /api/auth/setup` | `authSetup` | — | bf3a909 | ✓ |
| auth | `POST /api/auth/step-up` | `authStepUp` | — | bf3a909 | ✓ |
| capture | `DELETE /api/capture/{name}` | `deleteCaptureFile` | capture.js, nav.js, setup.js | b6c372c | ✓ |
| capture | `GET /api/capture/{name}/download` | `downloadCaptureFile` | capture.js, nav.js, setup.js | b6c372c | ✓ |
| capture | `GET /api/capture/{name}` | `readCaptureFile` | capture.js, nav.js, setup.js | b6c372c | ✓ |
| capture | `GET /api/capture` | `listCaptureFiles` | capture.js, nav.js, setup.js | b6c372c | ✓ |
| devices | `DELETE /api/ble/{id}` | `deleteBleAccessory` | commands.js, devices.js | 28c8703 | ✓ |
| devices | `DELETE /api/devices/{id}/deferred-feed/{feed_id}` | `deleteDeferredFeed` | commands.js, delegate.js, devices.js | 415da52 | ✓ |
| devices | `DELETE /api/devices/{id}/sounds/{sound_id}` | `deleteDeviceSound` | commands.js, delegate.js, devices.js | 28c8703 | ✓ |
| devices | `DELETE /api/devices/{id}` | `deleteDevice` | commands.js, delegate.js, devices.js | 28c8703 | ✓ |
| devices | `GET /api/ble` | `listBleAccessories` | commands.js, devices.js | 28c8703 | ✓ |
| devices | `GET /api/devices/{id}/ai` | `getDeviceAi` | commands.js, delegate.js, devices.js | 28c8703 | ✓ |
| devices | `GET /api/devices/{id}/capabilities` | `getDeviceCapabilities` | commands.js, delegate.js, devices.js | 28c8703 | ✓ |
| devices | `GET /api/devices/{id}/deferred-feed` | `listDeferredFeeds` | commands.js, delegate.js, devices.js | 415da52 | ✓ |
| devices | `GET /api/devices/{id}/logs` | `getDeviceLogSettings` | commands.js, delegate.js, devices.js | 28c8703 | ✓ |
| devices | `GET /api/devices/{id}/sounds` | `listDeviceSounds` | commands.js, delegate.js, devices.js | 28c8703 | ✓ |
| devices | `GET /api/devices/{id}/timezone` | `getDeviceTimezone` | commands.js, delegate.js, devices.js | 28c8703 | ✓ |
| devices | `GET /api/devices/{id}` | `getDevice` | commands.js, delegate.js, devices.js | 28c8703 | ✓ |
| devices | `GET /api/devices` | `listDevices` | commands.js, delegate.js, devices.js | 28c8703 | ✓ |
| devices | `POST /api/ble/import` | `importBleAccessories` | devices.js, pets.js | 28c8703 | ✓ |
| devices | `POST /api/ble/{id}/command` | `sendBleCommand` | commands.js, devices.js | 28c8703 | ✓ |
| devices | `POST /api/ble/{id}/poll` | `pollBleAccessory` | commands.js, devices.js | 28c8703 | ✓ |
| devices | `POST /api/ble` | `pairBleAccessory` | commands.js, devices.js | 28c8703 | ✓ |
| devices | `POST /api/devices/{id}/ai` | `setDeviceAi` | commands.js, delegate.js, devices.js | 28c8703 | ✓ |
| devices | `POST /api/devices/{id}/capabilities` | `setDeviceCapabilities` | commands.js, delegate.js, devices.js | 28c8703 | ✓ |
| devices | `POST /api/devices/{id}/command` | `sendDeviceCommand` | commands.js, delegate.js, devices.js | 28c8703 | ✓ |
| devices | `POST /api/devices/{id}/deferred-feed` | `addDeferredFeed` | commands.js, delegate.js, devices.js | 415da52 | ✓ |
| devices | `POST /api/devices/{id}/logs` | `setDeviceLogSettings` | commands.js, delegate.js, devices.js | 28c8703 | ✓ |
| devices | `POST /api/devices/{id}/schedule` | `saveDeviceSchedule` | commands.js, delegate.js, devices.js | 415da52 | ✓ |
| devices | `POST /api/devices/{id}/sounds/{sound_id}/play` | `playDeviceSound` | commands.js, delegate.js, devices.js | 28c8703 | ✓ |
| devices | `POST /api/devices/{id}/sounds/{sound_id}/select` | `selectDeviceSound` | commands.js, delegate.js, devices.js | 28c8703 | ✓ |
| devices | `POST /api/devices/{id}/sounds` | `uploadDeviceSound` | commands.js, delegate.js, devices.js | 28c8703 | ✓ |
| devices | `POST /api/devices/{id}/timezone` | `setDeviceTimezone` | commands.js, delegate.js, devices.js | 28c8703 | ✓ |
| log | `GET /api/devicelogs/{path}` | `readDeviceLog` | log.js | b6c372c | ✓ |
| log | `GET /api/devicelogs` | `listDeviceLogs` | log.js | b6c372c | ✓ |
| log | `GET /api/events` | `listHubEvents` | — | b6c372c | ✓ |
| patchers | `GET /api/devices/{id}/patcher` | `getDevicePatcherStatus` | commands.js, delegate.js, devices.js | a456137 | ✓ |
| patchers | `POST /api/devices/{id}/patcher` | `applyDevicePatcher` | commands.js, delegate.js, devices.js | a456137 | ✓ |
| pets | `DELETE /api/pets/{id}/faces/{face_id}` | `deletePetFace` | cropper.js, nav.js, pets.js | ebc9088 | ✓ |
| pets | `DELETE /api/pets/{id}` | `deletePet` | cropper.js, nav.js, pets.js | ebc9088 | ✓ |
| pets | `GET /api/pets/unbound` | `listUnboundPetRefs` | pets.js | ebc9088 | ✓ |
| pets | `GET /api/pets/{id}/faces/{face_id}/photo` | `getPetFacePhoto` | nav.js, pets.js, timeline.js | ebc9088 | ✓ |
| pets | `GET /api/pets/{id}/faces` | `listPetFaces` | cropper.js, nav.js, pets.js | n/a: faces come embedded in `GET /api/pets`, as in the legacy panel | n/a |
| pets | `GET /api/pets/{id}` | `getPet` | cropper.js, nav.js, pets.js | ebc9088 | ✓ |
| pets | `GET /api/pets` | `listPets` | cropper.js, nav.js, pets.js | ebc9088 | ✓ |
| pets | `POST /api/pets/import` | `importPetsFromPetkit` | devices.js, pets.js | ebc9088 | ✓ |
| pets | `POST /api/pets/{id}/faces` | `addPetFace` | cropper.js, nav.js, pets.js | ebc9088 | ✓ |
| pets | `POST /api/pets/{id}` | `updatePet` | cropper.js, nav.js, pets.js | ebc9088 | ✓ |
| pets | `POST /api/pets` | `createPet` | cropper.js, nav.js, pets.js | ebc9088 | ✓ |
| setup | `GET /api/blocked` | `listBlockedAttempts` | provision.js, setup.js | bcf3653 | ✓ |
| setup | `GET /api/info` | `getServerInfo` | main.js, pets.js, provision.js | bcf3653 | ✓ |
| setup | `GET /api/retention` | `getRetention` | setup.js | bcf3653 | ✓ |
| setup | `GET /api/settings` | `getLiveSettings` | setup.js | bcf3653 | ✓ |
| setup | `POST /api/retention` | `updateRetention` | setup.js | bcf3653 | ✓ |
| setup | `POST /api/settings` | `updateLiveSettings` | setup.js | bcf3653 | ✓ |
| timeline | `GET /api/media/thumb/{path}` | `getMediaThumb` | media.js | abd0764 | ✓ |
| timeline | `GET /api/media/{path}` | `getMediaFile` | cropper.js, media.js, setup.js | abd0764 | ✓ |
| timeline | `GET /api/timeline/{id}` | `getTimelineEventDetail` | nav.js, timeline.js | abd0764 | ✓ |
| timeline | `GET /api/timeline` | `getTimeline` | nav.js, timeline.js | abd0764 | ✓ |
| tokens | `DELETE /api/auth/tokens/{id}` | `authRevokeToken` | — | a0f2e26 | ✓ |
| tokens | `GET /api/auth/tokens` | `authListTokens` | — | a0f2e26 | ✓ |
| tokens | `POST /api/auth/pairing/redeem` | `authPairingRedeem` | — | n/a: the iOS app's call | n/a |
| tokens | `POST /api/auth/pairing` | `authPairingCreate` | — | a0f2e26 | ✓ |
| log | `GET /api/ws` (WebSocket) | — | ws.js | b6c372c | ✓ |

## Behaviour

| Feature | Item | Old panel source | Done (commit) | Design |
|---|---|---|---|---|
| shell | Eight tabs: Devices, Timeline, AI/Pets, Provision, Log, Capture, Patchers, Setup | nav.js, index.html | bf3a909 | ✓ |
| shell | Works under any mount point (Ingress prefix, `/app/`): relative URLs, hash routing | core.js `BASE` | bf3a909, 5970fb0 | n/a |
| shell | "This page is out of date" banner when `/api/info` names a newer build | main.js `checkPageIsCurrent` | bf3a909 | ✓ |
| shell | Live indicator for the event stream; reconnect backoff 2 → 30 s | ws.js | bf3a909 | ✓ |
| shell | Every string from a device rendered as text only; no inline handlers or styles (CSP) | core.js `esc` | bf3a909 | n/a |
| shell | Dark mode: System, Light, Dark; set before the first paint (new, not in the old panel) | — | 306e7d2 | ✓ |
| shell | Accessibility: tablist roles, real `disabled`, focus ring, dialogs trap focus | index.html | bf3a909 | n/a |
| auth | Sign in; first run with the setup token from the log | auth.js | bf3a909 | ✓ |
| auth | Step-up prompt on `step_up_required`, then the request is replayed | core.js `api`, auth.js | bf3a909 | ✓ |
| tokens | Pair the iOS app: pairing code + QR; list and revoke client tokens | — | a0f2e26 | ✓ |
| devices | One collapsible panel per device, open state remembered; accessories as their own panels | devices.js | 28c8703 | ✓ |
| devices | No repaint while the user is editing a control (`PENDING_EDITS`) | devices.js | 28c8703 | n/a |
| devices | Entity table and controls: switch, number, select, time, button, text, event, camera, image | entities.js, commands.js | 28c8703 | ✓ |
| devices | Values formatted as Home Assistant formats them | format.js | 28c8703 | n/a |
| devices | Commands: confirm before running; destructive actions last | commands.js | 28c8703 | ✓ |
| devices | Copy stream URL | devices.js | 28c8703 | ✓ |
| devices | Deferred feed (time in the device's zone) | schedules.js | 415da52 | ✓ |
| devices | Sounds: upload (≤ 2 MB, ≤ 10), list, delete, play, select | devices.js | 28c8703 | ✓ |
| devices | Schedule editors: ranges, weekly, points, feed | schedules.js | 415da52 | ✓ |
| devices | Timezone, capabilities, AI and log-upload toggles | devices.js | 28c8703 | ✓ |
| devices | BLE accessories: pair, unpair, command, poll, import from cloud | devices.js | 28c8703 | ✓ |
| devices | Household day strip, positions in the device's time zone | — (new) | 28c8703 | ✓ |
| devices | Force continue on a litter box paused for a cat nearby: offered only when every guard passes, password then confirm with the guard checklist, refusal shown in the block (new, not in the old panel) | — (new) | pending | n/a: no web artboard; copy from `ios-device-t6-paused` |
| devices | T6 auto-pack rule (experimental): on/off with a confirmation, trigger, threshold, quiet hours, and the server's status line (new, not in the old panel) | — (new) | pending | n/a: no web artboard |
| timeline | Day picker, kind chips with counts before filtering, device and pet filters | timeline.js | abd0764 | ✓ |
| timeline | Visit cards with sub-events, lazy video, waste/health gallery, "assembling…" | timeline.js, media.js | abd0764 | ✓ |
| timeline | Debug expander with the raw event | timeline.js | abd0764 | ✓ |
| pets | Pets CRUD, rename, faces with the 224² cropper and its rules | pets.js, cropper.js | ebc9088 | ✓ |
| pets | Bind an unbound reference; import pets from the cloud | pets.js | ebc9088 | ✓ |
| provision | Web Bluetooth provisioning, with the secure-context / URL / port 80 warnings | provision.js | fd3704c | ✓ |
| provision | Protocol in TypeScript with the same test vectors as the old tests, plus CRC `{"key":110}` seq 0 → `0x3234` | provision.js, test_provision_js.py | fd3704c | n/a |
| log | Live log: cap 600 lines, hide heartbeats, autoscroll, copy and download | log.js | b6c372c | ✓ |
| log | Device logs viewer with grep and download (download needs step-up) | log.js | b6c372c | ✓ |
| capture | Capture list, read the tail, download (step-up), delete; secret warning | capture.js | b6c372c | ✓ |
| patchers | Status per device, apply/remove with step-up, live progress from the stream | patchers.js | a456137 | ✓ |
| setup | Settings and guards, upstream and DNS, status counters | setup.js | bcf3653 | ✓ |
| setup | Blocked table (masked; reveal with step-up) and retention | setup.js | bcf3653 | ✓ |

## Known gaps (not blocking parity with the legacy panel)

The legacy panel had none of these; the artboards show them. Each needs data
the API does not provide yet:

- Devices and Timeline day strips: no fountain "reporting" history (the band is
  drawn from the last report only) and Timeline has no planned meals.
- Pets: no weight-over-14-days chart and no per-pet "samples / last seen".
- Log: no "Last hour" chart; the hub has kinds, not log levels.
- Capture: no per-file "started" or "device".
- Keyboard: the timeline filter chips and the Appearance chips are one Tab stop,
  moved through with the arrow keys (a toolbar), where each chip used to be its
  own Tab stop.
- Client tokens: the list is a table with a Phone column, as the setup tables are.
