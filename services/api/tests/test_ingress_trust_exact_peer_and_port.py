"""Home Assistant Ingress is trusted on the Ingress port from 172.30.32.2 only.

Requests here have the real Ingress shape: the `/api/hassio_ingress/<token>`
prefix already stripped by the Supervisor, `X-Ingress-Path` naming it, and
HA's forwarding headers. The headers are what any other peer can forge, so a
request carrying them from anywhere else must still need a token.
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from aiohttp import web
from aiohttp.test_utils import make_mocked_request

from my_petkit.features.auth.middleware import HA_INGRESS_PEER, auth_middleware, ingress_trusted
from my_petkit.features.auth.service import UserPlaneSettings
from tests.conftest_auth import anonymous_client, bare_panel, install_auth

INGRESS_PORT = 8099
INGRESS_HEADERS = {
    "X-Ingress-Path": "/api/hassio_ingress/abcdef0123456789",
    "X-Hass-Source": "core.ingress",
    "X-Forwarded-For": "192.168.1.20",
    "X-Forwarded-Host": "homeassistant.local:8123",
    "X-Forwarded-Proto": "http",
    "Host": "homeassistant.local:8123",
}


def _transport(peer: str, local_port: int) -> MagicMock:
    transport = MagicMock()
    transport.get_extra_info.side_effect = lambda name, default=None: {
        "peername": (peer, 40000),
        "sockname": ("172.30.33.5", local_port),
    }.get(name, default)
    return transport


def _request(app, peer, port, method="GET", path="/api/devices", headers=None):
    return make_mocked_request(method, path, headers=headers or dict(INGRESS_HEADERS),
                               app=app, transport=_transport(peer, port))


@pytest.mark.parametrize(("peer", "port", "trusted"), [
    (str(HA_INGRESS_PEER), INGRESS_PORT, True),
    ("::ffff:172.30.32.2", INGRESS_PORT, True),
    (str(HA_INGRESS_PEER), 8443, False),
    ("172.30.32.1", INGRESS_PORT, False),
    ("172.30.32.3", INGRESS_PORT, False),
    ("127.0.0.1", INGRESS_PORT, False),
    ("192.168.1.20", INGRESS_PORT, False),
])
def test_trust_needs_both_the_port_and_the_exact_peer(peer, port, trusted):
    req = _request(web.Application(), peer, port)
    assert ingress_trusted(req, INGRESS_PORT) is trusted


def test_no_ingress_port_means_no_ingress_trust():
    req = _request(web.Application(), str(HA_INGRESS_PEER), INGRESS_PORT)
    assert ingress_trusted(req, None) is False


async def _through_middleware(tmp_path, peer, port, method="GET", path="/api/settings",
                              headers=None):
    app = bare_panel(tmp_path)
    app["live_config"] = {}
    from my_petkit.shared.appkeys import AUTH

    auth = install_auth(app)
    auth.settings = UserPlaneSettings(ingress_port=INGRESS_PORT)
    assert app[AUTH] is auth
    req = _request(app, peer, port, method=method, path=path, headers=headers)
    match = await app.router.resolve(req)
    req._match_info = match  # what the router does before the middleware chain
    match.add_app(app)
    return await auth_middleware(req, match.handler)


async def test_the_supervisor_needs_no_token(tmp_path):
    resp = await _through_middleware(tmp_path, str(HA_INGRESS_PEER), INGRESS_PORT)
    assert resp.status == 200


async def test_forged_ingress_headers_from_another_peer_are_refused(tmp_path):
    resp = await _through_middleware(tmp_path, "192.168.1.20", INGRESS_PORT)
    assert resp.status == 401


async def test_the_supervisor_on_the_tls_port_still_needs_a_token(tmp_path):
    resp = await _through_middleware(tmp_path, str(HA_INGRESS_PEER), 8443)
    assert resp.status == 401


async def test_an_ingress_write_still_needs_its_own_origin(tmp_path):
    cross = dict(INGRESS_HEADERS, Origin="https://evil.example")
    resp = await _through_middleware(tmp_path, str(HA_INGRESS_PEER), INGRESS_PORT,
                                     method="POST", path="/api/retention", headers=cross)
    assert resp.status == 403
    same = dict(INGRESS_HEADERS, Origin="http://homeassistant.local:8123")
    resp = await _through_middleware(tmp_path, str(HA_INGRESS_PEER), INGRESS_PORT,
                                     method="POST", path="/api/retention", headers=same)
    assert resp.status != 403


async def test_a_real_socket_with_ingress_headers_is_refused(tmp_path):
    """End to end over TCP from 127.0.0.1, with the server's own port as the
    Ingress port: every header says Ingress, the socket says otherwise."""
    app = bare_panel(tmp_path)
    auth = install_auth(app)
    client = anonymous_client(app)
    await client.start_server()
    auth.settings = UserPlaneSettings(ingress_port=client.port)
    try:
        r = await client.get("/api/devices", headers=INGRESS_HEADERS)
        assert r.status == 401
    finally:
        await client.close()
