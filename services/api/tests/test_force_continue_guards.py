"""Force continue: every guard refuses on its own, and only one command goes out.

A next-gen box paused for "pet approaching" (`workProcess` 22, `safeWarn` 0)
may be told to carry on. A pet inside, an open cover, an open visit, an error
or a silent device each refuse with 409 and send nothing.
"""

from __future__ import annotations

import time

import pytest

from my_petkit.devices.registry import DeviceRegistry
from my_petkit.devices.state_tables import WORK_MODE_IDLE
from my_petkit.features.litter_automation import guards
from my_petkit.ha.commands import ALL_ACTIONS, force_continue_command
from tests.conftest_auth import authed_test_client, bare_panel

DEVICE = 6


def _paused_state(safe_warn: int = 0) -> dict:
    return {
        "workingState": 0,
        "workState": {"workMode": 0, "workProcess": 22, "safeWarn": safe_warn},
        "petInTime": 0,
        "errorMsg": "",
    }


def _registry(device_type: str = "t6", **state) -> DeviceRegistry:
    reg = DeviceRegistry()
    d = reg.get_or_create(petkit_id=DEVICE, device_type=device_type, serial_number="SN6")
    d.state.update(_paused_state())
    d.state.update(state)
    d.last_state_report = time.time()
    return reg


async def _post(tmp_path, event_store, reg, *, step_up=True):
    client = authed_test_client(
        bare_panel(tmp_path, registry=reg, event_store=event_store), step_up=step_up
    )
    await client.start_server()
    try:
        r = await client.post(f"/api/devices/{DEVICE}/force-continue")
        return r.status, await r.json()
    finally:
        await client.close()


async def test_a_box_paused_for_a_pet_nearby_is_told_to_continue(tmp_path, event_store):
    reg = _registry()
    status, body = await _post(tmp_path, event_store, reg)
    assert status == 200, body
    sent = reg.get(DEVICE).command_queue
    assert len(sent) == 1
    assert sent[0]["method"] == "thing.service.start"
    assert sent[0]["params"] == {"continue_action": 0}


async def test_force_continue_needs_a_fresh_step_up(tmp_path, event_store):
    reg = _registry()
    status, body = await _post(tmp_path, event_store, reg, step_up=False)
    assert status == 403
    assert body["error"]["code"] == "step_up_required"
    assert reg.get(DEVICE).command_queue == []


@pytest.mark.parametrize(
    ("safe_warn", "reason"), [(1, "pet_entered"), (3, "cover_open"), (2, "unknown_pause_reason")]
)
async def test_any_other_pause_reason_is_always_refused(tmp_path, event_store, safe_warn, reason):
    reg = _registry(**_paused_state(safe_warn))
    status, body = await _post(tmp_path, event_store, reg)
    assert status == 409
    assert body["error"]["code"] == reason
    assert reg.get(DEVICE).command_queue == []


@pytest.mark.parametrize(
    "state",
    [
        {"workingState": WORK_MODE_IDLE},
        {"workState": {"workMode": 0, "workProcess": 10, "safeWarn": 0}},
        {"workState": None},
    ],
    ids=["idle-with-a-leftover-work-state", "running", "no-work-state"],
)
async def test_a_box_that_is_not_paused_is_refused(tmp_path, event_store, state):
    reg = _registry(**state)
    status, body = await _post(tmp_path, event_store, reg)
    assert status == 409
    assert body["error"]["code"] == "not_paused"
    assert reg.get(DEVICE).command_queue == []


async def test_a_pet_inside_is_refused(tmp_path, event_store):
    reg = _registry(petInTime=1761800000)
    status, body = await _post(tmp_path, event_store, reg)
    assert (status, body["error"]["code"]) == (409, "pet_in_box")
    assert reg.get(DEVICE).command_queue == []


async def test_a_visit_still_open_in_the_last_ten_minutes_is_refused(tmp_path, event_store):
    reg = _registry()
    await event_store.upsert_event(
        {"device_id": DEVICE, "event_type": "pet_in", "ts": time.time() - 120}
    )
    status, body = await _post(tmp_path, event_store, reg)
    assert (status, body["error"]["code"]) == (409, "visit_open")
    assert reg.get(DEVICE).command_queue == []


async def test_a_visit_that_closed_does_not_block(tmp_path, event_store):
    reg = _registry()
    now = time.time()
    await event_store.upsert_event({"device_id": DEVICE, "event_type": "9", "ts": now - 300})
    await event_store.upsert_event({"device_id": DEVICE, "event_type": "10", "ts": now - 200})
    status, _body = await _post(tmp_path, event_store, reg)
    assert status == 200


async def test_an_error_on_the_device_is_refused(tmp_path, event_store):
    reg = _registry(errorMsg="cover module lifted")
    status, body = await _post(tmp_path, event_store, reg)
    assert (status, body["error"]["code"]) == (409, "device_fault")


async def test_a_device_not_heard_from_is_refused(tmp_path, event_store):
    reg = _registry()
    reg.get(DEVICE).last_state_report = time.time() - guards.LIVE_CONTACT_S - 5
    status, body = await _post(tmp_path, event_store, reg)
    assert (status, body["error"]["code"]) == (409, "device_offline")


async def test_without_an_event_history_it_refuses(tmp_path):
    reg = _registry()
    status, body = await _post(tmp_path, None, reg)
    assert (status, body["error"]["code"]) == (409, "history_unavailable")


@pytest.mark.parametrize("device_type", ["t4", "d4"])
async def test_a_model_without_the_pause_reason_is_refused(tmp_path, event_store, device_type):
    reg = _registry(device_type)
    status, body = await _post(tmp_path, event_store, reg)
    assert (status, body["error"]["code"]) == (400, "not_supported")


def test_the_command_is_not_a_button_anything_else_can_press():
    assert "force_continue" not in ALL_ACTIONS
    assert force_continue_command()[1]["params"] == {"continue_action": 0}


async def test_the_status_view_offers_it_only_when_every_guard_passes(tmp_path, event_store):
    reg = _registry()
    client = authed_test_client(bare_panel(tmp_path, registry=reg, event_store=event_store))
    await client.start_server()
    try:
        offered = await (await client.get(f"/api/devices/{DEVICE}/litter-automation")).json()
        reg.get(DEVICE).state["petInTime"] = 1
        refused = await (await client.get(f"/api/devices/{DEVICE}/litter-automation")).json()
    finally:
        await client.close()
    assert offered["forceContinue"] == {"supported": True, "offered": True, "blockers": []}
    assert refused["forceContinue"]["offered"] is False
    assert refused["forceContinue"]["blockers"][0]["reason"] == "pet_in_box"
