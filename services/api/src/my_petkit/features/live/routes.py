"""Live video: HLS, MSE and WebRTC signaling, each through go2rtc and our auth.

go2rtc holds the device's one stream connection and serves every viewer from
it (`media/go2rtc.py`). Its API is on loopback with no auth of its own, so this
module is the only way a client reaches it, and it only ever names a stream go2rtc
was configured with: go2rtc treats an unknown `src` as a source URL to dial, so
passing a client's value through would make it fetch anything.

* `GET /api/devices/{id}/live` says what can be watched right now and why not.
* HLS (`/api/live/{id}/stream.m3u8` and `/api/live/{id}/hls/{name}`) is for
  players that cannot send a token (AVPlayer, hls.js without a session): the
  info route hands out a signed URL, and every playlist URI is re-signed.
* MSE (`/api/live/{id}/mse`) is a WebSocket bridged to go2rtc's, allowing only
  the `mse` request message through.
* WebRTC (`POST /api/live/{id}/webrtc`) forwards the offer and returns the
  answer. Media then flows straight to go2rtc's WebRTC port, outside this
  server: it is protected by DTLS/SRTP and by the offer only being accepted
  here, behind auth (`docs/security/security.md`).
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import TYPE_CHECKING

import aiohttp
from aiohttp import web

from my_petkit.media.go2rtc import API_ADDR, stream_name
from my_petkit.shared.appkeys import GO2RTC, REGISTRY
from my_petkit.shared.errors import api_error
from my_petkit.shared.request_auth import playlist_signer, url_signer
from my_petkit.shared.tiers import Tier, tier

if TYPE_CHECKING:  # pragma: no cover - typing only
    from my_petkit.devices.base import Device
    from my_petkit.media.go2rtc import Go2rtc

log = logging.getLogger(__name__)

#: How long the HLS link from the info route works. Short: a player fetches it
#: once, at the start.
HLS_LINK_TTL_SECONDS = 300
#: How long the URIs inside a live playlist work. A player re-reads the media
#: playlist by the URL the master gave it for the whole session, so this caps
#: one viewing session; the client fetches a new link after it.
HLS_SESSION_TTL_SECONDS = 3600

#: The files go2rtc's HLS session serves: `{name: (upstream path, content type)}`.
#: The upstream path is this literal, never the request's own spelling.
_HLS_FILES = {
    "playlist.m3u8": ("/api/hls/playlist.m3u8", "application/vnd.apple.mpegurl"),
    "segment.ts": ("/api/hls/segment.ts", "video/mp2t"),
    "init.mp4": ("/api/hls/init.mp4", "video/mp4"),
    "segment.m4s": ("/api/hls/segment.m4s", "video/iso.segment"),
}
#: go2rtc's session id is 8 alphanumerics; `n` is a segment number it ignores.
_HLS_ID = re.compile(r"[A-Za-z0-9]{1,32}")
_UPSTREAM_TIMEOUT = aiohttp.ClientTimeout(total=10)
#: WebRTC answers wait for go2rtc to gather every candidate (no trickle).
_SIGNALING_TIMEOUT = aiohttp.ClientTimeout(total=15)
_MAX_OFFER_BYTES = 64 * 1024
_MAX_MSE_REQUEST_BYTES = 4 * 1024


def _sidecar(request: web.Request) -> Go2rtc | None:
    return request.app.get(GO2RTC)


def _availability(device: Device | None, sidecar: Go2rtc | None) -> tuple[bool, str | None]:
    """`(available, reason)`. `reason` is a stable code a client can explain."""
    if device is None:
        return False, "unknown_device"
    if not device.is_camera:
        return False, "not_a_camera"
    if not device.state.get("ip"):
        return False, "device_unreachable"
    if sidecar is None or stream_name(device) not in sidecar.desired_streams():
        return False, "no_stream"
    if not sidecar.running:
        return False, "sidecar_down"
    return True, None


def _device(request: web.Request) -> Device | None:
    raw = request.match_info["id"]
    return request.app[REGISTRY].get(int(raw)) if raw.isdigit() else None


def _watchable(request: web.Request) -> tuple[Device, Go2rtc]:
    """The device and sidecar for a stream request, or the refusal to raise."""
    device = _device(request)
    sidecar = _sidecar(request)
    available, reason = _availability(device, sidecar)
    if device is None:
        raise api_error(404, "not_found", "No such device.")
    if not available or sidecar is None:
        raise api_error(409, "stream_unavailable", f"No live stream: {reason}.")
    return device, sidecar


@tier(GET=Tier.R0)
async def api_live_info(request: web.Request) -> web.Response:
    """What can be watched on this device right now, and the HLS link.

    `modes` lists the ways that work in preference order; WebRTC only when the
    owner has configured addresses viewers can reach (`webrtc_candidates`).
    """
    device = _device(request)
    if device is None:
        raise api_error(404, "not_found", "No such device.")
    sidecar = _sidecar(request)
    available, reason = _availability(device, sidecar)
    modes: list[str] = []
    hls_url = None
    if available and sidecar is not None:
        modes = (["webrtc"] if sidecar.webrtc_enabled else []) + ["mse", "hls"]
        sign = url_signer(request)
        if sign is not None:
            hls_url = sign(f"/api/live/{device.petkit_id}/stream.m3u8", HLS_LINK_TTL_SECONDS)
    return web.json_response({
        "available": available,
        "reason": reason,
        "modes": modes,
        "hls_url": hls_url,
    })


async def _fetch(path: str, params: dict[str, str]) -> tuple[int, str, bytes]:
    """`(status, content type, body)` of one GET to go2rtc's loopback API.

    The host is fixed and `path` is always a literal from this module; only
    validated values travel, as query parameters.
    """
    async with aiohttp.ClientSession(timeout=_UPSTREAM_TIMEOUT) as session:
        async with session.get(f"http://{API_ADDR}{path}", params=params,
                               allow_redirects=False) as resp:
            return resp.status, resp.content_type, await resp.read()


def _resigned(request: web.Request, body: bytes) -> web.Response:
    """A playlist with every URI signed for the length of a viewing session."""
    text = body.decode("utf-8", errors="replace")
    resign = playlist_signer(request)
    if resign is not None:
        text = resign(text, request.path, HLS_SESSION_TTL_SECONDS)
    return web.Response(text=text, content_type="application/vnd.apple.mpegurl",
                        headers={"Cache-Control": "no-store"})


async def _upstream_or_refuse(path: str, params: dict[str, str]) -> bytes:
    try:
        status, _, body = await _fetch(path, params)
    except (aiohttp.ClientError, asyncio.TimeoutError) as e:
        log.warning("live: go2rtc did not answer: %s", e)
        raise api_error(502, "upstream_unavailable", "The live stream did not answer.") from None
    if status == 404:
        # A finished HLS session, or a stream that dropped between checks.
        raise api_error(404, "not_found", "This live session has ended.")
    if status != 200:
        log.warning("live: go2rtc answered %s", status)
        raise api_error(502, "upstream_unavailable", "The live stream did not answer.")
    return body


@tier(GET=Tier.SIGNED_MEDIA)
async def api_live_hls_master(request: web.Request) -> web.Response:
    """The HLS master playlist: starts a go2rtc HLS session for this device."""
    device, _ = _watchable(request)
    body = await _upstream_or_refuse("/api/stream.m3u8", {"src": stream_name(device)})
    return _resigned(request, body)


@tier(GET=Tier.SIGNED_MEDIA)
async def api_live_hls_file(request: web.Request) -> web.Response:
    """One file of a go2rtc HLS session: the media playlist, or a segment.

    Only go2rtc's own file names and its `id` / `n` parameters are passed on.
    """
    _watchable(request)
    file = _HLS_FILES.get(request.match_info["name"])
    session = _HLS_ID.fullmatch(request.query.get("id", ""))
    if file is None or session is None:
        raise api_error(404, "not_found", "Not found.")
    upstream_path, content_type = file
    params = {"id": session.group(0)}
    n = request.query.get("n", "")
    if n.isdigit():
        params["n"] = str(int(n))
    body = await _upstream_or_refuse(upstream_path, params)
    if upstream_path.endswith(".m3u8"):
        return _resigned(request, body)
    return web.Response(body=body, content_type=content_type,
                        headers={"Cache-Control": "no-store"})


@tier(POST=Tier.R0_SENSITIVE)
async def api_live_webrtc(request: web.Request) -> web.Response:
    """Exchange a WebRTC offer for go2rtc's answer, `{type, sdp}` both ways.

    No trickle ICE: go2rtc gathers every candidate before it answers, so the
    client sends its offer once its own gathering is complete.
    """
    device, sidecar = _watchable(request)
    if not sidecar.webrtc_enabled:
        raise api_error(409, "webrtc_unavailable",
                        "WebRTC is not set up on this server; use MSE or HLS.")
    try:
        offer = json.loads(await _read_capped(request, _MAX_OFFER_BYTES))
    except ValueError:
        offer = None
    if (not isinstance(offer, dict) or offer.get("type") != "offer"
            or not isinstance(offer.get("sdp"), str) or not offer["sdp"]):
        raise api_error(400, "invalid_request", "Invalid field(s): type, sdp.")
    url = f"http://{API_ADDR}/api/webrtc?src={stream_name(device)}"
    try:
        async with aiohttp.ClientSession(timeout=_SIGNALING_TIMEOUT) as session:
            async with session.post(url, json={"type": "offer", "sdp": offer["sdp"]}) as resp:
                status = resp.status
                answer = await resp.json(content_type=None) if status == 200 else None
    except (aiohttp.ClientError, asyncio.TimeoutError, ValueError) as e:
        log.warning("live: WebRTC signaling failed: %s", e)
        raise api_error(502, "upstream_unavailable", "The live stream did not answer.") from None
    if (not isinstance(answer, dict) or answer.get("type") != "answer"
            or not isinstance(answer.get("sdp"), str)):
        log.warning("live: go2rtc refused the WebRTC offer (%s)", status)
        raise api_error(502, "upstream_unavailable", "The live stream refused the offer.")
    return web.json_response({"type": "answer", "sdp": answer["sdp"]})


async def _read_capped(request: web.Request, limit: int) -> bytes:
    """The whole body, or 413 once it passes `limit`.

    `content.read(n)` returns whatever has arrived so far, so a body that comes
    in several TCP segments would be cut short; this reads to the end.
    """
    if (request.content_length or 0) > limit:
        raise api_error(413, "payload_too_large", "The offer is too large.")
    body = bytearray()
    async for chunk in request.content.iter_chunked(8192):
        body.extend(chunk)
        if len(body) > limit:
            raise api_error(413, "payload_too_large", "The offer is too large.")
    return bytes(body)


def _mse_request(data: str) -> str | None:
    """The message to forward for a client text frame, or None to drop it.

    go2rtc's WebSocket also speaks WebRTC and other source types; the bridge
    lets through only `{"type": "mse", "value": "<codecs>"}`, re-serialised so
    no other field reaches it.
    """
    if len(data) > _MAX_MSE_REQUEST_BYTES:
        return None
    try:
        msg = json.loads(data)
    except ValueError:
        return None
    if not isinstance(msg, dict) or msg.get("type") != "mse":
        return None
    value = msg.get("value", "")
    if not isinstance(value, str):
        return None
    return json.dumps({"type": "mse", "value": value})


async def _pump_to_client(upstream: aiohttp.ClientWebSocketResponse,
                          ws: web.WebSocketResponse) -> None:
    async for msg in upstream:
        if msg.type == aiohttp.WSMsgType.BINARY:
            await ws.send_bytes(msg.data)
        elif msg.type == aiohttp.WSMsgType.TEXT:
            await ws.send_str(msg.data)
        else:
            break


async def _pump_to_upstream(ws: web.WebSocketResponse,
                            upstream: aiohttp.ClientWebSocketResponse) -> None:
    """Forward the client's first valid `mse` request, and nothing after it.

    go2rtc adds a consumer for every `mse` message it receives, so a repeat
    would multiply the stream down this one socket.
    """
    requested = False
    async for msg in ws:
        if msg.type == aiohttp.WSMsgType.TEXT:
            forward = None if requested else _mse_request(msg.data)
            if forward is not None:
                requested = True
                await upstream.send_str(forward)
        elif msg.type in (aiohttp.WSMsgType.CLOSE, aiohttp.WSMsgType.ERROR):
            break


@tier(GET=Tier.R0_SENSITIVE)
async def api_live_mse(request: web.Request) -> web.WebSocketResponse:
    """MSE over WebSocket: go2rtc's `/api/ws`, bridged for one stream.

    The client sends `{"type": "mse", "value": "<codecs it supports>"}`, gets
    back `{"type": "mse", "value": "<mime type>"}`, then binary fMP4: the init
    segment, then fragments. The Origin check happened in the auth middleware;
    go2rtc is dialled without one, from loopback.
    """
    device, _ = _watchable(request)
    ws = web.WebSocketResponse(heartbeat=25, max_msg_size=_MAX_MSE_REQUEST_BYTES)
    await ws.prepare(request)
    url = f"ws://{API_ADDR}/api/ws?src={stream_name(device)}"
    try:
        async with aiohttp.ClientSession() as session:
            async with session.ws_connect(url, timeout=aiohttp.ClientWSTimeout(ws_close=5),
                                          max_msg_size=0) as upstream:
                tasks = [asyncio.ensure_future(_pump_to_client(upstream, ws)),
                         asyncio.ensure_future(_pump_to_upstream(ws, upstream))]
                try:
                    await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
                finally:
                    for task in tasks:
                        task.cancel()
                    await asyncio.gather(*tasks, return_exceptions=True)
    except (aiohttp.ClientError, asyncio.TimeoutError, OSError) as e:
        log.warning("live: MSE bridge to go2rtc failed: %s", e)
        if not ws.closed:
            await ws.send_json({"type": "error", "value": "The live stream did not answer."})
    finally:
        if not ws.closed:
            await ws.close()
    return ws

