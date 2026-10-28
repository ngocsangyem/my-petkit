"""Background work a panel request starts and the app must outlive.

Shared because a feature (the patchers) starts such work and the composition
root (`web/panel.py`) owns the set it lives in and drains it at shutdown.
"""
from __future__ import annotations

import asyncio
import logging
from collections.abc import Coroutine
from typing import Any

from aiohttp import web

from my_petkit.shared.appkeys import BACKGROUND_TASKS

log = logging.getLogger("my_petkit.web.panel")


def _log_background_result(task: asyncio.Task) -> None:
    """Retrieve a finished task's exception so it is logged, not swallowed."""
    if task.cancelled():
        return
    exc = task.exception()
    if exc is not None:
        log.error("panel: background task %s failed: %s", task.get_name(), exc, exc_info=exc)


def _spawn_background(app: web.Application, coro: Coroutine[Any, Any, Any], *,
                      name: str) -> asyncio.Task:
    """Run `coro` detached from the request that started it.

    The event loop only keeps a weak reference to a running task, so a bare
    `create_task` can be garbage-collected mid-flight — a patcher run would then
    stop somewhere between downloading a binary and uploading the patched one,
    silently. The task is registered on the app instead, which both pins it and
    lets shutdown drain it (`cancel_background_tasks`).

    Args:
        name: Shown in logs; make it identify the request that spawned it.
    """
    task = asyncio.create_task(coro, name=name)
    tasks: set[asyncio.Task] = app[BACKGROUND_TASKS]
    tasks.add(task)
    task.add_done_callback(tasks.discard)
    task.add_done_callback(_log_background_result)
    return task


async def cancel_background_tasks(app: web.Application) -> None:
    """Cancel and await every in-flight background task.

    Registered as an `on_cleanup` hook by `create_panel_app`, so an
    `AppRunner.cleanup()` (what main.py already calls for the panel) drains
    them. Safe to call directly and safe to call twice.
    """
    tasks = list(app.get(BACKGROUND_TASKS) or ())
    for task in tasks:
        task.cancel()
    for task in tasks:
        try:
            await task
        except asyncio.CancelledError:
            pass
        except Exception:
            # Already reported by _log_background_result; awaiting here would
            # otherwise re-raise into aiohttp's shutdown and abort it.
            pass
