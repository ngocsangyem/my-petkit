"""Signed media URLs: path-bound, five-minute, Range-safe, masked in the log."""

from __future__ import annotations

import logging
from urllib.parse import parse_qs, urlsplit

from aiohttp.test_utils import make_mocked_request

from my_petkit.features.auth.signed_media import (
    SIGNED_URL_TTL_SECONDS,
    MediaSigner,
    SignatureMaskingAccessLogger,
    mask_signature,
)
from my_petkit.shared.appkeys import AUTH
from tests.conftest_auth import anonymous_client, authed_test_client, bare_panel

BODY = bytes(range(256)) * 40


def _panel(tmp_path):
    media = tmp_path / "media" / "t5" / "10"
    media.mkdir(parents=True)
    (media / "clip.mp4").write_bytes(BODY)
    (media / "other.mp4").write_bytes(b"other")
    (media / "seg0.ts").write_bytes(b"segment-zero")
    (media / "live.m3u8").write_text(
        "#EXTM3U\n#EXT-X-MAP:URI=\"init.mp4\"\n#EXTINF:4.0,\nseg0.ts\n#EXT-X-ENDLIST\n")
    return bare_panel(tmp_path)


async def _signed(app, path):
    owner = authed_test_client(app)
    await owner.start_server()
    try:
        r = await owner.post("/api/auth/media-url", json={"path": path})
        assert r.status == 200
        return (await r.json())["url"]
    finally:
        await owner.close()


async def test_a_signed_url_serves_the_file_without_a_token(tmp_path):
    app = _panel(tmp_path)
    url = await _signed(app, "t5/10/clip.mp4")
    client = anonymous_client(app)
    await client.start_server()
    try:
        r = await client.get(url)
        assert r.status == 200
        assert await r.read() == BODY
    finally:
        await client.close()


async def test_a_range_request_goes_through_the_same_check(tmp_path):
    app = _panel(tmp_path)
    url = await _signed(app, "/api/media/t5/10/clip.mp4")
    client = anonymous_client(app)
    await client.start_server()
    try:
        r = await client.get(url, headers={"Range": "bytes=100-199"})
        assert r.status == 206
        assert await r.read() == BODY[100:200]
        bare = url.split("?", 1)[0]
        refused = await client.get(bare, headers={"Range": "bytes=100-199"})
        assert refused.status == 401
    finally:
        await client.close()


async def test_a_signature_does_not_open_another_path(tmp_path):
    app = _panel(tmp_path)
    url = await _signed(app, "t5/10/clip.mp4")
    query = url.split("?", 1)[1]
    client = anonymous_client(app)
    await client.start_server()
    try:
        assert (await client.get(f"/api/media/t5/10/other.mp4?{query}")).status == 401
        assert (await client.get(f"/api/media/thumb/t5/10/clip.mp4?{query}")).status == 401
    finally:
        await client.close()


async def test_a_tampered_or_expired_signature_is_refused(tmp_path):
    app = _panel(tmp_path)
    url = await _signed(app, "t5/10/clip.mp4")
    parts = urlsplit(url)
    qs = parse_qs(parts.query)
    client = anonymous_client(app)
    await client.start_server()
    try:
        later = int(qs["exp"][0]) + 60
        assert (await client.get(f"{parts.path}?exp={later}&sig={qs['sig'][0]}")).status == 401
        flipped = qs["sig"][0][:-1] + ("A" if qs["sig"][0][-1] != "A" else "B")
        assert (await client.get(f"{parts.path}?exp={qs['exp'][0]}&sig={flipped}")).status == 401
    finally:
        await client.close()

    now = [1000.0]
    signer = MediaSigner(b"k" * 32, lambda: now[0])
    q = parse_qs(signer.query("/api/media/a.mp4"))
    assert signer.verify("/api/media/a.mp4", q["exp"][0], q["sig"][0])
    now[0] += SIGNED_URL_TTL_SECONDS + 1
    assert not signer.verify("/api/media/a.mp4", q["exp"][0], q["sig"][0])


def test_nothing_outside_the_media_tree_can_be_signed_valid():
    signer = MediaSigner(b"k" * 32)
    q = parse_qs(signer.query("/api/devices"))
    assert not signer.verify("/api/devices", q["exp"][0], q["sig"][0])


async def test_an_hls_playlist_has_every_segment_re_signed(tmp_path):
    app = _panel(tmp_path)
    url = await _signed(app, "t5/10/live.m3u8")
    client = anonymous_client(app)
    await client.start_server()
    try:
        r = await client.get(url)
        assert r.status == 200
        text = await r.text()
        seg_line = next(line for line in text.splitlines() if line.startswith("seg0.ts?"))
        assert 'URI="init.mp4?exp=' in text
        seg = await client.get(f"/api/media/t5/10/{seg_line}")
        assert seg.status == 200
        assert await seg.read() == b"segment-zero"
    finally:
        await client.close()


def test_the_access_log_masks_the_signature(caplog):
    assert mask_signature("GET /api/media/a.mp4?exp=1&sig=abc HTTP/1.1") == (
        "GET /api/media/a.mp4?exp=1&sig=[masked] HTTP/1.1")
    logger = logging.getLogger("test.access")
    access = SignatureMaskingAccessLogger(logger, '%r "%{Referer}i"')
    req = make_mocked_request("GET", "/api/media/a.mp4?exp=1&sig=SECRETSIG",
                              headers={"Referer": "https://x/api/media/b.mp4?sig=SECRETSIG"})

    class _Resp:
        status = 200
        body_length = 0
        headers: dict[str, str] = {}

    with caplog.at_level("INFO", logger="test.access"):
        access.log(req, _Resp(), 0.01)  # type: ignore[arg-type]
    assert "SECRETSIG" not in caplog.text
    assert "sig=[masked]" in caplog.text


def test_signed_media_key_is_per_install(tmp_path):
    a = bare_panel(tmp_path / "a")
    b = bare_panel(tmp_path / "b")
    from tests.conftest_auth import install_auth

    sa, sb = install_auth(a).signer, install_auth(b).signer
    q = parse_qs(sa.query("/api/media/x.mp4"))
    assert sa.verify("/api/media/x.mp4", q["exp"][0], q["sig"][0])
    assert not sb.verify("/api/media/x.mp4", q["exp"][0], q["sig"][0])
    assert a[AUTH] is not b[AUTH]


def test_a_playlist_signs_only_inside_its_own_tree():
    """A `../` in a recorded playlist must not mint a live link, nor a live
    playlist a link for another camera or for recorded media."""
    signer = MediaSigner(b"k" * 32)
    recorded = signer.sign_playlist("../../../live/7/stream.m3u8\nseg0.ts\n",
                                    "/api/media/t5/10/clip.m3u8")
    assert recorded.splitlines()[0] == "../../../live/7/stream.m3u8"
    assert "sig=" in recorded.splitlines()[1]
    live = signer.sign_playlist("../../8/stream.m3u8\n../../../media/x.mp4\nsegment.ts?id=a\n",
                                "/api/live/7/hls/playlist.m3u8")
    lines = live.splitlines()
    assert lines[:2] == ["../../8/stream.m3u8", "../../../media/x.mp4"]
    assert "sig=" in lines[2]


def test_a_uris_own_exp_and_sig_are_replaced_by_ours():
    signer = MediaSigner(b"k" * 32)
    out = signer.sign_playlist("segment.ts?id=a&exp=1&sig=forged\n",
                               "/api/live/7/hls/playlist.m3u8")
    query = parse_qs(urlsplit(out.strip()).query)
    assert query["id"] == ["a"]
    assert len(query["exp"]) == 1 and query["sig"] != ["forged"]
    assert signer.verify("/api/live/7/hls/segment.ts", query["exp"][0], query["sig"][0])
