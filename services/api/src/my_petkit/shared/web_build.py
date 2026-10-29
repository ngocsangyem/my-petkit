"""Where the built web app (`apps/web`) lives, and which build it is.

Shared by `web/spa.py`, which serves it, and `/api/info`, which reports the
current build so an open page can tell it was loaded from an older one.
"""

from __future__ import annotations

import os
import re
from pathlib import Path

ENTRY_SCRIPT = re.compile(r'src="\./assets/([\w.-]+\.js)"')


def dist_dir() -> Path:
    """Where the built app is read from (see the module docstring)."""
    configured = os.environ.get("MY_PETKIT_WEB_DIST")
    if configured:
        return Path(configured)
    # shared/ -> my_petkit/ -> src/ -> api/ -> services/ -> repository root
    return Path(__file__).resolve().parents[5] / "apps" / "web" / "dist"


def web_entry(root: Path | None = None) -> str | None:
    """File name of the build's entry script, or None when there is no build.

    `/api/info` reports it so an open page can tell it was loaded from an older
    build: the entry's name carries the content hash of the whole module graph.
    """
    try:
        html = ((root or dist_dir()) / "index.html").read_text(encoding="utf-8")
    except OSError:
        return None
    match = ENTRY_SCRIPT.search(html)
    return match.group(1) if match else None
