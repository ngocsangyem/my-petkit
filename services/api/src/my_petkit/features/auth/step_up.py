"""Step-up: re-entering the password unlocks R3 routes for five minutes.

Held in memory, keyed by principal (`session:<id>`, `token:<id>`, `ingress`).
Losing it on restart costs one more password prompt and nothing else, which is
the safe direction to fail in.
"""

from __future__ import annotations

import time
from collections.abc import Callable

STEP_UP_SECONDS = 300


class StepUps:
    """Which principals have re-authenticated, and until when."""

    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self._clock = clock
        self._until: dict[str, float] = {}

    def grant(self, principal: str) -> float:
        """Start (or restart) `principal`'s window; returns seconds it lasts."""
        now = self._clock()
        self._until = {p: t for p, t in self._until.items() if t > now}
        self._until[principal] = now + STEP_UP_SECONDS
        return STEP_UP_SECONDS

    def active(self, principal: str) -> bool:
        """Whether `principal` is inside its window."""
        until = self._until.get(principal)
        return until is not None and until > self._clock()

    def revoke(self, principal: str) -> None:
        """End a window early (logout)."""
        self._until.pop(principal, None)
