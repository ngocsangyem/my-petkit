"""A device re-sending `dev_upload_file_info_v2` for media that is already filed.

Devices retry the call when they miss the response. By then the pipeline has
already decrypted the upload, filed it in the friendly tree and removed the raw
bytes from `.raw`. Replaying the metadata must not take a playable item off the
timeline.
"""
import os
from pathlib import Path

import pytest

from my_petkit.devices.base import Device
from my_petkit.events import ingest
from my_petkit.events.store import EventStore
from my_petkit.media import pipeline

JPEG_BYTES = b"\xff\xd8\xff\xe0" + b"A" * 60


@pytest.mark.xfail(strict=True, reason=(
    "a replayed file_info rewrites a ready media row to 'pending' and then "
    "'missing' because the raw upload was already consumed"))
async def test_resent_file_info_keeps_processed_media_ready(tmp_path):
    raw_root = tmp_path / "media" / ".raw"
    media_root = tmp_path / "media"
    raw_root.mkdir(parents=True)
    config = {"media_raw_root": str(raw_root), "media_root": str(media_root),
              "data_dir": str(tmp_path)}
    store = EventStore(tmp_path / "petkit.db")
    device = Device(device_type="t5", petkit_id=1, serial_number="SN")
    try:
        rel = "t5/1/eventImage/f-resend"
        (raw_root / rel).parent.mkdir(parents=True)
        (raw_root / rel).write_bytes(JPEG_BYTES)
        info = {"fileId": "f-resend", "fileUrl": f"https://localhost:9000/{rel}",
                "cycleType": "eventImage", "fileType": "image", "encrypt": "0",
                "eventId": "session-resend"}

        filed = await pipeline.process_file_info(device, info, config, store)
        assert filed and os.path.isfile(filed)
        assert (await store.get_media_by_file_id("f-resend"))["status"] == "ready"

        # The replay, exactly as handle_upload_file_info runs it: the metadata
        # row is upserted, then the pipeline task is started for the entry.
        await store.upsert_media(ingest.from_file_info(device, info))
        await pipeline.process_file_info(device, info, config, store)

        row = await store.get_media_by_file_id("f-resend")
        assert row["status"] == "ready"
        assert row["media_path"] == filed
        assert Path(filed).read_bytes() == JPEG_BYTES
    finally:
        await store.close()
