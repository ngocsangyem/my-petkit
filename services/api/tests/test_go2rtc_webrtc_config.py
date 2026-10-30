"""go2rtc's WebRTC section: off by default, a fixed TCP+UDP port when enabled.

WebRTC media goes straight from the viewer to go2rtc, so the config is the
whole of what decides which addresses are advertised and which port opens.
"""
import pytest
import yaml

from my_petkit.config import Config
from my_petkit.devices.base import Device
from my_petkit.devices.registry import DeviceRegistry
from my_petkit.media import go2rtc as g


def _parsed(**kwargs):
    return yaml.safe_load(g.render_config({"1": "http://d/main.flv?audio=1"},
                                          "/data/go2rtc.log", **kwargs))


def test_without_candidates_no_media_listener_and_no_stun():
    webrtc = _parsed()["webrtc"]
    assert webrtc["listen"] == ""
    # STUN would make go2rtc discover and advertise an address nobody chose.
    assert webrtc["ice_servers"] == []
    assert "candidates" not in webrtc


def test_with_candidates_one_port_for_tcp_and_udp_and_only_those_addresses():
    webrtc = _parsed(webrtc_port=8555,
                     webrtc_candidates=("192.168.1.20:8555", "petkit.lan:18555"))["webrtc"]
    # A bare ":port" is TCP and UDP on the same number, so ICE over TCP is the
    # fallback when UDP is blocked.
    assert webrtc["listen"] == ":8555"
    assert webrtc["candidates"] == ["192.168.1.20:8555", "petkit.lan:18555"]
    assert webrtc["ice_servers"] == []


def test_the_api_stays_on_loopback_with_webrtc_on():
    parsed = _parsed(webrtc_candidates=("192.168.1.20:8555",))
    assert parsed["api"]["listen"] == g.API_ADDR == "127.0.0.1:1984"


def test_the_sidecar_reports_and_renders_what_it_was_given(tmp_path, monkeypatch):
    monkeypatch.setattr(g, "_have_go2rtc_cache", True)
    monkeypatch.setattr(g.outbound_guard, "check_device_target", lambda host: str(host))
    reg = DeviceRegistry()
    cam = Device(device_type="t5", petkit_id=7, serial_number="SN7")
    cam.state.update(ip="192.0.2.10", **{g.STREAM_AVAILABLE: True})
    reg._devices[7] = cam
    off = g.Go2rtc(reg, data_dir=str(tmp_path))
    on = g.Go2rtc(reg, data_dir=str(tmp_path), webrtc_port=9555,
                  webrtc_candidates=["10.0.0.5:9555"])
    assert (off.webrtc_enabled, on.webrtc_enabled) == (False, True)


@pytest.mark.parametrize("candidates", [
    ["192.168.1.20"],          # go2rtc silently drops an entry without a port
    ["192.168.1.20:0"],
    ["192.168.1.20:70000"],
    [":8555"],
    ["host name:8555"],
    ["a'b:8555"],
    ["stun:8555"],             # STUN is off, so a stun: entry would never resolve
])
def test_config_refuses_a_candidate_go2rtc_would_drop_or_misread(candidates):
    with pytest.raises(ValueError, match="webrtc_candidates"):
        Config(webrtc_candidates=candidates).validate_webrtc()


def test_config_accepts_ip_and_hostname_candidates():
    Config(webrtc_candidates=["192.168.1.20:8555", "petkit.lan:18555"]).validate_webrtc()


@pytest.mark.parametrize("port", [0, 65536])
def test_config_refuses_a_bad_webrtc_port(port):
    with pytest.raises(ValueError, match="webrtc_port"):
        Config(webrtc_port=port).validate_webrtc()


def test_addon_options_parse_comma_separated_candidates(monkeypatch):
    from my_petkit import config as config_module
    options = {"webrtc_candidates": " 192.168.1.20:8555 , petkit.lan:18555 ,", "webrtc_port": 9555}
    monkeypatch.setattr(config_module, "read_json",
                        lambda path, default: options if str(path).endswith("options.json") else default)
    monkeypatch.setattr(config_module, "_supervisor_host_ip", lambda: None)
    monkeypatch.setattr(config_module, "_supervisor_port_map", lambda: {})
    c = Config.from_ha_addon()
    assert c.webrtc_port == 9555
    assert c.webrtc_candidates == ["192.168.1.20:8555", "petkit.lan:18555"]
