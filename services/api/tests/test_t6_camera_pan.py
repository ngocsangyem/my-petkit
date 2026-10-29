"""T6 camera pan: opt-in buttons that drive the firmware's pktool over run_cmd.

The run_cmd path is root on the device, so most of what is pinned here is that
only the three fixed shell lines can ever reach it - not the raw panel form,
not a line the pan code did not build - and that the buttons exist only on a
T6 whose operator applied the Camera Pan patcher.
"""
import json

import pytest
from aiohttp import web

from my_petkit.devices.ble import BLERegistry
from my_petkit.devices.registry import DeviceRegistry
from my_petkit.ha.categories import get_entities_for_device
from my_petkit.ha.commands import RUN_CMD_SUFFIX, Refused, handle_ha_command
from my_petkit.ha.publisher import HAPublisher
from my_petkit.patchers import pan
from my_petkit.shared.panel_request import _deliver
from my_petkit.web.hub import EventHub
from my_petkit.web.panel import create_panel_app
from tests._fakes import FakeMessage, FakeMqttClient
from tests.conftest_auth import authed_test_client

PANEL_CFG = {"api_url": "http://x/6/", "capture": False, "capture_dir": "/nope"}
PAN_KEYS = ("pan_left", "pan_right", "pan_home")
GUARD = ("case \"$(md5sum /app/bin/pktool)\" in 626fce2bb4febf259e2a8490af3c17b5*) "
         "s=$(cd /app/bin && export LD_LIBRARY_PATH=/app/bin:/syslib/lib:/system/alg_lib"
         " && ./pktool motor_test 4 | grep -m 1 coord0=); c=${s#coord0=}; c=${c%%,*};"
         " t=${s##*target0=}; [ -n \"$c\" ] && [ \"$c\" = \"$t\" ] && cd /app/bin"
         " && export LD_LIBRARY_PATH=/app/bin:/syslib/lib:/system/alg_lib"
         " && ./pktool motor_test")
VERIFY_OK = "626fce2bb4febf259e2a8490af3c17b5  /app/bin/pktool\n2500"


def _registry(device_type: str = "t6", opted_in: bool = True) -> DeviceRegistry:
    reg = DeviceRegistry()
    dev = reg.get_or_create(petkit_id=1, device_type=device_type, serial_number="SN")
    if opted_in:
        dev.config["active_patchers"] = [pan.PATCHER_ID]
    return reg


def _queued_run_cmds(dev) -> list[str]:
    return [json.loads(c)["user_cmd"]["run_cmd"] for c in dev.command_queue
            if isinstance(c, str)]


def _button(dev, key):
    return next(e for e in get_entities_for_device(dev) if e.key == key)


def test_the_buttons_appear_only_on_an_opted_in_t6():
    keys = lambda dev: {e.key for e in get_entities_for_device(dev)}  # noqa: E731
    assert set(PAN_KEYS) <= keys(_registry("t6").get(1))
    assert not set(PAN_KEYS) & keys(_registry("t6", opted_in=False).get(1))
    # A recorded opt-in on a model with no pan motor publishes nothing.
    assert not set(PAN_KEYS) & keys(_registry("t5").get(1))


def test_the_pan_buttons_are_appended_after_every_existing_t6_entity():
    plain = get_entities_for_device(_registry("t6", opted_in=False).get(1))
    opted = get_entities_for_device(_registry("t6").get(1))
    assert opted[:len(plain)] == plain
    assert [e.key for e in opted[len(plain):]] == list(PAN_KEYS)


def test_each_button_sends_its_exact_fixed_shell_line():
    dev = _registry().get(1)
    expected = {"pan_left": f"{GUARD} 2 -250;; esac", "pan_right": f"{GUARD} 2 250;; esac",
                "pan_home": f"{GUARD} 3 2500;; esac"}
    for key, line in expected.items():
        assert handle_ha_command(dev, _button(dev, key), "") == (RUN_CMD_SUFFIX, {"run_cmd": line})


def test_a_pan_is_refused_without_the_patcher():
    reg = _registry()
    dev = reg.get(1)
    entity = _button(dev, "pan_left")
    dev.config["active_patchers"] = []
    with pytest.raises(Refused):
        handle_ha_command(dev, entity, "")


def test_a_pan_is_refused_while_the_camera_is_off():
    dev = _registry().get(1)
    dev.config.setdefault("settings", {})["camera"] = 0
    with pytest.raises(Refused, match="camera is off"):
        handle_ha_command(dev, _button(dev, "pan_home"), "")


async def test_only_a_pan_line_reaches_run_cmd():
    dev = _registry().get(1)
    for envelope in ({"run_cmd": "reboot"}, {"run_cmd": pan.PAN_COMMANDS["pan_left"] + "; reboot"},
                     "pan_left", {"suffix": RUN_CMD_SUFFIX}):
        with pytest.raises(ValueError):
            await pan.send_pan_command(dev, envelope)
    assert dev.command_queue == []

    assert await pan.send_pan_command(dev, {"run_cmd": pan.PAN_COMMANDS["pan_left"]}) == "heartbeat"
    assert _queued_run_cmds(dev) == [pan.PAN_COMMANDS["pan_left"]]


@pytest.mark.parametrize("output, problem", [
    (VERIFY_OK, ""),
    (None, "did not answer"),
    ("0123456789abcdef0123456789abcdef  /app/bin/pktool\n2500", "pktool"),
    ("626fce2bb4febf259e2a8490af3c17b5  /app/bin/pktool\n4000", "travel"),
    ("", "pktool"),
], ids=["known-build", "no-answer", "other-pktool", "other-travel", "empty"])
def test_the_firmware_check_accepts_only_the_build_the_commands_came_from(output, problem):
    found = pan.verify_problem(output)
    assert (problem in found) if problem else found == ""


async def _panel_post(reg: DeviceRegistry, path: str, body: dict) -> tuple[int, dict]:
    app = create_panel_app(reg, BLERegistry(), EventHub(), dict(PANEL_CFG), None)
    client = authed_test_client(app)
    await client.start_server()
    try:
        r = await client.post(path, json=body)
        return r.status, await r.json()
    finally:
        await client.close()


async def test_the_panel_action_sends_the_pan_line_over_run_cmd():
    reg = _registry()
    status, body = await _panel_post(reg, "/api/devices/1/command", {"action": "pan_right"})
    assert status == 200
    assert body["suffix"] == RUN_CMD_SUFFIX and body["delivered"] == "heartbeat-queue"
    assert _queued_run_cmds(reg.get(1)) == [pan.PAN_COMMANDS["pan_right"]]


async def test_the_raw_panel_form_cannot_name_the_run_cmd_suffix():
    reg = _registry()
    status, _body = await _panel_post(reg, "/api/devices/1/command", {
        "suffix": RUN_CMD_SUFFIX, "payload": {"run_cmd": pan.PAN_COMMANDS["pan_home"]}})
    assert status == 400
    assert reg.get(1).command_queue == []


async def test_the_shared_delivery_helper_refuses_the_run_cmd_suffix():
    dev = _registry().get(1)
    with pytest.raises(web.HTTPBadRequest):
        await _deliver(EventHub(), None, dev, RUN_CMD_SUFFIX, {"run_cmd": "reboot"})
    assert dev.command_queue == []


async def _ha_press(dev_settings: dict | None = None):
    reg = _registry()
    dev = reg.get(1)
    if dev_settings:
        dev.config.setdefault("settings", {}).update(dev_settings)
    pub = HAPublisher(reg, {})
    pub._client = FakeMqttClient()
    pub._connected = True
    await pub.publish_discovery(dev)
    suffix = next(s for s, e in pub._commands._entity_index[1].items() if e.key == "pan_left")
    await pub._commands.handle_command(FakeMessage(f"my-petkit/1/cmd/{suffix}", b"pan_left"))
    return dev


async def test_a_home_assistant_press_sends_the_pan_line_over_run_cmd():
    dev = await _ha_press()
    assert _queued_run_cmds(dev) == [pan.PAN_COMMANDS["pan_left"]]


async def test_a_home_assistant_press_with_the_camera_off_sends_nothing():
    dev = await _ha_press({"camera": 0})
    assert dev.command_queue == []


async def test_retiring_the_pan_buttons_clears_their_discovery():
    reg = _registry()
    pub = HAPublisher(reg, {})
    pub._client = FakeMqttClient()
    pub._connected = True
    await pub.retire_entities(reg.get(1), [_button(reg.get(1), k) for k in PAN_KEYS])
    cleared = [(t, p) for t, p, _kw in pub._client.published]
    assert len(cleared) == 3
    assert all(p == "" and any(k in t for k in PAN_KEYS) for t, p in cleared)


async def test_the_patcher_is_unavailable_and_refused_off_the_t6():
    reg = _registry("t5", opted_in=False)
    reg.get(1).state["ip"] = "192.168.1.13"
    app = create_panel_app(reg, BLERegistry(), EventHub(), dict(PANEL_CFG), None)
    client = authed_test_client(app)
    await client.start_server()
    try:
        status = await (await client.get("/api/devices/1/patcher")).json()
        assert status["patchers"][pan.PATCHER_ID]["unavailable"]
        r = await client.post("/api/devices/1/patcher",
                              json={"patcher": pan.PATCHER_ID, "action": "apply"})
        assert r.status == 400
    finally:
        await client.close()
    assert reg.get(1).command_queue == []


@pytest.mark.parametrize("output, applied", [(VERIFY_OK, True), (None, False),
                                             ("0123  /app/bin/pktool\n2500", False)],
                         ids=["known-build", "no-answer", "other-pktool"])
async def test_applying_records_the_opt_in_only_when_the_firmware_checks_out(
        monkeypatch, output, applied):
    from my_petkit.features.patchers import routes

    async def fake_capture(device, device_ip, command, **kw):
        assert command == pan.VERIFY_COMMAND
        return output

    monkeypatch.setattr(routes, "run_cmd_capture", fake_capture)
    reg = _registry(opted_in=False)
    dev = reg.get(1)
    hub = EventHub()
    app = web.Application()
    app[routes.REGISTRY] = reg
    await routes._patcher_apply(dev, "pan", "192.168.1.13", "http://x", hub, app)
    assert (pan.PATCHER_ID in dev.config.get("active_patchers", [])) is applied
    # Nothing is written to the device and it is never rebooted.
    assert dev.command_queue == []


async def test_removing_drops_the_opt_in_and_says_done_without_a_reboot():
    from my_petkit.features.patchers import routes

    reg = _registry()
    dev = reg.get(1)
    hub = EventHub()
    lines = []
    hub.publish = lambda kind, did, msg: lines.append(msg)
    app = web.Application()
    app[routes.REGISTRY] = reg
    await routes._patcher_remove(dev, "pan", "192.168.1.13", "http://x", hub, app)
    assert pan.PATCHER_ID not in dev.config["active_patchers"]
    assert not set(PAN_KEYS) & {e.key for e in get_entities_for_device(dev)}
    # Clients end a run on a line containing "done".
    assert "done" in lines[-1]
    assert dev.command_queue == []
