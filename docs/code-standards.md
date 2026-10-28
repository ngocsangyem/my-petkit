# Code standards: my-petkit

Nguồn: tài liệu quy ước của plan rebuild, chép vào repo ở phase 01. Quy tắc bảo mật (phần C) nằm ở `docs/security/secure-coding-rules.md`.

## Phần A: Cấu trúc theo feature

### A1. Hai vùng trong API
```
services/api/src/my_petkit/
├── <protocol core>      main/ config.py http/ mqtt/ devices/ events/ media/ ha/ patchers/ ai/ utils/
│                        Giữ nguyên cấu trúc gốc. Firmware nói chuyện với vùng này.
├── features/            USER PLANE: mỗi thư mục một feature, tự chứa đủ phần của nó
│   ├── auth/            routes.py service.py schemas.py store.py tiers.py
│   ├── devices/         (state, entity, command, timezone, delete)
│   ├── schedules/       (lịch 4 kind, deferred feed)
│   ├── sounds/
│   ├── timeline/
│   ├── media/           (phục vụ file, signed URL)
│   ├── live/            (HLS/MSE/WebRTC proxy)
│   ├── talk/
│   ├── pets/            (faces, import cloud)
│   ├── ble/             (phụ kiện, pairing)
│   ├── patchers/
│   ├── capture/
│   ├── logs/            (live log WS, device logs)
│   └── setup/           (settings, guards, blocked, retention)
├── web/                 composition root: panel.py (giữ tên gốc; route table và thứ tự đăng ký), middleware/, spa.py, hub.py, appkeys.py
└── shared/              thứ dùng chung giữa các feature: errors.py, pagination.py, redact_client.py
```

Lý do giữ protocol core nguyên trạng:
- `events/codes.py` gom 7 namespace vào một file có chủ đích, vì chỉ khi nằm chung mới thấy được chỗ chúng va nhau (`ARCHITECTURE.md` gốc).
- Giữ cây thư mục gần gốc thì mới port được các phát hiện protocol mới từ upstream.

### A2. Bố cục bên trong một feature
| File | Trách nhiệm | Không được |
|---|---|---|
| `routes.py` | Handler aiohttp mỏng: parse request qua `schemas`, gọi `service`, trả response. Mỗi handler khai báo tier | Chứa logic nghiệp vụ, truy cập `app[...]` bằng chuỗi trần |
| `service.py` | Logic của feature. Gọi protocol core qua API công khai của nó | Import `aiohttp.web`, biết về HTTP |
| `schemas.py` | Validate request (từ chối field lạ và giá trị quá dài). Định hình response, gồm cả redaction | Trả nguyên `device.state` |
| `tiers.py` (hoặc khai báo trong routes) | Map route → `R0 \| R0* \| R1 \| R2 \| R3 \| signed-media \| public-static` | Để route không có tier |
| `tests/features/<name>/` | Test của feature, gồm test bảo mật của feature đó | Mock chính thứ đang được test |

### A3. Quy tắc phụ thuộc (bắt buộc bằng `import-linter` trong CI)
- `features/*` được import protocol core và `shared/`.
- Protocol core **không bao giờ** import `features/` hay `web/`. Đây là bản mở rộng của quy tắc gốc "devices không biết HA tồn tại".
- Các feature không import lẫn nhau. Thứ cần dùng chung thì đưa vào `shared/`.
- `web/panel.py` là nơi duy nhất ráp các feature lại, và giữ nguyên các thứ tự đăng ký route quan trọng của gốc.
- **Thời điểm**: tái cấu trúc user plane sang `features/` diễn ra ở đầu phase 05, sau khi phase 04 đã sửa bug có duyệt. Nếu làm sớm hơn, việc đổi sang hằng `appkeys` sẽ tự sửa V2/V3 trước khi được duyệt.

### A4. Web và iOS
- **Web**: `apps/web/src/features/<name>/` gồm `components/`, `hooks/`, `api.ts`, `<name>.test.tsx`. Thứ dùng chung đặt ở `src/shared/` (ui, format, ws). Feature không import lẫn nhau.
- **iOS**:
  - `MyPetkit/Features/<Name>/` gồm `<Name>View.swift`, `<Name>Model.swift` (`@Observable`), cùng các subview.
  - Logic test được không cần UI nằm trong `PetkitKit`: `PetkitAPI`, `PetkitCore`, `PetkitBLE`.
- Tên feature giống nhau ở cả ba nơi (API, web, iOS), để tìm một tính năng là ra cả ba.
- **Giao diện**: theo `design/design-reference.md` (trong repo: `docs/design/`).
  - Token màu, chữ và khoảng cách chỉ khai báo một lần: `apps/web/src/shared/ui/tokens.css` và `PetkitCore/Theme/`.
  - Component dùng chung đặt ở `src/shared/ui/` và `MyPetkit/Shared/`.
  - Mỗi màn dựng theo artboard ghi trong bảng §4.
  - Các luật cứng ở §6 chặn khi review.

---

## Phần B: Quy ước code

### B1. Đặt tên và kích thước file
| Ngôn ngữ | File | Ghi chú |
|---|---|---|
| Python | `snake_case.py`, tên dài và mô tả rõ | Module Python không dùng được kebab-case |
| TypeScript | `kebab-case.ts`, component `kebab-case.tsx` export `PascalCase` | |
| Swift | `PascalCase.swift` theo type chính | |

Giới hạn kích thước file:
- **Code mới: ≤ 200 dòng.** Vượt thì tách theo ranh giới thật.
- Ngoại lệ có lý do, phải ghi trong `docs/code-standards.md`:
  - `events/codes.py` và `devices/payloads.py` (bảng protocol);
  - code sinh tự động;
  - file test fixture.

### B2. Format, lint và type
| | Code mới (`features/`, `web/`, `shared/`, `auth`) | Code port (protocol core) |
|---|---|---|
| Format | `ruff format` bắt buộc | **Không reformat**, để diff được với upstream |
| Lint | ruff: `F, E, W, B, S, UP, SIM, RUF, PL, PT, ASYNC, BLE, TRY` | Rule gốc `F, E9, B, PLC0415`, **cộng `S` (bảo mật) và `ASYNC` ngay từ phase 02**. Hit cũ ghi vào baseline, không cho phát sinh hit mới |
| Type | `mypy --strict` | `mypy` thường. Mỗi module port được siết dần sang strict qua commit riêng, golden check phải xanh |
| TS | `strict`, `noUncheckedIndexedAccess`, ESLint + `eslint-plugin-security`, cấm `any`, cấm `dangerouslySetInnerHTML` | – |
| Swift | Swift 6 strict concurrency, SwiftLint. Cấm `!` force unwrap và `try!` ngoài test | – |

Cấu hình hiện tại (`services/api/pyproject.toml`): bộ ruff mở rộng được `select` cho toàn repo rồi
`per-file-ignores` với pattern phủ định cho mọi file KHÔNG thuộc danh sách code mới, vì ruff không
chọn rule theo đường dẫn được. `mypy --strict` áp qua `[[tool.mypy.overrides]]` (liệt kê từng cờ
của strict, vì `strict` không phải option theo module). `ruff format --check` chạy trong CI trên
cùng danh sách. Danh sách hiện tại: `features/auth/`, `shared/{errors,redact_client,request_auth,tiers}.py`,
`utils/user_tls.py`. Module port nằm trong `shared/` (`panel_request.py`, `live_settings.py`, …)
vẫn theo baseline cho tới khi được siết riêng. Thêm file mới vào user plane thì thêm vào cả ba chỗ.

### B3. Comment, lỗi, log
- **Comment** giải thích **vì sao**: invariant, ràng buộc của firmware, bằng chứng (capture, hàm firmware, commit).
  - Không ghi mã phase hay finding (R1, V4, H12…) trong code, test name hay commit message.
  - Docstring "WHY" của code gốc giữ nguyên văn, vì git history của gốc đã bị squash và đó là nguồn duy nhất.
- **Lỗi ở user plane**:
  - Envelope cố định `{"error": {"code": "<slug>", "message": "<an toàn để hiển thị>"}}`.
  - Không lộ stack trace, đường dẫn file, SQL hay giá trị secret.
  - Lỗi không lường trước trả 500 kèm `code: internal` và một correlation id. Chi tiết chỉ nằm trong log.
- **Lỗi ở device plane**: giữ invariant gốc. Không bao giờ trả 4xx/5xx cho thiết bị, input từ thiết bị không bao giờ làm raise (`utils/coerce`, `safe_join`).
- **Log**:
  - Log có cấu trúc (key=value).
  - Không log secret, token, mật khẩu, chữ ký, payload nguyên văn hay SSID. Mọi giá trị có thể nhạy cảm phải qua helper redact.
  - Loại ký tự điều khiển khỏi chuỗi đến từ thiết bị, chống log injection.

### B4. Test
- Tên test mô tả kịch bản, ví dụ `test_stitch_keeps_chunks_when_db_swap_fails`.
- Mỗi bug fix có test tái hiện trước khi sửa.
- Mọi feature có ít nhất:
  - happy path;
  - test thiếu token trả 401;
  - test input sai trả lỗi đúng envelope;
  - test với route R3: thiếu step-up thì bị chặn.
- Fixture từ capture phải che secret trước khi commit (gitleaks quét cả `tests/`).
- Không mock thứ đang test. Chỉ dựng giả ở ranh giới ngoài: thiết bị, cloud PetKit, HA broker.

### B5. Git
- Conventional commits, không nhắc tới AI.
- Mỗi commit một thay đổi. Commit refactor tách khỏi commit đổi hành vi.
- Merge vào `main` chỉ qua PR, CI phải xanh (branch protection, xem C6).

### Ngoại lệ kích thước file (B1)
- `events/codes.py`, `devices/payloads.py`: bảng protocol, cố ý lớn (xem `AGENTS.md`).
- Code port từ upstream nói chung: giữ nguyên để còn diff được với upstream; chỉ tách khi phase tái cấu trúc yêu cầu.
- Code sinh tự động (client OpenAPI) và file test fixture.

## CI gates
| Gate | Công cụ | Chặn merge |
|---|---|---|
| Test API | pytest, test ID khớp baseline | Có |
| Golden device | `scripts/golden_device_responses.py` | Có |
| Lint/format/type | ruff, ruff format (code mới), mypy | Có |
| Quy tắc phụ thuộc | import-linter | Có |
| Web | ESLint, tsc, vitest, build | Có |
| iOS | SwiftLint, swift test, xcodebuild | Có |
| Contract | spec ⊆ router, client sinh không lệch | Có |
| SAST | CodeQL, Semgrep | Có (high/critical) |
| Dependency | pip-audit, osv-scanner, pnpm audit | Có (high/critical) |
| Secret | gitleaks và GitHub push protection | Có |
| Image | Trivy/Grype | Có (critical) với release |
| Fuzz | hypothesis (chạy ngắn mỗi PR, chạy dài hằng đêm) | Có (bản ngắn) |

## Thư viện validate schema: `pydantic` v2 (đã chốt 2026-10-28)
Quy tắc: chỉ dùng thư viện có **binary wheel** cho cả ba target của image (Python 3.12):
musl amd64, musl aarch64 (Alpine) và glibc armv7. Không có thì viết validator tay trên `utils/coerce`.

Bằng chứng, chạy `pip download --only-binary=:all: --python-version 3.12 --implementation cp`
kèm đủ tag tương thích của từng target (pip không tự nới một `--platform` tường minh xuống tag cũ
hơn, nên phải liệt kê `musllinux_1_1` bên cạnh `musllinux_1_2`, và `manylinux_2_17`…`2_36` cho armv7):

| Gói (bản mới nhất) | musl amd64 | musl aarch64 | glibc armv7 |
|---|---|---|---|
| `pydantic` 2.14.1 + `pydantic-core` 2.50.1 | `musllinux_1_1_x86_64` | `musllinux_1_1_aarch64` | `manylinux_2_17_armv7l` |
| `msgspec` 0.22.0 | `musllinux_1_2_x86_64` | `musllinux_1_2_aarch64` | **không có** |

- Chọn `pydantic` v2: là ứng viên duy nhất đủ wheel cho cả ba target. `msgspec` loại vì armv7 phải
  build từ source.
- Bẫy đã gặp khi kiểm: chỉ truyền `--platform musllinux_1_2_*` thì pip không thấy wheel
  `musllinux_1_1` của `pydantic-core` và lặng lẽ lùi về `pydantic` 1.10. Luôn liệt kê đủ tag.
- Dùng cho code mới của user plane (`features/auth/schemas.py`): `extra="forbid"`, giới hạn độ dài
  chuỗi. Code port giữ `utils/coerce`.
- `argon2-cffi` (bắt buộc cho mật khẩu) có wheel musl cho amd64/aarch64 nhưng **không có wheel
  armv7**: `argon2-cffi-bindings` build từ source trên armv7 glibc. Đây không phải yêu cầu build mới:
  `cffi` (phụ thuộc của `cryptography`) cũng không có wheel armv7 và đã build từ source ở đó, nên
  image armv7 vốn cần sẵn toolchain C.

## Câu hỏi chưa giải đáp
- CSP `frame-ancestors` cho HA Ingress: origin chính xác cần cho phép, xác minh trên HA thật ở phase 11.
