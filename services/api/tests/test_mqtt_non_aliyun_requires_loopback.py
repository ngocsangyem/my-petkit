"""A client without an Aliyun-shaped id is accepted only from loopback.

The only legitimate such client is the internal bridge, which dials
`localhost`. Every device connects with an Aliyun-shaped id, so this never
touches firmware; it closes the broker to anything else on the LAN that would
otherwise have been waved through as "internal", strict mode or not.
"""

import pytest
from amqtt.contexts import BaseContext

from my_petkit.devices.registry import DeviceRegistry
from my_petkit.mqtt.auth import AliyunAuthPlugin, is_loopback_peer

BRIDGE_ID = "my-petkit-bridge"


class _Session:
    def __init__(self, client_id: str, remote_address: object) -> None:
        self.client_id = client_id
        self.remote_address = remote_address
        self.username = ""
        self.password = ""
        self.keep_alive = 60


def _plugin(*, strict: bool, registry: bool = True) -> AliyunAuthPlugin:
    plugin = AliyunAuthPlugin(BaseContext())
    if registry:
        plugin.set_registry(DeviceRegistry())
    plugin.set_strict(strict)
    return plugin


@pytest.mark.parametrize("strict", [False, True])
@pytest.mark.parametrize("peer", ["127.0.0.1", "127.0.0.53", "::1", "::ffff:127.0.0.1"])
async def test_the_internal_bridge_on_loopback_is_accepted(strict, peer):
    assert await _plugin(strict=strict).authenticate(session=_Session(BRIDGE_ID, peer)) is True


@pytest.mark.parametrize("strict", [False, True])
@pytest.mark.parametrize("peer", [
    "192.168.1.20",          # another host on the LAN
    "10.0.0.5",
    "203.0.113.9",           # public
    "::ffff:192.168.1.20",   # LAN address on a dual-stack socket
    "fe80::1",
    "0.0.0.0",  # noqa: S104 - a peer address under test, not a bind
    None,                    # peer unknown: fail closed
    "localhost",             # never a resolved name, so not proof of anything
    "garbage",
])
async def test_a_non_aliyun_client_from_anywhere_else_is_refused(strict, peer):
    assert await _plugin(strict=strict).authenticate(session=_Session(BRIDGE_ID, peer)) is False


async def test_the_refusal_holds_before_a_registry_is_set():
    """amqtt builds the plugin and the registry is injected later; that window
    must not reopen the door the loopback rule closes."""
    plugin = _plugin(strict=False, registry=False)
    assert await plugin.authenticate(session=_Session(BRIDGE_ID, "192.168.1.20")) is False
    assert await plugin.authenticate(session=_Session(BRIDGE_ID, "127.0.0.1")) is True


async def test_an_empty_client_id_from_the_lan_is_refused():
    assert await _plugin(strict=False).authenticate(session=_Session("", "192.168.1.20")) is False


async def test_a_device_shaped_id_from_the_lan_still_takes_the_device_path():
    """Firmware is unaffected: a device on the LAN keeps today's non-strict
    behaviour (unknown device allowed and logged)."""
    device_id = "a1PK.d_t5_SN1|timestamp=1,signmethod=hmacsha256|"
    plugin = _plugin(strict=False)
    assert await plugin.authenticate(session=_Session(device_id, "192.168.1.20")) is True
    strict = _plugin(strict=True)
    assert await strict.authenticate(session=_Session(device_id, "192.168.1.20")) is False


def test_is_loopback_peer_strips_an_ipv6_zone():
    assert is_loopback_peer("::1%lo0") is True
    assert is_loopback_peer("fe80::1%en0") is False
