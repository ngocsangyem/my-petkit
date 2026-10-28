"""`EventStore` queries on the `blocked_attempts` table (proxy-mode refusals)."""
from __future__ import annotations

import json
import logging
from typing import Any

from sqlalchemy import delete, insert, select

from my_petkit.events.models import BlockedAttempt
from my_petkit.events.store_base import (
    _BLOCKED_COLUMNS,
    _NO_SYNC,
    StoreBase,
    _accepted,
    _created_at,
)

log = logging.getLogger("my_petkit.events.store")


class BlockedAttemptQueries(StoreBase):
    # --- blocked attempts -----------------------------------------------

    async def add_blocked_attempts(self, rows: list[dict[str, Any]]) -> int:
        """Record what the upstream cloud tried and did not get to do.

        Batched into one transaction because a single proxied response can trip
        several rules at once, and this runs on the device-facing request path.

        Insert-only: unlike `upsert_event` there is no dedup key, because two
        identical attempts a minute apart are two attempts and the second one is
        the interesting one.

        Uses a Core `executemany` rather than `session.add()` in a loop, which
        is also what avoids SQLAlchemy's "insertmanyvalues" sentinel rule: the
        ORM path wants to read each new `id` back, and refuses to batch that
        against a primary key declared `nullable=True` (the house convention —
        see `events/models.py`). Nothing here needs the ids. Every row is padded
        to the full column set first, because an executemany requires one shape.

        Returns:
            How many rows were written. Zero for an empty list, without opening
            a session — the overwhelmingly common case, since nothing is
            recorded while proxy mode is off.
        """
        if not rows:
            return 0

        payload = []
        for row in rows:
            data = _accepted(row, _BLOCKED_COLUMNS)
            for json_key in ("payload_json", "detail_json"):
                if json_key in data and not isinstance(data[json_key], str):
                    data[json_key] = json.dumps(data[json_key], default=str)
            payload.append({col: data.get(col) for col in _BLOCKED_COLUMNS}
                           | {"created_at": _created_at(row)})

        async with self._write() as session:
            await session.execute(insert(BlockedAttempt), payload)
        return len(payload)

    async def recent_blocked_attempts(self, limit: int = 200, device_id: int | None = None,
                                      kind: str | None = None) -> list[dict[str, Any]]:
        """The most recent attempts, newest first.

        Ordered by `id` rather than `created_at`: several rows from one response
        share a timestamp to the microsecond, and the panel needs a stable order.
        """
        async with self._read() as session:
            query = select(BlockedAttempt)
            if device_id is not None:
                query = query.where(BlockedAttempt.device_id == device_id)
            if kind:
                query = query.where(BlockedAttempt.kind == kind)
            rows = await session.scalars(
                query.order_by(BlockedAttempt.id.desc()).limit(limit))
            return [r.as_dict() for r in rows]

    async def prune_blocked_attempts(self, before_ts: float) -> int:
        """Delete attempts recorded before `before_ts`; returns how many went.

        Keyed on `created_at` and not on a device-supplied timestamp, because
        there is none: when we noticed is the only time these rows have.
        """
        async with self._write() as session:
            result = await session.execute(
                delete(BlockedAttempt).where(BlockedAttempt.created_at < before_ts),
                execution_options=_NO_SYNC)
            return result.rowcount

