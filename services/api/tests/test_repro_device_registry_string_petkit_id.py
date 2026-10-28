"""A `petkit_id` stored as a JSON string must not take the whole registry down.

`DeviceRegistry._restore` wraps only `Device.from_dict` in its per-entry
try/except; the phantom filter `device.petkit_id <= 0` runs outside it, and
`from_dict` does not coerce the id. A hand-edited or migrated `devices.json`
holding `"petkit_id": "123"` therefore raises TypeError out of the
constructor: every device loses its registry entry (and MQTT credentials), not
just the odd one.
"""
from __future__ import annotations

import json

import pytest

from my_petkit.devices.base import Device
from my_petkit.devices.registry import DeviceRegistry


@pytest.mark.xfail(strict=True, reason="a string petkit_id in devices.json raises "
                   "TypeError at the phantom-id check and aborts the whole registry load")
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
    assert restored is None or restored.petkit_id == 123
