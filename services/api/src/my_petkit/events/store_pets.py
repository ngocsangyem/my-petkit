"""`EventStore` queries on `pets`, `pet_faces` and reported pet identities."""
from __future__ import annotations

import json
import logging
import time
from typing import Any

from sqlalchemy import delete, func, or_, select, update

from my_petkit.events import codes
from my_petkit.events.models import Event, Pet, PetFace
from my_petkit.events.store_base import (
    _NO_SYNC,
    _PET_COLUMNS,
    MAX_FACES_PER_PET,
    StoreBase,
    _accepted,
    _created_at,
)
from my_petkit.events.store_visits import PET_SOURCE_DEVICE, PET_SOURCE_MANUAL
from my_petkit.utils.timeutil import local_day_start

log = logging.getLogger("my_petkit.events.store")


class PetQueries(StoreBase):
    # --- pets -------------------------------------------------------------

    async def upsert_pet(self, row: dict[str, Any], pet_id: int | None = None) -> int:
        """Create a pet, or update the one named by `pet_id`; returns its id.

        `device_ids_json` may be passed as a real list and is serialised here,
        but it always reads BACK as the raw JSON string (see `get_pet`).

        The returned id is what the device echoes as `petId` in recognition
        events: we hand our own primary key to the device via `dev_discern_pic`,
        so no id-mapping protocol exists or is needed.
        """
        data = _accepted(row, _PET_COLUMNS)
        if "device_ids_json" in data and not isinstance(data["device_ids_json"], str):
            data["device_ids_json"] = json.dumps(data["device_ids_json"])

        async with self._write() as session:
            if pet_id is not None:
                if data:
                    await session.execute(
                        update(Pet).where(Pet.id == pet_id).values(**data),
                        execution_options=_NO_SYNC)
                return pet_id

            obj = Pet(created_at=_created_at(row), **data)
            session.add(obj)
            await session.flush()
            return obj.id

    async def get_pet(self, pet_id: int) -> dict[str, Any] | None:
        """One pet row by id, or None.

        `device_ids_json` comes back as the stored JSON STRING, not a list -
        the asymmetry with `upsert_pet` is a trap worth remembering.
        """
        async with self._read() as session:
            obj = await session.get(Pet, pet_id)
            return obj.as_dict() if obj else None

    async def all_pets(self) -> list[dict[str, Any]]:
        """Every pet row, oldest first (same row shape as `get_pet`)."""
        async with self._read() as session:
            rows = await session.scalars(select(Pet).order_by(Pet.id))
            return [r.as_dict() for r in rows]

    async def delete_pet(self, pet_id: int) -> None:
        """Forget one pet and its face rows. Events keep its id."""
        async with self._write() as session:
            await session.execute(delete(PetFace).where(PetFace.pet_id == pet_id),
                                  execution_options=_NO_SYNC)
            await session.execute(delete(Pet).where(Pet.id == pet_id),
                                  execution_options=_NO_SYNC)

    # --- pet faces ----------------------------------------------------------

    async def pet_faces(self, pet_id: int) -> list[dict[str, Any]]:
        """One pet's reference photos, oldest first."""
        async with self._read() as session:
            rows = await session.scalars(
                select(PetFace).where(PetFace.pet_id == pet_id).order_by(PetFace.id))
            return [r.as_dict() for r in rows]

    async def add_pet_face(self, pet_id: int, photo_path: str) -> int | None:
        """Register a photo and return its new id, or None if the pet is full.

        The id is what the device is handed as `discern[].id`, so it is
        allocated here rather than by the caller — see `PetFace`.
        """
        async with self._write() as session:
            count = await session.scalar(
                select(func.count()).select_from(PetFace).where(PetFace.pet_id == pet_id))
            if (count or 0) >= MAX_FACES_PER_PET:
                return None
            obj = PetFace(pet_id=pet_id, photo_path=photo_path, created_at=time.time())
            session.add(obj)
            await session.flush()
            return obj.id

    async def update_pet_face_path(self, face_id: int, photo_path: str) -> None:
        """Point a face row at its file, once the id that names it is known."""
        async with self._write() as session:
            await session.execute(
                update(PetFace).where(PetFace.id == face_id).values(photo_path=photo_path),
                execution_options=_NO_SYNC)

    async def get_pet_face(self, face_id: int) -> dict[str, Any] | None:
        """One face row by id, or None."""
        async with self._read() as session:
            obj = await session.get(PetFace, face_id)
            return obj.as_dict() if obj else None

    async def delete_pet_face(self, face_id: int) -> None:
        """Forget one reference photo. The file is the caller's to unlink."""
        async with self._write() as session:
            await session.execute(delete(PetFace).where(PetFace.id == face_id),
                                  execution_options=_NO_SYNC)

    # --- reported identities ------------------------------------------------

    async def unbound_pet_refs(self) -> list[dict[str, Any]]:
        """Identities the device reported that map to no pet row.

        `[{pet_ref, count, last_ts}]`, busiest first. These are almost always
        ids the box cached from PetKit's cloud before the takeover; the panel
        offers them for binding rather than guessing at one.

        "Known" means an alias somebody already bound. Our OWN `pets.id` is
        deliberately NOT excluded: a row can carry a ref that is one of our
        pets and still have a NULL `pet_id` — it was ingested while the pet
        registry was unavailable, or recovered by `backfill_event_rows`, which
        recomputes `pet_ref` from stored content but cannot resolve it. Hiding
        those left them unattributed forever with nothing offering to fix it.
        Rows that already resolved are excluded instead, so a healthy install
        still shows an empty list.
        """
        bound: set[int] = set()
        for pet in await self.all_pets():
            try:
                bound.update(int(x) for x in json.loads(pet.get("device_pet_ids_json") or "[]"))
            except (json.JSONDecodeError, TypeError, ValueError):
                pass
        async with self._read() as session:
            rows = await session.execute(
                select(Event.pet_ref, func.count(), func.max(Event.ts))
                .where(Event.pet_ref.isnot(None), Event.pet_id.is_(None))
                .group_by(Event.pet_ref))
            return sorted(
                ({"pet_ref": ref, "count": n, "last_ts": last}
                 for ref, n, last in rows if ref not in bound),
                key=lambda r: r["count"], reverse=True)

    async def bind_pet_ref(self, pet_ref: int, pet_id: int | None) -> int:
        """Re-attribute every past event carrying `pet_ref` to `pet_id`.

        Returns how many rows changed. Run when the user binds a foreign
        identity, so history stops being anonymous the moment they do — and
        with `pet_id=None` when they UNBIND one, which has to clear the same
        rows or history would stay attributed to a pet that no longer claims
        the id while new events resolve to nobody.
        """
        async with self._write() as session:
            # A visit the user attributed by hand keeps that attribution.
            result = await session.execute(
                update(Event)
                .where(Event.pet_ref == pet_ref,
                       or_(Event.pet_source.is_(None), Event.pet_source != PET_SOURCE_MANUAL))
                .values(pet_id=pet_id, pet_source=PET_SOURCE_DEVICE if pet_id is not None else None),
                execution_options=_NO_SYNC)
            return int(result.rowcount or 0)

    async def pets_claiming_ref(self, pet_ref: int) -> list[int]:
        """Ids of every pet whose alias list contains `pet_ref`.

        Normally zero or one. More than one is a conflict the caller has to
        resolve rather than silently pick from — `resolve_pet_ref` would take
        the lowest id, so past and future events could end up on different
        animals with nothing saying so.
        """
        out: list[int] = []
        for pet in await self.all_pets():
            try:
                aliases = json.loads(pet.get("device_pet_ids_json") or "[]")
            except (json.JSONDecodeError, TypeError):
                continue
            if pet_ref in aliases:
                out.append(pet["id"])
        return out

    async def pet_visit_stats(self, pet_id: int, now: float | None = None) -> dict[str, Any]:
        """Aggregate stats backing one pet's virtual HA device.

        Returns `{last_visit_ts, visits_today, last_visit_weight,
        last_visit_duration, last_device_id}`, every value None/0 for a pet
        that has never been recognised - the entities exist from the moment
        the pet does (see ha/publisher.py::publish_pet_state).

        `visits_today` counts from LOCAL midnight, which is the boundary the
        owner means by "today". Counting from UTC midnight instead credits a
        00:30 visit on a UTC+2 install to the previous day, and the sensor
        reads low every morning until the offset has passed.
        """
        now = now if now is not None else time.time()
        day_start = local_day_start(now)
        visit = (Event.pet_id == pet_id, Event.event_kind == codes.KIND_TOILET)

        async with self._read() as session:
            latest_row = await session.scalar(
                select(Event).where(*visit).order_by(Event.ts.desc()).limit(1))
            latest = latest_row.as_dict() if latest_row else None
            visits_today = await session.scalar(
                select(func.count()).select_from(Event).where(*visit, Event.ts >= day_start))

            weight = None
            duration = None
            device_id = None
            last_visit_ts = None
            if latest:
                device_id = latest.get("device_id")
                last_visit_ts = latest.get("ts")
                content = {}
                if latest.get("content_json"):
                    try:
                        content = json.loads(latest["content_json"])
                    except (json.JSONDecodeError, TypeError):
                        content = {}
                w = content.get("pet_weight", content.get("petWeight"))
                try:
                    # The scale reports WHOLE GRAMS -- all 58 `pet_weight`
                    # values across the captures are integers. Going through
                    # float() only to publish "2223.0 g" invents a decimal the
                    # hardware never measured. Parsed as float first so a
                    # numeric string still works.
                    weight = round(float(w)) if w is not None else None
                except (TypeError, ValueError):
                    weight = None
                if latest.get("related_event"):
                    pet_in_ts = await session.scalar(
                        select(Event.ts)
                        .where(Event.related_event == latest["related_event"],
                               Event.event_type == "pet_in")
                        .order_by(Event.ts.asc())
                        .limit(1))
                    if pet_in_ts is not None and last_visit_ts is not None:
                        # WHOLE SECONDS. Both stamps are report arrival times,
                        # so the sub-second part is transport latency, not how
                        # long the cat was in the box -- `codes.py` measures a
                        # 3.8s median for `ts - start_time` on exactly this
                        # kind of pair. Publishing the raw float subtraction
                        # gave HA "57.317591428756714 s", which is fifteen
                        # digits of precision the inputs cannot support.
                        duration = round(max(0.0, last_visit_ts - pet_in_ts))

        return {
            "last_visit_ts": last_visit_ts,
            "visits_today": visits_today,
            "last_visit_weight": weight,
            "last_visit_duration": duration,
            "last_device_id": device_id,
        }

    async def pets_for_device(self, device_id: int) -> list[dict[str, Any]]:
        """Pets linked to one device, filtered in Python rather than in SQL.

        `device_ids_json` is an opaque JSON string column, so there is nothing
        to index or join on; the table holds a handful of rows per household,
        which is why a full scan is the right trade rather than a schema
        change. A row whose JSON is unparseable is treated as linked to
        nothing instead of failing the whole listing.
        """
        out: list[dict[str, Any]] = []
        for p in await self.all_pets():
            try:
                ids = json.loads(p.get("device_ids_json") or "[]")
            except (json.JSONDecodeError, TypeError):
                ids = []
            if device_id in ids:
                out.append(p)
        return out

