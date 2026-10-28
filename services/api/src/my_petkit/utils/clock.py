"""The one place that knows what "now" and "local" mean.

Every epoch in this codebase is UTC, and stays that way. What used to be spread
across `time.localtime`, `mktime`, naive `datetime.fromtimestamp` and
`astimezone()` is the separate question of which calendar a moment falls in:
which day a feed schedule belongs to, the date in a media file name, the id a
device is sent for today's record. Those calls now all come through here, so
the answer can be changed in one place and a test can pin it.

`zone_for(device)` returns the zone to read local time in. Today that is the
PROCESS zone (whatever `TZ` / `/etc/localtime` says, re-read after
`time.tzset()`), which is exactly what the scattered calls used; the `device`
argument is there so the zone can come from configuration or from the device's
own `locale` without touching any caller.
"""

from __future__ import annotations

import time
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone, tzinfo
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from collections.abc import Iterator

_fixed_now: float | None = None


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


class _ProcessLocal(tzinfo):
    """The process's local zone, DST-aware, following `time.tzset()`.

    `datetime.now().astimezone().tzinfo` would be a FIXED offset, right only on
    the day it was taken. This asks the C library for the offset in force at
    each moment instead, which is what `time.localtime`/`mktime` did.
    """

    def _offset(self, dt: datetime) -> timedelta:
        if dt.tzinfo is self:
            dt = dt.replace(tzinfo=None)
        # A naive wall time -> its epoch via mktime (tm_isdst=-1: let the C
        # library decide), then the offset in force at that epoch.
        stamp = time.mktime((dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second,
                             0, 0, -1))
        return timedelta(seconds=time.localtime(stamp).tm_gmtoff)

    def utcoffset(self, dt: datetime | None) -> timedelta:
        if dt is None:
            return timedelta(seconds=time.localtime().tm_gmtoff)
        return self._offset(dt)

    def dst(self, dt: datetime | None) -> timedelta:
        return timedelta(0)

    def tzname(self, dt: datetime | None) -> str:
        stamp = time.time() if dt is None else self._epoch(dt)
        return time.localtime(stamp).tm_zone

    def fromutc(self, dt: datetime) -> datetime:
        stamp = dt.replace(tzinfo=timezone.utc).timestamp()
        return dt + timedelta(seconds=time.localtime(stamp).tm_gmtoff)

    def _epoch(self, dt: datetime) -> float:
        naive = dt.replace(tzinfo=None)
        return time.mktime((naive.year, naive.month, naive.day, naive.hour, naive.minute,
                            naive.second, 0, 0, -1))


PROCESS_LOCAL = _ProcessLocal()


def zone_for(device: Any = None) -> tzinfo:  # noqa: ARG001 - the seam for a per-device zone
    """The zone local time is read in for `device` (or the server)."""
    return PROCESS_LOCAL


def local_datetime(when: float | None = None, device: Any = None) -> datetime:
    """The moment `when` (default: now) as an aware local datetime."""
    stamp = now() if when is None else when
    zone = zone_for(device)
    if zone is PROCESS_LOCAL:
        # Through the C library directly: exact for every epoch, including the
        # repeated hour when DST ends, which a wall-time round trip cannot tell.
        lt = time.localtime(stamp)
        return datetime(lt.tm_year, lt.tm_mon, lt.tm_mday, lt.tm_hour, lt.tm_min, lt.tm_sec,
                        int(round((stamp % 1) * 1_000_000)) % 1_000_000,
                        tzinfo=timezone(timedelta(seconds=lt.tm_gmtoff), lt.tm_zone))
    return datetime.fromtimestamp(stamp, zone)


def offset_hours(when: float | None = None, device: Any = None) -> float:
    """Hours east of UTC in force locally at `when`, e.g. 2.0 for Warsaw in summer."""
    offset = local_datetime(when, device).utcoffset()
    return offset.total_seconds() / 3600 if offset is not None else 0.0


def local_midnight_epoch(day: date, device: Any = None) -> float:
    """Epoch of local midnight starting `day`. Never `+ 86400` arithmetic."""
    zone = zone_for(device)
    if zone is PROCESS_LOCAL:
        return time.mktime((day.year, day.month, day.day, 0, 0, 0, 0, 0, -1))
    return datetime(day.year, day.month, day.day, tzinfo=zone).timestamp()


def local_midnight(when: float, day_offset: int = 0, device: Any = None) -> float:
    """Local midnight `day_offset` days after the day containing `when`.

    Re-localized per day, so the DST change days are 23 and 25 hours long.
    """
    day = local_datetime(when, device).date() + timedelta(days=day_offset)
    return local_midnight_epoch(day, device)


def local_date(when: float | None = None, device: Any = None) -> date:
    """The local calendar date `when` (default: now) falls on."""
    return local_datetime(when, device).date()
