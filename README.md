# my-petkit

A local stand-in for the PetKit cloud. Your litter box, feeder or fountain connects to it instead of
PetKit's servers and behaves the same, except that what it records stays with you. It works with
the internet unplugged, publishes everything to Home Assistant over MQTT, and comes with its own web
dashboard and iOS app.

**Docs: [my-petkit.vercel.app](https://my-petkit.vercel.app/)**, covering install, configuration,
everyday use, the firmware patchers and a reference for each device.

my-petkit is a rebuild of [petkit-local](https://github.com/alex-so-3/petkit-local) (GPL-3.0). The
reverse-engineered protocol core is ported from it; see `NOTICE.md` and `UPSTREAM.md`.

> **Warning.** Pointing a device at my-petkit, and above all applying the firmware patchers, is done
> at your own risk. A patched or misconfigured device can stop working (be bricked) and is outside
> its warranty and outside PetKit's update path.

## Deploy modes

| Mode | Where it runs | Notes |
|---|---|---|
| **Home Assistant add-on** | HAOS / Supervised | Add this repository in the add-on store. The dashboard opens through Ingress; the iOS app pairs over the TLS user-plane port with a QR code. |
| **Local container** | Any Docker host on the LAN (`deploy/local/`) | Self-signed TLS, pinned by the iOS app through the pairing QR. |
| **Cloud / VPS** | A VPS reached over WireGuard (`deploy/cloud/`) | Only the user plane is public, behind Caddy and a Let's Encrypt certificate. The device plane listens only on the tunnel. |

All three run the same signed multi-architecture image; `docs/deploy.md` covers tags, verifying the
signature and rolling back, and `docs/remote-access.md` covers Tailscale and Cloudflare Tunnel.

## Repository layout

```
addon/             Home Assistant add-on manifest and docs
services/api/      Python package `my_petkit`: device protocol core + user-plane API
packages/contracts OpenAPI spec and WebSocket event contract
apps/web/          React dashboard
apps/ios/          SwiftUI app and the PetkitKit Swift package
apps/docs/         documentation site (Fumadocs), published at my-petkit.vercel.app
deploy/            local and cloud deploy recipes
docs/              architecture, code standards, security rules, design reference
```

## Documentation

User and contributor docs live at [my-petkit.vercel.app](https://my-petkit.vercel.app/), built from
`apps/docs`. The files below are the in-repo references for people changing the code.

- `ARCHITECTURE.md`: how a device request travels through the packages.
- `AGENTS.md`: invariants of the protocol core. Read before changing `events/` or `devices/`.
- `docs/code-standards.md`, `docs/security/secure-coding-rules.md`: rules every change follows.
- `docs/design/DESIGN.md`: design tokens, components and rules for the web and iOS UI; reference screenshots in `docs/design/screenshots/`.
- `docs/deploy.md`, `docs/remote-access.md`: running the image and reaching it from outside.
- `SECURITY.md`: how to report a vulnerability.

## Licence

GPL-3.0. See `LICENSE` and `NOTICE.md`.
