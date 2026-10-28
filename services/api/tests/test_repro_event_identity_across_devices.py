"""Two devices reporting the same `event_id` must not share one event row.

`event_uid` is built as `{event_id}:{event_type}` with no device component
(`events/normalize.py::from_event_report` / `from_mqtt`), so
`EventStore.upsert_event` looks a row up by `(device_id, event_uid)`: by
`event_uid` alone, a second device's report with the same id and type UPDATED
the first device's row instead of inserting its own.

Media pairing in `query_timeline` is scoped by device for the same reason: on
`related_event` alone, another device's upload was attached to this device's
event.
"""
from __future__ import annotations

import sqlite3

from my_petkit.devices.base import Device
from my_petkit.events import ingest
from my_petkit.events.store import EventStore

SHARED_EVENT_ID = "1_1784736135"


def _report(device: Device) -> dict:
    row = ingest.from_event_report(device, {
        "event_type": "10", "event_id": SHARED_EVENT_ID,
        "content": '{"pet_weight": 4200}'})
    row.pop("_state", None)
    row.pop("_content", None)
    return row


async def test_same_event_id_from_two_devices_keeps_one_row_per_device(event_store):
    box_a = Device(device_type="t5", petkit_id=101, serial_number="A")
    box_b = Device(device_type="t5", petkit_id=202, serial_number="B")

    await event_store.upsert_event(_report(box_a))
    await event_store.upsert_event(_report(box_b))

    rows = await event_store.all_events()
    assert sorted(r["device_id"] for r in rows) == [101, 202]
    assert len(await event_store.query_timeline(device_id=101)) == 1


async def test_timeline_media_is_not_borrowed_from_another_device(event_store):
    box_a = Device(device_type="t5", petkit_id=101, serial_number="A")
    box_b = Device(device_type="t5", petkit_id=202, serial_number="B")

    await event_store.upsert_event(_report(box_a))
    await event_store.upsert_media(ingest.from_file_info(box_b, {
        "fileId": "b-file", "moduleType": "EVENT_PREVIEW", "fileType": "jpeg",
        "eventId": SHARED_EVENT_ID}))

    [event] = await event_store.query_timeline(device_id=101)
    assert [m["device_id"] for m in event["media"]] == []


async def test_a_retried_report_from_the_same_device_still_updates_its_row(event_store):
    box = Device(device_type="t5", petkit_id=101, serial_number="A")

    first = await event_store.upsert_event(_report(box))
    again = await event_store.upsert_event(_report(box))

    assert first == again
    assert len(await event_store.all_events()) == 1


async def test_connect_collapses_duplicate_keys_before_adding_the_unique_index(tmp_path):
    path = tmp_path / "petkit.db"
    store = EventStore(path)
    await store.connect()
    await store.close()

    # A database from before the index: same key twice on one device, and the
    # same key once on another device.
    db = sqlite3.connect(path)
    db.execute("DROP INDEX uq_events_device_uid")
    db.executemany(
        "INSERT INTO events (event_uid, device_id, event_kind, created_at) VALUES (?,?,?,?)",
        [("e:10", 101, "old", 1.0), ("e:10", 101, "new", 2.0), ("e:10", 202, "b", 3.0),
         (None, 101, "no-uid", 4.0), (None, 101, "no-uid", 5.0)])
    db.commit()
    db.close()

    store = EventStore(path)
    try:
        await store.connect()
        rows = await store.all_events()
    finally:
        await store.close()

    assert sorted((r["device_id"], r["event_kind"]) for r in rows) == [
        (101, "new"), (101, "no-uid"), (101, "no-uid"), (202, "b")]
    db = sqlite3.connect(path)
    try:
        indexes = {r[0] for r in db.execute(
            "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'events'")}
    finally:
        db.close()
    assert "uq_events_device_uid" in indexes
