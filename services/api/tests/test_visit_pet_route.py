"""`PUT /api/timeline/{id}/pet`: the change-cat sheet's one request."""

import pytest

from tests.pet_panel_client import pet_panel
from tests.pet_visit_rows import store_visit, visit_rows


@pytest.fixture
async def panel(pet_registry, event_store):
    client = await pet_panel(pet_registry, event_store)
    yield client
    await client.close()


async def test_picking_a_pet_names_the_visit_on_the_timeline(panel, event_store, pet_registry):
    miso = await pet_registry.create("Miso", device_ids=[10])
    ids = await store_visit(event_store, visit_rows("v1", 5400, ts=1_761_800_000.0))
    resp = await panel.put(f"/api/timeline/{ids[0]}/pet", json={"pet_id": miso["id"]})
    assert resp.status == 200
    body = await resp.json()
    assert (body["updated"], body["pet_source"], body["passing"]) == (2, "manual", False)

    day = await (await panel.get("/api/timeline?date=2025-10-30")).json()
    visit = next(s for s in day["sessions"] if s["kind"] == "visit")
    assert (visit["pet_name"], visit["pet_source"]) == ("Miso", "manual")


async def test_just_passing_hides_the_visit(panel, event_store):
    ids = await store_visit(event_store, visit_rows("v1", 5400, ts=1_761_800_000.0)[1:])
    resp = await panel.put(f"/api/timeline/{ids[0]}/pet", json={"pet_id": None, "passing": True})
    assert resp.status == 200
    day = await (await panel.get("/api/timeline?date=2025-10-30")).json()
    assert day["counts"]["passing"] == 1
    assert all(not s["passing"] for s in day["sessions"])


async def test_use_weight_sets_the_registered_weight(panel, event_store, pet_registry):
    miso = await pet_registry.create("Miso", device_ids=[10])
    ids = await store_visit(event_store, visit_rows("v1", 5400))
    resp = await panel.put(f"/api/timeline/{ids[1]}/pet",
                           json={"pet_id": miso["id"], "use_weight": True})
    assert (await resp.json())["pet"]["weight_g"] == 5400


async def test_apply_to_ref_binds_the_reported_identity(panel, event_store, pet_registry):
    miso = await pet_registry.create("Miso", device_ids=[10])
    ids = await store_visit(event_store, visit_rows("v1", 5400, pet_ref=101392625))
    other = await store_visit(event_store, visit_rows("v2", 5400, pet_ref=101392625))
    resp = await panel.put(f"/api/timeline/{ids[1]}/pet",
                           json={"pet_id": miso["id"], "apply_to_ref": True})
    assert resp.status == 200
    assert await pet_registry.resolve_pet_ref(101392625) == miso["id"]
    assert (await event_store.get_event(other[1]))["pet_id"] == miso["id"]


@pytest.mark.parametrize("body, code", [
    ({"pet_id": 999}, "unknown_pet"),
    ({"pet_id": "1"}, "invalid_body"),
    ({"pet_id": None, "passing": "yes"}, "invalid_body"),
    ({"pet_id": None, "use_weight": True}, "no_weight"),
    ({"pet_id": None, "apply_to_ref": True}, "ref_not_bindable"),
])
async def test_a_bad_request_changes_nothing(panel, event_store, body, code):
    ids = await store_visit(event_store, visit_rows("v1", 5400))
    resp = await panel.put(f"/api/timeline/{ids[1]}/pet", json=body)
    assert resp.status == 400
    assert (await resp.json())["error"]["code"] == code
    assert (await event_store.get_event(ids[1]))["pet_source"] is None


async def test_passing_with_a_pet_is_refused(panel, event_store, pet_registry):
    miso = await pet_registry.create("Miso", device_ids=[10])
    ids = await store_visit(event_store, visit_rows("v1", 5400))
    resp = await panel.put(f"/api/timeline/{ids[1]}/pet",
                           json={"pet_id": miso["id"], "passing": True})
    assert resp.status == 400


async def test_a_pets_own_id_cannot_be_given_to_another_pet(panel, event_store, pet_registry):
    miso = await pet_registry.create("Miso", device_ids=[10])
    mochi = await pet_registry.create("Mochi", device_ids=[10])
    ids = await store_visit(event_store, visit_rows("v1", 5400, pet_ref=miso["id"]))
    resp = await panel.put(f"/api/timeline/{ids[1]}/pet",
                           json={"pet_id": mochi["id"], "apply_to_ref": True})
    assert (await resp.json())["error"]["code"] == "ref_not_bindable"


async def test_an_unknown_event_is_404(panel):
    assert (await panel.put("/api/timeline/12345/pet", json={"pet_id": None})).status == 404


async def test_an_implausible_reading_is_not_used_as_a_weight(panel, event_store, pet_registry):
    miso = await pet_registry.create("Miso", device_ids=[10])
    ids = await store_visit(event_store, visit_rows("v1", 90))
    resp = await panel.put(f"/api/timeline/{ids[1]}/pet",
                           json={"pet_id": miso["id"], "use_weight": True})
    assert (await resp.json())["error"]["code"] == "implausible_weight"
