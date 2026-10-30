"""Settings a plain container (compose, VPS) can only set from the command line.

Outside the add-on there is no options file, so WebRTC, the WireGuard device
networks and the pairing address need flags of their own, and a bad value must
stop the process at startup like every other listener setting.
"""

import pytest

from my_petkit.main import cli, lifecycle


def _build(tmp_path, *flags: str):
    args = cli.parse_args(["--config", str(tmp_path / "absent.json"), "--data-dir", str(tmp_path),
                           *flags])
    return cli.build_config(args)


def test_webrtc_and_wireguard_flags_reach_the_config(tmp_path):
    config = _build(
        tmp_path,
        "--webrtc-port", "18555",
        "--webrtc-candidates", "192.168.1.20:18555, 203.0.113.9:18555",
        "--wireguard-subnets", "100.64.10.0/24",
    )

    assert config.webrtc_port == 18555
    assert config.webrtc_candidates == ["192.168.1.20:18555", "203.0.113.9:18555"]
    assert config.wireguard_subnets == ["100.64.10.0/24"]


def test_an_empty_candidates_flag_clears_the_list(tmp_path):
    config = _build(tmp_path, "--webrtc-candidates", "")

    assert config.webrtc_candidates == []


def test_absent_flags_leave_the_defaults(tmp_path):
    config = _build(tmp_path)

    assert config.webrtc_port == 8555
    assert config.webrtc_candidates == []
    assert config.wireguard_subnets == []


@pytest.mark.parametrize(
    "flags",
    [
        ("--webrtc-candidates", "192.168.1.20"),
        ("--webrtc-port", "70000"),
        ("--wireguard-subnets", "not-a-network"),
        ("--user-url", "http://petkit.example.com"),
        ("--user-url", "https://petkit.example.com/panel"),
        ("--user-url", "petkit.example.com"),
    ],
)
def test_a_bad_value_stops_startup(tmp_path, flags):
    with pytest.raises(ValueError):
        _build(tmp_path, *flags)


def test_the_pairing_qr_points_at_the_proxy_name_when_one_is_set(tmp_path):
    config = _build(tmp_path, "--api-url", "http://10.66.0.1/6/",
                    "--user-url", "https://petkit.example.com/")

    auth, _ = lifecycle._open_user_plane(config, ha_addon=False)

    assert auth.settings.user_url == "https://petkit.example.com"


def test_the_pairing_qr_falls_back_to_the_api_host_and_user_port(tmp_path):
    config = _build(tmp_path, "--api-url", "http://192.168.1.5/6/")

    auth, _ = lifecycle._open_user_plane(config, ha_addon=False)

    assert auth.settings.user_url == "https://192.168.1.5:8443"
