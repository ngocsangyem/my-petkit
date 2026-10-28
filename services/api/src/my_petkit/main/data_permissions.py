"""Owner-only permissions for everything this process writes.

The data directory holds device signing secrets (`devices.json`), the MQTT
broker's private key, the event history and, soon, the auth store. Nobody but
the service account needs to read any of it, so the process runs with
`umask 077` (every file it creates is 0600, every directory 0700) and the data
directory itself is tightened to 0700, which also covers files an older
version created with looser modes: they cannot be reached through it.

Set before anything is written. In the Home Assistant add-on this process runs
as root because the Supervisor creates `/data` owned by root; compose and VPS
installs run it as a non-root user (see SECURITY.md).
"""

from __future__ import annotations

import logging
import os

log = logging.getLogger(__name__)

PROCESS_UMASK = 0o077
DATA_DIR_MODE = 0o700


def secure_data_dir(data_dir: str) -> None:
    """Apply the process umask, then create or tighten `data_dir` to 0700.

    Never raises: a data directory this process cannot chmod (a bind mount
    owned by someone else) is logged, and the service still starts — the
    devices must not lose their server over a permission bit.
    """
    os.umask(PROCESS_UMASK)
    try:
        os.makedirs(data_dir, mode=DATA_DIR_MODE, exist_ok=True)
        os.chmod(data_dir, DATA_DIR_MODE)
    except OSError as e:
        log.warning("Could not restrict data directory %s to 0700: %s", data_dir, e)
