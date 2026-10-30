"""Talk from the iOS app: raw 16 kHz mono PCM in, the speaker's ADTS-AAC out.

Runs the real ffmpeg against a TCP listener standing in for the device's talk
sink, then asks ffprobe what arrived.
"""

from __future__ import annotations

import asyncio
import json
import math
import shutil
import struct
import subprocess

import pytest

from my_petkit.devices.base import Device
from my_petkit.devices.registry import DeviceRegistry
from my_petkit.features.talk import routes as talk
from tests.conftest_auth import authed_test_client, bare_panel

pytestmark = pytest.mark.skipif(
    not (shutil.which("ffmpeg") and shutil.which("ffprobe")), reason="needs ffmpeg and ffprobe")

DEVICE_ID = 30020324


def _tone(seconds: float = 1.0, hz: float = 440.0) -> bytes:
    """A sine wave as signed 16-bit little-endian PCM, 16 kHz mono."""
    rate = talk.TALK_SAMPLE_RATE
    return b"".join(struct.pack("<h", int(12000 * math.sin(2 * math.pi * hz * i / rate)))
                    for i in range(int(seconds * rate)))


@pytest.fixture
async def device_sink(monkeypatch):
    """A TCP listener in place of the device's talk sink; yields the bytes it got."""
    received = bytearray()
    done = asyncio.Event()

    async def handle(reader, writer):
        while chunk := await reader.read(65536):
            received.extend(chunk)
        writer.close()
        done.set()

    server = await asyncio.start_server(handle, "127.0.0.1", 0)
    monkeypatch.setattr(talk, "TALK_TCP_PORT", server.sockets[0].getsockname()[1])
    monkeypatch.setattr(talk.outbound_guard, "check_device_target", lambda host: str(host))
    yield received, done
    server.close()
    await server.wait_closed()


def _probe(path) -> dict:
    """ffprobe's JSON for the file the device sink received."""
    return json.loads(subprocess.run(  # noqa: S603 - fixed argv, our own temp file
        ["ffprobe",  # noqa: S607 - resolved from PATH, as the server resolves ffmpeg
         "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)],
        capture_output=True, check=True, text=True).stdout)


def _panel(tmp_path):
    reg = DeviceRegistry()
    d = Device(device_type="t5", petkit_id=DEVICE_ID, serial_number="SN1")
    d.state["ip"] = "127.0.0.1"
    reg._devices[DEVICE_ID] = d
    return bare_panel(tmp_path, registry=reg)


async def test_pcm_input_reaches_the_device_as_16khz_mono_adts_aac(tmp_path, device_sink):
    received, done = device_sink
    client = authed_test_client(_panel(tmp_path))
    await client.start_server()
    try:
        sock = await client.ws_connect(f"/api/devices/{DEVICE_ID}/talk")
        await sock.send_str(json.dumps({"type": "talk_start", "format": "pcm_s16le"}))
        assert await sock.receive_json(timeout=5) == {"type": "talking"}
        pcm = _tone()
        for i in range(0, len(pcm), 8000):  # ~250 ms slices, as the app sends
            await sock.send_bytes(pcm[i:i + 8000])
        await sock.send_str(json.dumps({"type": "talk_stop"}))
        assert await sock.receive_json(timeout=10) == {"type": "stopped"}
        await sock.close()
        await asyncio.wait_for(done.wait(), 10)
    finally:
        await client.close()

    out = tmp_path / "speaker.aac"
    out.write_bytes(bytes(received))
    probe = await asyncio.to_thread(_probe, out)
    stream = probe["streams"][0]
    assert probe["format"]["format_name"] == "aac"  # ffprobe's name for ADTS
    assert (stream["codec_name"], stream["sample_rate"], stream["channels"]) == ("aac", "16000", 1)
    assert float(probe["format"].get("duration", stream.get("duration", 0))) == pytest.approx(
        1.0, abs=0.3)


async def test_an_unknown_format_is_refused_without_starting_ffmpeg(tmp_path, device_sink,
                                                                    monkeypatch):
    started = []
    monkeypatch.setattr(talk.asyncio, "create_subprocess_exec",
                        lambda *a, **k: started.append(a))
    client = authed_test_client(_panel(tmp_path))
    await client.start_server()
    try:
        sock = await client.ws_connect(f"/api/devices/{DEVICE_ID}/talk")
        await sock.send_str(json.dumps({"type": "talk_start", "format": "mp3"}))
        reply = await sock.receive_json(timeout=5)
        assert reply["type"] == "error"
        await sock.close()
    finally:
        await client.close()
    assert started == []


def test_webm_stays_the_default_and_probes_its_input():
    assert talk._INPUT_ARGS[talk.WEBM] == ()
    assert talk._INPUT_ARGS[talk.PCM_S16LE] == ("-f", "s16le", "-ar", "16000", "-ac", "1")
