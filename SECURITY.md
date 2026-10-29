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

## Residual device-plane risks

The device plane is hardened only as far as the firmware tolerates. These risks remain by design,
and they are why it must stay on a LAN or VPN you control and never face the internet:

- **The device HTTP API is unauthenticated.** The firmware presents no credential the server
  could check before it is registered, so anything on the LAN can call device endpoints, report
  state or events for a device id, and upload into the media bucket. Interface binding
  (`device_bind_host`), body and upload caps, path containment and parsers that never raise
  limit the damage; they do not establish who is calling.
- **`X-Device` is not verified.** It carries the device's own signature, but a check would lock
  out a device whose signing input we reproduce imperfectly, and an unanswered or 4xx device
  retries forever. A LAN host can therefore send requests in any registered device's name.
- **`dev_signup` is open.** It has to be: a factory-fresh device has nothing to authenticate
  with. Anyone on the LAN who presents a registered device's id (or, for a device that never had
  one, its MAC) is answered with that device's identity and signing secret, and can then sign
  requests as it.
- **Upstream MQTT TLS is unauthenticated.** In proxy mode, `mqtt/upstream.py` encrypts to the
  Aliyun broker without verifying its certificate: the chain ends at a private Aliyun root that is
  never sent and not in any public store, and the device itself does not verify it either. Anyone
  on the path to the cloud can pose as it and have commands relayed down. OTA stays blocked and
  redaction still applies, neither resting on server identity.

What is closed: the plain MQTT listener binds loopback unless `mqtt_plain_expose` is set; an MQTT
client without a device-shaped id is accepted only from loopback; the server dials a device only
at a registered device's reported private, ULA or WireGuard address (`utils/outbound_guard.py`);
proxy mode forwards only to PetKit and Aliyun hosts, and its HTTP leg verifies the PetKit
certificate against the public CA store; ffmpeg reads only local files and pipes.
Two gaps sit beside those gates: go2rtc fetches a camera stream with its own HTTP client, whose
redirect handling we do not control (the address it is given is guarded), and the Aliyun MQTT
host proxy mode connects to is learned from the cloud's own reply rather than checked against
the allowlist.

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
