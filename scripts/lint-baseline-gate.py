#!/usr/bin/env python3
"""Fail when ruff or mypy reports a hit that the ported-code baseline does not cover.

Ported upstream code is not reformatted and not sprinkled with `noqa` or
`type: ignore`, so it must stay diffable against upstream. Its existing hits
are counted per (rule, file) in services/api/{ruff,mypy}-baseline.txt.
Counting per file instead of per line keeps the baseline stable when unrelated
lines move.

Usage (from services/api):
  lint-baseline-gate.py ruff <ruff-binary> <baseline> <paths...>
  lint-baseline-gate.py mypy <mypy-binary> <baseline> <paths...>
"""

import collections
import re
import subprocess  # noqa: S404 - runs the ruff binary with a fixed argv
import sys

TOOLS = {
    "ruff": (
        ["check", "--output-format", "concise", "--no-fix"],
        re.compile(r"^(?P<file>[^:\s]+):\d+:\d+: (?P<rule>[A-Z]+\d+)"),
    ),
    "mypy": (
        ["--ignore-missing-imports", "--no-error-summary", "--no-pretty"],
        re.compile(r"^(?P<file>[^:\s]+):\d+: error: .*\[(?P<rule>[a-z-]+)\]$"),
    ),
}


def load_baseline(path: str) -> dict[tuple[str, str], int]:
    counts: dict[tuple[str, str], int] = {}
    with open(path, encoding="utf-8") as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            rule, file, count = line.split()
            counts[(rule, file)] = int(count)
    return counts


def current_hits(tool: str, binary: str, paths: list[str]) -> collections.Counter[tuple[str, str]]:
    args, hit = TOOLS[tool]
    result = subprocess.run(  # noqa: S603 - argv list, binary from the caller's venv
        [binary, *args, *paths],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode not in (0, 1):
        sys.exit(f"{tool} failed ({result.returncode}):\n{result.stderr}")
    hits: collections.Counter[tuple[str, str]] = collections.Counter()
    for line in result.stdout.splitlines():
        match = hit.match(line)
        if match:
            hits[(match["rule"], match["file"])] += 1
    return hits


def main() -> int:
    tool, binary, baseline_path, *paths = sys.argv[1:]
    baseline = load_baseline(baseline_path)
    hits = current_hits(tool, binary, paths)

    grown = [
        (rule, file, count, baseline.get((rule, file), 0))
        for (rule, file), count in sorted(hits.items())
        if count > baseline.get((rule, file), 0)
    ]
    shrunk = [
        (rule, file, hits.get((rule, file), 0), allowed)
        for (rule, file), allowed in sorted(baseline.items())
        if hits.get((rule, file), 0) < allowed
    ]
    for rule, file, now, allowed in shrunk:
        print(f"note: {rule} {file} dropped {allowed} -> {now}; lower {baseline_path}")
    if grown:
        print(f"new {tool} hits beyond the ported-code baseline:", file=sys.stderr)
        for rule, file, now, allowed in grown:
            print(f"  {rule} {file}: {now} (baseline {allowed})", file=sys.stderr)
        return 1
    print(f"{tool}: no hit beyond baseline ({sum(hits.values())} baselined)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
