"""A pet the user picks for a visit stays picked.

The device resends reports, sends the rest of a visit later, and a bound
identity re-attributes history in bulk. None of that may undo a choice the
user made by hand, and the choice covers the whole visit, not the one row.
"""

from my_petkit.ai.pet_weights import attribute_visit
from tests.pet_visit_rows import store_visit, visit_rows


async def _pet(registry, name, **fields):
    pet = await registry.create(name, device_ids=[10])
    return await registry.update(pet["id"], **fields) if fields else pet


async def test_a_manual_pet_covers_every_row_of_the_visit(event_store, pet_registry):
    miso = await _pet(pet_registry, "Miso")
    ids = await store_visit(event_store, visit_rows("v1", 5400))
    assert await event_store.set_visit_pet_manual(ids[1], miso["id"], False) == 2
    rows = await event_store.visit_rows(ids[0])
    assert {(r["pet_id"], r["pet_source"]) for r in rows} == {(miso["id"], "manual")}


async def test_a_device_resend_does_not_override_the_manual_pet(event_store, pet_registry):
    miso = await _pet(pet_registry, "Miso")
    mochi = await _pet(pet_registry, "Mochi")
    rows = visit_rows("v1", 5400, pet_ref=mochi["id"], pet_id=mochi["id"])
    ids = await store_visit(event_store, rows)
    await event_store.set_visit_pet_manual(ids[1], miso["id"], False)

    await store_visit(event_store, rows)  # the box sends the same reports again
    assert (await event_store.get_event(ids[1]))["pet_id"] == miso["id"]
    assert (await event_store.get_event(ids[1]))["pet_source"] == "manual"


async def test_a_later_report_of_the_visit_joins_the_manual_pet(event_store, pet_registry):
    miso = await _pet(pet_registry, "Miso")
    pet_in, summary = visit_rows("v1", 5400)
    first = await event_store.upsert_event(dict(pet_in))
    await event_store.set_visit_pet_manual(first, miso["id"], False)

    later = await event_store.upsert_event(dict(summary))
    row = await event_store.get_event(later)
    assert (row["pet_id"], row["pet_source"]) == (miso["id"], "manual")


async def test_binding_an_identity_skips_visits_picked_by_hand(event_store, pet_registry):
    miso = await _pet(pet_registry, "Miso")
    mochi = await _pet(pet_registry, "Mochi")
    picked = await store_visit(event_store, visit_rows("v1", 5400, pet_ref=777))
    other = await store_visit(event_store, visit_rows("v2", 5400, pet_ref=777))
    await event_store.set_visit_pet_manual(picked[1], miso["id"], False)

    await event_store.bind_pet_ref(777, mochi["id"])
    assert (await event_store.get_event(picked[1]))["pet_id"] == miso["id"]
    assert (await event_store.get_event(other[1]))["pet_id"] == mochi["id"]


async def test_weight_rules_leave_a_manual_visit_alone(event_store, pet_registry):
    await _pet(pet_registry, "Miso", weight_g=5400)
    ids = await store_visit(event_store, visit_rows("v1", 5400))
    await event_store.set_visit_pet_manual(ids[1], None, True)

    assert await attribute_visit(event_store, 10, ids[1]) is None
    row = await event_store.get_event(ids[1])
    assert (row["pet_id"], row["pet_source"], row["passing"]) == (None, "manual", 1)
