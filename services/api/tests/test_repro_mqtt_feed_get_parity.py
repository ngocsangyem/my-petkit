"""MQTT `user/get dev_feed_get` must answer what HTTP `dev_feed_get` answers.

`mqtt/user_get.py` promises "identical config over either transport", and the
feeder dispenses from whichever reply it got last. The HTTP handler builds the
cloud-shaped `{schedule, nextTick, latest}`; the MQTT path once handed back the
raw stored dict instead.
"""
from aiohttp.test_utils import TestClient, TestServer

from my_petkit.devices.registry import DeviceRegistry
from my_petkit.http.server import create_app
from my_petkit.mqtt.user_get import user_get_payload

CONFIG = {"api_url": "http://server/6/", "proxy_mode": False, "capture": False}
HDR = {"X-Device": "id=100&sn=SN100"}


def _feeder_with_schedule() -> tuple[DeviceRegistry, object]:
    reg = DeviceRegistry()
    dev = reg.get_or_create(petkit_id=100, device_type="d4sh", serial_number="SN100")
    # A daily 12:56:00 meal in the wire format (seconds since local midnight),
    # already stamped as post-migration so neither path rewrites it.
    dev.config["feed_schedule"] = {
        "v": 2,
        "schedule": [{"re": "1,2,3,4,5,6,7",
                      "it": [{"id": "n_46560", "t": 46560, "a1": 1, "a2": 0}]}],
    }
    return reg, dev


async def test_mqtt_feed_get_answers_the_same_fields_as_http_feed_get():
    reg, dev = _feeder_with_schedule()
    mqtt_reply = user_get_payload(dev, "dev_feed_get", ble_registry=None,
                                  api_url=CONFIG["api_url"])

    client = TestClient(TestServer(create_app(reg, dict(CONFIG))))
    await client.start_server()
    try:
        r = await client.post("/6/d4sh/dev_feed_get", headers=HDR)
        http_reply = await r.json()
    finally:
        await client.close()

    assert {"schedule", "nextTick", "latest"} <= set(http_reply["result"])
    assert mqtt_reply is not None
    assert "nextTick" in mqtt_reply["result"]
    assert "latest" in mqtt_reply["result"]
    assert set(mqtt_reply["result"]) == set(http_reply["result"])


async def test_mqtt_and_http_feed_get_agree_value_for_value_at_the_same_instant(monkeypatch):
    # One frozen instant for both transports, so the live countdowns match.
    monkeypatch.setattr("time.time", lambda: 1_790_000_000.0)
    reg, dev = _feeder_with_schedule()
    mqtt_reply = user_get_payload(dev, "dev_feed_get", ble_registry=None,
                                  api_url=CONFIG["api_url"])

    client = TestClient(TestServer(create_app(reg, dict(CONFIG))))
    await client.start_server()
    try:
        r = await client.post("/6/d4sh/dev_feed_get", headers=HDR)
        http_reply = await r.json()
    finally:
        await client.close()

    assert mqtt_reply == http_reply
    assert mqtt_reply["result"]["latest"]


def test_mqtt_feed_get_stays_silent_when_no_schedule_is_stored():
    reg = DeviceRegistry()
    dev = reg.get_or_create(petkit_id=100, device_type="d4sh", serial_number="SN100")
    assert user_get_payload(dev, "dev_feed_get", ble_registry=None,
                            api_url=CONFIG["api_url"]) is None
