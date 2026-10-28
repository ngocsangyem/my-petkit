"""The bare-token repair must not rewrite text inside a quoted string.

`events/normalize.py::_repair_bare_values` runs its regex over the whole
payload, string contents included. A string value that happens to contain
`: word,` (an error text, a log line) gets quotes injected into it, the
"repaired" text no longer parses, and `_as_dict` falls back to `{}` — so a
payload whose only real defect was one bare token loses EVERYTHING, including
the `related_event` parent link the repair exists to save.
"""
from __future__ import annotations

import pytest

from my_petkit.devices.base import Device
from my_petkit.events import ingest

PAYLOAD = '{"related_event":3_10000001_1784741818,"msg":"err: timeout, retry","count":1}'


@pytest.mark.xfail(strict=True, reason="bare-token repair also rewrites ': word,' inside "
                   "a quoted string, so the repaired JSON fails to parse and the whole "
                   "content is dropped")
def test_repair_leaves_colon_text_inside_a_string_value_alone():
    assert ingest._as_dict(PAYLOAD) == {
        "related_event": "3_10000001_1784741818",
        "msg": "err: timeout, retry",
        "count": 1,
    }


@pytest.mark.xfail(strict=True, reason="an event whose content has a bare token AND a "
                   "string containing ': word,' loses its parent link")
def test_event_report_keeps_parent_link_when_a_string_contains_colon_text():
    dev = Device(device_type="t5", petkit_id=10000001, serial_number="SN")
    row = ingest.from_event_report(dev, {
        "event_type": "24", "event_id": "4_10000001_1784743819", "content": PAYLOAD})
    assert row["parent_event"] == "3_10000001_1784741818"
