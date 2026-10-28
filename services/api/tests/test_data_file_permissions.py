"""Everything this process writes under its data directory is owner-only.

`main()` applies `umask 077` and tightens the data directory to 0700 before
anything is written. These tests run the real writers -- the device registry,
the event store, the broker certificate, a device's sound list -- under that
setting and read back the modes they produced.
"""

import os
import stat

import pytest

from my_petkit.devices.registry import DeviceRegistry
from my_petkit.devices.sound_store import save_sounds, sounds_dir
from my_petkit.events.store import EventStore
from my_petkit.main import data_permissions
from my_petkit.mqtt.broker import ensure_self_signed

pytestmark = pytest.mark.skipif(os.name != "posix", reason="POSIX permission bits")


def _mode(path) -> int:
    return stat.S_IMODE(os.stat(path).st_mode)


@pytest.fixture
def data_dir(tmp_path):
    """A data dir created world-readable, as the Supervisor or an older version
    would have left it, with the process umask restored afterwards."""
    data = tmp_path / "data"
    data.mkdir()
    os.chmod(data, 0o755)  # noqa: S103 - the loose starting state under test
    previous = os.umask(0o022)
    try:
        data_permissions.secure_data_dir(str(data))
        yield data
    finally:
        os.umask(previous)


def test_the_data_dir_is_tightened_and_the_umask_set(data_dir):
    assert _mode(data_dir) == 0o700
    current = os.umask(0o077)
    assert current == 0o077


def test_a_missing_data_dir_is_created_owner_only(tmp_path):
    previous = os.umask(0o022)
    try:
        data_permissions.secure_data_dir(str(tmp_path / "fresh" / "data"))
        assert _mode(tmp_path / "fresh" / "data") == 0o700
    finally:
        os.umask(previous)


def test_an_unchmoddable_data_dir_is_logged_not_fatal(tmp_path, monkeypatch, caplog):
    def refuse(*args, **kwargs):
        raise PermissionError("not yours")

    previous = os.umask(0o022)
    monkeypatch.setattr(data_permissions.os, "chmod", refuse)
    try:
        data_permissions.secure_data_dir(str(tmp_path))
    finally:
        os.umask(previous)
    assert "Could not restrict data directory" in caplog.text


async def test_devices_json_is_owner_only(data_dir):
    reg = DeviceRegistry(persist_path=str(data_dir / "devices.json"))
    reg.get_or_create(1, "t5", serial_number="SN1")
    reg.save()
    assert _mode(data_dir / "devices.json") == 0o600


async def test_the_event_database_is_owner_only(data_dir):
    store = EventStore(data_dir / "petkit.db")
    await store.connect()
    try:
        created = [p for p in data_dir.iterdir() if p.name.startswith("petkit.db")]
        assert created
        for p in created:
            assert _mode(p) == 0o600, p.name
    finally:
        await store.close()


def test_the_broker_certificate_and_key_are_owner_only(data_dir):
    cert, key = data_dir / "certs" / "broker.crt", data_dir / "certs" / "broker.key"
    assert ensure_self_signed(str(cert), str(key))
    assert _mode(data_dir / "certs") == 0o700
    assert _mode(cert) == 0o600
    assert _mode(key) == 0o600


def test_a_device_sound_list_is_owner_only(data_dir):
    save_sounds(str(data_dir), 1, [{"id": 1, "name": "hello.mp3"}])
    assert _mode(data_dir / "sounds") == 0o700
    assert _mode(sounds_dir(str(data_dir), 1)) == 0o700
    assert _mode(os.path.join(sounds_dir(str(data_dir), 1), "sounds.json")) == 0o600


def test_main_secures_the_data_dir_before_anything_is_written():
    """Ordering is the point: after logging (so a warning is visible), before
    the sidebar flag file and before any service is built."""
    import inspect

    from my_petkit import main as main_module

    src = inspect.getsource(main_module.main)
    assert src.index("secure_data_dir(config.data_dir)") < src.index("show_in_sidebar_once")
    assert src.index("secure_data_dir(config.data_dir)") < src.index("build_services(")
    assert src.index("logging.basicConfig") < src.index("secure_data_dir(config.data_dir)")
