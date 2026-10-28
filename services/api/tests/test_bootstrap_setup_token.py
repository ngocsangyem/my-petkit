"""First-run admin: only the CLI or the one-time setup token from the log.

Never the source address: a request from loopback or the LAN gets nothing
more than one from anywhere else.
"""

from __future__ import annotations

import io
import logging
import re
import sys

from my_petkit.features.auth.bootstrap import SETUP_TOKEN_TTL_SECONDS, SetupToken, admin_main
from my_petkit.features.auth.service import AuthService
from my_petkit.features.auth.sessions import COOKIE_NAME
from my_petkit.features.auth.store import AUTH_DB_FILENAME, AuthStore
from tests.conftest_auth import ADMIN_PASSWORD, anonymous_client, bare_panel, install_auth


def test_a_setup_token_works_once_and_for_thirty_minutes():
    now = [0.0]
    token = SetupToken(lambda: now[0])
    raw = token.issue()
    assert not token.redeem("wrong")
    assert token.redeem(raw)
    assert not token.redeem(raw)

    raw = token.issue()
    now[0] += SETUP_TOKEN_TTL_SECONDS + 1
    assert not token.redeem(raw)


def test_no_token_exists_until_one_is_issued():
    assert not SetupToken().redeem("")
    assert not SetupToken().redeem("anything")


def test_the_token_is_printed_only_when_there_is_no_admin(tmp_path, caplog):
    auth = AuthService(tmp_path)
    with caplog.at_level("WARNING"):
        auth.announce_setup_if_needed()
    match = re.search(r"valid 30 minutes\): (\S+)", caplog.text)
    assert match and "my-petkit admin set-password" in caplog.text
    assert auth.setup_token.redeem(match.group(1))

    caplog.clear()
    auth.store.set_admin_password("x", 0)
    with caplog.at_level("WARNING"):
        auth.announce_setup_if_needed()
    assert "Setup token" not in caplog.text


async def test_setup_needs_the_token_and_happens_once(tmp_path):
    app = bare_panel(tmp_path)
    auth = install_auth(app)
    raw = auth.setup_token.issue()
    client = anonymous_client(app)
    await client.start_server()
    try:
        login = await client.post("/api/auth/login", json={"password": ADMIN_PASSWORD})
        assert login.status == 409
        assert (await login.json())["error"]["code"] == "setup_required"

        bad = await client.post("/api/auth/setup",
                                json={"setup_token": "guess", "password": ADMIN_PASSWORD})
        assert bad.status == 401
        weak = await client.post("/api/auth/setup", json={"setup_token": raw, "password": "short"})
        assert weak.status == 400  # and the token is NOT spent on a weak password

        ok = await client.post("/api/auth/setup",
                               json={"setup_token": raw, "password": ADMIN_PASSWORD})
        assert ok.status == 200
        assert COOKIE_NAME in ok.cookies
        cookie = ok.headers["Set-Cookie"]
        for attr in ("HttpOnly", "Secure", "SameSite=Strict", "Path=/"):
            assert attr in cookie

        again = await client.post("/api/auth/setup",
                                  json={"setup_token": raw, "password": ADMIN_PASSWORD})
        assert again.status == 409
        login = await client.post("/api/auth/login", json={"password": ADMIN_PASSWORD})
        assert login.status == 200
    finally:
        await client.close()


async def test_loopback_gets_no_privilege(tmp_path):
    """The test client IS loopback; without a token or setup it gets nothing."""
    client = anonymous_client(bare_panel(tmp_path))
    await client.start_server()
    try:
        assert (await client.get("/api/settings")).status == 401
        r = await client.post("/api/auth/setup",
                              json={"setup_token": "", "password": ADMIN_PASSWORD})
        assert r.status in (400, 401)
    finally:
        await client.close()


def test_the_cli_sets_the_password_and_signs_everyone_out(tmp_path, monkeypatch, capsys):
    store = AuthStore(tmp_path / AUTH_DB_FILENAME)
    store.set_admin_password("old-hash", 0)
    epoch = store.session_epoch()
    monkeypatch.setattr(sys, "stdin", io.StringIO("a brand new password\n"))
    assert admin_main(["set-password", "--data-dir", str(tmp_path), "--password-stdin"]) == 0
    assert store.session_epoch() == epoch + 1
    assert store.admin_password_hash().startswith("$argon2id$")
    assert "a brand new password" not in capsys.readouterr().out


def test_the_cli_refuses_a_weak_password(tmp_path, monkeypatch):
    monkeypatch.setattr(sys, "stdin", io.StringIO("short\n"))
    assert admin_main(["set-password", "--data-dir", str(tmp_path), "--password-stdin"]) == 1
    assert AuthStore(tmp_path / AUTH_DB_FILENAME).admin_password_hash() is None


async def test_a_password_change_voids_existing_sessions(tmp_path):
    app = bare_panel(tmp_path)
    auth = install_auth(app)
    raw = auth.setup_token.issue()
    client = anonymous_client(app)
    await client.start_server()
    try:
        ok = await client.post("/api/auth/setup",
                               json={"setup_token": raw, "password": ADMIN_PASSWORD})
        cookie = f"{COOKIE_NAME}={ok.cookies[COOKIE_NAME].value}"
        assert (await client.get("/api/settings", headers={"Cookie": cookie})).status == 200
        auth.store.set_admin_password("$argon2id$replaced", 1)
        assert (await client.get("/api/settings", headers={"Cookie": cookie})).status == 401
    finally:
        await client.close()


def test_setup_token_is_logged_at_warning_for_visibility(tmp_path, caplog):
    with caplog.at_level(logging.WARNING, logger="my_petkit.features.auth.bootstrap"):
        AuthService(tmp_path).announce_setup_if_needed()
    assert any(r.levelno == logging.WARNING for r in caplog.records)
