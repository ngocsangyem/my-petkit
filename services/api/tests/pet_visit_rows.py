"""Event rows shaped like one litter-box visit, for the pet attribution tests."""

from typing import Any

from my_petkit.events import codes


def visit_rows(related: str, weight_g: int | None, *, pet_ref: int | None = None,
               pet_id: int | None = None, ts: float = 1_000.0,
               device_id: int = 10) -> list[dict[str, Any]]:
    """A pet-in report and the visit summary carrying the scale reading."""
    summary: dict[str, Any] = {"pet_weight": weight_g} if weight_g is not None else {}
    if pet_ref is not None:
        summary["score_info"] = [{"id": pet_ref, "score": 900}]
    return [
        {"event_uid": f"{related}:pet_in", "related_event": related, "device_id": device_id,
         "device_type": "t6", "event_type": "pet_in", "event_kind": "other", "ts": ts - 60,
         "content_json": {}},
        {"event_uid": f"{related}:10", "related_event": related, "device_id": device_id,
         "device_type": "t6", "event_type": "10", "event_kind": codes.KIND_TOILET, "ts": ts,
         "pet_ref": pet_ref, "pet_id": pet_id, "content_json": summary},
    ]


async def store_visit(store, rows: list[dict[str, Any]]) -> list[int]:
    return [await store.upsert_event(dict(r)) for r in rows]
