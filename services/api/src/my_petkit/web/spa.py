"""Serve the web app (`apps/web`, a Vite build) beside the legacy panel.

The app is mounted at `app/` under wherever the panel itself is mounted: `/app/`
on a direct connection, `/api/hassio_ingress/<token>/app/` under Home Assistant
Ingress. Every URL in the build is relative (`base: './'`) and the app routes
with the URL hash, so the server only ever sees three kinds of request:

* the document (`app/`): `no-cache`, because it names the hashed asset files and
  a stale copy would keep asking for the old ones;
* a hashed asset (`app/assets/<name>-<hash>.<ext>`): cached for a year, since its
  content cannot change under its name;
* anything else in the build (the favicon): `no-cache`.

No fallback to the document for unknown paths: with hash routing there is no
client-side path to fall back for, and a 404 says plainly that a file is missing.

The build is found at `MY_PETKIT_WEB_DIST` when set (the packaged add-on), else
at `apps/web/dist` in a repository checkout. When neither exists the routes
answer 404 with a sentence saying how to build it, and the legacy panel at `/`
is unaffected.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

from aiohttp import web

from my_petkit.shared.errors import error_response
from my_petkit.shared.web_build import dist_dir
from my_petkit.shared.tiers import Tier, tier
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
async def handle_spa_redirect(request: web.Request) -> web.StreamResponse:
    """`app` without the slash: relative URLs only resolve under `app/`."""
    raise web.HTTPFound("app/")


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


@tier(GET=Tier.PUBLIC_STATIC)
async def handle_spa_file(request: web.Request) -> web.StreamResponse:
    """One file of the build; hashed assets are cached for good."""
    name = request.match_info["path"]
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


def add_spa_routes(app: web.Application) -> None:
    """Register the app under `app/`, beside the legacy panel at `/`."""
    app.router.add_get("/app", handle_spa_redirect)
    app.router.add_get("/app/", handle_spa_index)
    app.router.add_get("/app/{path:.+}", handle_spa_file)
