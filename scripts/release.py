#!/usr/bin/env python3
"""Bump the version and tag a release.

Home Assistant reports the manifest version while HACS reports the tag, so the two
have to agree or users see one number in HACS and a different one in Home Assistant.
Doing it by hand invites exactly that mismatch, so this does both in one step, and
CI rejects a tag that disagrees with the manifest.

    python scripts/release.py 0.2.0
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "custom_components" / "lightcurve" / "manifest.json"
SEMVER = re.compile(r"^\d+\.\d+\.\d+$")


def run(*args: str) -> str:
    return subprocess.run(
        args, cwd=ROOT, check=True, capture_output=True, text=True
    ).stdout.strip()


def main(argv: list[str]) -> int:
    if len(argv) != 2 or not SEMVER.match(argv[1]):
        print(__doc__)
        print("version must look like 1.2.3")
        return 2
    version = argv[1]

    if run("git", "status", "--porcelain"):
        print("working tree is not clean; commit or stash first")
        return 1

    manifest = json.loads(MANIFEST.read_text())
    previous = manifest["version"]
    if previous == version:
        print(f"manifest is already {version}")
        return 1

    manifest["version"] = version
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")

    run("git", "add", str(MANIFEST))
    run("git", "commit", "-m", f"Release {version}")
    run("git", "tag", "-a", f"v{version}", "-m", f"Lightcurve {version}")

    print(f"  {previous} -> {version}, committed and tagged v{version}")
    print("  push both to publish:  git push origin main --follow-tags")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
