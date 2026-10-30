"""Changing which pet a Timeline visit belongs to.

Only the server's record changes: nothing is sent to the device, and the
device's own recognition of later visits is untouched. The choice is stored as
`pet_source = manual` on every row of the visit, which nothing automatic
overrides afterwards (`events/store.py::upsert_event`, `ai/pet_weights.py`).
"""

from __future__ import annotations

import json
from typing import Any

from aiohttp import web

from my_petkit.ai.pet_weights import WEIGHT_G_RANGE, plausible_weight_g, visit_weight_g
from my_petkit.events import codes
from my_petkit.events.store_visits import PET_SOURCE_MANUAL
from my_petkit.shared.appkeys import EVENT_STORE, HA_PUBLISHER, PET_REGISTRY
from my_petkit.shared.errors import api_error
from my_petkit.shared.panel_request import _json_body, _path_id
from my_petkit.shared.tiers import Tier, tier
from my_petkit.utils import clock


def _flag(body: dict[str, Any], key: str) -> bool:
    """An optional boolean field; anything but a real boolean is refused."""
    value = body.get(key, False)
    if not isinstance(value, bool):
        raise api_error(400, "invalid_body", f"`{key}` must be true or false.")
    return value


def _pet_id(body: dict[str, Any]) -> int | None:
    value = body.get("pet_id")
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, int):
        raise api_error(400, "invalid_body", "`pet_id` must be a pet id or null.")
    return value


@tier(PUT=Tier.R1)
async def api_visit_pet(request: web.Request) -> web.Response:
    """Set the pet of the visit an event belongs to, or mark it as nobody.

    Body `{pet_id, passing?, use_weight?, apply_to_ref?}`:

    * `pet_id` null with `passing` true is "No cat, just passing";
      `pet_id` null alone clears the visit.
    * `use_weight` also makes the visit's scale reading the pet's registered
      weight.
    * `apply_to_ref` binds the identity the device reported for this visit to
      the pet, so its later visits and its history name the pet too. Only for
      an identity no pet holds yet: a pet's own id cannot be handed to another.
    """
    store = request.app.get(EVENT_STORE)
    registry = request.app.get(PET_REGISTRY)
    if store is None or registry is None:
        raise api_error(400, "unavailable", "The event store is not available.")
    event_id = _path_id(request)
    body = await _json_body(request)
    pet_id = _pet_id(body)
    passing = _flag(body, "passing")
    use_weight = _flag(body, "use_weight")
    apply_to_ref = _flag(body, "apply_to_ref")

    rows = await store.visit_rows(event_id)
    if not rows:
        raise api_error(404, "not_found", "No such event.")
    if passing and pet_id is not None:
        raise api_error(400, "invalid_body", "A visit marked as passing has no pet.")
    pet = await registry.get(pet_id) if pet_id is not None else None
    if pet_id is not None and pet is None:
        raise api_error(400, "unknown_pet", "No such pet.")

    weights = [
        w
        for r in rows
        if r.get("event_kind") == codes.KIND_TOILET
        if (w := visit_weight_g(r)) is not None
    ]
    if use_weight and (pet_id is None or not weights):
        raise api_error(400, "no_weight", "This visit has no weight to use.")
    if use_weight and not plausible_weight_g(weights[-1]):
        lo, hi = WEIGHT_G_RANGE
        raise api_error(
            400, "implausible_weight", f"{weights[-1]} g is outside {lo}-{hi} g; not used."
        )
    ref = next((r["pet_ref"] for r in rows if r.get("pet_ref") is not None), None)
    if apply_to_ref and (
        pet_id is None or ref is None or await registry.resolve_pet_ref(ref) is not None
    ):
        raise api_error(
            400,
            "ref_not_bindable",
            "The box did not report an identity that can be given to this pet.",
        )

    before = {r["pet_id"] for r in rows if r.get("pet_id") is not None}
    updated = await store.set_visit_pet_manual(event_id, pet_id, passing)
    if apply_to_ref and pet is not None:
        try:
            aliases = json.loads(pet.get("device_pet_ids_json") or "[]")
        except (json.JSONDecodeError, TypeError):
            aliases = []
        await registry.update(pet_id, device_pet_ids_json=json.dumps([*aliases, ref]))
        await store.bind_pet_ref(ref, pet_id)
    if use_weight and pet_id is not None:
        await store.upsert_pet(
            {"weight_g": weights[-1], "weight_updated_at": clock.now()}, pet_id=pet_id
        )

    # Both pets' visit counts and last-visit sensors may have moved.
    publisher = request.app.get(HA_PUBLISHER)
    if publisher is not None:
        for pid in before | ({pet_id} if pet_id is not None else set()):
            affected = await registry.get(pid)
            if affected:
                await publisher.publish_pet_state(affected, store)

    return web.json_response(
        {
            "updated": updated,
            "pet_id": pet_id,
            "pet_source": PET_SOURCE_MANUAL,
            "passing": passing,
            "pet": await registry.get(pet_id) if pet_id is not None else None,
        }
    )
