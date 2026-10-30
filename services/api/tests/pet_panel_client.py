"""A signed-in panel client over a real event store and pet registry."""

from my_petkit.devices.registry import DeviceRegistry
from my_petkit.web.hub import EventHub
from my_petkit.web.panel import create_panel_app
from tests.conftest_auth import authed_test_client


async def pet_panel(pet_registry, store):
    reg = DeviceRegistry()
    reg.get_or_create(petkit_id=10, device_type="t6", serial_number="SN10")
    cfg = {"api_url": "http://x/6/", "capture": False, "capture_dir": "/nope"}
    app = create_panel_app(reg, None, EventHub(), cfg, store)
    app["pet_registry"] = pet_registry
    app["event_store"] = store
    client = authed_test_client(app)
    await client.start_server()
    return client
