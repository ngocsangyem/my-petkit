"""A box recognises up to 15 pets, as PetKit's app enforces."""

import pytest

from my_petkit.ai.pets import MAX_PETS_PER_DEVICE
from tests.pet_panel_client import pet_panel

JPEG = b"\xff\xd8\xff\xe0" + b"A" * 60


@pytest.fixture
async def panel(pet_registry, event_store):
    client = await pet_panel(pet_registry, event_store)
    yield client
    await client.close()


async def _fill(pet_registry, count, device_id=10):
    return [await pet_registry.create(f"Cat {i}", device_ids=[device_id]) for i in range(count)]


async def test_the_device_is_handed_at_most_15_pets(pet_registry, monkeypatch):
    async def same(data):
        return data
    monkeypatch.setattr("my_petkit.ai.pets.normalize_face_photo", same)
    pets = await _fill(pet_registry, MAX_PETS_PER_DEVICE + 2)
    for pet in pets:
        await pet_registry.add_face(pet["id"], JPEG)
    payload = await pet_registry.discern_pic_payload(10, "host")
    ids = [entry["id"] for entry in payload["result"]["list"]]
    assert ids == [p["id"] for p in pets[:MAX_PETS_PER_DEVICE]]


async def test_a_sixteenth_pet_on_a_device_is_refused(panel, pet_registry):
    await _fill(pet_registry, MAX_PETS_PER_DEVICE)
    resp = await panel.post("/api/pets", json={"name": "One more", "device_ids": [10]})
    assert resp.status == 409
    assert (await resp.json())["error"]["code"] == "too_many_pets"
    ok = await panel.post("/api/pets", json={"name": "Elsewhere", "device_ids": [11]})
    assert ok.status == 200


async def test_moving_a_pet_onto_a_full_device_is_refused(panel, pet_registry):
    await _fill(pet_registry, MAX_PETS_PER_DEVICE)
    extra = await pet_registry.create("Extra", device_ids=[11])
    resp = await panel.post(f"/api/pets/{extra['id']}", json={"device_ids": [11, 10]})
    assert resp.status == 409


async def test_a_pet_already_over_the_limit_can_still_be_renamed(panel, pet_registry):
    pets = await _fill(pet_registry, MAX_PETS_PER_DEVICE + 1)
    resp = await panel.post(f"/api/pets/{pets[-1]['id']}",
                            json={"name": "Renamed", "device_ids": [10]})
    assert resp.status == 200


@pytest.mark.parametrize("body", [
    {"weight_g": 5.4}, {"weight_g": 50}, {"weight_g": True},
    {"weight_tolerance_g": 10}, {"weight_match": 1},
])
async def test_weight_fields_are_validated(panel, pet_registry, body):
    pet = await pet_registry.create("Miso", device_ids=[10])
    resp = await panel.post(f"/api/pets/{pet['id']}", json=body)
    assert resp.status == 400


async def test_weight_fields_are_stored(panel, pet_registry):
    resp = await panel.post("/api/pets", json={
        "name": "Miso", "device_ids": [10], "weight_g": 5430,
        "weight_tolerance_g": 250, "weight_match": False})
    pet = (await resp.json())["pet"]
    assert (pet["weight_g"], pet["weight_tolerance_g"], pet["weight_match"]) == (5430, 250, 0)
    assert pet["weight_updated_at"] is not None


async def test_a_pet_without_photos_does_not_take_a_slot(pet_registry, monkeypatch):
    async def same(data):
        return data
    monkeypatch.setattr("my_petkit.ai.pets.normalize_face_photo", same)
    await pet_registry.create("No photo", device_ids=[10])
    pets = await _fill(pet_registry, MAX_PETS_PER_DEVICE)
    for pet in pets:
        await pet_registry.add_face(pet["id"], JPEG)
    payload = await pet_registry.discern_pic_payload(10, "host")
    assert [e["id"] for e in payload["result"]["list"]] == [p["id"] for p in pets]
