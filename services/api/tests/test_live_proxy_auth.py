"""Live video through `features/live`: auth on every path, and only our streams.

A fake go2rtc stands in for the sidecar's loopback API, so these tests see the
exact requests the proxy makes: which stream it names, which query it passes,
and what it lets through the MSE WebSocket.
"""

from __future__ import annotations

import json
from urllib.parse import parse_qs, urlsplit

import pytest
from aiohttp import WSMsgType, web
from aiohttp.test_utils import TestServer

from my_petkit.devices.base import Device
from my_petkit.devices.registry import DeviceRegistry
from my_petkit.features.live import routes as live
from my_petkit.shared.appkeys import GO2RTC
from tests.conftest_auth import anonymous_client, authed_test_client, bare_panel

CAMERA_ID = 30020324

MASTER = "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000000\nhls/playlist.m3u8?id=AbC12345\n"
MEDIA = (
    "#EXTM3U\n#EXT-X-TARGETDURATION:1\n#EXT-X-MEDIA-SEQUENCE:3\n"
    "#EXTINF:0.500,\nsegment.ts?id=AbC12345&n=3\n#EXTINF:0.500,\nsegment.ts?id=AbC12345&n=4\n"
)


class FakeSidecar:
    """What `features/live` asks of `media.go2rtc.Go2rtc`."""

    def __init__(self, *, running=True, webrtc=False, streams=(str(CAMERA_ID),)):
        self.running = running
        self.webrtc_enabled = webrtc
        self._streams = streams

    def desired_streams(self):
        return {name: "http://192.0.2.10/main.flv?audio=1" for name in self._streams}

    def stream_url_for(self, device):
        return ""


@pytest.fixture
async def go2rtc(monkeypatch):
    """A fake go2rtc API. `seen` records `(path, query)` of every request and
    every text frame the MSE bridge forwarded."""
    seen: list = []

    async def master(request):
        seen.append((request.path, dict(request.query)))
        return web.Response(text=MASTER, content_type="application/vnd.apple.mpegurl")

    async def hls(request):
        seen.append((request.path, dict(request.query)))
        if request.match_info["name"] == "playlist.m3u8":
            return web.Response(text=MEDIA, content_type="application/vnd.apple.mpegurl")
        return web.Response(body=b"TS-BYTES", content_type="video/mp2t")

    async def webrtc(request):
        body = await request.json()
        seen.append((request.path, dict(request.query), body))
        return web.json_response({"type": "answer", "sdp": "v=0 answer"})

    async def ws(request):
        seen.append((request.path, dict(request.query), request.headers.get("Origin")))
        sock = web.WebSocketResponse()
        await sock.prepare(request)
        async for msg in sock:
            if msg.type == WSMsgType.TEXT:
                seen.append(("frame", msg.data))
                if json.loads(msg.data).get("type") == "mse":
                    await sock.send_str(json.dumps({"type": "mse", "value": "video/mp4"}))
                    await sock.send_bytes(b"INIT")
        return sock

    app = web.Application()
    app.router.add_get("/api/stream.m3u8", master)
    app.router.add_get("/api/hls/{name}", hls)
    app.router.add_post("/api/webrtc", webrtc)
    app.router.add_get("/api/ws", ws)
    server = TestServer(app)
    await server.start_server()
    monkeypatch.setattr(live, "API_ADDR", f"{server.host}:{server.port}")
    yield seen
    await server.close()


def _panel(tmp_path, sidecar=None, *, camera=True, ip="192.0.2.10"):
    reg = DeviceRegistry()
    d = Device(device_type="t5" if camera else "d4", petkit_id=CAMERA_ID, serial_number="SN1")
    if ip:
        d.state["ip"] = ip
    reg._devices[CAMERA_ID] = d
    app = bare_panel(tmp_path, registry=reg)
    app[GO2RTC] = sidecar if sidecar is not None else FakeSidecar()
    return app


async def _client(app, *, authed=True):
    client = authed_test_client(app) if authed else anonymous_client(app)
    await client.start_server()
    return client


def _query(uri: str) -> dict[str, list[str]]:
    return parse_qs(urlsplit(uri).query)


# --- info ------------------------------------------------------------------

@pytest.mark.parametrize(("sidecar", "camera", "ip", "reason"), [
    (FakeSidecar(), False, "192.0.2.10", "not_a_camera"),
    (FakeSidecar(), True, "", "device_unreachable"),
    (FakeSidecar(streams=()), True, "192.0.2.10", "no_stream"),
    (FakeSidecar(running=False), True, "192.0.2.10", "sidecar_down"),
])
async def test_info_says_why_nothing_can_be_watched(tmp_path, sidecar, camera, ip, reason):
    client = await _client(_panel(tmp_path, sidecar, camera=camera, ip=ip))
    try:
        r = await client.get(f"/api/devices/{CAMERA_ID}/live")
        assert r.status == 200
        assert await r.json() == {"available": False, "reason": reason, "modes": [],
                                  "hls_url": None}
    finally:
        await client.close()


async def test_info_offers_webrtc_only_when_configured(tmp_path):
    for webrtc, modes in ((False, ["mse", "hls"]), (True, ["webrtc", "mse", "hls"])):
        client = await _client(_panel(tmp_path, FakeSidecar(webrtc=webrtc)))
        try:
            body = await (await client.get(f"/api/devices/{CAMERA_ID}/live")).json()
            assert body["available"] is True and body["reason"] is None
            assert body["modes"] == modes
            assert body["hls_url"].startswith(f"/api/live/{CAMERA_ID}/stream.m3u8?exp=")
        finally:
            await client.close()


async def test_info_needs_a_principal_and_a_known_device(tmp_path):
    anon = await _client(_panel(tmp_path), authed=False)
    try:
        assert (await anon.get(f"/api/devices/{CAMERA_ID}/live")).status == 401
    finally:
        await anon.close()
    client = await _client(_panel(tmp_path))
    try:
        assert (await client.get("/api/devices/1/live")).status == 404
    finally:
        await client.close()


# --- HLS -------------------------------------------------------------------

async def test_hls_without_a_token_or_signature_is_401(tmp_path, go2rtc):
    client = await _client(_panel(tmp_path), authed=False)
    try:
        for path in (f"/api/live/{CAMERA_ID}/stream.m3u8",
                     f"/api/live/{CAMERA_ID}/hls/segment.ts?id=AbC12345&n=3"):
            assert (await client.get(path)).status == 401
        bad = f"/api/live/{CAMERA_ID}/stream.m3u8?exp=9999999999&sig=forged"
        assert (await client.get(bad)).status == 401
    finally:
        await client.close()
    assert go2rtc == []


async def test_a_signature_for_one_device_does_not_open_another(tmp_path, go2rtc):
    app = _panel(tmp_path)
    owner = await _client(app)
    try:
        url = (await (await owner.get(f"/api/devices/{CAMERA_ID}/live")).json())["hls_url"]
    finally:
        await owner.close()
    client = await _client(app, authed=False)
    try:
        moved = url.replace(f"/api/live/{CAMERA_ID}/", "/api/live/1/")
        assert (await client.get(moved)).status == 401
        # Nor does a live signature open a recorded file.
        assert (await client.get("/api/media/t5/clip.mp4?" + url.split("?", 1)[1])).status == 401
    finally:
        await client.close()


async def test_the_signed_hls_chain_plays_without_a_token(tmp_path, go2rtc):
    app = _panel(tmp_path)
    owner = await _client(app)
    try:
        url = (await (await owner.get(f"/api/devices/{CAMERA_ID}/live")).json())["hls_url"]
    finally:
        await owner.close()
    player = await _client(app, authed=False)
    try:
        master = await player.get(url)
        assert master.status == 200
        playlist_uri = [ln for ln in (await master.text()).splitlines() if ln.startswith("hls/")][0]
        # go2rtc's own query survives the re-signing.
        assert _query(playlist_uri)["id"] == ["AbC12345"]
        assert "sig" in _query(playlist_uri)

        media = await player.get(f"/api/live/{CAMERA_ID}/{playlist_uri}")
        assert media.status == 200
        segment_uri = [ln for ln in (await media.text()).splitlines()
                       if ln.startswith("segment.ts")][0]
        assert _query(segment_uri)["n"] == ["3"]

        segment = await player.get(f"/api/live/{CAMERA_ID}/hls/{segment_uri}")
        assert segment.status == 200
        assert await segment.read() == b"TS-BYTES"
        assert segment.headers["Content-Type"] == "video/mp2t"
    finally:
        await player.close()
    # Only our stream name, and only go2rtc's own parameters, reached it.
    assert go2rtc[0] == ("/api/stream.m3u8", {"src": str(CAMERA_ID)})
    assert go2rtc[1] == ("/api/hls/playlist.m3u8", {"id": "AbC12345"})
    assert go2rtc[2] == ("/api/hls/segment.ts", {"id": "AbC12345", "n": "3"})


@pytest.mark.parametrize("path", [
    "hls/../../stream.m3u8?id=AbC12345",
    "hls/evil.ts?id=AbC12345",
    "hls/segment.ts?id=../x",
    "hls/segment.ts",
])
async def test_only_go2rtc_hls_files_are_proxied(tmp_path, go2rtc, path):
    client = await _client(_panel(tmp_path))
    try:
        r = await client.get(f"/api/live/{CAMERA_ID}/{path}")
        assert r.status == 404
    finally:
        await client.close()
    assert go2rtc == []


async def test_a_device_without_a_configured_stream_is_never_asked_for(tmp_path, go2rtc):
    client = await _client(_panel(tmp_path, FakeSidecar(streams=())))
    try:
        r = await client.get(f"/api/live/{CAMERA_ID}/stream.m3u8")
        assert r.status == 409
        assert (await r.json())["error"]["code"] == "stream_unavailable"
    finally:
        await client.close()
    assert go2rtc == []


# --- WebRTC signaling --------------------------------------------------------

async def test_webrtc_needs_a_principal(tmp_path, go2rtc):
    client = await _client(_panel(tmp_path, FakeSidecar(webrtc=True)), authed=False)
    try:
        r = await client.post(f"/api/live/{CAMERA_ID}/webrtc",
                              json={"type": "offer", "sdp": "v=0"})
        assert r.status == 401
    finally:
        await client.close()
    assert go2rtc == []


async def test_webrtc_offer_and_answer_go_through(tmp_path, go2rtc):
    client = await _client(_panel(tmp_path, FakeSidecar(webrtc=True)))
    try:
        r = await client.post(f"/api/live/{CAMERA_ID}/webrtc",
                              json={"type": "offer", "sdp": "v=0 offer", "extra": "dropped"})
        assert r.status == 200, await r.text()
        assert await r.json() == {"type": "answer", "sdp": "v=0 answer"}
    finally:
        await client.close()
    assert go2rtc == [("/api/webrtc", {"src": str(CAMERA_ID)},
                       {"type": "offer", "sdp": "v=0 offer"})]


async def test_webrtc_is_refused_when_not_configured_or_malformed(tmp_path, go2rtc):
    client = await _client(_panel(tmp_path, FakeSidecar(webrtc=False)))
    try:
        r = await client.post(f"/api/live/{CAMERA_ID}/webrtc", json={"type": "offer", "sdp": "x"})
        assert r.status == 409
        assert (await r.json())["error"]["code"] == "webrtc_unavailable"
    finally:
        await client.close()
    client = await _client(_panel(tmp_path, FakeSidecar(webrtc=True)))
    try:
        for body in ({"type": "answer", "sdp": "x"}, {"type": "offer"}, ["offer"]):
            r = await client.post(f"/api/live/{CAMERA_ID}/webrtc", json=body)
            assert r.status == 400
    finally:
        await client.close()
    assert go2rtc == []


# --- MSE ---------------------------------------------------------------------

async def test_mse_needs_a_principal(tmp_path, go2rtc):
    client = await _client(_panel(tmp_path), authed=False)
    try:
        r = await client.get(f"/api/live/{CAMERA_ID}/mse",
                             headers={"Connection": "Upgrade", "Upgrade": "websocket",
                                      "Sec-WebSocket-Version": "13",
                                      "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ=="})
        assert r.status == 401
    finally:
        await client.close()
    assert go2rtc == []


async def test_mse_bridges_only_the_mse_request(tmp_path, go2rtc):
    client = await _client(_panel(tmp_path))
    try:
        sock = await client.ws_connect(f"/api/live/{CAMERA_ID}/mse")
        # Dropped: other go2rtc message types, extra fields, junk.
        await sock.send_str(json.dumps({"type": "webrtc/offer", "value": "v=0"}))
        await sock.send_str("not json")
        await sock.send_str(json.dumps({"type": "mse", "value": "avc1.640029", "src": "rtsp://x"}))
        reply = await sock.receive_json(timeout=5)
        assert reply == {"type": "mse", "value": "video/mp4"}
        assert (await sock.receive_bytes(timeout=5)) == b"INIT"
        await sock.close()
    finally:
        await client.close()
    path, query, origin = go2rtc[0]
    assert (path, query, origin) == ("/api/ws", {"src": str(CAMERA_ID)}, None)
    frames = [entry[1] for entry in go2rtc if entry[0] == "frame"]
    assert frames == [json.dumps({"type": "mse", "value": "avc1.640029"})]
