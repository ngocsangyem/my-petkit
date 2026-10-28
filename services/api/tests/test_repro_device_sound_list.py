"""Reproduction awaiting approval: uploaded sounds never reach a device.

The device API's `dev_sound_get` reads the panel app's `cfg` key on the device
app, which has none; the request raises and the never-fail middleware answers
an empty list. Fixing it changes what a device receives, so it waits for
approval like every other device-facing change.
"""

import json

import pytest
from aiohttp.test_utils import TestClient, TestServer

from my_petkit.devices import sound_store
from my_petkit.devices.registry import DeviceRegistry
from my_petkit.http.server import create_app


@pytest.mark.xfail(strict=True, reason="dev_sound_get reads a key the device app does not have")
async def test_an_uploaded_sound_is_listed_to_its_device(tmp_path):
    reg = DeviceRegistry()
    reg.get_or_create(petkit_id=100, device_type="d4h", serial_number="SN100")
    sound_store.save_sounds(str(tmp_path), 100, [
        {"id": 1, "name": "dinner", "filename": "1.mp3", "duration": 2, "digest": "d", "size": 3}])
    app = create_app(reg, {"api_url": "http://server/6/", "bucket_endpoint": "https://server:9000",
                           "data_dir": str(tmp_path)})
    async with TestClient(TestServer(app)) as client:
        r = await client.post("/6/d4h/dev_sound_get", headers={"X-Device": "id=100&sn=SN100"},
                              data=json.dumps({}))
        result = (await r.json())["result"]
    assert [s["name"] for s in result] == ["dinner"]
