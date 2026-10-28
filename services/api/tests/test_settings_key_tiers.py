"""A settings write is R3 when it touches proxy mode or capture, R1 otherwise."""

from __future__ import annotations

import pytest

from my_petkit.features.setup.routes import setting_key_tier
from my_petkit.shared.live_settings import LIVE_SETTINGS
from my_petkit.shared.tiers import Tier
from tests.conftest_auth import authed_test_client, bare_panel


@pytest.mark.parametrize("key", sorted(LIVE_SETTINGS))
def test_every_proxy_and_capture_key_is_r3(key):
    assert key.startswith("proxy_") or key == "capture"
    assert setting_key_tier(key) is Tier.R3


def test_any_other_key_is_r1():
    assert setting_key_tier("theme") is Tier.R1


@pytest.mark.parametrize("body", [
    {"capture": True},
    {"proxy_block_run_cmd": False},
    {"proxy_upstream": "eu"},
])
async def test_a_proxy_or_capture_write_needs_a_step_up(tmp_path, body):
    live = {"capture": False, "proxy_block_run_cmd": True, "proxy_upstream": ""}
    client = authed_test_client(bare_panel(tmp_path, live_config=live), step_up=False)
    await client.start_server()
    try:
        r = await client.post("/api/settings", json=body)
        assert r.status == 403
        assert (await r.json())["error"]["code"] == "step_up_required"
        assert live == {"capture": False, "proxy_block_run_cmd": True, "proxy_upstream": ""}
    finally:
        await client.close()


async def test_the_same_write_after_a_step_up_is_applied(tmp_path):
    live = {"capture": False}
    client = authed_test_client(bare_panel(tmp_path, live_config=live), step_up=True)
    await client.start_server()
    try:
        r = await client.post("/api/settings", json={"capture": True})
        assert r.status == 200
        assert live["capture"] is True
    finally:
        await client.close()


async def test_reading_settings_is_not_r3(tmp_path):
    client = authed_test_client(bare_panel(tmp_path, live_config={"capture": False}),
                                step_up=False)
    await client.start_server()
    try:
        assert (await client.get("/api/settings")).status == 200
    finally:
        await client.close()
