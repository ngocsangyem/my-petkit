"""The collected test IDs must equal the imported baseline, plus/minus the ledger.

`baseline-test-ids.txt` is the upstream suite's `pytest --collect-only` at the
imported commit, with the rename applied. A count ("1697 pass") cannot catch a
test that was deleted and replaced by a weaker one; a set of IDs can. Every
deliberate difference is declared in `TEST-LEDGER.md` as a line

    - added: tests/test_x.py::test_name
    - removed: tests/test_x.py::test_name

with the reason next to it, so a change to the suite is always a reviewed one.
"""

import re
import subprocess  # noqa: S404 - fixed argv, no shell, no external input
import sys
from pathlib import Path

API_DIR = Path(__file__).resolve().parents[1]
BASELINE = API_DIR / "tests" / "baseline-test-ids.txt"
LEDGER = API_DIR / "tests" / "TEST-LEDGER.md"
LEDGER_LINE = re.compile(r"^- (added|removed): (\S+::.+?)\s*$", re.MULTILINE)


def _ledger() -> tuple[set[str], set[str]]:
    added: set[str] = set()
    removed: set[str] = set()
    for kind, test_id in LEDGER_LINE.findall(LEDGER.read_text(encoding="utf-8")):
        (added if kind == "added" else removed).add(test_id)
    return added, removed


def _collected() -> set[str]:
    result = subprocess.run(  # noqa: S603 - argv list built from constants
        [sys.executable, "-m", "pytest", "--collect-only", "-q", "-p", "no:cacheprovider"],
        cwd=API_DIR,
        capture_output=True,
        text=True,
        check=False,
        timeout=300,
    )
    assert result.returncode == 0, f"collection failed:\n{result.stdout}\n{result.stderr}"
    return {line for line in result.stdout.splitlines() if "::" in line}


def test_ledger_entries_do_not_contradict_each_other():
    added, removed = _ledger()
    assert not added & removed, f"declared both added and removed: {sorted(added & removed)}"


def test_collected_ids_match_baseline_plus_ledger():
    baseline = {line for line in BASELINE.read_text(encoding="utf-8").splitlines() if line}
    added, removed = _ledger()
    expected = (baseline - removed) | added
    collected = _collected()

    missing = sorted(expected - collected)
    unexpected = sorted(collected - expected)
    assert not missing and not unexpected, (
        "test IDs differ from baseline + TEST-LEDGER.md.\n"
        f"missing ({len(missing)}): {missing[:20]}\n"
        f"unexpected ({len(unexpected)}): {unexpected[:20]}\n"
        "Declare each deliberate change in tests/TEST-LEDGER.md with its reason."
    )
