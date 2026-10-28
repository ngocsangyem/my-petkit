"""First-run admin: the CLI, or a one-time setup token printed to the log.

Privilege is never decided by where a request comes from — "the first browser
on the LAN becomes admin" hands the box to whoever is fastest. There are two
ways to create the admin, and both need access the attacker does not have:

* `my-petkit admin set-password` on the host (or `docker exec`), which also
  resets a forgotten password and logs out every web session;
* a setup token printed to the container log at start-up while no admin
  exists, valid 30 minutes and once. Without it there is no setup endpoint to
  speak of: `POST /api/auth/setup` refuses everything.
"""

from __future__ import annotations

import argparse
import getpass
import hashlib
import hmac
import logging
import secrets
import sys
import time
from collections.abc import Callable
from pathlib import Path

from my_petkit.features.auth.passwords import hash_password_sync, password_problem
from my_petkit.features.auth.store import AUTH_DB_FILENAME, AuthStore

log = logging.getLogger(__name__)

SETUP_TOKEN_TTL_SECONDS = 1800
_MAX_SETUP_TOKEN_LENGTH = 128


class SetupToken:
    """The one-time token that may create the first admin."""

    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self._clock = clock
        self._hash: str | None = None
        self._expires = 0.0

    def issue(self) -> str:
        """Mint a new token, replacing any previous one."""
        token = secrets.token_urlsafe(24)
        self._hash = hashlib.sha256(token.encode()).hexdigest()
        self._expires = self._clock() + SETUP_TOKEN_TTL_SECONDS
        return token

    def redeem(self, token: str) -> bool:
        """True exactly once, for the right token, inside its 30 minutes."""
        if self._hash is None or not token or len(token) > _MAX_SETUP_TOKEN_LENGTH:
            return False
        if self._clock() > self._expires:
            self._hash = None
            return False
        if not hmac.compare_digest(self._hash, hashlib.sha256(token.encode()).hexdigest()):
            return False
        self._hash = None
        return True

    def announce(self, data_dir: str) -> None:
        """Issue a token and print it, with the CLI alternative, to the log."""
        token = self.issue()
        # Printing a credential is the point here: the log is readable only by
        # whoever runs the container, which is exactly who may become admin.
        log.warning(
            "No admin password is set. Setup token (single use, valid %d minutes): %s "
            "-- or run: my-petkit admin set-password --data-dir %s",
            SETUP_TOKEN_TTL_SECONDS // 60,
            token,
            data_dir,
        )


def _read_password(from_stdin: bool) -> str:
    if from_stdin:
        return sys.stdin.readline().rstrip("\n")
    first = getpass.getpass("New admin password: ")
    if first != getpass.getpass("Repeat it: "):
        raise ValueError("The two passwords differ.")
    return first


def admin_main(argv: list[str]) -> int:
    """`my-petkit admin ...`. Returns the process exit status."""
    parser = argparse.ArgumentParser(prog="my-petkit admin")
    sub = parser.add_subparsers(dest="command", required=True)
    setpw = sub.add_parser("set-password", help="set or reset the admin password")
    setpw.add_argument("--data-dir", default="/data", help="data directory (default /data)")
    setpw.add_argument("--password-stdin", action="store_true", help="read the password from stdin")
    args = parser.parse_args(argv)

    try:
        password = _read_password(args.password_stdin)
    except (ValueError, EOFError, KeyboardInterrupt) as e:
        print(f"error: {e or 'cancelled'}", file=sys.stderr)
        return 1
    problem = password_problem(password)
    if problem:
        print(f"error: {problem}", file=sys.stderr)
        return 1
    try:
        store = AuthStore(Path(args.data_dir) / AUTH_DB_FILENAME)
    except (OSError, RuntimeError) as e:
        print(f"error: cannot open the auth database: {e}", file=sys.stderr)
        return 1
    try:
        store.set_admin_password(hash_password_sync(password), time.time())
    finally:
        store.close()
    print("Admin password set. Every web session has been signed out.")
    return 0
