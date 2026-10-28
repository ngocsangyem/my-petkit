# Notice

my-petkit is a derivative work of **petkit-local**, licensed under the GNU General Public License
v3.0. my-petkit is distributed under the same licence (`LICENSE`, copied verbatim).

## Origin

| | |
|---|---|
| Upstream | https://github.com/alex-so-3/petkit-local |
| Imported commit | `9f86e22` (Release 2.1.0) |
| Upstream author | alex.so.3 and contributors |
| Copyright | The copyright notices of the upstream source files are kept unchanged. |

The upstream git history was squashed before release, so the reasons behind much of the protocol
code live only in its docstrings and comments. They are kept verbatim.

`petkit-local` itself credits the projects its device payloads were derived from (pypetkitapi,
localkit and others); those credits are carried in `README.md`.

## Main changes from upstream

- Renamed throughout: `petkit-local` / `petkit_local` / `petkitlocal` became `my-petkit` /
  `my_petkit` / `mypetkit`, including literals sent to devices. The full table is in `UPSTREAM.md`.
- Monorepo layout: the Python package moved to `services/api/src/my_petkit/`.
- User plane rebuilt: authentication, TLS in every deploy mode, per-feature modules, an OpenAPI
  contract, a new React web dashboard and a native iOS app.
- Supply-chain controls: pinned actions, hashed lockfiles, signed images, SBOM, secret scanning.

## Third-party components shipped in this repository

| Component | Licence | Location |
|---|---|---|
| Dropbear SSH (prebuilt `dropbear-mipsel`, `dropbear-armv7`) | MIT-style, see its licence file | `services/api/src/my_petkit/web/static/bin/LICENSE.dropbear` (must ship with the binaries) |
| IBM Plex Sans / IBM Plex Mono | SIL Open Font License 1.1 | Self-hosted by the web app and bundled by the iOS app; the OFL text ships next to the font files |

Design mockup photos (`docs/design/assets/`, CC BY-SA) are **not** committed and not shipped;
they are used only to render the design canvas locally.

## Fixture audit

`gitleaks detect --no-git` over upstream `9f86e22` (gitleaks 8.30.1, run 2026-10-28) reported 25
hits. Each was read:

| Location (upstream) | Value | Verdict |
|---|---|---|
| `ha/entities/ble.py` ×5, `ha/entities/sensors.py` ×1 | `EntityDef` key names (`ctw3_*`, `n50_durability`) | False positive: Home Assistant entity keys. Allowlisted by path in `.gitleaks.toml`. |
| `tests/test_cloud_fetch.py`, `test_proxy.py`, `test_proxy_middleware.py` ×3, `test_registry.py`, `test_redact.py` ×3 | `0123456789abcdef` | Placeholder 16-byte key. Allowlisted by value under `services/api/tests/`. |
| `tests/test_auth.py` ×4 | `compute_aliyun_sign(dev.mqtt_device_secret, …)` | False positive: attribute name, not a value. |
| `tests/test_redact.py` ×5 | `CAISkgN1q6Ft5B2…` (15–27 chars) | Truncated fake STS token prefix; a real one runs to hundreds of characters. Allowlisted. |

Other fixtures named by the plan as carrying sensitive keys were also read:

| Location (upstream) | Value | Verdict |
|---|---|---|
| `tests/test_state_parsers.py:325` | `ssid: "HomeWIFI"`, `bssid: "60d8a4e83040"` | BSSID has the shape of a real access-point MAC (geolocatable through public Wi-Fi databases). **Replaced** with `ExampleNet` / `000000000000` on import. |
| `tests/test_w7h.py:28` | `ExampleNet`, `000000000000` | Already fake. |
| `tests/test_utils_dicts.py`, `test_state_parsers.py:14,47` | `No Signal`, `x`, `82` | Not identifying. |
| `tests/test_http.py` | `deviceSecret` asserted against a generated fixture device | No literal value. |

`tests/firmware/` (vendor firmware blobs) is excluded from the import and ignored by git.
