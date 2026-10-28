"""Security headers on every user-plane response, and no CORS at all.

Hooked on `on_response_prepare`, not as a middleware, so it reaches every
response the panel sends — static files, WebSocket upgrades and the error
envelope included — at the last moment its headers can still change.

* `Content-Security-Policy: default-src 'self'; frame-ancestors 'self'`. Under
  Home Assistant Ingress the panel is served from HA's own origin (the
  Supervisor proxies it under `/api/hassio_ingress/<token>/`), so the HA
  frontend that frames it IS `'self'`; no HA origin needs naming. The legacy
  panel document gets a wider policy (`legacy_panel_csp`), set by the index
  handler itself.
* `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`.
* `Strict-Transport-Security` only on a request that arrived over TLS — the
  socket's TLS, never `X-Forwarded-Proto`.
* CORS: nothing ever sets `Access-Control-Allow-*`, so a browser refuses any
  cross-origin read, and a preflight is answered like any unknown method.
"""

from __future__ import annotations

import base64
import hashlib

from aiohttp import web

BASE_CSP = "default-src 'self'; frame-ancestors 'self'"
HSTS = "max-age=31536000"


def inline_script_hash(source: str) -> str:
    """The CSP source expression allowing exactly one inline `<script>` body."""
    digest = hashlib.sha256(source.encode()).digest()
    return f"'sha256-{base64.b64encode(digest).decode()}'"


def legacy_panel_csp(script_hashes: list[str]) -> str:
    """The policy for the legacy panel's index document.

    Wider than `BASE_CSP` in three named ways, each forced by markup that is
    being replaced by the new dashboard rather than rewritten: one inline
    `<script>` (allowed by hash only, so no other inline script runs), ~90
    `style="..."` attributes (inline STYLE, which cannot execute code), and
    `blob:`/`data:` images from the face cropper and the log download.
    """
    scripts = " ".join(["'self'", *script_hashes])
    return (
        f"default-src 'self'; script-src {scripts}; style-src 'self' 'unsafe-inline'; "
        "img-src 'self' blob: data:; frame-ancestors 'self'"
    )


async def apply_security_headers(request: web.Request, response: web.StreamResponse) -> None:
    """`on_response_prepare` hook: add the headers this module describes."""
    headers = response.headers
    headers.setdefault("Content-Security-Policy", BASE_CSP)
    headers["X-Content-Type-Options"] = "nosniff"
    headers["Referrer-Policy"] = "no-referrer"
    if request.secure:
        headers["Strict-Transport-Security"] = HSTS
