"""Default deny, checked against the WHOLE router rather than a list of routes.

Every route+method the panel registers — WebSockets included — must declare a
tier, and every one that is not `public-static`, `signed-media` or one of the
named credential-exchange endpoints must answer 401 to a request that carries
nothing. A route added without a tier fails the first test by name; a route
that forgets to need a token fails the second.
"""

from __future__ import annotations

import re

import pytest
from aiohttp import web

from my_petkit.shared.tiers import TOKEN_EXEMPT, Tier, route_tier
from tests.conftest_auth import anonymous_client, bare_panel

#: The only routes a caller may reach with no credential, beyond static files
#: and signed media: the ones that exchange a secret FOR a credential.
CREDENTIAL_ROUTES = {
    ("POST", "/api/auth/setup"),
    ("POST", "/api/auth/login"),
    ("POST", "/api/auth/pairing/redeem"),
}


def _routes(app: web.Application) -> list[tuple[str, str, Tier | None]]:
    out = []
    for route in app.router.routes():
        resource = route.resource
        assert resource is not None
        if isinstance(resource, web.StaticResource):
            out.append((route.method, resource.canonical, Tier.PUBLIC_STATIC))
            continue
        out.append((route.method, resource.canonical, route_tier(route.handler, route.method)))
    return out


def _concrete(path: str) -> str:
    """A path that matches the pattern, with `1` for every `{segment}`."""
    return re.sub(r"\{[^}]+\}", "1", path)


def test_every_route_declares_a_tier(tmp_path):
    missing = [(m, p) for m, p, t in _routes(bare_panel(tmp_path)) if t is None]
    assert not missing, f"routes without a tier: {missing}"


def test_only_the_named_routes_are_credential_exchanges(tmp_path):
    found = {(m, p) for m, p, t in _routes(bare_panel(tmp_path)) if t is Tier.CREDENTIAL}
    assert found == CREDENTIAL_ROUTES


def test_the_websockets_are_covered(tmp_path):
    tiers = {(m, p): t for m, p, t in _routes(bare_panel(tmp_path))}
    assert tiers[("GET", "/api/ws")] is not None
    assert tiers[("GET", "/api/devices/{id}/talk")] is Tier.R2


async def test_every_non_exempt_route_refuses_a_request_without_a_token(tmp_path):
    app = bare_panel(tmp_path)
    routes = [(m, p, t) for m, p, t in _routes(app) if t not in TOKEN_EXEMPT and m != "HEAD"]
    assert len(routes) > 60, "the walk should see the whole router"
    client = anonymous_client(app)
    await client.start_server()
    try:
        for method, path, _tier in routes:
            headers = {"Content-Type": "application/json"}
            if path in ("/api/ws", "/api/devices/{id}/talk"):
                headers.update({"Connection": "Upgrade", "Upgrade": "websocket",
                                "Sec-WebSocket-Version": "13",
                                "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ=="})
            r = await client.request(method, _concrete(path), data="{}", headers=headers)
            assert r.status == 401, f"{method} {path} answered {r.status}"
            body = await r.json()
            assert body["error"]["code"] == "unauthorized"
    finally:
        await client.close()


async def test_signed_media_without_a_signature_is_refused(tmp_path):
    client = anonymous_client(bare_panel(tmp_path))
    await client.start_server()
    try:
        for path in ("/api/media/a.mp4", "/api/media/thumb/a.mp4"):
            assert (await client.get(path)).status == 401
    finally:
        await client.close()


async def test_static_shell_needs_no_token(tmp_path):
    client = anonymous_client(bare_panel(tmp_path))
    await client.start_server()
    try:
        assert (await client.get("/")).status == 200
        assert (await client.get("/static/styles.css")).status == 200
    finally:
        await client.close()


async def test_an_unknown_path_reveals_nothing_without_a_token(tmp_path):
    client = anonymous_client(bare_panel(tmp_path))
    await client.start_server()
    try:
        assert (await client.get("/api/does-not-exist")).status == 401
    finally:
        await client.close()


async def test_a_panel_without_auth_refuses_everything_but_static(tmp_path):
    from aiohttp.test_utils import TestClient, TestServer

    client = TestClient(TestServer(bare_panel(tmp_path)))
    await client.start_server()
    try:
        assert (await client.get("/api/devices")).status == 503
        assert (await client.get("/")).status == 200
    finally:
        await client.close()


def test_an_undeclared_method_has_no_tier():
    from my_petkit.shared.tiers import tier

    @tier(GET=Tier.R0)
    async def handler(request):  # pragma: no cover - never called
        return web.Response()

    assert route_tier(handler, "GET") is Tier.R0
    assert route_tier(handler, "HEAD") is Tier.R0
    assert route_tier(handler, "POST") is None
    with pytest.raises(ValueError, match="upper-case"):
        tier(get=Tier.R0)
