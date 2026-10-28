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
| `events/store.py` | split by table: `events/store.py` (events, timeline), `store_base.py` (connection, migration, write lock), `store_media.py` (media, stitching), `store_pets.py` (pets, faces, reported identities), `store_blocked_attempts.py`. Port a hunk to the file holding its section header. |

## Rename table

Applied by `scripts/rename-from-upstream.sh` (text files only; binaries are left byte-identical).

| Upstream | my-petkit | Occurrences at `9f86e22` |
|---|---|---|
| `petkit_local` | `my_petkit` | 864 |
| `petkit-local` | `my-petkit` | 97 |
| `PetKit Local` | `My PetKit` | 8 |
| `petkitlocal` | `mypetkit` | 3 |
| `PetKit-Local` | `My-PetKit` | 1 |

### Internal (only this software and Home Assistant see it)

Package and import paths, CLI entry point, add-on slug (`mypetkit`) and name, HA MQTT topic prefix
(`my-petkit/{id}/…`), entity `unique_id` prefixes, logger names, the go2rtc config header, panel
title, docstrings and comments.

Changing the HA topic prefix and `unique_id` prefix means an existing petkit-local install migrating
to my-petkit gets **new** HA entities; the old ones are orphaned. This is a fresh product, so no
migration is provided.

### Device-facing (bytes a device receives)

Tests cannot prove a device accepts these: the tests were renamed by the same substitution. They are
verified on hardware by runbook item H12, and are the input to the golden device check.

| Upstream file:line | Field | Upstream value | my-petkit value |
|---|---|---|---|
| `devices/payloads.py:357` | STS `token` | `petkit-local-no-sts-token-required-by-this-bucket` | `my-petkit-no-sts-token-required-by-this-bucket` |
| `devices/payloads.py:361` | STS `secret` | `petkit-local-unchecked-secret-000000000000` | `my-petkit-unchecked-secret-000000000000` |
| `devices/payloads.py:362` | STS `keyId` | `STS.petkit-local` | `STS.my-petkit` |
| `devices/payloads.py:418` | `domain_url` path (only parsed by `sscanf` for the host) | `https://{host}/petkit-local/` | `https://{host}/my-petkit/` |
| `devices/payloads.py:437,441` | `primaryBucketName`, `standbyBucketName` | `petkit-local` | `my-petkit` |
| `mqtt/broker.py:140-141` | broker certificate CN and SAN | `petkit-local` | `my-petkit` |
| `http/bucket.py:293,321` | `x-oss-request-id` header prefix | `petkit-local-{ts}` | `my-petkit-{ts}` |
| `http/server.py:190` | `service` in the status JSON | `petkit-local` | `my-petkit` |
| `mqtt/bridge.py:256` | internal bridge client id on the device broker | `petkit-local-bridge` | `my-petkit-bridge` |
| `patchers/common.py:462` | patcher wrapper header written onto the device | `petkit-local patcher wrapper` | `my-petkit patcher wrapper` |
| `http/cloud_fetch.py:53` | `User-Agent` sent to PetKit's cloud | `PetKit-Local` | `My-PetKit` |

Every replaced literal is 3 characters shorter (`petkit-local` → `my-petkit`).
