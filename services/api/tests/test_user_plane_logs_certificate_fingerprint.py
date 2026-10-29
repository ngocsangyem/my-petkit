"""The user plane's certificate fingerprint is in the log at start-up."""

import logging
from types import SimpleNamespace

from my_petkit.main.lifecycle import _open_user_plane


def test_start_up_logs_the_fingerprint_a_client_will_pin(tmp_path, caplog):
    config = SimpleNamespace(
        api_url="http://192.168.1.20", user_hosts="", user_bind_host="127.0.0.1",
        data_dir=str(tmp_path), web_port=8099, user_port=8443,
    )
    with caplog.at_level(logging.INFO, logger="my_petkit.main.lifecycle"):
        auth, _ = _open_user_plane(config, ha_addon=False)
    assert f"SHA-256 {auth.settings.cert_sha256}" in caplog.text
