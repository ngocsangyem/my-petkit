"""Every listener binds the address its own setting names.

A listener hard-wired to 0.0.0.0 is reachable from every network the host is
on, and a deployment that puts the user plane behind a tunnel or a reverse
proxy has to be able to say "loopback only" per listener. The defaults stay
what upstream bound, except plain MQTT: devices speak MQTT over TLS, so the
plaintext listener serves only the internal bridge on loopback unless
`mqtt_plain_expose` asks for every interface again.
"""

import pathlib

import pytest
from aiohttp import web

from my_petkit import config as config_module
from my_petkit.config import Config
from my_petkit.main.cli import build_config, parse_args
from my_petkit.main.lifecycle import ListenerBindError, start_site
from my_petkit.media.go2rtc import render_config
from my_petkit.mqtt.broker import _bind

MAIN = pathlib.Path(__file__).resolve().parents[1] / "src" / "my_petkit" / "main"


def test_defaults_bind_what_upstream_bound_except_plain_mqtt_on_loopback():
    c = Config()
    assert (c.device_bind_host, c.user_bind_host) == ("0.0.0.0",) * 2  # noqa: S104
    assert c.mqtt_plain_bind == "127.0.0.1"
    assert c.mqtt_plain_expose is False
    assert c.mqtt_plain_listen_host == "127.0.0.1"
    assert c.rtsp_bind == ":8554"
    c.validate_bind_addresses()


def test_mqtt_plain_expose_restores_every_interface():
    """Every interface still includes the loopback address the bridge dials."""
    c = Config(mqtt_plain_expose=True)
    assert c.mqtt_plain_listen_host == "0.0.0.0"  # noqa: S104
    c.validate_bind_addresses()
    assert Config(mqtt_plain_bind="::1").mqtt_plain_listen_host == "::1"


def test_mqtt_plain_expose_flag_and_addon_option(tmp_path, monkeypatch):
    args = parse_args(["--config", str(tmp_path / "absent.json"), "--data-dir", str(tmp_path),
                       "--mqtt-plain-expose"])
    assert build_config(args).mqtt_plain_listen_host == "0.0.0.0"  # noqa: S104
    args = parse_args(["--config", str(tmp_path / "absent.json"), "--data-dir", str(tmp_path)])
    assert build_config(args).mqtt_plain_listen_host == "127.0.0.1"

    options = {"mqtt_plain_expose": True}
    monkeypatch.setattr(config_module, "read_json",
                        lambda path, default: options if str(path).endswith("options.json") else default)
    monkeypatch.setattr(config_module, "_supervisor_host_ip", lambda: None)
    monkeypatch.setattr(config_module, "_supervisor_port_map", lambda: {})
    assert Config.from_ha_addon().mqtt_plain_expose is True
    options["mqtt_plain_expose"] = "not a bool"
    assert Config.from_ha_addon().mqtt_plain_expose is False


def test_the_addon_schema_offers_mqtt_plain_expose():
    addon = (pathlib.Path(__file__).resolve().parents[3] / "addon" / "config.yaml").read_text()
    assert "  mqtt_plain_expose: bool?" in addon


def test_the_broker_binds_plain_mqtt_to_loopback_by_default():
    import inspect

    from my_petkit.mqtt.broker import start_broker

    assert inspect.signature(start_broker).parameters["plain_bind"].default == "127.0.0.1"


@pytest.mark.parametrize("setting", ["device_bind_host", "mqtt_plain_bind", "user_bind_host"])
@pytest.mark.parametrize("value", ["localhost", "", "0.0.0.0; rm -rf /", "10.0.0.300"])
def test_a_bind_host_that_is_not_an_ip_literal_is_refused(setting, value):
    c = Config(**{setting: value})
    with pytest.raises(ValueError, match=setting):
        c.validate_bind_addresses()


@pytest.mark.parametrize("value", ["127.0.0.1", "::1", "192.168.1.10"])
def test_ip_literals_are_accepted(value):
    Config(device_bind_host=value, mqtt_plain_bind=value, user_bind_host=value).validate_bind_addresses()


@pytest.mark.parametrize("value", [":8554", "127.0.0.1:8554", "[::1]:8554"])
def test_rtsp_bind_accepts_host_port_forms(value):
    Config(rtsp_bind=value).validate_bind_addresses()


@pytest.mark.parametrize("value", ["8554", "host:8554", ":0", ":99999", ""])
def test_rtsp_bind_rejects_malformed_values(value):
    with pytest.raises(ValueError, match="rtsp_bind"):
        Config(rtsp_bind=value).validate_bind_addresses()


def test_cli_flags_set_each_bind(tmp_path):
    args = parse_args([
        "--config", str(tmp_path / "absent.json"), "--data-dir", str(tmp_path),
        "--device-bind-host", "192.168.1.10", "--mqtt-plain-bind", "127.0.0.1",
        "--user-bind-host", "127.0.0.1", "--rtsp-bind", "127.0.0.1:8554",
        "--timezone", "Asia/Saigon",
    ])
    c = build_config(args)
    assert (c.device_bind_host, c.mqtt_plain_bind, c.user_bind_host, c.rtsp_bind, c.timezone) == (
        "192.168.1.10", "127.0.0.1", "127.0.0.1", "127.0.0.1:8554", "Asia/Saigon")


def test_a_bad_bind_flag_stops_config_before_anything_binds(tmp_path):
    args = parse_args(["--config", str(tmp_path / "absent.json"), "--data-dir", str(tmp_path),
                       "--user-bind-host", "panel.example"])
    with pytest.raises(ValueError, match="user_bind_host"):
        build_config(args)


def test_addon_options_set_each_bind(monkeypatch):
    options = {"device_bind_host": "192.168.1.10", "mqtt_plain_bind": "127.0.0.1",
               "user_bind_host": "127.0.0.1", "rtsp_bind": "127.0.0.1:8554",
               "timezone": "Europe/Amsterdam"}
    monkeypatch.setattr(config_module, "read_json",
                        lambda path, default: options if str(path).endswith("options.json") else default)
    monkeypatch.setattr(config_module, "_supervisor_host_ip", lambda: None)
    monkeypatch.setattr(config_module, "_supervisor_port_map", lambda: {})
    c = Config.from_ha_addon()
    for key, value in options.items():
        assert getattr(c, key) == value


async def test_start_site_binds_the_configured_host():
    runner = web.AppRunner(web.Application())
    await runner.setup()
    try:
        await start_site(runner, "127.0.0.1", 0, listener="test", setting="user_bind_host")
        assert [addr[0] for addr in runner.addresses] == ["127.0.0.1"]
    finally:
        await runner.cleanup()


async def test_an_unbindable_address_fails_with_the_listener_and_setting_named():
    runner = web.AppRunner(web.Application())
    await runner.setup()
    try:
        # 192.0.2.1 is TEST-NET-1: never assigned to this host, so EADDRNOTAVAIL.
        with pytest.raises(ListenerBindError, match=r"media bucket.*device_bind_host"):
            await start_site(runner, "192.0.2.1", 0, listener="media bucket",
                             setting="device_bind_host")
    finally:
        await runner.cleanup()


def test_broker_listener_addresses_bracket_ipv6():
    assert _bind("127.0.0.1", 1883) == "127.0.0.1:1883"
    assert _bind("::1", 1883) == "[::1]:1883"


def test_go2rtc_rtsp_listen_follows_the_setting():
    assert "  listen: ':8554'" in render_config({}, "/data/go2rtc.log")
    assert "  listen: '127.0.0.1:8554'" in render_config({}, "/data/go2rtc.log", "127.0.0.1:8554")


def test_no_listener_hard_codes_all_interfaces():
    """Every bind in main/ goes through a setting; a literal would bypass it."""
    for name in ("__init__.py", "lifecycle.py"):
        source = (MAIN / name).read_text()
        assert '"0.0.0.0"' not in source, f"{name} binds a literal 0.0.0.0"
