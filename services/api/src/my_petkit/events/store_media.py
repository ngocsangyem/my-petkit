"""`EventStore` queries on the `media` table, including episode stitching."""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import SQLAlchemyError

from my_petkit.events.models import Media
from my_petkit.events.store_base import (
    _MEDIA_COLUMNS,
    _NO_SYNC,
    StoreBase,
    _accepted,
    _created_at,
)

log = logging.getLogger("my_petkit.events.store")


class MediaQueries(StoreBase):
    # --- media ----------------------------------------------------------

    async def upsert_media(self, row: dict[str, Any]) -> int:
        """Insert a media row keyed by `file_id`, or update it in place.

        `file_id` is unique because the pipeline calls this twice for the same
        file: once when `dev_upload_file_info_v2` arrives (metadata only) and
        again once the bytes are decrypted/remuxed (media_path/status/size).

        Raises:
            ValueError: if the row carries no `file_id` to key on.
        """
        data = _accepted(row, _MEDIA_COLUMNS)
        file_id = data.get("file_id")
        if not file_id:
            raise ValueError("media row requires file_id")

        async with self._write() as session:
            existing = await session.scalar(select(Media).where(Media.file_id == file_id))
            if existing is not None:
                for key, value in data.items():
                    if key != "file_id":
                        setattr(existing, key, value)
                await session.flush()
                return existing.id

            obj = Media(created_at=_created_at(row), **data)
            session.add(obj)
            await session.flush()
            return obj.id

    async def get_media_by_file_id(self, file_id: str) -> dict[str, Any] | None:
        """One media row by the device's own file id, or None."""
        async with self._read() as session:
            obj = await session.scalar(select(Media).where(Media.file_id == file_id))
            return obj.as_dict() if obj else None

    async def media_for_related_event(self, related_event: str) -> list[dict[str, Any]]:
        """Every media row of one session, in arrival order.

        Arrival order is what makes a burst (waste/health gallery) render in
        the order the device shot it, and what lets `media/stitch.py` see
        video chunks in sequence.
        """
        async with self._read() as session:
            rows = await session.scalars(
                select(Media)
                .where(Media.related_event == related_event)
                .order_by(Media.created_at))
            return [r.as_dict() for r in rows]

    async def latest_media(self, device_id: int,
                           category: str | None = None) -> dict[str, Any] | None:
        """Newest playable media for one device, optionally of one role.

        Only `status == "ready"` rows qualify, so this never hands back a file
        that is still encrypted or mid-remux. `category` is a media ROLE
        (`fullVideo`, `eventImage`, ...), not an STS capability.
        """
        stmt = (select(Media)
                .where(Media.device_id == device_id, Media.status == "ready")
                .order_by(Media.created_at.desc())
                .limit(1))
        if category:
            stmt = stmt.where(Media.category == category)
        async with self._read() as session:
            obj = await session.scalar(stmt)
            return obj.as_dict() if obj else None

    async def media_for_retention(self, category: str) -> list[dict[str, Any]]:
        """All ready media of one category, newest first.

        Newest-first is what the retention sweeper wants: it accumulates the
        rows it keeps from the front and deletes the tail, so the oldest file
        is always the first casualty of a size or age cap.
        """
        async with self._read() as session:
            rows = await session.scalars(
                select(Media)
                .where(Media.category == category, Media.status == "ready")
                .order_by(Media.created_at.desc()))
            return [r.as_dict() for r in rows]

    async def delete_media(self, media_id: int) -> None:
        """Forget one media row. The file on disk is the caller's problem."""
        async with self._write() as session:
            await session.execute(delete(Media).where(Media.id == media_id),
                                  execution_options=_NO_SYNC)

    async def reclassify_media_categories(self, module_type_to_category: dict[str, str]) -> int:
        """Recompute `category` from `module_type`; returns the rows fixed.

        Rows written before a mapping was corrected would otherwise keep a
        wrong category forever - which for video means two different streams
        sharing one category, and media/stitch.py refusing to join (or worse,
        joining) mismatched chunks. The caller passes the mapping in so this
        stays a pure storage operation with no protocol knowledge.
        """
        fixed = 0
        async with self._write() as session:
            for module_type, category in (module_type_to_category or {}).items():
                result = await session.execute(
                    update(Media)
                    .where(Media.module_type == module_type, Media.category != category)
                    .values(category=category),
                    execution_options=_NO_SYNC)
                fixed += result.rowcount
        if fixed:
            log.info("Reclassified %d media rows from their module_type", fixed)
        return fixed

    # --- stitching (see media/stitch.py) ----------------------------------

    async def stitch_candidates(self, categories: tuple[str, ...], quiet_before_ts: float,
                                min_chunks: int = 2) -> list[dict[str, Any]]:
        """Episodes whose chunks look complete and are worth concatenating.

        An episode qualifies when it has >= `min_chunks` ready chunks of ONE
        category under one related_event, nothing was added to it since
        `quiet_before_ts`, and no earlier attempt marked it (`stitch_state`)
        - otherwise a file ffmpeg cannot handle would be retried forever.

        Returns:
            `[{device_id, related_event, category, chunks: [media row, ...]}]`,
            each chunk list in device timestamp order rather than insert
            order, because a chunk can be re-uploaded out of sequence.
        """
        if not categories:
            return []

        unclaimed = (Media.status == "ready", Media.stitch_state.is_(None))
        chunk_count = func.count().label("n")
        newest = func.max(Media.created_at).label("newest")
        episodes = (
            select(Media.device_id, Media.related_event, Media.category, chunk_count, newest)
            .where(*unclaimed,
                   Media.related_event.is_not(None),
                   Media.media_path.is_not(None),
                   Media.category.in_(categories))
            .group_by(Media.device_id, Media.related_event, Media.category)
            .having(chunk_count >= min_chunks)
            .having(newest < quiet_before_ts))

        out: list[dict[str, Any]] = []
        async with self._read() as session:
            groups = (await session.execute(episodes)).mappings().all()
            for group in groups:
                rows = await session.scalars(
                    select(Media)
                    .where(*unclaimed,
                           Media.device_id == group["device_id"],
                           Media.related_event == group["related_event"],
                           Media.category == group["category"])
                    # Device order, not insert order: a chunk can be re-uploaded.
                    .order_by(func.coalesce(Media.start_ts, Media.created_at),
                              Media.created_at))
                chunks = [r.as_dict() for r in rows]
                if len(chunks) >= min_chunks:
                    out.append({
                        "device_id": group["device_id"],
                        "related_event": group["related_event"],
                        "category": group["category"],
                        "chunks": chunks,
                    })
        return out

    async def mark_stitch_failed(self, media_ids: list[int], reason: str = "failed") -> None:
        """Tag chunks so `stitch_candidates` stops offering them.

        The chunks themselves are deliberately kept - a failed join must never
        cost the user footage - and `reason` is stored verbatim in
        `stitch_state`, which is also how a successful join marks its output.
        """
        if not media_ids:
            return
        async with self._write() as session:
            await session.execute(
                update(Media).where(Media.id.in_(media_ids)).values(stitch_state=reason),
                execution_options=_NO_SYNC)

    async def replace_chunks_with_stitched(self, chunk_ids: list[int],
                                           merged_row: dict[str, Any]) -> int:
        """Swap a set of chunk rows for the single stitched row atomically.

        One transaction, so a crash can never leave the timeline showing
        neither the chunks (already deleted) nor the merged clip (not yet
        inserted).

        Returns:
            The id of the new merged row.

        Raises:
            SQLAlchemyError: re-raised after logging, because the caller must
                not delete the chunk FILES if their rows survived.
        """
        data = _accepted(merged_row, _MEDIA_COLUMNS)
        try:
            async with self._write() as session:
                if chunk_ids:
                    await session.execute(delete(Media).where(Media.id.in_(chunk_ids)),
                                          execution_options=_NO_SYNC)
                obj = Media(created_at=_created_at(merged_row), **data)
                session.add(obj)
                await session.flush()
                return obj.id
        except SQLAlchemyError:
            log.exception("Failed to swap %d chunks for stitched row", len(chunk_ids))
            raise

