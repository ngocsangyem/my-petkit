"""What a valid auto-pack rule is.

A rule is per device and lives in `device.config["local"]["autoPack"]`, the
part of the config that is never served back to the device. It starts off: the
T6's own app only packs on a tap, PetKit asks for someone to be nearby when it
packs, and code 8 is still graded `conflicted` until a T6 confirms it.
"""

from __future__ import annotations

import re
from typing import Any, Literal, TypedDict

Trigger = Literal["after_cleanings", "bin_full", "daily_at"]

TRIGGERS: tuple[Trigger, ...] = ("after_cleanings", "bin_full", "daily_at")

#: Bounds on `cleanings`: one is "pack after every clean", and fifty is far past
#: what one bag holds.
MIN_CLEANINGS, MAX_CLEANINGS = 1, 50

_HHMM = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")


class QuietHours(TypedDict):
    start: str
    end: str


class AutoPackRule(TypedDict):
    enabled: bool
    trigger: Trigger
    cleanings: int
    at: str
    quietHours: QuietHours | None


DEFAULT_RULE: AutoPackRule = {
    "enabled": False,
    "trigger": "after_cleanings",
    "cleanings": 5,
    "at": "18:00",
    "quietHours": None,
}


class RuleError(ValueError):
    """The body is not a rule; the message names the field."""


def minutes_of(hhmm: str) -> int:
    """`"07:30"` -> 450. Only called on values `clean_rule` accepted."""
    hours, minutes = hhmm.split(":")
    return int(hours) * 60 + int(minutes)


def _hhmm(value: Any, field: str) -> str:
    if not isinstance(value, str) or not _HHMM.match(value):
        raise RuleError(f"{field} must be HH:MM, 24-hour")
    return value


def clean_rule(body: Any) -> AutoPackRule:
    """A complete rule from a request body, or `RuleError`.

    Every field is required, so a client that forgot one is told so instead of
    silently keeping a value it never saw.
    """
    if not isinstance(body, dict):
        raise RuleError("the rule must be an object")
    unknown = set(body) - set(DEFAULT_RULE)
    if unknown:
        raise RuleError(f"unknown field {sorted(unknown)[0]}")
    missing = set(DEFAULT_RULE) - set(body)
    if missing:
        raise RuleError(f"missing field {sorted(missing)[0]}")

    enabled = body["enabled"]
    if not isinstance(enabled, bool):
        raise RuleError("enabled must be true or false")
    trigger = body["trigger"]
    if trigger not in TRIGGERS:
        raise RuleError(f"trigger must be one of {', '.join(TRIGGERS)}")
    cleanings = body["cleanings"]
    if (
        not isinstance(cleanings, int)
        or isinstance(cleanings, bool)
        or not MIN_CLEANINGS <= cleanings <= MAX_CLEANINGS
    ):
        raise RuleError(f"cleanings must be a whole number {MIN_CLEANINGS}-{MAX_CLEANINGS}")
    at = _hhmm(body["at"], "at")

    quiet: QuietHours | None = None
    raw_quiet = body["quietHours"]
    if raw_quiet is not None:
        if not isinstance(raw_quiet, dict) or set(raw_quiet) != {"start", "end"}:
            raise RuleError("quietHours must be null or {start, end}")
        start = _hhmm(raw_quiet["start"], "quietHours.start")
        end = _hhmm(raw_quiet["end"], "quietHours.end")
        if start == end:
            raise RuleError("quietHours start and end must differ")
        quiet = {"start": start, "end": end}

    return {
        "enabled": enabled,
        "trigger": trigger,
        "cleanings": cleanings,
        "at": at,
        "quietHours": quiet,
    }


def in_quiet_hours(rule: AutoPackRule, minute_of_day: int) -> bool:
    """Whether a local minute falls inside the rule's quiet hours.

    A window whose end is before its start crosses midnight (22:00-07:00).
    """
    quiet = rule["quietHours"]
    if quiet is None:
        return False
    start, end = minutes_of(quiet["start"]), minutes_of(quiet["end"])
    if start < end:
        return start <= minute_of_day < end
    return minute_of_day >= start or minute_of_day < end
