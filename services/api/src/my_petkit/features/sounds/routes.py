"""Custom sounds: upload, list, delete, play and select.

A camera feeder can play custom audio through its speaker. The flow:

1. Upload an audio file through this API
2. The sound appears in ``dev_sound_get`` for the device to download
3. ``property.set{selectedSound: N}`` selects the active sound
4. ``thing/service/play_sound{soundId: N}`` plays it

Sound files live in ``{data_dir}/sounds/{device_id}/`` with a metadata
sidecar ``sounds.json``. The device downloads them from the bucket
endpoint, so the file is served at ``/sounds/{device_id}/{filename}``
on the bucket port.
"""
from __future__ import annotations

import hashlib
import logging
import os
import time
from typing import Any

from aiohttp import web

from my_petkit.ha.commands import make_mqtt_property_set, _envelope
from my_petkit.devices import sound_store
from my_petkit.shared.panel_request import _device_or_404, _deliver, _refuse
from my_petkit.shared.appkeys import BRIDGE, CFG, HUB

log = logging.getLogger(__name__)

MAX_SOUND_SIZE = 2 * 1024 * 1024  # 2 MB
MAX_SOUNDS_PER_DEVICE = 10


def _data_dir(request: web.Request) -> str:
    return request.app[CFG].get("data_dir", "/data")


def _sounds_dir(request: web.Request, device_id: int) -> str:
    return sound_store.sounds_dir(_data_dir(request), device_id)


def _load_sounds(request: web.Request, device_id: int) -> list[dict[str, Any]]:
    return sound_store.load_sounds(_data_dir(request), device_id)


def _save_sounds(request: web.Request, device_id: int, sounds: list[dict[str, Any]]) -> None:
    sound_store.save_sounds(_data_dir(request), device_id, sounds)


def sound_list_for_device(request: web.Request, device_id: int,
                          bucket_endpoint: str) -> list[dict[str, Any]]:
    """Build the ``dev_sound_get`` result list with download URLs."""
    return sound_store.sound_list_for_device(_data_dir(request), device_id, bucket_endpoint)


async def api_sounds_list(request: web.Request) -> web.Response:
    d = _device_or_404(request)
    sounds = _load_sounds(request, d.petkit_id)
    return web.json_response({"sounds": sounds})


async def api_sounds_upload(request: web.Request) -> web.Response:
    d = _device_or_404(request)
    sounds = _load_sounds(request, d.petkit_id)
    if len(sounds) >= MAX_SOUNDS_PER_DEVICE:
        raise _refuse(web.HTTPBadRequest, f"max {MAX_SOUNDS_PER_DEVICE} sounds")

    reader = await request.multipart()
    field = await reader.next()
    if field is None or field.name != "file":
        raise _refuse(web.HTTPBadRequest, "missing file field")

    filename_raw = field.filename or "sound.mp3"
    ext = os.path.splitext(filename_raw)[1].lower() or ".mp3"
    data = await field.read(decode=False)
    if len(data) > MAX_SOUND_SIZE:
        raise _refuse(web.HTTPBadRequest, f"file too large (max {MAX_SOUND_SIZE // 1024}KB)")
    if not data:
        raise _refuse(web.HTTPBadRequest, "empty file")

    sound_id = sound_store.next_sound_id(sounds)
    digest = hashlib.md5(data).hexdigest()
    filename = f"sound_{sound_id}{ext}"

    d_dir = _sounds_dir(request, d.petkit_id)
    os.makedirs(d_dir, exist_ok=True)
    filepath = os.path.join(d_dir, filename)
    with open(filepath, "wb") as f:
        f.write(data)

    entry: dict[str, Any] = {
        "id": sound_id,
        "name": os.path.splitext(filename_raw)[0],
        "filename": filename,
        "size": len(data),
        "digest": digest,
        "duration": 0,
        "uploaded_at": int(time.time()),
    }
    sounds.append(entry)
    _save_sounds(request, d.petkit_id, sounds)

    bucket_endpoint = request.app[CFG].get("bucket_endpoint", "")
    if bucket_endpoint:
        sound_list = sound_list_for_device(request, d.petkit_id, bucket_endpoint)
        hub = request.app.get(HUB)
        bridge = request.app.get(BRIDGE)
        if hub and bridge:
            envelope = make_mqtt_property_set({"soundList": sound_list})
            await _deliver(hub, bridge, d, "property/set", envelope)

    log.info("Uploaded sound %d for device %d: %s (%d bytes)",
             sound_id, d.petkit_id, filename, len(data))
    return web.json_response({"ok": True, "sound": entry})


async def api_sounds_delete(request: web.Request) -> web.Response:
    d = _device_or_404(request)
    try:
        sound_id = int(request.match_info["sound_id"])
    except (ValueError, KeyError):
        raise _refuse(web.HTTPBadRequest, "bad sound_id") from None

    sounds = _load_sounds(request, d.petkit_id)
    entry = next((s for s in sounds if s["id"] == sound_id), None)
    if entry is None:
        raise _refuse(web.HTTPNotFound, "sound not found")

    filepath = os.path.join(_sounds_dir(request, d.petkit_id), entry["filename"])
    if os.path.isfile(filepath):
        os.remove(filepath)

    sounds = [s for s in sounds if s["id"] != sound_id]
    _save_sounds(request, d.petkit_id, sounds)

    log.info("Deleted sound %d for device %d", sound_id, d.petkit_id)
    return web.json_response({"ok": True})


async def api_sounds_play(request: web.Request) -> web.Response:
    d = _device_or_404(request)
    try:
        sound_id = int(request.match_info["sound_id"])
    except (ValueError, KeyError):
        raise _refuse(web.HTTPBadRequest, "bad sound_id") from None

    hub = request.app.get(HUB)
    bridge = request.app.get(BRIDGE)
    if not hub:
        raise _refuse(web.HTTPBadRequest, "no event hub")

    envelope = _envelope("thing.service.play_sound", {"soundId": sound_id})
    return await _deliver(hub, bridge, d, "play_sound", envelope)


async def api_sounds_select(request: web.Request) -> web.Response:
    d = _device_or_404(request)
    try:
        sound_id = int(request.match_info["sound_id"])
    except (ValueError, KeyError):
        raise _refuse(web.HTTPBadRequest, "bad sound_id") from None

    d.config.setdefault("settings", {})["selectedSound"] = sound_id

    hub = request.app.get(HUB)
    bridge = request.app.get(BRIDGE)
    if not hub:
        raise _refuse(web.HTTPBadRequest, "no event hub")

    envelope = make_mqtt_property_set({"selectedSound": sound_id})
    return await _deliver(hub, bridge, d, "property/set", envelope)
