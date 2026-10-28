"""WebSocket upgrades and unsafe methods: Host allowlist and exact-Origin check.

A browser attaches the session cookie to a WebSocket upgrade from ANY page,
and CORS does not apply to WebSockets, so the Origin check is the only thing
between a hostile page and the live event stream or the device speaker.
"""

from __future__ import annotations

import aiohttp
import pytest

from my_petkit.features.auth.middleware import host_allowed, origin_matches
from tests.conftest_auth import (
    anonymous_client,
    authed_test_client,
    bare_panel,
    install_auth,
    session_cookie,
    set_admin,
)

#: The event stream never reads from the socket, so a polite close waits out
#: its whole timeout for an answer that is not coming.
_QUICK_CLOSE = aiohttp.ClientWSTimeout(ws_close=0.1)


async def _signed_in(tmp_path):
    app = bare_panel(tmp_path)
    set_admin(install_auth(app))
    client = anonymous_client(app)
    await client.start_server()
    cookie = await session_cookie(client)
    return client, cookie, f"http://{client.host}:{client.port}"


@pytest.mark.parametrize("path", ["/api/ws", "/api/devices/1/talk"])
async def test_a_cross_origin_websocket_upgrade_is_refused(tmp_path, path):
    client, cookie, _own = await _signed_in(tmp_path)
    try:
        with pytest.raises(aiohttp.WSServerHandshakeError) as err:
            await client.ws_connect(path, headers={"Cookie": cookie,
                                                   "Origin": "https://evil.example"})
        assert err.value.status == 403
    finally:
        await client.close()


async def test_a_websocket_upgrade_without_origin_on_a_cookie_is_refused(tmp_path):
    client, cookie, _own = await _signed_in(tmp_path)
    try:
        with pytest.raises(aiohttp.WSServerHandshakeError) as err:
            await client.ws_connect("/api/ws", headers={"Cookie": cookie})
        assert err.value.status == 403
    finally:
        await client.close()


async def test_a_same_origin_websocket_upgrade_is_accepted(tmp_path):
    client, cookie, own = await _signed_in(tmp_path)
    try:
        ws = await client.ws_connect("/api/ws", headers={"Cookie": cookie, "Origin": own},
                                     timeout=_QUICK_CLOSE)
        await ws.close()
    finally:
        await client.close()


async def test_a_token_client_without_origin_may_upgrade(tmp_path):
    client = authed_test_client(bare_panel(tmp_path))
    await client.start_server()
    try:
        ws = await client.ws_connect("/api/ws", timeout=_QUICK_CLOSE)
        await ws.close()
    finally:
        await client.close()


async def test_a_rebound_host_name_is_refused_on_writes(tmp_path):
    """DNS rebinding: the attacker's page is same-origin with ITSELF, so the
    Origin check passes; the Host name nobody configured is what stops it."""
    client = authed_test_client(bare_panel(tmp_path))
    await client.start_server()
    try:
        r = await client.post("/api/retention", json={},
                              headers={"Host": "evil.example",
                                       "Origin": "http://evil.example"})
        assert r.status == 403
        assert (await r.json())["error"]["code"] == "host_not_allowed"
    finally:
        await client.close()


async def test_a_cross_origin_post_with_a_cookie_is_refused(tmp_path):
    client, cookie, _own = await _signed_in(tmp_path)
    try:
        r = await client.post("/api/retention", json={},
                              headers={"Cookie": cookie, "Origin": "https://evil.example"})
        assert r.status == 403
        assert (await r.json())["error"]["code"] == "origin_not_allowed"
    finally:
        await client.close()


@pytest.mark.parametrize(("origin", "host", "ok"), [
    ("https://10.0.0.5:8443", "10.0.0.5:8443", True),
    ("https://10.0.0.5", "10.0.0.5", True),
    ("https://10.0.0.5", "10.0.0.5:443", True),
    ("http://ha.local:8123", "ha.local:8123", True),
    ("https://10.0.0.5:8443", "10.0.0.5:8444", False),
    ("https://10.0.0.6:8443", "10.0.0.5:8443", False),
    ("null", "10.0.0.5", False),
    ("file://", "10.0.0.5", False),
    ("https://10.0.0.5:8443", None, False),
])
def test_origin_must_name_exactly_the_requested_host(origin, host, ok):
    assert origin_matches(origin, host) is ok


@pytest.mark.parametrize(("host", "ok"), [
    ("192.168.1.10:8443", True),
    ("[::1]:8443", True),
    ("localhost:8443", True),
    ("petkit.example.com", True),
    ("evil.example", False),
    ("", False),
    (None, False),
])
def test_host_allowlist(host, ok):
    assert host_allowed(host, frozenset({"petkit.example.com"})) is ok
