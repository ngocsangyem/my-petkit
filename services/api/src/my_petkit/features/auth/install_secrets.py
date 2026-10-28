"""Per-install secret keys, generated on first run and kept 0600 in the data dir.

There is no default key anywhere in this source: an attacker is assumed to have
read all of it. A key file is created with `O_EXCL` at mode 0600, so it is
never readable by anyone else even for the instant between create and chmod,
and two processes starting at once cannot both write one.
"""

from __future__ import annotations

import logging
import os
import secrets
import stat
from pathlib import Path

log = logging.getLogger(__name__)

KEY_BYTES = 32

#: Where the keys live under the data dir.
SECRETS_DIRNAME = "secrets"
SESSION_KEY_FILE = "session.key"
MEDIA_URL_KEY_FILE = "media-url.key"


def ensure_private_dir(path: Path) -> None:
    """Create `path` (mode 0700) if missing, and tighten it if it is looser."""
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    if stat.S_IMODE(path.stat().st_mode) & 0o077:
        os.chmod(path, 0o700)


def tighten_file(path: Path) -> None:
    """Make an existing file 0600, logging when it was found looser."""
    mode = stat.S_IMODE(path.stat().st_mode)
    if mode & 0o077:
        log.warning("auth: %s was mode %o; tightened to 0600", path.name, mode)
        os.chmod(path, 0o600)


def load_or_create_key(path: Path, nbytes: int = KEY_BYTES) -> bytes:
    """Read the key at `path`, generating it first if it does not exist.

    Raises:
        ValueError: the file exists but holds fewer than `nbytes` bytes — a
            truncated key is replaced by nobody silently, because replacing a
            session key logs everyone out and a URL key voids every link.
    """
    ensure_private_dir(path.parent)
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        tighten_file(path)
        data = path.read_bytes()
        if len(data) < nbytes:
            raise ValueError(f"{path} is shorter than {nbytes} bytes") from None
        return data[:nbytes]
    key = secrets.token_bytes(nbytes)
    try:
        os.write(fd, key)
        os.fsync(fd)
    finally:
        os.close(fd)
    log.info("auth: generated a new %s", path.name)
    return key
