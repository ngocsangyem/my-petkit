"""The event backfill must reach every stored row, not only the oldest 100k.

`events/migrations.py::backfill_event_rows` reads its input with
`store.all_events()`, whose default `limit=100000` silently truncates. Rows past
that point keep a stale `event_kind` forever, and they are the NEWEST rows.
"""
from __future__ import annotations

import sqlite3

import pytest

from my_petkit.events import ingest

ROWS = 100_003


@pytest.mark.xfail(strict=True, reason="backfill reads at most the first 100000 rows "
                   "(all_events default limit), so newer rows are never repaired")
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
