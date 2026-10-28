"""The user plane: one package per feature, each with its own `routes.py`.

This is the operator-facing side of my-petkit, next to (but separate from)
the device-facing API in `http/`. It covers real-device bring-up and day-to-day
control:

* **Devices** — one expandable panel per device from the live `DeviceRegistry`, per-device readable state
  resolved through the same dotted `value_path` HA uses, editable controls and a
  manual command sender (`api_devices`, `api_device_detail`, `api_send_command`).
* **Log** — the in-memory `EventHub` ring of HTTP+MQTT traffic, polled
  (`api_events`) or streamed over a WebSocket (`api_ws`).
* **Timeline** — visit sessions grouped at query time out of the `EventStore`,
  with their media (`api_timeline`).
* **Media** — files and thumbnails out of the friendly media tree
  (`api_media_file`, `api_media_thumb`) and the retention caps (`api_retention`).
* **Settings** — the runtime settings that can be flipped without a restart
  (`api_settings`), plus per-device capability/AI toggles.
* **Patchers** — apply/remove the on-device binary patches (`api_patcher_*`),
  which run as long-lived background tasks and report progress via the hub.
* **Pets** — CRUD and reference face photos for on-device recognition
  (`api_pets_*`).
* **Provisioning** — the Web Bluetooth page is pure frontend; it talks to the
  device directly from the browser, so there is no route for it here.

Which package owns what
-----------------------
Features never import one another (`.importlinter`). What more than one needs
lives in `shared/`: `panel_request.py` (the app-config readers, the
`{id}`/JSON-body/`?limit=` parsers, `_deliver`, the pet lookups),
`live_settings.py`, `media_slots.py`, `background_tasks.py`, `appkeys.py`.

`setup/`        the live-editable runtime settings, `/api/info`, the blocked-
                attempt log and the retention caps
`devices/`      the device list, the device detail and everything it inlines,
                the manual command sender, the per-device toggles
`schedules/`    the schedule editors' one write endpoint and its validators
`media/`        serving the friendly media tree, thumbnails, and the role ->
                slot mapping the Timeline renders from
`timeline/`     the grouped day view and one event's stored detail
`pets/`         pet CRUD, reference face photos, and the cloud import
`ble/`          the BLE accessories: pairing, commands, cloud import
`patchers/`     applying and removing the on-device binary patches
`logs/`         the live event ring and WebSocket, the capture browser and the
                uploaded device logs

The route table is NOT here. `web/panel.py` registers all of it in one
function, because three of the registrations are ordering-critical (the media
thumb route, `/api/pets/unbound`, `/api/devicelogs`) and that is only checkable
while they sit together. Nothing here imports `web/` at all; what the panel
owns and a feature needs (the asset hash, the background-task set) reaches it
through `shared/`.

The panel's JS consumes the exact key names these handlers emit, so response
shapes are a contract: adding a key is safe, renaming or removing one is not.
"""
