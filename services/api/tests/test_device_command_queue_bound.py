"""A device's heartbeat command queue is capped, keeps the newest, and says when it drops.

A device that stopped polling never drains its queue while the panel, HA and
the patchers keep adding to it. `Device.enqueue_command` is the one way in, so
the cap holds for every producer; the last test fails on any producer that
appends to `command_queue` directly.
"""

import ast
import logging
from pathlib import Path

from my_petkit.devices.base import MAX_QUEUED_COMMANDS
from my_petkit.devices.registry import DeviceRegistry

PACKAGE = Path(__file__).resolve().parents[1] / "src" / "my_petkit"


def _queue_warnings(caplog):
    return [r for r in caplog.records if r.name == "my_petkit.devices.base"]


def _device():
    return DeviceRegistry().get_or_create(petkit_id=42, device_type="t5", serial_number="SN")


def test_below_the_cap_nothing_is_dropped_or_logged(caplog):
    dev = _device()
    with caplog.at_level(logging.WARNING, logger="my_petkit.devices.base"):
        for i in range(MAX_QUEUED_COMMANDS):
            dev.enqueue_command({"n": i})
    assert [c["n"] for c in dev.command_queue] == list(range(MAX_QUEUED_COMMANDS))
    assert not _queue_warnings(caplog)


def test_past_the_cap_the_oldest_are_dropped_and_the_device_is_named(caplog):
    dev = _device()
    with caplog.at_level(logging.WARNING, logger="my_petkit.devices.base"):
        for i in range(MAX_QUEUED_COMMANDS + 5):
            dev.enqueue_command({"n": i})
    assert [c["n"] for c in dev.command_queue] == list(range(5, MAX_QUEUED_COMMANDS + 5))
    warnings = _queue_warnings(caplog)
    assert len(warnings) == 5
    assert all("device=42" in r.getMessage() for r in warnings)


def test_pop_commands_still_drains_everything_oldest_first():
    dev = _device()
    for i in range(MAX_QUEUED_COMMANDS + 1):
        dev.enqueue_command(str(i))
    popped = dev.pop_commands()
    assert popped == [str(i) for i in range(1, MAX_QUEUED_COMMANDS + 1)]
    assert dev.command_queue == []
    assert dev.pop_commands() == []


def _direct_appends(tree: ast.AST) -> list[int]:
    return [node.lineno for node in ast.walk(tree)
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
            and node.func.attr in ("append", "extend", "insert")
            and isinstance(node.func.value, ast.Attribute)
            and node.func.value.attr == "command_queue"]


def test_nothing_outside_the_device_model_appends_to_the_queue_directly():
    owner = PACKAGE / "devices" / "base.py"
    offences = {str(p.relative_to(PACKAGE)): lines
                for p in sorted(PACKAGE.rglob("*.py")) if p != owner
                for lines in [_direct_appends(ast.parse(p.read_text(encoding="utf-8")))]
                if lines}
    assert not offences, f"use Device.enqueue_command instead: {offences}"
