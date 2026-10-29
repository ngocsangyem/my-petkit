"""Media answers the byte ranges an iOS AVAssetResourceLoader asks for.

The app's pinned media loader starts with a two-byte probe for the type and
total length, then reads open-ended ranges from wherever playback seeks, all
through a signed URL.
"""

from __future__ import annotations

from tests.conftest_auth import anonymous_client, authed_test_client, bare_panel

BODY = bytes(range(256)) * 40


def _panel(tmp_path):
    media = tmp_path / "media" / "t6" / "10"
    media.mkdir(parents=True)
    (media / "clip.mp4").write_bytes(BODY)
    return bare_panel(tmp_path)


async def _signed_client(tmp_path):
    app = _panel(tmp_path)
    owner = authed_test_client(app)
    await owner.start_server()
    try:
        r = await owner.post("/api/auth/media-url", json={"path": "t6/10/clip.mp4"})
        url = (await r.json())["url"]
    finally:
        await owner.close()
    client = anonymous_client(app)
    await client.start_server()
    return client, url


async def test_the_two_byte_probe_reports_type_and_total_length(tmp_path):
    client, url = await _signed_client(tmp_path)
    try:
        r = await client.get(url, headers={"Range": "bytes=0-1"})
        assert r.status == 206
        assert await r.read() == BODY[:2]
        assert r.headers["Content-Range"] == f"bytes 0-1/{len(BODY)}"
        assert r.headers["Content-Type"] == "video/mp4"
    finally:
        await client.close()


async def test_an_open_ended_range_reads_to_the_end(tmp_path):
    client, url = await _signed_client(tmp_path)
    try:
        r = await client.get(url, headers={"Range": "bytes=4096-"})
        assert r.status == 206
        assert await r.read() == BODY[4096:]
        assert r.headers["Content-Range"] == f"bytes 4096-{len(BODY) - 1}/{len(BODY)}"
    finally:
        await client.close()


async def test_a_range_past_the_end_is_refused_not_served_whole(tmp_path):
    client, url = await _signed_client(tmp_path)
    try:
        r = await client.get(url, headers={"Range": f"bytes={len(BODY) + 10}-"})
        assert r.status == 416
    finally:
        await client.close()
