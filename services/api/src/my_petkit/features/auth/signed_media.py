"""Signed media URLs: `?exp=&sig=` for players that cannot send a token.

`AVPlayer`, an `<img>` and an HLS client fetch media themselves and will not
attach an `Authorization` header, so the media routes accept a URL signed for
exactly one path instead: `sig = HMAC-SHA256(key, path + "\\n" + exp)`, valid
for five minutes. The signature is bound to the decoded request path, so it
cannot be moved to another file, and a Range request is verified by the same
middleware check as the first one — it is just another request for the path.

An HLS playlist names its segments by relative URL, and a player never carries
the playlist's own query string over to them, so a playlist served under a
signature has every URI in it re-signed (`sign_playlist`).

`sig` is a bearer credential for its five minutes, so the panel's access log
masks it (`SignatureMaskingAccessLogger`).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import posixpath
import re
import time
from collections.abc import Callable, Iterable
from typing import Any
from urllib.parse import quote, unquote

from aiohttp.web_log import AccessLogger

SIGNED_URL_TTL_SECONDS = 300
#: The only path prefix a signature is ever issued for.
SIGNABLE_PREFIX = "/api/media/"
_MAX_SIG_LENGTH = 64
_SIG_IN_TEXT = re.compile(r"([?&]sig=)[^&\s\"]*")
_URI_ATTRIBUTE = re.compile(r'URI="([^"]+)"')


class MediaSigner:
    """Issue and verify path-bound signatures."""

    def __init__(self, key: bytes, clock: Callable[[], float] = time.time) -> None:
        self._key = key
        self._clock = clock

    def _sig(self, path: str, exp: int) -> str:
        mac = hmac.new(self._key, f"{path}\n{exp}".encode(), hashlib.sha256).digest()
        return base64.urlsafe_b64encode(mac).rstrip(b"=").decode()

    def query(self, path: str, ttl: int = SIGNED_URL_TTL_SECONDS) -> str:
        """`exp=..&sig=..` for `path` (a decoded, absolute request path)."""
        exp = int(self._clock()) + ttl
        return f"exp={exp}&sig={self._sig(path, exp)}"

    def signed_url(self, path: str, ttl: int = SIGNED_URL_TTL_SECONDS) -> str:
        """The path, percent-encoded, with its signature attached."""
        return f"{quote(path)}?{self.query(path, ttl)}"

    def verify(self, path: str, exp: str | None, sig: str | None) -> bool:
        """Whether `sig` signs `path` until `exp`, and `exp` has not passed."""
        if not exp or not sig or len(sig) > _MAX_SIG_LENGTH or not exp.isdigit():
            return False
        if not path.startswith(SIGNABLE_PREFIX):
            return False
        expires = int(exp)
        if expires < self._clock():
            return False
        return hmac.compare_digest(sig, self._sig(path, expires))

    def sign_playlist(self, text: str, playlist_path: str) -> str:
        """Re-sign every relative URI in an HLS playlist served from `playlist_path`."""
        base = posixpath.dirname(playlist_path)

        def signed(uri: str) -> str:
            if "://" in uri or uri.startswith("/"):
                return uri
            relative = uri.split("?", 1)[0]
            target = posixpath.normpath(posixpath.join(base, unquote(relative)))
            if not target.startswith(SIGNABLE_PREFIX):
                return uri
            # The URI stays as the playlist wrote it; only the query is ours.
            return f"{relative}?{self.query(target)}"

        lines = []
        for line in text.splitlines():
            stripped = line.strip()
            if not stripped:
                lines.append(line)
            elif stripped.startswith("#"):
                lines.append(_URI_ATTRIBUTE.sub(lambda m: f'URI="{signed(m.group(1))}"', line))
            else:
                lines.append(signed(stripped))
        return "\n".join(lines) + ("\n" if text.endswith("\n") else "")


def mask_signature(text: str) -> str:
    """`text` with the value of every `sig=` query parameter masked."""
    return _SIG_IN_TEXT.sub(r"\1[masked]", text)


class SignatureMaskingAccessLogger(AccessLogger):
    """The default access log, with `sig=` masked in every field it writes."""

    def _format_line(self, request: Any, response: Any, time: float) -> Iterable[tuple[Any, Any]]:
        return [
            (key, mask_signature(value) if isinstance(value, str) else value)
            for key, value in super()._format_line(request, response, time)
        ]
