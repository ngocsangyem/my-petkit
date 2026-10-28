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

cp "$SPEC" "$ROOT/apps/ios/PetkitKit/Sources/PetkitAPI/openapi.yaml"

# openapi-typescript is pinned, with its dependencies, by apps/web/pnpm-lock.yaml.
pnpm -C "$ROOT/apps/web" install --frozen-lockfile --silent
pnpm -C "$ROOT/apps/web" exec openapi-typescript "$SPEC" \
  --output "$ROOT/apps/web/src/api/schema.d.ts"
