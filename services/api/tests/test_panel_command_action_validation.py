"""The panel's command endpoint answers a malformed or out-of-model action with 400.

A named action is only sent when this model has a button for it; the raw
`{suffix, payload}` escape hatch is untouched by that rule.
"""

import json

import pytest
from aiohttp.test_utils import TestClient, TestServer

from my_petkit.devices.ble import BLERegistry
from my_petkit.devices.registry import DeviceRegistry
from my_petkit.web.hub import EventHub
from my_petkit.web.panel import create_panel_app

PANEL_CFG = {"api_url": "http://x/6/", "capture": False, "capture_dir": "/nope"}


async def _post(device_type: str, body: dict) -> tuple[int, dict, DeviceRegistry]:
    reg = DeviceRegistry()
    reg.get_or_create(petkit_id=1, device_type=device_type, serial_number="SN")
    app = create_panel_app(reg, BLERegistry(), EventHub(), dict(PANEL_CFG), None)
    client = TestClient(TestServer(app))
    await client.start_server()
    try:
        r = await client.post("/api/devices/1/command", data=json.dumps(body))
        return r.status, await r.json(), reg
    finally:
        await client.close()


@pytest.mark.parametrize("action", [["cleaning_start"], {"x": 1}, 7])
async def test_a_non_string_action_is_refused_not_a_server_error(action):
    status, body, _reg = await _post("t5", {"action": action})
    assert status == 400
    assert "error" in body


async def test_an_unknown_action_is_refused_with_the_existing_message():
    status, body, _reg = await _post("t5", {"action": "self_destruct"})
    assert status == 400
    assert body == {"error": "unknown action self_destruct"}


async def test_an_out_of_model_action_queues_nothing():
    status, _body, reg = await _post("d4", {"action": "dump_litter"})
    assert status == 400
    assert reg.get(1).command_queue == []


async def test_the_raw_suffix_payload_form_is_not_scoped_by_model():
    status, body, reg = await _post("d4", {"suffix": "thing/service/x", "payload": {"a": 1}})
    assert status == 200
    assert body["ok"]
    assert len(reg.get(1).command_queue) == 1
