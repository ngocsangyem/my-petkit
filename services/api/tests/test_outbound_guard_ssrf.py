"""Every connection the server opens to a device goes through one guard.

A device reports its own address, so without a gate a device (or anything that
can pose as one) chooses where the server connects: the cloud metadata
service, a loopback-only admin port, the internet. Allowed: an IP literal on a
device network (RFC 1918, ULA, configured WireGuard) that a registered device
reported. Refused: everything else, before any socket is opened.
"""

import pytest
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer

from my_petkit.config import Config
from my_petkit.devices.base import Device
from my_petkit.devices.registry import DeviceRegistry
from my_petkit.media import go2rtc as g
from my_petkit.patchers import common
from my_petkit.utils import outbound_guard
from my_petkit.utils.outbound_guard import OutboundGuard, OutboundRefused

LAN_DEVICE = "192.168.1.50"


def _device(petkit_id: int, ip: str) -> Device:
    d = Device(device_type="t5", petkit_id=petkit_id, serial_number=f"SN{petkit_id}")
    d.state["ip"] = ip
    d.state[g.STREAM_AVAILABLE] = True
    return d


def _registry(*devices: Device) -> DeviceRegistry:
    reg = DeviceRegistry()
    for d in devices:
        reg._devices[d.petkit_id] = d
    return reg


@pytest.fixture
def install():
    """Install a guard over `ips` for one test, and always remove it after."""
    def _install(*ips: str, wireguard: tuple[str, ...] = ()) -> OutboundGuard:
        guard = OutboundGuard(lambda: list(ips), wireguard)
        outbound_guard.configure(guard)
        return guard
    yield _install
    outbound_guard.configure(None)


# --- the policy ---------------------------------------------------------------

@pytest.mark.parametrize("ip", [
    "8.8.8.8",            # public
    "203.0.113.7",        # public (documentation range, not a device network)
    "127.0.0.1",          # loopback
    "::1",
    "169.254.169.254",    # cloud metadata
    "fe80::1",            # link-local
    "0.0.0.0",  # noqa: S104 - an address under test, not a bind
    "224.0.0.1",          # multicast
    "::ffff:127.0.0.1",   # loopback smuggled as IPv4-mapped IPv6
])
def test_a_registered_device_reporting_a_forbidden_address_is_refused(install, ip):
    """Even when a device really did report it."""
    install(ip)
    with pytest.raises(OutboundRefused):
        outbound_guard.check_device_target(ip)


def test_a_private_address_no_device_reported_is_refused(install):
    install(LAN_DEVICE)
    with pytest.raises(OutboundRefused, match="not the reported address"):
        outbound_guard.check_device_target("192.168.1.51")


@pytest.mark.parametrize("host", ["", "device.local", "192.168.1.50:8888", "http://192.168.1.50",
                                  "192.168.1.050", None])
def test_anything_but_an_ip_literal_is_refused(install, host):
    """No hostname means no DNS answer to rebind."""
    install(LAN_DEVICE)
    with pytest.raises(OutboundRefused):
        outbound_guard.check_device_target(host)


@pytest.mark.parametrize("ip", ["10.1.2.3", "172.16.0.9", "172.31.255.1", LAN_DEVICE, "fd00::42"])
def test_a_reported_address_on_a_device_network_is_allowed(install, ip):
    install(ip)
    assert outbound_guard.check_device_target(ip) == ip


def test_a_mapped_ipv4_device_address_is_canonicalised(install):
    install(LAN_DEVICE)
    assert outbound_guard.check_device_target(f"::ffff:{LAN_DEVICE}") == LAN_DEVICE


def test_a_configured_wireguard_subnet_is_a_device_network(install):
    install("100.64.0.7")
    with pytest.raises(OutboundRefused, match="outside"):
        outbound_guard.check_device_target("100.64.0.7")
    install("100.64.0.7", wireguard=("100.64.0.0/24",))
    assert outbound_guard.check_device_target("100.64.0.7") == "100.64.0.7"


def test_a_wireguard_subnet_cannot_reopen_loopback_or_metadata(install):
    install("127.0.0.1", "169.254.169.254", wireguard=("0.0.0.0/0",))
    for ip in ("127.0.0.1", "169.254.169.254"):
        with pytest.raises(OutboundRefused):
            outbound_guard.check_device_target(ip)


def test_with_no_guard_installed_everything_is_refused():
    outbound_guard.configure(None)
    with pytest.raises(OutboundRefused, match="no outbound guard"):
        outbound_guard.check_device_target(LAN_DEVICE)


def test_a_failing_device_list_fails_closed():
    def broken():
        raise RuntimeError("registry mid-mutation")
    outbound_guard.configure(OutboundGuard(broken))
    try:
        with pytest.raises(OutboundRefused):
            outbound_guard.check_device_target(LAN_DEVICE)
    finally:
        outbound_guard.configure(None)


def test_the_guard_follows_the_registry_live(install):
    reg = _registry(_device(1, LAN_DEVICE))
    outbound_guard.configure(OutboundGuard(lambda: [d.state.get("ip") for d in reg.all()]))
    try:
        assert outbound_guard.device_target_allowed(LAN_DEVICE)
        reg._devices[1].state["ip"] = "192.168.1.60"
        assert not outbound_guard.device_target_allowed(LAN_DEVICE)
        assert outbound_guard.device_target_allowed("192.168.1.60")
    finally:
        outbound_guard.configure(None)


def test_an_ipv6_target_is_bracketed_in_a_url():
    assert outbound_guard.authority("fd00::42") == "[fd00::42]"
    assert outbound_guard.authority(LAN_DEVICE) == LAN_DEVICE


@pytest.mark.parametrize("value", [["10.0.0.0/8", "fd00::/8"], []])
def test_wireguard_subnets_config_accepts_cidrs(value):
    Config(wireguard_subnets=value).validate_wireguard_subnets()


@pytest.mark.parametrize("value", [["10.0.0.0/33"], ["wg0"], "10.0.0.0/8"])
def test_wireguard_subnets_config_refuses_anything_else(value):
    with pytest.raises(ValueError, match="wireguard_subnets"):
        Config(wireguard_subnets=value).validate_wireguard_subnets()


# --- each caller goes through it ---------------------------------------------

@pytest.mark.parametrize("ip", ["8.8.8.8", "127.0.0.1", "169.254.169.254", "192.168.1.99"])
def test_go2rtc_serves_no_stream_for_a_refused_address(install, tmp_path, ip):
    reg = _registry(_device(1, LAN_DEVICE), _device(2, ip))
    install(LAN_DEVICE, *([] if ip == "192.168.1.99" else [ip]))
    assert g.Go2rtc(reg, data_dir=str(tmp_path)).desired_streams() == {
        "1": f"http://{LAN_DEVICE}/main.flv?audio=1"}


async def test_the_go2rtc_probe_never_dials_a_refused_address(install):
    """A real loopback server that WOULD answer with a stream: the probe must
    not even connect."""
    hits = []

    async def flv(request):
        hits.append(request.path)
        return web.Response(body=g.FLV_SIGNATURE + b"\0" * 16)

    app = web.Application()
    app.router.add_get("/{tail:.*}", flv)
    server = TestServer(app, host="127.0.0.1")
    await server.start_server()
    try:
        install("127.0.0.1")
        assert await g.probe_stream("127.0.0.1") is False
        assert await g.probe_stream("169.254.169.254") is False
        assert hits == []
    finally:
        await server.close()


@pytest.mark.parametrize("ip", ["8.8.8.8", "127.0.0.1", "169.254.169.254", "192.168.1.99"])
async def test_the_patcher_read_back_refuses_before_connecting(install, ip, monkeypatch):
    install(LAN_DEVICE)

    def no_session(*args, **kwargs):
        raise AssertionError("a connection was attempted")

    monkeypatch.setattr(common.aiohttp, "ClientSession", no_session)
    with pytest.raises(OutboundRefused):
        await common.download_from_device(ip, "ctrl", port=common.DEVICE_HTTPD_PORT)


async def test_run_cmd_capture_sends_nothing_to_a_refused_device(install, monkeypatch):
    install(LAN_DEVICE)
    sent = []

    async def record(*args, **kwargs):
        sent.append(args)

    monkeypatch.setattr(common, "send_run_cmd", record)
    d = Device(petkit_id=1, device_type="t5", serial_number="SN")
    assert await common.run_cmd_capture(d, "169.254.169.254", "df -k", timeout=5) is None
    assert sent == []


async def test_device_reads_do_not_follow_redirects(install, monkeypatch):
    """A redirect would let the device pick a second target the guard never saw."""
    install(LAN_DEVICE)
    seen = {}

    class _Resp:
        status = 302

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

    class _Session:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        def get(self, url, **kwargs):
            seen["url"], seen["kwargs"] = url, kwargs
            return _Resp()

    monkeypatch.setattr(common.aiohttp, "ClientSession", _Session)
    with pytest.raises(RuntimeError, match="302"):
        await common.download_from_device(LAN_DEVICE, "ctrl")
    assert seen["url"] == f"http://{LAN_DEVICE}:{common.DEVICE_HTTPD_PORT}/ctrl"
    assert seen["kwargs"]["allow_redirects"] is False

    monkeypatch.setattr(g.aiohttp, "ClientSession", _Session)
    assert await g.probe_stream(LAN_DEVICE) is False
    assert seen["kwargs"]["allow_redirects"] is False


async def test_talk_refuses_a_device_address_the_guard_refuses(install):
    from my_petkit.features.talk.routes import api_talk
    from my_petkit.shared.appkeys import REGISTRY

    reg = _registry(_device(7, "169.254.169.254"))
    install("169.254.169.254")
    app = web.Application()
    app[REGISTRY] = reg
    app.router.add_get("/api/devices/{id}/talk", api_talk)
    client = TestClient(TestServer(app))
    await client.start_server()
    try:
        ws = await client.ws_connect("/api/devices/7/talk")
        msg = await ws.receive_json()
        assert msg == {"type": "error", "msg": "device address refused"}
        await ws.close()
    finally:
        await client.close()
