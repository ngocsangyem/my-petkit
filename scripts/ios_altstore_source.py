#!/usr/bin/env python3
"""Write the AltStore / SideStore source (apps.json) for one release IPA.

AltStore and SideStore poll a source URL and offer an update when its newest
version is newer than the installed one. The release publishes this file next
to the IPA, and the stable URL `releases/latest/download/apps.json` always
points at the newest stable release.

Everything about the app (name, bundle id, version, minimum iOS, privacy
strings) is read from the built app's Info.plist, so the source can never
disagree with the IPA it describes.
"""

from __future__ import annotations

import argparse
import json
import plistlib
import zipfile
from datetime import datetime, timezone
from pathlib import Path


def read_info_plist(ipa: Path) -> dict:
    with zipfile.ZipFile(ipa) as z:
        name = next(
            n
            for n in z.namelist()
            if n.startswith("Payload/")
            and n.count("/") == 2
            and n.endswith(".app/Info.plist")
        )
        return plistlib.loads(z.read(name))


def build_source(ipa: Path, repo: str, tag: str) -> dict:
    info = read_info_plist(ipa)
    base = f"https://github.com/{repo}"
    privacy = {
        k: v
        for k, v in sorted(info.items())
        if k.startswith("NS") and k.endswith("UsageDescription")
    }
    version = {
        "version": info["CFBundleShortVersionString"],
        "buildVersion": info["CFBundleVersion"],
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "localizedDescription": f"Release notes: {base}/releases/tag/{tag}",
        "downloadURL": f"{base}/releases/download/{tag}/{ipa.name}",
        "size": ipa.stat().st_size,
        "minOSVersion": info.get("MinimumOSVersion", "17.0"),
    }
    return {
        "name": "my-petkit",
        "identifier": f"{info['CFBundleIdentifier']}.source",
        "sourceURL": f"{base}/releases/latest/download/apps.json",
        "website": base,
        "apps": [
            {
                "name": info.get("CFBundleDisplayName", info["CFBundleName"]),
                "bundleIdentifier": info["CFBundleIdentifier"],
                "developerName": repo.split("/")[0],
                "subtitle": "Your PetKit devices, on your own server.",
                "localizedDescription": (
                    "The iOS client for a self-hosted my-petkit server: devices, timeline, "
                    "pets, live view and provisioning, with no PetKit cloud account."
                ),
                "versions": [version],
                "appPermissions": {"entitlements": [], "privacy": privacy},
            }
        ],
        "news": [],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("ipa", type=Path)
    parser.add_argument("--repo", required=True, help="owner/name on GitHub")
    parser.add_argument("--tag", required=True, help="the release tag, e.g. v2.1.0")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    source = build_source(args.ipa, args.repo, args.tag)
    args.out.write_text(json.dumps(source, indent=2) + "\n")


if __name__ == "__main__":
    main()
