"""`AuthService`: the auth state of one running panel, opened from the data dir.

Everything with a lifetime lives here — the database, the per-install keys,
the in-memory step-up windows, rate-limit counters and setup token — so the
middleware and the routes share one instance through `app[AUTH]`.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from pathlib import Path

from my_petkit.features.auth.bootstrap import SetupToken
from my_petkit.features.auth.install_secrets import (
    MEDIA_URL_KEY_FILE,
    SECRETS_DIRNAME,
    SESSION_KEY_FILE,
    load_or_create_key,
)
from my_petkit.features.auth.pairing import PairingCodes
from my_petkit.features.auth.passwords import (
    hash_password,
    needs_rehash,
    verify_password,
)
from my_petkit.features.auth.rate_limit import RateLimiter
from my_petkit.features.auth.sessions import SessionCodec
from my_petkit.features.auth.signed_media import MediaSigner
from my_petkit.features.auth.step_up import StepUps
from my_petkit.features.auth.store import AUTH_DB_FILENAME, AuthStore
from my_petkit.features.auth.tokens import ClientTokens


@dataclass(frozen=True)
class UserPlaneSettings:
    """How this install's user plane is reached; fixed at start-up.

    `ingress_port` is the local port Home Assistant Ingress connects to, set
    only in add-on mode. `allowed_hosts` are the host NAMES a browser may use
    to reach the panel (IP literals and `localhost` are always allowed; see
    `middleware.host_allowed`). `user_url` and `cert_sha256` go into the
    pairing QR code.
    """

    ingress_port: int | None = None
    allowed_hosts: frozenset[str] = field(default_factory=frozenset)
    user_url: str = ""
    user_port: int | None = None
    cert_sha256: str = ""


class AuthService:
    """One panel's auth state."""

    def __init__(self, data_dir: Path, settings: UserPlaneSettings | None = None) -> None:
        self.settings = settings or UserPlaneSettings()
        self.data_dir = data_dir
        self.store = AuthStore(data_dir / AUTH_DB_FILENAME)
        secrets_dir = data_dir / SECRETS_DIRNAME
        self.sessions = SessionCodec(load_or_create_key(secrets_dir / SESSION_KEY_FILE))
        self.signer = MediaSigner(load_or_create_key(secrets_dir / MEDIA_URL_KEY_FILE))
        self.tokens = ClientTokens(self.store)
        self.pairing = PairingCodes(self.store)
        self.step_ups = StepUps()
        self.limiter = RateLimiter()
        self.setup_token = SetupToken()

    def close(self) -> None:
        """Close the database."""
        self.store.close()

    def admin_exists(self) -> bool:
        """Whether first-run setup has happened."""
        return self.store.admin_password_hash() is not None

    def announce_setup_if_needed(self) -> None:
        """Log a setup token when there is no admin yet."""
        if not self.admin_exists():
            self.setup_token.announce(str(self.data_dir))

    async def check_password(self, password: str) -> bool:
        """Verify the admin password, upgrading its hash parameters if stale."""
        stored = self.store.admin_password_hash()
        if not await verify_password(stored, password):
            return False
        if stored is not None and needs_rehash(stored):
            self.store.update_admin_hash(await hash_password(password), time.time())
        return True

    async def create_admin(self, password: str) -> bool:
        """Create the first admin; False when one already exists."""
        return self.store.create_admin_if_absent(await hash_password(password), time.time())
