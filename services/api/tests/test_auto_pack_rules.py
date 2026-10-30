"""The T6's auto-pack rule: its three triggers, every guard, and how it gives up.

The evaluator runs against a real event store with a frozen clock and a sender
that records what it would have sent. A held-back rule sends nothing and says
why; a pack error or a second unanswered pack turns the rule off.
"""

from __future__ import annotations

import pytest

from my_petkit.devices.registry import DeviceRegistry
from my_petkit.devices.state_tables import WORK_MODE_IDLE
from my_petkit.features.litter_automation import service
from my_petkit.features.litter_automation.schemas import (
    DEFAULT_RULE,
    RuleError,
    clean_rule,
    in_quiet_hours,
)
from tests.conftest_auth import authed_test_client, bare_panel

DEVICE = 6
#: 2025-10-30 04:53:20 UTC, 11:53 in Asia/Saigon (the device's zone below).
NOW = 1_761_800_000.0


def _idle_t6(reg: DeviceRegistry, **state):
    d = reg.get_or_create(petkit_id=DEVICE, device_type="t6", serial_number="SN6")
    d.config["locale"] = "Asia/Saigon"
    d.state.update(
        {
            "workingState": WORK_MODE_IDLE,
            "petInTime": 0,
            "errorMsg": "",
            "packageCount": 12,
            "boxFull": 0,
        }
    )
    d.state.update(state)
    d.mqtt_connected = True
    d.last_mqtt = NOW
    return d


class _Harness:
    def __init__(self, event_store, **state):
        self.reg = DeviceRegistry()
        self.device = _idle_t6(self.reg, **state)
        self.store = event_store
        self.sent: list[tuple[str, dict]] = []
        self.now = NOW

        async def send(device, suffix, envelope):
            self.sent.append((suffix, envelope))
            return "mqtt"

        self.evaluator = service.AutoPackEvaluator(
            self.reg, event_store, send, clock_now=lambda: self.now
        )

    def enable(self, enabled_at: float = NOW - 3600, **rule):
        service.save_rule(self.device, {**DEFAULT_RULE, "enabled": True, **rule}, enabled_at)

    async def event(self, event_type: str, ago: float):
        await self.store.upsert_event(
            {"device_id": DEVICE, "event_type": event_type, "ts": self.now - ago}
        )

    async def tick(self):
        await self.evaluator.evaluate(self.device)
        return service.load_status(self.device)


async def _cleanings(h: _Harness, n: int):
    for i in range(n):
        await h.event("clean_over", ago=600 + i * 60)


# --- triggers -----------------------------------------------------------------


async def test_after_cleanings_packs_once_the_count_is_reached(event_store):
    h = _Harness(event_store)
    h.enable(trigger="after_cleanings", cleanings=3)
    await _cleanings(h, 2)
    assert (await h.tick())["heldBackBy"] == "not_due"
    await h.event("5", ago=300)  # the HTTP spelling of a finished cleaning
    status = await h.tick()
    assert h.sent == [("start", h.sent[0][1])]
    assert h.sent[0][1]["params"] == {"start_action": 8}
    assert status["pendingSince"] == NOW


async def test_cleanings_before_the_rule_was_turned_on_do_not_count(event_store):
    h = _Harness(event_store)
    await _cleanings(h, 5)
    h.enable(enabled_at=NOW - 60, trigger="after_cleanings", cleanings=1)
    assert (await h.tick())["heldBackBy"] == "not_due"
    assert h.sent == []


async def test_cleanings_before_the_last_pack_do_not_count(event_store):
    h = _Harness(event_store)
    h.enable(enabled_at=NOW - 7200, trigger="after_cleanings", cleanings=2)
    await _cleanings(h, 3)
    await h.event("package_over", ago=100)
    assert (await h.tick())["heldBackBy"] == "not_due"


@pytest.mark.parametrize(("box_full", "fires"), [(1, True), (0, False)])
async def test_bin_full_follows_the_device_flag(event_store, box_full, fires):
    h = _Harness(event_store, boxFull=box_full)
    h.enable(trigger="bin_full")
    await h.tick()
    assert bool(h.sent) is fires


@pytest.mark.parametrize(("at", "fires"), [("11:00", True), ("12:00", False)])
async def test_daily_at_is_read_in_the_device_zone(event_store, at, fires):
    h = _Harness(event_store)
    h.enable(trigger="daily_at", at=at)
    await h.tick()
    assert bool(h.sent) is fires


async def test_daily_at_does_not_fire_again_after_todays_pack(event_store):
    h = _Harness(event_store)
    h.enable(trigger="daily_at", at="11:00")
    await h.event("package_over", ago=600)  # 11:43 local, after 11:00
    assert (await h.tick())["heldBackBy"] == "not_due"


# --- what holds a due rule back -------------------------------------------------


@pytest.mark.parametrize(
    ("state", "reason"),
    [
        ({"workingState": 0}, "device_busy"),
        ({"petInTime": 1761799990}, "pet_in_box"),
        ({"packageCount": 0}, "no_bags"),
        ({"packageCount": None}, "no_bags"),
        ({"errorMsg": "bag not removed"}, "device_fault"),
    ],
)
async def test_a_guard_holds_the_pack_back(event_store, state, reason):
    h = _Harness(event_store, boxFull=1, **state)
    h.enable(trigger="bin_full")
    assert (await h.tick())["heldBackBy"] == reason
    assert h.sent == []


async def test_a_device_off_mqtt_is_held_back(event_store):
    h = _Harness(event_store, boxFull=1)
    h.device.mqtt_connected = False
    h.enable(trigger="bin_full")
    assert (await h.tick())["heldBackBy"] == "not_on_mqtt"


async def test_a_silent_device_is_held_back(event_store):
    h = _Harness(event_store, boxFull=1)
    h.device.last_mqtt = NOW - 600
    h.enable(trigger="bin_full")
    assert (await h.tick())["heldBackBy"] == "device_offline"


async def test_an_open_visit_holds_it_back(event_store):
    h = _Harness(event_store, boxFull=1)
    h.enable(trigger="bin_full")
    await h.event("pet_in", ago=240)
    assert (await h.tick())["heldBackBy"] == "visit_open"


async def test_a_pet_nearby_in_the_last_two_minutes_holds_it_back(event_store):
    h = _Harness(event_store, boxFull=1)
    h.enable(trigger="bin_full")
    await h.event("pet_wander", ago=60)
    assert (await h.tick())["heldBackBy"] == "pet_nearby"
    h.now += 120
    h.device.last_mqtt = h.now
    await h.tick()
    assert len(h.sent) == 1


async def test_quiet_hours_hold_it_back(event_store):
    h = _Harness(event_store, boxFull=1)
    h.enable(trigger="bin_full", quietHours={"start": "11:00", "end": "13:00"})
    assert (await h.tick())["heldBackBy"] == "quiet_hours"
    assert h.sent == []


def test_quiet_hours_cross_midnight():
    rule = {**DEFAULT_RULE, "quietHours": {"start": "22:00", "end": "07:00"}}
    assert in_quiet_hours(rule, 23 * 60)
    assert in_quiet_hours(rule, 6 * 60 + 59)
    assert not in_quiet_hours(rule, 7 * 60)
    assert not in_quiet_hours(rule, 12 * 60)


# --- after the pack is sent -------------------------------------------------------


async def test_package_over_settles_the_pack(event_store):
    h = _Harness(event_store, boxFull=1)
    h.enable(trigger="bin_full")
    await h.tick()
    h.now += 90
    await h.event("package_over", ago=10)
    status = await h.tick()
    assert status["lastResult"] == "packed"
    assert status["pendingSince"] is None
    assert status["lastPackedAt"] == h.now - 10


async def test_a_pack_error_turns_the_rule_off(event_store):
    h = _Harness(event_store, boxFull=1)
    h.enable(trigger="bin_full")
    await h.tick()
    h.now += 60
    h.device.state["errorMsg"] = "no bags"
    status = await h.tick()
    assert service.load_rule(h.device)["enabled"] is False
    assert status["disabledReason"] == "pack_error: no bags"
    assert len(h.sent) == 1


async def test_an_error_event_turns_the_rule_off(event_store):
    h = _Harness(event_store, boxFull=1)
    h.enable(trigger="bin_full")
    await h.tick()
    h.now += 60
    await h.event("error_start", ago=5)
    await h.tick()
    assert service.load_rule(h.device)["enabled"] is False


async def test_silence_allows_one_retry_after_the_gap_then_turns_the_rule_off(event_store):
    h = _Harness(event_store, boxFull=1)
    h.enable(trigger="bin_full")
    await h.tick()

    h.now += service.PACK_RESPONSE_WINDOW_S
    h.device.last_mqtt = h.now
    status = await h.tick()
    assert status["lastResult"] == "no_response"
    assert status["heldBackBy"] == "cooldown"
    assert len(h.sent) == 1

    h.now = NOW + service.ATTEMPT_GAP_S
    h.device.last_mqtt = h.now
    await h.tick()
    assert len(h.sent) == 2

    h.now += service.PACK_RESPONSE_WINDOW_S
    h.device.last_mqtt = h.now
    status = await h.tick()
    assert service.load_rule(h.device)["enabled"] is False
    assert status["disabledReason"] == "no_response"
    assert len(h.sent) == 2


async def test_evaluate_all_skips_rules_that_are_off_and_other_models(event_store):
    h = _Harness(event_store, boxFull=1)
    t5 = h.reg.get_or_create(petkit_id=5, device_type="t5", serial_number="SN5")
    service.save_rule(t5, {**DEFAULT_RULE, "enabled": True, "trigger": "bin_full"}, NOW)
    t5.state["boxFull"] = 1
    await h.evaluator.evaluate_all()
    assert h.sent == []


# --- the rule itself and its route --------------------------------------------------


def test_supports_auto_pack_only_on_the_model_with_a_pack_button():
    reg = DeviceRegistry()
    assert service.supports_auto_pack(reg.get_or_create(petkit_id=1, device_type="t6"))
    assert not service.supports_auto_pack(reg.get_or_create(petkit_id=2, device_type="t5"))


@pytest.mark.parametrize(
    "patch",
    [
        {"trigger": "hourly"},
        {"cleanings": 0},
        {"cleanings": True},
        {"at": "25:00"},
        {"enabled": "yes"},
        {"quietHours": {"start": "10:00", "end": "10:00"}},
        {"quietHours": {"start": "10:00"}},
        {"extra": 1},
    ],
)
def test_a_malformed_rule_is_refused(patch):
    with pytest.raises(RuleError):
        clean_rule({**DEFAULT_RULE, **patch})


def test_a_rule_missing_a_field_is_refused():
    body = dict(DEFAULT_RULE)
    del body["at"]
    with pytest.raises(RuleError, match="missing field at"):
        clean_rule(body)


async def test_the_route_stores_the_rule_where_the_device_never_sees_it(tmp_path, event_store):
    reg = DeviceRegistry()
    d = _idle_t6(reg)
    client = authed_test_client(
        bare_panel(tmp_path, registry=reg, event_store=event_store), step_up=False
    )
    await client.start_server()
    try:
        rule = {**DEFAULT_RULE, "enabled": True, "trigger": "daily_at", "at": "19:30"}
        r = await client.put(f"/api/devices/{DEVICE}/auto-pack", json=rule)
        body = await r.json()
        bad = await client.put(f"/api/devices/{DEVICE}/auto-pack", json={"enabled": True})
        bad_body = await bad.json()
        view = await (await client.get(f"/api/devices/{DEVICE}/litter-automation")).json()
    finally:
        await client.close()
    assert r.status == 200, body
    assert body["rule"] == rule
    assert body["status"]["enabledAt"] is not None
    assert d.config["local"]["autoPack"]["rule"] == rule
    assert "autoPack" not in d.config.get("settings", {})
    assert bad.status == 400
    assert bad_body["error"]["code"] == "invalid_rule"
    assert view["autoPack"]["supported"] is True
    assert view["autoPack"]["rule"] == rule


async def test_the_route_refuses_a_model_without_pack(tmp_path):
    reg = DeviceRegistry()
    reg.get_or_create(petkit_id=DEVICE, device_type="t5", serial_number="SN6")
    client = authed_test_client(bare_panel(tmp_path, registry=reg))
    await client.start_server()
    try:
        r = await client.put(f"/api/devices/{DEVICE}/auto-pack", json=dict(DEFAULT_RULE))
    finally:
        await client.close()
    assert r.status == 400
