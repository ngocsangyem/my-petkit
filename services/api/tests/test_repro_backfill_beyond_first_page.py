"""The event backfill must reach every stored row, not only the oldest 100k.

`events/migrations.py::backfill_event_rows` used to read its input with one
`store.all_events()` call, whose default `limit=100000` silently truncates:
rows past that point kept a stale `event_kind` forever, and they are the
NEWEST rows. It now pages through the table by id.
"""
from __future__ import annotations

import sqlite3

from my_petkit.events import ingest

ROWS = 100_003


async def test_backfill_repairs_rows_past_the_first_hundred_thousand(event_store, tmp_path):
    await event_store.connect()
    good_kind = ingest.classify_event_kind("10", {}, "t5")
    with sqlite3.connect(tmp_path / "petkit.db") as db:
        db.executemany(
            "INSERT INTO events (event_uid, related_event, device_id, device_type, "
            "event_type, event_kind, ts, created_at) VALUES (?, ?, 1, 't5', '10', ?, ?, ?)",
            ((f"e{i}:10", f"e{i}", good_kind if i < ROWS - 1 else "other", float(i), float(i))
             for i in range(ROWS)))

    fixed = await ingest.backfill_event_rows(event_store)

    newest = await event_store.get_event(ROWS)
    assert newest["event_kind"] == good_kind
    assert fixed == 1
