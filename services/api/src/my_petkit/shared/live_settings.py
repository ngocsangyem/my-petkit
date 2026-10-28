"""The panel's live runtime settings: which keys exist and what they read now.

Owned conceptually by the Setup feature, which validates and writes them; kept
here because the logs feature reports the capture switch too, and features do
not import one another.
"""
from __future__ import annotations

from typing import Any

from aiohttp import web

from my_petkit.shared.appkeys import CFG
from my_petkit.shared.panel_request import _live

# Runtime settings the panel may flip live. Each is read per-request from the
# shared app config (or applied via a setter), so no restart is needed. Value is
# the coercion type.
#
# These are the ONLY control surface for proxy mode and capture: neither has an
# add-on option or a CLI flag any more. Every key here must also appear in
# `config.PANEL_LIVE_KEYS`, or it is written now and dropped at the next start.
LIVE_SETTINGS = {
    "proxy_mode": bool,
    "proxy_upstream": str,
    "proxy_dns": str,
    "proxy_block_run_cmd": bool,
    "proxy_block_ota": bool,
    "proxy_block_log_upload": bool,
    "proxy_media_real_oss": bool,
    "proxy_local_cvr_window": bool,
    "proxy_mqtt_bridge": bool,
    "proxy_only": str,
    "capture": bool,
}

#: Defaults for `LIVE_SETTINGS`, used when the shared config has no value yet.
#: Both guards default ON: proxy mode is a debugging tool, and a debugging tool
#: that lets the cloud run a command or push firmware is a liability.
LIVE_SETTING_DEFAULTS = {
    "proxy_mode": False,
    "proxy_upstream": "",
    "proxy_dns": "",
    "proxy_block_run_cmd": True,
    "proxy_block_ota": True,
    "proxy_block_log_upload": True,
    "proxy_media_real_oss": False,
    "proxy_local_cvr_window": False,
    "proxy_mqtt_bridge": True,
    "proxy_only": "",
    "capture": False,
}


def _current_settings(request: web.Request) -> dict[str, Any]:
    """The `LIVE_SETTINGS` values as they are right now, all keys always present.

    `capture` alone falls back to the static panel config as well as the
    default, because it is the one setting that also existed before the shared
    live config did.
    """
    live = _live(request)
    cfg = request.app[CFG]
    fallbacks = dict(LIVE_SETTING_DEFAULTS)
    fallbacks["capture"] = bool(cfg.get("capture", False))

    settings = {}
    for key, typ in LIVE_SETTINGS.items():
        value = live.get(key, fallbacks[key])
        settings[key] = bool(value) if typ is bool else (value or "")
    return settings
