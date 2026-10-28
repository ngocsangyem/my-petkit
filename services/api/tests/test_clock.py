"""`utils/clock.py`: local calendar in the process zone, DST included."""

import os
import time
from contextlib import contextmanager
from datetime import date, datetime, timezone

from my_petkit.utils import clock


@contextmanager
def _tz(name):
    original = os.environ.get("TZ")
    os.environ["TZ"] = name
    time.tzset()
    clock.configure(name)
    try:
        yield
    finally:
        clock.configure("")
        if original is None:
            os.environ.pop("TZ", None)
        else:
            os.environ["TZ"] = original
        time.tzset()


def test_frozen_pins_now_and_restores_it():
    with clock.frozen(1_000.0):
        assert clock.now() == 1_000.0
        with clock.frozen(2_000.0):
            assert clock.now() == 2_000.0
        assert clock.now() == 1_000.0
    assert abs(clock.now() - time.time()) < 5


def test_local_datetime_reads_the_configured_zone():
    with _tz("Asia/Saigon"):
        moment = clock.local_datetime(1_790_000_000)
        assert moment.utcoffset().total_seconds() == 7 * 3600
        assert moment.strftime("%Y-%m-%d %H:%M:%S") == "2026-09-21 21:13:20"


def test_the_spring_forward_day_is_23_hours_long():
    with _tz("Europe/Warsaw"):
        start = clock.local_midnight_epoch(date(2026, 3, 29))
        end = clock.local_midnight_epoch(date(2026, 3, 30))
        assert end - start == 23 * 3600


def test_the_fall_back_day_is_25_hours_long():
    with _tz("Europe/Warsaw"):
        noon = datetime(2026, 10, 25, 12, tzinfo=timezone.utc).timestamp()
        assert clock.local_midnight(noon, 1) - clock.local_midnight(noon, 0) == 25 * 3600


def test_offset_hours_follows_dst():
    with _tz("Europe/Warsaw"):
        winter = datetime(2026, 1, 15, tzinfo=timezone.utc).timestamp()
        summer = datetime(2026, 7, 15, tzinfo=timezone.utc).timestamp()
        assert clock.offset_hours(winter) == 1.0
        assert clock.offset_hours(summer) == 2.0


def test_the_repeated_hour_keeps_its_offset():
    """01:30 happens twice when DST ends; each epoch keeps the offset it had."""
    with _tz("America/New_York"):
        first = datetime(2026, 11, 1, 5, 30, tzinfo=timezone.utc).timestamp()   # 01:30 EDT
        second = datetime(2026, 11, 1, 6, 30, tzinfo=timezone.utc).timestamp()  # 01:30 EST
        a, b = clock.local_datetime(first), clock.local_datetime(second)
        assert a.strftime("%H:%M") == b.strftime("%H:%M") == "01:30"
        assert (a.utcoffset().total_seconds(), b.utcoffset().total_seconds()) == (-4 * 3600, -5 * 3600)


class _Device:
    def __init__(self, locale=None, petkit_id=1):
        self.config = {"locale": locale} if locale else {}
        self.petkit_id = petkit_id


def test_the_configured_zone_wins_over_the_device_locale_and_the_host():
    with _tz("Pacific/Kiritimati"):
        clock.configure("Asia/Saigon")
        assert clock.offset_hours(1_790_000_000, _Device("Europe/Warsaw")) == 7.0


def test_without_configuration_the_device_locale_is_used():
    assert clock.offset_hours(1_790_000_000, _Device("Asia/Kolkata")) == 5.5


def test_without_configuration_or_locale_local_time_is_utc_with_a_warning(caplog):
    original = os.environ.get("TZ")
    os.environ["TZ"] = "Pacific/Kiritimati"
    time.tzset()
    try:
        assert clock.offset_hours(1_790_000_000, _Device(petkit_id=999)) == 0.0
    finally:
        if original is None:
            os.environ.pop("TZ", None)
        else:
            os.environ["TZ"] = original
        time.tzset()
    assert any("UTC" in r.getMessage() for r in caplog.records)


def test_an_unknown_configured_zone_is_refused():
    import pytest

    with pytest.raises(ValueError, match="timezone"):
        clock.configure("Mars/Olympus_Mons")
