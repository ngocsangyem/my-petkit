"""Two devices reporting the same `event_id` must not share one event row.

`event_uid` is built as `{event_id}:{event_type}` with no device component
(`events/normalize.py::from_event_report` / `from_mqtt`), and
`EventStore.upsert_event` looks a row up by `event_uid` alone. A second
device's report with the same id and type therefore UPDATES the first device's
row instead of inserting its own, rewriting `device_id` underneath it.

Media pairing in `query_timeline` joins on `related_event` alone, so the same
collision also attaches another device's upload to this device's event.
"""
from __future__ import annotations

import pytest

from my_petkit.devices.base import Device
from my_petkit.events import ingest

SHARED_EVENT_ID = "1_1784736135"


def _report(device: Device) -> dict:
    row = ingest.from_event_report(device, {
        "event_type": "10", "event_id": SHARED_EVENT_ID,
        "content": '{"pet_weight": 4200}'})
    row.pop("_state", None)
    row.pop("_content", None)
    return row


@pytest.mark.xfail(strict=True, reason="event dedup key has no device_id: a second "
                   "device's report with the same event_id+event_type overwrites the "
                   "first device's row")
async def test_same_event_id_from_two_devices_keeps_one_row_per_device(event_store):
    box_a = Device(device_type="t5", petkit_id=101, serial_number="A")
    box_b = Device(device_type="t5", petkit_id=202, serial_number="B")

    await event_store.upsert_event(_report(box_a))
    await event_store.upsert_event(_report(box_b))

    rows = await event_store.all_events()
    assert sorted(r["device_id"] for r in rows) == [101, 202]
    assert len(await event_store.query_timeline(device_id=101)) == 1


@pytest.mark.xfail(strict=True, reason="timeline media pairing joins on related_event "
                   "only, so another device's upload with the same event_id is "
                   "attached to this device's event")
async def test_timeline_media_is_not_borrowed_from_another_device(event_store):
    box_a = Device(device_type="t5", petkit_id=101, serial_number="A")
    box_b = Device(device_type="t5", petkit_id=202, serial_number="B")

    await event_store.upsert_event(_report(box_a))
    await event_store.upsert_media(ingest.from_file_info(box_b, {
        "fileId": "b-file", "moduleType": "EVENT_PREVIEW", "fileType": "jpeg",
        "eventId": SHARED_EVENT_ID}))

    [event] = await event_store.query_timeline(device_id=101)
    assert [m["device_id"] for m in event["media"]] == []
