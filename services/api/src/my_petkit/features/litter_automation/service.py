"""Force continue and auto-pack: what a device supports, and the auto-pack loop.

The guards are in `guards.py`; this module feeds them the device's recent
events, keeps each device's rule and its status, and decides when a rule fires.

A rule's lifecycle, per evaluation (once a minute):

1. A pack is pending: a `package_over` since the send is success; an error
   since the send turns the rule off; ten minutes of silence allows one more
   try (sent once the 30-minute gap since the first has passed), a second
   silence turns the rule off.
2. Otherwise, the trigger is checked. Not due: nothing happens.
3. Due: quiet hours, the guards and a 30-minute gap between attempts can each
   hold it back. Held back is not failed; the next evaluation looks again.
4. Nothing holds it back: one `start_action: 8`, and the rule waits for (1).

A rule is never turned back on by the server. Turning it off records why, and
the user turns it on again.

Every command here goes out over a live MQTT session or not at all
(`publish_live`). The panel's usual fallback, the heartbeat queue, keeps a
command until the device next polls, which can be long after the guards that
let it through stopped being true.

The loop and the rule's route take the same per-device lock (`device_lock`), so
a user turning a rule off cannot race a pack that was about to go out.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from typing import Any, TypedDict

from my_petkit.devices.base import Device
from my_petkit.devices.registry import DeviceRegistry
from my_petkit.events import codes
from my_petkit.events.store import EventStore
from my_petkit.features.litter_automation import guards
from my_petkit.features.litter_automation.schemas import (
    DEFAULT_RULE,
    AutoPackRule,
    in_quiet_hours,
    minutes_of,
)
from my_petkit.ha.commands import pack_waste_command
from my_petkit.ha.categories import get_entities_for_device
from my_petkit.utils import clock
from my_petkit.utils.coerce import to_float
from my_petkit.utils.logtext import one_line

log = logging.getLogger(__name__)

#: How often the loop evaluates every rule.
EVALUATE_EVERY_S = 60.0

#: How long a sent pack may go unanswered before it counts as no response.
PACK_RESPONSE_WINDOW_S = 10 * 60

#: The least time between two automatic packs on one device.
ATTEMPT_GAP_S = 30 * 60

#: Tries per trigger before silence turns the rule off: the first and one more.
MAX_RETRIES = 1

#: Every event type a guard or a trigger reads.
_READ_CODES = (
    codes.LITTER_VISIT_OPEN_CODES
    | codes.LITTER_VISIT_CLOSE_CODES
    | codes.LITTER_PET_NEARBY_CODES
    | codes.LITTER_PACK_DONE_CODES
    | codes.LITTER_ERROR_START_CODES
)

#: Sends one envelope to a device over MQTT, or raises `NotDelivered`.
Sender = Callable[[Device, str, dict[str, Any]], Awaitable[None]]

_locks: dict[int, asyncio.Lock] = {}


class NotDelivered(Exception):
    """The command did not go out over a live MQTT session, and was not queued."""


def device_lock(device: Device) -> asyncio.Lock:
    """The lock that serializes a device's rule between the loop and its route."""
    return _locks.setdefault(device.petkit_id, asyncio.Lock())


async def publish_live(
    hub: Any, bridge: Any, device: Device, suffix: str, envelope: dict[str, Any]
) -> None:
    """Publish over the device's live MQTT session, never to the heartbeat queue.

    Raises:
        NotDelivered: no live session, or the publish failed.
    """
    if bridge is None or not getattr(bridge, "_client", None) or not device.mqtt_connected:
        raise NotDelivered("not_on_mqtt")
    try:
        await bridge.publish_to_device(device, suffix, envelope)
    except Exception as exc:
        raise NotDelivered(str(exc)) from exc
    hub.record_command(device.petkit_id, "mqtt", f"{suffix} {envelope.get('params')}")


class AutoPackStatus(TypedDict):
    enabledAt: float | None
    pendingSince: float | None
    lastAttemptAt: float | None
    retries: int
    lastResult: str | None
    lastPackedAt: float | None
    heldBackBy: str | None
    disabledReason: str | None
    awaitingBinClear: bool


def _empty_status() -> AutoPackStatus:
    return {
        "enabledAt": None,
        "pendingSince": None,
        "lastAttemptAt": None,
        "retries": 0,
        "lastResult": None,
        "lastPackedAt": None,
        "heldBackBy": None,
        "disabledReason": None,
        "awaitingBinClear": False,
    }


def supports_force_continue(device: Device) -> bool:
    """The next-gen boxes, whose pause carries a `safeWarn` reason."""
    return device.device_type.lower() in codes.LITTER_NEXT_GEN


def supports_auto_pack(device: Device) -> bool:
    """Exactly the models that get a Pack button: the T6 today.

    Read from the entity table rather than a model list of its own, so the two
    can never disagree about which boxes code 8 means Pack on.
    """
    return any(
        e.key == "pack_waste" and e.component == "button" for e in get_entities_for_device(device)
    )


async def recent_events(store: EventStore, device: Device, since: float) -> list[dict[str, Any]]:
    """This device's events that a guard reads, since `since`."""
    return await store.device_events_by_type(device.petkit_id, _READ_CODES, start_ts=since)


def _slot(device: Device) -> dict[str, Any]:
    local = device.config.setdefault("local", {})
    slot = local.get("autoPack")
    if not isinstance(slot, dict):
        slot = local["autoPack"] = {}
    return slot


def load_rule(device: Device) -> AutoPackRule:
    """The device's rule, or the default (off) one."""
    stored = _slot(device).get("rule")
    if not isinstance(stored, dict):
        return dict(DEFAULT_RULE)  # type: ignore[return-value]
    return {**DEFAULT_RULE, **stored}  # type: ignore[typeddict-item]


def load_status(device: Device) -> AutoPackStatus:
    stored = _slot(device).get("status")
    status = _empty_status()
    if isinstance(stored, dict):
        status.update({k: v for k, v in stored.items() if k in status})  # type: ignore[typeddict-item]
    return status


def save_rule(device: Device, rule: AutoPackRule, now: float) -> AutoPackStatus:
    """Store a rule the user sent. Turning it on starts it from a clean slate.

    Counting cleanings from the moment it was enabled, not from the last pack
    ever recorded, is what stops a rule switched on after weeks without a pack
    from firing at once.
    """
    slot = _slot(device)
    was_enabled = bool(load_rule(device)["enabled"])
    status = load_status(device)
    if rule["enabled"] and not was_enabled:
        # The last attempt survives, so turning a rule off and on again cannot
        # skip the gap while a pack it sent may still be running.
        kept = {"lastPackedAt": status["lastPackedAt"], "lastAttemptAt": status["lastAttemptAt"]}
        status = _empty_status()
        status.update({"enabledAt": now, **kept})  # type: ignore[typeddict-item]
    elif not rule["enabled"]:
        status["pendingSince"] = None
        status["heldBackBy"] = None
    slot["rule"] = dict(rule)
    slot["status"] = dict(status)
    return status


def _store_status(device: Device, status: AutoPackStatus) -> None:
    _slot(device)["status"] = dict(status)


def _disable(device: Device, status: AutoPackStatus, reason: str) -> None:
    rule = load_rule(device)
    rule["enabled"] = False
    _slot(device)["rule"] = dict(rule)
    status.update(
        {"pendingSince": None, "heldBackBy": None, "disabledReason": reason, "lastResult": "failed"}
    )
    log.warning("auto-pack turned off for device %d: %s", device.petkit_id, one_line(reason))


def _latest_ts(events: list[dict[str, Any]], kinds: frozenset[str], after: float) -> float:
    return max(
        (
            to_float(e.get("ts"), 0.0) or 0.0
            for e in events
            if e.get("event_type") in kinds and (to_float(e.get("ts"), 0.0) or 0.0) > after
        ),
        default=0.0,
    )


class AutoPackEvaluator:
    """Evaluates every device's auto-pack rule; `run` does it once a minute."""

    def __init__(
        self,
        registry: DeviceRegistry,
        store: EventStore,
        send: Sender,
        *,
        clock_now: Callable[[], float] = clock.now,
    ) -> None:
        self._registry = registry
        self._store = store
        self._send = send
        self._now = clock_now

    async def run(self) -> None:
        while True:
            await asyncio.sleep(EVALUATE_EVERY_S)
            await self.evaluate_all()

    async def evaluate_all(self) -> None:
        for device in self._registry.all():
            if not load_rule(device)["enabled"] or not supports_auto_pack(device):
                continue
            try:
                await self.evaluate(device)
                # Written by the registry's own flusher, not synchronously once
                # a minute per rule.
                self._registry.mark_dirty()
            except Exception:
                # One device's bad data must not stop every other rule.
                log.exception("auto-pack: evaluating device %d failed", device.petkit_id)

    async def evaluate(self, device: Device) -> None:
        """Run one step of the lifecycle in the module docstring."""
        async with device_lock(device):
            await self._evaluate_locked(device)

    async def _evaluate_locked(self, device: Device) -> None:
        rule, status, now = load_rule(device), load_status(device), self._now()
        if not rule["enabled"]:
            return
        since = min(now - guards.OPEN_VISIT_WINDOW_S, status["pendingSince"] or now)
        events = await recent_events(self._store, device, since)

        if status["pendingSince"] is not None:
            self._settle_pending(device, status, events, now)
            _store_status(device, status)
            if status["pendingSince"] is not None or not load_rule(device)["enabled"]:
                return

        held = await self._held_back_by(device, rule, status, events, now)
        status["heldBackBy"] = held
        if held is None:
            await self._fire(device, status, now)
        _store_status(device, status)

    def _settle_pending(
        self,
        device: Device,
        status: AutoPackStatus,
        events: list[dict[str, Any]],
        now: float,
    ) -> None:
        sent = status["pendingSince"] or now
        packed = _latest_ts(events, codes.LITTER_PACK_DONE_CODES, sent)
        if packed:
            status.update(
                {"pendingSince": None, "retries": 0, "lastResult": "packed", "lastPackedAt": packed}
            )
            if load_rule(device)["trigger"] == "bin_full":
                status["awaitingBinClear"] = True
            return
        if _latest_ts(events, codes.LITTER_ERROR_START_CODES, sent) or device.state.get("errorMsg"):
            message = device.state.get("errorMsg") or "the device reported an error"
            _disable(device, status, f"pack_error: {message}")
            return
        if now - sent < PACK_RESPONSE_WINDOW_S:
            return
        if status["retries"] >= MAX_RETRIES:
            _disable(device, status, "no_response")
            return
        status.update(
            {"pendingSince": None, "retries": status["retries"] + 1, "lastResult": "no_response"}
        )

    async def _held_back_by(
        self,
        device: Device,
        rule: AutoPackRule,
        status: AutoPackStatus,
        events: list[dict[str, Any]],
        now: float,
    ) -> str | None:
        """None when the rule should pack now, else why it does not."""
        if not await self._due(device, rule, status, now):
            # The trigger is satisfied, so whatever cycle the retries counted
            # is over; the next one starts with its full allowance.
            status["retries"] = 0
            return "not_due"
        local = clock.local_datetime(now, device)
        if in_quiet_hours(rule, local.hour * 60 + local.minute):
            return "quiet_hours"
        blockers = guards.auto_pack_blockers(device, events, now)
        if blockers:
            return blockers[0]
        if status["lastAttemptAt"] and now - status["lastAttemptAt"] < ATTEMPT_GAP_S:
            return "cooldown"
        return None

    async def _due(
        self, device: Device, rule: AutoPackRule, status: AutoPackStatus, now: float
    ) -> bool:
        trigger = rule["trigger"]
        if trigger == "bin_full":
            # After a pack, the bin must be seen not full before it counts as
            # full again; otherwise a flag that stays up spends a bag every gap.
            full = bool(device.state.get("boxFull"))
            if not full:
                status["awaitingBinClear"] = False
            return full and not status["awaitingBinClear"]
        last_pack = await self._last_pack_ts(device)
        if trigger == "daily_at":
            local = clock.local_datetime(now, device)
            minutes = minutes_of(rule["at"])
            at = local.replace(hour=minutes // 60, minute=minutes % 60, second=0, microsecond=0)
            # Compared as instants: a wall time inside a DST gap compares
            # earlier as a wall time than as the instant it resolves to.
            at_ts = at.timestamp()
            enabled_at = status["enabledAt"] or 0.0
            return now >= at_ts >= enabled_at and last_pack < at_ts
        # after_cleanings
        since = max(last_pack, status["enabledAt"] or 0.0)
        cleans = await self._store.device_events_by_type(
            device.petkit_id, codes.LITTER_CLEAN_DONE_CODES, start_ts=since
        )
        count = sum(1 for e in cleans if (to_float(e.get("ts"), 0.0) or 0.0) > since)
        return count >= rule["cleanings"]

    async def _last_pack_ts(self, device: Device) -> float:
        rows = await self._store.device_events_by_type(
            device.petkit_id, codes.LITTER_PACK_DONE_CODES, limit=1
        )
        return (to_float(rows[0].get("ts"), 0.0) or 0.0) if rows else 0.0

    async def _fire(self, device: Device, status: AutoPackStatus, now: float) -> None:
        # Recorded before the send: an exception after the command went out
        # must not leave a status that sends it again a minute later.
        status.update({"pendingSince": now, "lastAttemptAt": now})
        _store_status(device, status)
        suffix, envelope = pack_waste_command()
        try:
            await self._send(device, suffix, envelope)
        except NotDelivered as exc:
            # Nothing went out, so nothing is pending; the gap still applies.
            status.update({"pendingSince": None, "heldBackBy": "not_delivered"})
            log.warning(
                "auto-pack for device %d not delivered: %s", device.petkit_id, one_line(exc)
            )
            return
        log.info("auto-pack sent to device %d (retry %d)", device.petkit_id, status["retries"])
