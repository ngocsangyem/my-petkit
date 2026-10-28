"""A stitch that fails after verification must not cost the user any footage.

`stitch_episode` promises that every failure path leaves the chunks as they
were. These tests break the two steps that run after verification — moving the
joined clip into place, and swapping the DB rows — and check by content hash
that every source chunk's bytes are still on disk.

ffmpeg is replaced by a byte-level concat so the tests exercise only the
ordering of delete / move / DB swap, not the encoder.
"""
import hashlib
import os
from pathlib import Path

import pytest
from sqlalchemy.exc import OperationalError, SQLAlchemyError

from my_petkit.events.store import EventStore
from my_petkit.media import layout, stitch

DEVICE_TYPE = "t5"
DEVICE_ID = 1
CATEGORY = "fullVideo"
EPISODE = "ep-fail"


def _sha(path: str) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


@pytest.fixture
def fake_ffmpeg(monkeypatch):
    """Stand-in join: concatenated bytes, always 'verified'."""
    async def _split(paths):
        return list(paths), []

    async def _concat(paths, dst, work_dir):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        Path(dst).write_bytes(b"".join(Path(p).read_bytes() for p in paths))
        return True

    async def _verify(path, expected_duration_sec=None):
        return True

    monkeypatch.setattr(stitch, "split_by_stream", _split)
    monkeypatch.setattr(stitch, "concat_videos", _concat)
    monkeypatch.setattr(stitch, "verify_video", _verify)


async def _episode_whose_first_chunk_is_the_final_path(store, media_root):
    """Three ready chunks; the first sits exactly where the joined clip will go,
    which is the normal case (both names derive from the first chunk's
    timestamp)."""
    start = 1_000_000.0
    first_path = layout.build_media_path(
        media_root, DEVICE_TYPE, DEVICE_ID, CATEGORY, start, "Event", "mp4")
    paths = [first_path] + [
        os.path.join(os.path.dirname(first_path), f"chunk{i}.mp4") for i in (1, 2)]
    for i, p in enumerate(paths):
        os.makedirs(os.path.dirname(p), exist_ok=True)
        Path(p).write_bytes(f"chunk-{i}-".encode() * 100)
        await store.upsert_media({
            "file_id": f"fid-{i}", "device_id": DEVICE_ID, "related_event": EPISODE,
            "category": CATEGORY, "media_path": p, "status": "ready",
            "duration_ms": 4000, "start_ts": start + 4 * i, "end_ts": start + 4 * i + 4,
            "created_at": start + 4 * i,
        })
    episodes = await store.stitch_candidates((CATEGORY,), quiet_before_ts=start + 1000)
    assert len(episodes) == 1
    return episodes[0], paths


def _assert_every_chunk_survived(before: dict[str, str]):
    lost = [p for p, digest in before.items()
            if not os.path.isfile(p) or _sha(p) != digest]
    assert not lost, f"source chunk bytes lost after a failed stitch: {lost}"


@pytest.mark.xfail(strict=True, reason=(
    "stitch_episode deletes source chunks before the final move; an OSError on "
    "the move loses every chunk except the one at final_path"))
async def test_failed_move_into_place_keeps_every_source_chunk(tmp_path, fake_ffmpeg, monkeypatch):
    store = EventStore(tmp_path / "petkit.db")
    try:
        media_root = str(tmp_path / "media")
        episode, paths = await _episode_whose_first_chunk_is_the_final_path(store, media_root)
        before = {p: _sha(p) for p in paths}

        def _move_fails(tmp_path_, final_path):
            raise OSError(28, "No space left on device")

        monkeypatch.setattr(stitch, "_move_into_place", _move_fails)

        out = await stitch.stitch_episode(
            store, episode, media_root, work_dir=str(tmp_path / "media" / ".raw"),
            device_type=DEVICE_TYPE)

        assert out is None
        _assert_every_chunk_survived(before)
    finally:
        await store.close()


@pytest.mark.xfail(strict=True, reason=(
    "stitch_episode deletes chunks and overwrites the first chunk before the DB "
    "swap; a SQLAlchemyError there leaves rows pointing at lost bytes"))
async def test_failed_db_swap_keeps_every_source_chunk(tmp_path, fake_ffmpeg, monkeypatch):
    store = EventStore(tmp_path / "petkit.db")
    try:
        media_root = str(tmp_path / "media")
        episode, paths = await _episode_whose_first_chunk_is_the_final_path(store, media_root)
        before = {p: _sha(p) for p in paths}

        async def _swap_fails(chunk_ids, merged_row):
            raise OperationalError("INSERT INTO media", {}, Exception("database is locked"))

        monkeypatch.setattr(store, "replace_chunks_with_stitched", _swap_fails)

        try:
            await stitch.stitch_episode(
                store, episode, media_root, work_dir=str(tmp_path / "media" / ".raw"),
                device_type=DEVICE_TYPE)
        except SQLAlchemyError:
            pass  # whether it propagates is not the point; the footage is

        # The chunk rows survived the failed swap, so their files must too.
        rows = await store.media_for_related_event(EPISODE)
        assert sorted(r["media_path"] for r in rows) == sorted(paths)
        _assert_every_chunk_survived(before)
    finally:
        await store.close()
