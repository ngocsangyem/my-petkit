"""Failure-driven rate limiting with exponential backoff, per IP and global.

Applied to everything that checks a guessable secret: login, step-up, setup
token and pairing-code redemption. Each is its own bucket, so locking out a
pairing brute force does not lock the admin out of logging in.

* Per IP: the first `FREE_FAILURES` failures cost nothing; each one after that
  doubles a lockout starting at `BASE_DELAY`, capped at `MAX_DELAY`.
* Global: the same, counted across every address, with a higher free
  allowance. This is what holds against a guesser with many addresses — and
  behind a reverse proxy, where every peer is the proxy, it is the only limit
  that means anything (the per-IP one degrades into a second global one).
* Counters forget a source `WINDOW` after its last failure; a success clears
  that source's counter but not the global one.

The address is the TCP peer, never a forwarded header: a header is whatever
the attacker wants it to be.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass

FREE_FAILURES = 5
GLOBAL_FREE_FAILURES = 50
BASE_DELAY = 1.0
MAX_DELAY = 900.0
WINDOW = 900.0
#: Distinct sources tracked per bucket before the oldest are dropped, so a
#: spray from many addresses cannot grow this without bound.
MAX_SOURCES = 4096
_GLOBAL = "*"


@dataclass
class _Counter:
    failures: int = 0
    last_failure: float = 0.0
    locked_until: float = 0.0


class RateLimiter:
    """Per-bucket, per-source failure counters."""

    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self._clock = clock
        self._counters: dict[tuple[str, str], _Counter] = {}

    def _get(self, bucket: str, source: str, now: float) -> _Counter:
        counter = self._counters.get((bucket, source))
        if counter is None or now - counter.last_failure > WINDOW:
            counter = _Counter()
            self._counters[(bucket, source)] = counter
            if len(self._counters) > MAX_SOURCES:
                oldest = min(self._counters, key=lambda k: self._counters[k].last_failure)
                del self._counters[oldest]
        return counter

    def retry_after(self, bucket: str, source: str) -> float:
        """Seconds until `source` may try `bucket` again; 0 when it may now."""
        now = self._clock()
        wait = 0.0
        for key in (source, _GLOBAL):
            counter = self._counters.get((bucket, key))
            if counter is not None:
                wait = max(wait, counter.locked_until - now)
        return max(0.0, wait)

    def failure(self, bucket: str, source: str) -> None:
        """Record one failed attempt."""
        now = self._clock()
        for key, free in ((source, FREE_FAILURES), (_GLOBAL, GLOBAL_FREE_FAILURES)):
            counter = self._get(bucket, key, now)
            counter.failures += 1
            counter.last_failure = now
            over = counter.failures - free
            if over > 0:
                delay = min(MAX_DELAY, BASE_DELAY * 2 ** min(over - 1, 20))
                counter.locked_until = max(counter.locked_until, now + delay)

    def success(self, bucket: str, source: str) -> None:
        """Clear `source`'s counter after it proved it knows the secret."""
        self._counters.pop((bucket, source), None)
