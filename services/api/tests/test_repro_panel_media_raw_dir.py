"""The panel's media routes must never reach the hidden raw upload area.

`{media_root}/.raw` is the device bucket's staging dir: undecrypted uploads
and the stitcher's work files. It is device-plane data that happens to live
under the friendly media root, so containment under that root is not enough —
the user plane must refuse it however the path is spelled.
"""
import tempfile
from pathlib import Path

import pytest
from aiohttp.test_utils import TestClient, TestServer

from my_petkit.devices.registry import DeviceRegistry
from my_petkit.events.store import EventStore
from my_petkit.media.retention import RetentionConfig
from my_petkit.web.hub import EventHub
from my_petkit.web.panel import create_panel_app

RAW_BYTES = b"\xff\xd8\xff\xe0" + b"RAW-UPLOAD" * 8

# Same request in several spellings: plain, percent-encoded dot / slash, and a
# `..` hop through a friendly folder.
RAW_URLS = [
    "/api/media/.raw/t5/1/eventImage/blob.jpg",
    "/api/media/%2Eraw/t5/1/eventImage/blob.jpg",
    "/api/media/.raw%2Ft5%2F1%2FeventImage%2Fblob.jpg",
    "/api/media/Device/..%2F.raw/t5/1/eventImage/blob.jpg",
    "/api/media/thumb/.raw/t5/1/eventImage/blob.jpg",
    "/api/media/thumb/%2Eraw/t5/1/eventImage/blob.jpg",
]


@pytest.mark.xfail(strict=True, reason=(
    "/api/media and /api/media/thumb serve files from {media_root}/.raw "
    "because the only check is containment under media_root"))
async def test_panel_media_routes_refuse_the_raw_upload_dir():
    with tempfile.TemporaryDirectory() as tmp:
        media_root = Path(tmp) / "media"
        blob = media_root / ".raw" / "t5" / "1" / "eventImage" / "blob.jpg"
        blob.parent.mkdir(parents=True)
        blob.write_bytes(RAW_BYTES)
        (media_root / "Device").mkdir()

        reg = DeviceRegistry()
        reg.get_or_create(petkit_id=1, device_type="t5", serial_number="SN")
        store = EventStore(Path(tmp) / "petkit.db")
        cfg = {"api_url": "http://x/6/", "capture": False, "capture_dir": "/nope",
               "data_dir": tmp, "media_root": str(media_root)}
        app = create_panel_app(reg, None, EventHub(), cfg, bridge=None,
                               event_store=store, retention_config=RetentionConfig())
        client = TestClient(TestServer(app))
        await client.start_server()
        try:
            leaked = []
            for url in RAW_URLS:
                r = await client.get(url)
                body = await r.read()
                if r.status == 200 and body == RAW_BYTES:
                    leaked.append(url)
            assert not leaked, f"raw upload served to the user plane via: {leaked}"
        finally:
            await client.close()
            await store.close()
