"""Event-derived device state must survive a restart.

Last Clean, Last Visit, Pet Weight, Last Feed and the feeder's daily totals
exist ONLY because an event happened (`events/normalize.py::apply_derived_state`)
— no state report carries them. They live in `device.state`, which
`Device.to_dict` deliberately does not persist, so after a restart the HA
sensors and the panel read unknown until the next such event. Start-up now
replays the stored events (`events/derived_state_replay.py`), stamping each
value with its event's own time rather than the time of the restart.
"""
from __future__ import annotations

import inspect
from datetime import datetime, timezone

from my_petkit.devices.registry import DeviceRegistry
from my_petkit.events import ingest
from my_petkit.events.derived_state_replay import replay_derived_state
from my_petkit.main import lifecycle

DERIVED_KEYS = ("lastClean", "lastVisit", "petWeight")
T0 = 1_784_736_000.0


def _iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, timezone.utc).isoformat()


async def _store_report(event_store, device, event_type, event_id, content, ts):
    row = ingest.from_event_report(device, {
        "event_type": event_type, "event_id": event_id, "content": content})
    row.pop("_state", None)
    row.pop("_content", None)
    row["ts"] = ts
    await event_store.upsert_event(row)


async def test_litter_box_derived_state_survives_registry_reload(tmp_path, event_store):
    path = tmp_path / "devices.json"
    registry = DeviceRegistry(path)
    box = registry.get_or_create(10000001, "t5", serial_number="SN")
    await _store_report(event_store, box, "10", "4_10000001_1", '{"pet_weight": 4200}', T0)
    # A later visit without a weight must not hide the weight of the one before.
    await _store_report(event_store, box, "10", "4_10000001_2", "{}", T0 + 60)
    await _store_report(event_store, box, "5", "4_10000001_2", "{}", T0 + 120)
    registry.save()

    after_restart = DeviceRegistry(path)
    await replay_derived_state(event_store, after_restart.all())
    restored = after_restart.get(10000001)

    assert {k: restored.state.get(k) for k in DERIVED_KEYS} == {
        "lastClean": _iso(T0 + 120), "lastVisit": _iso(T0 + 60), "petWeight": 4200.0}


async def test_feeder_daily_totals_survive_registry_reload(tmp_path, event_store):
    path = tmp_path / "devices.json"
    registry = DeviceRegistry(path)
    feeder = registry.get_or_create(20000002, "d4h", serial_number="SN2")
    feeds = [  # (content, ts): yesterday's feed, then two today
        ('{"real_amount": 7, "day": 20261027}', T0),
        ('{"real_amount": 10, "day": 20261028}', T0 + 3600),
        ('{"real_amount": 5, "day": 20261028}', T0 + 7200),
    ]
    for i, (content, ts) in enumerate(feeds):
        await _store_report(event_store, feeder, "feed_over", f"f{i}", content, ts)
    registry.save()

    after_restart = DeviceRegistry(path)
    await replay_derived_state(event_store, after_restart.all())
    restored = after_restart.get(20000002)

    assert restored.state.get("lastFeed") == _iso(T0 + 7200)
    assert restored.state.get("feedState") == {
        "day": 20261028, "times": 2, "realAmountTotal": 15}


async def test_replay_leaves_a_device_with_no_stored_events_unknown(tmp_path, event_store):
    registry = DeviceRegistry(tmp_path / "devices.json")
    box = registry.get_or_create(10000003, "t5", serial_number="SN3")

    assert await replay_derived_state(event_store, registry.all()) == 0
    assert not any(box.state.get(k) for k in (*DERIVED_KEYS, "lastFeed", "feedState"))


def test_start_up_replays_derived_state_after_the_backfill():
    start = inspect.getsource(lifecycle.start_background)
    backfill = start.index("await backfill_event_rows(event_store)")
    replay = start.index("await replay_derived_state(event_store, registry.all())")
    assert backfill < replay
