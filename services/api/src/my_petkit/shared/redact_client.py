"""Mask credentials in anything the user plane hands a client.

One function, `redact_for_client`, over one key list: `http/redact/rules.py`'s
`CREDENTIAL_KEYS`, the same keys the device-facing redaction already treats as
secret. A second list here would drift from that one the first time a rule
learned a new key.

It walks the value the way `http/redact/walker.py` does — dicts, lists, and
JSON documents that arrived encoded as a string (the hub's `req_body`, an MQTT
`payload`, a capture line) — and masks the value of every credential key. Text
that is not JSON (a device log line, a payload truncated mid-document, a
header rendered as `X-Device: id=..&sign=..`) is masked with a pattern built
from the same keys.

The masked value says how long the original was and nothing else, so a reader
can still tell an empty secret from a real one.
"""

from __future__ import annotations

import json
import re
from typing import Any

from my_petkit.http.redact.rules import CREDENTIAL_KEYS


def _norm(key: str) -> str:
    return key.replace("-", "").replace("_", "").lower()


_KEYS = frozenset(_norm(k) for k in CREDENTIAL_KEYS)

# `key` then `:` or `=` (optionally quoted, optionally spaced), then the value
# up to the next quote, whitespace, comma or closing brace. Keys may be written
# with `-`/`_` anywhere, matching `_norm`.
_KEY_ALTERNATION = "|".join(
    sorted(("[-_]?".join(re.escape(ch) for ch in k) for k in _KEYS), key=len, reverse=True)
)
_TEXT_PATTERN = re.compile(
    rf"(?i)(?<![A-Za-z0-9])((?:{_KEY_ALTERNATION})[\"']?\s*[:=]\s*[\"']?)([^\"'\s,}}]+)"
)


def _mask(value: Any) -> str:
    text = value if isinstance(value, str) else json.dumps(value)
    return f"[redacted {len(text)} chars]"


def _redact_text(text: str) -> str:
    stripped = text.lstrip()
    if stripped[:1] in ("{", "["):
        try:
            inner = json.loads(text)
        except ValueError:
            inner = None
        if isinstance(inner, (dict, list)):
            cleaned = redact_for_client(inner)
            return text if cleaned == inner else json.dumps(cleaned, separators=(",", ":"))
    return _TEXT_PATTERN.sub(lambda m: m.group(1) + _mask(m.group(2)), text)


def is_credential_key(key: object) -> bool:
    """Whether `key` names a credential (`X-Device` and `xdevice` alike)."""
    return isinstance(key, str) and _norm(key) in _KEYS


def redact_for_client(value: Any) -> Any:
    """A copy of `value` with every credential masked. Never mutates the input."""
    if isinstance(value, dict):
        return {
            k: (_mask(v) if is_credential_key(k) and v not in (None, "") else redact_for_client(v))
            for k, v in value.items()
        }
    if isinstance(value, list):
        return [redact_for_client(item) for item in value]
    if isinstance(value, tuple):
        return [redact_for_client(item) for item in value]
    if isinstance(value, str):
        return _redact_text(value)
    return value
