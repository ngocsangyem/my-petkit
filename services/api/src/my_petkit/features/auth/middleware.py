"""Default-deny for the user plane: who is asking, from where, for which tier.

Order of checks for every request:

1. The route's tier (`shared/tiers.py`). Static files are `public-static`; a
   route that declares nothing for this method is refused outright, and an
   unmatched path is treated as needing a principal (an unauthenticated caller
   learns nothing about which paths exist).
2. The principal, from exactly one of: trusted Home Assistant Ingress, a
   `Bearer` client token, or the session cookie. A bad bearer token is refused
   rather than falling back to a cookie.
3. For every unsafe method and every WebSocket upgrade: the Host allowlist and
   the Origin check (`host_allowed`, `origin_matches`).
4. The tier itself: a principal for R0 to R3 (plus a fresh step-up for R3), a
   valid signature or a principal for `signed-media`.

**Ingress is trusted only on the Ingress port AND from the Supervisor's exact
address**, read from the TCP socket, never from a header. Home Assistant's
developer docs ("Presenting your app", Ingress section, docs/apps/presentation.md
in home-assistant/developers.home-assistant at 8da484e) require it: "Only
connections from `172.30.32.2` must be allowed. You should deny access to all
other IP addresses within your app server." `X-Ingress-Path` and every other
header Ingress adds can be sent by anyone, so none of them confers anything.
"""

from __future__ import annotations

import ipaddress
import logging
from http import HTTPStatus
from collections.abc import Awaitable, Callable

from aiohttp import hdrs, web
from yarl import URL

from my_petkit.features.auth.service import AuthService
from my_petkit.features.auth.sessions import COOKIE_NAME, Session, set_session_cookie
from my_petkit.shared.appkeys import AUTH
from my_petkit.shared.errors import error_response
from my_petkit.shared.request_auth import PLAYLIST_SIGNER, REQUEST_AUTH, AuthContext, audit_r3
from my_petkit.shared.tiers import Tier, route_tier

log = logging.getLogger(__name__)

_Handler = Callable[[web.Request], Awaitable[web.StreamResponse]]

#: The Supervisor's Ingress proxy address (see the module docstring for source).
HA_INGRESS_PEER = ipaddress.ip_address("172.30.32.2")
UNSAFE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
_DEFAULT_PORTS = {"http": 80, "https": 443}
#: `sockname` is `(host, port)` for IPv4 and `(host, port, flow, scope)` for IPv6.
_HOST_PORT_FIELDS = 2


def peer_ip(request: web.Request) -> ipaddress.IPv4Address | ipaddress.IPv6Address | None:
    """The TCP peer address, IPv4-mapped IPv6 unwrapped. Never a header."""
    transport = request.transport
    peer = transport.get_extra_info("peername") if transport is not None else None
    if not peer:
        return None
    try:
        ip = ipaddress.ip_address(str(peer[0]).split("%", 1)[0])
    except ValueError:
        return None
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        return ip.ipv4_mapped
    return ip


def _local_port(request: web.Request) -> int | None:
    transport = request.transport
    sock = transport.get_extra_info("sockname") if transport is not None else None
    if not sock or len(sock) < _HOST_PORT_FIELDS:
        return None
    return int(sock[1])


def ingress_trusted(request: web.Request, ingress_port: int | None) -> bool:
    """The request arrived on the Ingress port from the Supervisor itself."""
    if ingress_port is None:
        return False
    return _local_port(request) == ingress_port and peer_ip(request) == HA_INGRESS_PEER


def _split_authority(authority: str, default_port: int | None) -> tuple[str, int | None]:
    url = URL(f"//{authority}")
    try:
        port = url.explicit_port
    except ValueError:
        return "", None
    return (url.host or "").lower(), port if port is not None else default_port


def host_allowed(host_header: str | None, allowed_hosts: frozenset[str]) -> bool:
    """IP literals, `localhost`, and the configured names — nothing else.

    A browser on a DNS-rebinding page sends that page's own name as `Host`,
    so a name nobody configured is refused before it can reach a handler.
    """
    if not host_header:
        return False
    host, _ = _split_authority(host_header, None)
    if not host:
        return False
    if host == "localhost" or host in allowed_hosts:
        return True
    try:
        ipaddress.ip_address(host.strip("[]"))
    except ValueError:
        return False
    return True


def origin_matches(origin: str, host_header: str | None) -> bool:
    """Whether `Origin` names exactly the host and port the request was sent to."""
    if not host_header or origin == "null":
        return False
    url = URL(origin)
    if url.scheme not in _DEFAULT_PORTS or not url.host or url.path not in ("", "/"):
        return False
    want = ((url.host or "").lower(), url.port)
    return _split_authority(host_header, _DEFAULT_PORTS[url.scheme]) == want


def _deny(status: int, code: str, message: str) -> web.Response:
    headers = {"WWW-Authenticate": "Bearer"} if status == HTTPStatus.UNAUTHORIZED else None
    return error_response(status, code, message, headers=headers)


def _route_label(request: web.Request) -> str:
    resource = request.match_info.route.resource
    return resource.canonical if resource is not None else request.path


def _route_tier(request: web.Request) -> Tier | None:
    match = request.match_info
    if match.http_exception is not None:
        return Tier.R0
    if isinstance(match.route.resource, web.StaticResource):
        return Tier.PUBLIC_STATIC
    return route_tier(match.route.handler, request.method)


def _authenticate(
    request: web.Request, auth: AuthService
) -> tuple[AuthContext | None, Session | None, web.Response | None]:
    if ingress_trusted(request, auth.settings.ingress_port):
        stepped = auth.step_ups.active("ingress")
        return AuthContext("ingress", "ingress", stepped), None, None
    header = request.headers.get(hdrs.AUTHORIZATION, "")
    if header:
        scheme, _, raw = header.partition(" ")
        row = auth.tokens.authenticate(raw.strip()) if scheme.lower() == "bearer" else None
        if row is None:
            return None, None, _deny(401, "unauthorized", "The client token is not valid.")
        principal = f"token:{row.id}"
        return AuthContext(principal, "token", auth.step_ups.active(principal)), None, None
    cookie = request.cookies.get(COOKIE_NAME)
    if cookie:
        session = auth.sessions.verify(cookie, auth.store.session_epoch())
        if session is not None:
            principal = f"session:{session.sid}"
            ctx = AuthContext(principal, "session", auth.step_ups.active(principal))
            return ctx, session, None
    return None, None, None


def _cross_site_refusal(
    request: web.Request, auth: AuthService, ctx: AuthContext | None
) -> web.Response | None:
    """The Host/Origin checks for an unsafe method or a WebSocket upgrade."""
    host = request.headers.get(hdrs.HOST)
    if (ctx is None or ctx.method != "ingress") and not host_allowed(
        host, auth.settings.allowed_hosts
    ):
        return _deny(403, "host_not_allowed", "This host name is not allowed.")
    origin = request.headers.get(hdrs.ORIGIN)
    if origin is not None:
        if not origin_matches(origin, host):
            return _deny(403, "origin_not_allowed", "Cross-origin request refused.")
    elif ctx is not None and ctx.method in ("session", "ingress"):
        # A browser credential travels on its own; without an Origin there is
        # no proof this request came from our own page.
        return _deny(403, "origin_required", "Cross-origin request refused.")
    return None


def _admit(
    request: web.Request, auth: AuthService, tier: Tier
) -> tuple[AuthContext | None, Session | None, web.Response | None]:
    """Steps 2 to 4 of the module docstring: `(context, session, refusal)`."""
    ctx, session, refusal = _authenticate(request, auth)
    if refusal is not None:
        return None, None, refusal

    is_ws = request.headers.get(hdrs.UPGRADE, "").lower() == "websocket"
    if request.method in UNSAFE_METHODS or is_ws:
        refusal = _cross_site_refusal(request, auth, ctx)
        if refusal is not None:
            return None, None, refusal

    if tier is Tier.SIGNED_MEDIA and ctx is None:
        query = request.query
        if not auth.signer.verify(request.path, query.get("exp"), query.get("sig")):
            return None, None, _deny(401, "unauthorized", "Sign in, or use a valid signed link.")
        ctx = AuthContext("signed-url", "signature")
    elif ctx is None and tier is not Tier.CREDENTIAL:
        return None, None, _deny(401, "unauthorized", "Sign in to continue.")

    if tier is Tier.R3 and (ctx is None or not ctx.stepped_up):
        message = "Re-enter the admin password to continue."
        return None, None, _deny(403, "step_up_required", message)
    return ctx, session, None


@web.middleware
async def auth_middleware(request: web.Request, handler: _Handler) -> web.StreamResponse:
    """Enforce the route's tier. See the module docstring for the order."""
    tier = _route_tier(request)
    if tier is None:
        log.error("route without a tier refused: %s %s", request.method, request.path)
        return _deny(403, "forbidden", "This route is not available.")
    if tier is Tier.PUBLIC_STATIC:
        return await handler(request)

    auth: AuthService | None = request.app.get(AUTH)
    if auth is None:
        return _deny(503, "auth_unavailable", "Authentication is not configured.")

    ctx, session, refusal = _admit(request, auth, tier)
    if refusal is not None:
        return refusal
    request[REQUEST_AUTH] = ctx or AuthContext("anonymous", "none")
    if tier is Tier.SIGNED_MEDIA:
        request[PLAYLIST_SIGNER] = auth.signer.sign_playlist
    if tier is Tier.R3:
        raw_id = request.match_info.get("id", "")
        device_id = int(raw_id) if raw_id.isdigit() else None
        audit_r3(request, _route_label(request), device_id=device_id)

    response = await handler(request)
    if session is not None and not response.prepared:
        fresh = auth.sessions.refreshed(session)
        if fresh is not None:
            set_session_cookie(response, fresh)
    return response
