"""A session (`related_event`) id is unique only within one device.

Media labels, pet names and stitched clips are looked up by session; each
lookup carries the device so another device's visit cannot lend its label,
its pet or its clip.
"""

from my_petkit.media import stitch


async def test_event_lookup_by_session_ignores_another_devices_event(event_store):
    await event_store.upsert_event({"event_uid": "s1:10", "device_id": 202, "device_type": "t5",
                                    "event_type": "10", "event_kind": "cleaning",
                                    "related_event": "s1", "ts": 2.0})
    assert await event_store.event_by_related("s1", 101) is None
    assert (await event_store.event_by_related("s1", 202))["device_id"] == 202


async def test_media_lookup_by_session_ignores_another_devices_media(event_store):
    for device_id in (101, 202):
        await event_store.upsert_media({"file_id": f"f{device_id}", "device_id": device_id,
                                        "related_event": "s1", "category": "fullVideo"})
    rows = await event_store.media_for_related_event("s1", 101)
    assert [r["device_id"] for r in rows] == [101]


def test_stitched_clip_ids_differ_per_device():
    a = {"device_id": 101, "related_event": "s1", "category": "fullVideo"}
    b = {**a, "device_id": 202}
    assert stitch._merged_file_id(a) != stitch._merged_file_id(b)
