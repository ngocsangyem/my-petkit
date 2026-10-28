"""Panel handlers read the app's collaborators through `web/appkeys.py`, never a typed string.

A misspelt string read is silently wrong: `request.app.get("event_hub")` is just
None on an app that stores the hub as `hub`, and the handler then answers
"not wired" for a collaborator that is right there. Spelling every read through
the constants makes a typo an import error instead. This test fails on any
string-literal subscript or `.get(...)` of `request.app` / `app` under `web/api/`.
"""

import ast
from pathlib import Path

import pytest

API_DIR = Path(__file__).resolve().parents[1] / "src" / "my_petkit" / "web" / "api"


def _is_app(node: ast.AST) -> bool:
    """`app` or `<anything>.app` — the panel Application, however it was reached."""
    if isinstance(node, ast.Name):
        return node.id == "app"
    return isinstance(node, ast.Attribute) and node.attr == "app"


def _is_str(node: ast.AST) -> bool:
    return isinstance(node, ast.Constant) and isinstance(node.value, str)


def _bare_string_reads(tree: ast.AST) -> list[tuple[int, str]]:
    found = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Subscript) and _is_app(node.value) and _is_str(node.slice):
            found.append((node.lineno, f"app[{node.slice.value!r}]"))  # type: ignore[attr-defined]
        elif (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
              and node.func.attr == "get" and _is_app(node.func.value)
              and node.args and _is_str(node.args[0])):
            found.append((node.lineno, f"app.get({node.args[0].value!r})"))  # type: ignore[attr-defined]
    return found


@pytest.mark.parametrize("path", sorted(API_DIR.glob("*.py")), ids=lambda p: p.name)
def test_web_api_reads_app_keys_through_the_appkeys_constants(path):
    offences = _bare_string_reads(ast.parse(path.read_text(encoding="utf-8")))
    assert not offences, f"{path.name}: " + ", ".join(f"line {n}: {s}" for n, s in offences)


def test_the_check_catches_both_read_forms():
    """Guards the guard: a checker that matched nothing would pass every file."""
    src = 'h = request.app["event_hub"]\np = app.get("publisher")\nok = request.app[HUB]\n'
    assert [s for _, s in _bare_string_reads(ast.parse(src))] == [
        "app['event_hub']", "app.get('publisher')"]
