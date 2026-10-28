"""Credentials never reach a client: one function, one key list.

`redact_for_client` is built on `http/redact/rules.py::CREDENTIAL_KEYS`, and
the endpoints that hand out device-originated data verbatim — the WebSocket,
the event poll, the capture viewer, `/api/ble`, device state, `/api/blocked`
and device logs — all go through it.
"""

from __future__ import annotations

import ast
import json
from pathlib import Path

import aiohttp

from my_petkit.devices.registry import DeviceRegistry
from my_petkit.http.redact.rules import CREDENTIAL_KEYS
from my_petkit.shared.redact_client import is_credential_key, redact_for_client
from my_petkit.web.hub import EventHub
from tests.conftest_auth import authed_test_client, bare_panel

SECRET = "0123456789abcdef-SECRET"


def test_every_credential_key_is_masked_in_every_spelling():
    for key in CREDENTIAL_KEYS:
        out = redact_for_client({key: SECRET, key.upper(): SECRET, "keep": 1})
        assert SECRET not in json.dumps(out), key
        assert out["keep"] == 1
    assert is_credential_key("X-Device") and is_credential_key("xdevice")
    assert not is_credential_key("deviceName")


def test_json_inside_strings_and_plain_text_are_masked():
    nested = {"payload": json.dumps({"XDevice": SECRET, "temp": 21}),
              "line": f"POST /6/dev_signup X-Device: id=1&nonce=2&sign={SECRET} tail",
              "truncated": f'{{"secret":"{SECRET}","x":',
              "list": [{"deviceSecret": SECRET}]}
    out = redact_for_client(nested)
    assert SECRET not in json.dumps(out)
    assert json.loads(out["payload"])["temp"] == 21
    assert out["line"].endswith(" tail")


def test_the_input_is_not_mutated_and_empty_values_stay_empty():
    data = {"secret": SECRET, "token": ""}
    out = redact_for_client(data)
    assert data["secret"] == SECRET
    assert out["token"] == ""
    assert out["secret"].startswith("[redacted ")


def test_there_is_no_second_key_list():
    """The module must take its keys from the device-facing redaction rules."""
    src = Path(redact_for_client.__code__.co_filename).read_text()
    tree = ast.parse(src)
    literals = [n for n in ast.walk(tree)
                if isinstance(n, (ast.Set, ast.List, ast.Tuple))
                and any(isinstance(e, ast.Constant) and e.value in CREDENTIAL_KEYS
                        for e in n.elts)]
    assert not literals
    assert "CREDENTIAL_KEYS" in src


def _event(device_id=10):
    return {"kind": "http", "device_id": device_id, "summary": "POST /6/dev_signup -> 200",
            "detail": {"headers": {"X-Device": f"id=10&sign={SECRET}"},
                       "resp_body": json.dumps({"result": {"secret": SECRET}})}}


def _panel(tmp_path):
    reg = DeviceRegistry()
    dev = reg.get_or_create(petkit_id=10, device_type="t5", serial_number="SN10")
    dev.state["XDevice"] = SECRET
    dev.config["deviceSecret"] = SECRET
    app = bare_panel(tmp_path, registry=reg)
    hub: EventHub = app["hub"]
    hub.recent = lambda n=80, device_id=None: [_event()]  # type: ignore[method-assign]
    (tmp_path / "capture").mkdir()
    (tmp_path / "capture" / "c.jsonl").write_text(
        json.dumps({"body": {"secret": SECRET}}) + "\n" + f"raw secret={SECRET}\n")
    (tmp_path / "logs" / "10").mkdir(parents=True)
    (tmp_path / "logs" / "10" / "devRun.log").write_text(f"X-Device: id=10&sign={SECRET}\n")
    return app


async def test_the_endpoints_that_relay_device_data_mask_credentials(tmp_path):
    client = authed_test_client(_panel(tmp_path))
    await client.start_server()
    try:
        for path in ("/api/events", "/api/devices", "/api/devices/10",
                     "/api/capture/c.jsonl", "/api/devicelogs/10/devRun.log"):
            r = await client.get(path)
            assert r.status == 200, path
            assert SECRET not in await r.text(), path
    finally:
        await client.close()


async def test_the_websocket_masks_credentials(tmp_path):
    client = authed_test_client(_panel(tmp_path))
    await client.start_server()
    try:
        ws = await client.ws_connect("/api/ws", timeout=aiohttp.ClientWSTimeout(ws_close=0.1))
        frame = await ws.receive_str(timeout=5)
        assert SECRET not in frame
        assert json.loads(frame)["kind"] == "http"
        await ws.close()
    finally:
        await client.close()


async def test_ble_accessories_do_not_carry_their_pairing_secret(tmp_path):
    reg = DeviceRegistry()
    reg.get_or_create(petkit_id=10, device_type="t5", serial_number="SN10")
    client = authed_test_client(bare_panel(tmp_path, registry=reg))
    await client.start_server()
    try:
        r = await client.post("/api/ble", json={"ble_type": "w5", "petkit_id": 700,
                                                 "mac": "AA:BB:CC:DD:EE:FF",
                                                 "secret": SECRET, "link_with": 10})
        assert r.status == 200
        assert SECRET not in await r.text()
        assert SECRET not in await (await client.get("/api/ble")).text()
    finally:
        await client.close()
