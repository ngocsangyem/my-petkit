"""Serve the web app (`apps/web`, a Vite build) at the root of the user plane.

The app is the document at `/` on a direct connection and at
`/api/hassio_ingress/<token>/` under Home Assistant Ingress, which forwards that
prefix to our `/`. Every URL in the build is relative (`base: './'`) and the app
routes with the URL hash, so the server only ever sees three kinds of request:

* the document (`/`): `no-cache`, because it names the hashed asset files and a
  stale copy would keep asking for the old ones;
* a hashed asset (`assets/<name>-<hash>.<ext>`): cached for a year, since its
  content cannot change under its name;
* any other file at the top of the build (the favicon, `theme-init.js`):
  `no-cache`.

Build files are routed as `/assets/{name}` and `/{name}`: one path segment
each, so neither can shadow an `/api/...` route, and an unknown file is a
plain 404. No fallback to the document for unknown paths: with hash routing
there is no client-side path to fall back for.

`/app` and `/app/` are where the app lived beside the old server-rendered panel.
They answer a permanent redirect to the root, RELATIVE so an Ingress prefix is
kept, and the browser carries the `#/...` fragment of a bookmark across it.

The build is found at `MY_PETKIT_WEB_DIST` when set (the packaged add-on), else
at `apps/web/dist` in a repository checkout. When neither exists the document
answers 404 with a sentence saying how to build it; the API is unaffected.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

from aiohttp import web

from my_petkit.shared.errors import error_response
from my_petkit.shared.tiers import Tier, tier
from my_petkit.shared.web_build import dist_dir
from my_petkit.utils.paths import UnsafePathError, safe_join

#: The app's own policy: no inline script or style at all. `blob:` for images
#: (the face cropper's preview) and media/workers (hls.js feeds the player
#: through Media Source Extensions from a blob worker).
SPA_CSP = (
    "default-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; "
    "worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'self'; "
    "frame-ancestors 'self'"
)
IMMUTABLE = "public, max-age=31536000, immutable"


def _not_built() -> web.Response:
    return error_response(
        404, "web_app_not_built", "The web app is not built: run `pnpm -C apps/web build`."
    )


@tier(GET=Tier.PUBLIC_STATIC)
async def handle_old_mount_redirect(request: web.Request) -> web.StreamResponse:
    """`app` and `app/` moved to the root; relative, so Ingress keeps its prefix.

    Resolved against the request's own URL: `app` sits beside the root document
    (`./`), `app/` one level below it (`../`).
    """
    raise web.HTTPMovedPermanently("../" if request.path.endswith("/") else "./")


def _build_file(name: str) -> Path | None:
    """The resolved file `name` of the build, or None when missing or outside it.

    Synchronous on purpose: the handlers run it in a thread, since `stat` on a
    slow disk must not stall the loop that also answers the devices.
    """
    root = dist_dir()
    try:
        path = Path(safe_join(str(root), name))
    except UnsafePathError:
        return None
    return path if path.is_file() else None


def _is_hashed_asset(path: Path) -> bool:
    """Whether a resolved build file sits in `assets/`, decided on where it is,
    not on how the URL spelled it (`assets/..%2Findex.html` is the document)."""
    return path.parent == (dist_dir() / "assets").resolve()


@tier(GET=Tier.PUBLIC_STATIC)
async def handle_spa_index(request: web.Request) -> web.StreamResponse:
    """The app's document, never reused from a cache without asking."""
    index = await asyncio.to_thread(_build_file, "index.html")
    if index is None:
        return _not_built()
    response = web.FileResponse(index)
    response.headers["Cache-Control"] = "no-cache"
    response.headers["Content-Security-Policy"] = SPA_CSP
    return response


async def _serve_build_file(name: str) -> web.StreamResponse:
    if not await asyncio.to_thread(dist_dir().is_dir):
        return _not_built()
    path = await asyncio.to_thread(_build_file, name)
    if path is None:
        return error_response(404, "not_found", "Not found.")
    hashed = await asyncio.to_thread(_is_hashed_asset, path)
    response = web.FileResponse(path)
    response.headers["Cache-Control"] = IMMUTABLE if hashed else "no-cache"
    response.headers["Content-Security-Policy"] = SPA_CSP
    return response


@tier(GET=Tier.PUBLIC_STATIC)
async def handle_spa_asset(request: web.Request) -> web.StreamResponse:
    """One file of the build's `assets/`; hashed, so cached for good."""
    return await _serve_build_file("assets/" + request.match_info["name"])


@tier(GET=Tier.PUBLIC_STATIC)
async def handle_spa_file(request: web.Request) -> web.StreamResponse:
    """One file at the top of the build (favicon, theme script)."""
    return await _serve_build_file(request.match_info["name"])


def add_spa_routes(app: web.Application) -> None:
    """Register the app at the root, and the redirect from its old mount.

    Called after every `/api/...` route. The one-segment `/{name}` cannot match a
    deeper path whatever the order, but registering it last keeps every literal
    route ahead of it for a reader as well as for the router.
    """
    app.router.add_get("/", handle_spa_index)
    app.router.add_get("/app", handle_old_mount_redirect)
    app.router.add_get("/app/", handle_old_mount_redirect)
    app.router.add_get("/assets/{name}", handle_spa_asset)
    app.router.add_get("/{name}", handle_spa_file)
