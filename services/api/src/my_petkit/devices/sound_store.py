"""Custom sounds uploaded for a device: where they are stored, and the list a
device downloads them from.

The panel's sounds feature writes them; the device API's `dev_sound_get` (and
the panel, after an upload) builds the list a device fetches them by. Kept in
the protocol core so the device side never imports a user-plane feature.
"""
from __future__ import annotations

import json
import os
from typing import Any

def sounds_dir(data_dir: str, device_id: int) -> str:
    """Where one device's uploaded sounds and their `sounds.json` live."""
    return os.path.join(data_dir, "sounds", str(device_id))


def _sounds_meta_path(data_dir: str, device_id: int) -> str:
    return os.path.join(sounds_dir(data_dir, device_id), "sounds.json")


def load_sounds(data_dir: str, device_id: int) -> list[dict[str, Any]]:
    """The device's sound list; empty when none was uploaded or it is unreadable."""
    path = _sounds_meta_path(data_dir, device_id)
    if not os.path.isfile(path):
        return []
    try:
        with open(path) as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return []


def save_sounds(data_dir: str, device_id: int, sounds: list[dict[str, Any]]) -> None:
    d = sounds_dir(data_dir, device_id)
    os.makedirs(d, exist_ok=True)
    path = _sounds_meta_path(data_dir, device_id)
    with open(path, "w") as f:
        json.dump(sounds, f, indent=2)


def next_sound_id(sounds: list[dict[str, Any]]) -> int:
    if not sounds:
        return 1
    return max(s["id"] for s in sounds) + 1


def sound_list_for_device(data_dir: str, device_id: int,
                          bucket_endpoint: str) -> list[dict[str, Any]]:
    """Build the ``dev_sound_get`` result list with download URLs."""
    sounds = load_sounds(data_dir, device_id)
    if not sounds or not bucket_endpoint:
        return []
    base = bucket_endpoint.rstrip("/")
    result = []
    for s in sounds:
        result.append({
            "id": s["id"],
            "name": s.get("name", ""),
            "duration": s.get("duration", 0),
            "url": f"{base}/sounds/{device_id}/{s['filename']}",
            "digest": s.get("digest", ""),
            "size": s.get("size", 0),
        })
    return result
