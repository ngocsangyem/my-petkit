# Deploying my-petkit

One image, `ghcr.io/ngocsangyem/my-petkit`, built from the root `Dockerfile`
for amd64, arm64 and armv7. Three ways to run it:

| Mode | Where | Recipe |
|---|---|---|
| Home Assistant add-on | HA OS or HA Supervised | `addon/` (this repository is an add-on repository) |
| Local container | any Docker host on the devices' LAN | [`deploy/local/`](../deploy/local/docker-compose.yml) |
| VPS | a cloud server, devices reach it over WireGuard | [`deploy/cloud/`](../deploy/cloud/README.md) |

For reaching the dashboard and the iOS app from outside the LAN, see
[remote-access.md](remote-access.md).

## Image tags

| Tag | Meaning |
|---|---|
| `2.1.0` (a version) | a release, cut by the `v2.1.0` git tag; the add-on pulls exactly this |
| `latest` | the newest stable release (a prerelease or a backport tag does not move it) |
| `dev` | the last commit on `main`; untested by definition |

A version tag is published only when the git tag matches `addon/config.yaml`.
To hold one exact build, use a release's digest
(`ghcr.io/ngocsangyem/my-petkit@sha256:…`). Do not pin a `dev` digest: once
`dev` moves on, its old digest is pruned after 14 days.

## Verify the image

Every published image is signed with cosign keyless signing from the
`publish` workflow, and every per-architecture image carries an SBOM and a
provenance attestation. Check the signature before you run a new version:

```sh
cosign verify ghcr.io/ngocsangyem/my-petkit:2.1.0 \
  --certificate-identity-regexp '^https://github.com/ngocsangyem/my-petkit/\.github/workflows/publish\.yml@refs/tags/v' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

For `dev`, the identity ends in `@refs/heads/main` instead. A signature made
anywhere else (a fork, another workflow, a laptop) fails this check.

The SBOM and the provenance:

```sh
docker buildx imagetools inspect ghcr.io/ngocsangyem/my-petkit:2.1.0 \
  --format '{{ json (index .SBOM "linux/amd64").SPDX }}' | head
docker buildx imagetools inspect ghcr.io/ngocsangyem/my-petkit:2.1.0 \
  --format '{{ json (index .Provenance "linux/amd64").SLSA }}' | head
```

## Home Assistant add-on

Install from the repository URL (Settings → Apps → Install app → ⋮ →
Repositories), then follow `addon/DOCS.md`.

**Back up before every update.** The Supervisor deletes the old image before it
pulls the new one, so a bad release cannot be rolled back by reinstalling the
old version. Tick "Create a backup before updating" in the update dialog (or
`ha backups new --addons <slug>`). To roll back, restore that backup: it
brings back the add-on at its old version together with its `/data`.

## Local container

```sh
cd deploy/local
cp .env.example .env && $EDITOR .env
docker compose up -d
docker compose logs my-petkit | grep -i "setup token"
```

The setup token is printed on the first start and is valid for a limited time.
If it expired, set the admin password from inside the container instead:

```sh
docker exec -it my-petkit my-petkit admin set-password --data-dir /data
```

Updating is `docker compose pull && docker compose up -d`; rolling back is
setting `MY_PETKIT_TAG` to the previous version and running `up -d` again.
Back up the `data` volume first (the VPS README has the command); it holds the
device identities, the TLS keys and the user plane's secrets.

## Container privileges

| | Add-on | Compose and VPS |
|---|---|---|
| User | root | `mypetkit` (uid 10001) |
| Root filesystem | writable | read-only, `/tmp` on tmpfs |
| Capabilities | the Supervisor's default set | none (`cap_drop: ALL`) |
| `no-new-privileges` | no | yes |
| Binding 80/443 | as root | `net.ipv4.ip_unprivileged_port_start=0`, inside the container's network namespace |

The add-on runs as root because the Supervisor owns `/data` and `/media` and
gives the container no way to run as another user over them. The compose
files use a bridge network rather than the host's, because that sysctl cannot
be set on the host namespace, and a capability cannot replace it: Docker gives
a non-root process no ambient capabilities, and `no-new-privileges` blocks file
capabilities. Check a running container:

```sh
docker inspect my-petkit --format 'user={{.Config.User}} ro={{.HostConfig.ReadonlyRootfs}} secopt={{.HostConfig.SecurityOpt}} capdrop={{.HostConfig.CapDrop}}'
# user=10001:10001 ro=true secopt=[no-new-privileges:true] capdrop=[ALL]
```

## Maintainer notes

- **A new GHCR package is private.** After the first publish, set
  `ghcr.io/ngocsangyem/my-petkit` to public (package settings → Change
  visibility), or the Supervisor and anonymous `docker pull` get 401.
- **Cutting a release:** bump `version` in `addon/config.yaml` and
  `services/api/pyproject.toml`, add the `addon/CHANGELOG.md` entry, merge, then
  push the tag `v<version>`. The workflow refuses a tag that disagrees with
  `config.yaml`.
- **A critical vulnerability with a fix available blocks the build** (Grype in
  `publish.yml`, on the exact digest that was pushed, before anything is tagged
  or signed). Bump the base image digest or the dependency; do not add an
  ignore without a written reason.
- **`prune-packages`** deletes untagged versions nothing points at, weekly.
  Run it by hand with `dry_run` first after changing how images are built.
