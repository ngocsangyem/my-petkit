#!/usr/bin/env python3
"""Fail CI on high/critical dependency vulnerabilities reported by osv-scanner.

osv-scanner exits 1 on ANY finding and has no severity floor, which would make
every low-severity advisory block merge. This reads its JSON report and fails
only when a vulnerability group's max CVSS score reaches the threshold.

Usage: osv-severity-gate.py <report.json> <min-score> <osv-exit-code>

Exit codes from osv-scanner: 0 = clean, 1 = findings (parse the report),
128 = no package sources found (nothing to audit yet). Anything else is a
scanner error and fails the gate rather than passing silently.
"""

import json
import sys

NO_PACKAGE_SOURCES = 128


def main() -> int:
    report_path, min_score_arg, rc_arg = sys.argv[1:4]
    min_score = float(min_score_arg)
    rc = int(rc_arg)

    if rc == NO_PACKAGE_SOURCES:
        print("osv-scanner: no lockfiles found; nothing to audit")
        return 0
    if rc not in (0, 1):
        print(f"osv-scanner failed with exit code {rc}", file=sys.stderr)
        return 1

    with open(report_path, encoding="utf-8") as fh:
        report = json.load(fh)

    blocking = []
    for result in report.get("results") or []:
        source = result.get("source", {}).get("path", "?")
        for pkg in result.get("packages") or []:
            name = pkg.get("package", {}).get("name", "?")
            version = pkg.get("package", {}).get("version", "?")
            for group in pkg.get("groups") or []:
                try:
                    score = float(group.get("max_severity") or 0)
                except ValueError:
                    score = 0.0
                ids = ",".join(group.get("ids") or [])
                line = f"{source}: {name}@{version} {ids} (CVSS {score})"
                print(line)
                if score >= min_score:
                    blocking.append(line)

    if blocking:
        print(f"\n{len(blocking)} finding(s) at or above CVSS {min_score}:", file=sys.stderr)
        for line in blocking:
            print(f"  {line}", file=sys.stderr)
        return 1
    print(f"no finding at or above CVSS {min_score}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
