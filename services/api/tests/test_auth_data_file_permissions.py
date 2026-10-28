"""Auth data and the user-plane TLS material are private to the process user."""

from __future__ import annotations

import os
import stat

from my_petkit.features.auth.install_secrets import (
    MEDIA_URL_KEY_FILE,
    SECRETS_DIRNAME,
    SESSION_KEY_FILE,
    load_or_create_key,
)
from my_petkit.features.auth.service import AuthService
from my_petkit.features.auth.store import AUTH_DB_FILENAME
from my_petkit.utils.user_tls import ensure_user_cert, fingerprint_sha256


def _mode(path) -> int:
    return stat.S_IMODE(os.stat(path).st_mode)


def test_auth_db_and_keys_are_created_private(tmp_path):
    AuthService(tmp_path).close()
    assert _mode(tmp_path / AUTH_DB_FILENAME) == 0o600
    assert _mode(tmp_path / SECRETS_DIRNAME) == 0o700
    for name in (SESSION_KEY_FILE, MEDIA_URL_KEY_FILE):
        assert _mode(tmp_path / SECRETS_DIRNAME / name) == 0o600


def test_keys_are_per_install_and_stable_across_restarts(tmp_path):
    a = load_or_create_key(tmp_path / "one" / "k")
    assert a == load_or_create_key(tmp_path / "one" / "k")
    assert a != load_or_create_key(tmp_path / "two" / "k")
    assert len(a) == 32


def test_a_loose_existing_file_is_tightened(tmp_path):
    AuthService(tmp_path).close()
    os.chmod(tmp_path / AUTH_DB_FILENAME, 0o644)
    os.chmod(tmp_path / SECRETS_DIRNAME / SESSION_KEY_FILE, 0o644)
    AuthService(tmp_path).close()
    assert _mode(tmp_path / AUTH_DB_FILENAME) == 0o600
    assert _mode(tmp_path / SECRETS_DIRNAME / SESSION_KEY_FILE) == 0o600


def test_user_tls_certificate_and_key_are_private(tmp_path):
    cert, key, fp = ensure_user_cert(tmp_path / "certs", ["192.168.1.10", "petkit.example"])
    assert _mode(tmp_path / "certs") == 0o700
    assert _mode(cert) == 0o600
    assert _mode(key) == 0o600
    assert fp == fingerprint_sha256(cert)
    assert len(fp) == 64


def test_the_certificate_is_kept_so_its_pinned_fingerprint_holds(tmp_path):
    _c, _k, first = ensure_user_cert(tmp_path / "certs", ["192.168.1.10"])
    _c, _k, second = ensure_user_cert(tmp_path / "certs", ["10.0.0.9"])
    assert first == second


def test_two_installs_never_share_a_certificate(tmp_path):
    _c, _k, a = ensure_user_cert(tmp_path / "a", [])
    _c, _k, b = ensure_user_cert(tmp_path / "b", [])
    assert a != b
