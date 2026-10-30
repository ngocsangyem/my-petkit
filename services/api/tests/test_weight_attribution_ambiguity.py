"""Matching a visit to a pet by weight, only when the answer is certain.

The rule is my-petkit's, not PetKit's: a pet matches when the reading is
within its tolerance, and the match only counts when no other cat sits within
twice its own tolerance. Anything less certain stays blank, to be fixed by hand.
"""

from my_petkit.ai.pet_weights import attribute_visit, match_by_weight
from tests.pet_visit_rows import store_visit, visit_rows


def _cat(pid, weight_g, tolerance=None, match=1):
    return {"id": pid, "weight_g": weight_g, "weight_tolerance_g": tolerance,
            "weight_match": match}


def test_one_cat_within_tolerance_is_matched():
    assert match_by_weight(5400, [_cat(1, 5430), _cat(2, 3860)]) == 1


def test_two_cats_of_similar_weight_match_nobody():
    # Mochi is 500 g from the reading: outside her 300 g tolerance, inside 2x.
    assert match_by_weight(5400, [_cat(1, 5430), _cat(2, 4900)]) is None


def test_a_cat_that_opted_out_still_counts_as_a_competitor():
    assert match_by_weight(5400, [_cat(1, 5430), _cat(2, 4900, match=0)]) is None
    assert match_by_weight(4900, [_cat(1, 5430), _cat(2, 4900, match=0)]) is None


def test_a_wider_tolerance_widens_both_the_match_and_the_doubt():
    assert match_by_weight(5000, [_cat(1, 5430, tolerance=500), _cat(2, 3860)]) == 1
    assert match_by_weight(5400, [_cat(1, 5430), _cat(2, 4600, tolerance=500)]) is None


def test_no_registered_weight_matches_nobody():
    assert match_by_weight(5400, [{"id": 1, "weight_g": None}]) is None


async def test_a_match_is_stored_as_by_weight(event_store, pet_registry):
    miso = await pet_registry.create("Miso", device_ids=[10])
    await pet_registry.update(miso["id"], weight_g=5430)
    ids = await store_visit(event_store, visit_rows("v1", 5400))
    assert await attribute_visit(event_store, 10, ids[1]) == miso["id"]
    rows = await event_store.visit_rows(ids[1])
    assert {(r["pet_id"], r["pet_source"]) for r in rows} == {(miso["id"], "weight")}


async def test_a_pet_on_another_device_is_not_a_candidate(event_store, pet_registry):
    miso = await pet_registry.create("Miso", device_ids=[99])
    await pet_registry.update(miso["id"], weight_g=5430)
    ids = await store_visit(event_store, visit_rows("v1", 5400))
    assert await attribute_visit(event_store, 10, ids[1]) is None


async def test_a_later_recognition_replaces_a_weight_match(event_store, pet_registry):
    miso = await pet_registry.create("Miso", device_ids=[10])
    mochi = await pet_registry.create("Mochi", device_ids=[10])
    await pet_registry.update(miso["id"], weight_g=5430)
    pet_in, summary = visit_rows("v1", 5400)
    ids = await store_visit(event_store, [pet_in, summary])
    assert await attribute_visit(event_store, 10, ids[1]) == miso["id"]

    # The camera's answer arrives on a later report of the same visit.
    result = {**summary, "event_uid": "v1:24", "event_type": "24", "event_kind": "pet",
              "pet_ref": mochi["id"], "pet_id": mochi["id"], "content_json": {}}
    later = await event_store.upsert_event(result)
    await attribute_visit(event_store, 10, later)
    rows = await event_store.visit_rows(ids[1])
    assert {(r["pet_id"], r["pet_source"]) for r in rows} == {(mochi["id"], "device")}
