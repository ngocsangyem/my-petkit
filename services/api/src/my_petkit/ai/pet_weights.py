"""Registered pet weights: keeping them current, and matching visits by them.

Three jobs, all run after a report is stored (`attribute_visit`):

* A visit the device recognised moves that pet's registered weight to what the
  scale read, the way PetKit's app keeps it current.
* A visit nobody recognised is matched to a pet by weight, but only when the
  answer is unambiguous. This is my-petkit's own rule, not PetKit's: what the
  real cloud tells a box about weights has not been captured yet.
* A visit lighter than every registered cat is flagged `passing`, so the
  Timeline can hide it without deleting anything.

A visit matched by weight never moves a registered weight: a wrong match would
otherwise drag the weight towards the wrong cat and make the next one likelier.
"""
from __future__ import annotations

import logging
import time
from typing import TYPE_CHECKING, Any

from my_petkit.events import codes
from my_petkit.events.sessions import content_of_row
from my_petkit.events.store_visits import (
    PET_SOURCE_DEVICE,
    PET_SOURCE_MANUAL,
    PET_SOURCE_WEIGHT,
)
from my_petkit.utils.coerce import to_float, to_int

if TYPE_CHECKING:
    from my_petkit.events.store import EventStore

log = logging.getLogger(__name__)

#: How far a visit may sit from a registered weight and still be that pet,
#: when the pet does not set its own.
DEFAULT_TOLERANCE_G = 300

#: Registered weights accepted, in grams, from the user and from the scale
#: alike. Wide on purpose: kittens and large breeds both use these boxes; the
#: bounds catch a unit mistake or a cat that only stepped half in.
WEIGHT_G_RANGE = (200, 20_000)


def plausible_weight_g(weight_g: int) -> bool:
    """Whether a reading could be a registered weight at all."""
    return WEIGHT_G_RANGE[0] <= weight_g <= WEIGHT_G_RANGE[1]


def measured_at(row: dict[str, Any]) -> float | None:
    """When the device says the visit happened, falling back to arrival.

    `ts` is when the report REACHED us, and a resend or a backlog flushed after
    an outage arrives late: compared by arrival, an old visit would count as the
    newest reading. The device's own `time_out`/`time_in` do not move.
    """
    content = content_of_row(row)
    for key in ("time_out", "time_in"):
        value = to_float(content.get(key), None)
        if value is not None and value > 0:
            return value
    return to_float(row.get("ts"), None)


def tolerance_of(pet: dict[str, Any]) -> int:
    """The pet's own tolerance in grams, or the default."""
    value = to_int(pet.get("weight_tolerance_g"), None)
    return value if value is not None and value > 0 else DEFAULT_TOLERANCE_G


def visit_weight_g(row: dict[str, Any]) -> int | None:
    """The scale reading on a stored row, in whole grams (the unit it reports)."""
    content = content_of_row(row)
    value = to_float(content.get("pet_weight", content.get("petWeight")), None)
    return round(value) if value is not None and value > 0 else None


def _weighed(pets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """The pets with a usable registered weight."""
    return [p for p in pets if (to_int(p.get("weight_g"), 0) or 0) > 0]


def match_by_weight(weight_g: int, pets: list[dict[str, Any]]) -> int | None:
    """The one pet this reading belongs to, or None when it is not certain.

    A pet matches when the reading is within its tolerance and it allows
    matching. The match only counts when no OTHER registered cat, matching
    allowed or not, sits within twice its own tolerance: two cats of similar
    weight are exactly where a guess goes wrong, and an empty answer is always
    fixable by hand.
    """
    weighed = _weighed(pets)
    hits = [p for p in weighed
            if to_int(p.get("weight_match"), 1)
            and abs(weight_g - p["weight_g"]) <= tolerance_of(p)]
    if len(hits) != 1:
        return None
    hit = hits[0]
    for other in weighed:
        if other["id"] != hit["id"] and abs(weight_g - other["weight_g"]) <= 2 * tolerance_of(other):
            return None
    return int(hit["id"])


def passing_threshold_g(pets: list[dict[str, Any]]) -> int | None:
    """Below this a visit is lighter than any registered cat; None with no weights."""
    weighed = _weighed(pets)
    if not weighed:
        return None
    return min(p["weight_g"] - tolerance_of(p) for p in weighed)


def is_passing(weight_g: int, pets: list[dict[str, Any]]) -> bool:
    """Whether a reading is too light to be any registered cat."""
    threshold = passing_threshold_g(pets)
    return threshold is not None and weight_g < threshold


async def update_registered_weight(store: EventStore, pet_id: int, weight_g: int,
                                   measured_at: float | None) -> bool:
    """Move a pet's registered weight to a new reading. False if it did not move.

    A reading older than the last change is ignored, so a visit replayed or
    delivered late cannot undo a newer one, and the same visit applied twice
    changes nothing the second time. So is a reading no cat could weigh, or one
    more than twice the pet's tolerance from its registered weight: a cat half
    in the box, two cats at once or one on the lid would otherwise replace the
    weight every other rule leans on, in one visit.
    """
    pet = await store.get_pet(pet_id)
    if pet is None or not plausible_weight_g(weight_g):
        return False
    at = measured_at if measured_at is not None else time.time()
    last = to_float(pet.get("weight_updated_at"), None)
    if last is not None and at <= last:
        return False
    current = to_int(pet.get("weight_g"), None)
    if current is not None and abs(weight_g - current) > 2 * tolerance_of(pet):
        log.info("Pet %s: ignoring a %s g reading, too far from %s g", pet_id, weight_g, current)
        return False
    await store.upsert_pet({"weight_g": weight_g, "weight_updated_at": at}, pet_id=pet_id)
    log.info("Pet %s registered weight %s g -> %s g", pet_id, pet.get("weight_g"), weight_g)
    return True


async def attribute_visit(store: EventStore, device_id: int, event_id: int) -> int | None:
    """Run the weight rules over the visit `event_id` belongs to.

    Safe to call for every stored report: each step only fills what is still
    blank or repeats what it decided before. Returns the pet a weight match
    attributed the visit to, so the caller can publish that pet's state, or
    None when this call attributed nobody.
    """
    rows = await store.visit_rows(event_id)
    toilet = [r for r in rows if r.get("event_kind") == codes.KIND_TOILET and visit_weight_g(r)]
    if not toilet:
        return None
    anchor = toilet[-1]
    weight_g = visit_weight_g(anchor)
    if weight_g is None or any(r.get("pet_source") == PET_SOURCE_MANUAL for r in rows):
        return None

    # A NULL source on a row that has a pet predates `pet_source`, when only
    # the device could set one.
    recognised = next((r for r in rows if r.get("pet_id") is not None
                       and r.get("pet_source") in (PET_SOURCE_DEVICE, None)), None)
    if recognised is not None:
        # The camera outranks the scale: a recognition arriving after a weight
        # match, or after the visit was judged too light, replaces that on the
        # whole visit.
        if any(r.get("pet_source") == PET_SOURCE_WEIGHT or r.get("passing") for r in rows):
            await store.set_visit_pet_automatic(event_id, recognised["pet_id"], False,
                                                source=PET_SOURCE_DEVICE)
        await update_registered_weight(store, recognised["pet_id"], weight_g, measured_at(anchor))
        return None

    pets = await store.pets_for_device(device_id)
    pet_id = match_by_weight(weight_g, pets)
    passing = pet_id is None and is_passing(weight_g, pets)
    await store.set_visit_pet_automatic(event_id, pet_id, passing)
    return pet_id
