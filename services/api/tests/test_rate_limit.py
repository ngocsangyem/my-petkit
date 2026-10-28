"""Rate limits on every secret-checking endpoint: per IP, global, exponential."""

from __future__ import annotations

from my_petkit.features.auth.rate_limit import (
    BASE_DELAY,
    FREE_FAILURES,
    GLOBAL_FREE_FAILURES,
    MAX_DELAY,
    WINDOW,
    RateLimiter,
)
from tests.conftest_auth import anonymous_client, bare_panel, install_auth, set_admin


class Clock:
    def __init__(self) -> None:
        self.now = 100.0

    def __call__(self) -> float:
        return self.now


def test_the_first_failures_are_free_then_the_lockout_doubles():
    clock = Clock()
    limiter = RateLimiter(clock)
    for _ in range(FREE_FAILURES):
        limiter.failure("login", "10.0.0.1")
        assert limiter.retry_after("login", "10.0.0.1") == 0
    waits = []
    for _ in range(4):
        limiter.failure("login", "10.0.0.1")
        waits.append(limiter.retry_after("login", "10.0.0.1"))
    assert waits == [BASE_DELAY, BASE_DELAY * 2, BASE_DELAY * 4, BASE_DELAY * 8]


def test_the_lockout_is_capped():
    limiter = RateLimiter(Clock())
    for _ in range(FREE_FAILURES + 40):
        limiter.failure("login", "10.0.0.1")
    assert limiter.retry_after("login", "10.0.0.1") == MAX_DELAY


def test_one_address_does_not_lock_out_another():
    limiter = RateLimiter(Clock())
    for _ in range(FREE_FAILURES + 3):
        limiter.failure("login", "10.0.0.1")
    assert limiter.retry_after("login", "10.0.0.1") > 0
    assert limiter.retry_after("login", "10.0.0.2") == 0


def test_many_addresses_trip_the_global_limit():
    limiter = RateLimiter(Clock())
    for i in range(GLOBAL_FREE_FAILURES + 1):
        limiter.failure("pairing", f"10.0.{i // 250}.{i % 250}")
    assert limiter.retry_after("pairing", "192.168.9.9") > 0


def test_buckets_are_independent():
    limiter = RateLimiter(Clock())
    for _ in range(FREE_FAILURES + 3):
        limiter.failure("pairing", "10.0.0.1")
    assert limiter.retry_after("login", "10.0.0.1") == 0


def test_counters_forget_after_the_window_and_on_success():
    clock = Clock()
    limiter = RateLimiter(clock)
    for _ in range(FREE_FAILURES + 1):
        limiter.failure("login", "10.0.0.1")
    clock.now += WINDOW + 1
    limiter.failure("login", "10.0.0.1")
    assert limiter.retry_after("login", "10.0.0.1") == 0

    for _ in range(FREE_FAILURES):
        limiter.failure("step_up", "10.0.0.1")
    limiter.success("step_up", "10.0.0.1")
    limiter.failure("step_up", "10.0.0.1")
    assert limiter.retry_after("step_up", "10.0.0.1") == 0


async def test_the_login_endpoint_answers_429_with_retry_after(tmp_path):
    app = bare_panel(tmp_path)
    set_admin(install_auth(app))
    client = anonymous_client(app)
    await client.start_server()
    try:
        for _ in range(FREE_FAILURES + 1):
            r = await client.post("/api/auth/login", json={"password": "wrong password!"})
            assert r.status == 401
        r = await client.post("/api/auth/login", json={"password": "wrong password!"})
        assert r.status == 429
        assert int(r.headers["Retry-After"]) >= 1
        assert (await r.json())["error"]["code"] == "rate_limited"
    finally:
        await client.close()


async def test_pairing_redeem_is_rate_limited(tmp_path):
    client = anonymous_client(bare_panel(tmp_path))
    await client.start_server()
    try:
        statuses = [
            (await client.post("/api/auth/pairing/redeem", json={"code": "guess"})).status
            for _ in range(FREE_FAILURES + 2)
        ]
        assert statuses[:FREE_FAILURES + 1] == [401] * (FREE_FAILURES + 1)
        assert statuses[-1] == 429
    finally:
        await client.close()


async def test_a_failed_login_is_logged_without_the_password(tmp_path, caplog):
    app = bare_panel(tmp_path)
    set_admin(install_auth(app))
    client = anonymous_client(app)
    await client.start_server()
    try:
        with caplog.at_level("WARNING", logger="my_petkit.audit"):
            await client.post("/api/auth/login", json={"password": "hunter2-is-wrong"})
        lines = [r.getMessage() for r in caplog.records if r.name == "my_petkit.audit"]
        assert any("auth_failure check=login" in line and "peer=127.0.0.1" in line
                   for line in lines)
        assert not any("hunter2" in line for line in caplog.text.splitlines())
    finally:
        await client.close()
