"""With `--ha-addon`, explicit command-line flags must still be applied.

`build_config`'s docstring says "Flags always win over the add-on options, so a
bad option file can be overridden without editing it", but every flag is
applied only in the non-add-on branch.
"""
import pytest

from my_petkit.config import Config
from my_petkit.main import cli


@pytest.mark.xfail(strict=True, reason="build_config ignores every CLI flag when "
                   "--ha-addon is set")
def test_flags_override_add_on_options_in_add_on_mode(monkeypatch, tmp_path):
    def add_on_options(cls) -> Config:
        c = cls()
        c.http_port = 80
        c.data_dir = str(tmp_path)
        c.api_url = "http://192.168.1.5/6/"
        c.ha_mqtt_host = ""
        return c

    monkeypatch.setattr(Config, "from_ha_addon", classmethod(add_on_options))
    args = cli.parse_args([
        "--ha-addon",
        "--port", "8080",
        "--api-url", "http://10.0.0.7:8080/6/",
        "--ha-mqtt-host", "10.0.0.2",
        "--debug",
    ])
    config = cli.build_config(args)

    assert config.http_port == 8080
    assert config.api_url == "http://10.0.0.7:8080/6/"
    assert config.ha_mqtt_host == "10.0.0.2"
    assert config.log_level == "DEBUG"
