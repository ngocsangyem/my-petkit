"""The web app build is served under `app/`, beside the legacy panel."""
from __future__ import annotations

import pytest
from yarl import URL

from my_petkit.web.spa import IMMUTABLE, SPA_CSP
from tests.conftest_auth import anonymous_client, authed_test_client, bare_panel

ENTRY = "index-Ab12_cd.js"


@pytest.fixture
def built(tmp_path, monkeypatch):
    """A minimal build in a temporary dist directory."""
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text(
        f'<!doctype html><script type="module" src="./assets/{ENTRY}"></script>'
    )
    (dist / "assets" / ENTRY).write_text("export {};")
    (dist / "favicon.svg").write_text("<svg/>")
    monkeypatch.setenv("MY_PETKIT_WEB_DIST", str(dist))
    return dist


async def test_the_document_is_never_reused_unasked_and_allows_no_inline_code(tmp_path, built):
    client = anonymous_client(bare_panel(tmp_path))
    await client.start_server()
    try:
        r = await client.get("/app/")
        assert r.status == 200
        assert ENTRY in await r.text()
        assert r.headers["Cache-Control"] == "no-cache"
        assert r.headers["Content-Security-Policy"] == SPA_CSP
        assert "unsafe-inline" not in SPA_CSP
    finally:
        await client.close()


async def test_a_hashed_asset_is_cached_for_good_and_other_files_are_revalidated(tmp_path, built):
    client = anonymous_client(bare_panel(tmp_path))
    await client.start_server()
    try:
        asset = await client.get(f"/app/assets/{ENTRY}")
        assert asset.status == 200
        assert asset.headers["Cache-Control"] == IMMUTABLE
        icon = await client.get("/app/favicon.svg")
        assert icon.status == 200
        assert icon.headers["Cache-Control"] == "no-cache"
    finally:
        await client.close()


async def test_a_path_outside_the_build_or_missing_from_it_is_a_404(tmp_path, built):
    (tmp_path / "secret.txt").write_text("nope")
    client = anonymous_client(bare_panel(tmp_path))
    await client.start_server()
    try:
        # A literal `..` is normalised away by the client; an encoded slash reaches
        # the handler as `assets/../../secret.txt` and must stop at the build root.
        for path in ("/app/assets/..%2F..%2Fsecret.txt", "/app/..%2Fsecret.txt", "/app/nope.js"):
            r = await client.get(URL(path, encoded=True))
            assert r.status == 404, path
            assert "nope" not in await r.text()
    finally:
        await client.close()


async def test_app_without_a_slash_redirects_relatively_so_ingress_keeps_its_prefix(tmp_path, built):
    client = anonymous_client(bare_panel(tmp_path))
    await client.start_server()
    try:
        r = await client.get("/app", allow_redirects=False)
        assert r.status == 302
        assert r.headers["Location"] == "app/"
    finally:
        await client.close()


async def test_without_a_build_the_app_says_how_to_build_it(tmp_path, monkeypatch):
    monkeypatch.setenv("MY_PETKIT_WEB_DIST", str(tmp_path / "missing"))
    client = anonymous_client(bare_panel(tmp_path))
    await client.start_server()
    try:
        r = await client.get("/app/")
        assert r.status == 404
        assert (await r.json())["error"]["code"] == "web_app_not_built"
        assert (await client.get("/")).status == 200
    finally:
        await client.close()


async def test_info_reports_the_entry_of_the_build_the_server_would_serve(tmp_path, built):
    client = authed_test_client(bare_panel(tmp_path))
    await client.start_server()
    try:
        assert (await (await client.get("/api/info")).json())["web_entry"] == ENTRY
    finally:
        await client.close()
