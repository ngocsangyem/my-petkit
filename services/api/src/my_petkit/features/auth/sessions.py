"""Web sessions: a signed cookie, `HttpOnly; Secure; SameSite=Strict`.

The cookie carries `{session id, issued, last active, password epoch}` and an
HMAC-SHA256 over it with the per-install session key, so the server keeps no
session table. Limits:

* idle 12 hours — `last active` slides forward, re-issued at most every five
  minutes so a busy page does not rewrite its cookie on every request;
* absolute 7 days from login, however active;
* a password change bumps the admin's epoch and voids every session at once;
* logout voids its own session id in memory until that id could have expired
  anyway. A restart forgets the list, which only matters for a cookie that was
  stolen before a logout — and that cookie still dies at its idle limit.

`__Host-` makes the browser refuse the cookie unless it was set over HTTPS for
this exact host with `Path=/`, so a sibling subdomain or plain-HTTP response
cannot plant or overwrite it.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from collections.abc import Callable
from dataclasses import dataclass

from aiohttp import web

COOKIE_NAME = "__Host-mp_session"
IDLE_SECONDS = 12 * 3600
MAX_AGE_SECONDS = 7 * 24 * 3600
REFRESH_AFTER_SECONDS = 300
_MAX_COOKIE_LENGTH = 512


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


@dataclass(frozen=True)
class Session:
    """A verified session."""

    sid: str
    issued: float
    last_active: float
    epoch: int


class SessionCodec:
    """Sign and verify session cookies with the per-install key."""

    def __init__(self, key: bytes, clock: Callable[[], float] = time.time) -> None:
        self._key = key
        self._clock = clock
        self._revoked: dict[str, float] = {}

    def _sign(self, payload: str) -> str:
        return _b64(hmac.new(self._key, payload.encode(), hashlib.sha256).digest())

    def _encode(self, session: Session) -> str:
        body = {
            "s": session.sid,
            "i": session.issued,
            "l": session.last_active,
            "e": session.epoch,
        }
        payload = _b64(json.dumps(body, separators=(",", ":")).encode())
        return f"{payload}.{self._sign(payload)}"

    def new(self, epoch: int) -> tuple[Session, str]:
        """A fresh session and its cookie value."""
        now = self._clock()
        session = Session(secrets.token_urlsafe(16), now, now, epoch)
        return session, self._encode(session)

    def verify(self, value: str, epoch: int) -> Session | None:
        """The session in `value`, or None if forged, expired, revoked or stale."""
        if not value or len(value) > _MAX_COOKIE_LENGTH or "." not in value:
            return None
        payload, sig = value.rsplit(".", 1)
        if not hmac.compare_digest(sig, self._sign(payload)):
            return None
        try:
            body = json.loads(_unb64(payload))
            session = Session(str(body["s"]), float(body["i"]), float(body["l"]), int(body["e"]))
        except (ValueError, KeyError, TypeError):
            return None
        now = self._clock()
        if (
            epoch == 0
            or session.epoch != epoch
            or session.sid in self._revoked
            or now - session.last_active > IDLE_SECONDS
            or now - session.issued > MAX_AGE_SECONDS
        ):
            return None
        return session

    def refreshed(self, session: Session) -> str | None:
        """A re-issued cookie value when `session` is due a slide, else None."""
        now = self._clock()
        if now - session.last_active < REFRESH_AFTER_SECONDS:
            return None
        return self._encode(Session(session.sid, session.issued, now, session.epoch))

    def revoke(self, session: Session) -> None:
        """Void one session (logout)."""
        now = self._clock()
        self._revoked = {sid: until for sid, until in self._revoked.items() if until > now}
        self._revoked[session.sid] = session.issued + MAX_AGE_SECONDS


def set_session_cookie(response: web.StreamResponse, value: str) -> None:
    """Attach the session cookie with its fixed attributes."""
    response.set_cookie(
        COOKIE_NAME,
        value,
        path="/",
        secure=True,
        httponly=True,
        samesite="Strict",
        max_age=MAX_AGE_SECONDS,
    )


def clear_session_cookie(response: web.StreamResponse) -> None:
    """Expire the session cookie in the browser."""
    response.del_cookie(COOKIE_NAME, path="/", secure=True, httponly=True, samesite="Strict")
