"""The web app build is served at the root of the user plane."""

from __future__ import annotations

from urllib.parse import urljoin

from aiohttp import web
from yarl import URL

from my_petkit.shared.tiers import Tier, route_tier
from my_petkit.web.spa import IMMUTABLE, SPA_CSP
from tests.conftest import WEB_ENTRY as ENTRY
from tests.conftest_auth import anonymous_client, authed_test_client, bare_panel

#: Every route a caller reaches with no credential because it carries no data.
PUBLIC_STATIC_ROUTES = {
    ("GET", "/"),
    ("GET", "/app"),
    ("GET", "/app/"),
    ("GET", "/assets/{name}"),
    ("GET", "/{name}"),
}


async def test_the_document_is_never_reused_unasked_and_allows_no_inline_code(tmp_path, web_build):
    client = anonymous_client(bare_panel(tmp_path))
    await client.start_server()
    try:
        r = await client.get("/")
        assert r.status == 200
        assert ENTRY in await r.text()
        assert r.headers["Cache-Control"] == "no-cache"
        assert r.headers["Content-Security-Policy"] == SPA_CSP
        assert "unsafe-inline" not in SPA_CSP
    finally:
        await client.close()


async def test_a_hashed_asset_is_cached_for_good_and_other_files_are_revalidated(
    tmp_path, web_build
):
    client = anonymous_client(bare_panel(tmp_path))
    await client.start_server()
    try:
        asset = await client.get(f"/assets/{ENTRY}")
        assert asset.status == 200
        assert asset.headers["Cache-Control"] == IMMUTABLE
        assert asset.headers["Content-Security-Policy"] == SPA_CSP
        icon = await client.get("/favicon.svg")
        assert icon.status == 200
        assert icon.headers["Cache-Control"] == "no-cache"
    finally:
        await client.close()


async def test_the_document_reached_through_assets_is_not_cached_for_good(tmp_path, web_build):
    client = anonymous_client(bare_panel(tmp_path))
    await client.start_server()
    try:
        r = await client.get(URL("/assets/..%2Findex.html", encoded=True))
        assert r.status == 200
        assert r.headers["Cache-Control"] == "no-cache"
    finally:
        await client.close()


async def test_a_path_outside_the_build_or_missing_from_it_is_a_404(tmp_path, web_build):
    (tmp_path / "secret.txt").write_text("nope")
    client = anonymous_client(bare_panel(tmp_path))
    await client.start_server()
    try:
        # A literal `..` is normalised away by the client; an encoded slash reaches
        # the handler as `../secret.txt` and must stop at the build root.
        for path in (
            "/assets/..%2F..%2Fsecret.txt",
            "/..%2Fsecret.txt",
            "/nope.js",
            "/assets/nope.js",
        ):
            r = await client.get(URL(path, encoded=True))
            assert r.status == 404, path
            assert "nope" not in await r.text()
    finally:
        await client.close()


async def test_the_old_mount_redirects_permanently_and_relatively_so_ingress_keeps_its_prefix(
    tmp_path, web_build
):
    prefix = "/api/hassio_ingress/K7d2Xq"
    outer = web.Application()
    outer.add_subapp(prefix, bare_panel(tmp_path))
    client = anonymous_client(outer)
    await client.start_server()
    try:
        for old, location in (("/app", "./"), ("/app/", "../")):
            r = await client.get(prefix + old, allow_redirects=False)
            assert r.status == 301, old
            assert r.headers["Location"] == location, old
            # Resolved by the browser against the old URL: the root of the mount.
            assert urljoin(prefix + old, location) == prefix + "/", old
        # A bookmark's `#/...` route is never sent, so the redirect carries it.
        followed = await client.get(prefix + "/app/")
        assert followed.status == 200 and ENTRY in await followed.text()
        # Nothing of the build is served under the old mount any more.
        old_asset = await client.get(f"{prefix}/app/assets/{ENTRY}")
        assert old_asset.status >= 400
        assert "export" not in await old_asset.text()
    finally:
        await client.close()


async def test_the_document_assets_resolve_under_an_ingress_prefix(tmp_path, web_build):
    """Home Assistant mounts the server at an opaque `/api/hassio_ingress/<token>/`.
    Every URL the document names must be relative, so the browser resolves it
    under that prefix; an absolute one would escape it and 404."""
    prefix = "/api/hassio_ingress/K7d2Xq"
    outer = web.Application()
    outer.add_subapp(prefix, bare_panel(tmp_path))
    client = anonymous_client(outer)
    await client.start_server()
    try:
        doc = prefix + "/"
        html = await (await client.get(doc)).text()
        srcs = [part.split('"', 1)[0] for part in html.split('src="')[1:]]
        assert srcs == [f"./assets/{ENTRY}"]
        for src in srcs:
            resolved = urljoin(doc, src)
            assert resolved.startswith(doc), resolved
            assert (await client.get(resolved)).status == 200, resolved
    finally:
        await client.close()


async def test_without_a_build_the_root_says_how_to_build_it_and_the_api_still_answers(
    tmp_path, monkeypatch
):
    monkeypatch.setenv("MY_PETKIT_WEB_DIST", str(tmp_path / "missing"))
    client = anonymous_client(bare_panel(tmp_path))
    await client.start_server()
    try:
        for path in ("/", "/favicon.svg", f"/assets/{ENTRY}"):
            r = await client.get(path)
            assert r.status == 404, path
            assert (await r.json())["error"]["code"] == "web_app_not_built"
        assert (await client.get("/api/devices")).status == 401
    finally:
        await client.close()


async def test_info_reports_the_entry_of_the_build_the_server_would_serve(tmp_path, web_build):
    client = authed_test_client(bare_panel(tmp_path))
    await client.start_server()
    try:
        info = await (await client.get("/api/info")).json()
        assert info["web_entry"] == ENTRY
        # The old panel's asset hash: still in the reply, which the contract
        # requires, and empty now that nothing it hashed is served.
        assert info["asset_version"] == ""
    finally:
        await client.close()


def test_only_the_web_app_routes_are_public_static(tmp_path):
    app = bare_panel(tmp_path)
    public = {
        (route.method, route.resource.canonical)
        for route in app.router.routes()
        if route.method != "HEAD"
        and route.resource is not None
        and (
            isinstance(route.resource, web.StaticResource)
            or route_tier(route.handler, route.method) is Tier.PUBLIC_STATIC
        )
    }
    assert public == PUBLIC_STATIC_ROUTES


async def test_without_a_credential_only_the_static_shell_answers(tmp_path, web_build):
    """The document, its files and the redirect carry no data; the API behind
    them refuses, and an unknown one-segment path says only that no such file
    exists in the build."""
    client = anonymous_client(bare_panel(tmp_path))
    await client.start_server()
    try:
        assert (await client.get("/")).status == 200
        assert (await client.get("/app/", allow_redirects=False)).status == 301
        for path in ("/api/info", "/api/devices", "/api/settings"):
            assert (await client.get(path)).status == 401, path
        r = await client.get("/devices")
        assert r.status == 404
        assert (await r.json())["error"]["code"] == "not_found"
    finally:
        await client.close()
