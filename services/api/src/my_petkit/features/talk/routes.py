"""Two-way talk: stream the browser microphone to the device speaker.

The `talk` patcher installs a TCP audio sink on the device (see
`patchers/talk.py`); this WebSocket is the other end of it. Kept out of
`panel.py` because it owns an ffmpeg subprocess per session and its own small
message protocol.
"""
from __future__ import annotations

import asyncio
import contextlib
import json
import logging

import aiohttp
from aiohttp import web

from my_petkit.patchers.common import TALK_TCP_PORT
from my_petkit.shared.appkeys import REGISTRY
from my_petkit.shared.tiers import Tier, tier
from my_petkit.utils import outbound_guard

log = logging.getLogger(__name__)

#: Input formats a talk session may announce in `talk_start`.
WEBM = "webm"
PCM_S16LE = "pcm_s16le"
#: The 16 kHz mono PCM the iOS app sends, and the device speaker plays.
TALK_SAMPLE_RATE = 16000
_INPUT_ARGS: dict[str, tuple[str, ...]] = {
    WEBM: (),
    PCM_S16LE: ("-f", "s16le", "-ar", str(TALK_SAMPLE_RATE), "-ac", "1"),
}


def _output_args(target: str) -> tuple[str, ...]:
    """The device speaker's format: 16 kHz mono ADTS-AAC, written to `target`.

    The whitelist applies to `target` only, so a crafted input cannot make
    ffmpeg open anything but the one sink it was given.
    """
    return ("-ar", str(TALK_SAMPLE_RATE), "-ac", "1", "-c:a", "aac", "-b:a", "48k",
            "-protocol_whitelist", "tcp", "-f", "adts", target)


@tier(GET=Tier.R2)
async def api_talk(request: web.Request) -> web.WebSocketResponse:
    """Two-way talk: stream the browser microphone to the device speaker.

    The frontend's MediaRecorder sends webm/opus over this WebSocket in ~250 ms
    slices (a `talk_start` text frame, then binary, then `talk_stop`). The iOS
    app cannot produce webm: it captures with AVAudioEngine and sends raw PCM,
    16-bit little-endian, 16 kHz mono, announcing it with
    `{"type": "talk_start", "format": "pcm_s16le"}`. Binary sent before any
    `talk_start` is taken as webm, as before. One
    ffmpeg per session transcodes the stream to 16 kHz mono ADTS-AAC — the
    device speaker's format — and connects straight to the device's talk sink
    (`tcp://<ip>:TALK_TCP_PORT`, installed by the `talk` patcher), which pipes it
    to `pktool play_aac` and thence to `media`. ffmpeg does both the transcode
    and the TCP connection, so nothing here touches a socket directly.

    Half-duplex by design: the panel mutes listening while talking, because the
    echo cancellation that made full duplex safe lived on the Agora path the
    camera patcher replaced. Needs the device IP (from a state report) and the
    `talk` patcher applied; without the sink listening, ffmpeg's TCP connect
    fails and it exits at once, so the session does not hang — but the audio is
    dropped silently (ffmpeg's stderr is suppressed and its early exit is not
    surfaced to the client yet).
    """
    reg = request.app[REGISTRY]
    ws = web.WebSocketResponse(max_msg_size=4 * 1024 * 1024, heartbeat=25)
    await ws.prepare(request)

    try:
        did = int(request.match_info["id"])
    except ValueError:
        await ws.send_json({"type": "error", "msg": "bad device id"})
        await ws.close()
        return ws
    d = reg.get(did)
    device_ip = d.state.get("ip", "") if d else ""
    if not d or not device_ip:
        await ws.send_json({"type": "error",
                            "msg": "device IP unknown — wait for a state report"})
        await ws.close()
        return ws
    try:
        talk_host = outbound_guard.authority(outbound_guard.check_device_target(device_ip))
    except outbound_guard.OutboundRefused as e:
        log.warning("talk: %s", e)
        await ws.send_json({"type": "error", "msg": "device address refused"})
        await ws.close()
        return ws

    ffmpeg: asyncio.subprocess.Process | None = None

    async def start(input_format: str = WEBM) -> None:
        nonlocal ffmpeg
        if ffmpeg is not None:
            return
        # Low-latency decode: the input is a live stream, so keep ffmpeg from
        # buffering ahead before it starts emitting. Raw PCM carries no header,
        # so its layout is stated; webm is probed. Output goes
        # straight to the device sink over TCP. The whitelists are per file:
        # the input may only be our pipe, the output only the TCP sink, so a
        # crafted stream cannot make ffmpeg open anything else. No size or
        # duration cap: this is a live session that ends with the WebSocket.
        ffmpeg = await asyncio.create_subprocess_exec(
            "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error",
            "-fflags", "nobuffer", "-flags", "low_delay",
            "-probesize", "32", "-analyzeduration", "0",
            *_INPUT_ARGS[input_format],
            "-protocol_whitelist", "pipe", "-i", "pipe:0",
            *_output_args(f"tcp://{talk_host}:{TALK_TCP_PORT}"),
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )

    async def stop() -> None:
        nonlocal ffmpeg
        if ffmpeg is None:
            return
        proc, ffmpeg = ffmpeg, None
        # Close the input so ffmpeg flushes its trailer and the device sink sees
        # EOF (ending that play session); kill only if it will not exit.
        if proc.stdin and not proc.stdin.is_closing():
            with contextlib.suppress(Exception):
                proc.stdin.write_eof()
        try:
            await asyncio.wait_for(proc.wait(), timeout=6)
        except (asyncio.TimeoutError, ProcessLookupError):
            with contextlib.suppress(ProcessLookupError):
                proc.kill()

    try:
        async for msg in ws:
            if msg.type == aiohttp.WSMsgType.BINARY:
                if ffmpeg is None:
                    await start()
                if ffmpeg and ffmpeg.stdin and not ffmpeg.stdin.is_closing():
                    ffmpeg.stdin.write(msg.data)
                    # Apply backpressure: if the device sink stalls, ffmpeg stops
                    # reading stdin and this awaits rather than buffering the
                    # browser's stream without bound.
                    await ffmpeg.stdin.drain()
            elif msg.type == aiohttp.WSMsgType.TEXT:
                try:
                    evt = json.loads(msg.data)
                except ValueError:
                    continue
                kind = evt.get("type")
                if kind == "talk_start":
                    requested = evt.get("format", WEBM)
                    if requested not in _INPUT_ARGS:
                        if not ws.closed:
                            await ws.send_json({"type": "error",
                                                "msg": f"unsupported format: {requested!r}"[:120]})
                        continue
                    await start(requested)
                    if not ws.closed:
                        await ws.send_json({"type": "talking"})
                elif kind == "talk_stop":
                    await stop()
                    if not ws.closed:
                        await ws.send_json({"type": "stopped"})
            elif msg.type in (aiohttp.WSMsgType.CLOSE, aiohttp.WSMsgType.ERROR):
                break
    except (asyncio.CancelledError, OSError, RuntimeError):
        # OSError covers the transport failing under us: ConnectionReset and
        # BrokenPipe (writing to an ffmpeg that has exited), and a missing ffmpeg
        # binary — all handled the same way, with `stop()` in the finally.
        pass
    finally:
        await stop()
    return ws
