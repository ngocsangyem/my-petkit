"""Read a device request's body exactly once, and drop one that is too large to read.

aiohttp caches a body only when `request.read()` succeeds. Past the app's
`client_max_size` it raises `HTTPRequestEntityTooLarge` AFTER consuming the
stream and caches nothing, so every later `read()` gets just the unread tail.
With each middleware reading the body for itself and swallowing that error, an
oversized `dev_event_report` reached its handler as the last ~900 KB of the
form -- `eventType` and `eventId` gone -- and was stored as a corrupt record
behind a 200.

So the body is read here, once, before any other middleware or handler sees
it, and stored under `REQUEST_BODY`. A successful read is also aiohttp's cache,
so a handler's own `request.read()` returns the same bytes. A body that cannot
be read whole is never handed on: the device gets the same empty success as
any endpoint we do not implement (a 4xx would have it retry forever), and the
drop is logged and marked under `BODY_DROPPED` for the panel's log entry.
"""
from __future__ import annotations

import logging
from typing import Awaitable, Callable

from aiohttp import web

log = logging.getLogger(__name__)

Handler = Callable[[web.Request], Awaitable[web.StreamResponse]]

#: The request body as read once by `body_middleware`; b"" when there is none.
REQUEST_BODY = "request_body"
#: Set (to the reason) when the body was dropped instead of handled.
BODY_DROPPED = "body_dropped"

BODY_METHODS = ("POST", "PUT", "PATCH")

#: `client_max_size` of the device app (`http/server.py`). Everything a device
#: POSTs to this API is a control message -- a state report is a fixed 29-key
#: dump, an event report a form with one JSON `content`, a file-info call the
#: metadata of an upload -- while the media and the log archives themselves go
#: to the bucket, which keeps its own 50 MB cap. aiohttp's implicit 1 MiB was
#: never chosen; 16 MiB leaves wide headroom for a firmware that inlines more
#: than a control message usually carries (a thumbnail, a long score list)
#: rather than dropping it, while bounding what one unauthenticated LAN
#: request can make this process hold to a third of the bucket's cap.
DEVICE_MAX_BODY = 16 * 1024 * 1024


async def request_body(request: web.Request) -> bytes:
    """The body `body_middleware` stored, or a direct read where it did not run.

    Never raises: a body that cannot be read is b"", which reads the same as a
    device that sent nothing.
    """
    stored = request.get(REQUEST_BODY)
    if isinstance(stored, bytes):
        return stored
    try:
        return await request.read()
    except Exception:  # noqa: BLE001 - a body we cannot read is a body we ignore
        return b""


@web.middleware
async def body_middleware(request: web.Request, handler: Handler) -> web.StreamResponse:
    """Read the body once and store it, or answer an empty success without handling it."""
    if request.method not in BODY_METHODS:
        return await handler(request)
    try:
        request[REQUEST_BODY] = await request.read()
    except web.HTTPRequestEntityTooLarge:
        reason = "larger than the body limit"
    except Exception as exc:  # noqa: BLE001 - device input never raises
        reason = f"unreadable ({type(exc).__name__})"
    else:
        return await handler(request)

    # Content-Length is the device's own claim and absent when chunked; logged
    # as given, to size the limit by, and trusted for nothing else.
    log.warning("Dropped the body of %s %r from %s: %s (Content-Length %s); answered "
                "empty success, nothing parsed", request.method, request.path,
                request.remote, reason, request.content_length)
    request[BODY_DROPPED] = reason
    return web.json_response({"result": {}})
