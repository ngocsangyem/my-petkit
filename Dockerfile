# syntax=docker/dockerfile:1
#
# One image for every way this runs: the Home Assistant add-on, the local
# compose file and the VPS (deploy/). Built from the repository root, because it
# needs both the web app (apps/web) and the API (services/api).
#
# The add-on runs it as root (the Supervisor owns /data and /media). Compose and
# the VPS run it as the `mypetkit` user created below, read-only, with every
# capability dropped; see deploy/local/docker-compose.yml.
#
# ---------------------------------------------------------------------------
# Why the base image differs on 32-bit ARM
#
# `cryptography` — AES for media decryption (media/crypto.py) and the broker's
# self-signed cert (mqtt/broker.py) — publishes NO musllinux armv7 wheel. pip
# answers "no matching distribution", so on Alpine a 32-bit build has to compile
# it from Rust source, on the slowest hardware anyone runs this on, from an
# image with no Rust toolchain. It ships `manylinux_2_31_armv7l`, so a glibc
# base simply installs it.
#
# Debian everywhere would be simpler and costs 400 MB: measured 672 MB against
# Alpine's 272 MB for the same app. The base images differ by only ~70 MB — the
# rest is Debian's ffmpeg codec chain. Since almost every install is 64-bit,
# that charges everyone for an arch almost nobody runs. Hence the split.
#
# Keyed on TARGETARCH, which BuildKit sets itself, NOT on the Supervisor's
# BUILD_ARCH. That is deliberate: `build.yaml` and its `build_from` were removed
# in Supervisor 2026.04.0, and the `ARG BUILD_FROM` pattern that replaced it is
# legacy too — the Supervisor substitutes its own base image (one with no Python
# in it) and the build dies with `pip: not found`. Anything we depend on here
# has to come from the build engine, not from the caller.
# ---------------------------------------------------------------------------
# REQUIRES BUILDKIT. `TARGETARCH` is a BuildKit built-in; the legacy builder
# leaves it empty and the build dies on `FROM base-` with "invalid reference
# format". BuildKit is the default from Docker 23 on and is what the Supervisor
# uses, so this only bites a very old daemon — set `DOCKER_BUILDKIT=1` there.
#
# And it MUST stay defaultless. Giving it one (`ARG TARGETARCH=amd64`) looks
# like a safe fallback and is the opposite: BuildKit does not override an ARG
# that already has a default, so every arch — armv7 included — would silently
# get the amd64 base, which is the exact failure this whole block exists to
# prevent.
#
# Base images are pinned by digest (Dependabot moves them); the tag beside each
# digest is what it resolved from.
ARG TARGETARCH

# ---------------------------------------------------------------------------
# The web app. Built once on the BUILD machine's own platform, never under
# QEMU: its output is static files, identical for every target. Tailwind v4's
# native binary is resolved for that platform (musl, since this is Alpine) by
# the lockfile's optional dependencies.
FROM --platform=$BUILDPLATFORM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS web
WORKDIR /src/apps/web
RUN npm install --global --no-fund --no-audit pnpm@12.14.0
COPY apps/web/package.json apps/web/pnpm-lock.yaml apps/web/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY apps/web/ ./
RUN pnpm build

# ---------------------------------------------------------------------------
FROM python:3.12-alpine@sha256:e6dae589c1c05976188fd3bd019afd091445fc533ed2ea29001beddc7368a9c8 AS base-amd64
FROM python:3.12-alpine@sha256:e6dae589c1c05976188fd3bd019afd091445fc533ed2ea29001beddc7368a9c8 AS base-arm64
FROM python:3.12-slim@sha256:aa943ce411423c7582288f18707ff66eddcbaeb510502d747a72aeb34f30d159 AS base-arm

FROM base-${TARGETARCH}

WORKDIR /opt/my-petkit

COPY services/api/requirements.lock .

# ffmpeg: stream-copy remux of the device's raw .ts clips to .mp4 (see
# media/transcode.py), talk transcoding and thumbnails. Every camera model needs
# it, so always install it.
#
# Every dependency is installed from the hash-locked file, so a changed wheel
# on the index fails the build instead of reaching the image. One gap: on
# 32-bit ARM the packages built from source fetch their build tools
# (setuptools and the like) without a hash check, which pip does not offer for
# build isolation.
#
# Branching on which package manager exists rather than on an arch string: the
# base image is what actually decides this, and it is what we were handed.
#
# On Debian (32-bit ARM) several dependencies publish no armv7 wheel of any libc
# and have to be compiled: greenlet is C++ (g++), cffi needs ffi.h (libffi-dev),
# argon2-cffi-bindings and the rest need gcc. The toolchain is purged in the same
# layer so it never reaches the shipped image; the libffi runtime stays because
# Python's own `_ctypes` depends on it.
#
# The `mypetkit` user (uid/gid 10001) is what compose and the VPS run as. /data
# and /media/petkit are created for it, so a fresh named volume mounted there
# starts out owned by that user; the add-on bind-mounts its own and runs as root.
RUN set -eux; \
    if command -v apk >/dev/null 2>&1; then \
        apk add --no-cache ffmpeg; \
        pip install --no-cache-dir --require-hashes -r requirements.lock; \
        addgroup -S -g 10001 mypetkit; \
        adduser -S -D -H -u 10001 -G mypetkit -s /sbin/nologin mypetkit; \
    else \
        apt-get update; \
        apt-get install -y --no-install-recommends ffmpeg gcc g++ libc6-dev libffi-dev; \
        pip install --no-cache-dir --require-hashes -r requirements.lock; \
        apt-get purge -y gcc g++ libc6-dev libffi-dev; \
        apt-get autoremove -y; \
        rm -rf /var/lib/apt/lists/*; \
        groupadd --system --gid 10001 mypetkit; \
        useradd --system --no-create-home --uid 10001 --gid 10001 --shell /usr/sbin/nologin mypetkit; \
    fi; \
    mkdir -p /data /media/petkit; \
    chown 10001:10001 /data /media/petkit

# go2rtc: the camera sidecar (media/go2rtc.py). It is the ONLY safe way to give
# a device camera to Home Assistant — HA opens a stream URL with PyAV, and the
# device's own FLV segfaults libav and restarts the whole of HA, while tserver
# additionally refuses every second connection. go2rtc holds one connection and
# republishes RTSP, which HA reads, and HLS/MSE/WebRTC for the apps.
#
# Pinned and checksummed rather than :latest, because this is a binary we hand a
# device's video to and the build must be reproducible. Upstream ships static
# builds, so there is nothing to compile on any arch.
#
# TARGETARCH maps to upstream's names: amd64/arm64 verbatim, and `arm` is their
# armv7 build. `wget` exists on Alpine as a busybox applet but NOT in
# python:*-slim, so the Debian branch installs and purges it in the same layer.
ARG GO2RTC_VERSION=1.9.14
ARG TARGETARCH
RUN set -eux; \
    case "${TARGETARCH}" in \
        amd64) sha=32d616af226bd731678ffde328b94cfb94e30339bfefc469cfb76323144615a6 ;; \
        arm64) sha=359fabade8a7a51e81a55fe6df6b0ef81764a5e1d63179577534eaaa71904b50 ;; \
        arm)   sha=4d7e1639af5a2722a28e864468fd8099b3c1682565446c798bf9e3b38fde12e4 ;; \
        *) echo "no go2rtc build for TARGETARCH=${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    url="https://github.com/AlexxIT/go2rtc/releases/download/v${GO2RTC_VERSION}/go2rtc_linux_${TARGETARCH}"; \
    if command -v apk >/dev/null 2>&1; then \
        wget -q -O /usr/local/bin/go2rtc "$url"; \
    else \
        apt-get update; \
        apt-get install -y --no-install-recommends wget ca-certificates; \
        wget -q -O /usr/local/bin/go2rtc "$url"; \
        apt-get purge -y wget; \
        apt-get autoremove -y; \
        rm -rf /var/lib/apt/lists/*; \
    fi; \
    echo "${sha}  /usr/local/bin/go2rtc" | sha256sum -c -; \
    chmod +x /usr/local/bin/go2rtc

COPY services/api/src ./src
COPY --from=web /src/apps/web/dist ./web

# The package runs from PYTHONPATH rather than being pip-installed, so the
# `my-petkit` console script from pyproject.toml is provided here. The setup-
# token log line names it (`my-petkit admin set-password`), and
# `docker exec -it my-petkit my-petkit admin set-password --data-dir /data`
# is the way back in when that token has expired.
RUN printf '#!/bin/sh\nexec python3 -m my_petkit.main "$@"\n' > /usr/local/bin/my-petkit \
    && chmod 0755 /usr/local/bin/my-petkit

# No bytecode is written at run time: the compose and VPS containers have a
# read-only root filesystem, and the add-on gains nothing from it.
ENV PYTHONPATH=/opt/my-petkit/src \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    MY_PETKIT_WEB_DIST=/opt/my-petkit/web

LABEL org.opencontainers.image.title="my-petkit" \
      org.opencontainers.image.description="Local cloud replacement for PetKit devices" \
      org.opencontainers.image.licenses="GPL-3.0-or-later" \
      org.opencontainers.image.source="https://github.com/ngocsangyem/my-petkit"

# The add-on's command: self-configures from /data/options.json and the
# Supervisor. Compose and the VPS replace it with explicit flags.
CMD ["python3", "-m", "my_petkit.main", "--ha-addon"]
