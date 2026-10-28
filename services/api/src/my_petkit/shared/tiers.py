"""Every user-plane route declares a risk tier; a route without one is refused.

The tier is declared ON THE HANDLER, per HTTP method, with `@tier(...)`, so the
declaration sits next to the code it governs and `web/panel.py`'s route table
(whose registration order is load-bearing) stays exactly as it was. The auth
middleware reads it back with `route_tier`; a handler that declares nothing
for the method being called gets no tier, and no tier means denied.

=================  ==========================================================
tier               what it takes
=================  ==========================================================
`public-static`    nothing: the shell and its assets, which carry no data
`signed-media`     a valid `?exp=&sig=` for exactly this path, or any
                   authenticated principal
`credential`       nothing but a rate limit: the endpoints that exchange a
                   password, setup token or pairing code FOR a credential,
                   which by definition cannot already require one
`R0` / `R0*`       an authenticated principal (`R0*` marks sensitive reads)
`R1`               an authenticated principal (settings, data)
`R2`               an authenticated principal (device commands, talk)
`R3`               an authenticated principal with a fresh step-up
=================  ==========================================================

A handler may still RAISE its tier for one request — a settings write that
touches a `proxy_*` key, `?reveal=1` — with `shared.request_auth.require_step_up`.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from enum import StrEnum
from typing import Any, TypeVar


class Tier(StrEnum):
    """The risk tier of one route+method."""

    PUBLIC_STATIC = "public-static"
    SIGNED_MEDIA = "signed-media"
    CREDENTIAL = "credential"
    R0 = "R0"
    R0_SENSITIVE = "R0*"
    R1 = "R1"
    R2 = "R2"
    R3 = "R3"


#: Tiers that a request may reach without a token, session or trusted Ingress.
#: Everything else is default-deny. `signed-media` is listed because a valid
#: signature stands in for the token; the middleware still checks it.
TOKEN_EXEMPT = frozenset({Tier.PUBLIC_STATIC, Tier.SIGNED_MEDIA, Tier.CREDENTIAL})

#: The attribute `@tier` stores its mapping under.
_ATTR = "__route_tiers__"

_Handler = TypeVar("_Handler", bound=Callable[..., Awaitable[Any]])


def tier(**by_method: Tier) -> Callable[[_Handler], _Handler]:
    """Declare the tier of a handler for each HTTP method it serves.

    `@tier(GET=Tier.R0, POST=Tier.R1)`. Method names are upper-case HTTP verbs;
    `HEAD` falls back to `GET` because aiohttp registers it alongside every GET.

    Raises:
        ValueError: a method name that is not upper-case, so a typo such as
            `get=` cannot silently leave the method undeclared.
    """
    for method in by_method:
        if method != method.upper():
            raise ValueError(f"tier method must be upper-case: {method!r}")

    def mark(handler: _Handler) -> _Handler:
        setattr(handler, _ATTR, dict(by_method))
        return handler

    return mark


def route_tier(handler: object, method: str) -> Tier | None:
    """The tier `handler` declares for `method`, or None when it declares none."""
    declared: dict[str, Tier] = getattr(handler, _ATTR, None) or {}
    method = method.upper()
    if method == "HEAD" and "HEAD" not in declared:
        method = "GET"
    return declared.get(method)
