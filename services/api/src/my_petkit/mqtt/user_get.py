"""The answer to an MQTT `user/get` data_get, built from the HTTP payloads.

Split out of `mqtt/bridge.py`; `MQTTBridge._user_get_payload` delegates here.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from my_petkit.devices import payloads

if TYPE_CHECKING:
    from my_petkit.devices.base import Device
    from my_petkit.devices.ble import BLERegistry


def user_get_payload(device: Device, data_type: str, *, ble_registry: BLERegistry | None,
                     api_url: str) -> dict | None:
    """Build the answer to one MQTT data_get.

    `dataType` names the same resources the HTTP API serves, and the payloads
    are deliberately the same objects those handlers return, so a device gets
    identical config over either transport.

    Returns:
        The resource dict, or None when the type is unsupported or the
        resource simply isn't configured (no schedule, no server URL) — the
        caller then stays silent rather than replying with an empty resource
        the device would take as authoritative.
    """
    if data_type == "dev_device_info":
        return payloads.to_device_info(device, ble_registry)
    if data_type == "dev_multi_config":
        return payloads.to_multi_config(device)
    if data_type == "dev_serverinfo":
        return payloads.to_serverinfo(device, api_url) if api_url else None
    if data_type == "dev_schedule_get":
        sched = device.config.get("schedule")
        return {"result": sched} if sched is not None else None
    if data_type == "dev_feed_get":
        feed = device.config.get("feed_schedule")
        return {"result": feed} if feed is not None else None
    if data_type == "dev_ble_device":
        # Deliberately identical to `http/handlers/ble_device.py` — the two
        # answer the same question over different transports and have
        # drifted apart once already. Neither sends `list` when it would be
        # empty: 1.8.1 sent `[]` on both, matching PetKit's own cloud, and
        # owners reported it crashing devices. See that handler for what is
        # and is not known about those reports.
        lst = []
        if ble_registry:
            for b in ble_registry.non_k3_for_parent(device.petkit_id):
                lst.append(b.to_ble_list_entry())
        result: dict = {"nextTick": 3600}
        if lst:
            result["list"] = lst
        return {"result": result}
    return None

