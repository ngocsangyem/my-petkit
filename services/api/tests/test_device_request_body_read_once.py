"""A device request body is either handled whole or dropped and logged, never handled cut short.

aiohttp raises past `client_max_size` only after consuming the stream, and then
caches nothing, so a second `read()` returns the unread tail. With several
middlewares each reading and swallowing that error, a 2 MiB event report used to
reach its handler as its last ~900 KB -- `eventType` and `eventId` gone -- and
was stored as a corrupt row behind a 200.
"""

import logging
import tempfile
import urllib.parse
from pathlib import Path

from aiohttp.test_utils import TestClient, TestServer

from my_petkit.devices.registry import DeviceRegistry
from my_petkit.events.store import EventStore
from my_petkit.http import server
from my_petkit.http.middleware import DEVICE_MAX_BODY
from my_petkit.web.hub import EventHub

CONFIG = {"api_url": "http://server/6/", "proxy_mode": False, "capture": False}
HDR = {"X-Device": "id=100&sn=SN100",
       "Content-Type": "application/x-www-form-urlencoded"}


def _event_report(size: int) -> bytes:
    """An event report of `size` bytes whose identifying fields come FIRST.

    The front is exactly what a truncated tail loses, so a parse of anything but
    the whole body cannot find them.
    """
    head = "eventType=10&eventId=e-big&content="
    pad = urllib.parse.quote('{"note":"') + "A" * size
    body = (head + pad)[:size - len(urllib.parse.quote('"}'))] + urllib.parse.quote('"}')
    return body.encode()


async def _post(tmp: str, body: bytes) -> tuple[int, dict, EventStore, EventHub]:
    reg = DeviceRegistry()
    reg.get_or_create(petkit_id=100, device_type="t5", serial_number="SN100")
    store = EventStore(Path(tmp) / "petkit.db")
    hub = EventHub()
    app = server.create_app(reg, dict(CONFIG))
    app["event_store"] = store
    app["event_hub"] = hub
    client = TestClient(TestServer(app))
    await client.start_server()
    try:
        r = await client.post("/6/t5/dev_event_report", headers=HDR, data=body)
        return r.status, await r.json(), store, hub
    finally:
        await client.close()


async def test_a_two_mib_event_report_is_parsed_whole():
    body = _event_report(2 * 1024 * 1024)
    assert len(body) == 2 * 1024 * 1024
    with tempfile.TemporaryDirectory() as tmp:
        status, reply, store, _hub = await _post(tmp, body)
        rows = await store.query_timeline(device_id=100)
        await store.close()
    assert status == 200
    assert reply["result"] == "success"
    assert [(r["event_type"], r["related_event"]) for r in rows] == [("10", "e-big")]


async def test_a_body_over_the_limit_is_dropped_logged_and_answered_success(
        monkeypatch, caplog):
    # A small limit stands in for DEVICE_MAX_BODY, so the test does not have to
    # send 16 MiB to prove the same path.
    monkeypatch.setattr(server, "DEVICE_MAX_BODY", 64 * 1024)
    caplog.set_level(logging.WARNING, logger="my_petkit.http.middleware.body")
    with tempfile.TemporaryDirectory() as tmp:
        status, reply, store, hub = await _post(tmp, _event_report(256 * 1024))
        rows = await store.query_timeline(device_id=100)
        await store.close()

    assert status == 200
    assert reply == {"result": {}}
    assert rows == []
    assert any("Dropped the body" in r.getMessage() for r in caplog.records)
    entry = next(e for e in hub.recent(10) if e.get("kind") == "http")
    assert entry["detail"]["body_dropped"]


def test_the_device_limit_is_above_aiohttps_default_and_below_the_buckets():
    assert 1024 * 1024 < DEVICE_MAX_BODY < 50 * 1024 * 1024
