"""The one place that knows what "now" and "local" mean.

Every epoch in this codebase is UTC, and stays that way. What used to be spread
across `time.localtime`, `mktime`, naive `datetime.fromtimestamp` and
`astimezone()` is the separate question of which calendar a moment falls in:
which day a feed schedule belongs to, the date in a media file name, the id a
device is sent for today's record. Those calls now all come through here, so
the answer can be changed in one place and a test can pin it.

`zone_for(device)` returns the zone to read local time in, in this order:
the operator's configured `timezone`, then the device's own IANA `locale`
(what it reports, and what it was provisioned with), then UTC with a warning.
The HOST zone is never used: the server may run in a container, a VPS or a
laptop in another country, and none of those say where the litter box is.
"""

from __future__ import annotations

import logging
import time
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone, tzinfo
from typing import TYPE_CHECKING, Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

if TYPE_CHECKING:
    from collections.abc import Iterator

log = logging.getLogger(__name__)

_fixed_now: float | None = None
_configured: ZoneInfo | None = None
_warned_utc: set[Any] = set()


def now() -> float:
    """The current UTC epoch, or the frozen one inside `frozen()`."""
    return _fixed_now if _fixed_now is not None else time.time()


@contextmanager
def frozen(when: float) -> Iterator[None]:
    """Pin `now()` for a test or a deterministic run."""
    global _fixed_now  # noqa: PLW0603 - the hook IS module state
    previous, _fixed_now = _fixed_now, when
    try:
        yield
    finally:
        _fixed_now = previous


def parse_zone(name: str) -> ZoneInfo | None:
    """`ZoneInfo` for an IANA name, or None for an empty/unknown/non-string one."""
    if not isinstance(name, str) or not name.strip():
        return None
    try:
        return ZoneInfo(name.strip())
    except (ZoneInfoNotFoundError, ValueError):
        return None


def configure(timezone: str = "") -> None:
    """Set (or with "" clear) the operator's zone. Raises ValueError if unknown."""
    global _configured  # noqa: PLW0603 - process-wide setting, set once at startup
    if timezone and parse_zone(timezone) is None:
        raise ValueError(f"timezone={timezone!r} is not a known IANA zone")
    _configured = parse_zone(timezone)
    _warned_utc.clear()


def zone_for(device: Any = None) -> tzinfo:
    """The zone local time is read in for `device` (or for the server)."""
    if _configured is not None:
        return _configured
    config = getattr(device, "config", None)
    if isinstance(config, dict):
        zone = parse_zone(config.get("locale"))  # type: ignore[arg-type]
        if zone is not None:
            return zone
    key = getattr(device, "petkit_id", None)
    if key not in _warned_utc:
        _warned_utc.add(key)
        log.warning("No timezone configured and %s reports no IANA locale; reading local "
                    "time as UTC. Set the `timezone` option.",
                    f"device {key}" if key is not None else "no device")
    return timezone.utc


def local_datetime(when: float | None = None, device: Any = None) -> datetime:
    """The moment `when` (default: now) as an aware local datetime."""
    return datetime.fromtimestamp(now() if when is None else when, zone_for(device))


def offset_hours(when: float | None = None, device: Any = None) -> float:
    """Hours east of UTC in force locally at `when`, e.g. 2.0 for Warsaw in summer."""
    offset = local_datetime(when, device).utcoffset()
    return offset.total_seconds() / 3600 if offset is not None else 0.0


def local_midnight_epoch(day: date, device: Any = None) -> float:
    """Epoch of local midnight starting `day`. Never `+ 86400` arithmetic."""
    return datetime(day.year, day.month, day.day, tzinfo=zone_for(device)).timestamp()


def local_midnight(when: float, day_offset: int = 0, device: Any = None) -> float:
    """Local midnight `day_offset` days after the day containing `when`.

    Re-localized per day, so the DST change days are 23 and 25 hours long.
    """
    day = local_datetime(when, device).date() + timedelta(days=day_offset)
    return local_midnight_epoch(day, device)


def local_date(when: float | None = None, device: Any = None) -> date:
    """The local calendar date `when` (default: now) falls on."""
    return local_datetime(when, device).date()
