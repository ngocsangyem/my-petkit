"""The checks a litter box must pass before we tell it to move.

Every function here is pure: it reads the device's merged state and a list of
its recent events, and answers with the reason it refuses, or None when it does
not. Nothing is sent from this module. A guard that cannot tell refuses, because
the thing being guarded is a rotating drum with a cat possibly near it.

Two facts about the state these lean on (both in `AGENTS.md`):

- `device.state` is merged into and never pruned, so a `workState` object from a
  finished cycle stays there. `workingState` is what a snapshot rewrites to
  `WORK_MODE_IDLE` when no cycle is running, so it decides whether `workState`
  is current at all.
- `petWeight` is the last visit's weight, copied out of `pet_out`. It is not a
  live reading and no guard uses it; `petInTime` is the box's own occupancy.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any

from my_petkit.devices.base import Device
from my_petkit.devices.state_tables import WORK_MODE_IDLE
from my_petkit.events import codes
from my_petkit.utils.coerce import to_float, to_int

#: A device we have heard nothing from for this long is treated as offline.
#: The T5's MQTT keep-alive is 62 s, so a live session always beats it.
LIVE_CONTACT_S = 90.0

#: How far back an unclosed visit still counts as a pet in the box.
OPEN_VISIT_WINDOW_S = 10 * 60

#: How far back a "pet nearby" event still blocks an automatic pack.
NEARBY_WINDOW_S = 2 * 60

#: `workState.workProcess` while paused for a `safeWarn` reason: tens digit 2
#: is the paused phase (`codes.WORK_PROCESS_PHASE`), units digit 2 the reason.
PAUSED_FOR_SAFE_WARN = 22

#: `safeWarn` value -> the reason force continue refuses it with. Only 0,
#: "pet approaching", is ever allowed through.
_SAFE_WARN_REFUSALS = {1: "pet_entered", 3: "cover_open"}

#: Every refusal reason, with the sentence a client shows for it.
REASONS: dict[str, str] = {
    "device_offline": "The device has not been heard from in the last 90 seconds.",
    "not_on_mqtt": "The device is not connected over MQTT.",
    "not_paused": "The device is not paused for a pet nearby.",
    "pet_entered": "The device paused because a pet entered it.",
    "cover_open": "The device paused because its cover is open.",
    "unknown_pause_reason": "The device paused for a reason that is not a pet nearby.",
    "pet_in_box": "The device reports a pet inside.",
    "visit_open": "A pet entered in the last 10 minutes and has not left.",
    "pet_nearby": "A pet was near the device in the last 2 minutes.",
    "device_fault": "The device reports an error.",
    "device_busy": "The device is running a cycle.",
    "no_bags": "The device reports no bags left, or has not reported a bag count.",
}


def _last_contact(device: Device) -> float:
    return max(device.last_state_report, device.last_mqtt, device.last_seen)


def device_offline(device: Device, now: float) -> str | None:
    """Refuse when nothing has arrived from the device recently."""
    if now - _last_contact(device) > LIVE_CONTACT_S:
        return "device_offline"
    return None


def pause_reason(device: Device) -> str | None:
    """Refuse unless the box is paused for "pet approaching" and nothing else."""
    state = device.state
    work = state.get("workState")
    if state.get("workingState") == WORK_MODE_IDLE or not isinstance(work, Mapping):
        return "not_paused"
    if to_int(work.get("workProcess"), None) != PAUSED_FOR_SAFE_WARN:
        return "not_paused"
    safe_warn = to_int(work.get("safeWarn"), None)
    if safe_warn == 0:
        return None
    if safe_warn is not None and safe_warn in _SAFE_WARN_REFUSALS:
        return _SAFE_WARN_REFUSALS[safe_warn]
    return "unknown_pause_reason"


def device_busy(device: Device) -> str | None:
    """Refuse unless the last snapshot said no cycle is running."""
    if device.state.get("workingState") != WORK_MODE_IDLE:
        return "device_busy"
    return None


def device_fault(device: Device) -> str | None:
    """Refuse while the device reports any error flag."""
    if device.state.get("errorMsg"):
        return "device_fault"
    return None


def no_bags(device: Device) -> str | None:
    """Refuse a pack unless the device has reported at least one bag."""
    count = to_int(device.state.get("packageCount"), None)
    if count is None or count <= 0:
        return "no_bags"
    return None


def _ts(event: Mapping[str, Any]) -> float:
    return to_float(event.get("ts"), 0.0) or 0.0


def pet_present(
    device: Device,
    events: Iterable[Mapping[str, Any]],
    now: float,
    *,
    nearby_blocks: bool,
) -> str | None:
    """Refuse when a pet is, or may still be, in or at the box.

    Args:
        events: this device's recent events, any order, each with `event_type`
            and `ts`. Only the visit and nearby codes are read.
        nearby_blocks: also refuse on a "pet nearby" event in the last two
            minutes. Off for force continue, whose whole point is a pet that
            was only nearby.
    """
    if to_float(device.state.get("petInTime"), 0.0):
        return "pet_in_box"
    last_open = last_close = last_nearby = 0.0
    for event in events:
        kind, ts = event.get("event_type"), _ts(event)
        if kind in codes.LITTER_VISIT_OPEN_CODES:
            last_open = max(last_open, ts)
        elif kind in codes.LITTER_VISIT_CLOSE_CODES:
            last_close = max(last_close, ts)
        elif kind in codes.LITTER_PET_NEARBY_CODES:
            last_nearby = max(last_nearby, ts)
    if last_open and now - last_open <= OPEN_VISIT_WINDOW_S and last_close < last_open:
        return "visit_open"
    if nearby_blocks and last_nearby and now - last_nearby <= NEARBY_WINDOW_S:
        return "pet_nearby"
    return None


def force_continue_blockers(
    device: Device, events: Iterable[Mapping[str, Any]], now: float
) -> list[str]:
    """Every reason force continue is refused right now, most basic first."""
    events = list(events)
    checks = (
        device_offline(device, now),
        pause_reason(device),
        pet_present(device, events, now, nearby_blocks=False),
        device_fault(device),
    )
    return [reason for reason in checks if reason]


def auto_pack_blockers(
    device: Device, events: Iterable[Mapping[str, Any]], now: float
) -> list[str]:
    """Every reason an automatic pack is held back right now."""
    events = list(events)
    checks = (
        device_offline(device, now),
        None if device.mqtt_connected else "not_on_mqtt",
        device_busy(device),
        pet_present(device, events, now, nearby_blocks=True),
        no_bags(device),
        device_fault(device),
    )
    return [reason for reason in checks if reason]
