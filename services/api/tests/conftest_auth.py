"""A panel test client that is already signed in: `authed_client`.

Every panel route needs a principal now, so the panel tests talk to the app
the way the iOS client does — with a client token in `Authorization` — and,
unless a test says otherwise, with a fresh step-up so R3 routes behave as they
did before auth existed. Tests ABOUT auth build their own state instead.

`authed_test_client(app)` is the plain function (module helpers that build a
client cannot take fixtures); `authed_client` is the same thing as a fixture
that also closes the client.
"""

from __future__ import annotations

import shutil
import tempfile
import time
from collections.abc import AsyncIterator, Awaitable, Callable
from pathlib import Path

import pytest
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer

from my_petkit.devices.ble import BLERegistry
from my_petkit.devices.registry import DeviceRegistry
from my_petkit.features.auth.passwords import hash_password_sync
from my_petkit.features.auth.service import AuthService, UserPlaneSettings
from my_petkit.features.auth.sessions import COOKIE_NAME
from my_petkit.shared.appkeys import AUTH
from my_petkit.web.hub import EventHub
from my_petkit.web.panel import create_panel_app

#: The admin password the auth tests set.
ADMIN_PASSWORD = "correct horse battery staple"


def install_auth(app: web.Application, settings: UserPlaneSettings | None = None) -> AuthService:
    """Give `app` an `AuthService` in a temp dir removed at app cleanup.

    Reuses the one already installed, so two clients on one app share it.
    """
    existing = app.get(AUTH)
    if isinstance(existing, AuthService):
        return existing
    data_dir = Path(tempfile.mkdtemp(prefix="auth-test-"))
    auth = AuthService(data_dir, settings)
    app[AUTH] = auth

    async def _cleanup(_app: web.Application) -> None:
        auth.close()
        shutil.rmtree(data_dir, ignore_errors=True)

    app.on_cleanup.append(_cleanup)
    return auth


def bare_panel(tmp_path: Path, *, live_config: dict | None = None,
               registry: DeviceRegistry | None = None,
               event_store: object = None) -> web.Application:
    """A panel with empty registries and its data dirs under `tmp_path`."""
    cfg = {"data_dir": str(tmp_path), "media_root": str(tmp_path / "media"),
           "capture_dir": str(tmp_path / "capture"), "device_log_root": str(tmp_path / "logs"),
           "settings_path": str(tmp_path / "settings_overrides.json")}
    return create_panel_app(registry or DeviceRegistry(), BLERegistry(), EventHub(), cfg, None,
                            live_config=live_config, event_store=event_store)


def set_admin(auth: AuthService, password: str = ADMIN_PASSWORD) -> None:
    """Create (or reset) the admin directly in the store."""
    auth.store.set_admin_password(hash_password_sync(password), time.time())


async def session_cookie(client: TestClient, password: str = ADMIN_PASSWORD) -> str:
    """Log in through the real endpoint; returns the `Cookie` header value."""
    r = await client.post("/api/auth/login", json={"password": password},
                          headers={"Origin": f"http://{client.host}:{client.port}"})
    assert r.status == 200, await r.text()
    return f"{COOKIE_NAME}={r.cookies[COOKIE_NAME].value}"


def anonymous_client(app: web.Application) -> TestClient:
    """A client with no credential at all (auth still installed on the app)."""
    install_auth(app)
    return TestClient(TestServer(app))


def authed_test_client(app: web.Application, *, step_up: bool = True) -> TestClient:
    """A `TestClient` carrying a valid client token (and, by default, a step-up)."""
    auth = install_auth(app)
    token_id, raw = auth.tokens.issue("test")
    if step_up:
        auth.step_ups.grant(f"token:{token_id}")
    return TestClient(TestServer(app), headers={"Authorization": f"Bearer {raw}"})


@pytest.fixture
async def authed_client() -> AsyncIterator[Callable[..., Awaitable[TestClient]]]:
    """`authed_client(app, step_up=True)` -> a started, signed-in client."""
    clients: list[TestClient] = []

    async def make(app: web.Application, *, step_up: bool = True) -> TestClient:
        client = authed_test_client(app, step_up=step_up)
        await client.start_server()
        clients.append(client)
        return client

    yield make
    for client in clients:
        await client.close()
