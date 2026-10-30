"""Validation the pet routes share: weight fields, and the per-device pet limit."""

from __future__ import annotations

from typing import Any

from my_petkit.ai.pets import MAX_PETS_PER_DEVICE
from my_petkit.shared.errors import api_error
from my_petkit.utils import clock

#: Accepted registered weights, in grams. Wide on purpose: kittens and large
#: breeds both use these boxes; the bounds only catch a unit mistake (kg typed
#: where grams were meant, or the reverse).
WEIGHT_G_RANGE = (200, 20_000)
#: Accepted tolerances, in grams.
TOLERANCE_G_RANGE = (50, 2_000)


def _grams(body: dict[str, Any], key: str, bounds: tuple[int, int]) -> int | None:
    value = body[key]
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, int) or not bounds[0] <= value <= bounds[1]:
        raise api_error(
            400, "invalid_body", f"`{key}` must be whole grams from {bounds[0]} to {bounds[1]}."
        )
    return value


def weight_fields(body: dict[str, Any]) -> dict[str, Any]:
    """The weight columns a create or update body sets, validated.

    Setting `weight_g` stamps `weight_updated_at` with now, which also stops an
    older visit still in flight from overwriting what the user just typed.
    """
    fields: dict[str, Any] = {}
    if "weight_g" in body:
        fields["weight_g"] = _grams(body, "weight_g", WEIGHT_G_RANGE)
        fields["weight_updated_at"] = clock.now() if fields["weight_g"] is not None else None
    if "weight_tolerance_g" in body:
        fields["weight_tolerance_g"] = _grams(body, "weight_tolerance_g", TOLERANCE_G_RANGE)
    if "weight_match" in body:
        if not isinstance(body["weight_match"], bool):
            raise api_error(400, "invalid_body", "`weight_match` must be true or false.")
        fields["weight_match"] = 1 if body["weight_match"] else 0
    return fields


async def refuse_full_devices(
    registry: Any, device_ids: list[int], pet_id: int | None = None
) -> None:
    """Refuse to put a pet on a device that already has the maximum.

    Raises:
        web.HTTPConflict: a device in `device_ids` would go over the limit.
    """
    for device_id in set(device_ids):
        others = [p for p in await registry.for_device(device_id) if p["id"] != pet_id]
        if len(others) >= MAX_PETS_PER_DEVICE:
            raise api_error(
                409,
                "too_many_pets",
                f"A box recognises up to {MAX_PETS_PER_DEVICE} pets; "
                f"device {device_id} already has {len(others)}.",
            )
