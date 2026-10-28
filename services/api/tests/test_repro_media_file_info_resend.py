"""A device re-sending `dev_upload_file_info_v2` for media that is already filed.

Devices retry the call when they miss the response. By then the pipeline has
already decrypted the upload, filed it in the friendly tree and removed the raw
bytes from `.raw`. Replaying the metadata must not take a playable item off the
timeline.
"""
import os
from pathlib import Path

from my_petkit.devices.base import Device
from my_petkit.events import ingest
from my_petkit.events.store import EventStore
from my_petkit.media import pipeline

JPEG_BYTES = b"\xff\xd8\xff\xe0" + b"A" * 60


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


def _setup(tmp_path):
    raw_root = tmp_path / "media" / ".raw"
    raw_root.mkdir(parents=True)
    config = {"media_raw_root": str(raw_root), "media_root": str(tmp_path / "media"),
              "data_dir": str(tmp_path)}
    rel = "t5/1/eventImage/f-resend"
    info = {"fileId": "f-resend", "fileUrl": f"https://localhost:9000/{rel}",
            "cycleType": "eventImage", "fileType": "image", "encrypt": "0",
            "eventId": "session-resend"}
    return raw_root / rel, config, info


async def test_resent_file_info_with_fresh_bytes_keeps_the_filed_copy(tmp_path):
    raw, config, info = _setup(tmp_path)
    store = EventStore(tmp_path / "petkit.db")
    device = Device(device_type="t5", petkit_id=1, serial_number="SN")
    try:
        raw.parent.mkdir(parents=True)
        raw.write_bytes(JPEG_BYTES)
        filed = await pipeline.process_file_info(device, info, config, store)

        raw.write_bytes(b"\xff\xd8\xff\xe0" + b"B" * 60)  # the device PUTs again
        await store.upsert_media(ingest.from_file_info(device, info))
        again = await pipeline.process_file_info(device, info, config, store)

        assert again == filed
        assert Path(filed).read_bytes() == JPEG_BYTES
        assert sorted(p.name for p in Path(filed).parent.iterdir()) == [Path(filed).name]
        row = await store.get_media_by_file_id("f-resend")
        assert (row["status"], row["media_path"]) == ("ready", filed)
    finally:
        await store.close()


async def test_a_ready_row_whose_file_is_gone_is_processed_again(tmp_path):
    raw, config, info = _setup(tmp_path)
    store = EventStore(tmp_path / "petkit.db")
    device = Device(device_type="t5", petkit_id=1, serial_number="SN")
    try:
        raw.parent.mkdir(parents=True)
        raw.write_bytes(JPEG_BYTES)
        filed = await pipeline.process_file_info(device, info, config, store)
        os.remove(filed)

        # No raw bytes either: the row must be allowed to say so.
        await store.upsert_media(ingest.from_file_info(device, info))
        assert await pipeline.process_file_info(device, info, config, store) is None
        assert (await store.get_media_by_file_id("f-resend"))["status"] == "missing"

        # Bytes arrive again: filed anew.
        raw.write_bytes(JPEG_BYTES)
        refiled = await pipeline.process_file_info(device, info, config, store)
        assert refiled and Path(refiled).read_bytes() == JPEG_BYTES
        assert (await store.get_media_by_file_id("f-resend"))["status"] == "ready"
    finally:
        await store.close()
