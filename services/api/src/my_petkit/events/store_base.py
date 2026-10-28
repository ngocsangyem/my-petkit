"""Connection, migration and write-serialization plumbing for `EventStore`.

Split out of `events/store.py` so each table's queries can live in its own
module (`store_media.py`, `store_pets.py`, `store_blocked_attempts.py`). Every
query class derives from `StoreBase`, and `events/store.py::EventStore`
combines them; nothing outside `events/` imports this module directly.
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from contextvars import ContextVar
from pathlib import Path
from typing import Any

from sqlalchemy import URL, func, select
from sqlalchemy import event as sa_event
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import (
    AsyncConnection,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from my_petkit.events.models import Base, BlockedAttempt, Event, Media, Pet, PetFace

log = logging.getLogger("my_petkit.events.store")

# How long a connection waits for a lock before giving up with "database is
# locked". Writes are already serialized in-process (see EventStore), so this
# only covers contention from outside it: a WAL checkpoint, a backup, or
# someone poking the file with the sqlite3 CLI.
BUSY_TIMEOUT_MS = 10_000

# These sessions are short-lived and hold no loaded entities, so there is
# nothing for a bulk UPDATE/DELETE to synchronize back into an identity map.
_NO_SYNC = {"synchronize_session": False}

# Columns added after the first release — SQLite has no "ADD COLUMN IF NOT
# EXISTS", so `_migrate` adds any that a pre-existing database is missing.
_ADDED_COLUMNS = {
    "events": {"parent_event": "TEXT", "pet_ref": "INTEGER"},
    "media": {"stitch_state": "TEXT"},
    "pets": {"device_pet_ids_json": "TEXT"},
}

# `create_all` never adds an index to a table that already exists, so a live
# database gets the per-device dedup index here.
_EVENT_UID_INDEX = "uq_events_device_uid"


def _writable(model: type[Base]) -> tuple[str, ...]:
    """Column names a caller's dict may set, in schema order.

    `id` belongs to SQLite and `created_at` is insert-only, so neither is
    writable through an upsert.
    """
    return tuple(c.name for c in model.__table__.columns
                 if c.name not in ("id", "created_at"))


_EVENT_COLUMNS = _writable(Event)
_MEDIA_COLUMNS = _writable(Media)
_PET_COLUMNS = _writable(Pet)
_BLOCKED_COLUMNS = _writable(BlockedAttempt)

#: What a device will accept before its own "Too many face picture" guard
#: trips. The firmware has the guard but its limit was not recoverable from the
#: strings; the official app's own upload grid is a 3x2 of six slots, so six is
#: what PetKit itself considers the maximum. A capture showing four faces is no
#: evidence against it: that is simply how many slots the household had filled.
MAX_FACES_PER_PET = 6


def _accepted(row: dict[str, Any], columns: tuple[str, ...]) -> dict[str, Any]:
    """The subset of `row` that names a writable column."""
    return {k: row[k] for k in columns if k in row}


def _created_at(row: dict[str, Any]) -> float:
    """Insert timestamp — the caller's if it supplied one, otherwise now.

    Honoured only on INSERT: `created_at` drives every age-based rule (media
    retention, stitch quiescence), so nothing may rewrite it afterwards.
    """
    given = row.get("created_at")
    return float(given) if isinstance(given, (int, float)) else time.time()


def _apply_pragmas(dbapi_connection: Any, _connection_record: Any) -> None:
    """Per-connection PRAGMAs, applied to every connection the pool opens.

    `journal_mode` is a property of the file and survives, but `busy_timeout`
    is per connection — a pooled connection without it fails instantly on the
    first lock it meets.
    """
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute(f"PRAGMA busy_timeout={BUSY_TIMEOUT_MS}")
    cursor.close()


# The session of an open `transaction()`, scoped to the task that opened it.
# A plain attribute would be wrong: another task writing while a batch is open
# would join a session it does not own, and an AsyncSession cannot be used
# concurrently. Task-local, such a write simply waits on the write lock.
_batch: ContextVar[tuple[StoreBase, AsyncSession] | None] = ContextVar(
    "petkit_event_store_batch", default=None)



class StoreBase:
    """Async facade over the `events`, `media` and `pets` tables.

    Construction is synchronous and does no I/O; `connect()` creates the
    schema, migrates an older database in place and warms the pool. Methods
    connect on first use, so forgetting it degrades to a late migration rather
    than a crash — but main.py should still await it at startup, before
    anything queries.

    CONCURRENCY. SQLite permits exactly one writer, and an async engine hands
    out a pool of connections: the media pipeline, MQTT ingest, the retention
    sweeper, the stitcher and panel requests are all live at once on the same
    loop. Writes are therefore serialized behind a single `asyncio.Lock`.

    The trade-off is that writes get no parallelism from the pool — which
    costs nothing, since SQLite would serialize them anyway, and buys a hard
    guarantee that no coroutine ever sees SQLITE_BUSY caused by this process.
    Reads stay concurrent: under WAL a reader never blocks a writer, so the
    panel's timeline query does not contend with the pipeline's inserts.
    """

    def __init__(self, db_path: str | Path) -> None:
        """Prepare the engine for `db_path`, creating its parent directory.

        No connection is opened and no schema is created here - `connect()`
        does that, and every query awaits `_ensure_connected()` first, so an
        `EventStore` can be constructed at import/wiring time.
        """
        self._path = Path(db_path)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        # Built from components, never interpolated into a URL string: a "?" in
        # the path would start a query string and silently truncate it, opening
        # (and creating) a different, empty database while the real one sits
        # untouched — the worst possible failure, since everything then "works".
        url = URL.create("sqlite+aiosqlite", database=str(self._path))
        self._engine = create_async_engine(url)
        sa_event.listen(self._engine.sync_engine, "connect", _apply_pragmas)
        self._sessions = async_sessionmaker(self._engine, expire_on_commit=False)
        self._write_lock = asyncio.Lock()
        self._ready = False

    async def connect(self) -> None:
        """Create the schema and migrate an existing database in place.

        Idempotent: safe to await from several startup paths, and again after
        `close()`.
        """
        async with self._write_lock:
            if self._ready:
                return
            async with self._engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
                await self._migrate(conn)
            self._ready = True
        # Outside the lock on purpose: this runs ordinary writes, which take
        # the same lock again. `_ready` is already set, so a failure here must
        # not leave the store looking connected but half-migrated — it is
        # logged and retried on the next `connect()` rather than swallowed.
        try:
            await self._migrate_legacy_faces()
        except SQLAlchemyError:
            self._ready = False
            raise

    async def close(self) -> None:
        """Dispose the connection pool. Idempotent."""
        self._ready = False
        await self._engine.dispose()

    async def _migrate(self, conn: AsyncConnection) -> None:
        """Add columns introduced after a database was first created.

        `create_all` only creates missing TABLES, so an add-on that has been
        running since an earlier version keeps its old column set and every
        query naming a new column fails against it.
        """
        for table, columns in _ADDED_COLUMNS.items():
            info = await conn.exec_driver_sql(f"PRAGMA table_info({table})")
            existing = {row[1] for row in info.fetchall()}
            for name, coltype in columns.items():
                if name not in existing:
                    await conn.exec_driver_sql(
                        f"ALTER TABLE {table} ADD COLUMN {name} {coltype}")
                    log.info("Migrated %s: added column %s", table, name)
        await self._migrate_event_uid_index(conn)

    async def _migrate_event_uid_index(self, conn: AsyncConnection) -> None:
        """Create the unique `(device_id, event_uid)` index on a live database.

        Creating it would fail on a database already holding two rows with the
        same key, so those are collapsed first, keeping the newest row of each
        key: an upsert overwrites a row with the latest report, and the newest
        row is the closest thing to that. Media pairs on `related_event`, not on
        the event row's id, so no media is orphaned. Runs once: the index's
        presence is what marks it done.
        """
        found = await conn.exec_driver_sql(
            "SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ?",
            (_EVENT_UID_INDEX,))
        if found.first() is not None:
            return
        removed = await conn.exec_driver_sql(
            "DELETE FROM events WHERE event_uid IS NOT NULL AND id NOT IN ("
            "SELECT MAX(id) FROM events WHERE event_uid IS NOT NULL "
            "GROUP BY device_id, event_uid)")
        if removed.rowcount:
            log.warning("Removed %d duplicate event rows before indexing "
                        "(device_id, event_uid)", removed.rowcount)
        await conn.exec_driver_sql(
            f"CREATE UNIQUE INDEX IF NOT EXISTS {_EVENT_UID_INDEX} "
            "ON events (device_id, event_uid)")
        log.info("Migrated events: added index %s", _EVENT_UID_INDEX)

    async def _migrate_legacy_faces(self) -> None:
        """Carry a pre-`pet_faces` single photo into the new table.

        `pets.photo_path` used to hold the one reference photo per pet. Rather
        than leave those installs with a pet the device is told nothing about,
        the file is adopted as that pet's first `PetFace`. Only pets with no
        face rows at all are touched, so this is idempotent and cannot
        duplicate a photo the user has since re-uploaded.

        A path whose FILE IS GONE is skipped. `ai/pets.py::add_face` takes care
        never to leave a row pointing at a missing file — the device would be
        handed a URL that 404s and would retry it forever — and a migration
        must not create the very row the write path refuses to.
        """
        async with self._write() as session:
            legacy = await session.scalars(select(Pet).where(Pet.photo_path.isnot(None)))
            for pet in list(legacy):
                already = await session.scalar(
                    select(func.count()).select_from(PetFace).where(PetFace.pet_id == pet.id))
                if already:
                    continue
                if not os.path.isfile(pet.photo_path):
                    log.warning("Pet %s's legacy face photo is missing (%s); not migrating it",
                                pet.id, pet.photo_path)
                    continue
                session.add(PetFace(pet_id=pet.id, photo_path=pet.photo_path,
                                    created_at=pet.created_at))
                log.info("Migrated pet %s's legacy face photo into pet_faces", pet.id)

    async def _ensure_connected(self) -> None:
        """Create/migrate the schema on first use, so callers never have to."""
        if not self._ready:
            await self.connect()

    @asynccontextmanager
    async def _read(self) -> AsyncIterator[AsyncSession]:
        """A session for statements that only read.

        Deliberately takes no write lock: under WAL a reader never blocks and
        is never blocked, so the panel's timeline query does not contend with
        the media pipeline's inserts.
        """
        await self._ensure_connected()
        async with self._sessions() as session:
            yield session

    @asynccontextmanager
    async def _write(self) -> AsyncIterator[AsyncSession]:
        """A session for statements that write.

        Joins the calling task's open `transaction()` when there is one — the
        batch owns the commit — and otherwise takes the write lock for the
        duration of a single committed statement group.
        """
        batch = _batch.get()
        if batch is not None and batch[0] is self:
            yield batch[1]
            return
        await self._ensure_connected()
        async with self._write_lock:
            async with self._sessions() as session:
                yield session
                await session.commit()

    @asynccontextmanager
    async def transaction(self) -> AsyncIterator[StoreBase]:
        """Group many writes into one commit.

        Every write method commits on its own, which is right for the one-row
        writes the device drives but wrong for a pass that rewrites thousands
        of rows: that pays an fsync each time and leaves the table half-updated
        if it dies midway. Used by `events/migrations.py::backfill_event_rows`.
        """
        await self._ensure_connected()
        async with self._write_lock:
            async with self._sessions() as session:
                token = _batch.set((self, session))
                try:
                    yield self
                    await session.commit()
                finally:
                    _batch.reset(token)
