# Spike: self-signed TLS pinning and AVPlayer under App Transport Security

Run 2026-10-29 on the iOS 18.6 Simulator (iPhone 16, Xcode 16.4). The app's
Info.plist has no ATS keys, so ATS runs with its defaults.

## Setup

The server uses the user plane's own pieces:
- `utils/user_tls.ensure_user_cert` for the certificate (EC P-256, self-signed, ten years);
- `server_context` for TLS (it negotiated TLS 1.3);
- aiohttp `web.FileResponse` for media, the same as `features/media/routes.py`.

The clip is an 8 s H.264 MP4 (50 KB) with `moov` at the end, so playback has to seek by byte range.

`MyPetkitTests/PinnedTransportIntegrationTests.swift` runs inside the app host. To run it:

```bash
TEST_RUNNER_PETKIT_TEST_URL=https://<host>:<port> TEST_RUNNER_PETKIT_TEST_PIN=<sha256> \
  xcodebuild test -project MyPetkit.xcodeproj -scheme MyPetkit \
  -destination 'platform=iOS Simulator,name=iPhone 16,arch=arm64' -skipPackagePluginValidation
```

## Results

| Server address | Pinned URLSession | AVPlayer through `PinnedMediaLoader` | Wrong pin refused | System trust refuses |
|---|---|---|---|---|
| IP literal (`127.0.0.1`) | pass | pass, Range reads seen (`bytes=49152-`) | pass | pass |
| mDNS name (`<host>.local`) | pass | pass | pass | pass |
| Public DNS name (`spike.localtest.me`), SAN mismatch | **fail −1200 / −9802** | **fail** | pass | pass |
| Public DNS name, SAN matches | **fail, "ATS failed system trust"** | **fail** | pass | pass |

- **IP literals and `.local` names.** ATS does not require system trust for these, so a delegate that pins the leaf certificate works. `PinnedMediaLoader` (scheme `mypetkit-https`, Range over the pinned session) plays the MP4 and can seek.
- **A plain `https` AVURLAsset** fails against the self-signed server, which is the reason the loader exists.
- **A fully qualified public name fails**, whatever the SAN says: ATS demands system trust before it asks the delegate. This covers Tailscale MagicDNS (`*.ts.net`), a cloud domain, and any DNS name that is not `.local`. There is no runtime override. An ATS exception has to be a static `NSExceptionDomains` entry in Info.plist, so it cannot name "the host that was paired" without a rebuild.

## Status

Partial. Local mode by IP or `.local` works as designed. Named hosts need a decision (see the open question in phase 08).
