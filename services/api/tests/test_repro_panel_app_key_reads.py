"""Panel handlers must read collaborators under the keys the panel stores them.

`create_panel_app` stores the event hub as `hub` and the HA publisher as
`ha_publisher` (`web/appkeys.py`). The sound handlers read `event_hub`, and
device delete reads `publisher` and `event_hub` — keys the panel app never sets,
so each `.get` is silently None.
"""
import pytest
from aiohttp import FormData
from aiohttp.test_utils import TestClient, TestServer

from my_petkit.devices.ble import BLERegistry
from my_petkit.devices.registry import DeviceRegistry
from my_petkit.web.hub import EventHub
from my_petkit.web.panel import create_panel_app


class _FakeBridge:
    def __init__(self):
        self._client = object()
        self.sent = []

    async def publish_to_device(self, device, suffix, payload):
        self.sent.append((device.petkit_id, suffix, payload))


class _FakePublisher:
    def __init__(self):
        self.unpublished = []

    async def unpublish_discovery(self, device):
        self.unpublished.append(device.petkit_id)


async def _panel(tmp_path, *, bridge=None, ha_publisher=None):
    reg = DeviceRegistry()
    dev = reg.get_or_create(petkit_id=100, device_type="t5", serial_number="SN100")
    hub = EventHub()
    cfg = {"api_url": "http://x/6/", "capture": False, "capture_dir": str(tmp_path),
           "data_dir": str(tmp_path), "bucket_endpoint": "https://10.0.0.7:9000"}
    app = create_panel_app(reg, BLERegistry(), hub, cfg, bridge, ha_publisher=ha_publisher)
    client = TestClient(TestServer(app))
    await client.start_server()
    return client, reg, dev, hub


@pytest.mark.xfail(strict=True, reason="sound play reads app['event_hub'] (unset on the "
                   "panel) and answers 400 'no event hub'")
async def test_playing_a_sound_queues_the_command(tmp_path):
    client, reg, dev, hub = await _panel(tmp_path)
    try:
        r = await client.post("/api/devices/100/sounds/1/play")
        assert r.status == 200, await r.text()
        assert (await r.json())["delivered"] == "heartbeat-queue"
    finally:
        await client.close()


@pytest.mark.xfail(strict=True, reason="sound select reads app['event_hub'] (unset on the "
                   "panel) and answers 400 'no event hub'")
async def test_selecting_a_sound_queues_the_command(tmp_path):
    client, reg, dev, hub = await _panel(tmp_path)
    try:
        r = await client.post("/api/devices/100/sounds/1/select")
        assert r.status == 200, await r.text()
        assert (await r.json())["delivered"] == "heartbeat-queue"
    finally:
        await client.close()


@pytest.mark.xfail(strict=True, reason="sound upload reads app['event_hub'] (unset on the "
                   "panel) so the new soundList is never pushed to the device")
async def test_uploading_a_sound_pushes_the_new_sound_list(tmp_path):
    bridge = _FakeBridge()
    client, reg, dev, hub = await _panel(tmp_path, bridge=bridge)
    dev.mqtt_connected = True
    try:
        form = FormData()
        form.add_field("file", b"ID3fake-mp3-bytes", filename="bark.mp3",
                       content_type="audio/mpeg")
        r = await client.post("/api/devices/100/sounds", data=form)
        assert r.status == 200, await r.text()
        pushed = [p for (_id, suffix, p) in bridge.sent if suffix == "property/set"]
        assert pushed and "soundList" in pushed[0]["params"]
    finally:
        await client.close()


@pytest.mark.xfail(strict=True, reason="device delete reads app['publisher'] (unset on "
                   "the panel) so the device's HA entities are never unpublished")
async def test_deleting_a_device_unpublishes_its_ha_entities(tmp_path):
    publisher = _FakePublisher()
    client, reg, dev, hub = await _panel(tmp_path, ha_publisher=publisher)
    try:
        r = await client.delete("/api/devices/100")
        assert r.status == 200
        assert reg.get(100) is None
        assert publisher.unpublished == [100]
    finally:
        await client.close()


@pytest.mark.xfail(strict=True, reason="device delete reads app['event_hub'] (unset on "
                   "the panel) so the device's diagnostics are never cleared")
async def test_deleting_a_device_clears_its_diagnostics(tmp_path):
    client, reg, dev, hub = await _panel(tmp_path)
    hub.record_http(100, "POST", "/6/t5/dev_state_report", 200)
    assert hub.diag(100), "precondition: the device has diagnostics"
    try:
        r = await client.delete("/api/devices/100")
        assert r.status == 200
        assert reg.get(100) is None
        assert hub.diag(100) == {}
    finally:
        await client.close()
