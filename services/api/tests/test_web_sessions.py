"""Web sessions: signed cookie, 12-hour idle, 7-day absolute, logout, epoch."""

from __future__ import annotations

from my_petkit.features.auth.sessions import (
    COOKIE_NAME,
    IDLE_SECONDS,
    MAX_AGE_SECONDS,
    REFRESH_AFTER_SECONDS,
    SessionCodec,
)
from tests.conftest_auth import anonymous_client, bare_panel, install_auth, session_cookie, set_admin

KEY = b"k" * 32


class Clock:
    def __init__(self) -> None:
        self.now = 1_000_000.0

    def __call__(self) -> float:
        return self.now


def test_a_session_survives_activity_but_not_twelve_idle_hours():
    clock = Clock()
    codec = SessionCodec(KEY, clock)
    session, value = codec.new(epoch=1)
    clock.now += IDLE_SECONDS - 60
    live = codec.verify(value, 1)
    assert live is not None
    slid = codec.refreshed(live)
    assert slid is not None
    clock.now += IDLE_SECONDS - 60
    assert codec.verify(value, 1) is None  # the old cookie went idle
    assert codec.verify(slid, 1) is not None  # the slid one did not


def test_no_session_outlives_seven_days():
    clock = Clock()
    codec = SessionCodec(KEY, clock)
    _s, value = codec.new(epoch=1)
    for _ in range(int(MAX_AGE_SECONDS / (IDLE_SECONDS / 2)) + 1):
        clock.now += IDLE_SECONDS / 2
        session = codec.verify(value, 1)
        if session is None:
            break
        value = codec.refreshed(session) or value
    assert codec.verify(value, 1) is None


def test_a_refresh_is_not_issued_on_every_request():
    clock = Clock()
    codec = SessionCodec(KEY, clock)
    session, _v = codec.new(epoch=1)
    assert codec.refreshed(session) is None
    clock.now += REFRESH_AFTER_SECONDS
    assert codec.refreshed(session) is not None


def test_a_forged_or_foreign_cookie_is_refused():
    codec = SessionCodec(KEY)
    _s, value = codec.new(epoch=1)
    payload, sig = value.rsplit(".", 1)
    assert codec.verify(payload + "." + sig[::-1], 1) is None
    assert SessionCodec(b"z" * 32).verify(value, 1) is None
    assert codec.verify(value, 2) is None  # password changed since
    assert codec.verify(value, 0) is None  # no admin at all
    assert codec.verify("garbage", 1) is None


async def test_logout_ends_the_session(tmp_path):
    app = bare_panel(tmp_path)
    set_admin(install_auth(app))
    client = anonymous_client(app)
    await client.start_server()
    try:
        cookie = await session_cookie(client)
        own = f"http://{client.host}:{client.port}"
        assert (await client.get("/api/settings", headers={"Cookie": cookie})).status == 200
        out = await client.post("/api/auth/logout", headers={"Cookie": cookie, "Origin": own})
        assert out.status == 200
        assert COOKIE_NAME in out.headers["Set-Cookie"]
        assert (await client.get("/api/settings", headers={"Cookie": cookie})).status == 401
    finally:
        await client.close()
