#!/usr/bin/env bash
# Regenerate the API clients from packages/contracts/openapi.yaml.
#
# - TypeScript: apps/web/src/api/schema.d.ts, committed; CI regenerates it and
#   fails on any diff.
# - Swift: only the spec is copied into the PetkitAPI target; the
#   swift-openapi-generator build plugin generates the code during `swift build`.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SPEC="$ROOT/packages/contracts/openapi.yaml"
OPENAPI_TYPESCRIPT_VERSION="7.13.0"

cp "$SPEC" "$ROOT/apps/ios/PetkitKit/Sources/PetkitAPI/openapi.yaml"

mkdir -p "$ROOT/apps/web/src/api"
npx --yes "openapi-typescript@$OPENAPI_TYPESCRIPT_VERSION" "$SPEC" \
  --output "$ROOT/apps/web/src/api/schema.d.ts"
