"""Reproductions awaiting approval: action gating, queue bound, code families, zone.

Each test describes the behaviour the proposed fix would establish and fails
against today's code, so it is marked strict xfail until the fix is approved.
"""

import json
import logging
import os
import time
from contextlib import contextmanager

import pytest
from aiohttp.test_utils import TestClient, TestServer

from my_petkit.devices.ble import BLERegistry
from my_petkit.devices.registry import DeviceRegistry
from my_petkit.events import codes
from my_petkit.web.hub import EventHub
from my_petkit.web.panel import create_panel_app

PANEL_CFG = {"api_url": "http://x/6/", "mqtt_tls": True, "mqtt_tls_port": 443,
             "capture": False, "capture_dir": "/nope"}


async def _send_action(device_type: str, action: str) -> tuple[int, dict]:
    reg = DeviceRegistry()
    reg.get_or_create(petkit_id=1, device_type=device_type, serial_number="SN")
    app = create_panel_app(reg, BLERegistry(), EventHub(), dict(PANEL_CFG), None)
    client = TestClient(TestServer(app))
    await client.start_server()
    try:
        r = await client.post("/api/devices/1/command", data=json.dumps({"action": action}))
        return r.status, await r.json()
    finally:
        await client.close()


@pytest.mark.xfail(strict=True, reason="any action is accepted for any model today")
@pytest.mark.parametrize(("device_type", "action"), [
    ("t4", "pack_waste"),      # code 8: a T4 reads it as an N50 deodorizer reset
    ("d4", "dump_litter"),     # a litter command sent to a feeder
    ("w5", "feed"),            # a feeder command sent to a BLE-only fountain
])
async def test_an_action_the_model_has_no_button_for_is_refused(device_type, action):
    status, body = await _send_action(device_type, action)
    assert status == 400 and "error" in body


async def test_an_action_the_model_has_a_button_for_is_still_sent():
    status, body = await _send_action("t5", "cleaning_start")
    assert status == 200 and body["ok"]


@pytest.mark.xfail(strict=True, reason="the heartbeat command queue is unbounded today")
async def test_the_heartbeat_queue_stays_bounded_and_keeps_the_newest():
    """A device that stops polling while commands keep arriving."""
    reg = DeviceRegistry()
    dev = reg.get_or_create(petkit_id=1, device_type="t5", serial_number="SN")
    app = create_panel_app(reg, BLERegistry(), EventHub(), dict(PANEL_CFG), None)
    client = TestClient(TestServer(app))
    await client.start_server()
    try:
        for _ in range(300):
            r = await client.post("/api/devices/1/command",
                                  data=json.dumps({"action": "cleaning_start"}))
            assert r.status == 200
    finally:
        await client.close()
    assert len(dev.command_queue) <= 64


def test_a_code_reported_by_a_model_outside_its_families_is_logged(caplog, monkeypatch):
    # The warning fires once per (model, code) per process; start from a clean
    # slate so an earlier test that looked the same code up cannot hide it.
    monkeypatch.setattr(codes, "_WARNED_OUTSIDE_FAMILIES", set())
    # A next-generation-only litter code, reported by a first-generation box.
    key = next(k for k, c in codes.LITTER_HTTP_CODES.items()
               if c.families == codes.LITTER_NEXT_GEN and codes.lookup(k, device_type="t4") is c)
    caplog.set_level(logging.WARNING)
    codes.lookup(key, device_type="t4")
    codes.lookup(key, device_type="t4")
    warnings = [r for r in caplog.records if "famil" in r.getMessage()]
    assert len(warnings) == 1


@contextmanager
def _process_tz(name):
    original = os.environ.get("TZ")
    os.environ["TZ"] = name
    time.tzset()
    try:
        yield
    finally:
        if original is None:
            os.environ.pop("TZ", None)
        else:
            os.environ["TZ"] = original
        time.tzset()


@pytest.mark.xfail(strict=True, reason="local dates follow the host TZ, not the device's zone")
def test_the_daily_feed_record_id_uses_the_device_zone_not_the_host_zone(monkeypatch):
    """At 2026-09-21T14:13:20Z it is the 21st in Saigon and the 22nd in Kiritimati."""
    from my_petkit.ha import commands

    reg = DeviceRegistry()
    dev = reg.get_or_create(petkit_id=1, device_type="d4", serial_number="SN")
    dev.config["locale"] = "Asia/Saigon"
    monkeypatch.setattr(commands.time, "time", lambda: 1_790_000_000.0)
    with _process_tz("Pacific/Kiritimati"):
        _suffix, envelope = commands._feed(dev, 10)
    assert "20260921" in json.dumps(envelope)
