"""The user plane's error envelope, JSON-only bodies, security headers, no CORS."""

from __future__ import annotations

import re

from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer

from my_petkit.features.auth.security_headers import BASE_CSP, inline_script_hash
from my_petkit.shared.errors import error_middleware
from my_petkit.web import panel as panel_mod
from tests.conftest_auth import anonymous_client, authed_test_client, bare_panel


async def _bare(handler) -> TestClient:
    app = web.Application(middlewares=[error_middleware])
    app.router.add_get("/x", handler)
    client = TestClient(TestServer(app))
    await client.start_server()
    return client


async def test_an_unexpected_exception_is_a_500_with_a_correlation_id_and_no_detail(caplog):
    async def boom(request):
        raise RuntimeError("/data/secret/path.db is broken")

    client = await _bare(boom)
    try:
        r = await client.get("/x")
        assert r.status == 500
        body = await r.json()
        assert body["error"]["code"] == "internal"
        cid = body["error"]["correlation_id"]
        assert re.fullmatch(r"[0-9a-f]{16}", cid)
        assert "/data" not in await r.text() and "Traceback" not in await r.text()
        assert cid in caplog.text and "/data/secret/path.db" in caplog.text
    finally:
        await client.close()


async def test_a_handler_500_with_an_os_error_text_is_masked():
    async def leaky(request):
        return web.json_response({"error": "[Errno 13] /data/capture/x.jsonl"}, status=500)

    client = await _bare(leaky)
    try:
        body = await (await client.get("/x")).json()
        assert "/data" not in body["error"]["message"]
        assert body["error"]["correlation_id"]
    finally:
        await client.close()


async def test_a_flat_error_becomes_the_envelope_with_its_text_kept():
    async def refuse(request):
        return web.json_response({"error": "bad id"}, status=400)

    client = await _bare(refuse)
    try:
        assert await (await client.get("/x")).json() == {
            "error": {"code": "bad_request", "message": "bad id"}}
    finally:
        await client.close()


async def test_a_json_body_without_the_json_content_type_is_refused(tmp_path):
    client = authed_test_client(bare_panel(tmp_path))
    await client.start_server()
    try:
        r = await client.post("/api/ble", data='{"ble_type": "w5"}',
                              headers={"Content-Type": "text/plain"})
        assert r.status == 415
        assert (await r.json())["error"]["code"] == "unsupported_media_type"
    finally:
        await client.close()


async def test_every_response_carries_the_security_headers_and_no_cors(tmp_path):
    client = anonymous_client(bare_panel(tmp_path))
    await client.start_server()
    try:
        for path in ("/api/devices", "/static/styles.css"):
            r = await client.get(path, headers={"Origin": "https://evil.example"})
            assert r.headers["Content-Security-Policy"] == BASE_CSP
            assert r.headers["X-Content-Type-Options"] == "nosniff"
            assert r.headers["Referrer-Policy"] == "no-referrer"
            assert "Strict-Transport-Security" not in r.headers  # plain HTTP here
            assert not any(h.lower().startswith("access-control-") for h in r.headers)
        pre = await client.options("/api/devices", headers={
            "Origin": "https://evil.example", "Access-Control-Request-Method": "POST"})
        assert pre.status >= 400
        assert "Access-Control-Allow-Origin" not in pre.headers
    finally:
        await client.close()


async def test_the_index_csp_allows_exactly_its_one_inline_script(tmp_path):
    client = anonymous_client(bare_panel(tmp_path))
    await client.start_server()
    try:
        r = await client.get("/")
        html = await r.text()
        csp = r.headers["Content-Security-Policy"]
        scripts = re.findall(r"<script>(.*?)</script>", html, re.S | re.I)
        assert scripts, "the index has an inline script"
        for body in scripts:
            assert inline_script_hash(body) in csp
        assert "'unsafe-inline'" not in csp.split("script-src", 1)[1].split(";", 1)[0]
        assert csp == panel_mod.INDEX_CSP
    finally:
        await client.close()
