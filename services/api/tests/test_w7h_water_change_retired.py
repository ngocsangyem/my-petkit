"""The W7H's Water Change job (`start_action: 5`) is gone and cannot be sent.

On a real W7H (fw 456) that value rebooted the device three presses out of
three, and the official app has no control that sends it. So nothing may build
it, neither Home Assistant nor the panel may reach it by name, and an install
that already discovered the button has it cleared with an empty retained config.
"""
import pytest

from my_petkit.devices.base import Device
from my_petkit.devices.ble import BLERegistry
from my_petkit.devices.registry import DeviceRegistry
from my_petkit.events import codes
from my_petkit.ha.categories import get_entities_for_device, get_retired_entities_for_device
from my_petkit.ha.commands import ALL_ACTIONS, _fountain_start
from my_petkit.ha.discovery import discovery_topic
from my_petkit.ha.entities.buttons import FOUNTAIN_W7H_RETIRED_BUTTONS
from my_petkit.ha.publisher import HAPublisher
from my_petkit.web.hub import EventHub
from my_petkit.web.panel import create_panel_app
from tests._fakes import FakeMqttClient
from tests.conftest_auth import authed_test_client

PANEL_CFG = {"api_url": "http://x/6/", "capture": False, "capture_dir": "/nope"}


def _w7h() -> Device:
    return Device(device_type="w7h", petkit_id=7, serial_number="W")


def test_the_crashing_start_action_cannot_be_built():
    """Still on the firmware's accept list, which is what makes it dangerous."""
    assert 5 in codes.FOUNTAIN_W7H_START_ACTIONS
    assert 5 in codes.FOUNTAIN_W7H_START_ACTIONS_CRASH
    with pytest.raises(ValueError, match="crashes"):
        _fountain_start(5)


def test_no_named_action_sends_the_crashing_start_action_to_a_w7h():
    """The panel can post any `ALL_ACTIONS` key by name, so check all of them."""
    device = _w7h()
    assert "fountain_water_change" not in ALL_ACTIONS
    for key, build in ALL_ACTIONS.items():
        try:
            result = build(device)
        except ValueError:  # refused while building: nothing is sent
            result = None
        params = (result[1].get("params") or {}) if result else {}
        assert params.get("start_action") not in codes.FOUNTAIN_W7H_START_ACTIONS_CRASH, key


def test_discovery_no_longer_offers_water_change():
    keys = {e.key for e in get_entities_for_device(_w7h())}
    assert "fountain_water_change" not in keys
    assert {"fountain_flush", "fountain_refill"} <= keys


def test_only_the_w7h_retires_water_change():
    assert [e.key for e in get_retired_entities_for_device(_w7h())] == ["fountain_water_change"]
    for other in ("t5", "d4sh", "w5"):
        device = Device(device_type=other, petkit_id=1, serial_number="X")
        assert get_retired_entities_for_device(device) == [], other


async def test_the_retired_water_change_config_is_cleared_from_home_assistant():
    """HA keeps a retained discovery config until it is overwritten with an
    empty one; just not announcing the button would leave it pressable."""
    reg = DeviceRegistry()
    device = reg.get_or_create(petkit_id=7, device_type="w7h", serial_number="W")
    pub = HAPublisher(reg, {})
    client = FakeMqttClient()
    pub._client = client
    pub._connected = True

    await pub.publish_discovery(device)

    retired_topic = discovery_topic(FOUNTAIN_W7H_RETIRED_BUTTONS[0], 7, pub._prefix)
    assert (retired_topic, "", {"retain": True}) in client.published
    cleared = {topic for topic, payload, kw in client.published
               if payload == "" and kw.get("retain")}
    assert cleared == {retired_topic}
    # Nothing announced is also cleared, and HA cannot route a command to it.
    for entity in get_entities_for_device(device):
        assert discovery_topic(entity, 7, pub._prefix) not in cleared, entity.key
    routable = {e.key for e in pub._commands._entity_index[7].values()}
    assert "fountain_water_change" not in routable


@pytest.mark.parametrize("body", [{"action": "fountain_water_change"},
                                  {"entity": "fountain_water_change", "value": ""}])
async def test_the_panel_refuses_water_change_and_queues_nothing(body):
    reg = DeviceRegistry()
    reg.get_or_create(petkit_id=1, device_type="w7h", serial_number="SN")
    app = create_panel_app(reg, BLERegistry(), EventHub(), dict(PANEL_CFG), None)
    client = authed_test_client(app)
    await client.start_server()
    try:
        r = await client.post("/api/devices/1/command", json=body)
        assert r.status == 400
    finally:
        await client.close()
    assert reg.get(1).command_queue == []
