"""A database is copied before new columns are added to it."""

import itertools
import sqlite3
import types

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


def _drop(path, column):
    db = sqlite3.connect(path)
    db.execute(f"ALTER TABLE events DROP COLUMN {column}")
    db.commit()
    db.close()


async def test_only_the_latest_backup_is_kept(tmp_path, monkeypatch):
    path = tmp_path / "petkit.db"
    # Only this module's clock: each backup is stamped a second apart.
    ticks = itertools.count(1000)
    monkeypatch.setattr("my_petkit.events.store_base.time",
                        types.SimpleNamespace(time=lambda: next(ticks)))
    for _ in range(2):
        store = EventStore(path)
        await store.connect()
        await store.close()
        _drop(path, "passing")
    store = EventStore(path)
    await store.connect()
    await store.close()
    assert len(list(tmp_path.glob("*.bak"))) == 1


async def test_a_failed_backup_does_not_stop_the_migration(tmp_path, monkeypatch):
    path = tmp_path / "petkit.db"
    store = EventStore(path)
    await store.connect()
    await store.close()
    _drop(path, "passing")

    def full_disk(_path):
        raise OSError("No space left on device")
    monkeypatch.setattr("my_petkit.events.store_base._backup_before_migrate", full_disk)
    store = EventStore(path)
    await store.connect()
    await store.close()
    db = sqlite3.connect(path)
    assert "passing" in {r[1] for r in db.execute("PRAGMA table_info(events)")}
    db.close()
