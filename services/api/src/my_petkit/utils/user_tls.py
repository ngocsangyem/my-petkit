"""The user plane's self-signed TLS certificate, generated once per install.

`certs/user.crt` and `certs/user.key`, both 0600 in a 0700 directory. Clients
do not trust it through a CA: the pairing QR code carries its SHA-256
fingerprint and the iOS app pins exactly that, and a browser user accepts it
once. So it is never rotated behind the user's back — a new key means a new
fingerprint means every paired client must pair again — and it is valid for
ten years. Delete both files to rotate deliberately.

Separate from the device-facing broker certificate (`mqtt/broker.py`), whose
key the firmware sees and whose cipher suites are weakened for it.
"""

from __future__ import annotations

import datetime
import hashlib
import ipaddress
import logging
import os
import ssl
import stat
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import NameOID

log = logging.getLogger(__name__)

CERT_FILENAME = "user.crt"
KEY_FILENAME = "user.key"
VALIDITY_DAYS = 3650


def _private_write(path: Path, data: bytes) -> None:
    """Write `data` to a NEW file created 0600 (never briefly world-readable)."""
    tmp = path.with_suffix(path.suffix + ".tmp")
    if tmp.exists():
        tmp.unlink()
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        os.write(fd, data)
        os.fsync(fd)
    finally:
        os.close(fd)
    os.replace(tmp, path)


def _san(hosts: list[str]) -> x509.SubjectAlternativeName:
    names: list[x509.GeneralName] = []
    for host in dict.fromkeys(["localhost", "127.0.0.1", *hosts]):
        if not host:
            continue
        try:
            names.append(x509.IPAddress(ipaddress.ip_address(host)))
        except ValueError:
            names.append(x509.DNSName(host))
    return x509.SubjectAlternativeName(names)


def _generate(cert_path: Path, key_path: Path, hosts: list[str]) -> None:
    key = ec.generate_private_key(ec.SECP256R1())
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "my-petkit user plane")])
    now = datetime.datetime.now(datetime.UTC)
    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(minutes=5))
        .not_valid_after(now + datetime.timedelta(days=VALIDITY_DAYS))
        .add_extension(_san(hosts), critical=False)
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .sign(key, hashes.SHA256())
    )
    _private_write(
        key_path,
        key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        ),
    )
    _private_write(cert_path, cert.public_bytes(serialization.Encoding.PEM))
    log.info("user plane: generated a self-signed certificate")


def fingerprint_sha256(cert_path: Path) -> str:
    """Lower-case hex SHA-256 of the certificate's DER encoding."""
    cert = x509.load_pem_x509_certificate(cert_path.read_bytes())
    return hashlib.sha256(cert.public_bytes(serialization.Encoding.DER)).hexdigest()


def ensure_user_cert(certs_dir: Path, hosts: list[str]) -> tuple[Path, Path, str]:
    """The certificate and key paths, generating them on first run, plus the fingerprint.

    `hosts` (IP literals or names) are put in the SAN when generating; an
    existing certificate is kept as it is, since its fingerprint is pinned.
    """
    certs_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    if stat.S_IMODE(certs_dir.stat().st_mode) & 0o077:
        os.chmod(certs_dir, 0o700)
    cert_path, key_path = certs_dir / CERT_FILENAME, certs_dir / KEY_FILENAME
    if not (cert_path.exists() and key_path.exists()):
        _generate(cert_path, key_path, hosts)
    for path in (cert_path, key_path):
        if stat.S_IMODE(path.stat().st_mode) & 0o077:
            os.chmod(path, 0o600)
    return cert_path, key_path, fingerprint_sha256(cert_path)


def server_context(cert_path: Path, key_path: Path) -> ssl.SSLContext:
    """A TLS server context for the user plane: TLS 1.2+, library-default ciphers."""
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.minimum_version = ssl.TLSVersion.TLSv1_2
    ctx.load_cert_chain(str(cert_path), str(key_path))
    return ctx
