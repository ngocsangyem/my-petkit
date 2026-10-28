# Web app parity with the legacy panel

The legacy panel (`services/api/src/my_petkit/web/templates`, `web/static/js`,
`web/static/styles.css`) is deleted, and `/` switched to this app, only when
every row below is ticked.

- **Done (commit):** the short hash of the commit that made it work in `apps/web`,
  checked against a running API.
- **Design:** ticked when the screen matches its artboard (`docs/design/`) at
  1440×1000 and 390×844 in layout, hierarchy, spacing and colour. Rows with no
  screen of their own (a background call) carry `n/a`.

Sources: the router (every `/api` operation in `packages/contracts/openapi.yaml`,
which the contract test keeps equal to the router) and the old panel's calls
(`grep -oE "api\(['\`][^'\`]*" web/static/js/*.js`); the UI checklist is the
legacy panel ledger's §11.1. Talk has no web client in the old panel and gets none here.

## Routes

| Feature | Route | operationId | Old panel source | Done (commit) | Design |
|---|---|---|---|---|---|
| auth | `POST /api/auth/login` | `authLogin` | — |  |  |
| auth | `POST /api/auth/logout` | `authLogout` | — |  |  |
| auth | `POST /api/auth/media-url` | `authMediaUrl` | — |  |  |
| auth | `POST /api/auth/setup` | `authSetup` | — |  |  |
| auth | `POST /api/auth/step-up` | `authStepUp` | — |  |  |
| capture | `DELETE /api/capture/{name}` | `deleteCaptureFile` | capture.js, nav.js, setup.js |  |  |
| capture | `GET /api/capture/{name}/download` | `downloadCaptureFile` | capture.js, nav.js, setup.js |  |  |
| capture | `GET /api/capture/{name}` | `readCaptureFile` | capture.js, nav.js, setup.js |  |  |
| capture | `GET /api/capture` | `listCaptureFiles` | capture.js, nav.js, setup.js |  |  |
| devices | `DELETE /api/ble/{id}` | `deleteBleAccessory` | commands.js, devices.js |  |  |
| devices | `DELETE /api/devices/{id}/deferred-feed/{feed_id}` | `deleteDeferredFeed` | commands.js, delegate.js, devices.js |  |  |
| devices | `DELETE /api/devices/{id}/sounds/{sound_id}` | `deleteDeviceSound` | commands.js, delegate.js, devices.js |  |  |
| devices | `DELETE /api/devices/{id}` | `deleteDevice` | commands.js, delegate.js, devices.js |  |  |
| devices | `GET /api/ble` | `listBleAccessories` | commands.js, devices.js |  |  |
| devices | `GET /api/devices/{id}/ai` | `getDeviceAi` | commands.js, delegate.js, devices.js |  |  |
| devices | `GET /api/devices/{id}/capabilities` | `getDeviceCapabilities` | commands.js, delegate.js, devices.js |  |  |
| devices | `GET /api/devices/{id}/deferred-feed` | `listDeferredFeeds` | commands.js, delegate.js, devices.js |  |  |
| devices | `GET /api/devices/{id}/logs` | `getDeviceLogSettings` | commands.js, delegate.js, devices.js |  |  |
| devices | `GET /api/devices/{id}/sounds` | `listDeviceSounds` | commands.js, delegate.js, devices.js |  |  |
| devices | `GET /api/devices/{id}/timezone` | `getDeviceTimezone` | commands.js, delegate.js, devices.js |  |  |
| devices | `GET /api/devices/{id}` | `getDevice` | commands.js, delegate.js, devices.js |  |  |
| devices | `GET /api/devices` | `listDevices` | commands.js, delegate.js, devices.js |  |  |
| devices | `POST /api/ble/import` | `importBleAccessories` | devices.js, pets.js |  |  |
| devices | `POST /api/ble/{id}/command` | `sendBleCommand` | commands.js, devices.js |  |  |
| devices | `POST /api/ble/{id}/poll` | `pollBleAccessory` | commands.js, devices.js |  |  |
| devices | `POST /api/ble` | `pairBleAccessory` | commands.js, devices.js |  |  |
| devices | `POST /api/devices/{id}/ai` | `setDeviceAi` | commands.js, delegate.js, devices.js |  |  |
| devices | `POST /api/devices/{id}/capabilities` | `setDeviceCapabilities` | commands.js, delegate.js, devices.js |  |  |
| devices | `POST /api/devices/{id}/command` | `sendDeviceCommand` | commands.js, delegate.js, devices.js |  |  |
| devices | `POST /api/devices/{id}/deferred-feed` | `addDeferredFeed` | commands.js, delegate.js, devices.js |  |  |
| devices | `POST /api/devices/{id}/logs` | `setDeviceLogSettings` | commands.js, delegate.js, devices.js |  |  |
| devices | `POST /api/devices/{id}/schedule` | `saveDeviceSchedule` | commands.js, delegate.js, devices.js |  |  |
| devices | `POST /api/devices/{id}/sounds/{sound_id}/play` | `playDeviceSound` | commands.js, delegate.js, devices.js |  |  |
| devices | `POST /api/devices/{id}/sounds/{sound_id}/select` | `selectDeviceSound` | commands.js, delegate.js, devices.js |  |  |
| devices | `POST /api/devices/{id}/sounds` | `uploadDeviceSound` | commands.js, delegate.js, devices.js |  |  |
| devices | `POST /api/devices/{id}/timezone` | `setDeviceTimezone` | commands.js, delegate.js, devices.js |  |  |
| log | `GET /api/devicelogs/{path}` | `readDeviceLog` | log.js |  |  |
| log | `GET /api/devicelogs` | `listDeviceLogs` | log.js |  |  |
| log | `GET /api/events` | `listHubEvents` | — |  |  |
| patchers | `GET /api/devices/{id}/patcher` | `getDevicePatcherStatus` | commands.js, delegate.js, devices.js |  |  |
| patchers | `POST /api/devices/{id}/patcher` | `applyDevicePatcher` | commands.js, delegate.js, devices.js |  |  |
| pets | `DELETE /api/pets/{id}/faces/{face_id}` | `deletePetFace` | cropper.js, nav.js, pets.js |  |  |
| pets | `DELETE /api/pets/{id}` | `deletePet` | cropper.js, nav.js, pets.js |  |  |
| pets | `GET /api/pets/unbound` | `listUnboundPetRefs` | pets.js |  |  |
| pets | `GET /api/pets/{id}/faces/{face_id}/photo` | `getPetFacePhoto` | nav.js, pets.js, timeline.js |  |  |
| pets | `GET /api/pets/{id}/faces` | `listPetFaces` | cropper.js, nav.js, pets.js |  |  |
| pets | `GET /api/pets/{id}` | `getPet` | cropper.js, nav.js, pets.js |  |  |
| pets | `GET /api/pets` | `listPets` | cropper.js, nav.js, pets.js |  |  |
| pets | `POST /api/pets/import` | `importPetsFromPetkit` | devices.js, pets.js |  |  |
| pets | `POST /api/pets/{id}/faces` | `addPetFace` | cropper.js, nav.js, pets.js |  |  |
| pets | `POST /api/pets/{id}` | `updatePet` | cropper.js, nav.js, pets.js |  |  |
| pets | `POST /api/pets` | `createPet` | cropper.js, nav.js, pets.js |  |  |
| setup | `GET /api/blocked` | `listBlockedAttempts` | provision.js, setup.js |  |  |
| setup | `GET /api/info` | `getServerInfo` | main.js, pets.js, provision.js |  |  |
| setup | `GET /api/retention` | `getRetention` | setup.js |  |  |
| setup | `GET /api/settings` | `getLiveSettings` | setup.js |  |  |
| setup | `POST /api/retention` | `updateRetention` | setup.js |  |  |
| setup | `POST /api/settings` | `updateLiveSettings` | setup.js |  |  |
| timeline | `GET /api/media/thumb/{path}` | `getMediaThumb` | media.js |  |  |
| timeline | `GET /api/media/{path}` | `getMediaFile` | cropper.js, media.js, setup.js |  |  |
| timeline | `GET /api/timeline/{id}` | `getTimelineEventDetail` | nav.js, timeline.js |  |  |
| timeline | `GET /api/timeline` | `getTimeline` | nav.js, timeline.js |  |  |
| tokens | `DELETE /api/auth/tokens/{id}` | `authRevokeToken` | — |  |  |
| tokens | `GET /api/auth/tokens` | `authListTokens` | — |  |  |
| tokens | `POST /api/auth/pairing/redeem` | `authPairingRedeem` | — |  |  |
| tokens | `POST /api/auth/pairing` | `authPairingCreate` | — |  |  |
| log | `GET /api/ws` (WebSocket) | — | ws.js |  |  |

## Behaviour

| Feature | Item | Old panel source | Done (commit) | Design |
|---|---|---|---|---|
| shell | Eight tabs: Devices, Timeline, AI/Pets, Provision, Log, Capture, Patchers, Setup | nav.js, index.html |  |  |
| shell | Works under any mount point (Ingress prefix, `/app/`): relative URLs, hash routing | core.js `BASE` |  |  |
| shell | "This page is out of date" banner when `/api/info` names a newer build | main.js `checkPageIsCurrent` |  |  |
| shell | Live indicator for the event stream; reconnect backoff 2 → 30 s | ws.js |  |  |
| shell | Every string from a device rendered as text only; no inline handlers or styles (CSP) | core.js `esc` |  |  |
| shell | Accessibility: tablist roles, real `disabled`, focus ring, dialogs trap focus | index.html |  |  |
| auth | Sign in; first run with the setup token from the log | auth.js |  |  |
| auth | Step-up prompt on `step_up_required`, then the request is replayed | core.js `api`, auth.js |  |  |
| tokens | Pair the iOS app: pairing code + QR; list and revoke client tokens | — |  |  |
| devices | One collapsible panel per device, open state remembered; accessories as their own panels | devices.js |  |  |
| devices | No repaint while the user is editing a control (`PENDING_EDITS`) | devices.js |  |  |
| devices | Entity table and controls: switch, number, select, time, button, text, event, camera, image | entities.js, commands.js |  |  |
| devices | Values formatted as Home Assistant formats them | format.js |  |  |
| devices | Commands: confirm before running; destructive actions last | commands.js |  |  |
| devices | Copy stream URL | devices.js |  |  |
| devices | Deferred feed (time in the device's zone) | schedules.js |  |  |
| devices | Sounds: upload (≤ 2 MB, ≤ 10), list, delete, play, select | devices.js |  |  |
| devices | Schedule editors: ranges, weekly, points, feed | schedules.js |  |  |
| devices | Timezone, capabilities, AI and log-upload toggles | devices.js |  |  |
| devices | BLE accessories: pair, unpair, command, poll, import from cloud | devices.js |  |  |
| devices | Household day strip, positions in the device's time zone | — (new) |  |  |
| timeline | Day picker, kind chips with counts before filtering, device and pet filters | timeline.js |  |  |
| timeline | Visit cards with sub-events, lazy video, waste/health gallery, "assembling…" | timeline.js, media.js |  |  |
| timeline | Debug expander with the raw event | timeline.js |  |  |
| pets | Pets CRUD, rename, faces with the 224² cropper and its rules | pets.js, cropper.js |  |  |
| pets | Bind an unbound reference; import pets from the cloud | pets.js |  |  |
| provision | Web Bluetooth provisioning, with the secure-context / URL / port 80 warnings | provision.js |  |  |
| provision | Protocol in TypeScript with the same test vectors as the old tests, plus CRC `{"key":110}` seq 0 → `0x3234` | provision.js, test_provision_js.py |  |  |
| log | Live log: cap 600 lines, hide heartbeats, autoscroll, copy and download | log.js |  |  |
| log | Device logs viewer with grep and download (download needs step-up) | log.js |  |  |
| capture | Capture list, read the tail, download (step-up), delete; secret warning | capture.js |  |  |
| patchers | Status per device, apply/remove with step-up, live progress from the stream | patchers.js |  |  |
| setup | Settings and guards, upstream and DNS, status counters | setup.js |  |  |
| setup | Blocked table (masked; reveal with step-up) and retention | setup.js |  |  |
