# Code standards: my-petkit

Source: the conventions document of the rebuild plan, copied into the repo in phase 01. Security rules (part C) live in `docs/security/secure-coding-rules.md`.

## Part A: Feature-based structure

### A1. Two areas in the API
```
services/api/src/my_petkit/
├── <protocol core>      main/ config.py http/ mqtt/ devices/ events/ media/ ha/ patchers/ ai/ utils/
│                        Keeps the original structure. Firmware talks to this area.
├── features/            USER PLANE: one folder per feature, each self-contained
│   ├── auth/            routes.py service.py schemas.py store.py tiers.py
│   ├── devices/         (state, entity, command, timezone, delete)
│   ├── schedules/       (4 schedule kinds, deferred feed)
│   ├── sounds/
│   ├── timeline/
│   ├── media/           (file serving, signed URL)
│   ├── live/            (HLS/MSE/WebRTC proxy)
│   ├── talk/
│   ├── pets/            (faces, cloud import)
│   ├── ble/             (accessories, pairing)
│   ├── patchers/
│   ├── capture/
│   ├── logs/            (live log WS, device logs)
│   └── setup/           (settings, guards, blocked, retention)
├── web/                 composition root: panel.py (original name kept; route table and registration order), spa.py (the web app at `/`), hub.py; static/bin/ holds the ssh patcher's dropbear builds
└── shared/              things shared between features: errors.py, pagination.py, redact_client.py
```

Why the protocol core is kept as-is:
- `events/codes.py` deliberately gathers 7 namespaces into one file, because only when they sit together can you see where they collide (original `ARCHITECTURE.md`).
- Keeping the directory tree close to the original is what makes new protocol findings from upstream portable.

### A2. Layout inside a feature
| File | Responsibility | Must not |
|---|---|---|
| `routes.py` | Thin aiohttp handlers: parse the request via `schemas`, call `service`, return the response. Every handler declares a tier | Contain business logic, access `app[...]` with a bare string |
| `service.py` | The feature's logic. Calls the protocol core through its public API | Import `aiohttp.web`, know about HTTP |
| `schemas.py` | Validate requests (reject unknown fields and overlong values). Shape responses, including redaction | Return `device.state` verbatim |
| `tiers.py` (or declared in routes) | Map route → `R0 \| R0* \| R1 \| R2 \| R3 \| signed-media \| public-static` | Leave a route without a tier |
| `tests/features/<name>/` | The feature's tests, including that feature's security tests | Mock the very thing under test |

### A3. Dependency rules (enforced by `import-linter` in CI)
- `features/*` may import the protocol core and `shared/`.
- The protocol core **never** imports `features/` or `web/`. This extends the original rule "devices does not know HA exists".
- Features do not import each other. Anything that must be shared goes into `shared/`.
- `web/panel.py` is the only place that assembles the features, and it keeps the original's significant route registration orders.
- **Timing**: restructuring the user plane into `features/` happens at the start of phase 05, after phase 04 has fixed the approved bugs. Doing it earlier would make the switch to `appkeys` constants fix V2/V3 before they were approved.

### A4. Web and iOS
- **Web**: `apps/web/src/features/<name>/` holds `components/`, `hooks/`, `api.ts`, `<name>.test.tsx`. Shared things go in `src/shared/` (ui, format, ws). Features do not import each other.
- **iOS**:
  - `MyPetkit/Features/<Name>/` holds `<Name>View.swift`, `<Name>Model.swift` (`@Observable`), plus the subviews.
  - Logic that can be tested without UI lives in `PetkitKit`: `PetkitAPI`, `PetkitCore`, `PetkitBLE`.
- Feature names are the same in all three places (API, web, iOS), so searching for one feature finds all three.
- **UI**: follows `docs/design/DESIGN.md`.
  - Color, type and spacing tokens are declared only once: `apps/web/src/shared/ui/tokens.css` and `PetkitCore/Theme/`.
  - Shared components go in `src/shared/ui/` and `MyPetkit/Shared/`.
  - The web follows **§8 (Web v3)**, which supersedes the web rows of §2–§6: the frame, controls, overlays and rules are in §8.1–§8.2, the screen-to-artboard map in §8.3, dark mode in §8.4. iOS follows §7. Each screen is built from the artboard listed in its screen map.
  - The hard rules in §6, as relaxed by §7.3 and §8.2 (radius-20 cards, pill controls, shadows on dialogs and sheets only, the dark caption pill over photos), block at review.
- **Web components are shadcn/ui on Base UI, styled with Tailwind v4.**
  - The CLI copies components into `apps/web/src/shared/ui/shadcn/` (`components.json`); they are our code. Call the CLI at a pinned version (`pnpm dlx shadcn@<x.y.z> add <name>`), never `@latest`, and never re-`add` a component that exists: compare with `shadcn diff` and edit by hand.
  - After every `add`, edit the file for the design: radius, the accent focus outline instead of a ring, no resting shadow, theme colours only. Note the edit in a comment at the top. `scripts/check-design-rules.mjs` (part of `pnpm lint`) rejects resting shadows (only overlay files may use `shadow-overlay` / `shadow-sheet`), letter-spacing, uppercase, blur, gradients, emoji and Tailwind palette colours, in classes and in plain CSS.
  - `src/shared/ui/*.tsx` wraps them with the props screens use (`Card`, `Panel`, `PageHeader`, `Button`, `Chip`, `Segmented`, `Stepper`, `Pill`, `ConfirmDialog`, state blocks, the device drawings in `device-drawings/`, form controls, `useToast`); prefer the wrapper.
  - Radii use Tailwind's size names so `cn` can merge them: `rounded-sm` 8, `rounded-md` 14 (fields, inner panels), `rounded-lg` 16, `rounded-xl` 20 (cards), `rounded-2xl` 24 (dialogs, sheets), `rounded-full` for controls.
  - `src/shared/ui/theme.css` maps shadcn's variables onto the `--pk-` tokens. The type scale uses Tailwind's size names so class merging reads them as sizes: `text-xs` 12, `text-sm` 13, `text-base` 14, `text-md` 15 (lede, fields), `text-lg` 17 (section), `text-xl` 22 (dialog title), `text-2xl` 28 (page title), `text-3xl` 30 (figure).
  - Never use a component that injects `<style>` at runtime: the SPA's CSP has no `style-src`. Sonner and Base UI's Select do, so the toast is built on Base UI's Toast primitive and selects are native.
  - Any plain CSS must sit in a cascade layer (`base.css` is in `@layer base`): unlayered rules beat every utility class.

---

## Part B: Code conventions

### B1. Naming and file size
| Language | File | Notes |
|---|---|---|
| Python | `snake_case.py`, long and descriptive names | Python modules cannot use kebab-case |
| TypeScript | `kebab-case.ts`, components `kebab-case.tsx` exporting `PascalCase` | |
| Swift | `PascalCase.swift` after the main type | |

File size limits:
- **New code: ≤ 200 lines.** Over that, split along real boundaries.
- Justified exceptions, which must be recorded in `docs/code-standards.md`:
  - `events/codes.py` and `devices/payloads.py` (protocol tables);
  - generated code;
  - test fixture files.

### B2. Format, lint and types
| | New code (`features/`, `web/`, `shared/`, `auth`) | Ported code (protocol core) |
|---|---|---|
| Format | `ruff format` required | **Do not reformat**, so it stays diffable against upstream |
| Lint | ruff: `F, E, W, B, S, UP, SIM, RUF, PL, PT, ASYNC, BLE, TRY` | Original rules `F, E9, B, PLC0415`, **plus `S` (security) and `ASYNC` from phase 02 onward**. Existing hits go into the baseline; no new hits allowed |
| Type | `mypy --strict` | Plain `mypy`. Each ported module is tightened to strict gradually in its own commit, and the golden check must stay green |
| TS | `strict`, `noUncheckedIndexedAccess`, ESLint + `eslint-plugin-security`, no `any`, no `dangerouslySetInnerHTML` | – |
| Swift | Swift 6 strict concurrency, SwiftLint. No `!` force unwrap and no `try!` outside tests | – |

Current configuration (`services/api/pyproject.toml`): the extended ruff set is `select`ed for the whole repo, then
`per-file-ignores` with a negated pattern covers every file NOT on the new-code list, because ruff cannot
select rules by path. `mypy --strict` is applied via `[[tool.mypy.overrides]]` (listing each strict
flag, because `strict` is not a per-module option). `ruff format --check` runs in CI on
the same list. The current list: `features/auth/`, `shared/{errors,redact_client,request_auth,tiers}.py`,
`utils/user_tls.py`. Ported modules living in `shared/` (`panel_request.py`, `live_settings.py`, …)
stay on the baseline until they are tightened individually. Adding a new file to the user plane means adding it in all three places.

### B3. Comments, errors, logs
- **Comments** explain **why**: invariants, firmware constraints, evidence (capture, firmware function, commit).
  - No phase or finding codes (R1, V4, H12…) in code, test names or commit messages.
  - The original code's "WHY" docstrings are kept verbatim, because the original's git history was squashed and they are the only source.
- **User-plane errors**:
  - Fixed envelope `{"error": {"code": "<slug>", "message": "<safe to display>"}}`.
  - Never expose stack traces, file paths, SQL or secret values.
  - Unexpected errors return 500 with `code: internal` and a correlation id. Details live only in the log.
- **Device-plane errors**: keep the original invariant. Never return 4xx/5xx to a device; device input never raises (`utils/coerce`, `safe_join`).
- **Logs**:
  - Structured logs (key=value).
  - Never log secrets, tokens, passwords, signatures, raw payloads or SSIDs. Every potentially sensitive value must go through a redaction helper.
  - Strip control characters from strings coming from devices, to prevent log injection.

### B4. Tests
- Test names describe the scenario, e.g. `test_stitch_keeps_chunks_when_db_swap_fails`.
- Every bug fix has a reproducing test written before the fix.
- Every feature has at least:
  - a happy path;
  - a test that a missing token returns 401;
  - a test that bad input returns the correct error envelope;
  - for R3 routes, a test that a missing step-up is blocked.
- Fixtures from captures must have secrets masked before commit (gitleaks scans `tests/` too).
- Do not mock the thing under test. Fake only at the outer boundaries: devices, the PetKit cloud, the HA broker.

### B5. Git
- Conventional commits, no mention of AI.
- One change per commit. Refactor commits are separate from behavior-changing commits.
- Merging into `main` only via PR, with CI green (branch protection, see C6).

### File size exceptions (B1)
- `events/codes.py`, `devices/payloads.py`: protocol tables, deliberately large (see `AGENTS.md`).
- Code ported from upstream in general: kept as-is so it stays diffable against upstream; split only when a restructuring phase requires it.
- Generated code (OpenAPI client) and test fixture files.

## CI gates
| Gate | Tool | Blocks merge |
|---|---|---|
| API tests | pytest, test IDs match the baseline | Yes |
| Golden device | `scripts/golden_device_responses.py` | Yes |
| Lint/format/type | ruff, ruff format (new code), mypy | Yes |
| Dependency rules | import-linter | Yes |
| Web | ESLint, tsc, vitest, build | Yes |
| iOS | SwiftLint, swift test, xcodebuild | Yes |
| Contract | spec ⊆ router, generated client does not drift | Yes |
| SAST | CodeQL, Semgrep | Yes (high/critical) |
| Dependency | pip-audit, osv-scanner, pnpm audit | Yes (high/critical) |
| Secret | gitleaks and GitHub push protection | Yes |
| Image | Trivy/Grype | Yes (critical) for releases |
| Fuzz | hypothesis (short run on every PR, long run nightly) | Yes (short run) |

## Schema validation library: `pydantic` v2 (decided 2026-10-28)
Rule: only use libraries that have a **binary wheel** for all three image targets (Python 3.12):
musl amd64, musl aarch64 (Alpine) and glibc armv7. Otherwise write a hand validator on top of `utils/coerce`.

Evidence: run `pip download --only-binary=:all: --python-version 3.12 --implementation cp`
with every compatible tag for each target (pip does not relax an explicit `--platform` down to older
tags on its own, so `musllinux_1_1` must be listed next to `musllinux_1_2`, and `manylinux_2_17`…`2_36` for armv7):

| Package (latest version) | musl amd64 | musl aarch64 | glibc armv7 |
|---|---|---|---|
| `pydantic` 2.14.1 + `pydantic-core` 2.50.1 | `musllinux_1_1_x86_64` | `musllinux_1_1_aarch64` | `manylinux_2_17_armv7l` |
| `msgspec` 0.22.0 | `musllinux_1_2_x86_64` | `musllinux_1_2_aarch64` | **none** |

- `pydantic` v2 chosen: it is the only candidate with wheels for all three targets. `msgspec` was ruled out because armv7 would have to
  build from source.
- Trap hit while checking: passing only `--platform musllinux_1_2_*` makes pip miss the
  `musllinux_1_1` wheel of `pydantic-core` and silently fall back to `pydantic` 1.10. Always list every tag.
- Used for new user-plane code (`features/auth/schemas.py`): `extra="forbid"`, string length
  limits. Ported code keeps `utils/coerce`.
- `argon2-cffi` (required for passwords) has musl wheels for amd64/aarch64 but **no armv7
  wheel**: `argon2-cffi-bindings` builds from source on armv7 glibc. This is not a new build requirement:
  `cffi` (a dependency of `cryptography`) has no armv7 wheel either and already builds from source there, so
  the armv7 image already needs a C toolchain.

## Unresolved questions
- CSP `frame-ancestors` for HA Ingress: the exact origin to allow, to be verified on real HA in phase 11.
