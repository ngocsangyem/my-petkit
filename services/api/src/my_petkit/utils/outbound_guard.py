"""The one gate for every connection the server itself opens to a device.

go2rtc's stream source and its probe, the patchers' read-back from the device's
temporary httpd (8888/8889), and the talk sink (9010) all dial an address that
a device reported about itself. A device, or anything that can pose as one on
the LAN, therefore chooses where the server connects — classic SSRF, aimed at
the metadata service, at loopback-only admin ports, or at the internet.

A target is allowed only when BOTH hold:

* it is an IP literal inside a network a device can live on: RFC 1918, IPv6
  ULA (`fc00::/7`), or a WireGuard subnet the operator configured. Loopback,
  link-local (169.254.169.254 among them), multicast and every public address
  are outside all of those;
* it is the address a registered device last reported (`device.state["ip"]`).

The address a request arrived from (`request.remote`) is only ever a hint: it
can become a device's reported address, but it is still checked like any other.
A hostname is never accepted, so there is no DNS answer to rebind. Callers must
also not follow redirects, which would hand the choice of target straight back
to the device.

Lives in `utils/` rather than `shared/` because the protocol core (`media/`,
`patchers/`) may not import `shared/`, while every feature may import `utils/`.
"""

from __future__ import annotations

import ipaddress
import logging
from collections.abc import Callable, Iterable

log = logging.getLogger(__name__)

IPNetwork = ipaddress.IPv4Network | ipaddress.IPv6Network
IPAddress = ipaddress.IPv4Address | ipaddress.IPv6Address

#: Where a device on a home LAN can be. Deliberately not `is_private`, which
#: also admits loopback, link-local and the documentation ranges.
DEVICE_NETWORKS: tuple[IPNetwork, ...] = (
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("fc00::/7"),
)

#: Never reachable through a configured WireGuard subnet either, however wide.
_NEVER: tuple[IPNetwork, ...] = (
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("224.0.0.0/4"),
    ipaddress.ip_network("255.255.255.255/32"),
    ipaddress.ip_network("::/128"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fe80::/10"),
    ipaddress.ip_network("ff00::/8"),
)


class OutboundRefused(RuntimeError):
    """A connection to a device address was refused by the guard.

    A RuntimeError, so callers that already treat a failed device download as
    one keep doing so.
    """


def parse_subnets(values: Iterable[str]) -> tuple[IPNetwork, ...]:
    """CIDR strings as networks. Raises ValueError naming the bad value."""
    networks = []
    for value in values:
        try:
            networks.append(ipaddress.ip_network(str(value).strip(), strict=False))
        except ValueError:
            raise ValueError(f"wireguard_subnets: {value!r} is not a CIDR network") from None
    return tuple(networks)


def _parse_ip(host: object) -> IPAddress | None:
    try:
        ip = ipaddress.ip_address(str(host).strip())
    except ValueError:
        return None
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        return ip.ipv4_mapped
    return ip


class OutboundGuard:
    """The policy: allowed networks plus the live set of reported device IPs."""

    def __init__(
        self, known_ips: Callable[[], Iterable[object]], wireguard_subnets: Iterable[str] = ()
    ) -> None:
        self._known_ips = known_ips
        self._networks = DEVICE_NETWORKS + parse_subnets(wireguard_subnets)

    def refusal(self, host: object) -> str | None:
        """Why `host` may not be dialled, or None when it may."""
        ip = _parse_ip(host)
        if ip is None:
            return "not an IP address"
        if any(ip in net for net in _NEVER):
            return "loopback, link-local, multicast or unspecified address"
        if not any(ip in net for net in self._networks):
            return "outside the private, ULA and configured WireGuard networks"
        try:
            known = {_parse_ip(value) for value in self._known_ips()}
        except Exception as e:  # a registry mid-mutation must not open the gate
            log.warning("outbound guard could not list device addresses: %s", e)
            return "device addresses unavailable"
        if ip not in known:
            return "not the reported address of any registered device"
        return None

    def check(self, host: object) -> str:
        """The canonical IP string for `host`, or OutboundRefused."""
        reason = self.refusal(host)
        if reason is not None:
            raise OutboundRefused(f"refusing to connect to {str(host)[:64]!r}: {reason}")
        return str(_parse_ip(host))


_guard: OutboundGuard | None = None


def configure(guard: OutboundGuard | None) -> None:
    """Install the process-wide guard (startup), or remove it (tests)."""
    global _guard
    _guard = guard


def check_device_target(host: object) -> str:
    """Gate one outbound connection to a device. Raises OutboundRefused.

    Fails closed: with no guard installed every target is refused.
    """
    if _guard is None:
        raise OutboundRefused(f"refusing to connect to {str(host)[:64]!r}: no outbound guard")
    return _guard.check(host)


def device_target_allowed(host: object) -> bool:
    """`check_device_target` as a boolean, for paths polled in a loop.

    The refusal is logged at DEBUG: a reconcile loop would repeat a WARNING
    every few seconds for as long as the device reports the same address.
    """
    try:
        check_device_target(host)
    except OutboundRefused as e:
        log.debug("%s", e)
        return False
    return True


def authority(ip: str) -> str:
    """`ip` as it goes into a URL's host part: an IPv6 literal is bracketed."""
    parsed = _parse_ip(ip)
    return f"[{parsed}]" if isinstance(parsed, ipaddress.IPv6Address) else ip
