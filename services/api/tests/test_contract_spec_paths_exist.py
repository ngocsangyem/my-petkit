"""`packages/contracts/openapi.yaml` describes routes the panel really serves.

The code is the source of truth and the spec follows it: every operation in the
spec must exist in the router with the risk tier the handler enforces, and the
refusals that tier implies. In the other direction, a route the spec leaves out
is allowed only when it is listed in `UNDESCRIBED` below with the reason
OpenAPI cannot describe it.
"""
from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from tests.conftest_auth import bare_panel
from my_petkit.shared.tiers import Tier, route_tier

SPEC_PATH = Path(__file__).resolve().parents[3] / "packages" / "contracts" / "openapi.yaml"
HTTP_METHODS = ("get", "put", "post", "delete", "patch")

#: Routes the router serves that the spec deliberately does not describe.
UNDESCRIBED = {
    ("GET", "/"): "the web app's document (HTML), not an API",
    ("GET", "/assets/{name}"): "the web app's hashed build files",
    ("GET", "/{name}"): "the web app's top-level build files",
    ("GET", "/app"): "redirect from the web app's old mount to the root",
    ("GET", "/app/"): "redirect from the web app's old mount to the root",
    ("GET", "/api/ws"): "WebSocket; documented in packages/contracts/ws-events.md",
    ("GET", "/api/devices/{id}/talk"): "WebSocket audio stream",
}

#: The security requirement each tier's operations must carry.
SECURITY_BY_TIER = {
    Tier.CREDENTIAL.value: [],
    Tier.SIGNED_MEDIA.value: [{"bearerAuth": []}, {"cookieAuth": []}, {"signedUrl": []}],
}
AUTHENTICATED = [{"bearerAuth": []}, {"cookieAuth": []}]

#: Error statuses whose body is not the envelope: aiohttp's `FileResponse`
#: answers an unsatisfiable Range itself, with `Content-Range` and no body.
BODYLESS_ERRORS = {"416"}

#: Single error responses that are not JSON, so `error_middleware` leaves them alone.
NON_ENVELOPE_ERRORS = {
    ("GET", "/api/pets/{id}/faces/{face_id}/photo", "404"): "plain-text `not found`",
}

UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def _spec() -> dict:
    with SPEC_PATH.open(encoding="utf-8") as f:
        return yaml.safe_load(f)


def _operations() -> list[tuple[str, str, dict]]:
    return [
        (method.upper(), path, op)
        for path, item in _spec()["paths"].items()
        for method, op in item.items()
        if method in HTTP_METHODS
    ]


@pytest.fixture(scope="module")
def router_tiers(tmp_path_factory) -> dict[tuple[str, str], str | None]:
    app = bare_panel(tmp_path_factory.mktemp("panel"))
    tiers: dict[tuple[str, str], str | None] = {}
    for route in app.router.routes():
        if route.method == "HEAD" or route.resource is None:
            continue
        found = route_tier(route.handler, route.method)
        tiers[(route.method, route.resource.canonical)] = found.value if found else None
    return tiers


def test_every_spec_operation_is_served_by_the_router(router_tiers):
    missing = [(m, p) for m, p, _ in _operations() if (m, p) not in router_tiers]
    assert not missing, f"in the spec but not in the router: {missing}"


def test_every_spec_operation_declares_the_tier_the_handler_enforces(router_tiers):
    wrong = {
        (m, p): (op.get("x-risk-tier"), router_tiers.get((m, p)))
        for m, p, op in _operations()
        if op.get("x-risk-tier") != router_tiers.get((m, p))
    }
    assert not wrong, f"spec tier != handler tier (spec, handler): {wrong}"


def test_a_route_left_out_of_the_spec_is_a_listed_exception(router_tiers):
    described = {(m, p) for m, p, _ in _operations()}
    unlisted = sorted(set(router_tiers) - described - set(UNDESCRIBED))
    assert not unlisted, f"served but neither in the spec nor in UNDESCRIBED: {unlisted}"


def test_every_listed_exception_is_still_served_and_still_absent_from_the_spec(router_tiers):
    described = {(m, p) for m, p, _ in _operations()}
    stale = [k for k in UNDESCRIBED if k not in router_tiers or k in described]
    assert not stale, f"UNDESCRIBED entries that no longer apply: {stale}"


def test_each_operation_carries_the_security_its_tier_requires():
    wrong = {}
    for m, p, op in _operations():
        expected = SECURITY_BY_TIER.get(op.get("x-risk-tier"), AUTHENTICATED)
        if op.get("security") != expected:
            wrong[(m, p)] = op.get("security")
    assert not wrong, f"security does not match the tier: {wrong}"


def test_every_error_response_uses_the_error_envelope():
    loose = [
        (m, p, status)
        for m, p, op in _operations()
        for status, resp in op.get("responses", {}).items()
        if str(status)[0] in "45"
        and str(status) not in BODYLESS_ERRORS
        and (m, p, str(status)) not in NON_ENVELOPE_ERRORS
        and resp != {"$ref": "#/components/responses/Error"}
    ]
    assert not loose, f"4xx/5xx responses not using the Error envelope: {loose}"


def test_each_operation_declares_the_refusals_its_tier_and_method_imply():
    """401 for any bad credential, 429 where a rate limit applies, 403 for a
    step-up (R3) or a Host/Origin refusal (unsafe methods), 413 for a body."""
    missing = {}
    for m, p, op in _operations():
        expected = {"401"}
        tier = op.get("x-risk-tier")
        if tier == Tier.CREDENTIAL.value:
            expected.add("429")
        if tier == Tier.R3.value or m in UNSAFE_METHODS:
            expected.add("403")
        if "requestBody" in op:
            expected.add("413")
        absent = expected - {str(s) for s in op.get("responses", {})}
        if absent:
            missing[(m, p)] = sorted(absent)
    assert not missing, f"refusals the middleware can answer with, undeclared: {missing}"


def test_operation_ids_are_unique():
    ids = [op.get("operationId") for _, _, op in _operations()]
    assert None not in ids
    assert len(ids) == len(set(ids))
