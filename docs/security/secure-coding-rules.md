# Secure coding rules: my-petkit

Nguồn: tài liệu quy ước của plan rebuild (phần C), chép vào repo ở phase 01. Cổng CI tương ứng: `docs/code-standards.md` mục "CI gates".

## Phần C: Bảo mật cho dự án mã nguồn mở

### C0. Mô hình mối đe dọa (rút gọn)
**Giả định cơ bản: kẻ tấn công đọc được toàn bộ source, CI và lịch sử issue.** Hệ quả:
- Không có bảo mật nào dựa vào việc giấu code.
- Mọi secret sinh riêng cho từng bản cài.
- Mọi lỗ đã biết phải được sửa và phát hành nhanh.

| Kẻ tấn công | Vị trí | Mục tiêu | Lớp phòng chính |
|---|---|---|---|
| Internet | Trước user plane (mode cloud) | Chiếm admin, đọc video, ra lệnh thiết bị, root thiết bị qua patcher | Auth + rate limit + TLS + tier/step-up (C1). Device plane không nằm trên internet |
| Thiết bị khác trong LAN | Device plane, user plane local | Giả thiết bị, lấy secret qua `dev_signup`, đẩy lệnh qua MQTT | Bind interface, MQTT chỉ cho client không theo kiểu Aliyun đi qua loopback, cap kích thước. Phần còn lại là giới hạn của firmware: ghi rõ trong `security.md` |
| Trang web độc hại trong trình duyệt của chủ nhà | User plane | CSRF, đọc WS | `SameSite=Strict`, kiểm Origin cho mọi method không an toàn và mọi WS, bắt buộc JSON, CSP |
| Thiết bị bị chiếm / payload độc | Device plane → server | Khai thác parser, ffmpeg, path traversal, SSRF qua IP báo lên | Coerce, safe_join, ffmpeg hardening, SSRF guard, fuzzing (C2–C4) |
| Chuỗi cung ứng | CI, dependency, image | Chèn mã vào bản phát hành | Pin SHA, lock có hash, ký image, SBOM, provenance (C6) |

### C1. User plane
- **Từ chối mặc định.** Mọi route khai báo tier. Test duyệt toàn bộ router, route nào thiếu tier thì fail. Chỉ `public-static` và `signed-media` được miễn token.
- **Secret sinh lúc cài**: khóa ký session, khóa HMAC cho signed URL, cert TLS. Sinh khi chạy lần đầu, lưu quyền 0600 trong data dir. **Không bao giờ có default hard-code.**
- **Mật khẩu**: argon2id. So sánh token và chữ ký bằng `hmac.compare_digest`. Ngẫu nhiên bằng `secrets`.
- **Header bảo mật**:
  - `Content-Security-Policy: default-src 'self'; frame-ancestors 'self'` (mode add-on cho phép origin HA để Ingress nhúng được, phải xác minh trước);
  - `X-Content-Type-Options: nosniff`;
  - `Referrer-Policy: no-referrer`;
  - `Strict-Transport-Security` khi chạy TLS.
- **CORS** tắt.
- **Hiện thực (đã có trong code)**:
  - Tier khai báo trên handler bằng `@tier(...)` (`shared/tiers.py`); middleware `features/auth/middleware.py` từ chối route thiếu tier. Ngoài `public-static` và `signed-media`, chỉ ba route trao đổi bí mật lấy credential được miễn token (tier `credential`: `/api/auth/setup`, `/login`, `/pairing/redeem`), có rate limit; test liệt kê đúng ba route này.
  - **Ingress**: chỉ tin khi request đến `ingress_port` (= `web_port`, chỉ ở mode add-on) **và** peer TCP đúng `172.30.32.2`. Nguồn: tài liệu developer của Home Assistant, "Presenting your app" → Ingress (`docs/apps/presentation.md`, repo `home-assistant/developers.home-assistant`, commit `8da484e`): "Only connections from `172.30.32.2` must be allowed". Header (`X-Ingress-Path`, `X-Forwarded-*`, `X-Hass-Source`) không bao giờ được tin.
  - **`frame-ancestors 'self'` đủ cho Ingress**: Supervisor proxy panel dưới `/api/hassio_ingress/<token>/` trên chính origin của HA, nên trang HA nhúng panel là `'self'`. Không cần ghi origin HA. Vẫn kiểm trên HA thật.
  - Tài liệu index của panel cũ dùng CSP rộng hơn (`legacy_panel_csp`): một inline script cho phép theo hash, `style-src 'unsafe-inline'` cho ~90 thuộc tính `style=`, ảnh `blob:`/`data:`. Bỏ khi dashboard mới thay panel cũ.
  - Origin/Host: mọi method không an toàn và mọi WS upgrade. Host phải là IP literal, `localhost` hoặc tên trong `user_hosts`; Origin (nếu có) phải trùng đúng host:port. Cookie/Ingress mà không có Origin thì bị từ chối; client token (không tự gửi kèm) thì được.
  - Lỗi 5xx: thông điệp của handler bị thay bằng correlation id, trừ 502/503/504 là thông điệp mô tả upstream do handler viết có chủ ý.
- **Input**: schema chặt, từ chối field lạ. Giới hạn độ dài chuỗi, kích thước body và số phần tử mảng. Định dạng đặc biệt (SSH pubkey, IANA timezone, tên file âm thanh) validate bằng allowlist, không dùng blocklist.
- **Output**: chỉ JSON. Web render qua React, không bao giờ chèn HTML thô. Mọi chuỗi đến từ thiết bị là dữ liệu không tin cậy.

### C2. Thực thi lệnh, file, ffmpeg
- **Lệnh**: không bao giờ `shell=True` hay `os.system`. Chuỗi `run_cmd` gửi xuống thiết bị chỉ ghép từ hằng số cộng tham số đã validate bằng allowlist (đường dẫn cố định, pubkey đúng định dạng, phần mở rộng `.mp3|.aac|.wav`). Có test chèn ký tự `;|&$\`` phải bị từ chối.
- **File**: mọi đường dẫn từ input qua `safe_join`. Không phục vụ file ngoài media root. Thư mục `.raw`/`tmp` không lộ ra user plane.
- **ffmpeg**: input từ thiết bị là dữ liệu không tin cậy.
  - `-nostdin -protocol_whitelist file,pipe`;
  - cap kích thước và thời lượng;
  - giữ timeout sẵn có;
  - pin phiên bản ffmpeg trong image, quét CVE theo image.

### C3. SSRF và kết nối ra ngoài
- **Đích là thiết bị**: mọi kết nối server tự khởi tạo tới thiết bị (go2rtc, đọc ngược của patcher, talk 9010) đi qua một module `shared/outbound_guard.py` duy nhất. Chỉ cho phép khi đủ hai điều kiện:
  - IP thuộc dải private, ULA hoặc subnet WireGuard đã cấu hình;
  - IP thuộc về thiết bị đã đăng ký.

  `request.remote` chỉ là gợi ý, không phải bằng chứng.
- **Proxy upstream**: `proxy_upstream` và `proxy_dns` chỉ nhận host trong allowlist của PetKit/Aliyun theo vùng. Đổi giá trị thuộc tier R3.
- Không tự theo redirect khi kết nối ra ngoài.

### C4. Device plane: firmware chịu được gì thì siết cái đó
- Bind interface theo config (bảng listener của phase 11). 1883 chỉ nghe loopback.
- Cap kích thước body và upload. Bucket giữ cap 50 MB như gốc; với các route khác, kiểm lại cap 1 MiB và lỗi 413 (phase 04).
- **Fuzzing** bằng `hypothesis` cho:
  - các parser của device plane: `parse_x_device`, normalize HTTP/MQTT, frame BLE W5/CTW3, JSON bare-token repair, decode khung provisioning;
  - yêu cầu: không raise, không treo, không cấp phát vô hạn.
- Hàng đợi có giới hạn, vì gốc có hàng đợi lệnh không giới hạn.
- Crypto mà protocol bắt buộc (AES-CBC, MD5 sign, HMAC kiểu Aliyun) nằm riêng trong `utils/crypto.py`, ghi rõ "do firmware bắt buộc". Không dùng chúng cho bất cứ việc gì khác.

### C5. Dữ liệu
- Data dir 0700, file 0600, `umask 077`.
- `auth.db` tách riêng.
- Secret không bao giờ đi vào response mà không qua redaction.
- Capture và device log thuộc tier R3, có cảnh báo khi xem.
- Không commit capture, data, cert hay key (`.gitignore` gốc cộng phần bổ sung, gitleaks).

### C6. Supply chain, CI, phát hành
- **Action**: pin theo SHA, `permissions` tối thiểu. Không dùng `pull_request_target` với secret. PR từ fork không bao giờ chạm tới job publish.
- **Dependency**:
  - lock có hash (Python `--require-hashes`, `pnpm --frozen-lockfile`, `Package.resolved`);
  - Dependabot;
  - `pip-audit`, `osv-scanner`, `pnpm audit` **chặn merge** khi có lỗ high/critical;
  - thêm dependency mới phải ghi lý do trong PR.
- **SAST**: CodeQL (Python, JS/TS, Swift), Semgrep với ruleset chuẩn cộng rule riêng:
  - cấm `shell=True`, `os.system`, `pickle`, `yaml.load`, `eval`;
  - cấm `app["…"]` chuỗi trần trong `features/`;
  - cấm `dangerouslySetInnerHTML`.
- **Image**:
  - multi-arch, quét bằng Trivy hoặc Grype trong CI;
  - **ký bằng cosign keyless (GitHub OIDC)**;
  - SBOM (syft) và provenance attestation đính kèm;
  - docs hướng dẫn `cosign verify`.
- **Container** (compose/VPS):
  - non-root;
  - `read_only: true` với tmpfs cho `/tmp`;
  - `no-new-privileges`;
  - `cap_drop: [ALL]` cộng `NET_BIND_SERVICE`;
  - healthcheck.

  Add-on chạy root vì Supervisor sở hữu `/data`; ghi rõ trong `security.md`.
- **Repo**:
  - branch protection trên `main`: bắt buộc PR, CI xanh, không force-push;
  - bật secret scanning với push protection;
  - bật Private Vulnerability Reporting.

### C7. Quy trình xử lý lỗ hổng
- `SECURITY.md` ghi:
  - kênh báo cáo riêng tư (GitHub advisory);
  - phiên bản được hỗ trợ (bản mới nhất);
  - mục tiêu phản hồi.
- Lỗ bảo mật được sửa trong advisory riêng tư, phát hành bản vá, rồi mới công bố.
- Không thảo luận chi tiết khai thác trong issue công khai.
- Mỗi PR chạm vào auth, `features/patchers`, `features/setup`, `outbound_guard`, `http/`, `mqtt/auth.py` hoặc workflow CI phải qua checklist review bảo mật (`docs/security/review-checklist.md`).
