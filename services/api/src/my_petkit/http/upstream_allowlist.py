"""The only hosts proxy mode may forward to: PetKit's API servers and Aliyun IoT.

`proxy_upstream` decides where every device request is forwarded, with the
device's own `X-Device` credential attached, and `proxy_dns` decides what those
names resolve to. A free-form value made the server a relay to anywhere: an
internal admin page, the cloud metadata service, an attacker's collector. So a
value is accepted only when its host is one of these, per PetKit region, and is
checked both where the setting is written (`features/setup/routes.py`) and
where it is used (`proxy.forward`, `cloud_fetch.fetch_as_device`, and
`dns.UpstreamResolver`, which resolves nothing else).

The API hosts are `proxy.UPSTREAM_PRESETS` plus `api.eu-pet.com`, the other name
of the EU server. The Aliyun entries are the IoT MQTT endpoints a device of that
region is handed: `{productKey}.iot-as-mqtt.{region}.aliyuncs.com`, and the
Enterprise-instance shape `iot-{id}.mqtt.iothub.aliyuncs.com`.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import urlparse


@dataclass(frozen=True)
class UpstreamRegion:
    """One PetKit region: its API hostnames and its Aliyun IoT region ids."""

    api_hosts: tuple[str, ...]
    aliyun_regions: tuple[str, ...]


UPSTREAM_REGIONS: dict[str, UpstreamRegion] = {
    "eu": UpstreamRegion(("api-eu.petkt.com", "api.eu-pet.com"), ("eu-central-1",)),
    "americas": UpstreamRegion(("api.petkt.com",), ("us-east-1", "us-west-1")),
    "asia": UpstreamRegion(("api.petktasia.com",), ("ap-southeast-1",)),
    "cn": UpstreamRegion(("api.petkit.cn",), ("cn-shanghai",)),
    "ru": UpstreamRegion(("api-ru.petkit.cn",), ()),
}

_API_HOSTS = frozenset(h for r in UPSTREAM_REGIONS.values() for h in r.api_hosts)
_ALIYUN_REGIONS = frozenset(a for r in UPSTREAM_REGIONS.values() for a in r.aliyun_regions)
_ALIYUN_REGIONAL = re.compile(
    r"[a-z0-9]{1,64}\.iot-as-mqtt\.(?P<region>[a-z0-9-]{1,32})\.aliyuncs\.com"
)
_ALIYUN_INSTANCE = re.compile(r"iot-[a-z0-9]{1,64}\.mqtt\.iothub\.aliyuncs\.com")


def is_allowed_upstream_host(host: str | None) -> bool:
    """Whether `host` (a bare hostname, no port) is a PetKit or Aliyun IoT host."""
    if not host:
        return False
    name = host.strip().rstrip(".").lower()
    if name in _API_HOSTS or _ALIYUN_INSTANCE.fullmatch(name):
        return True
    regional = _ALIYUN_REGIONAL.fullmatch(name)
    return bool(regional and regional.group("region") in _ALIYUN_REGIONS)


def is_allowed_upstream_url(url: str) -> bool:
    """Whether `url` is http(s) to an allowed host, with no credentials in it.

    Never raises: a malformed URL (a bad port, an unclosed bracket) is simply
    not allowed.
    """
    try:
        parsed = urlparse((url or "").strip())
        parsed.port  # noqa: B018 - raises ValueError on a malformed port
    except ValueError:
        return False
    if parsed.scheme not in ("http", "https") or parsed.username or parsed.password:
        return False
    return is_allowed_upstream_host(parsed.hostname)
