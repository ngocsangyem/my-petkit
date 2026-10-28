"""Persistent event/media/pet store — SQLite via SQLAlchemy's async engine.

The schema lives in `events/models.py`; this module is only the queries. Two
properties of it are load-bearing:

* **Every method returns plain dicts**, never ORM instances — call sites index
  rows with `row["key"]`/`row.get("key")` and `query_timeline` synthesises an
  extra `"media"` key onto each event row.
* **Callers pass loose dicts.** Keys that are not writable columns are dropped
  silently (`_accepted`), so a payload the device grew a field in can never
  turn into an exception on the storage path.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from sqlalchemy import delete, select, update

from my_petkit.events.models import Event, Media
from my_petkit.events.store_base import (
    BUSY_TIMEOUT_MS as BUSY_TIMEOUT_MS,  # re-exported: callers import it from here
    MAX_FACES_PER_PET as MAX_FACES_PER_PET,  # re-exported: callers import it from here
    _EVENT_COLUMNS,
    _NO_SYNC,
    StoreBase,
    _accepted,
    _created_at,
)
from my_petkit.events.store_blocked_attempts import BlockedAttemptQueries
from my_petkit.events.store_media import MediaQueries
from my_petkit.events.store_pets import PetQueries

log = logging.getLogger(__name__)


class EventStore(MediaQueries, PetQueries, BlockedAttemptQueries, StoreBase):
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

    # --- events -------------------------------------------------------

    async def upsert_event(self, row: dict[str, Any]) -> int:
        """Insert an event, or update it in place if `event_uid` already
        exists (a device retrying the same dev_event_report/MQTT event)."""
        data = _accepted(row, _EVENT_COLUMNS)
        for json_key in ("content_json", "state_json"):
            if json_key in data and not isinstance(data[json_key], str):
                data[json_key] = json.dumps(data[json_key])

        async with self._write() as session:
            existing = None
            if data.get("event_uid"):
                existing = await session.scalar(
                    select(Event).where(Event.event_uid == data["event_uid"]))
            if existing is not None:
                for key, value in data.items():
                    setattr(existing, key, value)
                await session.flush()
                return existing.id

            obj = Event(created_at=_created_at(row), **data)
            session.add(obj)
            await session.flush()
            return obj.id

    async def get_event(self, event_id: int) -> dict[str, Any] | None:
        """One event row by primary key, or None if it no longer exists."""
        async with self._read() as session:
            obj = await session.get(Event, event_id)
            return obj.as_dict() if obj else None

    async def all_events(self, limit: int = 100000) -> list[dict[str, Any]]:
        """Every event row in insert order, oldest first.

        Unlike `query_timeline` this attaches no media and applies no window;
        it exists for export/diagnostics, not for the panel.
        """
        async with self._read() as session:
            rows = await session.scalars(select(Event).order_by(Event.id).limit(limit))
            return [r.as_dict() for r in rows]

    async def update_event_fields(self, event_id: int, **fields: Any) -> bool:
        """Overwrite named columns on one event.

        Returns:
            False if the call named no writable column, True otherwise —
            including when no row has that id.
        """
        data = {k: v for k, v in fields.items() if k in _EVENT_COLUMNS}
        if not data:
            return False
        async with self._write() as session:
            await session.execute(
                update(Event).where(Event.id == event_id).values(**data),
                execution_options=_NO_SYNC)
        return True

    async def event_by_related(self, related_event: str) -> dict[str, Any] | None:
        """Most recent event sharing this related_event (session) id.

        Used to recover an `event_kind` label for media that arrives without
        its own content flags (see media/pipeline.py).
        """
        async with self._read() as session:
            obj = await session.scalar(
                select(Event)
                .where(Event.related_event == related_event)
                .order_by(Event.ts.desc())
                .limit(1))
            return obj.as_dict() if obj else None

    async def prune_events(self, before_ts: float) -> int:
        """Delete events older than `before_ts`; returns how many went.

        Rows with no timestamp are kept: a NULL `ts` means the device never
        told us when it happened, not that it is old.
        """
        async with self._write() as session:
            result = await session.execute(
                delete(Event).where(Event.ts.is_not(None), Event.ts < before_ts),
                execution_options=_NO_SYNC)
            return result.rowcount

    # --- timeline (sessions) ---------------------------------------------

    async def query_timeline(self, device_id: int | None = None, start_ts: float | None = None,
                             end_ts: float | None = None, event_kind: str | None = None,
                             limit: int = 200) -> list[dict[str, Any]]:
        """Raw event rows for a window, newest first, each carrying its media.

        Every row gains a synthetic `"media"` key holding the media rows that
        share its `related_event` (always a list, possibly empty). Session
        grouping - visit plus its sub-events - is NOT done here but by
        `events/sessions.py::group_sessions` on top of this result, keeping the
        grouping heuristic out of SQL where it stays readable and testable.
        """
        stmt = select(Event)
        if device_id is not None:
            stmt = stmt.where(Event.device_id == device_id)
        if start_ts is not None:
            stmt = stmt.where(Event.ts >= start_ts)
        if end_ts is not None:
            stmt = stmt.where(Event.ts < end_ts)
        if event_kind is not None:
            stmt = stmt.where(Event.event_kind == event_kind)
        stmt = stmt.order_by(Event.ts.desc()).limit(limit)

        media_by_related: dict[str, list[dict[str, Any]]] = {}
        async with self._read() as session:
            events = [e.as_dict() for e in await session.scalars(stmt)]
            # One extra query for the whole page rather than one per event.
            related = sorted({e["related_event"] for e in events if e.get("related_event")})
            if related:
                rows = await session.scalars(
                    select(Media)
                    .where(Media.related_event.in_(related))
                    .order_by(Media.created_at))
                for media in rows:
                    media_by_related.setdefault(media.related_event, []).append(media.as_dict())

        for e in events:
            e["media"] = media_by_related.get(e.get("related_event") or "", [])
        return events
