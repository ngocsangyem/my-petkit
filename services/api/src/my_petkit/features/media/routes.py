"""Serving the friendly media tree, and deciding what is ready to play.

Two jobs. The routes hand out one file or one thumbnail, with every path built
from request input going through `utils/paths.safe_join` and every rejection
answering 404. The rest is the role -> slot mapping the Timeline renders from:
which of an episode's uploads is the playable recording, which is the poster,
and whether a chunked video has been stitched yet or is still assembling.
"""
from __future__ import annotations

import hashlib
import logging
import os
import tempfile

from aiohttp import web

from my_petkit.media.transcode import THUMB_TIMEOUT, have_ffmpeg, run_ffmpeg
from my_petkit.utils.paths import UnsafePathError, safe_join
from my_petkit.shared.appkeys import CFG

log = logging.getLogger(__name__)


def _safe_media_path(request: web.Request, rel_path: str) -> str | None:
    """Resolve `rel_path` under the friendly media root, or None.

    Containment (`..`, absolute paths, symlink escapes) is `safe_join`'s job;
    what stays here is this endpoint's own contract: an unconfigured media root
    serves nothing (`safe_join` would happily resolve against the process CWD),
    the result must be an existing regular file, and a rejection is a 404 rather
    than an exception.

    Containment alone is not enough: the device bucket stages undecrypted
    uploads, and the stitcher its work files, in `{media_root}/.raw`, and
    thumbnails are written through `.thumb.*` temp files. Nothing the user
    plane serves is dot-prefixed, so any hidden component of the RESOLVED path
    is refused — checked after `safe_join`, so no URL spelling (`%2E`, an
    encoded slash, a `..` hop, a symlink) can route around it.
    """
    media_root = request.app[CFG].get("media_root", "")
    if not media_root or not rel_path:
        return None
    try:
        candidate = safe_join(media_root, rel_path)
    except UnsafePathError:
        return None
    inside = os.path.relpath(candidate, os.path.realpath(media_root))
    if any(part.startswith(".") for part in inside.split(os.sep) if part != os.curdir):
        return None
    return candidate if os.path.isfile(candidate) else None


async def api_media_file(request: web.Request) -> web.StreamResponse:
    """Serve one file from the friendly media tree.

    The path is relative to the media root — the same form the timeline hands
    out. 404 covers both "missing" and "rejected", so a probe cannot tell the
    two apart.
    """
    p = _safe_media_path(request, request.match_info["path"])
    if not p:
        return web.json_response({"error": "not found"}, status=404)
    return web.FileResponse(p)


async def _generate_video_thumb(video_path: str, thumb_path: str) -> bool:
    """Grab one frame from `video_path` into `thumb_path`; True if it worked.

    ffmpeg writes to a temp file in the destination directory which is then
    renamed into place, so `thumb_path` only ever exists complete. The Timeline
    renders a whole day at once, so several requests for the same not-yet-made
    thumbnail arrive together; letting them all write the final path directly
    means one request can serve a half-written JPEG. Renaming is preferred over
    a per-path asyncio.Lock because it needs no shared state to keep correct
    (the runs are equivalent, so last-writer-wins is fine) and it also survives
    the process being killed mid-encode.
    """
    # The temp file must share a filesystem with the target for os.replace to
    # be atomic, so it goes in the same directory.
    fd, tmp_path = tempfile.mkstemp(dir=os.path.dirname(thumb_path) or ".",
                                    prefix=".thumb.", suffix=".jpg")
    os.close(fd)  # ffmpeg opens the path itself; the extension picks the muxer
    try:
        rc, _, _ = await run_ffmpeg(
            ["ffmpeg", "-y", "-i", video_path, "-frames:v", "1", "-vf", "thumbnail", tmp_path],
            timeout=THUMB_TIMEOUT, what=video_path)
        if rc != 0 or not os.path.getsize(tmp_path):
            return False
        os.replace(tmp_path, thumb_path)
        return True
    except OSError as e:
        log.warning("panel: thumbnail generation failed for %s: %s", video_path, e)
        return False
    finally:
        # os.replace consumed the temp file on success; on every other path
        # (including cancellation) it is still there.
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


async def api_media_thumb(request: web.Request) -> web.StreamResponse:
    """Serve a thumbnail for a media path: the image itself for stills, or a
    cached frame grab for video.

    Grabs are cached under `{data_dir}/thumbs` keyed by a hash of the source
    path, so the Timeline re-rendering a day costs one ffmpeg run per clip
    total, not per request. Every "no thumbnail" outcome answers 404, including
    a failed grab: that is the only status the UI has a fallback for
    (`hide-on-error`), and a 500 leaves a broken tile where the poster still
    would have gone.
    """
    p = _safe_media_path(request, request.match_info["path"])
    if not p:
        return web.json_response({"error": "not found"}, status=404)

    if p.lower().endswith((".jpg", ".jpeg", ".png")):
        return web.FileResponse(p)  # the browser downsizes via CSS — no separate pipeline needed

    if not have_ffmpeg():
        return web.json_response({"error": "ffmpeg not available for video thumbnails"}, status=404)

    data_dir = request.app[CFG].get("data_dir", "/data")
    thumbs_dir = os.path.join(data_dir, "thumbs")
    thumb_path = os.path.join(thumbs_dir, hashlib.sha1(p.encode()).hexdigest() + ".jpg")

    if not os.path.isfile(thumb_path):
        os.makedirs(thumbs_dir, exist_ok=True)
        if not await _generate_video_thumb(p, thumb_path):
            return web.json_response({"error": "thumbnail generation failed"}, status=404)

    return web.FileResponse(thumb_path)
