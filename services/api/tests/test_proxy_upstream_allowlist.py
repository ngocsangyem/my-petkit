"""proxy_upstream and proxy_dns reach only PetKit and Aliyun IoT hosts.

Every device request in proxy mode is forwarded to `proxy_upstream` with the
device's own credential attached, so a free-form value turned the server into
a relay to anywhere. The allowlist is checked where the setting is written and
again where it is used, and the `proxy_dns` resolver resolves nothing else.
"""

import pytest
from aiohttp import web
from aiohttp.test_utils import make_mocked_request

from my_petkit.features.setup.routes import _valid_upstream
from my_petkit.http import cloud_fetch, upstream_allowlist
from my_petkit.http.dns import UpstreamResolver
from my_petkit.http.proxy import UPSTREAM_PRESETS, forward, resolve_upstream
from my_petkit.http.redact import RedactionPolicy

REAL_HOST_CHECK = upstream_allowlist.is_allowed_upstream_host


@pytest.fixture(autouse=True)
def _the_real_allowlist(monkeypatch):
    """Undo the suite-wide loopback stand-in (conftest.py) for these tests."""
    monkeypatch.setattr(upstream_allowlist, "is_allowed_upstream_host", REAL_HOST_CHECK)


ALLOWED = [
    "https://api-eu.petkt.com/6/",
    "https://api.eu-pet.com",
    "https://api.petkt.com",
    "https://api.petktasia.com/6/",
    "https://api.petkit.cn",
    "https://API-RU.PETKIT.CN/6/",
    "http://api-eu.petkt.com:80",
    "https://a1PK.iot-as-mqtt.eu-central-1.aliyuncs.com",
    "https://iot-600a5gmp.mqtt.iothub.aliyuncs.com",
]

REFUSED = [
    "http://127.0.0.1:8080",
    "http://169.254.169.254/latest/meta-data/",
    "http://192.168.1.10/6/",
    "https://evil.example",
    "https://api-eu.petkt.com.evil.example",
    "https://evilapi-eu.petkt.com",
    "https://user:pw@api-eu.petkt.com",
    "ftp://api-eu.petkt.com",
    "file:///etc/passwd",
    "https://a1PK.iot-as-mqtt.mars-1.aliyuncs.com",
    "https://bucket.oss-eu-central-1.aliyuncs.com",
    "https://api-eu.petkt.com:99999",
    "api-eu.petkt.com",
    "",
]


def test_every_preset_is_on_the_allowlist():
    for url in UPSTREAM_PRESETS.values():
        assert upstream_allowlist.is_allowed_upstream_url(url), url


def test_every_region_has_its_api_host_and_the_presets_cover_every_region():
    preset_hosts = {resolve_upstream(k).split("//")[1] for k in UPSTREAM_PRESETS}
    for region in upstream_allowlist.UPSTREAM_REGIONS.values():
        assert preset_hosts & set(region.api_hosts)


@pytest.mark.parametrize("url", ALLOWED)
def test_petkit_and_aliyun_hosts_are_allowed(url):
    assert upstream_allowlist.is_allowed_upstream_url(url)
    assert _valid_upstream(url)


@pytest.mark.parametrize("url", REFUSED)
def test_anything_else_is_refused_where_the_setting_is_written(url):
    assert not upstream_allowlist.is_allowed_upstream_url(url)
    assert _valid_upstream(url) is (url == "")  # empty means the default preset


def test_preset_keys_are_still_valid_settings():
    for key in UPSTREAM_PRESETS:
        assert _valid_upstream(key)


async def test_forward_never_contacts_a_refused_upstream(monkeypatch):
    """Where it is used: a stale overrides file cannot bypass the panel check.
    No session is even created, and the device gets the local answer (None)."""
    from my_petkit.http import proxy

    def no_session(*args, **kwargs):
        raise AssertionError("a connection was attempted")

    monkeypatch.setattr(proxy, "get_proxy_session", no_session)
    request = make_mocked_request("GET", "/6/t5/dev_serverinfo", app=web.Application())
    for upstream in ("http://127.0.0.1:8080", "http://169.254.169.254"):
        assert await forward(request, body=b"", upstream=upstream,
                             policy=RedactionPolicy()) is None


async def test_cloud_fetch_never_contacts_a_refused_upstream():
    import aiohttp

    from my_petkit.devices.base import Device

    class _NoSession:
        def get(self, *args, **kwargs):
            raise AssertionError("a connection was attempted")

    d = Device(petkit_id=1, device_type="t5", serial_number="SN1")
    with pytest.raises(aiohttp.InvalidURL):
        await cloud_fetch.fetch_as_device(_NoSession(), "http://169.254.169.254", d,
                                          "dev_ble_device")


async def test_the_proxy_dns_resolver_resolves_only_allowlisted_names():
    resolver = UpstreamResolver("203.0.113.1:9")
    for host in ("metadata.google.internal", "evil.example", "localhost"):
        with pytest.raises(OSError, match="not a PetKit host"):
            await resolver.resolve(host, 443)


async def test_forward_does_not_follow_redirects(monkeypatch):
    from my_petkit.http import proxy

    seen = {}

    class _Resp:
        status = 302
        headers = {}

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def read(self):
            return b""

    class _Session:
        def request(self, **kwargs):
            seen.update(kwargs)
            return _Resp()

    monkeypatch.setattr(proxy, "get_proxy_session", lambda app, dns="": _Session())
    request = make_mocked_request("GET", "/6/t5/dev_serverinfo", app=web.Application())
    await forward(request, body=b"", upstream="https://api-eu.petkt.com",
                  policy=RedactionPolicy())
    assert seen["allow_redirects"] is False
    assert seen["url"] == "https://api-eu.petkt.com/6/t5/dev_serverinfo"
