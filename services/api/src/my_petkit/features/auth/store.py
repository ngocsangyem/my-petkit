"""`auth.db`: the admin password, client tokens and pairing codes.

A database of its own, never a table in `petkit.db`: clearing the event history
must not be able to reopen first-run setup, and the event store is something
the operator is told they may delete.

Synchronous `sqlite3` on purpose. Every query here is a primary-key or
unique-index lookup on a table of a handful of rows, which costs microseconds;
a second async engine would add a thread hop per request for nothing. The one
slow thing near this store — argon2 hashing — runs in a thread in
`passwords.py`.

The file is created 0600 before SQLite opens it. SQLite gives its journal the
same permissions as the database file, so the transient `-journal` is private
too.

Schema is versioned with `PRAGMA user_version`; `_MIGRATIONS[i]` takes a
database from version `i` to `i + 1`.
"""

from __future__ import annotations

import os
import sqlite3
import threading
from dataclasses import dataclass
from pathlib import Path

from my_petkit.features.auth.install_secrets import tighten_file

AUTH_DB_FILENAME = "auth.db"

_MIGRATIONS: tuple[str, ...] = (
    """
    CREATE TABLE admin (
        id             INTEGER PRIMARY KEY CHECK (id = 1),
        password_hash  TEXT    NOT NULL,
        session_epoch  INTEGER NOT NULL DEFAULT 1,
        created_at     REAL    NOT NULL,
        updated_at     REAL    NOT NULL
    );
    CREATE TABLE client_tokens (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    NOT NULL,
        token_hash  TEXT    NOT NULL UNIQUE,
        created_at  REAL    NOT NULL,
        last_used   REAL    NOT NULL
    );
    CREATE TABLE pairing_codes (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        code_hash   TEXT    NOT NULL,
        created_at  REAL    NOT NULL,
        expires_at  REAL    NOT NULL,
        used_at     REAL
    );
    """,
)

SCHEMA_VERSION = len(_MIGRATIONS)


@dataclass(frozen=True)
class TokenRow:
    """One client token, without its hash."""

    id: int
    name: str
    created_at: float
    last_used: float


class AuthStore:
    """The `auth.db` connection and every query against it."""

    def __init__(self, path: Path) -> None:
        self.path = path
        # The data dir's own mode is the lifecycle's business, not this store's.
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            os.close(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600))
        tighten_file(path)
        self._lock = threading.Lock()
        self._db = sqlite3.connect(str(path), check_same_thread=False, isolation_level=None)
        self._db.execute("PRAGMA foreign_keys = ON")
        self._migrate()

    def close(self) -> None:
        """Close the connection."""
        with self._lock:
            self._db.close()

    def _migrate(self) -> None:
        with self._lock:
            version = int(self._db.execute("PRAGMA user_version").fetchone()[0])
            if version > SCHEMA_VERSION:
                raise RuntimeError(
                    f"{self.path.name} has schema {version}, "
                    f"newer than this build ({SCHEMA_VERSION})"
                )
            for i in range(version, SCHEMA_VERSION):
                self._db.executescript(
                    f"BEGIN; {_MIGRATIONS[i]} PRAGMA user_version = {i + 1}; COMMIT;"
                )

    # --- admin -----------------------------------------------------------

    def admin_password_hash(self) -> str | None:
        """The stored argon2 hash, or None before first-run setup."""
        with self._lock:
            row = self._db.execute("SELECT password_hash FROM admin WHERE id = 1").fetchone()
        return str(row[0]) if row else None

    def session_epoch(self) -> int:
        """Bumped on every password change, which voids every web session."""
        with self._lock:
            row = self._db.execute("SELECT session_epoch FROM admin WHERE id = 1").fetchone()
        return int(row[0]) if row else 0

    def set_admin_password(self, password_hash: str, now: float) -> None:
        """Create the admin, or replace its password and void its sessions."""
        with self._lock:
            self._db.execute(
                "INSERT INTO admin (id, password_hash, session_epoch, created_at, updated_at) "
                "VALUES (1, ?, 1, ?, ?) "
                "ON CONFLICT(id) DO UPDATE SET password_hash = excluded.password_hash, "
                "session_epoch = admin.session_epoch + 1, updated_at = excluded.updated_at",
                (password_hash, now, now),
            )

    def create_admin_if_absent(self, password_hash: str, now: float) -> bool:
        """Create the admin only if there is none; False when one already exists."""
        with self._lock:
            cur = self._db.execute(
                "INSERT OR IGNORE INTO admin (id, password_hash, session_epoch, created_at, "
                "updated_at) VALUES (1, ?, 1, ?, ?)",
                (password_hash, now, now),
            )
            return cur.rowcount == 1

    def update_admin_hash(self, password_hash: str, now: float) -> None:
        """Replace the hash WITHOUT voiding sessions: an argon2 parameter upgrade."""
        with self._lock:
            self._db.execute(
                "UPDATE admin SET password_hash = ?, updated_at = ? WHERE id = 1",
                (password_hash, now),
            )

    # --- client tokens ---------------------------------------------------

    def insert_token(self, name: str, token_hash: str, now: float) -> int:
        """Store a new token's hash; returns its id."""
        with self._lock:
            cur = self._db.execute(
                "INSERT INTO client_tokens (name, token_hash, created_at, last_used) "
                "VALUES (?, ?, ?, ?)",
                (name, token_hash, now, now),
            )
            return int(cur.lastrowid or 0)

    def token_by_hash(self, token_hash: str) -> TokenRow | None:
        """The token whose SHA-256 is `token_hash`, or None."""
        with self._lock:
            row = self._db.execute(
                "SELECT id, name, created_at, last_used FROM client_tokens WHERE token_hash = ?",
                (token_hash,),
            ).fetchone()
        return TokenRow(int(row[0]), str(row[1]), float(row[2]), float(row[3])) if row else None

    def touch_token(self, token_id: int, now: float) -> None:
        """Record a use."""
        with self._lock:
            self._db.execute("UPDATE client_tokens SET last_used = ? WHERE id = ?", (now, token_id))

    def list_tokens(self) -> list[TokenRow]:
        """Every live token, oldest first."""
        with self._lock:
            rows = self._db.execute(
                "SELECT id, name, created_at, last_used FROM client_tokens ORDER BY id"
            ).fetchall()
        return [TokenRow(int(r[0]), str(r[1]), float(r[2]), float(r[3])) for r in rows]

    def delete_token(self, token_id: int) -> bool:
        """Revoke one token; False when there was no such token."""
        with self._lock:
            cur = self._db.execute("DELETE FROM client_tokens WHERE id = ?", (token_id,))
            return cur.rowcount == 1

    def delete_tokens_idle_since(self, cutoff: float) -> int:
        """Drop every token unused since `cutoff`; returns how many."""
        with self._lock:
            cur = self._db.execute("DELETE FROM client_tokens WHERE last_used < ?", (cutoff,))
            return cur.rowcount

    # --- pairing codes ---------------------------------------------------

    def insert_pairing(self, code_hash: str, now: float, expires_at: float) -> int:
        """Store a new pairing code's hash; returns its id."""
        with self._lock:
            self._db.execute(
                "DELETE FROM pairing_codes WHERE expires_at <= ? OR used_at IS NOT NULL", (now,)
            )
            cur = self._db.execute(
                "INSERT INTO pairing_codes (code_hash, created_at, expires_at) VALUES (?, ?, ?)",
                (code_hash, now, expires_at),
            )
            return int(cur.lastrowid or 0)

    def live_pairings(self, now: float) -> list[tuple[int, str]]:
        """`(id, code_hash)` of every unused, unexpired code."""
        with self._lock:
            rows = self._db.execute(
                "SELECT id, code_hash FROM pairing_codes WHERE used_at IS NULL AND expires_at > ?",
                (now,),
            ).fetchall()
        return [(int(r[0]), str(r[1])) for r in rows]

    def consume_pairing(self, pairing_id: int, now: float) -> bool:
        """Mark one code used. Atomic: of two racing redeems, exactly one wins."""
        with self._lock:
            cur = self._db.execute(
                "UPDATE pairing_codes SET used_at = ? "
                "WHERE id = ? AND used_at IS NULL AND expires_at > ?",
                (now, pairing_id, now),
            )
            return cur.rowcount == 1
