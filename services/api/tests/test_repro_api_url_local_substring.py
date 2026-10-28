"""An explicit add-on `api_url` is discarded only for a real mDNS `.local` host.

`from_ha_addon` tests `".local" in api_opt`, a substring match over the whole
URL, so a routable host that merely contains ".local" (or a path that does) is
thrown away and replaced by the auto-detected Supervisor IP.
"""
import os

import pytest

import my_petkit.config as config_mod
from my_petkit.config import Config


def _from_ha_addon(monkeypatch, options: dict, host_ip: str) -> Config:
    monkeypatch.delenv("SUPERVISOR_TOKEN", raising=False)

    def fake_read_json(path, default):
        return options if os.path.basename(str(path)) == "options.json" else default

    monkeypatch.setattr(config_mod, "read_json", fake_read_json)
    monkeypatch.setattr(config_mod, "_supervisor_host_ip", lambda: host_ip)
    monkeypatch.setattr(config_mod, "_supervisor_port_map", lambda: {})
    return Config.from_ha_addon()


def test_an_mdns_local_api_url_is_still_replaced_by_the_host_ip(monkeypatch):
    c = _from_ha_addon(monkeypatch, {"api_url": "http://homeassistant.local/6/"},
                       host_ip="192.168.1.5")
    assert c.api_url == "http://192.168.1.5/6/"


@pytest.mark.xfail(strict=True, reason="api_url is replaced whenever '.local' appears "
                   "anywhere in it, not only for an mDNS .local host")
@pytest.mark.parametrize("api_url", [
    "http://my.localdomain.net/6/",
    "http://petkit.localnet:8080/6/",
    "http://10.0.0.7/.local/6/",
])
def test_an_explicit_api_url_merely_containing_dot_local_is_kept(monkeypatch, api_url):
    c = _from_ha_addon(monkeypatch, {"api_url": api_url}, host_ip="192.168.1.5")
    assert c.api_url == api_url
