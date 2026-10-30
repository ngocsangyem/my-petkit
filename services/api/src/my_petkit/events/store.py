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
from collections.abc import Collection
from typing import Any

from sqlalchemy import delete, select, update

from my_petkit.events.models import Event, Media
from my_petkit.events.store_visits import (
    PET_SOURCE_DEVICE,
    PET_SOURCE_MANUAL,
    VisitQueries,
)
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


class EventStore(MediaQueries, PetQueries, VisitQueries, BlockedAttemptQueries, StoreBase):
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
        """Insert an event, or update it in place if this device already
        stored the same `event_uid` (a retry of one dev_event_report/MQTT
        event).

        The lookup is scoped by `device_id` because `event_uid` carries no
        device component: two devices whose firmware happens to emit the same
        `event_id` would otherwise overwrite each other's row.
        """
        data = _accepted(row, _EVENT_COLUMNS)
        for json_key in ("content_json", "state_json"):
            if json_key in data and not isinstance(data[json_key], str):
                data[json_key] = json.dumps(data[json_key])

        if data.get("pet_id") is not None and not data.get("pet_source"):
            data["pet_source"] = PET_SOURCE_DEVICE

        async with self._write() as session:
            existing = None
            if data.get("event_uid"):
                existing = await session.scalar(
                    select(Event).where(Event.device_id == data.get("device_id"),
                                        Event.event_uid == data["event_uid"]))
            if existing is not None:
                # A retry never takes an attribution away: a resend that could
                # not resolve a pet leaves whoever was decided, and nothing a
                # device sends overrides a pet the user picked.
                if data.get("pet_id") is None or existing.pet_source == PET_SOURCE_MANUAL:
                    data.pop("pet_id", None)
                    data.pop("pet_source", None)
                for key, value in data.items():
                    setattr(existing, key, value)
                await session.flush()
                return existing.id

            # A later report of a visit the user already attributed joins it.
            if data.get("related_event"):
                manual = await session.scalar(
                    select(Event).where(Event.device_id == data.get("device_id"),
                                        Event.related_event == data["related_event"],
                                        Event.pet_source == PET_SOURCE_MANUAL).limit(1))
                if manual is not None:
                    data.update(pet_id=manual.pet_id, pet_source=PET_SOURCE_MANUAL,
                                passing=manual.passing)

            obj = Event(created_at=_created_at(row), **data)
            session.add(obj)
            await session.flush()
            return obj.id

    async def get_event(self, event_id: int) -> dict[str, Any] | None:
        """One event row by primary key, or None if it no longer exists."""
        async with self._read() as session:
            obj = await session.get(Event, event_id)
            return obj.as_dict() if obj else None

    async def all_events(self, limit: int = 100000,
                         after_id: int = 0) -> list[dict[str, Any]]:
        """Event rows in insert order, oldest first, at most `limit` of them.

        Unlike `query_timeline` this attaches no media and applies no window;
        it exists for export/diagnostics, not for the panel. `limit` truncates
        silently, so a pass that must see every row pages with `after_id`: the
        id of the last row of the previous page.
        """
        async with self._read() as session:
            rows = await session.scalars(
                select(Event).where(Event.id > after_id).order_by(Event.id).limit(limit))
            return [r.as_dict() for r in rows]

    async def device_events_by_type(self, device_id: int, event_types: Collection[str],
                                    start_ts: float | None = None,
                                    limit: int = 1000) -> list[dict[str, Any]]:
        """One device's events of the given `event_type`s, newest first.

        Rows with no `ts` are left out: the caller needs to know when each
        event happened. Used to re-derive event-only device state at start-up.
        """
        if not event_types:
            return []
        stmt = select(Event).where(Event.device_id == device_id,
                                   Event.event_type.in_(list(event_types)),
                                   Event.ts.is_not(None))
        if start_ts is not None:
            stmt = stmt.where(Event.ts >= start_ts)
        stmt = stmt.order_by(Event.ts.desc(), Event.id.desc()).limit(limit)
        async with self._read() as session:
            return [r.as_dict() for r in await session.scalars(stmt)]

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

    async def event_by_related(self, related_event: str,
                               device_id: int | None = None) -> dict[str, Any] | None:
        """Most recent event sharing this related_event (session) id.

        Used to recover an `event_kind` label for media that arrives without
        its own content flags (see media/pipeline.py). Pass `device_id`: a
        session id is only unique within one device, so without it another
        device's visit can lend its label or pet.
        """
        query = select(Event).where(Event.related_event == related_event)
        if device_id is not None:
            query = query.where(Event.device_id == device_id)
        async with self._read() as session:
            obj = await session.scalar(query.order_by(Event.ts.desc()).limit(1))
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
        share its `device_id` and `related_event` (always a list, possibly
        empty). The device is part of the pairing because a session id is only
        unique within one device. Session
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

        media_by_related: dict[tuple[int, str], list[dict[str, Any]]] = {}
        async with self._read() as session:
            events = [e.as_dict() for e in await session.scalars(stmt)]
            # One extra query for the whole page rather than one per event.
            related = sorted({e["related_event"] for e in events if e.get("related_event")})
            device_ids = sorted({e["device_id"] for e in events if e.get("related_event")})
            if related:
                rows = await session.scalars(
                    select(Media)
                    .where(Media.related_event.in_(related),
                           Media.device_id.in_(device_ids))
                    .order_by(Media.created_at))
                for media in rows:
                    media_by_related.setdefault(
                        (media.device_id, media.related_event), []).append(media.as_dict())

        for e in events:
            e["media"] = media_by_related.get(
                (e["device_id"], e.get("related_event") or ""), [])
        return events
