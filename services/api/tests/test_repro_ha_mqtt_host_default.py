"""A standalone run with no HA broker configured must not publish to localhost.

The add-on docs say an empty `ha_mqtt_host` disables HA publishing, and
`HAPublisher.__init__` documents that a bare `{}` "starts and immediately opts
out". Both the `Config` default and the publisher's own fallback are
"localhost", so an unconfigured standalone run reconnects to localhost forever.
"""
import asyncio

import pytest

from my_petkit.devices.registry import DeviceRegistry
from my_petkit.ha.publisher import HAPublisher
from my_petkit.main.cli import build_config, parse_args


@pytest.mark.xfail(strict=True, reason="standalone Config defaults ha_mqtt_host to "
                   "'localhost' instead of empty (publishing disabled)")
def test_standalone_run_without_a_broker_leaves_ha_publishing_disabled(tmp_path):
    args = parse_args(["--config", str(tmp_path / "absent.json"),
                       "--data-dir", str(tmp_path)])
    config = build_config(args)
    assert config.ha_mqtt_host == ""


@pytest.mark.xfail(strict=True, reason="HAPublisher falls back to 'localhost' when "
                   "ha_mqtt_host is absent and retries forever instead of opting out")
async def test_publisher_without_a_broker_host_opts_out_without_connecting(monkeypatch):
    aiomqtt = pytest.importorskip("aiomqtt")
    attempts: list[str] = []

    class _RefusingClient:
        def __init__(self, *, hostname, **_kw):
            attempts.append(hostname)
            raise OSError("connection refused")

    monkeypatch.setattr(aiomqtt, "Client", _RefusingClient)
    publisher = HAPublisher(DeviceRegistry(), {})

    try:
        await asyncio.wait_for(publisher.start(), timeout=1.0)
        returned = True
    except asyncio.TimeoutError:
        returned = False

    assert attempts == []
    assert returned
