"""Deterministic device-facing scenarios for the golden check.

Imported by `golden_device_responses.py` in a subprocess whose PYTHONPATH points
at ONE version of the `my_petkit` package (the working tree, or a git ref
checked out into a temporary worktree). It records every byte that version
would hand a device or Home Assistant for a fixed set of inputs:

  * HTTP: every `/6/{type}/dev_*` endpoint, heartbeat, catch-all, per type;
  * bucket: an upload and its response headers;
  * MQTT: the bridge's replies to device events;
  * Home Assistant: discovery, state and availability per device type;
  * patchers: the boot wrapper for every combination of patchers, run_cmd.

Only public, long-lived entry points are used, so the same file runs against
an older checkout. Time, randomness and the data directory are pinned.
"""

from __future__ import annotations

import asyncio
import itertools
import json
import os
import random
import secrets
import sys
import time
import uuid
from pathlib import Path
from datetime import datetime, timezone
from typing import Any

FIXED_NOW = 1_790_000_000.0  # 2026-09-21T14:13:20Z


class FrozenDatetime(datetime):
    """`datetime` whose `now()`/`utcnow()`/`today()` return FIXED_NOW."""

    @classmethod
    def now(cls, tz=None):  # type: ignore[override]
        return cls.fromtimestamp(FIXED_NOW, tz)

    @classmethod
    def utcnow(cls):  # type: ignore[override]
        return cls.fromtimestamp(FIXED_NOW, timezone.utc).replace(tzinfo=None)

    @classmethod
    def today(cls):  # type: ignore[override]
        return cls.fromtimestamp(FIXED_NOW)


def pin_nondeterminism() -> None:
    rng = random.Random(1234)  # noqa: S311 - determinism, not security
    time.time = lambda: FIXED_NOW  # type: ignore[assignment]
    secrets.token_hex = lambda n=32: "".join(rng.choice("0123456789abcdef") for _ in range(2 * n))  # type: ignore[assignment]
    secrets.token_bytes = lambda n=32: bytes(rng.randrange(256) for _ in range(n))  # type: ignore[assignment]
    secrets.token_urlsafe = lambda n=32: secrets.token_hex(n)  # type: ignore[assignment]
    secrets.randbits = lambda k: rng.getrandbits(k)  # type: ignore[assignment]
    os.urandom = lambda n: bytes(rng.randrange(256) for _ in range(n))  # type: ignore[assignment]
    uuid.uuid4 = lambda: uuid.UUID(int=rng.getrandbits(128), version=4)  # type: ignore[assignment]
    random.seed(1234)


def freeze_module_datetimes() -> None:
    """Swap `datetime` in every loaded my_petkit module for FrozenDatetime."""
    for name, module in list(sys.modules.items()):
        if name.startswith("my_petkit") and getattr(module, "datetime", None) is datetime:
            module.datetime = FrozenDatetime


class FakeClient:
    def __init__(self) -> None:
        self.published: list[list[Any]] = []

    async def publish(self, topic: str, payload: Any, **kw: Any) -> None:
        if isinstance(payload, (bytes, bytearray)):
            payload = payload.decode("utf-8", "replace")
        self.published.append([topic, payload, kw.get("retain")])


class FakeMessage:
    def __init__(self, topic: str, payload: bytes) -> None:
        self.topic = topic
        self.payload = payload


DEVICE_ENDPOINTS = [
    "dev_syncTime", "dev_signup", "dev_iot_device_info", "dev_only_iot_device_info",
    "dev_only_iot_device_info_v2", "dev_serverinfo", "dev_ota_check", "dev_ota_heartbeat",
    "dev_oss_sts_info_new", "dev_oss_sts_info_new_v2", "dev_video_device_info",
    "dev_device_info", "dev_multi_config", "dev_ble_device", "dev_k3_device_info",
    "dev_schedule_get", "dev_sound_get", "dev_feed_get", "dev_discern_config",
    "dev_discern_pic", "dev_upload_log_token", "dev_state_report", "dev_event_report",
    "dev_attire_over", "dev_upload_file_info_v2",
]
USER_GET_TYPES = ["dev_device_info", "dev_multi_config", "dev_serverinfo", "dev_schedule_get",
                  "dev_feed_get", "dev_ble_device"]
FEED_SCHEDULE = {"v": 2, "schedule": [{"re": "1,2,3,4,5,6,7", "it": [
    {"id": "n_28800", "t": 28800, "a1": 1, "a2": 0},
    {"id": "n_64800", "t": 64800, "a1": 2, "a2": 0}]}]}
STATE_BODY = {"workState": 1, "sandPercent": 55, "usedTimes": 9, "locale": "Asia/Saigon",
              "timezone": 7.0, "wifi": {"ssid": "ExampleNet", "rsq": -50, "bssid": "000000000000"}}
EVENT_BODY = {"event_type": 10, "event_id": "golden-1", "timestamp": int(FIXED_NOW),
              "content": {"result": 0, "start_reason": 0}}


def _register(registry: Any, pid: int, dtype: str) -> Any:
    dev = registry.get_or_create(petkit_id=pid, device_type=dtype, serial_number=f"SN{pid}")
    dev.api_secret = "0123456789abcdef"
    dev.mqtt_product_key = "a1golden"
    dev.mqtt_device_name = f"d_{dtype}_SN{pid}"
    dev.mqtt_device_secret = "golden-device-secret"
    return dev


#: One camera feeder carries an uploaded sound, so `dev_sound_get` is pinned
#: both with a sound to list and (every other type) with none.
SOUND_DEVICE_TYPE = "d4h"


def _upload_sound(data_dir: str, device_id: int) -> None:
    """Write what the panel's upload leaves on disk: `sounds/<id>/sounds.json`."""
    folder = Path(data_dir) / "sounds" / str(device_id)
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "sounds.json").write_text(json.dumps([
        {"id": 1, "name": "dinner", "filename": "1.mp3", "duration": 2,
         "digest": "golden-digest", "size": 3}]))


def _services(data_dir: str) -> Any:
    """The real wiring (`main.wiring.build_services`), as `main()` builds it."""
    import argparse

    from my_petkit.config import Config
    from my_petkit.main.wiring import build_services

    config = Config(api_url="http://192.0.2.55/6/", data_dir=data_dir)
    # The operator's zone, when this version of the package has the setting.
    zone = os.environ.get("GOLDEN_ZONE", "")
    if zone and "timezone" in Config.__dataclass_fields__:
        config.timezone = zone
    config.resolve_bucket_endpoint()
    services = build_services(config, argparse.Namespace(no_ha=False, no_mqtt=False, ha_addon=False))
    for client_owner in (services.ha_publisher, services.mqtt_bridge):
        client_owner._client = FakeClient()
    services.ha_publisher._connected = True
    return services


async def _http(dtypes: list[str], data_dir: str) -> dict[str, Any]:
    """Every device endpoint per type, plus what HA was sent as a side effect."""
    from aiohttp.test_utils import TestClient, TestServer

    out: dict[str, Any] = {}
    for dtype in dtypes:
        services = _services(f"{data_dir}/{dtype}")
        dev = _register(services.registry, 100, dtype)
        if dtype == SOUND_DEVICE_TYPE:
            _upload_sound(f"{data_dir}/{dtype}", dev.petkit_id)
        client = TestClient(TestServer(services.app))
        await client.start_server()
        hdr = {"X-Device": f"id={dev.petkit_id}&sn={dev.serial_number}"}
        try:
            for ep in DEVICE_ENDPOINTS:
                body = STATE_BODY if ep == "dev_state_report" else EVENT_BODY
                r = await client.post(f"/6/{dtype}/{ep}", headers=hdr, data=json.dumps(body))
                out[f"{dtype} POST {ep}"] = [r.status, await r.text()]
            for path in (f"/6/poll/{dtype}/heartbeat", "/6/unknown/endpoint", "/"):
                r = await client.get(path, headers=hdr)
                out[f"{dtype} GET {path}"] = [r.status, await r.text()]
        finally:
            await client.close()
            await services.event_store.close()
        out[f"{dtype} -> home assistant"] = services.ha_publisher._client.published
        out[f"{dtype} -> device mqtt"] = services.mqtt_bridge._client.published
    return out


async def _bucket(data_dir: str) -> dict[str, Any]:
    from aiohttp.test_utils import TestClient, TestServer

    from my_petkit.http.bucket import create_bucket_app

    client = TestClient(TestServer(create_bucket_app(data_dir + "/media")))
    await client.start_server()
    try:
        out = {}
        for method, path in (("PUT", "/t5/100/even/1_1EVENT_PREVIEW1790000000.jpg"),
                             ("POST", "/"), ("GET", "/nothing")):
            r = await client.request(method, path, data=b"\xff\xd8golden")
            headers = {k: v for k, v in r.headers.items() if k.lower().startswith(("x-oss", "etag"))}
            out[f"{method} {path}"] = [r.status, headers, await r.text()]
        return out
    finally:
        await client.close()


async def _mqtt(dtypes: list[str], data_dir: str) -> dict[str, Any]:
    """The bridge's replies to device events, through the real wiring."""
    out: dict[str, Any] = {}
    events = [("property", {"autoWork": 0, "sandPercent": 40}), ("pet_out", {"content": "{}"}),
              ("clean_over", {}), ("unknown_kind", {})]
    for dtype in dtypes:
        services = _services(f"{data_dir}/mqtt-{dtype}")
        dev = _register(services.registry, 10, dtype)
        bridge = services.mqtt_bridge
        try:
            for i, (event, params) in enumerate(events):
                topic = f"/sys/{dev.mqtt_product_key}/{dev.mqtt_device_name}/thing/event/{event}/post"
                payload = {"id": str(i), "params": params, "method": f"thing.event.{event}.post"}
                await bridge._handle_message(FakeMessage(topic, json.dumps(payload).encode()))
            user_get = f"/{dev.mqtt_product_key}/{dev.mqtt_device_name}/user/get"
            await bridge._handle_message(FakeMessage(user_get, b'{"id":"9","params":{"dataType":"feed"}}'))
            # Every resource a device can ask for over MQTT, with a stored feed
            # schedule so dev_feed_get has something to answer.
            dev.config["feed_schedule"] = FEED_SCHEDULE
            data_get = f"/sys/{dev.mqtt_product_key}/{dev.mqtt_device_name}/thing/event/data_get/post"
            for data_type in USER_GET_TYPES:
                body = json.dumps({"id": data_type, "params": {"dataType": data_type},
                                   "method": "thing.event.data_get.post"})
                await bridge._handle_message(FakeMessage(data_get, body.encode()))
        finally:
            await services.event_store.close()
        out[dtype] = bridge._client.published
        out[f"{dtype} -> home assistant"] = services.ha_publisher._client.published
    return out


async def _home_assistant(dtypes: list[str]) -> dict[str, Any]:
    from my_petkit.devices.registry import DeviceRegistry
    from my_petkit.ha.publisher import HAPublisher

    out: dict[str, Any] = {}
    for dtype in dtypes:
        registry = DeviceRegistry()
        dev = _register(registry, 7, dtype)
        dev.state.update(STATE_BODY)
        pub = HAPublisher(registry, {"ha_mqtt_host": "", "discovery_prefix": "homeassistant"})
        pub._client = FakeClient()
        pub._connected = True
        await pub.publish_discovery(dev)
        await pub.publish_state(dev)
        await pub.publish_availability(dev)
        out[dtype] = pub._client.published
    return out


def _patchers() -> dict[str, Any]:
    from my_petkit.devices.base import Device
    from my_petkit.patchers import common, ssh

    ids = ["ssh", "talk", "mqtt", "cloud", "cacert", "camera"]
    out: dict[str, Any] = {"run_cmd": common.build_run_cmd("echo golden; ls /system")}
    for dev in (None, Device(petkit_id=5, device_type="t5", serial_number="SN5")):
        key = dev.device_type if dev else "default"
        for n in range(len(ids) + 1):
            for combo in itertools.combinations(ids, n):
                out[f"{key} wrapper {'+'.join(combo) or '-'}"] = common.build_wrapper_upload_cmd(set(combo), dev)
        out[f"{key} remove"] = common.build_wrapper_remove_cmd(dev)
    out["ssh install"] = ssh.build_install_commands("http://server/patcher/download/5")
    return out


async def collect(data_dir: str) -> dict[str, Any]:
    pin_nondeterminism()
    import importlib
    import pkgutil

    import my_petkit
    from my_petkit.utils import const

    # Load every module up front so each one's `datetime` is frozen before use.
    for info in pkgutil.walk_packages(my_petkit.__path__, "my_petkit."):
        if not info.name.endswith("__main__"):
            importlib.import_module(info.name)
    freeze_module_datetimes()
    dtypes = sorted(const.DEVICE_TYPES_ALL)
    return {
        "http": await _http(dtypes, data_dir),
        "bucket": await _bucket(data_dir),
        "mqtt": await _mqtt(dtypes, data_dir),
        "home_assistant": await _home_assistant(dtypes),
        "patchers": _patchers(),
    }


if __name__ == "__main__":
    import my_petkit

    # Prove the package under test is the one the runner pointed at, not an
    # editable install of the working tree shadowing a baseline checkout.
    expected = os.path.realpath(os.environ["GOLDEN_SRC"])
    actual = os.path.realpath(my_petkit.__file__)
    if not actual.startswith(expected + os.sep):
        sys.exit(f"imported my_petkit from {actual}, expected under {expected}")
    result = asyncio.run(collect(sys.argv[2]))
    with open(sys.argv[1], "w", encoding="utf-8") as fh:
        json.dump(result, fh, indent=1, sort_keys=True, default=str)
