# Upstream tracking

my-petkit follows the protocol knowledge of
[petkit-local](https://github.com/alex-so-3/petkit-local). New device findings land upstream in two
files first; diff them periodically and port what changed.

## Synced commit

| Upstream commit | Date synced | Notes |
|---|---|---|
| `9f86e22` (Release 2.1.0) | 2026-10-28 | Initial import |

## Periodic diff

```sh
git -C petkit-local fetch origin
git -C petkit-local log 9f86e22..origin/main -- \
  addon/petkit_local/events/codes.py addon/petkit_local/devices/payloads.py
git -C petkit-local diff 9f86e22..origin/main -- \
  addon/petkit_local/events/codes.py addon/petkit_local/devices/payloads.py
```

Port a change by applying the diff to the mapped path below, then running the rename script over
the touched files. Bump the synced commit in the table above in the same commit.

## Path map

| Upstream | my-petkit |
|---|---|
| `addon/petkit_local/` | `services/api/src/my_petkit/` |
| `addon/tests/` | `services/api/tests/` |
| `addon/pyproject.toml` | `services/api/pyproject.toml` |
| `addon/requirements.txt` | `services/api/requirements.lock` (hashed) |
| `addon/config.yaml`, `DOCS.md`, `CHANGELOG.md`, icon | `addon/` |
| `addon/Dockerfile` | `Dockerfile` (repo root, multi-stage) |
| `repository.yaml` | `repository.yaml` |
| `addon/petkit_local/web/static/`, `templates/` (panel) | replaced by `apps/web/` |

## Rename table

Filled by `scripts/rename-from-upstream.sh` when the code is imported.
