"""The admin password: argon2id via argon2-cffi, hashed off the event loop.

An argon2 hash is deliberately slow (tens of milliseconds and tens of MiB),
and this process also serves the devices from the same loop, so every hash
and verify runs in a thread.
"""

from __future__ import annotations

import asyncio

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

#: argon2-cffi's defaults are RFC 9106's second recommended profile (argon2id,
#: t=3, m=64 MiB, p=4). Kept as-is: they are maintained upstream, and
#: `check_needs_rehash` upgrades stored hashes when they move.
_HASHER = PasswordHasher()

MIN_PASSWORD_LENGTH = 10
MAX_PASSWORD_LENGTH = 1024


def password_problem(password: str) -> str | None:
    """Why `password` cannot be set, or None when it can."""
    if len(password) < MIN_PASSWORD_LENGTH:
        return f"The password must be at least {MIN_PASSWORD_LENGTH} characters."
    if len(password) > MAX_PASSWORD_LENGTH:
        return f"The password must be at most {MAX_PASSWORD_LENGTH} characters."
    return None


def hash_password_sync(password: str) -> str:
    """argon2id hash of `password` (blocking; the CLI calls this directly)."""
    return _HASHER.hash(password)


async def hash_password(password: str) -> str:
    """argon2id hash of `password`, computed in a thread."""
    return await asyncio.to_thread(_HASHER.hash, password)


def _verify(stored_hash: str, password: str) -> bool:
    try:
        return _HASHER.verify(stored_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


async def verify_password(stored_hash: str | None, password: str) -> bool:
    """Whether `password` matches. Hashes a dummy when there is no admin yet,
    so "no admin" and "wrong password" take the same time."""
    if len(password) > MAX_PASSWORD_LENGTH:
        return False
    if stored_hash is None:
        await asyncio.to_thread(_HASHER.hash, password)
        return False
    return await asyncio.to_thread(_verify, stored_hash, password)


def needs_rehash(stored_hash: str) -> bool:
    """Whether the stored hash predates the current parameters."""
    try:
        return _HASHER.check_needs_rehash(stored_hash)
    except InvalidHashError:
        return False
