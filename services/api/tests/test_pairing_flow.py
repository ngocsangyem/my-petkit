"""Pairing: 128-bit, single-use, five-minute codes traded for a client token.

Also the token itself: 256 bits, only its SHA-256 stored, idle-expired after
90 days, revocable.
"""

from __future__ import annotations

import base64
import sqlite3

from my_petkit.features.auth.pairing import CODE_TTL_SECONDS, PairingCodes
from my_petkit.features.auth.store import AUTH_DB_FILENAME, AuthStore
from my_petkit.features.auth.tokens import IDLE_EXPIRY_SECONDS, ClientTokens, token_hash
from tests.conftest_auth import authed_test_client, bare_panel


class Clock:
    def __init__(self, now: float = 1_000_000.0) -> None:
        self.now = now

    def __call__(self) -> float:
        return self.now


def _decoded_bits(code: str) -> int:
    return len(base64.urlsafe_b64decode(code + "=" * (-len(code) % 4))) * 8


def test_a_code_carries_128_random_bits_and_never_repeats(tmp_path):
    codes = PairingCodes(AuthStore(tmp_path / AUTH_DB_FILENAME))
    seen = {codes.create()[0] for _ in range(200)}
    assert len(seen) == 200
    assert all(_decoded_bits(c) >= 128 for c in seen)


def test_a_code_works_exactly_once(tmp_path):
    codes = PairingCodes(AuthStore(tmp_path / AUTH_DB_FILENAME))
    code, _ = codes.create()
    assert codes.redeem(code) is True
    assert codes.redeem(code) is False


def test_a_code_expires_after_five_minutes(tmp_path):
    clock = Clock()
    codes = PairingCodes(AuthStore(tmp_path / AUTH_DB_FILENAME), clock)
    code, expires_at = codes.create()
    assert expires_at == clock.now + CODE_TTL_SECONDS
    clock.now += CODE_TTL_SECONDS + 1
    assert codes.redeem(code) is False


def test_a_wrong_or_oversized_code_is_refused(tmp_path):
    codes = PairingCodes(AuthStore(tmp_path / AUTH_DB_FILENAME))
    code, _ = codes.create()
    assert codes.redeem(code[:-1] + ("A" if code[-1] != "A" else "B")) is False
    assert codes.redeem("x" * 1000) is False
    assert codes.redeem("") is False
    assert codes.redeem(code) is True


def test_only_hashes_reach_the_database(tmp_path):
    store = AuthStore(tmp_path / AUTH_DB_FILENAME)
    code, _ = PairingCodes(store).create()
    _id, raw = ClientTokens(store).issue("phone")
    dump = "\n".join(sqlite3.connect(tmp_path / AUTH_DB_FILENAME).iterdump())
    assert code not in dump
    assert raw not in dump
    assert token_hash(raw) in dump


def test_a_token_carries_256_bits(tmp_path):
    _id, raw = ClientTokens(AuthStore(tmp_path / AUTH_DB_FILENAME)).issue("phone")
    assert _decoded_bits(raw.removeprefix("mpk_")) >= 256


def test_a_token_expires_after_90_idle_days_and_use_resets_the_clock(tmp_path):
    clock = Clock()
    tokens = ClientTokens(AuthStore(tmp_path / AUTH_DB_FILENAME), clock)
    _id, raw = tokens.issue("phone")
    clock.now += IDLE_EXPIRY_SECONDS - 10
    assert tokens.authenticate(raw) is not None  # touches last_used
    clock.now += IDLE_EXPIRY_SECONDS - 10
    assert tokens.authenticate(raw) is not None
    clock.now += IDLE_EXPIRY_SECONDS + 1
    assert tokens.authenticate(raw) is None
    assert tokens.list() == []


def test_a_revoked_token_stops_working(tmp_path):
    tokens = ClientTokens(AuthStore(tmp_path / AUTH_DB_FILENAME))
    token_id, raw = tokens.issue("phone")
    assert tokens.revoke(token_id) is True
    assert tokens.authenticate(raw) is None
    assert tokens.revoke(token_id) is False


async def test_pairing_end_to_end_gives_a_working_pinned_token(tmp_path):
    app = bare_panel(tmp_path)
    admin = authed_test_client(app)  # stepped up: creating a code is R3
    await admin.start_server()
    try:
        r = await admin.post("/api/auth/pairing")
        assert r.status == 200
        made = await r.json()
        assert set(made["qr"]) == {"url", "cert_sha256", "code"}
        assert made["qr"]["code"] == made["code"]
        assert made["qr"]["url"].startswith("https://")

        anon = await admin.session.post(
            admin.make_url("/api/auth/pairing/redeem"),
            json={"code": made["code"], "name": "iPhone"},
            headers={"Authorization": ""})
        assert anon.status == 200
        got = await anon.json()

        listed = await (await admin.get("/api/auth/tokens")).json()
        assert "iPhone" in [t["name"] for t in listed["tokens"]]
        assert all("token" not in t and "token_hash" not in t for t in listed["tokens"])

        use = await admin.session.get(admin.make_url("/api/devices"),
                                      headers={"Authorization": f"Bearer {got['token']}"})
        assert use.status == 200

        again = await admin.session.post(admin.make_url("/api/auth/pairing/redeem"),
                                         json={"code": made["code"]},
                                         headers={"Authorization": ""})
        assert again.status == 401

        revoke = await admin.delete(f"/api/auth/tokens/{got['token_id']}")
        assert revoke.status == 200
        gone = await admin.session.get(admin.make_url("/api/devices"),
                                       headers={"Authorization": f"Bearer {got['token']}"})
        assert gone.status == 401
    finally:
        await admin.close()
