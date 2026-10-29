# Secure coding rules: my-petkit

Source: the conventions document of the rebuild plan (part C), copied into the repo in phase 01. Matching CI gates: `docs/code-standards.md`, section "CI gates".

## Part C: Security for an open-source project

### C0. Threat model (condensed)
**Base assumption: the attacker can read all of the source, the CI and the issue history.** Consequences:
- No security relies on hiding code.
- Every secret is generated per install.
- Every known hole must be fixed and released quickly.

| Attacker | Position | Goal | Main defense |
|---|---|---|---|
| Internet | In front of the user plane (cloud mode) | Take over admin, read video, command devices, root devices via patchers | Auth + rate limit + TLS + tier/step-up (C1). The device plane is not on the internet |
| Another device on the LAN | Device plane, local user plane | Impersonate a device, obtain secrets via `dev_signup`, push commands via MQTT | Interface binding, MQTT lets only non-Aliyun-style clients through over loopback, size caps. The rest is a firmware limitation: documented in `security.md` |
| Malicious web page in the owner's browser | User plane | CSRF, reading the WS | `SameSite=Strict`, Origin check on every unsafe method and every WS, JSON required, CSP |
| Compromised device / malicious payload | Device plane → server | Exploit parsers, ffmpeg, path traversal, SSRF via a reported IP | Coerce, safe_join, ffmpeg hardening, SSRF guard, fuzzing (C2–C4) |
| Supply chain | CI, dependencies, image | Inject code into a release | SHA pinning, hashed locks, image signing, SBOM, provenance (C6) |

### C1. User plane
- **Deny by default.** Every route declares a tier. A test walks the whole router and fails on any route without a tier. Only `public-static` and `signed-media` are exempt from tokens.
- **Secrets generated at install**: session signing key, HMAC key for signed URLs, TLS cert. Generated on first run, stored with mode 0600 in the data dir. **Never a hard-coded default.**
- **Passwords**: argon2id. Compare tokens and signatures with `hmac.compare_digest`. Randomness from `secrets`.
- **Security headers**:
  - `Content-Security-Policy: default-src 'self'; frame-ancestors 'self'` (add-on mode allows the HA origin so Ingress can embed it, to be verified first);
  - `X-Content-Type-Options: nosniff`;
  - `Referrer-Policy: no-referrer`;
  - `Strict-Transport-Security` when running TLS.
- **CORS** off.
- **Implementation (already in the code)**:
  - Tiers are declared on handlers with `@tier(...)` (`shared/tiers.py`); the middleware `features/auth/middleware.py` rejects routes without a tier. Besides `public-static` and `signed-media`, only three routes that exchange a secret for a credential are exempt from tokens (tier `credential`: `/api/auth/setup`, `/login`, `/pairing/redeem`), and they are rate limited; a test lists exactly these three routes.
  - **Ingress**: trusted only when the request arrives on `ingress_port` (= `web_port`, add-on mode only) **and** the TCP peer is exactly `172.30.32.2`. Source: Home Assistant developer docs, "Presenting your app" → Ingress (`docs/apps/presentation.md`, repo `home-assistant/developers.home-assistant`, commit `8da484e`): "Only connections from `172.30.32.2` must be allowed". Headers (`X-Ingress-Path`, `X-Forwarded-*`, `X-Hass-Source`) are never trusted.
  - **`frame-ancestors 'self'` is enough for Ingress**: the Supervisor proxies the panel under `/api/hassio_ingress/<token>/` on HA's own origin, so the HA page embedding the panel is `'self'`. No need to list the HA origin. Still to be checked on real HA.
  - The web app's document and build files (served at `/` by `web/spa.py`) carry their own `SPA_CSP`: no inline script or style at all, plus `blob:` for images, media and workers (face cropper preview, hls.js) and `data:` images. The server-rendered panel and its wider policy are deleted; `/app/`, the web app's old mount, is a permanent redirect to `/`.
  - Origin/Host: every unsafe method and every WS upgrade. Host must be an IP literal, `localhost` or a name in `user_hosts`; Origin (if present) must match host:port exactly. Cookie/Ingress without an Origin is rejected; a client token (not sent automatically) is allowed.
  - 5xx errors: the handler's message is replaced by a correlation id, except 502/503/504, which are upstream-describing messages the handler writes on purpose.
- **Input**: strict schemas, unknown fields rejected. Limit string length, body size and array element count. Special formats (SSH pubkey, IANA timezone, sound file names) are validated with allowlists, never blocklists.
- **Output**: JSON only. The web renders via React and never inserts raw HTML. Every string coming from a device is untrusted data.

### C2. Command execution, files, ffmpeg
- **Commands**: never `shell=True` or `os.system`. `run_cmd` strings sent to a device are built only from constants plus parameters validated by allowlist (fixed paths, correctly formatted pubkey, extension `.mp3|.aac|.wav`). A test injecting the characters `;|&$\`` must be rejected.
- **Files**: every path from input goes through `safe_join`. No file outside the media root is served. The `.raw`/`tmp` directories are not exposed to the user plane.
- **ffmpeg**: input from devices is untrusted data.
  - `-nostdin -protocol_whitelist file,pipe`;
  - cap size and duration;
  - keep the existing timeouts;
  - pin the ffmpeg version in the image, scan CVEs per image.

### C3. SSRF and outbound connections
- **Device targets**: every connection the server initiates to a device (go2rtc, patcher read-back, talk 9010) goes through a single module, `utils/outbound_guard.py`. The module lives in `utils/outbound_guard.py` (not `shared/`): the protocol core (`media/`, `patchers/`) may not import `shared/` under the import-linter contract, while features may import `utils/`. A connection is allowed only when both conditions hold:
  - the IP is in a private range, ULA or a configured WireGuard subnet;
  - the IP belongs to a registered device.

  `request.remote` is only a hint, not proof.
- **Upstream proxy**: `proxy_upstream` and `proxy_dns` accept only hosts on the per-region PetKit/Aliyun allowlist. Changing the value is tier R3.
- Never follow redirects automatically on outbound connections.

### C4. Device plane: tighten as far as the firmware tolerates
- Bind interfaces per config (the listener table of phase 11). 1883 listens only on loopback.
- Cap body and upload size. The bucket keeps the original's 50 MB cap; for other routes, re-check the 1 MiB cap and the 413 error (phase 04).
- **Fuzzing** with `hypothesis` for:
  - the device-plane parsers: `parse_x_device`, HTTP/MQTT normalize, W5/CTW3 BLE frames, JSON bare-token repair, provisioning frame decoding;
  - requirements: no raise, no hang, no unbounded allocation.
- Bounded queues, because the original has an unbounded command queue.
- Crypto that the protocol mandates (AES-CBC, MD5 sign, Aliyun-style HMAC) lives separately in `utils/crypto.py`, clearly marked "required by firmware". Never use it for anything else.

### C5. Data
- Data dir 0700, files 0600, `umask 077`.
- `auth.db` kept separate.
- Secrets never go into a response without redaction.
- Captures and device logs are tier R3, with a warning when viewed.
- Never commit captures, data, certs or keys (the original `.gitignore` plus additions, gitleaks).

### C6. Supply chain, CI, releases
- **Actions**: pinned by SHA, minimal `permissions`. No `pull_request_target` with secrets. PRs from forks never reach the publish job.
- **Dependencies**:
  - hashed locks (Python `--require-hashes`, `pnpm --frozen-lockfile`, `Package.resolved`);
  - Dependabot;
  - `pip-audit`, `osv-scanner`, `pnpm audit` **block merge** on high/critical holes;
  - adding a new dependency requires a stated reason in the PR.
- **SAST**: CodeQL (Python, JS/TS, Swift), Semgrep with the standard ruleset plus custom rules:
  - ban `shell=True`, `os.system`, `pickle`, `yaml.load`, `eval`;
  - ban bare-string `app["…"]` in `features/`;
  - ban `dangerouslySetInnerHTML`.
- **Image**:
  - multi-arch, scanned with Trivy or Grype in CI;
  - **signed with cosign keyless (GitHub OIDC)**;
  - SBOM (syft) and provenance attestation attached;
  - docs explain `cosign verify`.
- **Container** (compose/VPS):
  - non-root;
  - `read_only: true` with tmpfs for `/tmp`;
  - `no-new-privileges`;
  - `cap_drop: [ALL]` plus `NET_BIND_SERVICE`;
  - healthcheck.

  The add-on runs as root because the Supervisor owns `/data`; documented in `security.md`.
- **Repo**:
  - branch protection on `main`: PR required, CI green, no force-push;
  - secret scanning with push protection enabled;
  - Private Vulnerability Reporting enabled.

### C7. Vulnerability handling process
- `SECURITY.md` states:
  - the private reporting channel (GitHub advisory);
  - supported versions (the latest release);
  - response targets.
- Security holes are fixed in a private advisory, a patch release is published, and only then is it disclosed.
- Exploit details are not discussed in public issues.
- Every PR touching auth, `features/patchers`, `features/setup`, `outbound_guard`, `http/`, `mqtt/auth.py` or CI workflows must go through the security review checklist (`docs/security/review-checklist.md`).
