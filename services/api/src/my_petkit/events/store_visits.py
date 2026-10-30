"""`EventStore` queries that attribute a whole visit to a pet, or to none.

A visit is every row one device reported under one `related_event` (the
device's session id): the pet-in, the summary carrying the weight, the
cleaning steps. Attribution is a property of the visit, so it is written to
all of them at once, and a row without a `related_event` is a visit of its own.
"""
from __future__ import annotations

from typing import Any, cast

from sqlalchemy import CursorResult, or_, select, update

from my_petkit.events.models import Event
from my_petkit.events.store_base import _NO_SYNC, StoreBase

#: `events.pet_source` values; see `Event.pet_source`.
PET_SOURCE_DEVICE = "device"
PET_SOURCE_WEIGHT = "weight"
PET_SOURCE_MANUAL = "manual"


def _visit_of(row: Event) -> Any:
    """The WHERE clause selecting every row of `row`'s visit."""
    if row.related_event:
        return (Event.device_id == row.device_id) & (Event.related_event == row.related_event)
    return Event.id == row.id


class VisitQueries(StoreBase):
    async def visit_rows(self, event_id: int) -> list[dict[str, Any]]:
        """Every row of the visit `event_id` belongs to, oldest first; [] if unknown."""
        async with self._read() as session:
            row = await session.get(Event, event_id)
            if row is None:
                return []
            rows = await session.scalars(
                select(Event).where(_visit_of(row)).order_by(Event.ts, Event.id))
            return [r.as_dict() for r in rows]

    async def set_visit_pet_manual(self, event_id: int, pet_id: int | None,
                                   passing: bool) -> int:
        """The user's choice for a visit: a pet, nobody, or "just passing".

        Returns how many rows changed; 0 when `event_id` does not exist.
        """
        async with self._write() as session:
            row = await session.get(Event, event_id)
            if row is None:
                return 0
            result = await session.execute(
                update(Event).where(_visit_of(row)).values(
                    pet_id=pet_id, pet_source=PET_SOURCE_MANUAL, passing=1 if passing else None),
                execution_options=_NO_SYNC)
            return int(cast(CursorResult[Any], result).rowcount or 0)

    async def set_visit_pet_automatic(self, event_id: int, pet_id: int | None,
                                      passing: bool, source: str = PET_SOURCE_WEIGHT) -> int:
        """An automatic decision for a visit, written only where nobody outranks it.

        Rows the user attributed, rows the device attributed, and rows from
        before `pet_source` existed that already carry a pet are all left
        alone; blank rows and earlier weight matches take the new decision.
        `pet_id` None with `passing` False clears an earlier decision.
        """
        async with self._write() as session:
            row = await session.get(Event, event_id)
            if row is None:
                return 0
            values: dict[str, Any] = {
                "pet_id": pet_id,
                "pet_source": source if pet_id is not None else None,
                "passing": 1 if passing else None,
            }
            blank = Event.pet_source.is_(None) & Event.pet_id.is_(None)
            result = await session.execute(
                update(Event)
                .where(_visit_of(row), or_(blank, Event.pet_source == PET_SOURCE_WEIGHT))
                .values(**values),
                execution_options=_NO_SYNC)
            return int(cast(CursorResult[Any], result).rowcount or 0)
