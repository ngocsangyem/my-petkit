"""ffmpeg treats device media as untrusted, without changing what it produces.

Every run gets `-nostdin`, a protocol whitelist of local files and pipes, and a
per-input duration cap; inputs beyond a size cap are never handed to it. The
byte-for-byte checks below run the real binary on generated fixtures, so a
hardening flag that altered a remux or a stitch would fail here.
"""

import asyncio
import os
import shutil
import subprocess  # noqa: S404 - fixed argv to build fixtures

import pytest
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer

from my_petkit.media import stitch, transcode

needs_ffmpeg = pytest.mark.skipif(
    not (shutil.which("ffmpeg") and shutil.which("ffprobe")), reason="ffmpeg not installed")


def _clip(path, seconds=2, size=64):
    # ffmpeg from PATH, as production runs it; a fixed argv.
    subprocess.run(  # noqa: S603
        ["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i",  # noqa: S607
         f"testsrc=duration={seconds}:size={size}x{size}:rate=10", "-f", "mpegts", str(path)],
        check=True)
    return str(path)


def _raw(args):
    """The same command as upstream ran it: no hardening at all."""
    subprocess.run(args, check=True, capture_output=True)  # noqa: S603


# --- the argv -----------------------------------------------------------------

def test_every_ffmpeg_input_gets_the_whitelist_and_the_duration_cap():
    args = transcode.harden_args(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", "l.txt",
                                  "-i", "pipe:0", "-c", "copy", "out.mp4"])
    guard = ["-protocol_whitelist", "file,pipe", "-t", str(transcode.MAX_INPUT_SECONDS)]
    assert args == ["ffmpeg", "-nostdin", "-y", "-f", "concat", "-safe", "0", *guard, "-i",
                    "l.txt", *guard, "-i", "pipe:0", "-c", "copy", "out.mp4"]


def test_ffprobe_gets_the_whitelist_and_other_binaries_are_untouched():
    assert transcode.harden_args(["ffprobe", "-v", "error", "x.ts"]) == [
        "ffprobe", "-protocol_whitelist", "file,pipe", "-v", "error", "x.ts"]
    assert transcode.harden_args(["go2rtc", "-i", "x"]) == ["go2rtc", "-i", "x"]
    assert transcode.harden_args([]) == []


async def test_run_ffmpeg_always_runs_the_hardened_argv(monkeypatch):
    seen = []

    async def fake_exec(*argv, **kwargs):
        seen.append(list(argv))
        raise OSError("not really running")

    monkeypatch.setattr(transcode.asyncio, "create_subprocess_exec", fake_exec)
    await transcode.run_ffmpeg(["ffmpeg", "-i", "a.ts", "out.mp4"], timeout=1, what="t")
    assert seen == [transcode.harden_args(["ffmpeg", "-i", "a.ts", "out.mp4"])]


# --- the size cap -------------------------------------------------------------

async def test_an_input_over_the_size_cap_is_never_handed_to_ffmpeg(tmp_path, monkeypatch):
    big = tmp_path / "big.ts"
    big.write_bytes(b"\0" * 2048)

    async def must_not_run(*argv, **kwargs):
        raise AssertionError("ffmpeg was started")

    monkeypatch.setattr(transcode, "MAX_INPUT_BYTES", 1024)
    monkeypatch.setattr(transcode.asyncio, "create_subprocess_exec", must_not_run)
    assert await transcode.run_ffmpeg(["ffmpeg", "-i", str(big), "o.mp4"], timeout=1,
                                      what="t") == (-3, b"", b"")
    assert await transcode.run_ffmpeg(["ffprobe", "-v", "error", str(big)], timeout=1,
                                      what="t") == (-3, b"", b"")
    assert await transcode.run_ffmpeg(["ffmpeg", "-i", "pipe:0", "o.jpg"], timeout=1, what="t",
                                      stdin_data=b"\0" * 2048) == (-3, b"", b"")


async def test_a_stitch_over_the_size_cap_is_refused(tmp_path, monkeypatch):
    chunks = []
    for i in range(3):
        p = tmp_path / f"c{i}.ts"
        p.write_bytes(b"\0" * 600)
        chunks.append(str(p))

    async def must_not_run(*args, **kwargs):
        raise AssertionError("ffmpeg was started")

    monkeypatch.setattr(transcode, "MAX_INPUT_BYTES", 1024)
    monkeypatch.setattr(transcode, "have_ffmpeg", lambda: True)
    monkeypatch.setattr(stitch, "run_ffmpeg", must_not_run)
    assert await stitch.concat_videos(chunks, str(tmp_path / "out.mp4"), str(tmp_path)) is False


# --- real ffmpeg: output unchanged, protections in force -----------------------

@needs_ffmpeg
async def test_a_remux_is_byte_identical_to_the_unhardened_command(tmp_path):
    src = _clip(tmp_path / "a.ts")
    _raw(["ffmpeg", "-y", "-i", src, "-c", "copy", "-movflags", "+faststart",
          str(tmp_path / "raw.mp4")])
    assert await transcode.remux_ts_to_mp4(src, str(tmp_path / "hard.mp4"))
    assert (tmp_path / "hard.mp4").read_bytes() == (tmp_path / "raw.mp4").read_bytes()


@needs_ffmpeg
async def test_a_stitch_is_byte_identical_to_the_unhardened_command(tmp_path):
    chunks = [_clip(tmp_path / f"c{i}.ts") for i in range(3)]
    listing = tmp_path / "raw.txt"
    listing.write_text("".join(f"file '{c}'\n" for c in chunks))
    _raw(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(listing),
          "-c", "copy", "-movflags", "+faststart", str(tmp_path / "raw.mp4")])
    work = tmp_path / "work"
    assert await stitch.concat_videos(chunks, str(tmp_path / "hard.mp4"), str(work))
    assert (tmp_path / "hard.mp4").read_bytes() == (tmp_path / "raw.mp4").read_bytes()
    assert await stitch.verify_video(str(tmp_path / "hard.mp4"), 6.0)


@needs_ffmpeg
async def test_the_probe_and_face_resize_still_work(tmp_path):
    src = _clip(tmp_path / "a.ts")
    info = await transcode.probe(src)
    assert float(info["format"]["duration"]) == pytest.approx(2.0, abs=0.2)

    jpg = tmp_path / "face.jpg"
    _raw(["ffmpeg", "-y", "-f", "lavfi", "-i", "testsrc=size=320x240", "-frames:v", "1",
          str(jpg)])
    out = await transcode.normalize_face_photo(jpg.read_bytes())
    assert transcode.jpeg_dimensions(out) == (224, 224)


@needs_ffmpeg
async def test_a_device_file_cannot_make_ffmpeg_open_the_network(tmp_path):
    """A concat list (or playlist) naming a URL is refused by the whitelist,
    even though the unhardened command would have tried to fetch it."""
    evil = tmp_path / "evil.txt"
    evil.write_text("file 'http://169.254.169.254/latest/meta-data/x.ts'\n")
    rc, _, stderr = await transcode.run_ffmpeg(
        ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(evil), "-c", "copy",
         str(tmp_path / "o.mp4")], timeout=30, what="evil")
    assert rc != 0
    assert b"not on whitelist" in stderr


@needs_ffmpeg
async def test_the_duration_cap_bounds_what_ffmpeg_reads(tmp_path, monkeypatch):
    src = _clip(tmp_path / "a.ts", seconds=3)
    monkeypatch.setattr(transcode, "MAX_INPUT_SECONDS", 1)
    assert await transcode.remux_ts_to_mp4(src, str(tmp_path / "o.mp4"))
    info = await transcode.probe(str(tmp_path / "o.mp4"))
    assert float(info["format"]["duration"]) < 2.0


# --- talk -----------------------------------------------------------------------

async def test_talk_runs_ffmpeg_with_stdin_off_and_per_file_whitelists(monkeypatch):
    from my_petkit.devices.base import Device
    from my_petkit.devices.registry import DeviceRegistry
    from my_petkit.features.talk import routes as talk
    from my_petkit.shared.appkeys import REGISTRY
    from my_petkit.utils import outbound_guard

    reg = DeviceRegistry()
    d = Device(device_type="t5", petkit_id=7, serial_number="SN7")
    d.state["ip"] = "192.168.1.50"
    reg._devices[7] = d
    outbound_guard.configure(outbound_guard.OutboundGuard(lambda: ["192.168.1.50"]))
    seen = []
    started = asyncio.Event()

    async def fake_exec(*argv, **kwargs):
        seen.append(list(argv))
        started.set()
        raise OSError("not really running")

    monkeypatch.setattr(talk.asyncio, "create_subprocess_exec", fake_exec)
    app = web.Application()
    app[REGISTRY] = reg
    app.router.add_get("/api/devices/{id}/talk", talk.api_talk)
    client = TestClient(TestServer(app))
    await client.start_server()
    try:
        ws = await client.ws_connect("/api/devices/7/talk")
        await ws.send_json({"type": "talk_start"})
        await asyncio.wait_for(started.wait(), 5)
        await ws.close()
    finally:
        await client.close()
        outbound_guard.configure(None)

    argv = seen[0]
    assert argv[:2] == ["ffmpeg", "-nostdin"]
    i = argv.index("-i")
    assert argv[i - 2:i + 2] == ["-protocol_whitelist", "pipe", "-i", "pipe:0"]
    assert argv[-5:] == ["-protocol_whitelist", "tcp", "-f", "adts", "tcp://192.168.1.50:9010"]


def test_the_cap_constants_are_sane():
    assert transcode.MAX_INPUT_BYTES >= 1024**3
    assert transcode.MAX_INPUT_SECONDS >= 3600
    assert os.path.basename(transcode.harden_args(["/usr/bin/ffmpeg"])[0]) == "ffmpeg"
