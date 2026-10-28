"""Client tokens: what the iOS app (and any other non-browser client) sends.

256 random bits, shown to the client once at pairing and stored only as their
SHA-256. A fast hash is right here and would be wrong for a password: the input
is already 256 bits of entropy, so there is nothing to brute-force, and the
lookup runs on every request. A token unused for `IDLE_EXPIRY_SECONDS` stops
working and is deleted; any token can be revoked by id.
"""

from __future__ import annotations

import hashlib
import secrets
import time
from collections.abc import Callable

from my_petkit.features.auth.store import AuthStore, TokenRow

TOKEN_PREFIX = "mpk_"  # noqa: S105 - a public marker that makes a leaked token greppable
TOKEN_BYTES = 32
IDLE_EXPIRY_SECONDS = 90 * 24 * 3600
#: `last_used` is written at most this often per token, so a busy client does
#: not turn every request into a database write.
TOUCH_INTERVAL_SECONDS = 60
MAX_TOKEN_LENGTH = 128
MAX_NAME_LENGTH = 64


def token_hash(raw: str) -> str:
    """The stored form of a token."""
    return hashlib.sha256(raw.encode()).hexdigest()


class ClientTokens:
    """Issue, check, list and revoke client tokens."""

    def __init__(self, store: AuthStore, clock: Callable[[], float] = time.time) -> None:
        self._store = store
        self._clock = clock

    def issue(self, name: str) -> tuple[int, str]:
        """A new token: `(id, raw)`. The raw value is never stored or logged."""
        raw = TOKEN_PREFIX + secrets.token_urlsafe(TOKEN_BYTES)
        token_id = self._store.insert_token(name[:MAX_NAME_LENGTH], token_hash(raw), self._clock())
        return token_id, raw

    def authenticate(self, raw: str) -> TokenRow | None:
        """The token row for `raw`, or None when it is unknown or idle-expired."""
        if not raw.startswith(TOKEN_PREFIX) or len(raw) > MAX_TOKEN_LENGTH:
            return None
        row = self._store.token_by_hash(token_hash(raw))
        if row is None:
            return None
        now = self._clock()
        if now - row.last_used > IDLE_EXPIRY_SECONDS:
            self._store.delete_token(row.id)
            return None
        if now - row.last_used > TOUCH_INTERVAL_SECONDS:
            self._store.touch_token(row.id, now)
        return row

    def list(self) -> list[TokenRow]:
        """Every live token, after dropping the idle-expired ones."""
        self._store.delete_tokens_idle_since(self._clock() - IDLE_EXPIRY_SECONDS)
        return self._store.list_tokens()

    def revoke(self, token_id: int) -> bool:
        """Revoke one token; False when there was none with that id."""
        return self._store.delete_token(token_id)
