#!/usr/bin/env python3
"""Golden check: device-facing output must not change across a refactor.

Runs `golden_scenarios.py` twice, once against the working tree and once
against a git ref checked out into a temporary worktree, each in a fresh
interpreter whose PYTHONPATH points at that version's `services/api/src`. The
two JSON documents must be identical. Run it under each timezone the change
could affect (`--tz UTC --tz Asia/Saigon`); each TZ is compared with the
baseline under the same TZ.

Usage:
  scripts/golden_device_responses.py --against phase-02-baseline [--tz UTC ...]
  scripts/golden_device_responses.py --emit out.json    # working tree only

Exit status 0 when identical, 1 with a unified diff otherwise.
"""

from __future__ import annotations

import argparse
import difflib
import os
import shutil
import subprocess  # noqa: S404 - fixed argv, no shell
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SCENARIOS = Path(__file__).resolve().parent / "golden_scenarios.py"


def emit(src_dir: Path, out: Path, tz: str) -> None:
    """Run the scenarios against the package under `src_dir` into `out`."""
    with tempfile.TemporaryDirectory(prefix="golden-data-") as scratch:
        # Same data-dir path for both runs, so no path differs by checkout.
        data_dir = Path(tempfile.gettempdir()) / "my-petkit-golden-data"
        shutil.rmtree(data_dir, ignore_errors=True)
        env = {**os.environ, "PYTHONPATH": str(src_dir), "GOLDEN_SRC": str(src_dir), "TZ": tz, "PYTHONHASHSEED": "0"}
        result = subprocess.run(  # noqa: S603 - argv built from constants and paths
            [sys.executable, str(SCENARIOS), str(out), str(data_dir)],
            cwd=scratch, env=env, capture_output=True, text=True, check=False,
        )
        if result.returncode != 0:
            sys.exit(f"scenarios failed against {src_dir} (TZ={tz}):\n{result.stderr[-4000:]}")


def checkout(ref: str, into: Path) -> Path:
    subprocess.run(  # noqa: S603
        ["git", "-C", str(REPO), "worktree", "add", "--detach", str(into), ref],  # noqa: S607
        check=True, capture_output=True,
    )
    return into / "services" / "api" / "src"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--against", help="git ref to compare the working tree with")
    parser.add_argument("--emit", type=Path, help="write the working tree's output here")
    parser.add_argument("--tz", action="append", default=None, help="timezone(s) to run under")
    args = parser.parse_args()
    zones = args.tz or ["UTC", "Asia/Saigon"]
    current_src = REPO / "services" / "api" / "src"

    if args.emit:
        emit(current_src, args.emit, zones[0])
        return 0
    if not args.against:
        parser.error("--against or --emit is required")

    status = 0
    with tempfile.TemporaryDirectory(prefix="golden-") as tmp:
        tmpdir = Path(tmp)
        base_src = checkout(args.against, tmpdir / "baseline")
        try:
            for tz in zones:
                base_out, cur_out = tmpdir / f"base-{tz.replace('/', '_')}.json", tmpdir / "cur.json"
                emit(base_src, base_out, tz)
                emit(current_src, cur_out, tz)
                base_lines = base_out.read_text().splitlines(keepends=True)
                cur_lines = cur_out.read_text().splitlines(keepends=True)
                if base_lines == cur_lines:
                    print(f"golden: identical to {args.against} under TZ={tz} ({len(cur_lines)} lines)")
                    continue
                status = 1
                print(f"golden: DIFFERS from {args.against} under TZ={tz}")
                sys.stdout.writelines(difflib.unified_diff(
                    base_lines, cur_lines, f"{args.against} TZ={tz}", f"working tree TZ={tz}"))
        finally:
            subprocess.run(  # noqa: S603
                ["git", "-C", str(REPO), "worktree", "remove", "--force", str(tmpdir / "baseline")],  # noqa: S607
                check=False, capture_output=True,
            )
    return status


if __name__ == "__main__":
    sys.exit(main())
