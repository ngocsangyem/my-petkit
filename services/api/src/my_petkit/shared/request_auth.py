"""Who is making this request, and the one way a handler can raise its tier.

The auth middleware (`features/auth/middleware.py`) attaches an `AuthContext`
to every request it lets through. Features read it only through this module:
they may not import `features.auth` (`.importlinter`), and they should not need
to know HOW a principal was authenticated — only whether it may do the risky
thing it is asking for.

`require_step_up` is for the routes whose tier depends on the request, not the
route: a settings write is R1 until it touches a `proxy_*` or `capture` key,
`/api/blocked` is a sensitive read until `?reveal=1`, and the command endpoint
is R2 until it is handed a raw `{suffix, payload}`.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass

from aiohttp import web

from my_petkit.shared.errors import api_error

log = logging.getLogger("my_petkit.audit")

#: The request key the middleware stores the context under.
REQUEST_AUTH = "my_petkit.auth"
#: The request key holding `(playlist_text, playlist_path) -> re-signed text`
#: on `signed-media` routes, so the media feature can sign an HLS playlist's
#: segment URIs without importing `features.auth`.
PLAYLIST_SIGNER = "my_petkit.playlist_signer"


@dataclass(frozen=True)
class AuthContext:
    """One authenticated (or signature-admitted) request.

    `principal` is a stable, non-secret label for logs: `session:<id>`,
    `token:<id>`, `ingress`, `signed-url` or `anonymous`. `stepped_up` says
    whether that principal re-entered the password within the step-up window.
    """

    principal: str
    method: str
    stepped_up: bool = False


def auth_context(request: web.Request) -> AuthContext | None:
    """The context the middleware attached, or None when it attached none."""
    ctx = request.get(REQUEST_AUTH)
    return ctx if isinstance(ctx, AuthContext) else None


def playlist_signer(request: web.Request) -> Callable[[str, str], str] | None:
    """The HLS playlist re-signer the middleware attached, or None."""
    signer = request.get(PLAYLIST_SIGNER)
    return signer if callable(signer) else None


def audit_r3(request: web.Request, action: str, *, device_id: int | None = None) -> None:
    """Write the structured log line every R3 action gets.

    Who, which route, which device, and the action; never a value from the
    body, which is exactly where the secrets of an R3 request travel.
    """
    ctx = auth_context(request)
    log.info(
        "r3_action action=%s principal=%s method=%s route=%s device=%s",
        action,
        ctx.principal if ctx else "unknown",
        request.method,
        request.path,
        device_id if device_id is not None else "-",
    )


def require_step_up(request: web.Request, action: str, *, device_id: int | None = None) -> None:
    """Refuse this request unless its principal holds a fresh step-up.

    Raises:
        web.HTTPForbidden: as the error envelope with code `step_up_required`.
    """
    ctx = auth_context(request)
    if ctx is None or not ctx.stepped_up:
        raise api_error(403, "step_up_required", "Re-enter the admin password to continue.")
    audit_r3(request, action, device_id=device_id)
