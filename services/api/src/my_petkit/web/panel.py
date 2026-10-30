"""The add-on's own web panel: the application object and its route table.

This is the composition root. `create_panel_app` hangs every collaborator on
`app[...]` — the keys are listed in `shared/appkeys.py` — and registers every route
in one function; the handlers themselves live in `features/`, whose package
docstring carries the per-tab map of what the panel does.

The table stays whole because three of its registrations are ordering-critical
and say so inline. Distributed over ten modules, "registered before" stops being
a property anybody can check.

Serving
-------
`create_panel_app` builds one `web.Application` that main.py mounts twice: on
plain HTTP `web_port` (8099) — what Home Assistant Ingress proxies into the
sidebar — and over TLS on `user_port` with the install's self-signed
certificate. Every route declares a tier and every request but the static
shell needs a principal (`features/auth/`): Ingress is trusted only from the
Supervisor's own address on the Ingress port, and anything else — the TLS port,
or 8099 if it is mapped to the LAN — needs a token or a session. Caller-supplied
limits are still clamped and every path built from request input still goes
through `utils/paths.safe_join`.

Upstream once had a self-signed HTTPS site on 8098 that published this whole
API to the LAN with no authentication; it was removed there. The TLS site here
is not that: nothing on it answers without a token or session.

Frontend
--------
The web app (`apps/web`, a Vite build) is served at `/` by `web/spa.py`, and
the iOS app calls the same `/api/...` routes. Both consume the exact key names
the handlers in `features/` emit, and `packages/contracts/openapi.yaml` pins
them, so response shapes are a contract: adding a key is safe, renaming or
removing one is not.
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from aiohttp import web

from my_petkit.web.spa import add_spa_routes

from my_petkit.features.auth.middleware import auth_middleware
from my_petkit.features.auth.routes import (
    api_auth_login, api_auth_logout, api_auth_media_url, api_auth_pairing_create,
    api_auth_pairing_redeem, api_auth_setup, api_auth_step_up, api_auth_token_revoke,
    api_auth_tokens,
)
from my_petkit.features.auth.security_headers import apply_security_headers
from my_petkit.features.ble.routes import (
    api_ble_accessories, api_ble_command, api_ble_delete, api_ble_import, api_ble_poll,
)
from my_petkit.features.devices.routes import (
    api_ai_settings, api_capabilities, api_device_delete, api_device_detail,
    api_device_log_settings, api_timezone,
    api_devices, api_send_command,
)
from my_petkit.features.logs.routes import (
    api_capture_delete, api_capture_download, api_capture_list, api_capture_read,
    api_device_log_read, api_device_logs, api_events, api_ws,
)
from my_petkit.features.media.routes import api_media_file, api_media_thumb
from my_petkit.features.patchers.routes import api_patcher_apply, api_patcher_status
from my_petkit.features.pets.routes import (
    api_pet_detail, api_pet_face_detail, api_pet_face_photo, api_pet_faces,
    api_pets_import, api_pets_list_create, api_pets_unbound,
)
from my_petkit.features.schedules.routes import api_deferred_feed, api_save_schedule
from my_petkit.features.setup.routes import api_blocked, api_info, api_retention, api_settings
from my_petkit.features.sounds.routes import (
    api_sounds_delete, api_sounds_list, api_sounds_play,
    api_sounds_select, api_sounds_upload,
)
from my_petkit.features.live.routes import (
    api_live_hls_file,
    api_live_hls_master,
    api_live_info,
    api_live_mse,
    api_live_webrtc,
)
from my_petkit.features.talk.routes import api_talk
from my_petkit.features.timeline.routes import api_event_detail, api_timeline
from my_petkit.shared.background_tasks import (
    _spawn_background as _spawn_background,  # re-exported for callers of the old path
    cancel_background_tasks,
)
from my_petkit.shared.errors import error_middleware
from my_petkit.shared.appkeys import (
    AUTH, BACKGROUND_TASKS, BLE_REGISTRY, BRIDGE, CFG, EVENT_STORE, HA_PUBLISHER, HUB,
    LIVE_CONFIG, PET_REGISTRY, REGISTRY, RETENTION_CONFIG,
)

if TYPE_CHECKING:
    from my_petkit.ai.pets import PetRegistry
    from my_petkit.features.auth.service import AuthService
    from my_petkit.devices.ble import BLERegistry
    from my_petkit.devices.registry import DeviceRegistry
    from my_petkit.events.store import EventStore
    from my_petkit.ha.publisher import HAPublisher
    from my_petkit.media.retention import RetentionConfig
    from my_petkit.mqtt.bridge import MQTTBridge
    from my_petkit.web.hub import EventHub

log = logging.getLogger(__name__)


def create_panel_app(registry: DeviceRegistry, ble_registry: BLERegistry | None,
                     hub: EventHub, panel_config: dict[str, Any],
                     bridge: MQTTBridge | None = None,
                     live_config: dict[str, Any] | None = None,
                     event_store: EventStore | None = None,
                     retention_config: RetentionConfig | None = None,
                     pet_registry: PetRegistry | None = None,
                     ha_publisher: HAPublisher | None = None,
                     auth: AuthService | None = None) -> web.Application:
    """Build the panel application, wiring every collaborator into `app[...]`.

    Everything after `panel_config` is optional so tests (and a degraded
    runtime) can build a panel without the full stack; the handlers that need a
    missing collaborator answer HTTP 400 rather than raising.

    Args:
        panel_config: Static configuration read per request (`api_url`,
            `media_root`, `capture_dir`, `data_dir`, `settings_path`, ...).
        live_config: The SAME dict the device-facing HTTP handlers read, so a
            settings change from the panel takes effect with no restart.
        auth: The user plane's `AuthService`. Without one every route but the
            static shell is refused (`features/auth/middleware.py`): there is
            no unauthenticated mode to fall back to.
    """
    # A pet's reference face photo is uploaded as a raw body, and a phone
    # camera produces 2-8 MB of JPEG. aiohttp's default cap is 1 MiB, which
    # rejected every real photo with a 413 whose text/plain body the panel then
    # failed to parse as JSON — so the button appeared to do nothing at all.
    # Same reasoning as http/bucket.py's cap, one size down: nothing the panel
    # accepts is media-sized.
    #
    # Middlewares, outermost first: every error leaves as the envelope
    # (`shared/errors.py`), and nothing reaches a handler without passing its
    # route's tier (`features/auth/middleware.py`).
    app = web.Application(client_max_size=16 * 1024 * 1024,  # 16MB
                          middlewares=[error_middleware, auth_middleware])
    app[REGISTRY] = registry
    app[BLE_REGISTRY] = ble_registry
    app[HUB] = hub
    app[CFG] = panel_config
    app[BRIDGE] = bridge
    # The live device-facing app config (same dict the HTTP handlers read), so
    # panel setting changes take effect immediately. None in tests.
    app[LIVE_CONFIG] = live_config if live_config is not None else {}
    app[EVENT_STORE] = event_store
    app[RETENTION_CONFIG] = retention_config
    app[PET_REGISTRY] = pet_registry
    app[HA_PUBLISHER] = ha_publisher
    app[AUTH] = auth
    if auth is not None:
        async def _close_auth(_app: web.Application) -> None:
            auth.close()
        app.on_cleanup.append(_close_auth)
    app[BACKGROUND_TASKS] = set()
    # AppRunner.cleanup() fires on_cleanup, so main.py's existing
    # `panel_runner.cleanup()` already drains these — no change needed there.
    app.on_cleanup.append(cancel_background_tasks)

    app.on_response_prepare.append(apply_security_headers)
    app.router.add_get("/api/info", api_info)

    # --- devices: list, detail, commands ---
    app.router.add_get("/api/devices", api_devices)
    app.router.add_get("/api/devices/{id}", api_device_detail)
    app.router.add_delete("/api/devices/{id}", api_device_delete)
    app.router.add_post("/api/devices/{id}/command", api_send_command)
    app.router.add_post("/api/devices/{id}/schedule", api_save_schedule)
    app.router.add_get("/api/devices/{id}/deferred-feed", api_deferred_feed)
    app.router.add_post("/api/devices/{id}/deferred-feed", api_deferred_feed)
    app.router.add_delete("/api/devices/{id}/deferred-feed/{feed_id}", api_deferred_feed)

    # --- per-device toggles (GET reads, POST writes — same handler) ---
    app.router.add_get("/api/devices/{id}/capabilities", api_capabilities)
    app.router.add_post("/api/devices/{id}/capabilities", api_capabilities)
    app.router.add_get("/api/devices/{id}/timezone", api_timezone)
    app.router.add_post("/api/devices/{id}/timezone", api_timezone)
    app.router.add_get("/api/devices/{id}/ai", api_ai_settings)
    app.router.add_post("/api/devices/{id}/ai", api_ai_settings)
    app.router.add_get("/api/devices/{id}/logs", api_device_log_settings)
    app.router.add_post("/api/devices/{id}/logs", api_device_log_settings)
    # Two-way talk: browser mic -> device speaker (needs the `talk` patcher).
    app.router.add_get("/api/devices/{id}/talk", api_talk)
    # Live video through go2rtc: what is watchable, then HLS / MSE / WebRTC.
    app.router.add_get("/api/devices/{id}/live", api_live_info)
    app.router.add_get("/api/live/{id}/stream.m3u8", api_live_hls_master)
    app.router.add_get("/api/live/{id}/hls/{name}", api_live_hls_file)
    app.router.add_get("/api/live/{id}/mse", api_live_mse)
    app.router.add_post("/api/live/{id}/webrtc", api_live_webrtc)

    # --- custom sounds (camera feeders) ---
    app.router.add_get("/api/devices/{id}/sounds", api_sounds_list)
    app.router.add_post("/api/devices/{id}/sounds", api_sounds_upload)
    app.router.add_delete("/api/devices/{id}/sounds/{sound_id}", api_sounds_delete)
    app.router.add_post("/api/devices/{id}/sounds/{sound_id}/play", api_sounds_play)
    app.router.add_post("/api/devices/{id}/sounds/{sound_id}/select", api_sounds_select)

    # --- BLE accessories. Pairing lives here because it lives in the cloud:
    # the device pulls a list and scans for exactly those MACs, and no firmware
    # has any way to report a newly-found accessory upward. We are the cloud.
    app.router.add_get("/api/ble", api_ble_accessories)
    app.router.add_post("/api/ble", api_ble_accessories)
    app.router.add_post("/api/ble/import", api_ble_import)
    app.router.add_delete("/api/ble/{id}", api_ble_delete)
    app.router.add_post("/api/ble/{id}/command", api_ble_command)
    app.router.add_post("/api/ble/{id}/poll", api_ble_poll)

    # --- patchers (on-device binary patches) ---
    app.router.add_get("/api/devices/{id}/patcher", api_patcher_status)
    app.router.add_post("/api/devices/{id}/patcher", api_patcher_apply)

    # --- settings ---
    app.router.add_get("/api/settings", api_settings)
    app.router.add_post("/api/settings", api_settings)
    app.router.add_get("/api/blocked", api_blocked)
    app.router.add_get("/api/retention", api_retention)
    app.router.add_post("/api/retention", api_retention)

    # --- live log (ring buffer poll + WebSocket stream) ---
    app.router.add_get("/api/events", api_events)
    app.router.add_get("/api/ws", api_ws)

    # --- capture browser ---
    app.router.add_get("/api/capture", api_capture_list)
    app.router.add_get("/api/capture/{name}", api_capture_read)
    app.router.add_delete("/api/capture/{name}", api_capture_delete)
    app.router.add_get("/api/capture/{name}/download", api_capture_download)

    # --- device logs (uploaded by the device itself). Literal before dynamic,
    # so `/api/devicelogs` is not swallowed by the catch-all path pattern.
    app.router.add_get("/api/devicelogs", api_device_logs)
    app.router.add_get("/api/devicelogs/{path:.*}", api_device_log_read)

    # --- timeline + media. The thumb route is registered first because
    # `{path:.*}` would otherwise swallow `thumb/...` as a media path.
    app.router.add_get("/api/timeline", api_timeline)
    # Registered after the static "/api/events": aiohttp resolves a literal
    # path before a dynamic one, so this cannot shadow the hub's event list.
    app.router.add_get("/api/timeline/{id}", api_event_detail)
    app.router.add_get("/api/media/thumb/{path:.*}", api_media_thumb)
    app.router.add_get("/api/media/{path:.*}", api_media_file)

    # --- pets ---
    app.router.add_get("/api/pets", api_pets_list_create)
    app.router.add_post("/api/pets", api_pets_list_create)
    # Before "/api/pets/{id}", or the literal segment is swallowed by the
    # dynamic one and every request lands in api_pet_detail with id="unbound".
    app.router.add_get("/api/pets/unbound", api_pets_unbound)
    app.router.add_post("/api/pets/import", api_pets_import)
    app.router.add_get("/api/pets/{id}", api_pet_detail)
    app.router.add_post("/api/pets/{id}", api_pet_detail)
    app.router.add_delete("/api/pets/{id}", api_pet_detail)
    app.router.add_get("/api/pets/{id}/faces", api_pet_faces)
    app.router.add_post("/api/pets/{id}/faces", api_pet_faces)
    app.router.add_delete("/api/pets/{id}/faces/{face_id}", api_pet_face_detail)
    app.router.add_get("/api/pets/{id}/faces/{face_id}/photo", api_pet_face_photo)

    # --- auth: first-run setup, login, step-up, pairing, client tokens, and
    # signed links for media players that cannot send a token.
    app.router.add_post("/api/auth/setup", api_auth_setup)
    app.router.add_post("/api/auth/login", api_auth_login)
    app.router.add_post("/api/auth/logout", api_auth_logout)
    app.router.add_post("/api/auth/step-up", api_auth_step_up)
    app.router.add_post("/api/auth/pairing", api_auth_pairing_create)
    app.router.add_post("/api/auth/pairing/redeem", api_auth_pairing_redeem)
    app.router.add_get("/api/auth/tokens", api_auth_tokens)
    app.router.add_delete("/api/auth/tokens/{id}", api_auth_token_revoke)
    app.router.add_post("/api/auth/media-url", api_auth_media_url)

    # --- the web app's document and build files. Last, after every literal
    # `/api/...` route (see `add_spa_routes`).
    add_spa_routes(app)
    return app

