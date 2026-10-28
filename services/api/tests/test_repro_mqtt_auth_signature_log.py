"""A failed MQTT CONNECT must not write any part of a valid signature to the log.

On a sign mismatch `AliyunAuthPlugin.authenticate` logs the first 16 hex chars
of the EXPECTED HMAC (and of the password received), in both strict and
non-strict mode. The expected value is the device's valid credential for that
timestamp; 64 bits of it in a log is a credential leak.
"""
import logging

import pytest
from amqtt.contexts import BaseContext

from my_petkit.devices.registry import DeviceRegistry
from my_petkit.mqtt.auth import AliyunAuthPlugin, compute_aliyun_sign


class _Session:
    pass


@pytest.mark.xfail(strict=True, reason="sign mismatch logs expected_sign[:16], a fragment "
                   "of the device's valid HMAC")
@pytest.mark.parametrize("strict", [False, True])
async def test_sign_mismatch_does_not_log_the_expected_signature(caplog, strict):
    reg = DeviceRegistry()
    dev = reg.get_or_create(100, "t5", serial_number="SN100")
    dev.mqtt_product_key = "a1PK"
    dev.mqtt_device_name = "d_t5_SN100"
    plugin = AliyunAuthPlugin(BaseContext())
    plugin.set_registry(reg)
    plugin.set_strict(strict)

    expected = compute_aliyun_sign(dev.mqtt_device_secret, "a1PK.d_t5_SN100",
                                   "d_t5_SN100", "a1PK", "1")
    s = _Session()
    s.client_id = "a1PK.d_t5_SN100|timestamp=1,signmethod=hmacsha256|"
    s.username = "d_t5_SN100&a1PK"
    s.password = "0" * 64

    with caplog.at_level(logging.DEBUG):
        await plugin.authenticate(session=s)

    assert "mismatch" in caplog.text or "FAILED" in caplog.text
    assert expected[:8] not in caplog.text
