"""An uploaded sound is listed to its device by `dev_sound_get`.

The handler once read the panel app's `cfg` key on the device app, which has
none; the request raised and the never-fail middleware answered an empty list,
so no uploaded sound ever reached a device.
"""

import json

from aiohttp.test_utils import TestClient, TestServer

from my_petkit.devices import sound_store
from my_petkit.devices.registry import DeviceRegistry
from my_petkit.http.server import create_app


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
