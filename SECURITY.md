# Security

## Reporting a vulnerability

Report privately through a
[GitHub security advisory](https://github.com/ngocsangyem/my-petkit/security/advisories/new).
Do not open a public issue for anything exploitable, and do not post exploit details in issues or
pull requests.

- **First response:** within 7 days.
- **Fix:** developed in the private advisory, released as a patch version, and only then disclosed.
- **Supported versions:** the latest release only. There is no backport branch.

## Threat model in brief

Assume an attacker has read all of this source, the CI configuration and the issue history.
Nothing here relies on obscurity, and every secret (session signing key, signed-URL key, TLS
certificate) is generated per install. There are no hard-coded defaults.

my-petkit has two planes with opposite rules:

| Plane | Who talks to it | Exposure | Rule |
|---|---|---|---|
| **Device plane**: device HTTP API, media bucket, MQTT broker | PetKit firmware on your LAN | LAN only. **Never** expose it to the internet. | Unauthenticated where the firmware has no credential to offer. Hardened by interface binding, size caps, path containment, parsers that never raise, and fuzzing. |
| **User plane**: dashboard API, web app, iOS app | You | LAN, VPN, or the internet in cloud mode | Default deny. Every route declares a tier and needs a token, except public static files and signed media URLs. TLS in every mode. |

The full model, the per-tier rules and the known firmware limitations are in
`docs/security/secure-coding-rules.md` (and, once written, `docs/security/threat-model.md`).

## Data on disk and the container user

The process runs with `umask 077` and tightens its data directory to `0700` before writing
anything, so every file it creates (`devices.json`, `petkit.db`, certificates and keys, uploaded
sounds, media) is readable by its own user only.

- **Home Assistant add-on: runs as root.** The Supervisor creates `/data`, `/media` and `/share`
  owned by root and gives the add-on no way to change that, so a non-root user could not write
  its own state. Containment there is the Supervisor's container, not a Unix user.
- **Compose and VPS: run as a non-root user.** The only privilege needed is binding the device
  ports below 1024 (80, 443), granted with `cap_add: [NET_BIND_SERVICE]` on the container (with
  every other capability dropped), never with `setcap` on the Python binary, which would hand the
  capability to every Python program on the host.

## Captures contain secrets

Traffic capture writes verbatim payloads. A capture can contain your Wi-Fi SSID, your LAN topology,
a device's signing secret and, in proxy mode, PetKit cloud credentials. **Read a capture before
attaching it to anything**, and attach only what the question needs.

## Firmware patchers

The patchers modify firmware on a rooted device. A patched device is outside its warranty and
outside PetKit's update path, and a failed patch can brick it.
