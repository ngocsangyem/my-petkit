#!/usr/bin/env bash
# Import the petkit-local Python package and tests into services/api and apply
# the my-petkit rename. Re-runnable: it overwrites services/api/src/my_petkit
# and services/api/tests with a fresh renamed copy, so local edits there are
# lost. Use it for the initial import and, on a scratch checkout, to produce a
# renamed upstream to diff against when porting a new upstream commit.
#
# Usage: scripts/rename-from-upstream.sh <path-to-petkit-local-checkout>
#
# The rename is total: package, slug, HA topics, unique ids, data dir AND the
# literals sent to devices. The device-facing literals are listed in
# UPSTREAM.md; tests cannot prove a device accepts them (the tests are renamed
# by the same substitution), only the hardware runbook can.
set -euo pipefail

UPSTREAM="${1:?usage: $0 <petkit-local checkout>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="$ROOT/services/api"

[ -d "$UPSTREAM/addon/petkit_local" ] || { echo "not a petkit-local checkout: $UPSTREAM" >&2; exit 1; }

mkdir -p "$API/src" "$API/tests"
rsync -a --delete --exclude '*cache__' --exclude '*.pyc' \
  "$UPSTREAM/addon/petkit_local/" "$API/src/my_petkit/"
# tests/firmware/ holds vendor firmware blobs; it is never imported.
rsync -a --delete --exclude '*cache__' --exclude '*.pyc' --exclude 'firmware/' \
  --exclude 'baseline-test-ids.txt' --exclude 'TEST-LEDGER.md' \
  --exclude 'test_collected_ids_match_baseline.py' \
  "$UPSTREAM/addon/tests/" "$API/tests/"

# Add-on manifest and its docs. The repository URL and image owner are this
# repository's, not upstream's.
mkdir -p "$ROOT/addon"
for f in config.yaml DOCS.md CHANGELOG.md README.md; do
  cp "$UPSTREAM/addon/$f" "$ROOT/addon/$f"
done
cp "$UPSTREAM/repository.yaml" "$ROOT/repository.yaml"
sed -i.bak -e 's#alex-so-3/petkit-local#ngocsangyem/my-petkit#g' -e 's#alex-so-3#ngocsangyem#g' \
  "$ROOT/addon/config.yaml" "$ROOT/repository.yaml" && rm -f "$ROOT/addon/config.yaml.bak" "$ROOT/repository.yaml.bak"

# Order matters: the longest/most specific spellings first.
SUBST=(
  's/petkit_local/my_petkit/g'
  's/petkit-local/my-petkit/g'
  's/petkitlocal/mypetkit/g'
  's/PetKit Local/My PetKit/g'
  's/PetKit-Local/My-PetKit/g'
)
sed_args=()
for s in "${SUBST[@]}"; do sed_args+=(-e "$s"); done

# Text files only; binaries (dropbear, images) are left byte-identical.
while IFS= read -r -d '' f; do
  if grep -Iq . "$f"; then
    sed -i.bak "${sed_args[@]}" "$f" && rm -f "$f.bak"
  fi
done < <(find "$API/src/my_petkit" "$API/tests" "$ROOT/addon" "$ROOT/repository.yaml" -type f -print0)

# Fixture sanitising: a BSSID with the shape of a real access-point MAC is
# geolocatable through public Wi-Fi databases. Replace it with the fake used by
# the other fixtures. Nothing asserts on it.
sed -i.bak -e 's/"ssid": "HomeWIFI", "rsq": -48, "bssid": "60d8a4e83040"/"ssid": "ExampleNet", "rsq": -48, "bssid": "000000000000"/' \
  "$API/tests/test_state_parsers.py" && rm -f "$API/tests/test_state_parsers.py.bak"

# Mechanical path fix for the src/ layout: tests that build paths into the
# package from their own location.
while IFS= read -r -d '' f; do
  sed -i.bak -E \
    -e 's#(parents\[1\]) / "my_petkit"#\1 / "src" / "my_petkit"#g' \
    -e 's#(parent\.parent) / "my_petkit"#\1 / "src" / "my_petkit"#g' \
    -e 's#^( *)/ "my_petkit" /#\1/ "src" / "my_petkit" /#' \
    -e 's#(parents\[1\]) / "my_petkit/#\1 / "src/my_petkit/#g' \
    "$f" && rm -f "$f.bak"
done < <(find "$API/tests" -name '*.py' -type f -print0)

# test_version.py reads the add-on manifest and changelog, which now live at the
# repository root under addon/, not next to pyproject.toml.
sed -i.bak \
  -e 's#^ADDON = Path(__file__).resolve().parent.parent$#API = Path(__file__).resolve().parent.parent\nADDON = API.parents[1] / "addon"#' \
  -e 's#(ADDON / "pyproject.toml")#(API / "pyproject.toml")#' \
  "$API/tests/test_version.py" && rm -f "$API/tests/test_version.py.bak"

echo "imported $(git -C "$UPSTREAM" rev-parse --short HEAD) into $API"
echo "remaining upstream spellings (should be none):"
grep -rIn -iE 'petkit[ _-]?local' "$API/src" "$API/tests" "$ROOT/addon" "$ROOT/repository.yaml" || echo "  none"
