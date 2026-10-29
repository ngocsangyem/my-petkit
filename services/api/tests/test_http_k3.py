"""A linked K3's battery and liquid arrive over HTTP as well as MQTT.

The K3 spray never posts anything itself; its `battery`/`liquid` ride along
at the top level of the parent litter box's state, next to `k3Id`. An
unpatched ESP32 parent (T4, D4, D3) never sends an MQTT property post, so the
`dev_state_report` body and the `state` block of `dev_event_report` are the
only places its K3's levels ever appear. Seen on a live T4 (fw 1.652): every
state report and every event report carried `k3Id`, `liquid` and `battery`.

The same top-level `battery` key can be the parent's OWN battery, so the
values only go to the K3 when the frame names it with a matching `k3Id`.
"""
from __future__ import annotations

import json
from functools import partial
from urllib.parse import urlencode

from aiohttp.test_utils import TestClient, TestServer

from my_petkit.devices.ble import BLERegistry
from my_petkit.devices.registry import DeviceRegistry
from my_petkit.events.store import EventStore
from my_petkit.http.server import create_app
from my_petkit.main.wiring import _on_state_report
from my_petkit.mqtt.ble_relay import update_linked_k3

CONFIG = {
    "api_url": "http://server/6/",
    "mqtt_port": 1883,
    "proxy_mode": False,
    "proxy_upstream": "",
    "proxy_block_run_cmd": True,
    "capture": False,
}

PARENT_ID = 100050447
K3_ID = 555
HDR = {"X-Device": f"id={PARENT_ID}&sn=SN",
       "Content-Type": "application/x-www-form-urlencoded"}


class _FakePublisher:
    """Records what would have been published to Home Assistant."""

    def __init__(self) -> None:
        self.states: list[int] = []
        self.ble_states: list[int] = []
        self.ble_discovery: list[int] = []

    async def publish_state(self, device):
        self.states.append(device.petkit_id)

    async def publish_availability(self, device):
        pass

    async def publish_ble_discovery(self, ble_dev):
        self.ble_discovery.append(ble_dev.petkit_id)

    async def publish_ble_state(self, ble_dev):
        self.ble_states.append(ble_dev.petkit_id)

    async def publish_event(self, *_a, **_k):
        pass


def _setup():
    reg = DeviceRegistry()
    reg.get_or_create(petkit_id=PARENT_ID, device_type="t4", serial_number="SN")
    ble = BLERegistry()
    ble.register(ble_type="k3", petkit_id=K3_ID, mac="AA:BB", link_with=PARENT_ID)
    return reg, ble, _FakePublisher()


async def _client(reg, ble, pub) -> TestClient:
    app = create_app(reg, dict(CONFIG))
    app["ble_registry"] = ble
    app["ha_publisher"] = pub
    app["event_store"] = EventStore(":memory:")
    # The production hook, bound exactly as `build_services` binds it.
    app["on_state_report"] = partial(_on_state_report, pub, ble)
    client = TestClient(TestServer(app))
    await client.start_server()
    return client


def test_the_helper_moves_battery_and_liquid_onto_the_named_k3():
    reg, ble, _pub = _setup()
    changed = update_linked_k3(reg.get(PARENT_ID),
                               {"k3Id": K3_ID, "battery": 88, "liquid": 60}, ble,
                               require_k3_id=True)
    assert changed is not None and changed.petkit_id == K3_ID
    assert ble.get(K3_ID).state["consumables"] == {"battery": 88, "liquid": 60}


def test_the_helper_accepts_k3_id_as_a_decimal_string():
    reg, ble, _pub = _setup()
    changed = update_linked_k3(reg.get(PARENT_ID),
                               {"k3Id": str(K3_ID), "liquid": 41}, ble, require_k3_id=True)
    assert changed is not None
    assert ble.get(K3_ID).state["consumables"] == {"liquid": 41}


def test_the_helper_does_nothing_without_a_linked_k3():
    reg = DeviceRegistry()
    reg.get_or_create(petkit_id=PARENT_ID, device_type="t4", serial_number="SN")
    params = {"k3Id": K3_ID, "battery": 88, "liquid": 60}
    assert update_linked_k3(reg.get(PARENT_ID), params, BLERegistry()) is None


def test_the_helper_ignores_a_state_with_neither_level():
    reg, ble, _pub = _setup()
    assert update_linked_k3(reg.get(PARENT_ID), {"k3Id": K3_ID, "sandType": 1}, ble,
                            require_k3_id=True) is None


def test_a_parent_battery_without_k3_id_never_reaches_the_k3():
    """A battery-powered parent reports its own `battery` at the top level;
    with no `k3Id` naming the K3 it is not the K3's level."""
    reg, ble, _pub = _setup()
    assert update_linked_k3(reg.get(PARENT_ID), {"battery": 12}, ble,
                            require_k3_id=True) is None
    assert "consumables" not in ble.get(K3_ID).state


def test_a_k3_id_naming_another_k3_is_refused_on_every_transport():
    reg, ble, _pub = _setup()
    for k3_id in (999, 0, "999", None, True):
        params = {"k3Id": k3_id, "battery": 12, "liquid": 5}
        assert update_linked_k3(reg.get(PARENT_ID), params, ble) is None
        assert update_linked_k3(reg.get(PARENT_ID), params, ble, require_k3_id=True) is None
    assert "consumables" not in ble.get(K3_ID).state


async def test_a_state_report_updates_the_linked_k3():
    reg, ble, pub = _setup()
    client = await _client(reg, ble, pub)
    try:
        state = {
            "litter": {"weight": 1944, "percent": 0, "sandType": 0},
            "k3Id": K3_ID, "liquid": 60, "battery": 88,
        }
        r = await client.post("/6/t4/dev_state_report", headers=HDR,
                              data=f"state={json.dumps(state)}")
        assert r.status == 200
        assert ble.get(K3_ID).state["consumables"] == {"battery": 88, "liquid": 60}
        assert K3_ID in pub.ble_states
        assert K3_ID in pub.ble_discovery
    finally:
        await client.close()


async def test_a_state_report_without_k3_id_leaves_the_k3_alone():
    reg, ble, pub = _setup()
    client = await _client(reg, ble, pub)
    try:
        state = {"litter": {"weight": 1944}, "battery": 12}
        r = await client.post("/6/t4/dev_state_report", headers=HDR,
                              data=f"state={json.dumps(state)}")
        assert r.status == 200
        assert PARENT_ID in pub.states
        assert "consumables" not in ble.get(K3_ID).state
        assert pub.ble_states == []
    finally:
        await client.close()


async def test_an_event_report_state_block_updates_the_linked_k3():
    reg, ble, pub = _setup()
    client = await _client(reg, ble, pub)
    try:
        form = {
            "eventType": "5",
            "event_id": f"{PARENT_ID}_1786877430",
            "timestamp": "1786877529",
            "content": json.dumps({"result": 0, "err": None}),
            "state": json.dumps({
                "litter": {"weight": 1943, "percent": 0, "sandType": 0},
                "k3Id": K3_ID, "liquid": 42, "battery": 77,
            }),
        }
        r = await client.post("/6/t4/dev_event_report", headers=HDR, data=urlencode(form))
        assert r.status == 200
        assert ble.get(K3_ID).state["consumables"] == {"battery": 77, "liquid": 42}
        assert K3_ID in pub.ble_states
        assert K3_ID in pub.ble_discovery
    finally:
        await client.close()
