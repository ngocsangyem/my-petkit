"""The user plane's one error shape: `{"error": {"code", "message"}}`.

Handlers in `features/` were written against a flat `{"error": "<text>"}` and
still return it; `error_middleware` rewrites every error response on its way
out instead of touching ~100 call sites. The rules it enforces:

* every 4xx/5xx JSON body becomes the envelope, its text kept as `message`;
* a 5xx never carries the handler's text, which is where an `OSError` message
  — and with it a filesystem path — used to end up. The text is logged with a
  correlation id, and the client gets the id instead;
* an exception nobody caught becomes `500 internal` with a correlation id,
  never a traceback.
"""

from __future__ import annotations

import json
import logging
import secrets
from collections.abc import Awaitable, Callable
from typing import Any

from aiohttp import web

from my_petkit.utils.logtext import one_line

log = logging.getLogger(__name__)

_Handler = Callable[[web.Request], Awaitable[web.StreamResponse]]

_CLIENT_ERROR = 400
#: The statuses `api_error` raises, by status code.
_EXCEPTIONS: dict[int, type[web.HTTPException]] = {
    cls.status_code: cls
    for cls in (
        web.HTTPBadRequest,
        web.HTTPUnauthorized,
        web.HTTPForbidden,
        web.HTTPNotFound,
        web.HTTPConflict,
        web.HTTPUnsupportedMediaType,
        web.HTTPTooManyRequests,
        web.HTTPServiceUnavailable,
    )
}
_SERVER_ERROR = 500

#: The `code` a status gets when the handler did not name one.
_STATUS_CODES: dict[int, str] = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    413: "payload_too_large",
    415: "unsupported_media_type",
    429: "rate_limited",
    500: "internal",
    502: "upstream_unavailable",
    503: "unavailable",
    504: "upstream_timeout",
}

#: 5xx statuses whose text a handler wrote ON PURPOSE to describe the state of
#: something upstream ("PetKit refused: 704", "no BLE registry") and which the
#: operator needs to read. Every other 5xx — above all a 500 carrying `str(e)`
#: of an OSError, which is how a filesystem path leaks — has its text replaced.
_UPSTREAM_STATUSES = frozenset({502, 503, 504})


def _code_for(status: int) -> str:
    return _STATUS_CODES.get(status, "server_error" if status >= _SERVER_ERROR else "client_error")


def envelope(code: str, message: str, **extra: Any) -> dict[str, Any]:
    """The error body. `extra` lands beside `code`/`message` (`correlation_id`)."""
    return {"error": {"code": code, "message": message, **extra}}


def error_response(
    status: int, code: str, message: str, *, headers: dict[str, str] | None = None
) -> web.Response:
    """A JSON error response in the envelope shape."""
    return web.json_response(envelope(code, message), status=status, headers=headers)


def api_error(
    status: int, code: str, message: str, *, headers: dict[str, str] | None = None
) -> web.HTTPException:
    """The same response as an exception, for refusing from inside a helper.

    Raises:
        ValueError: `status` is not one this module refuses with.
    """
    exc_class = _EXCEPTIONS.get(status)
    if exc_class is None:
        raise ValueError(f"no aiohttp exception for status {status}")
    text = json.dumps(envelope(code, message))
    return exc_class(text=text, content_type="application/json", headers=headers)


def _correlation_id() -> str:
    return secrets.token_hex(8)


def _normalize(status: int, raw: Any, route: str) -> dict[str, Any]:
    """Turn whatever a handler put in an error body into the envelope."""
    err = raw.get("error") if isinstance(raw, dict) else None
    if (
        isinstance(err, dict)
        and isinstance(err.get("code"), str)
        and isinstance(err.get("message"), str)
        and (status < _SERVER_ERROR or "correlation_id" in err)
    ):
        return raw  # type: ignore[no-any-return]
    text = ""
    if isinstance(raw, dict) and isinstance(raw.get("error"), str):
        text = raw["error"]
    if status >= _SERVER_ERROR and status not in _UPSTREAM_STATUSES:
        cid = _correlation_id()
        log.error(
            "user-plane error status=%d route=%s correlation_id=%s detail=%r",
            status,
            route,
            cid,
            text,
        )
        return envelope(_code_for(status), "Internal error.", correlation_id=cid)
    return envelope(_code_for(status), text or web.Response(status=status).reason)


def _route_label(request: web.Request) -> str:
    """The route PATTERN, so a log line never carries a path's identifiers verbatim."""
    info = request.match_info.route.resource
    return one_line(info.canonical if info is not None else request.path)


@web.middleware
async def error_middleware(request: web.Request, handler: _Handler) -> web.StreamResponse:
    """Rewrite every user-plane error into the envelope; hide every 5xx detail."""
    try:
        response = await handler(request)
    except web.HTTPException as exc:
        if exc.status < _CLIENT_ERROR:
            raise
        raw: Any = None
        if exc.text and exc.content_type == "application/json":
            try:
                raw = json.loads(exc.text)
            except ValueError:
                raw = None
        body = _normalize(exc.status, raw, _route_label(request))
        headers = {k: v for k, v in exc.headers.items() if k.lower() in ("retry-after", "allow")}
        return web.json_response(body, status=exc.status, headers=headers)
    except Exception:
        cid = _correlation_id()
        log.exception(
            "unhandled user-plane error route=%s correlation_id=%s", _route_label(request), cid
        )
        return web.json_response(
            envelope("internal", "Internal error.", correlation_id=cid), status=500
        )

    if (
        response.status >= _CLIENT_ERROR
        and not response.prepared
        and isinstance(response, web.Response)
        and response.content_type == "application/json"
        and response.body is not None
    ):
        try:
            raw = json.loads(bytes(response.body))  # type: ignore[arg-type]
        except (ValueError, TypeError):
            raw = None
        body = _normalize(response.status, raw, _route_label(request))
        if body != raw:
            response.body = json.dumps(body).encode()
    return response
