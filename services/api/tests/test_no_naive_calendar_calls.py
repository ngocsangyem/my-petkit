"""Local-calendar arithmetic goes through `utils/clock.py` and nowhere else.

A naive `datetime.fromtimestamp(ts)`, a bare `.astimezone()` or `time.localtime`
silently means "the zone of whatever process this runs in". That was fine while
the process zone was the only zone there was; it stops being fine the moment
the zone comes from configuration or from the device. This test fails on any
such call outside `clock`, so a new one cannot slip in beside the old ones.
"""

import ast
from pathlib import Path

import pytest

PACKAGE = Path(__file__).resolve().parents[1] / "src" / "my_petkit"
ALLOWED = {PACKAGE / "utils" / "clock.py"}

# (object name, attribute) pairs that read the PROCESS zone implicitly.
PROCESS_ZONE_CALLS = {("time", "localtime"), ("time", "mktime"), ("time", "strftime"),
                      ("time", "ctime"), ("time", "asctime"), ("datetime", "today"),
                      ("date", "today"), ("datetime", "utcfromtimestamp")}


def _offences(tree: ast.AST) -> list[tuple[int, str]]:
    found = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Attribute):
            continue
        attr = node.func.attr
        owner = node.func.value
        owner_name = owner.id if isinstance(owner, ast.Name) else (
            owner.attr if isinstance(owner, ast.Attribute) else "")
        has_tz = len(node.args) >= 2 or any(k.arg == "tz" for k in node.keywords)
        if (owner_name, attr) in PROCESS_ZONE_CALLS:
            found.append((node.lineno, f"{owner_name}.{attr}()"))
        elif attr == "fromtimestamp" and owner_name in ("datetime", "date") and not has_tz:
            found.append((node.lineno, f"{owner_name}.fromtimestamp() without tz"))
        elif attr == "now" and owner_name == "datetime" and not node.args and not node.keywords:
            found.append((node.lineno, "datetime.now() without tz"))
        elif attr == "astimezone" and not node.args and not node.keywords:
            found.append((node.lineno, ".astimezone() without a zone"))
    return found


def _modules() -> list[Path]:
    return sorted(p for p in PACKAGE.rglob("*.py") if p not in ALLOWED)


@pytest.mark.parametrize("path", _modules(), ids=lambda p: str(p.relative_to(PACKAGE)))
def test_module_reads_local_time_only_through_clock(path):
    offences = _offences(ast.parse(path.read_text(encoding="utf-8")))
    assert not offences, (
        f"{path.relative_to(PACKAGE)} reads the process timezone directly: {offences}. "
        "Use my_petkit.utils.clock instead."
    )


def test_the_detector_catches_each_forbidden_form():
    source = "\n".join([
        "time.localtime(t)", "time.mktime(x)", "time.strftime('%Y', t)",
        "datetime.fromtimestamp(t)", "datetime.now()", "d.astimezone()", "date.today()",
    ])
    assert len(_offences(ast.parse(source))) == 7


def test_the_detector_allows_explicit_zones():
    source = "\n".join([
        "datetime.fromtimestamp(t, timezone.utc)", "datetime.fromtimestamp(t, tz=z)",
        "datetime.now(timezone.utc)", "d.astimezone(z)", "time.time()",
    ])
    assert _offences(ast.parse(source)) == []
