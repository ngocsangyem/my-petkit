"""Force continue and auto-pack for the next-gen litter boxes.

Force continue is its own R3 route rather than an action on the command
endpoint: the guards need the event history, the command it sends must never
be reachable as a button press, and R3 means a fresh step-up, which the auth
middleware enforces and logs before the handler runs.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from aiohttp import web

from my_petkit.devices.base import Device
from my_petkit.features.litter_automation import guards
from my_petkit.features.litter_automation.schemas import RuleError, clean_rule
from my_petkit.features.litter_automation.service import (
    Sender,
    load_rule,
    load_status,
    recent_events,
    save_rule,
    supports_auto_pack,
    supports_force_continue,
)
from my_petkit.ha.commands import force_continue_command
from my_petkit.shared.appkeys import BRIDGE, EVENT_STORE, HUB, REGISTRY
from my_petkit.shared.errors import api_error
from my_petkit.shared.panel_request import _deliver, _device_or_404, _json_body
from my_petkit.shared.tiers import Tier, tier
from my_petkit.utils import clock

log = logging.getLogger(__name__)

#: Refusal when there is no event store to read the visit history from.
HISTORY_UNAVAILABLE = "history_unavailable"


def make_sender(hub: Any, bridge: Any) -> Sender:
    """A `Sender` over the panel's own delivery path (MQTT, else the queue)."""

    async def send(device: Device, suffix: str, envelope: dict[str, Any]) -> str:
        response = await _deliver(hub, bridge, device, suffix, envelope)
        body = json.loads(response.text or "{}")
        return str(body.get("delivered", "unknown"))

    return send


async def _force_continue_blockers(request: web.Request, device: Device) -> list[str]:
    store = request.app.get(EVENT_STORE)
    if store is None:
        return [HISTORY_UNAVAILABLE]
    now = clock.now()
    events = await recent_events(store, device, now - guards.OPEN_VISIT_WINDOW_S)
    return guards.force_continue_blockers(device, events, now)


def _reason_view(reason: str) -> dict[str, str]:
    message = guards.REASONS.get(reason, "The event history is not available.")
    return {"reason": reason, "message": message}


@tier(GET=Tier.R0)
async def api_litter_automation(request: web.Request) -> web.Response:
    """What force continue and auto-pack can do on this device right now.

    `forceContinue.offered` is true only when every guard passes, so a client
    shows the button exactly when pressing it would be accepted; `blockers`
    lists why not, most basic first. A device that supports neither answers
    with both `supported` false rather than 404, so a client can ask any device.
    """
    device = _device_or_404(request)
    force: dict[str, Any] = {"supported": supports_force_continue(device)}
    if force["supported"]:
        blockers = await _force_continue_blockers(request, device)
        force.update(offered=not blockers, blockers=[_reason_view(r) for r in blockers])
    else:
        force.update(offered=False, blockers=[])
    pack: dict[str, Any] = {"supported": supports_auto_pack(device)}
    if pack["supported"]:
        pack.update(rule=load_rule(device), status=load_status(device))
    return web.json_response({"forceContinue": force, "autoPack": pack})


@tier(POST=Tier.R3)
async def api_force_continue(request: web.Request) -> web.Response:
    """Tell a box paused for a pet nearby to carry on, once, if every guard passes.

    Refused with 409 and the first failing guard's reason as the error code;
    nothing is sent then. Accepted, it sends exactly `continue_action: 0`.
    """
    device = _device_or_404(request)
    if not supports_force_continue(device):
        raise api_error(400, "not_supported", "This device has no force continue.")
    blockers = await _force_continue_blockers(request, device)
    log.info(
        "force_continue device=%d blockers=%s workState=%s petInTime=%s",
        device.petkit_id,
        ",".join(blockers) or "-",
        json.dumps(device.state.get("workState"), sort_keys=True),
        device.state.get("petInTime"),
    )
    if blockers:
        reason = _reason_view(blockers[0])
        raise api_error(409, reason["reason"], reason["message"])
    suffix, envelope = force_continue_command()
    return await _deliver(request.app[HUB], request.app.get(BRIDGE), device, suffix, envelope)


@tier(PUT=Tier.R1)
async def api_auto_pack(request: web.Request) -> web.Response:
    """Replace this device's auto-pack rule; answers the stored rule and status."""
    device = _device_or_404(request)
    if not supports_auto_pack(device):
        raise api_error(400, "not_supported", "This device has no auto-pack.")
    try:
        rule = clean_rule(await _json_body(request))
    except RuleError as exc:
        raise api_error(400, "invalid_rule", str(exc)) from exc
    status = save_rule(device, rule, clock.now())
    request.app[REGISTRY].save()
    log.info(
        "auto_pack_rule device=%d enabled=%s trigger=%s",
        device.petkit_id,
        rule["enabled"],
        rule["trigger"],
    )
    return web.json_response({"rule": rule, "status": status})
