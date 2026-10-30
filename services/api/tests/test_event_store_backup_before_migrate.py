"""A database is copied before new columns are added to it."""

import sqlite3

from my_petkit.events.store import EventStore


async def test_an_old_database_is_backed_up_before_it_is_migrated(tmp_path):
    path = tmp_path / "petkit.db"
    store = EventStore(path)
    await store.connect()
    await store.close()
    db = sqlite3.connect(path)
    db.execute("ALTER TABLE events DROP COLUMN passing")
    db.commit()
    db.close()

    store = EventStore(path)
    await store.connect()
    await store.close()
    backups = list(tmp_path.glob("petkit.db.pre-migrate-*.bak"))
    assert len(backups) == 1
    old = sqlite3.connect(backups[0])
    assert "passing" not in {r[1] for r in old.execute("PRAGMA table_info(events)")}
    old.close()


async def test_a_current_database_is_not_backed_up(tmp_path):
    for _ in range(2):
        store = EventStore(tmp_path / "petkit.db")
        await store.connect()
        await store.close()
    assert not list(tmp_path.glob("*.bak"))
