# iOS app parity

What the iOS app covers, against the user-plane contract and the iOS
checklist of the panel ledger (§11.2). A row is ticked only when it works in
`apps/ios` and its commit is named.

- **Done (commit):** the commit that made it work. `n/a` marks a route the app
  deliberately does not call, with the reason.
- **Design:** ✓ when the snapshot (`MyPetkitTests/__Snapshots__/ScreenSnapshotTests/`,
  iPhone 16 size, light and dark) was compared by eye with
  `docs/design/screenshots/<artboard>.webp` for layout, hierarchy, spacing and
  colour. "rendered" means the snapshot exists but the comparison is still to do.

Provisioning (phase 09), live view and talk (phase 10), force continue and
auto-pack (phase 13), and the pet weight/matching work (phase 14) are not in
this table.

## Routes

| Feature | Route | operationId | iOS screen | Done (commit) |
|---|---|---|---|---|
| auth | `DELETE /api/auth/tokens/{id}` | `authRevokeToken` | Server › revoke; Sign out | 64097d1 |
| auth | `GET /api/auth/tokens` | `authListTokens` | Server › Signed-in clients | 64097d1 |
| auth | `POST /api/auth/login` | `authLogin` | Onboarding › sign in to pair | ecc6611 |
| auth | `POST /api/auth/logout` | `authLogout` | Onboarding (ends the sign-in session) | ecc6611 |
| auth | `POST /api/auth/media-url` | `authMediaUrl` | ServerSession.signedMediaURL | ecc6611 |
| auth | `POST /api/auth/pairing/redeem` | `authPairingRedeem` | Onboarding | ecc6611 |
| auth | `POST /api/auth/pairing` | `authPairingCreate` | Onboarding; Server › Pair another phone | ecc6611 |
| auth | `POST /api/auth/setup` | `authSetup` | Onboarding › first run | ecc6611 |
| auth | `POST /api/auth/step-up` | `authStepUp` | StepUpScreen | ecc6611 |
| ble | `DELETE /api/ble/{id}` | `deleteBleAccessory` | Accessory detail › Unpair | 3df5495 |
| ble | `GET /api/ble` | `listBleAccessories` | Device detail › Bluetooth accessories; Home cards | 3df5495 |
| ble | `POST /api/ble/import` | `importBleAccessories` | Import from cloud sheet | 3df5495 |
| ble | `POST /api/ble/{id}/command` | `sendBleCommand` | Accessory detail | 3df5495 |
| ble | `POST /api/ble/{id}/poll` | `pollBleAccessory` | Accessory detail › Read now | 3df5495 |
| ble | `POST /api/ble` | `pairBleAccessory` | Pair sheet; K3 link | 3df5495 |
| devices | `DELETE /api/devices/{id}` | `deleteDevice` | Device detail › Remove | dec52fb |
| devices | `GET /api/devices/{id}/ai` | `getDeviceAi` | Device detail › On-device AI | dec52fb |
| devices | `GET /api/devices/{id}/capabilities` | `getDeviceCapabilities` | Device detail › media uploads | dec52fb |
| devices | `GET /api/devices/{id}/logs` | `getDeviceLogSettings` | Device detail › Debug logs | dec52fb |
| devices | `GET /api/devices/{id}/timezone` | `getDeviceTimezone` | Device detail, Schedules | dec52fb |
| devices | `GET /api/devices/{id}` | `getDevice` | Device detail | dec52fb |
| devices | `GET /api/devices` | `listDevices` | Home | dec52fb |
| devices | `POST /api/devices/{id}/ai` | `setDeviceAi` | Device detail › On-device AI | dec52fb |
| devices | `POST /api/devices/{id}/capabilities` | `setDeviceCapabilities` | Device detail › media uploads | dec52fb |
| devices | `POST /api/devices/{id}/command` | `sendDeviceCommand` | Device detail, Sounds settings | dec52fb |
| devices | `POST /api/devices/{id}/logs` | `setDeviceLogSettings` | Device detail › Debug logs | dec52fb |
| devices | `POST /api/devices/{id}/timezone` | `setDeviceTimezone` | Device detail › Timezone | dec52fb |
| logs | `DELETE /api/capture/{name}` | `deleteCaptureFile` | Capture | 64097d1 |
| logs | `GET /api/capture/{name}/download` | `downloadCaptureFile` | Capture (R3) | 64097d1 |
| logs | `GET /api/capture/{name}` | `readCaptureFile` | Capture | 64097d1 |
| logs | `GET /api/capture` | `listCaptureFiles` | Capture | 64097d1 |
| logs | `GET /api/devicelogs/{path}` | `readDeviceLog` | Logs › Device log file | 64097d1 |
| logs | `GET /api/devicelogs` | `listDeviceLogs` | Logs › Device logs | 64097d1 |
| logs | `GET /api/events` | `listHubEvents` | Logs › Server (catch-up) | 64097d1 |
| media | `GET /api/media/thumb/{path}` | `getMediaThumb` | Timeline rows (signed/bearer image) | 9162169 |
| media | `GET /api/media/{path}` | `getMediaFile` | Timeline player (signed URL, pinned loader) | 9162169 |
| patchers | `GET /api/devices/{id}/patcher` | `getDevicePatcherStatus` | Patchers | 64097d1 |
| patchers | `POST /api/devices/{id}/patcher` | `applyDevicePatcher` | Patchers (R3) | 64097d1 |
| pets | `DELETE /api/pets/{id}/faces/{face_id}` | `deletePetFace` | Pets › face grid | 9162169 |
| pets | `DELETE /api/pets/{id}` | `deletePet` | Pet edit › Remove | 9162169 |
| pets | `GET /api/pets/unbound` | `listUnboundPetRefs` | Pets › unbound refs | 9162169 |
| pets | `GET /api/pets/{id}/faces/{face_id}/photo` | `getPetFacePhoto` | PetPhoto | 9162169 |
| pets | `GET /api/pets/{id}/faces` | `listPetFaces` | — | n/a: faces arrive with `listPets`/`getPet` |
| pets | `GET /api/pets/{id}` | `getPet` | Pets › bind | 9162169 |
| pets | `GET /api/pets` | `listPets` | Pets, Home, Timeline chips | 9162169 |
| pets | `POST /api/pets/import` | `importPetsFromPetkit` | Pets › import | 9162169 |
| pets | `POST /api/pets/{id}/faces` | `addPetFace` | Pets › add face (224² JPEG) | 9162169 |
| pets | `POST /api/pets/{id}` | `updatePet` | Pets › rename, bind | 9162169 |
| pets | `POST /api/pets` | `createPet` | Pets › add | 9162169 |
| schedules | `DELETE /api/devices/{id}/deferred-feed/{feed_id}` | `deleteDeferredFeed` | Schedules › One-off | 6e65187 |
| schedules | `GET /api/devices/{id}/deferred-feed` | `listDeferredFeeds` | Schedules › One-off | 6e65187 |
| schedules | `POST /api/devices/{id}/deferred-feed` | `addDeferredFeed` | Schedules › One-off | 6e65187 |
| schedules | `POST /api/devices/{id}/schedule` | `saveDeviceSchedule` | Schedules | 6e65187 |
| setup | `GET /api/blocked` | `listBlockedAttempts` | Server setup › Blocked | 64097d1 |
| setup | `GET /api/info` | `getServerInfo` | Server tab, Server setup | 64097d1 |
| setup | `GET /api/retention` | `getRetention` | Server setup › Keep | 64097d1 |
| setup | `GET /api/settings` | `getLiveSettings` | Server setup | 64097d1 |
| setup | `POST /api/retention` | `updateRetention` | Server setup › Keep | 64097d1 |
| setup | `POST /api/settings` | `updateLiveSettings` | Server setup (proxy_*/capture via step-up) | 64097d1 |
| sounds | `DELETE /api/devices/{id}/sounds/{sound_id}` | `deleteDeviceSound` | Sounds | c130c6b |
| sounds | `GET /api/devices/{id}/sounds` | `listDeviceSounds` | Sounds | c130c6b |
| sounds | `POST /api/devices/{id}/sounds/{sound_id}/play` | `playDeviceSound` | Sounds | c130c6b |
| sounds | `POST /api/devices/{id}/sounds/{sound_id}/select` | `selectDeviceSound` | Sounds | c130c6b |
| sounds | `POST /api/devices/{id}/sounds` | `uploadDeviceSound` | Sounds | c130c6b |
| timeline | `GET /api/timeline/{id}` | `getTimelineEventDetail` | Timeline › detail sheet | 9162169 |
| timeline | `GET /api/timeline` | `getTimeline` | Timeline, Home, Pets (visits per day) | 9162169 |

## Screens

| Artboard | Screen | Done (commit) | Design |
|---|---|---|---|
| `ios-pairing` | Onboarding: scan, server found, address by hand with fingerprint check | ecc6611, c94dd5d | ✓ |
| `ios-first-run` | Onboarding: setup code and password (the API has no admin name, so none is asked) | ecc6611, c94dd5d | rendered via flow test only |
| `ios-step-up` | Shared `StepUpScreen`; shows the wait from `Retry-After`, not a try count the API does not give | ecc6611 | not snapshotted |
| `ios-states` | Empty, loading, error in block, zero and missing, server unreachable | dec52fb | rendered |
| `ios-devices` | Home | dec52fb | ✓ |
| `ios-devices-dark` | Home in dark mode (every snapshot also renders dark) | dec52fb | ✓ |
| `ios-device-t6` | Litter box detail | dec52fb | ✓ |
| `ios-device-t6-paused` | Paused state (the force-continue action is phase 13) | dec52fb | rendered (preview only) |
| `ios-device-feeder` | Feeder detail; sprays and others reuse it | dec52fb | rendered |
| `ios-device-fountain` | Fountain detail, offline variant | dec52fb | rendered |
| `ios-schedules` | Schedules, four kinds, one-off feeds | 6e65187 | ✓ |
| `ios-sounds` | Sounds | c130c6b | rendered |
| `ios-ble-pair` | Pair an accessory | 3df5495 | ✓ |
| `ios-timeline` | Timeline | 9162169 | ✓ |
| `ios-pets` | Pets | 9162169 | ✓ |
| `ios-pet-edit` | Name, face photos per device, remove only (rest is phase 14) | 9162169 | not snapshotted |
| `ios-settings` | Server tab | 64097d1 | ✓ |
| `ios-logs` | Logs: server and device | 64097d1 | rendered |
| `ios-server-setup` | Server setup | 64097d1 | rendered |
| `ios-patcher` | Patchers | 64097d1 | ✓ |
| `ios-capture` | Capture | 64097d1 | not snapshotted |

## Ledger §11.2 checklist (phase 08 rows)

- [x] Sign-in with a Keychain token, configurable base URL, pinned self-signed TLS for IP and `.local`
  addresses, system trust for public names (`SPIKE.md`) — ecc6611
- [x] Devices: list, detail, entity controls, actions with confirm, timezone, online/MQTT/heartbeat — dec52fb
- [x] BLE accessories: list — 3df5495
- [x] BLE accessories: pair — 3df5495
- [x] BLE accessories: import from cloud — 3df5495
- [x] BLE accessories: K3 link (unlink only by unpairing: the API has no unlink) — 3df5495
- [x] BLE accessories: unpair — 3df5495
- [x] BLE accessories: command and poll, 409 shown as its reason — 3df5495
- [x] Schedules: four kinds, native editor, deferred feed — 6e65187
- [x] Timeline with media (AVPlayer over the pinned loader with Range), thumbs, galleries, pet and device filters — 9162169
- [x] Pets: camera or library, crop 224², raw JPEG upload, rename, bind, import — 9162169
- [x] Live log over the WebSocket in the foreground, device logs — 64097d1
- [x] Settings: proxy, capture and guards through step-up, retention — 64097d1
- [x] Patchers: firmware warning, step-up, progress from `kind="patcher"`, SSH key, the reason when unreachable — 64097d1
- [x] Media paths resolved against the paired base URL — ecc6611
- [ ] Client `tz` for the timeline: sent, but the server ignores it and cuts days in its own zone (open question)

## Known gaps (API has no data for them)

- Pet weight history and visits per day as one call (visits per day uses seven `getTimeline` counts calls).
- Water and hopper fill percentages (drawings show full, low or empty).
- Meal names, grams per meal and "fed" state per meal on the schedule.
- A list of built-in sounds (the app shows the device sound, id -1).
- Space used per retention kind and free space on the device for patching.
- A "need you" count on the server (the app counts offline devices).

## Contract types the generated Swift client cannot decode

These operations are read as plain JSON over the same trusted session until
the contract is corrected and regenerated:

- `DeviceEntity.option_values` is declared object-or-array-or-null; the server sends arrays.
- `TimelineSubEvent.media` (`anyOf [schema, null]`) is dropped by the generator.
- `pet_ref` and `parent_event` are typed the opposite way to what the server sends.
- `LogsHubEvent.device_id` is typed integer; the contract allows a string.
- `{"timezone": null}` (clear the override) is dropped by the generated request.
