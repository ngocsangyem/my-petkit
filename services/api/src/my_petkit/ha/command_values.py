"""Turning a Home Assistant command payload into the value a device setting takes.

HA publishes every command as a string ("ON", "12.5", "07:30", a select
label). These helpers parse it against the entity's declared type and bounds,
returning None (or OFF for a switch) instead of raising: the payload arrives
from the HA broker, and a malformed one must not take the command consumer
down. Split out of `ha/commands.py`, which re-exports them.
"""
from __future__ import annotations

from my_petkit.ha.discovery import EntityDef
from my_petkit.utils.coerce import to_bool, to_float


def _coerce_switch(payload: str) -> int:
    """Coerce an HA switch payload ("ON"/"OFF") to the device's 0/1 form.

    Returns an `int`, not a `bool`: the value goes straight into a
    `property.set` params dict, and the device's settings fields are integers.
    An unrecognised payload is treated as OFF rather than rejected — a switch
    has no third state, so `default=False` reproduces the previous behaviour.
    """
    return int(to_bool(payload, False))


def _coerce_number(payload: str) -> int | float | None:
    """Coerce an HA number/select payload to the numeric form the device wants.

    Deliberately polymorphic: an integral value comes back as an `int` so the
    JSON reaching the device reads `{"volume": 7}` and not `{"volume": 7.0}`.
    A non-integral one stays a `float`.

    Returns:
        None for anything non-numeric — the caller logs and drops the command.
        Infinities and NaN count as non-numeric here, though bare `float()`
        accepts them: they serialise as bare `Infinity`/`NaN`, which is not
        valid JSON, and no setpoint the device understands is non-finite.
    """
    number = to_float(payload, None)
    if number is None:
        return None
    return int(number) if number.is_integer() else number


#: Seconds in a day. A time-of-day setting is `0 <= v < DAY_SECONDS`.
DAY_SECONDS = 24 * 60 * 60


def _coerce_time(payload: str) -> int | None:
    """Coerce HA's `HH:MM:SS` clock to the seconds-since-midnight the device wants.

    HA's MQTT time platform always publishes all three fields, but seconds are
    accepted as optional so a value typed by hand in the web panel — or pasted
    from the app's own `13:00` — is not rejected for a formatting detail.

    Returns:
        None for anything that is not a time, so the caller logs and drops the
        command rather than writing a number to somebody's fountain. `24:00:00`
        is refused too: it is the one value that looks valid, reads as
        `DAY_SECONDS`, and would be a schedule the device can never reach.
    """
    parts = str(payload).strip().split(":")
    if len(parts) not in (2, 3):
        return None
    try:
        hours, minutes = int(parts[0]), int(parts[1])
        seconds = int(parts[2]) if len(parts) == 3 else 0
    except ValueError:
        return None
    if not (0 <= minutes < 60 and 0 <= seconds < 60):
        return None
    total = hours * 3600 + minutes * 60 + seconds
    return total if 0 <= total < DAY_SECONDS else None


def _select_value(entity: EntityDef, payload: str) -> int | float | str | None:
    """Map an HA select LABEL back to the value the device expects.

    HA always sends a label, since that is what it was given as `options` (see
    ha/discovery.py::_select_value_template). The numeric fallback exists for
    an option list that was later renamed while HA still holds the old retained
    command payload, and for anyone publishing a raw value by hand.

    Returns:
        The `option_values` entry for the label, or its index when the entity
        has none; None if the payload is neither a known label nor a number.
    """
    label = str(payload).strip()
    if label in entity.options:
        idx = entity.options.index(label)
        if entity.option_values:
            return entity.option_values[idx]
        return idx
    return _coerce_number(label)


def _within_bounds(entity: EntityDef, value: float) -> bool:
    """True unless `value` breaks a bound the entity actually declared.

    An undeclared bound is not a bound. `min_value`/`max_value` are None until
    an EntityDef names them, and a `number` may legitimately have only one side
    or neither — a range invented here is enforced as a refusal below, so it
    would reject values the device accepts.
    """
    if entity.min_value is not None and value < entity.min_value:
        return False
    return not (entity.max_value is not None and value > entity.max_value)


def _bounds_text(entity: EntityDef) -> str:
    """The range clause of a refusal, worded for the bounds that exist."""
    if entity.min_value is not None and entity.max_value is not None:
        return f"between {entity.min_value} and {entity.max_value}"
    if entity.min_value is not None:
        return f"at least {entity.min_value}"
    return f"at most {entity.max_value}"
