"""Which visits move a pet's registered weight.

A visit the camera recognised does, like PetKit's app. A visit matched only
by weight never does: a wrong match would drag the weight towards the wrong
cat and make the next wrong match likelier.
"""

from my_petkit.ai.pet_weights import attribute_visit, update_registered_weight
from tests.pet_visit_rows import store_visit, visit_rows


async def _pet(registry, name, **fields):
    pet = await registry.create(name, device_ids=[10])
    return await registry.update(pet["id"], **fields)


async def test_a_recognised_visit_updates_the_registered_weight(event_store, pet_registry):
    miso = await _pet(pet_registry, "Miso", weight_g=5420, weight_updated_at=10.0)
    ids = await store_visit(event_store, visit_rows("v1", 5430, pet_ref=miso["id"],
                                                    pet_id=miso["id"], ts=2_000.0))
    await attribute_visit(event_store, 10, ids[1])
    pet = await pet_registry.get(miso["id"])
    assert (pet["weight_g"], pet["weight_updated_at"]) == (5430, 2_000.0)


async def test_a_visit_matched_by_weight_does_not_update_it(event_store, pet_registry):
    miso = await _pet(pet_registry, "Miso", weight_g=5420, weight_updated_at=10.0)
    ids = await store_visit(event_store, visit_rows("v1", 5300, ts=2_000.0))
    assert await attribute_visit(event_store, 10, ids[1]) == miso["id"]
    assert (await pet_registry.get(miso["id"]))["weight_g"] == 5420


async def test_an_older_visit_does_not_overwrite_a_newer_weight(event_store, pet_registry):
    miso = await _pet(pet_registry, "Miso", weight_g=5420, weight_updated_at=5_000.0)
    assert not await update_registered_weight(event_store, miso["id"], 5000, 4_000.0)
    assert (await pet_registry.get(miso["id"]))["weight_g"] == 5420


async def test_the_same_visit_applied_twice_changes_nothing_more(event_store, pet_registry):
    miso = await _pet(pet_registry, "Miso", weight_g=5420, weight_updated_at=10.0)
    assert await update_registered_weight(event_store, miso["id"], 5430, 2_000.0)
    assert not await update_registered_weight(event_store, miso["id"], 5430, 2_000.0)


async def test_a_manual_pet_does_not_update_the_weight_by_itself(event_store, pet_registry):
    miso = await _pet(pet_registry, "Miso", weight_g=5420, weight_updated_at=10.0)
    ids = await store_visit(event_store, visit_rows("v1", 5100, ts=2_000.0))
    await event_store.set_visit_pet_manual(ids[1], miso["id"], False)
    await attribute_visit(event_store, 10, ids[1])
    assert (await pet_registry.get(miso["id"]))["weight_g"] == 5420
