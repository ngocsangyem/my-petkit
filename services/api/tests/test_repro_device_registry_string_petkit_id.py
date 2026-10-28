"""A `petkit_id` stored as a JSON string must not take the whole registry down.

`Device.from_dict` does not coerce the id, and `DeviceRegistry._restore`'s
phantom filter `device.petkit_id <= 0` used to compare it uncoerced. A
hand-edited or migrated `devices.json` holding `"petkit_id": "123"` raised
TypeError out of the constructor: every device lost its registry entry (and
MQTT credentials), not just the odd one. The id is now coerced inside the
per-entry try, and an id that is not a number skips only that entry.
"""
from __future__ import annotations

import json

from my_petkit.devices.base import Device
from my_petkit.devices.registry import DeviceRegistry


def test_registry_load_survives_a_string_petkit_id(tmp_path):
    good = Device(device_type="t5", petkit_id=456, serial_number="GOOD")
    odd = Device(device_type="t5", petkit_id=123, serial_number="ODD")
    path = tmp_path / "devices.json"
    path.write_text(json.dumps({
        "456": good.to_dict(),
        "123": {**odd.to_dict(), "petkit_id": "123"},
    }))

    registry = DeviceRegistry(path)

    assert registry.get(456) is not None
    restored = registry.get(123)
    assert restored is not None
    assert restored.petkit_id == 123


def test_registry_load_skips_only_an_entry_whose_petkit_id_is_not_a_number(tmp_path, caplog):
    good = Device(device_type="t5", petkit_id=456, serial_number="GOOD")
    bad = Device(device_type="t5", petkit_id=789, serial_number="BAD")
    path = tmp_path / "devices.json"
    path.write_text(json.dumps({
        "456": good.to_dict(),
        "789": {**bad.to_dict(), "petkit_id": "not-a-number"},
    }))

    registry = DeviceRegistry(path)

    assert registry.get(456) is not None
    assert [d.petkit_id for d in registry.all()] == [456]
    assert "Skipping unreadable device entry '789'" in caplog.text
