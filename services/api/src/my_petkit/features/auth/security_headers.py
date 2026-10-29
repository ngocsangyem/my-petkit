"""Security headers on every user-plane response, and no CORS at all.

Hooked on `on_response_prepare`, not as a middleware, so it reaches every
response the panel sends — static files, WebSocket upgrades and the error
envelope included — at the last moment its headers can still change.

* `Content-Security-Policy: default-src 'self'; frame-ancestors 'self'`. Under
  Home Assistant Ingress the panel is served from HA's own origin (the
  Supervisor proxies it under `/api/hassio_ingress/<token>/`), so the HA
  frontend that frames it IS `'self'`; no HA origin needs naming. The web
  app's files carry their own `SPA_CSP` (`web/spa.py`), set by its handlers,
  which this hook leaves in place.
* `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`.
* `Strict-Transport-Security` only on a request that arrived over TLS — the
  socket's TLS, never `X-Forwarded-Proto`.
* CORS: nothing ever sets `Access-Control-Allow-*`, so a browser refuses any
  cross-origin read, and a preflight is answered like any unknown method.
"""

from __future__ import annotations

from aiohttp import web

BASE_CSP = "default-src 'self'; frame-ancestors 'self'"
HSTS = "max-age=31536000"


async def apply_security_headers(request: web.Request, response: web.StreamResponse) -> None:
    """`on_response_prepare` hook: add the headers this module describes."""
    headers = response.headers
    headers.setdefault("Content-Security-Policy", BASE_CSP)
    headers["X-Content-Type-Options"] = "nosniff"
    headers["Referrer-Policy"] = "no-referrer"
    if request.secure:
        headers["Strict-Transport-Security"] = HSTS
