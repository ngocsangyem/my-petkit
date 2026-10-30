"""Tests for the web panel (EventHub + Ingress JSON API)."""
import asyncio
import json
import logging
import os
import re
import tempfile
from pathlib import Path

import pytest

from aiohttp.test_utils import make_mocked_request

from my_petkit.config import PANEL_LIVE_KEYS
from my_petkit.devices.registry import DeviceRegistry
from my_petkit.devices.ble import BLERegistry
from my_petkit.ha.categories import get_entities_for_device
from my_petkit.ha.commands import ALL_ACTIONS
from my_petkit.web.hub import EventHub
from my_petkit.shared.live_settings import LIVE_SETTINGS
from my_petkit.web.panel import create_panel_app
from tests.conftest_auth import authed_test_client


# --- panel API ---

class FakeBridge:
    def __init__(self, connected=False):
        self._client = object() if connected else None
        self.sent = []

    async def publish_to_device(self, device, suffix, payload):
        self.sent.append((device.petkit_id, suffix, payload))


def _panel(reg=None, ble=None, bridge=None, cfg=None):
    reg = reg or DeviceRegistry()
    ble = ble or BLERegistry()
    hub = EventHub()
    cfg = cfg or {"api_url": "http://x/6/", "mqtt_tls": True,
                  "mqtt_tls_port": 443,
                  "capture": False, "capture_dir": "/nope"}
    return create_panel_app(reg, ble, hub, cfg, bridge), reg, hub


async def _mk_client(app):
    c = authed_test_client(app)
    await c.start_server()
    return c


def test_every_published_entity_component_has_somewhere_to_render():
    """The anti-divergence check. `text`, `event`, `camera` and `image` entities
    were published to Home Assistant and rendered nowhere in the panel, which is
    invisible until someone goes looking for a schedule editor that does not
    exist. Any NEW component must be routed too: the web app's `ENTITY_SECTION`
    names a section for each one."""
    from my_petkit.devices.ble import BLE_TYPES
    from my_petkit.ha.entities.ble import get_ble_entities
    from my_petkit.ha.categories import CATEGORY_SPECS

    published = {e.component for spec in CATEGORY_SPECS.values()
                 for e in spec.entities_for(True)}
    # BLE accessories publish to HA through a different table entirely
    # (`get_ble_entities`), and this guard used to look only at the device one.
    # A CTW3 brought switches, selects and numbers in through that gap.
    published |= {e.component for t in BLE_TYPES for e in get_ble_entities(t)}
    table = _web_source("features/devices/lib/entity-sections.ts")
    table = table[table.index("export const ENTITY_SECTION"):]
    table = table[: table.index("};")]
    for component in sorted(published):
        assert re.search(rf"^\s*['\"]?{component}['\"]?\s*:", table, re.M), (
            f"{component} entities are published to HA but ENTITY_SECTION "
            f"in entity-sections.ts does not route them to a section"
        )


def test_the_accessory_panel_renders_every_component_an_accessory_has():
    """`ENTITY_SECTION` routes a device panel. An accessory has its own
    renderer, `AccessoryPanelBody`, which picks components by name into three
    cards — so a component that reaches HA fine can still land nowhere here. The
    filter reset was the first: `button` was routed by ENTITY_SECTION and
    dropped by the accessory body, which knew only switch, number, select and
    the two sensors."""
    from my_petkit.devices.ble import BLE_TYPES
    from my_petkit.ha.entities.ble import get_ble_entities

    body = _web_source("features/devices/components/accessory-panel-body.tsx")
    for t in BLE_TYPES:
        for e in get_ble_entities(t):
            assert re.search(rf"""['"]{e.component}['"]""", body), (
                f"a {t} publishes a {e.component} entity and the accessory "
                f"panel has no card that collects one"
            )


async def test_device_detail_answers_in_one_request():
    """The sidecars are folded in, so a panel refresh is one round trip. They
    must stay identical to their standalone endpoints, which the API still
    exposes."""
    reg = DeviceRegistry()
    reg.get_or_create(petkit_id=7, device_type="t5", serial_number="SN7")
    app, reg, hub = _panel(reg=reg)
    c = await _mk_client(app)
    try:
        detail = await (await c.get("/api/devices/7")).json()
        assert detail["capInfo"] == await (await c.get("/api/devices/7/capabilities")).json()
        assert detail["logInfo"] == await (await c.get("/api/devices/7/logs")).json()
        assert detail["aiInfo"] == await (await c.get("/api/devices/7/ai")).json()
        # Grouping config/diagnostic the way HA does needs this on every entity.
        assert all("entity_category" in e for e in detail["entities"])
    finally:
        await c.close()


async def test_a_device_with_no_camera_or_ai_gets_null_sidecars():
    reg = DeviceRegistry()
    reg.get_or_create(petkit_id=8, device_type="t4", serial_number="SN8")
    app, reg, hub = _panel(reg=reg)
    c = await _mk_client(app)
    try:
        detail = await (await c.get("/api/devices/8")).json()
        assert detail["capInfo"] is None and detail["aiInfo"] is None
        assert detail["logInfo"] is not None
    finally:
        await c.close()


async def test_info_and_devices():
    reg = DeviceRegistry()
    reg.get_or_create(petkit_id=1, device_type="t5", serial_number="SN")
    app, reg, hub = _panel(reg=reg)
    c = await _mk_client(app)
    try:
        info = await (await c.get("/api/info")).json()
        assert info["mqtt_tls"] is True and info["device_count"] == 1
        devs = await (await c.get("/api/devices")).json()
        assert devs[0]["id"] == 1 and devs[0]["type"] == "t5"
        detail = await (await c.get("/api/devices/1")).json()
        assert "state" in detail and "settings" in detail
        assert any(a["key"] == "cleaning_start" for a in detail["actions"])
    finally:
        await c.close()


async def test_only_costly_actions_are_flagged_destructive_and_they_sort_last():
    """`destructive` drives three things at once: the red styling, the confirm
    dialog, and the ordering. So it has to mean "costs something you cannot get
    back", not "moves the motor".

    `reset` and `maintenance_stop` used to be in the set and are the clearest
    case against it: both are `thing.service.end`, the verbs that STOP whatever
    is running and put the box back in service. Making the recovery button look
    and behave exactly like the one you are recovering from is backwards, and
    it put two red buttons in the middle of a row of eleven.
    """
    from my_petkit.devices.registry import DeviceRegistry
    reg = DeviceRegistry()
    reg.get_or_create(petkit_id=1, device_type="t5", serial_number="SN")
    app, reg, hub = _panel(reg=reg)
    c = await _mk_client(app)
    try:
        actions = (await (await c.get("/api/devices/1")).json())["actions"]
        red = {a["key"] for a in actions if a["destructive"]}
        assert red == {"dump_litter", "maintenance_start", "reset_n50", "reset_n60"}

        # Recovery verbs must stay safe-looking and un-confirmed.
        safe = {a["key"] for a in actions if not a["destructive"]}
        assert {"reset", "maintenance_stop", "cleaning_start", "resume"} <= safe

        # Destructive last, so a mis-click lands on something harmless.
        flags = [a["destructive"] for a in actions]
        assert flags == sorted(flags), f"destructive actions are interleaved: {flags}"
    finally:
        await c.close()


async def test_command_sender_queues_without_bridge():
    reg = DeviceRegistry()
    reg.get_or_create(petkit_id=1, device_type="t5", serial_number="SN")
    app, reg, hub = _panel(reg=reg, bridge=None)
    c = await _mk_client(app)
    try:
        r = await c.post("/api/devices/1/command", json={"action": "cleaning_start"})
        out = await r.json()
        assert out["ok"] and out["delivered"] == "heartbeat-queue"
        assert reg.get(1).command_queue  # queued
    finally:
        await c.close()


async def test_action_form_records_a_consumable_reset_like_the_entity_form():
    """Pressing Reset N50 in the PANEL has to stamp the date, as HA's does.

    The panel posts `{"action": ...}` and Home Assistant goes through
    `handle_ha_command`; when those were two code paths only the second
    recorded the replacement date, and for the N50 that record is the
    countdown's only possible source (the device has no field for it). The
    symptom was a Reset N50 button that sent its device command and changed
    nothing anybody could see.
    """
    reg = DeviceRegistry()
    reg.get_or_create(petkit_id=1, device_type="t5", serial_number="SN")
    app, reg, hub = _panel(reg=reg, bridge=None)
    c = await _mk_client(app)
    try:
        r = await c.post("/api/devices/1/command", json={"action": "reset_n50"})
        assert (await r.json())["ok"]
        assert reg.get(1).config["consumables"]["n50"] > 0
    finally:
        await c.close()


async def test_action_and_entity_forms_have_the_same_side_effects(monkeypatch):
    """The two request forms are the same press and must stay interchangeable.

    Compared on the SHAPE of what each left behind — which config keys, which
    consumables — rather than the values, because a reset stamps `time.time()`
    and the envelope carries an epoch id, so two calls a millisecond apart are
    legitimately different. The clock is pinned for the `params` comparison:
    a feed's record id counts seconds since local midnight, so two requests
    that straddle a second boundary would otherwise disagree.
    """
    import time as time_module

    monkeypatch.setattr(time_module, "time", lambda: 1_790_000_000.0)
    def _shape(dev):
        cfg = {k: sorted(v) if isinstance(v, dict) else "set" for k, v in dev.config.items()}
        return sorted(cfg.items())

    for device_type in ("t5", "t6", "d4sh", "w7h"):
        probe = DeviceRegistry().get_or_create(petkit_id=1, device_type=device_type)
        keys = [e.key for e in get_entities_for_device(probe)
                if e.component == "button" and e.key in ALL_ACTIONS]
        assert keys, f"no button actions for {device_type} — test would prove nothing"

        for key in keys:
            reg_a, reg_b = DeviceRegistry(), DeviceRegistry()
            reg_a.get_or_create(petkit_id=1, device_type=device_type, serial_number="SN")
            reg_b.get_or_create(petkit_id=1, device_type=device_type, serial_number="SN")
            app_a, reg_a, _ = _panel(reg=reg_a, bridge=None)
            app_b, reg_b, _ = _panel(reg=reg_b, bridge=None)
            ca, cb = await _mk_client(app_a), await _mk_client(app_b)
            try:
                ra = await ca.post("/api/devices/1/command",
                                   json={"action": key})
                rb = await cb.post("/api/devices/1/command",
                                   json={"entity": key, "value": ""})
                oa, ob = await ra.json(), await rb.json()
                assert oa.get("ok") and ob.get("ok"), f"{device_type}/{key}: {oa} {ob}"
                assert oa.get("suffix") == ob.get("suffix"), f"{device_type}/{key}"
                if "envelope" in oa and "envelope" in ob:
                    assert oa["envelope"].get("method") == ob["envelope"].get("method")
                    assert oa["envelope"].get("params") == ob["envelope"].get("params")
                assert _shape(reg_a.get(1)) == _shape(reg_b.get(1)), \
                    f"{device_type}/{key} left different state behind"
            finally:
                await ca.close()
                await cb.close()


async def test_command_sender_uses_bridge_when_connected():
    reg = DeviceRegistry()
    reg.get_or_create(petkit_id=1, device_type="t5", serial_number="SN")
    reg.get(1).mqtt_connected = True  # device has a live MQTT session
    bridge = FakeBridge(connected=True)
    app, reg, hub = _panel(reg=reg, bridge=bridge)
    c = await _mk_client(app)
    try:
        r = await c.post("/api/devices/1/command", json={"action": "cleaning_start"})
        out = await r.json()
        assert out["delivered"] == "mqtt"
        assert bridge.sent and bridge.sent[0][1] == "start"
    finally:
        await c.close()


async def test_unknown_device_type_lists_and_is_named_unknown():
    # A device with a codename we don't recognize must still register, list,
    # and be reachable — just with no entities and an "Unknown" display name.
    reg = DeviceRegistry()
    reg.get_or_create(petkit_id=99, device_type="zz9", serial_number="SNZ")
    app, reg, hub = _panel(reg=reg)
    c = await _mk_client(app)
    try:
        devs = await (await c.get("/api/devices")).json()
        d = next(x for x in devs if x["id"] == 99)
        assert d["name"] == "Unknown" and d["type"] == "zz9"
        detail = await (await c.get("/api/devices/99")).json()
        assert detail["entities"] == [] and detail["actions"] == []
    finally:
        await c.close()


async def test_command_falls_back_to_heartbeat_when_device_not_on_mqtt():
    # Bridge is connected to the broker, but the DEVICE has no MQTT session
    # (mqtt_connected False) — command must queue for the HTTP heartbeat.
    reg = DeviceRegistry()
    reg.get_or_create(petkit_id=1, device_type="t5", serial_number="SN")
    bridge = FakeBridge(connected=True)
    app, reg, hub = _panel(reg=reg, bridge=bridge)
    c = await _mk_client(app)
    try:
        r = await c.post("/api/devices/1/command", json={"action": "cleaning_start"})
        out = await r.json()
        assert out["delivered"] == "heartbeat-queue"
        assert not bridge.sent  # never went to MQTT
        queued = reg.get(1).command_queue[0]
        assert queued["_service_suffix"] == "start"  # tagged for heartbeat conversion
    finally:
        await c.close()


async def test_command_entity_setting_updates_and_queues():
    reg = DeviceRegistry()
    reg.get_or_create(petkit_id=1, device_type="t5", serial_number="SN")
    app, reg, hub = _panel(reg=reg, bridge=None)
    c = await _mk_client(app)
    try:
        r = await c.post("/api/devices/1/command",
                         json={"entity": "auto_work", "value": "OFF"})
        out = await r.json()
        assert out["ok"] and out["delivered"] == "heartbeat-queue"
        # optimistic settings update applied (auto_work -> settings.autoWork)
        assert reg.get(1).config["settings"]["autoWork"] == 0
        queued = reg.get(1).command_queue[0]
        assert queued["_service_suffix"] == "property/set"
        assert queued["params"]["autoWork"] == 0
    finally:
        await c.close()


async def test_settings_live_update_mutates_shared_config():
    # The panel edits the SAME dict the device-facing handlers read, so a proxy
    # toggle takes effect with no restart.
    reg = DeviceRegistry()
    ble = BLERegistry()
    hub = EventHub()
    live = {"proxy_mode": False, "proxy_upstream": "", "proxy_block_run_cmd": True, "capture": False}
    cfg = {"api_url": "http://x/6/", "capture": False, "capture_dir": "/nope"}
    app = create_panel_app(reg, ble, hub, cfg, None, live_config=live)
    c = await _mk_client(app)
    try:
        s = await (await c.get("/api/settings")).json()
        assert s["writable"] is True and s["settings"]["proxy_mode"] is False
        r = await (await c.post("/api/settings", json={"proxy_mode": True, "capture": True})).json()
        assert r["ok"] and r["changed"]["proxy_mode"] is True
        assert live["proxy_mode"] is True and live["capture"] is True  # shared dict mutated live
        # capture flag now reflected everywhere it's read
        info = await (await c.get("/api/info")).json()
        assert info["capture"] is True and info["settings"]["proxy_mode"] is True
    finally:
        await c.close()


async def test_settings_not_writable_without_live_config():
    app, reg, hub = _panel()  # no live_config -> empty fallback
    c = await _mk_client(app)
    try:
        s = await (await c.get("/api/settings")).json()
        assert s["writable"] is False
        r = await c.post("/api/settings", json={"proxy_mode": True})
        assert r.status == 400
    finally:
        await c.close()


async def test_ws_streams_live_events():
    import asyncio
    app, reg, hub = _panel()
    c = await _mk_client(app)
    try:
        ws = await c.ws_connect("/api/ws")
        hub.publish("mqtt", 1, "hello-live")
        got = False
        for _ in range(20):
            msg = await asyncio.wait_for(ws.receive_json(), timeout=2)
            if msg.get("summary") == "hello-live":
                got = True
                break
        assert got
        await ws.close()
    finally:
        await c.close()


async def test_capture_disabled_message():
    app, reg, hub = _panel()
    c = await _mk_client(app)
    try:
        cap = await (await c.get("/api/capture")).json()
        assert cap["enabled"] is False
    finally:
        await c.close()


# --- capture files: delete -------------------------------------------------
# Nothing prunes captures — they have no retention sweep, deliberately — so
# deleting is the only way to reclaim the space. The name comes from a URL, so
# most of what matters here is that it cannot escape the capture directory.

def _capture_app(tmp):
    cfg = {"api_url": "http://x/6/", "capture": True, "capture_dir": str(tmp)}
    live = {"proxy_mode": False, "proxy_upstream": "", "proxy_block_run_cmd": True,
            "capture": True}
    return create_panel_app(DeviceRegistry(), BLERegistry(), EventHub(), cfg, None,
                            live_config=live)


async def test_a_capture_file_can_be_deleted_and_stops_being_listed():
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "http.jsonl").write_text('{"a": 1}\n')
        (Path(tmp) / "mqtt.jsonl").write_text('{"b": 2}\n')
        c = await _mk_client(_capture_app(tmp))
        try:
            listed = await (await c.get("/api/capture")).json()
            assert {f["name"] for f in listed["files"]} == {"http.jsonl", "mqtt.jsonl"}

            r = await c.delete("/api/capture/http.jsonl")
            assert (await r.json())["ok"] is True
            assert not (Path(tmp) / "http.jsonl").exists()

            listed = await (await c.get("/api/capture")).json()
            assert {f["name"] for f in listed["files"]} == {"mqtt.jsonl"}
        finally:
            await c.close()


async def test_deleting_a_capture_that_is_not_there_is_a_404_not_a_crash():
    with tempfile.TemporaryDirectory() as tmp:
        c = await _mk_client(_capture_app(tmp))
        try:
            assert (await c.delete("/api/capture/nope.jsonl")).status == 404
            # Deleting twice: the second call must behave like the first miss.
            (Path(tmp) / "x.jsonl").write_text("{}\n")
            assert (await c.delete("/api/capture/x.jsonl")).status == 200
            assert (await c.delete("/api/capture/x.jsonl")).status == 404
        finally:
            await c.close()


@pytest.mark.parametrize("name", [
    "..%2F..%2Fetc%2Fpasswd.jsonl",   # traversal, percent-encoded
    "..%2Fsecret.jsonl",
    "%2Fetc%2Fpasswd.jsonl",          # absolute path
])
async def test_delete_cannot_escape_the_capture_directory(name):
    with tempfile.TemporaryDirectory() as tmp:
        outside = Path(tmp) / "outside"
        outside.mkdir()
        target = outside / "secret.jsonl"
        target.write_text("do not delete me")
        capture_dir = Path(tmp) / "capture"
        capture_dir.mkdir()
        c = await _mk_client(_capture_app(capture_dir))
        try:
            r = await c.delete("/api/capture/" + name)
            assert r.status == 404
            assert target.exists(), "a traversing name deleted a file outside the capture dir"
        finally:
            await c.close()


async def test_delete_refuses_anything_that_is_not_a_capture_file():
    """The extension is this endpoint's contract — the listing shows only
    `.jsonl`, so nothing else may be deletable through it."""
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "petkit.db").write_text("not a capture")
        c = await _mk_client(_capture_app(tmp))
        try:
            assert (await c.delete("/api/capture/petkit.db")).status == 404
            assert (Path(tmp) / "petkit.db").exists()
        finally:
            await c.close()


# --- settings persistence ---

def _settings_app(tmp):
    live = {"proxy_mode": False, "proxy_upstream": "", "proxy_block_run_cmd": True, "capture": False}
    cfg = {"api_url": "http://x/6/", "capture": False, "capture_dir": "/nope",
           "settings_path": str(Path(tmp) / "overrides.json")}
    return create_panel_app(DeviceRegistry(), BLERegistry(), EventHub(), cfg, None,
                            live_config=live)


async def test_settings_overrides_written_atomically_and_merged():
    # The write must leave no partial file behind and must keep keys set by an
    # earlier POST.
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "overrides.json"
        c = await _mk_client(_settings_app(tmp))
        try:
            await c.post("/api/settings", json={"proxy_mode": True})
            assert json.loads(path.read_text()) == {"proxy_mode": True}
            await c.post("/api/settings", json={"capture": True})
            assert json.loads(path.read_text()) == {"proxy_mode": True, "capture": True}
            # no temp file survived the write-then-rename
            assert os.listdir(tmp) == ["overrides.json"]
        finally:
            await c.close()


async def test_settings_overrides_repair_a_corrupt_file():
    # A truncated overrides file is ignored by config.apply_panel_overrides, so
    # the panel rewrites it instead of refusing to persist (the old behaviour).
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "overrides.json"
        path.write_text('{"proxy_mode": tr')
        c = await _mk_client(_settings_app(tmp))
        try:
            r = await c.post("/api/settings", json={"proxy_mode": True})
            assert (await r.json())["ok"] is True
            assert json.loads(path.read_text()) == {"proxy_mode": True}
        finally:
            await c.close()


# --- ?limit= handling ---

async def test_events_limit_ignores_junk_and_clamps():
    app, reg, hub = _panel()
    for i in range(5):
        hub.publish("http", 1, f"e{i}")
    c = await _mk_client(app)
    try:
        # non-numeric used to raise ValueError -> HTTP 500
        r = await c.get("/api/events?limit=abc")
        assert r.status == 200 and len(await r.json()) == 5
        assert len(await (await c.get("/api/events?limit=2")).json()) == 2
        # clamped high: still the whole ring, never an error
        assert len(await (await c.get("/api/events?limit=99999999")).json()) == 5
        # negative used to slice from the FRONT (evs[3:]); now clamped to 1
        assert len(await (await c.get("/api/events?limit=-3")).json()) == 1
        # a non-numeric device filter is ignored, as before
        assert len(await (await c.get("/api/events?device=xx")).json()) == 5
    finally:
        await c.close()


def _capture_cfg(tmp):
    return {"api_url": "http://x/6/", "capture": True, "capture_dir": str(tmp)}


async def test_capture_read_tails_file_and_reports_full_total():
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "http.jsonl").write_text(
            "".join(json.dumps({"i": i}) + "\n" for i in range(10)))
        app, reg, hub = _panel(cfg=_capture_cfg(tmp))
        c = await _mk_client(app)
        try:
            body = await (await c.get("/api/capture/http.jsonl?limit=3")).json()
            assert body["total"] == 10  # total counts the file, not the page
            assert [rec["i"] for rec in body["records"]] == [7, 8, 9]

            # junk limit falls back to the default instead of raising
            r = await c.get("/api/capture/http.jsonl?limit=oops")
            assert r.status == 200
            body2 = await r.json()
            assert body2["total"] == 10 and len(body2["records"]) == 10
        finally:
            await c.close()


def test_capture_path_helper_contains_and_filters():
    with tempfile.TemporaryDirectory() as tmp:
        from my_petkit.features.logs.routes import _safe_capture_path
        cap = Path(tmp) / "capture"
        cap.mkdir()
        (cap / "ok.jsonl").write_text("{}\n")
        (Path(tmp) / "secret.jsonl").write_text("{}\n")
        app, reg, hub = _panel(cfg=_capture_cfg(cap))

        def resolve(name):
            return _safe_capture_path(
                make_mocked_request("GET", "/api/capture/x", app=app, match_info={"name": name}))

        assert resolve("ok.jsonl") == os.path.realpath(str(cap / "ok.jsonl"))
        assert resolve("../secret.jsonl") is None      # containment
        assert resolve("/etc/hosts.jsonl") is None     # absolute is read as relative
        assert resolve("ok.txt") is None               # endpoint serves .jsonl only
        assert resolve("missing.jsonl") is None


# --- background tasks ---

async def test_background_task_is_tracked_and_cancelled_on_cleanup():
    from my_petkit.web.panel import BACKGROUND_TASKS, _spawn_background, cancel_background_tasks
    app, reg, hub = _panel()
    started = asyncio.Event()

    async def _forever():
        started.set()
        await asyncio.sleep(3600)

    task = _spawn_background(app, _forever(), name="test-forever")
    await asyncio.wait_for(started.wait(), timeout=2)
    assert task in app[BACKGROUND_TASKS]  # strong reference held, not GC-able

    await cancel_background_tasks(app)
    assert task.cancelled()
    assert not app[BACKGROUND_TASKS]


async def test_background_task_exception_is_retrieved():
    from my_petkit.web.panel import BACKGROUND_TASKS, _spawn_background
    app, reg, hub = _panel()

    async def _boom():
        raise RuntimeError("nope")

    panel_log = logging.getLogger("my_petkit.web.panel")
    panel_log.disabled = True  # the failure is logged; keep the test output clean
    try:
        task = _spawn_background(app, _boom(), name="test-boom")
        await asyncio.sleep(0.05)
    finally:
        panel_log.disabled = False
    assert task.done() and isinstance(task.exception(), RuntimeError)
    assert task not in app[BACKGROUND_TASKS]


async def test_patcher_run_is_tracked_and_drained_by_app_cleanup():
    """A patcher run outlives its request; it must be pinned and cancelled at
    shutdown rather than left to the garbage collector."""
    import my_petkit.features.patchers.routes as patchers_mod
    import my_petkit.web.panel as panel

    reg = DeviceRegistry()
    reg.get_or_create(petkit_id=1, device_type="t5", serial_number="SN").state["ip"] = "192.0.2.10"
    app, reg, hub = _panel(reg=reg)
    started = asyncio.Event()

    async def _slow_apply(*args, **kwargs):
        started.set()
        await asyncio.sleep(3600)

    original = patchers_mod._patcher_apply
    patchers_mod._patcher_apply = _slow_apply
    c = await _mk_client(app)
    try:
        r = await c.post("/api/devices/1/patcher", json={"patcher": "mqtt"})
        assert (await r.json())["ok"] is True
        await asyncio.wait_for(started.wait(), timeout=2)
        tasks = list(app[panel.BACKGROUND_TASKS])
        assert len(tasks) == 1
    finally:
        patchers_mod._patcher_apply = original
        await c.close()  # AppRunner cleanup -> on_cleanup -> cancel_background_tasks
    assert tasks[0].cancelled()


async def test_the_stream_addresses_live_on_the_device_not_on_the_patcher():
    """The Patchers card is about applying and undoing a change to the firmware.
    Once applied, where to watch the device is just another fact about it, so it
    belongs in the device view — and the patcher endpoint must not grow it back."""
    reg = DeviceRegistry()
    d = reg.get_or_create(petkit_id=1, device_type="t5", serial_number="SN")
    d.state["ip"] = "192.0.2.10"
    d.state["streamAvailable"] = True
    app, reg, hub = _panel(reg=reg)

    class _Sidecar:
        def stream_url_for(self, device):
            return "rtsp://addon-host:8554/1"

    app["go2rtc"] = _Sidecar()
    c = await _mk_client(app)
    try:
        detail = await (await c.get("/api/devices/1")).json()
        assert detail["streams"]["rtsp"] == "rtsp://addon-host:8554/1"
        # The device's own address is offered too, but never first: it is the
        # one that crashes Home Assistant.
        assert detail["streams"]["flv"].startswith("http://192.0.2.10/")
        assert list(detail["streams"])[0] == "rtsp"

        patcher = await (await c.get("/api/devices/1/patcher")).json()
        assert "streams" not in patcher["patchers"]["camera"]
    finally:
        await c.close()


async def test_a_device_with_no_confirmed_stream_is_offered_no_address():
    reg = DeviceRegistry()
    reg.get_or_create(petkit_id=1, device_type="t5", serial_number="SN").state["ip"] = "192.0.2.10"
    app, reg, hub = _panel(reg=reg)
    c = await _mk_client(app)
    try:
        assert (await (await c.get("/api/devices/1")).json())["streams"] == {}
    finally:
        await c.close()


async def test_all_patchers_are_offered_on_every_next_gen_device():
    """No patcher is gated by architecture in the listing. The patchers
    themselves validate the binary they download from the device. Camera pan
    is gated by MODEL instead -- only the T6 has the motor -- so it is the one
    entry these two may show as unavailable."""
    reg = DeviceRegistry()
    reg.get_or_create(petkit_id=1, device_type="w7h", serial_number="SN")
    reg.get_or_create(petkit_id=2, device_type="t5", serial_number="SN2")
    app, reg, hub = _panel(reg=reg)
    c = await _mk_client(app)
    try:
        for did in (1, 2):
            resp = await (await c.get(f"/api/devices/{did}/patcher")).json()
            assert resp["supported"] is True
            blocked = {p for p, e in resp["patchers"].items() if e["unavailable"]} - {"pan"}
            assert blocked == set(), f"device {did} has blocked patchers: {blocked}"
    finally:
        await c.close()


# --- proxy settings: validation and gating ---

def _proxy_settings_app(tmp=None, store=None):
    live = dict.fromkeys(LIVE_SETTINGS, False)
    live["proxy_upstream"] = ""
    cfg = {"api_url": "http://x/6/", "capture": False, "capture_dir": "/nope"}
    if tmp:
        cfg["settings_path"] = str(Path(tmp) / "overrides.json")
    app = create_panel_app(DeviceRegistry(), BLERegistry(), EventHub(), cfg, None,
                           live_config=live, event_store=store)
    return app, live


@pytest.mark.parametrize("body", ["[1, 2]", '"a string"', "17", "not json at all"])
async def test_a_body_that_is_not_a_json_object_is_a_bad_request(body):
    """Every handler reads the body with `.get`, so a list used to arrive there
    as an AttributeError and answer 500 to a malformed request."""
    with tempfile.TemporaryDirectory() as tmp:
        app, _live = _proxy_settings_app(tmp)
        c = await _mk_client(app)
        try:
            r = await c.post("/api/settings", data=body,
                             headers={"Content-Type": "application/json"})
            assert r.status == 400
            assert (await r.json())["error"]["message"] == "bad json"
        finally:
            await c.close()


def test_every_panel_setting_is_one_the_config_reads_back():
    """A key the panel writes but `PANEL_LIVE_KEYS` omits is applied now and
    silently dropped at the next start — `apply_panel_overrides` reads only that
    tuple."""
    assert set(LIVE_SETTINGS) == set(PANEL_LIVE_KEYS)


async def test_settings_expose_every_live_key_with_its_default():
    """All keys always present, so the frontend never renders `undefined`."""
    app, reg, hub = _panel()
    c = await _mk_client(app)
    try:
        s = (await (await c.get("/api/settings")).json())["settings"]
        assert set(s) == set(LIVE_SETTINGS)
        # Both guards default ON — a debugging tool that lets the cloud run a
        # command or push firmware is a liability.
        assert s["proxy_block_run_cmd"] is True
        assert s["proxy_block_ota"] is True
        assert s["proxy_mqtt_bridge"] is True
        assert s["proxy_media_real_oss"] is False
    finally:
        await c.close()


async def test_upstream_presets_are_offered_and_accepted():
    """The choices the panel renders must be exactly what resolve_upstream takes."""
    app, live = _proxy_settings_app()
    c = await _mk_client(app)
    try:
        upstreams = (await (await c.get("/api/info")).json())["upstreams"]
        offered = [u["key"] for u in upstreams]
        assert offered == ["petkit-eu", "petkit-americas", "petkit-asia",
                           "petkit-cn", "petkit-ru"]
        # Exactly one is flagged default, so the picker never has to guess which
        # key an empty setting means.
        assert [u["key"] for u in upstreams if u["default"]] == ["petkit-eu"]

        for key in offered:
            r = await c.post("/api/settings", json={"proxy_upstream": key})
            assert r.status == 200, key
            assert live["proxy_upstream"] == key
    finally:
        await c.close()


async def test_a_custom_upstream_url_is_accepted():
    app, live = _proxy_settings_app()
    c = await _mk_client(app)
    try:
        # Typed, not picked from the presets -- but it must still be a PetKit
        # host: every device request is forwarded there with its credential.
        r = await c.post("/api/settings", json={"proxy_upstream": "https://api.eu-pet.com/6/"})
        assert r.status == 200
        assert live["proxy_upstream"] == "https://api.eu-pet.com/6/"
        r = await c.post("/api/settings", json={"proxy_upstream": "https://my.mirror/6/"})
        assert r.status == 400
        assert live["proxy_upstream"] == "https://api.eu-pet.com/6/"
    finally:
        await c.close()


async def test_a_bad_upstream_is_rejected_and_changes_nothing():
    """Coercion alone would save a typo happily and then fail on every device
    request with nothing in the panel to say why."""
    app, live = _proxy_settings_app()
    c = await _mk_client(app)
    try:
        for bad in ["not a url", "ftp://petkt.com", "https://", "javascript:alert(1)"]:
            r = await c.post("/api/settings", json={"proxy_upstream": bad})
            assert r.status == 400, bad
            assert live["proxy_upstream"] == "", bad
    finally:
        await c.close()


async def test_a_rejected_batch_applies_none_of_its_settings():
    """Half-applied settings would leave proxy mode on pointing nowhere."""
    app, live = _proxy_settings_app()
    c = await _mk_client(app)
    try:
        r = await c.post("/api/settings", json=
            {"proxy_mode": True, "proxy_upstream": "nonsense"})
        assert r.status == 400
        assert live["proxy_mode"] is False
    finally:
        await c.close()


# --- /api/blocked ---

async def test_blocked_needs_a_store():
    app, live = _proxy_settings_app()
    c = await _mk_client(app)
    try:
        assert (await c.get("/api/blocked")).status == 400
    finally:
        await c.close()


async def test_blocked_masks_payloads_unless_asked(event_store):
    """These rows hold real device secrets and media keys, and this panel is
    served unauthenticated on the HTTPS port."""
    await event_store.add_blocked_attempts([
        {"device_id": 1, "kind": "secret", "endpoint": "/6/t5/dev_signup",
         "payload_json": "supersecretvalue"},
    ])
    app, live = _proxy_settings_app(store=event_store)
    c = await _mk_client(app)
    try:
        rows = (await (await c.get("/api/blocked")).json())["records"]
        assert rows[0]["payload_json"] == "supers… (16 chars)"

        rows = (await (await c.get("/api/blocked?reveal=1")).json())["records"]
        assert rows[0]["payload_json"] == "supersecretvalue"
    finally:
        await c.close()


async def test_blocked_orders_newest_first_and_clamps_limit(event_store):
    await event_store.add_blocked_attempts(
        [{"device_id": 1, "kind": "rce", "endpoint": f"/6/e{i}"} for i in range(5)])
    app, live = _proxy_settings_app(store=event_store)
    c = await _mk_client(app)
    try:
        rows = (await (await c.get("/api/blocked")).json())["records"]
        assert [r["endpoint"] for r in rows] == [f"/6/e{i}" for i in reversed(range(5))]
        assert len((await (await c.get("/api/blocked?limit=2")).json())["records"]) == 2
        assert len((await (await c.get("/api/blocked?limit=99999")).json())["records"]) == 5
        assert len((await (await c.get("/api/blocked?limit=junk")).json())["records"]) == 5
    finally:
        await c.close()


async def test_blocked_filters_by_device_and_kind(event_store):
    await event_store.add_blocked_attempts([
        {"device_id": 1, "kind": "rce"}, {"device_id": 2, "kind": "ota"},
    ])
    app, live = _proxy_settings_app(store=event_store)
    c = await _mk_client(app)
    try:
        rows = (await (await c.get("/api/blocked?device=2")).json())["records"]
        assert [r["kind"] for r in rows] == ["ota"]
        rows = (await (await c.get("/api/blocked?kind=rce")).json())["records"]
        assert [r["device_id"] for r in rows] == [1]
    finally:
        await c.close()


# --- frontend contract ---
#
# These read the web app's source, because the other side of each check is a
# Python table and only this suite can see both. They match with REGEXES rather
# than literal substrings on purpose: the frontend is formatted by prettier, so
# what each test wants to know must survive requoting and rewrapping.

WEB_SRC = Path(__file__).resolve().parents[3] / "apps" / "web" / "src"


def _web_source(relative: str) -> str:
    """One file of the web app (`apps/web/src`), as source text."""
    return (WEB_SRC / relative).read_text(encoding="utf-8")


def test_every_hub_kind_the_proxy_publishes_has_a_colour():
    """web/hub.py's `redact` and `blocked` kinds must stand out in the Log tab:
    the row's colour comes from `levelOf`, and a kind it does not name renders
    as an ordinary info line."""
    log_format = _web_source("features/log/log-format.ts")
    for kind in ("redact", "blocked"):
        assert re.search(rf"""kind\s*===\s*['"]{kind}['"]""", log_format), kind


def test_the_photo_cap_agrees_with_the_store():
    """The web app disables its add-photo tile at MAX_FACES and the store
    refuses past MAX_FACES_PER_PET. Two copies of one number the device enforces
    for real, so a drift means the UI invites an upload the API then rejects."""
    from my_petkit.events.store import MAX_FACES_PER_PET

    m = re.search(r"export const MAX_FACES\s*=\s*(\d+)", _web_source("features/pets/pet-model.ts"))
    assert m, "the web app no longer declares MAX_FACES"
    assert int(m.group(1)) == MAX_FACES_PER_PET


async def test_info_names_the_ai_capable_products():
    """The Pets tab used to spell the product list out in its own copy, which
    went stale the moment a fountain joined it. One source now."""
    app, reg, hub = _panel()
    c = await _mk_client(app)
    try:
        names = (await (await c.get("/api/info")).json())["ai_device_names"]
        assert "Purobot Max Pro 2" in names          # t5
        assert "EverSweet Ultra AI" in names         # w7h, per PetKit's own list
        assert names == sorted(names)
    finally:
        await c.close()


async def test_the_ha_indicator_reports_ha_not_the_device_bridge():
    """`bridge_connected` used to read the DEVICE-facing bridge's client and
    render it as "Bridge -> HA". That bridge is up whenever our own embedded
    broker is, so the one indicator answering "is Home Assistant getting my
    data?" showed green with HA publishing switched off entirely — and would
    have stayed green if the HA broker connection dropped.
    """
    from my_petkit.devices.registry import DeviceRegistry
    reg = DeviceRegistry()
    reg.get_or_create(petkit_id=1, device_type="t5", serial_number="SN")

    class FakePublisher:
        def __init__(self, connected):
            self.connected = connected

    # No publisher at all — running standalone, or with --no-ha. Not an error.
    app, _, _ = _panel(reg=reg)
    c = await _mk_client(app)
    try:
        info = await (await c.get("/api/info")).json()
        assert info["ha_enabled"] is False and info["ha_publishing"] is False
    finally:
        await c.close()

    # Configured but not connected must NOT read the same as connected.
    app, _, _ = _panel(reg=reg)
    app["ha_publisher"] = FakePublisher(False)
    c = await _mk_client(app)
    try:
        info = await (await c.get("/api/info")).json()
        assert info["ha_enabled"] is True and info["ha_publishing"] is False
    finally:
        await c.close()

    app, _, _ = _panel(reg=reg)
    app["ha_publisher"] = FakePublisher(True)
    c = await _mk_client(app)
    try:
        assert (await (await c.get("/api/info")).json())["ha_publishing"] is True
    finally:
        await c.close()


# --- a BLE accessory is its own panel ---------------------------------------

def _paired_ctw3_app():
    """A panel with one D4SH and a CTW3 relayed by it, already reporting.

    The state comes from the real cmd-230 frame in `test_ble_accessories`, run
    through the real decoder, rather than being typed out here: a hand-written
    copy drifts the moment the decoder learns a field, and then this fixture
    reports an entity as unresolvable that a live accessory would fill.
    """
    from my_petkit.devices.ble import BLERegistry, parse_ctw3_ble_response

    from .test_ble_accessories import CTW3_CMD230

    app, reg, hub = _panel()
    parent = reg.get_or_create(petkit_id=10, device_type="d4sh", serial_number="SN10")
    parent.online = True
    parent.mqtt_connected = True
    ble = BLERegistry()
    dev = ble.register(ble_type="ctw3", petkit_id=700, mac="AABBCCDDEEFF",
                       secret="s", interval=240, link_with=10)
    dev.state = parse_ctw3_ble_response(
        {"device": {"mac": "aabbccddeeff"},
         "payload": [{"cmd": 230, "data": CTW3_CMD230}]})
    dev.last_seen = 1785625866
    app["ble_registry"] = ble
    return app, reg, ble


async def test_the_accessory_view_carries_everything_its_panel_needs():
    """It carried three keys — type, mac, id — while its decoded state, its
    entities and its controls existed only in Home Assistant."""
    app, reg, ble = _paired_ctw3_app()
    c = await _mk_client(app)
    try:
        body = await (await c.get("/api/ble")).json()
        a = body["accessories"][0]
        assert a["name"] == "EverSweet Max Cordless"
        assert a["parent_name"] == "YumShare Dual-Hopper"
        assert a["parent_online"] is True
        assert a["last_seen"] == 1785625866
        # Every entity with a path resolves against the accessory's own state
        # document — one whose `value_path` names a section nothing fills reads
        # unknown forever, which is what the device-side guard exists for too.
        # A button has no path: it is an action, not a reading.
        valued = [e for e in a["entities"] if e["value_path"]]
        assert len(valued) == len(a["entities"]) - 1
        for e in valued:
            assert e["value"] is not None, e["key"]
        assert any(e["component"] == "button" for e in a["entities"])
        assert sum(1 for e in a["entities"] if e["settable"]) == 12
    finally:
        await c.close()


async def test_the_panel_can_set_an_accessory_control():
    app, reg, ble = _paired_ctw3_app()

    class _Bridge:
        _client = object()

        def __init__(self):
            self.sent = []

        async def publish_ble_command(self, parent, dev, cmd, payload):
            self.sent.append((parent.petkit_id, dev.petkit_id, cmd, payload))
            return True

    bridge = _Bridge()
    app["bridge"] = bridge
    c = await _mk_client(app)
    try:
        r = await c.post("/api/ble/700/command",
                         json={"entity": "ctw3_mode", "value": "smart"})
        assert r.status == 200, await r.text()
        assert (await r.json())["delivered"] == "ble"
        parent_id, ble_id, cmd, payload = bridge.sent[0]
        assert (parent_id, ble_id, cmd) == (10, 700, 220)
        # Picking a mode means running in it: power on and pump un-paused,
        # which is what PetKit's app sends, rather than either being read back
        # from whatever the last status held.
        assert payload == bytes([1, 1, 2])
        # Optimistic, like a real device's.
        assert ble.get(700).state["states"]["mode"] == 2
    finally:
        await c.close()


async def test_the_panel_can_press_an_accessory_button():
    """A button has no value, and both the coercion and the optimistic
    write-back are shaped around one. Left alone they answered a press with
    400 and then filed its state under the empty string."""
    app, reg, ble = _paired_ctw3_app()

    class _Bridge:
        _client = object()
        sent: list = []

        async def publish_ble_command(self, parent, dev, cmd, payload):
            self.sent.append((cmd, payload))
            return True

    app["bridge"] = _Bridge()
    c = await _mk_client(app)
    try:
        r = await c.post("/api/ble/700/command", json={"entity": "ctw3_reset_filter"})
        assert r.status == 200, await r.text()
        assert _Bridge.sent[-1][0] == 222
        assert "" not in ble.get(700).state["states"]
    finally:
        await c.close()


async def test_an_accessory_write_says_why_it_cannot_be_delivered():
    """A real device off MQTT still has a heartbeat queue; an accessory has
    nothing to queue into, so silence would be a lie."""
    app, reg, ble = _paired_ctw3_app()
    reg.get(10).mqtt_connected = False
    app["bridge"] = type("B", (), {"_client": object()})()
    c = await _mk_client(app)
    try:
        r = await c.post("/api/ble/700/command",
                         json={"entity": "ctw3_power", "value": "OFF"})
        assert r.status == 409
        assert "not on MQTT" in (await r.json())["error"]["message"]
    finally:
        await c.close()


async def test_an_accessory_write_is_refused_before_the_first_reading():
    from my_petkit.devices.ble import BLERegistry

    app, reg, hub = _panel()
    parent = reg.get_or_create(petkit_id=10, device_type="d4sh", serial_number="SN10")
    parent.online = parent.mqtt_connected = True
    ble = BLERegistry()
    ble.register(ble_type="ctw3", petkit_id=700, mac="AABBCCDDEEFF", link_with=10)
    app["ble_registry"] = ble
    app["bridge"] = type("B", (), {"_client": object()})()
    c = await _mk_client(app)
    try:
        r = await c.post("/api/ble/700/command",
                         json={"entity": "ctw3_brightness", "value": "low"})
        assert r.status == 400
        assert "status" in (await r.json())["error"]["message"]
        r = await c.post("/api/ble/999/command", json={"entity": "x", "value": "1"})
        assert r.status == 404
    finally:
        await c.close()


async def test_the_panel_can_ask_for_a_reading_now():
    """The one action an accessory has, and it belongs to the relay: nothing in
    the CTW3 protocol is shaped like "do X now". Without it the only way to
    find out whether a freshly paired accessory answers is to wait out its poll
    interval — up to four minutes of staring at "never"."""
    app, reg, ble = _paired_ctw3_app()

    class _Bridge:
        _client = object()
        asked = None

        async def request_ble_reading(self, parent, dev):
            _Bridge.asked = (parent.petkit_id, dev.petkit_id)
            return True

    app["bridge"] = _Bridge()
    c = await _mk_client(app)
    try:
        r = await c.post("/api/ble/700/poll")
        assert r.status == 200
        assert _Bridge.asked == (10, 700)
        # And it refuses in the same words the write path does.
        reg.get(10).mqtt_connected = False
        r = await c.post("/api/ble/700/poll")
        assert r.status == 409
    finally:
        await c.close()


async def test_timezone_override_is_pushed_as_a_STRING():
    """The type is the whole fix, not a formatting preference.

    `parse_recv_property_set_normal` reads `cJSON.valuestring` and calls
    `atof()`, so a JSON number leaves `valuestring` NULL and the write is a
    silent no-op. Verified on a live T5: `5.75` as a number changed nothing for
    minutes; `"5.75"` moved the video watermark within ~30 seconds.
    """
    reg = DeviceRegistry()
    reg.get_or_create(petkit_id=1, device_type="t5", serial_number="SN")
    reg.get(1).mqtt_connected = True
    bridge = FakeBridge(connected=True)
    app, reg, hub = _panel(reg=reg, bridge=bridge)
    c = await _mk_client(app)
    try:
        r = await c.post("/api/devices/1/timezone", json={"timezone": 5.75})
        out = await r.json()
        assert out["ok"] and out["delivered"] == "mqtt"
        assert out["override"] == 5.75 and out["source"] == "override"

        _, suffix, envelope = bridge.sent[0]
        assert suffix == "property/set"
        sent = envelope["params"]["timezone"]
        assert isinstance(sent, str), f"sent as {type(sent).__name__}, would be a no-op"
        assert sent == "5.75"

        # And the HTTP payloads keep sending a number, which is what THEIR
        # parser reads — the two transports disagree about the type on purpose.
        from my_petkit.devices.payloads import to_device_info
        assert to_device_info(reg.get(1))["result"]["timezone"] == 5.75
    finally:
        await c.close()


async def test_clearing_the_timezone_override_falls_back_to_what_the_device_said():
    reg = DeviceRegistry()
    reg.get_or_create(petkit_id=1, device_type="t5", serial_number="SN")
    reg.get(1).config["reported_timezone"] = -4.0
    app, reg, hub = _panel(reg=reg, bridge=None)
    c = await _mk_client(app)
    try:
        await c.post("/api/devices/1/timezone", json={"timezone": 2})
        r = await c.post("/api/devices/1/timezone", json={"timezone": None})
        out = await r.json()
        assert out["override"] is None
        assert out["effective"] == -4.0 and out["source"] == "device"
    finally:
        await c.close()


async def test_a_zone_name_beats_the_zero_a_device_reports():
    """The D4SH bug: a feeder given only a locale over BLE reports its numeric
    offset as 0, so a box plainly in Europe/Warsaw told us it was in UTC and had
    UTC served back — its scheduled feeds firing two hours late. The zone name it
    ALSO reported is unambiguous and wins."""
    reg = DeviceRegistry()
    reg.get_or_create(petkit_id=1, device_type="d4sh", serial_number="SN")
    d = reg.get(1)
    d.config["reported_timezone"] = 0.0
    d.config["locale"] = "Europe/Warsaw"
    app, reg, hub = _panel(reg=reg, bridge=None)
    c = await _mk_client(app)
    try:
        out = await (await c.get("/api/devices/1/timezone")).json()
        assert out["effective"] in (1.0, 2.0)   # CET/CEST, never the reported 0.0
        assert out["source"] == "locale"
        assert out["reported"] == 0.0
    finally:
        await c.close()


async def test_timezone_push_falls_back_to_the_heartbeat_queue_on_http():
    """A feeder on HTTP has no broker session, so the push MUST queue for the
    next heartbeat. It used to publish over MQTT only, which is why the timezone
    never reached this exact device and the fix above could not take effect."""
    reg = DeviceRegistry()
    reg.get_or_create(petkit_id=1, device_type="d4sh", serial_number="SN")
    reg.get(1).config["locale"] = "Europe/Warsaw"
    reg.get(1).mqtt_connected = False
    app, reg, hub = _panel(reg=reg, bridge=FakeBridge(connected=False))
    c = await _mk_client(app)
    try:
        r = await c.post("/api/devices/1/timezone", json={"timezone": 2})
        out = await r.json()
        assert out["delivered"] == "heartbeat-queue"
        queued = reg.get(1).command_queue[-1]
        assert queued["_service_suffix"] == "property/set"
        # The value MUST be a JSON string, or the firmware's atof() no-ops it.
        assert queued["params"]["timezone"] == "2"
        assert isinstance(queued["params"]["timezone"], str)
    finally:
        await c.close()


async def test_an_impossible_offset_is_refused():
    reg = DeviceRegistry()
    reg.get_or_create(petkit_id=1, device_type="t5", serial_number="SN")
    app, reg, hub = _panel(reg=reg, bridge=None)
    c = await _mk_client(app)
    try:
        for bad in (99, -99, "nonsense", True):
            r = await c.post("/api/devices/1/timezone", json={"timezone": bad})
            assert r.status == 400, f"accepted {bad!r}"
        assert "timezone" not in reg.get(1).config
    finally:
        await c.close()
