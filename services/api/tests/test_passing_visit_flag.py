"""Visits too light to be any registered cat: flagged, hidden, never deleted."""

from my_petkit.ai.pet_weights import attribute_visit, is_passing, passing_threshold_g
from my_petkit.events import ingest
from tests.pet_visit_rows import store_visit, visit_rows


def test_the_threshold_is_the_lightest_cat_less_its_tolerance():
    cats = [{"id": 1, "weight_g": 5430}, {"id": 2, "weight_g": 3860}]
    assert passing_threshold_g(cats) == 3560
    assert is_passing(3500, cats)
    assert not is_passing(3600, cats)


def test_without_a_registered_weight_nothing_is_passing():
    assert passing_threshold_g([{"id": 1, "weight_g": None}]) is None
    assert not is_passing(100, [{"id": 1, "weight_g": None}])


async def test_a_light_visit_is_flagged_on_every_row(event_store, pet_registry):
    cat = await pet_registry.create("Mochi", device_ids=[10])
    await pet_registry.update(cat["id"], weight_g=3860)
    ids = await store_visit(event_store, visit_rows("v1", 1200))
    assert await attribute_visit(event_store, 10, ids[1]) is None
    rows = await event_store.visit_rows(ids[1])
    assert all(r["passing"] == 1 and r["pet_id"] is None for r in rows)


async def test_a_passing_visit_shows_only_under_its_own_chip(event_store, pet_registry):
    cat = await pet_registry.create("Mochi", device_ids=[10])
    await pet_registry.update(cat["id"], weight_g=3860)
    # The summary rows alone: one card per visit.
    light = await store_visit(event_store, visit_rows("v1", 1200, ts=1_000.0)[1:])
    await store_visit(event_store, visit_rows("v2", 3850, ts=2_000.0)[1:])
    await attribute_visit(event_store, 10, light[0])

    sessions = ingest.group_sessions(await event_store.query_timeline(device_id=10))
    counts = ingest.filter_counts(sessions)
    assert (counts["all"], counts["toileting"], counts["passing"]) == (1, 1, 1)
    assert [s["weight"] for s in sessions if ingest.matches_filter(s, "all")] == [3850]
    assert [s["weight"] for s in sessions if ingest.matches_filter(s, "passing")] == [1200]


async def test_naming_the_identity_unhides_the_visit(event_store, pet_registry):
    cat = await pet_registry.create("Mochi", device_ids=[10])
    await pet_registry.update(cat["id"], weight_g=3860)
    ids = await store_visit(event_store, visit_rows("v1", 1200, pet_ref=101392625))
    await attribute_visit(event_store, 10, ids[1])
    assert (await event_store.get_event(ids[1]))["passing"] == 1

    await event_store.bind_pet_ref(101392625, cat["id"])
    row = await event_store.get_event(ids[1])
    assert (row["pet_id"], row["passing"]) == (cat["id"], None)


async def test_a_later_recognition_unhides_the_visit(event_store, pet_registry):
    cat = await pet_registry.create("Mochi", device_ids=[10])
    await pet_registry.update(cat["id"], weight_g=3860)
    pet_in, summary = visit_rows("v1", 1200)
    ids = await store_visit(event_store, [pet_in, summary])
    await attribute_visit(event_store, 10, ids[1])

    result = {**summary, "event_uid": "v1:24", "event_type": "24", "event_kind": "pet",
              "pet_ref": cat["id"], "pet_id": cat["id"], "content_json": {}}
    later = await event_store.upsert_event(result)
    await attribute_visit(event_store, 10, later)
    assert not any(r["passing"] for r in await event_store.visit_rows(ids[1]))


def test_a_light_visit_with_a_health_alert_still_shows_under_it():
    yowl = {"event_kind": "toilet_visit", "passing": True, "content": {"petVoice": 1}}
    assert ingest.matches_filter(yowl, "health_alert")
    assert ingest.matches_filter(yowl, "passing")
    assert not ingest.matches_filter(yowl, "all")
    assert not ingest.matches_filter(yowl, "toileting")
