"""Re-derive event-only device state from the event store at start-up.

Last Clean, Last Visit, Pet Weight, Last Feed and a feeder's daily totals
exist only because an event happened (`normalize.apply_derived_state`); no
state report carries them. They live in `device.state`, which `devices.json`
does not persist, so after a restart every one of them read unknown until the
next such event, which can be a day away.

The event store already holds the events that set them, so they are rebuilt
from it rather than persisted a second time: the store stays the single source
of truth, and each value carries the time its event was stored instead of the
time of the restart. The replay runs every event through the same
`apply_derived_state` the live transports call, so the two cannot drift apart.
"""
from __future__ import annotations

import logging
from collections.abc import Iterable
from typing import TYPE_CHECKING

from sqlalchemy.exc import SQLAlchemyError

from my_petkit.events import codes
from my_petkit.events.normalize import _as_dict, apply_derived_state, derived_state_slot

if TYPE_CHECKING:
    from my_petkit.devices.base import Device
    from my_petkit.events.store import EventStore

log = logging.getLogger(__name__)

# How far before a slot's newest event the replay reaches back. A feeder's
# totals are per device day, and a local day is at most 25 hours long (DST), so
# 48 hours always holds the whole of the newest event's day. For the other
# slots only the newest event matters, but a visit without a weight must not
# hide the weight of the visit before it, which a window also covers.
REPLAY_WINDOW_SEC = 48 * 3600
# Upper bound on rows replayed per slot and device, so a flood of stored
# events cannot stall start-up. Far above a real day of visits or feeds.
REPLAY_LIMIT = 1000


def derived_event_types(device_type: str | None) -> dict[str, list[str]]:
    """The event_type strings that set each derived slot for this model.

    Mirrors `codes.lookup`: the category's HTTP table, else the global MQTT
    topic names; an unrecognised codename falls back to the default table.
    """
    category = codes.category_of(device_type) or codes.DEFAULT_HTTP_CATEGORY
    table = {**codes.MQTT_EVENT_TOPICS, **codes.HTTP_CODES_BY_CATEGORY.get(category, {})}
    slots: dict[str, list[str]] = {}
    for key, code in table.items():
        slot = derived_state_slot(code)
        if slot is not None:
            slots.setdefault(slot, []).append(key)
    return slots


async def replay_derived_state(store: EventStore, devices: Iterable[Device]) -> int:
    """Rebuild each device's event-only state from its stored events.

    Returns the number of events replayed. A device whose events cannot be
    read is logged and skipped: a start-up must not fail over a sensor that
    would otherwise just read unknown until the next event.
    """
    replayed = 0
    for device in devices:
        try:
            replayed += await _replay_device(store, device)
        except SQLAlchemyError:
            log.warning("Could not replay derived state for device %s",
                        device.petkit_id, exc_info=True)
    if replayed:
        log.info("Replayed %d stored events into derived device state", replayed)
    return replayed


async def _replay_device(store: EventStore, device: Device) -> int:
    """Replay one device's recent events of every derived slot, oldest first."""
    replayed = 0
    for event_types in derived_event_types(device.device_type).values():
        newest = await store.device_events_by_type(device.petkit_id, event_types, limit=1)
        if not newest:
            continue
        rows = await store.device_events_by_type(
            device.petkit_id, event_types,
            start_ts=newest[0]["ts"] - REPLAY_WINDOW_SEC, limit=REPLAY_LIMIT)
        # Oldest first, as they happened: the last write wins and the feed
        # totals roll over at a day boundary exactly as they did live.
        for row in reversed(rows):
            try:
                apply_derived_state(device, row["event_type"],
                                    _as_dict(row.get("content_json")), ts=row["ts"])
            except (OverflowError, OSError, ValueError):
                # A `ts` outside the platform's datetime range: skip the row.
                log.warning("Skipping stored event %s with an unusable ts", row.get("id"))
                continue
            replayed += 1
    return replayed
