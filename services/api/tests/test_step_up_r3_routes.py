"""R3 needs a fresh step-up: the password again, valid five minutes.

Covers the static R3 routes and the ones that become R3 per request (raw
command, `?reveal=1`, device-log download), the step-up endpoint itself, and
the structured audit line every R3 action writes.
"""

from __future__ import annotations

import pytest

from my_petkit.devices.registry import DeviceRegistry
from my_petkit.features.auth.step_up import STEP_UP_SECONDS, StepUps
from tests.conftest_auth import (
    ADMIN_PASSWORD,
    authed_test_client,
    bare_panel,
    install_auth,
    set_admin,
)


def _panel(tmp_path, event_store=None):
    reg = DeviceRegistry()
    reg.get_or_create(petkit_id=10, device_type="t5", serial_number="SN10")
    (tmp_path / "capture").mkdir()
    (tmp_path / "capture" / "c.jsonl").write_text('{"a": 1}\n')
    (tmp_path / "logs" / "10").mkdir(parents=True)
    (tmp_path / "logs" / "10" / "devRun.log").write_text("line\n")
    return bare_panel(tmp_path, registry=reg, live_config={"capture": False},
                      event_store=event_store)


#: (method, path, json body) for each R3 action. Bodies are valid enough to get
#: past parsing, so a 403 can only be the step-up.
R3_REQUESTS = [
    ("POST", "/api/devices/10/patcher", {"patcher": "ssh", "action": "apply"}),
    ("POST", "/api/devices/10/command", {"suffix": "user/get", "payload": {}}),
    ("POST", "/api/settings", {"capture": True}),
    ("GET", "/api/capture/c.jsonl/download", None),
    ("GET", "/api/devicelogs/10/devRun.log?download=1", None),
    ("GET", "/api/blocked?reveal=1", None),
    ("POST", "/api/auth/pairing", None),
]


@pytest.mark.parametrize(("method", "path", "body"), R3_REQUESTS)
async def test_an_r3_action_without_step_up_is_refused(tmp_path, event_store, method, path, body):
    client = authed_test_client(_panel(tmp_path, event_store), step_up=False)
    await client.start_server()
    try:
        r = await client.request(method, path, json=body)
        assert r.status == 403, path
        assert (await r.json())["error"]["code"] == "step_up_required"
    finally:
        await client.close()


@pytest.mark.parametrize(("method", "path", "body"), R3_REQUESTS)
async def test_an_r3_action_with_step_up_gets_past_the_gate(tmp_path, event_store,
                                                           method, path, body):
    client = authed_test_client(_panel(tmp_path, event_store), step_up=True)
    await client.start_server()
    try:
        r = await client.request(method, path, json=body)
        if r.status == 403:
            assert (await r.json())["error"]["code"] != "step_up_required", path
    finally:
        await client.close()


async def test_the_entity_command_form_stays_r2(tmp_path):
    client = authed_test_client(_panel(tmp_path), step_up=False)
    await client.start_server()
    try:
        r = await client.post("/api/devices/10/command", json={"action": "nope"})
        assert r.status == 400  # refused for the action, not for a step-up
    finally:
        await client.close()


async def test_stepping_up_with_the_password_unlocks_r3(tmp_path):
    app = _panel(tmp_path)
    set_admin(install_auth(app))
    client = authed_test_client(app, step_up=False)
    await client.start_server()
    try:
        wrong = await client.post("/api/auth/step-up", json={"password": "not the one!"})
        assert wrong.status == 401
        assert (await client.post("/api/auth/pairing")).status == 403
        ok = await client.post("/api/auth/step-up", json={"password": ADMIN_PASSWORD})
        assert ok.status == 200
        assert (await ok.json())["expires_in"] == STEP_UP_SECONDS
        assert (await client.post("/api/auth/pairing")).status == 200
    finally:
        await client.close()


def test_a_step_up_lasts_five_minutes_per_principal():
    now = [0.0]
    ups = StepUps(lambda: now[0])
    ups.grant("token:1")
    assert ups.active("token:1") and not ups.active("token:2")
    now[0] += STEP_UP_SECONDS - 1
    assert ups.active("token:1")
    now[0] += 2
    assert not ups.active("token:1")


async def test_an_r3_action_writes_one_audit_line_without_values(tmp_path, caplog):
    client = authed_test_client(_panel(tmp_path), step_up=True)
    await client.start_server()
    try:
        with caplog.at_level("INFO", logger="my_petkit.audit"):
            await client.post("/api/devices/10/command",
                              json={"suffix": "user/get", "payload": {"secret": "s3cr3t-value"}})
        lines = [r.getMessage() for r in caplog.records if r.name == "my_petkit.audit"]
        assert any(line.startswith("r3_action action=raw_command") and "device=10" in line
                   and "principal=token:" in line for line in lines)
        assert "s3cr3t-value" not in caplog.text
    finally:
        await client.close()
