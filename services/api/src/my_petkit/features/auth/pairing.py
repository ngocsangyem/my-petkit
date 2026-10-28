"""Pairing: a short-lived, single-use code that a new client trades for a token.

The admin creates a code in an authenticated session (R3, so it needs a fresh
step-up: a code is a whole new credential). The client scans it as a QR code
carrying `{url, cert_sha256, code}` — where to connect, which self-signed
certificate to pin, and what to redeem — and redeems it for a client token.

128 random bits, five minutes, one use. Only the code's SHA-256 is stored, and
redemption compares against every live code with `hmac.compare_digest`, so
neither the database nor the timing of a wrong guess says anything about a
right one.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
import time
from collections.abc import Callable
from typing import Any

from my_petkit.features.auth.store import AuthStore

CODE_BYTES = 16
CODE_TTL_SECONDS = 300
MAX_CODE_LENGTH = 64


def _code_hash(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


class PairingCodes:
    """Create and redeem pairing codes."""

    def __init__(self, store: AuthStore, clock: Callable[[], float] = time.time) -> None:
        self._store = store
        self._clock = clock

    def create(self) -> tuple[str, float]:
        """A new code and the epoch second it expires at."""
        code = secrets.token_urlsafe(CODE_BYTES)
        now = self._clock()
        expires_at = now + CODE_TTL_SECONDS
        self._store.insert_pairing(_code_hash(code), now, expires_at)
        return code, expires_at

    def redeem(self, code: str) -> bool:
        """Consume `code`. True exactly once per code, and only before it expires."""
        if not code or len(code) > MAX_CODE_LENGTH:
            return False
        want = _code_hash(code)
        now = self._clock()
        match: int | None = None
        # Every live code is compared, matched or not, so the time taken does
        # not depend on where in the list the right one sits.
        for pairing_id, stored in self._store.live_pairings(now):
            if hmac.compare_digest(stored, want):
                match = pairing_id
        return match is not None and self._store.consume_pairing(match, now)


def qr_payload(url: str, cert_sha256: str, code: str) -> dict[str, Any]:
    """What the pairing QR code encodes, as a JSON object."""
    return {"url": url, "cert_sha256": cert_sha256, "code": code}
