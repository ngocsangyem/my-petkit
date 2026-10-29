"""Fixtures shared across the suite.

Only setups that several test modules were building by hand live here. Nothing
else is centralised: pytest's own `tmp_path` already covers "a temp data dir",
and the app/client wiring differs enough per module that a shared factory would
hide more than it saves.

Every fixture is function-scoped on purpose. `asyncio_mode = "auto"` gives each
test a fresh event loop, and an `EventStore` binds its aiosqlite pool to the
loop that first touched it — a session-scoped store would hand the second test
a pool attached to a closed loop.
"""
from __future__ import annotations

from collections.abc import AsyncIterator
from pathlib import Path

import pytest

from my_petkit.ai.pets import PetRegistry
from my_petkit.events.store import EventStore
from my_petkit.http import upstream_allowlist


def pytest_addoption(parser):
    parser.addoption("--firmware", action="store_true", default=False,
                     help="run tests that need real firmware in tests/firmware/")


def pytest_collection_modifyitems(config, items):
    if config.getoption("--firmware"):
        return
    skip = pytest.mark.skip(reason="needs --firmware (and tests/firmware/)")
    for item in items:
        if "firmware" in item.keywords:
            item.add_marker(skip)


@pytest.fixture
async def event_store(tmp_path: Path) -> AsyncIterator[EventStore]:
    """An empty EventStore under a per-test directory.

    Teardown disposes the connection pool, which the hand-rolled helpers this
    replaced never did — they kept a `TemporaryDirectory` object alive as a
    return value and leaked both it and the engine.
    """
    store = EventStore(tmp_path / "petkit.db")
    yield store
    await store.close()


@pytest.fixture
def pet_registry(event_store: EventStore, tmp_path: Path) -> PetRegistry:
    """A PetRegistry backed by `event_store`, hosting faces under `tmp_path`."""
    return PetRegistry(event_store, str(tmp_path / "faces"))


#: Entry script of the minimal web app build `web_build` writes.
WEB_ENTRY = "index-Ab12_cd.js"


@pytest.fixture
def web_build(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """A minimal web app build, served instead of `apps/web/dist`.

    The panel serves the build at `/`, and a checkout need not have built it, so
    every test that reaches the document or a build file brings this one: an
    index naming a hashed entry, the entry itself, and a file at the top level.
    """
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text(
        f'<!doctype html><script type="module" src="./assets/{WEB_ENTRY}"></script>'
    )
    (dist / "assets" / WEB_ENTRY).write_text("export {};")
    (dist / "favicon.svg").write_text("<svg/>")
    monkeypatch.setenv("MY_PETKIT_WEB_DIST", str(dist))
    return dist


# The signed-in panel client lives in its own module; re-exported here so
# pytest registers the fixture for every test.
from tests.conftest_auth import authed_client  # noqa: E402, F401


@pytest.fixture(autouse=True)
def _a_loopback_test_server_stands_in_for_petkit(monkeypatch: pytest.MonkeyPatch) -> None:
    """Admit `127.0.0.1` / `localhost` as a proxy upstream in every test.

    Proxy, cloud-fetch and panel tests forward to a local aiohttp server playing
    PetKit. Production admits only PetKit/Aliyun hosts; that allowlist itself is
    tested, unpatched, in `test_proxy_upstream_allowlist.py`.
    """
    real = upstream_allowlist.is_allowed_upstream_host
    monkeypatch.setattr(upstream_allowlist, "is_allowed_upstream_host",
                        lambda host: host in ("127.0.0.1", "localhost") or real(host))
