"""Event-derived device state must survive a restart.

Last Clean, Last Visit, Pet Weight, Last Feed and the feeder's daily totals
exist ONLY because an event happened (`events/normalize.py::apply_derived_state`)
— no state report carries them. They live in `device.state`, which
`Device.to_dict` deliberately does not persist, and nothing re-seeds them from
the event store at start-up. After a restart the HA sensors and the panel read
unknown until the next such event, which can be a day away.
"""
from __future__ import annotations

import pytest

from my_petkit.devices.registry import DeviceRegistry
from my_petkit.events.ingest import apply_derived_state

DERIVED_KEYS = ("lastClean", "lastVisit", "petWeight")


@pytest.mark.xfail(strict=True, reason="lastClean/lastVisit/petWeight exist only in "
                   "in-memory device.state and are gone after the registry reloads")
def test_litter_box_derived_state_survives_registry_reload(tmp_path):
    path = tmp_path / "devices.json"
    registry = DeviceRegistry(path)
    box = registry.get_or_create(10000001, "t5", serial_number="SN")
    apply_derived_state(box, "10", {"pet_weight": 4200})   # visit summary
    apply_derived_state(box, "5", {})                      # cleaning done
    assert all(box.state.get(k) for k in DERIVED_KEYS)
    registry.save()

    after_restart = DeviceRegistry(path).get(10000001)

    assert {k: after_restart.state.get(k) for k in DERIVED_KEYS} == \
        {k: box.state[k] for k in DERIVED_KEYS}


@pytest.mark.xfail(strict=True, reason="lastFeed and today's feedState totals are "
                   "in-memory only and reset to unknown on restart")
def test_feeder_daily_totals_survive_registry_reload(tmp_path):
    path = tmp_path / "devices.json"
    registry = DeviceRegistry(path)
    feeder = registry.get_or_create(20000002, "d4h", serial_number="SN2")
    apply_derived_state(feeder, "feed_over", {"real_amount": 10, "day": 20261028})
    assert feeder.state.get("lastFeed") and feeder.state.get("feedState")
    registry.save()

    after_restart = DeviceRegistry(path).get(20000002)

    assert after_restart.state.get("lastFeed") == feeder.state["lastFeed"]
    assert after_restart.state.get("feedState") == feeder.state["feedState"]
