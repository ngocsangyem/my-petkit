"""Chunks that arrive after their episode was already stitched.

The device keeps uploading through the cleaning cycle, and a retried upload can
land minutes later, so an episode can gain new ready chunks after the stitcher
has joined it. Those late chunks form a fresh stitch candidate under the same
`related_event` + category. Joining them must not collide with the merged row
already written for that episode, and must not lose their bytes.

ffmpeg is replaced by a byte-level concat so only the store/stitch interaction
is exercised.
"""
import os
from pathlib import Path

import pytest

from my_petkit.events.store import EventStore
from my_petkit.media import stitch

DEVICE_ID = 1
CATEGORY = "fullVideo"
EPISODE = "ep-late"


@pytest.fixture
def fake_ffmpeg(monkeypatch):
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


async def _add_chunk(store, day_dir, name, ts, payload):
    path = os.path.join(day_dir, name)
    Path(path).write_bytes(payload)
    await store.upsert_media({
        "file_id": f"fid-{name}", "device_id": DEVICE_ID, "related_event": EPISODE,
        "category": CATEGORY, "media_path": path, "status": "ready",
        "duration_ms": 4000, "start_ts": ts, "end_ts": ts + 4, "created_at": ts,
    })
    return path


@pytest.mark.xfail(strict=True, reason=(
    "a second stitch of the same episode reuses file_id 'stitched:<event>:<category>', "
    "so the swap is refused and the late chunks stay a separate, unstitched clip"))
async def test_late_chunks_after_a_stitch_are_joined_without_losing_footage(tmp_path, fake_ffmpeg):
    store = EventStore(tmp_path / "petkit.db")
    try:
        media_root = str(tmp_path / "media")
        work_dir = str(tmp_path / "media" / ".raw")
        day_dir = os.path.join(media_root, "Dev", "Playback", "2026-10-28")
        os.makedirs(day_dir, exist_ok=True)

        t0 = 1_000_000.0
        await _add_chunk(store, day_dir, "a0.mp4", t0, b"early-0" * 50)
        await _add_chunk(store, day_dir, "a1.mp4", t0 + 4, b"early-1" * 50)
        first = (await store.stitch_candidates((CATEGORY,), quiet_before_ts=t0 + 1000))[0]
        assert await stitch.stitch_episode(store, first, media_root, work_dir, "t5")

        # Two chunks of the same visit arrive after the join.
        late_payloads = [b"late-0" * 50, b"late-1" * 50]
        await _add_chunk(store, day_dir, "b0.mp4", t0 + 200, late_payloads[0])
        await _add_chunk(store, day_dir, "b1.mp4", t0 + 204, late_payloads[1])
        second = await store.stitch_candidates((CATEGORY,), quiet_before_ts=t0 + 2000)
        assert len(second) == 1 and len(second[0]["chunks"]) == 2

        # Must not raise IntegrityError on the merged row's file_id.
        await stitch.stitch_episode(store, second[0], media_root, work_dir, "t5")

        # Every ready row points at a real file, and the late bytes are
        # reachable through one of them.
        rows = [r for r in await store.media_for_related_event(EPISODE)
                if r["status"] == "ready"]
        for r in rows:
            assert os.path.isfile(r["media_path"]), f"row {r['file_id']} points at a missing file"
        reachable = b"".join(Path(r["media_path"]).read_bytes() for r in rows)
        for payload in late_payloads:
            assert payload in reachable, "late chunk footage is not reachable from any media row"

        # One clip per visit: the late chunks extend the existing one, in order.
        assert len(rows) == 1, f"expected one clip for the visit, got {[r['file_id'] for r in rows]}"
        assert rows[0]["stitch_state"] == "stitched"
        assert reachable == b"early-0" * 50 + b"early-1" * 50 + b"".join(late_payloads)
    finally:
        await store.close()
