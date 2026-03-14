# KPI System Review And V4 Rebuild Plan

## 1. Executive Verdict

Hệ thống hiện tại **không chỉ bị “monolith to”**. Nó đang có bốn vấn đề nền:

1. **Ranh giới bảo mật bị thủng**: nhiều API nhạy cảm không được chặn ở backend.
2. **Mô hình dữ liệu sai tầng**: JSON blob trong SQLite làm triệt tiêu query/index/concurrency.
3. **Ranh giới module rất yếu**: domain logic, infra, UI state, sync, report, AI dồn vào vài file cực lớn.
4. **Luồng vận hành chưa đủ chắc**: dependency/runtime/test state chưa tạo được baseline đáng tin để refactor an toàn.

Nếu chỉ “cleanup code” thì sẽ không đủ. Bản v4 nên được xem là **một cuộc tái kiến trúc có kiểm soát**, không phải đắp thêm tính năng trên nền hiện tại.

## 2. Findings

### F1. `bootstrap` đang phá hỏng boundary đăng nhập
- Severity: Critical
- Evidence:
  - [src/main.jsx](/E:/GPT/kpi_source_code_v4/src/main.jsx#L41) gọi `initSharedStorage()` trước khi render app.
  - [src/lib/storageClient.js](/E:/GPT/kpi_source_code_v4/src/lib/storageClient.js#L534) và [src/lib/storageClient.js](/E:/GPT/kpi_source_code_v4/src/lib/storageClient.js#L560) gọi `/api/bootstrap`.
  - [server/index.js](/E:/GPT/kpi_source_code_v4/server/index.js#L24638) mở `GET /api/bootstrap` mà không có auth guard.
  - [server/index.js](/E:/GPT/kpi_source_code_v4/server/index.js#L5039) `readStorage()` đọc toàn bộ `kv_store`.
  - [tests/server.api.test.js](/E:/GPT/kpi_source_code_v4/tests/server.api.test.js#L1247) còn test mặc định rằng endpoint này trả `200`.
- Impact:
  - Dữ liệu store được đẩy về client trước khi xác thực backend.
  - Login hiện tại chủ yếu là chặn UI, không phải chặn dữ liệu.
- Conclusion:
  - Đây là lỗi kiến trúc nghiêm trọng nhất của hệ thống hiện tại.

### F2. API quản lý tài khoản không có authorization ở route
- Severity: Critical
- Evidence:
  - [server/index.js](/E:/GPT/kpi_source_code_v4/server/index.js#L25954) `GET /api/auth/accounts`
  - [server/index.js](/E:/GPT/kpi_source_code_v4/server/index.js#L25972) `POST /api/auth/accounts`
  - [server/index.js](/E:/GPT/kpi_source_code_v4/server/index.js#L25994) `PATCH /api/auth/accounts/:username`
  - [server/index.js](/E:/GPT/kpi_source_code_v4/server/index.js#L26018) `POST /api/auth/accounts/:username/password`
  - [server/index.js](/E:/GPT/kpi_source_code_v4/server/index.js#L26042) `DELETE /api/auth/accounts/:username`
  - Các hàm nghiệp vụ tương ứng [server/index.js](/E:/GPT/kpi_source_code_v4/server/index.js#L11514), [server/index.js](/E:/GPT/kpi_source_code_v4/server/index.js#L11622), [server/index.js](/E:/GPT/kpi_source_code_v4/server/index.js#L11812), [server/index.js](/E:/GPT/kpi_source_code_v4/server/index.js#L11890) cũng không tự kiểm tra session/permission.
- Impact:
  - Caller có thể tạo user mới, đổi role, reset mật khẩu, xóa tài khoản mà không bị backend chặn theo quyền.
  - Nếu caller tạo tài khoản role `admin`, hệ thống bị takeover.
- Conclusion:
  - Đây là lỗ hổng chiếm quyền toàn hệ thống.

### F3. Tài khoản/mật khẩu mặc định đang hardcode trong backend và seed data
- Severity: High
- Evidence:
  - [server/index.js](/E:/GPT/kpi_source_code_v4/server/index.js#L1288) `DEFAULT_ACCOUNT_SEED`
  - [server/index.js](/E:/GPT/kpi_source_code_v4/server/index.js#L1524) `buildDefaultAccounts()`
  - [README.md](/E:/GPT/kpi_source_code_v4/README.md#L208) từng công khai danh sách tài khoản mặc định.
  - `server/data/db.json` từng chứa password plaintext trong `kpi_users_v1`.
- Impact:
  - Secret hygiene rất kém.
  - Nếu deploy nhầm seed hoặc backup cũ, hệ thống rất dễ bị truy cập trái phép.
- Conclusion:
  - V4 phải loại bỏ hoàn toàn seed password cứng khỏi mã nguồn và dữ liệu mẫu trackable.

### F4. Một số endpoint cấu hình/vận hành đang mở công khai và cho phép giả mạo `actor`
- Severity: High
- Evidence:
  - [server/index.js](/E:/GPT/kpi_source_code_v4/server/index.js#L27612) `GET /api/import/ecus/config` mở công khai.
  - [server/index.js](/E:/GPT/kpi_source_code_v4/server/index.js#L27786) `GET /api/import/alerts` mở công khai.
  - [server/index.js](/E:/GPT/kpi_source_code_v4/server/index.js#L28002) `PUT /api/import/alerts/config` không dùng guard.
  - [server/index.js](/E:/GPT/kpi_source_code_v4/server/index.js#L28024) `POST /api/import/alerts/review` không dùng guard.
  - [server/index.js](/E:/GPT/kpi_source_code_v4/server/index.js#L28040) `POST /api/import/alerts/unreview` không dùng guard.
  - [server/index.js](/E:/GPT/kpi_source_code_v4/server/index.js#L4387) `resolveActor()` tin `req.body.actor` và `req.query.actor`.
  - [tests/server.api.test.js](/E:/GPT/kpi_source_code_v4/tests/server.api.test.js#L4047) và [tests/server.api.test.js](/E:/GPT/kpi_source_code_v4/tests/server.api.test.js#L6973) còn coi một phần hành vi public này là bình thường.
- Impact:
  - Người gọi có thể sửa config cảnh báo, review/unreview dữ liệu, và tự nhận danh tính khác trong audit log.
  - Endpoint config ECUS còn làm lộ cấu trúc kết nối nội bộ cho người không xác thực.
- Conclusion:
  - Audit trail hiện tại không đáng tin tuyệt đối vì actor có thể bị giả mạo ở một số luồng.

### F5. Persistence hiện tại chặn đường scale và phân tích dữ liệu
- Severity: High
- Evidence:
  - [server/index.js](/E:/GPT/kpi_source_code_v4/server/index.js#L2219) tạo `kv_store (key, value)` làm trung tâm lưu trữ.
  - [server/index.js](/E:/GPT/kpi_source_code_v4/server/index.js#L12250) và [server/index.js](/E:/GPT/kpi_source_code_v4/server/index.js#L12270) đọc/ghi toàn bộ `decl_rows_v1` như một blob.
  - [server/index.js](/E:/GPT/kpi_source_code_v4/server/index.js#L27796) `/api/import/search` load toàn bộ rows rồi filter trong RAM.
  - [src/lib/store.js](/E:/GPT/kpi_source_code_v4/src/lib/store.js#L3416) và [src/lib/store.js](/E:/GPT/kpi_source_code_v4/src/lib/store.js#L3428) cũng giữ declaration store ở phía client.
  - [src/main.jsx](/E:/GPT/kpi_source_code_v4/src/main.jsx#L41) + [src/lib/storageClient.js](/E:/GPT/kpi_source_code_v4/src/lib/storageClient.js#L560) kéo full snapshot khi app boot.
- Impact:
  - Không có index/query đúng nghĩa cho dữ liệu nghiệp vụ nóng.
  - Startup cost tăng tuyến tính theo số năm dữ liệu.
  - Multi-user concurrency, partial updates, optimistic locking và analytics đều bị bó tay.
- Conclusion:
  - Với tăng trưởng khoảng 3.000 tờ khai/tháng, mô hình này sẽ ngày càng nặng và khó kiểm soát.

### F6. Auth model đang mâu thuẫn giữa client và server
- Severity: Medium
- Evidence:
  - [src/auth/localAuth.js](/E:/GPT/kpi_source_code_v4/src/auth/localAuth.js#L47) lưu session token vào `localStorage`.
  - [src/auth/localAuth.js](/E:/GPT/kpi_source_code_v4/src/auth/localAuth.js#L303) luôn gửi `Authorization: Bearer ...`.
  - [server/index.js](/E:/GPT/kpi_source_code_v4/server/index.js#L1242) định nghĩa cookie `kpi_session`.
  - [server/index.js](/E:/GPT/kpi_source_code_v4/server/index.js#L4235) xác thực session chỉ từ cookie.
- Impact:
  - Token trong `localStorage` gần như vô ích với backend hiện tại nhưng lại mở thêm bề mặt XSS.
  - Semantics auth bị rối, khó debug và khó harden.
- Conclusion:
  - V4 nên chọn một mô hình rõ ràng: server-side session cookie hoặc token-based auth, không chơi nửa mùa.

### F7. Kiến trúc module hiện tại đã vượt ngưỡng maintainability
- Severity: Medium
- Evidence:
  - `server/index.js`: 13.417 dòng
  - `src/lib/store.js`: 4.552 dòng
  - `src/components/DataImporter.jsx`: 9.405 dòng
  - `src/components/ReportViewer.jsx`: 3.679 dòng
  - `DataImporter.jsx` có khoảng 90 state hooks; `ReportViewer.jsx` có khoảng 39.
  - [docs/ux-improvement-backlog.md](/E:/GPT/kpi_source_code_v4/docs/ux-improvement-backlog.md#L24) đã tự thừa nhận cần tách wizard, virtual list, saved preset, global search, retry queue.
- Impact:
  - Review khó.
  - Test khó cô lập.
  - Refactor an toàn gần như không thể nếu không tách boundary trước.
- Conclusion:
  - Đây không còn là chuyện “đẹp code”; đây là risk thực thi dự án.

### F8. Baseline chạy local và regression chưa đủ đáng tin
- Severity: Medium
- Evidence:
  - `pnpm healthcheck` hiện fail vì `node_modules/express/index.js` bị thiếu trong workspace local copy.
  - [TODO.md](/E:/GPT/kpi_source_code_v4/TODO.md#L1) còn ghi nhận test lỗi do CRLF, `EADDRINUSE`, và lint warnings chưa xử lý xong.
- Impact:
  - Rất khó xác nhận “đã cải thiện mà không phá vỡ nghiệp vụ”.
  - Tốc độ refactor sẽ chậm vì baseline không sạch.
- Conclusion:
  - Trước khi đụng mạnh, phải dựng lại baseline chạy/test reproducible.

## 3. Pushback

### 3.1. Đừng vội rewrite toàn bộ sang ngôn ngữ khác
Tôi phản biện đề xuất “JS chậm nên đổi hết sang loại khác” như sau:

- Nút thắt lớn nhất hiện tại **không phải** runtime JavaScript.
- Nút thắt thật là:
  - authz sai
  - JSON blob store
  - bootstrap full snapshot
  - file quá lớn
  - boundary domain quá yếu

Nếu đổi thẳng sang Go/.NET/Rust ngay bây giờ, anh sẽ:
- tăng rủi ro mất nghiệp vụ ngầm
- tăng chi phí migration
- chưa chắc giải quyết được bottleneck thật

### 3.2. Thứ nên đổi ngay là database + typing + module boundary
Lộ trình hiệu quả hơn:
- **Đổi từ JavaScript sang TypeScript** ở core app.
- **Đổi từ SQLite JSON blob sang PostgreSQL** cho domain nóng.
- **Tách ECUS/Windows integration thành service riêng**, không bắt cả hệ thống phải mang gánh nặng Windows/DPAPI.

### 3.3. Không nên nhảy lên microservices ngay
Đề xuất đúng là:
- **modular monolith trước**
- service riêng chỉ cho integration đặc thù (ECUS bridge, background jobs nếu cần)

Lý do:
- business rule đang nằm lẫn vào UI/store/backend monolith
- nếu tách microservices quá sớm thì chỉ biến chaos nội bộ thành chaos phân tán

## 4. Target V4 Architecture

## 4.1. Stack đề xuất

### Core application
- Frontend: `React + TypeScript + Vite`
- State/data fetching: `TanStack Query` + typed API client
- Backend API: `Fastify + TypeScript + Zod`
- Database: `PostgreSQL`
- Query layer: `Kysely` hoặc `Drizzle`
- Jobs: `pg-boss` trên PostgreSQL trước, chỉ thêm Redis nếu thật sự cần

### Integration layer
- `ECUS Bridge` chạy riêng trên Windows, đề xuất viết bằng `.NET` hoặc `Node/TS` service nếu muốn tận dụng code cũ
- Bridge chịu trách nhiệm:
  - đọc credential kiểu DPAPI
  - kết nối SQL Server 2008 R2
  - normalize dữ liệu ECUS
  - gửi batch/job lên API trung tâm

### Why this split
- Core app được chuẩn hóa cho Docker/PostgreSQL.
- Bridge giữ phần đặc thù Windows/ECUS ở biên.
- Không bắt backend chính phải mang logic máy-trạm.

## 4.2. Delivery shape
- `apps/web` – frontend
- `apps/api` – backend API modular monolith
- `apps/ecus-bridge` – Windows sync service
- `packages/ui` – design system, shared components
- `packages/domain` – schema, validators, DTOs, permissions, shared business primitives
- `packages/api-client` – typed client cho frontend

## 4.3. Module boundaries
Mỗi module nghiệp vụ nên có:
- `routes`
- `service`
- `repository`
- `schema`
- `tests`

Domain modules tối thiểu:
- auth
- accounts
- declarations
- mst-assignment
- teams
- customs-agencies
- kpi-rules
- kpi-adjustments
- reporting
- notifications
- ai-assist
- ecus-sync
- audit

## 5. Target Database Design

## 5.1. Tables nên có thật
- `accounts`
- `account_sessions`
- `roles`, `role_permissions`
- `teams`, `team_members`
- `declarations`
- `declaration_events`
- `mst_assignments`
- `mst_assignment_history`
- `customs_agencies`
- `agency_history`
- `kpi_rule_sets`
- `kpi_rules`
- `kpi_adjustments`
- `kpi_adjustment_reviews`
- `report_schedules`
- `report_exports`
- `notifications`
- `ecus_sync_runs`
- `ecus_sync_batches`
- `ai_configs`
- `ai_snapshots`
- `ai_insights`
- `ai_feedback`

## 5.2. Index strategy
- `declarations(declaration_no, branch)` unique business key
- `declarations(registered_at desc)`
- `declarations(tax_code)`
- `declarations(staff_id, registered_at desc)`
- `declarations(team_id, registered_at desc)`
- `kpi_adjustments(month, status)`
- `mst_assignments(tax_code, effective_from desc)`
- trigram index cho `company_name` nếu cần search gần đúng

## 5.3. Derived/reporting tables
Không nên tính tất cả từ raw declarations trên mỗi request.

Nên có:
- `staff_monthly_kpi_stats`
- `team_monthly_kpi_stats`
- `declaration_alerts_current`
- materialized views hoặc refresh tables cho dashboard

## 5.4. Migration strategy
- Giai đoạn đầu dual-write:
  - vẫn giữ SQLite đọc cũ cho một số module
  - viết mới sang Postgres cho domain nóng
- Backfill:
  - đọc blob `decl_rows_v1`, `mst_rows_v2`, `team_roster_v1`, `kpi_rules_v2`, `kpi_adjustments_v1`
  - normalize thành bảng quan hệ
- Cutover:
  - chuyển API đọc sang Postgres theo từng module

## 6. UI/UX Direction For V4

## 6.1. Design direction
Từ `ui-ux-pro-max`, hướng phù hợp nhất là:
- Pattern: `Data-Dense + Drill-Down`
- Style: `Data-Dense Dashboard`
- Layout: nhiều KPI cards + bảng + bộ lọc, nhưng có progressive disclosure

Tôi giữ hướng này, nhưng điều chỉnh typography:
- dùng `Lexend` hoặc `Source Sans 3` cho heading/body để đọc tiếng Việt tốt hơn
- chỉ dùng `Fira Code` cho số tờ khai, MST, audit ID, log snippets

## 6.2. Visual system
- Light-first, không dark-first
- Neutral background: `#F8FAFC`
- Text: `#1E293B`
- Primary actions/status: xanh hệ thống
- Cảnh báo/rủi ro: cam
- Tích cực/đã xử lý: xanh lá
- Focus ring rõ ràng, contrast đạt AA

## 6.3. Shell mới
- Left sidebar theo domain thay vì tab dàn ngang quá dài
- Top bar:
  - global search
  - sync status
  - notifications
  - current user / role
- Command Center thành primitive chính, không phải add-on localStorage-only

## 6.4. Workflow redesign ưu tiên

### Import Data
- tách thành wizard 4 bước:
  1. nguồn dữ liệu
  2. preview & mapping
  3. validation/conflict review
  4. commit & audit
- đọc XLSX bằng worker/background job, không khóa main thread
- sync có progress rõ ràng, resume, retry

### MST assignment
- workspace theo hàng đợi
- quick filters thực sự persistent theo user
- timeline history rõ ràng
- conflict detection cho MST trùng

### KPI adjustments
- list phân trang/virtualized
- bulk approve/reject
- deep link sang declaration/MST liên quan

### Reports
- dashboard overview riêng
- report center riêng
- schedule builder có preview và next-run

## 7. Refactor Plan

## Phase 0: Immediate Hardening
- Lock down `/api/bootstrap`.
- Lock down toàn bộ `/api/auth/accounts*`.
- Lock down alert/config endpoints.
- Bỏ `actor` từ client ở các route nhạy cảm; actor phải lấy từ session.
- Xóa seed password cứng khỏi code runtime.
- Ngừng lưu session token vào localStorage nếu backend vẫn dùng cookie session.
- Viết regression tests cho authz.

## Phase 1: Baseline Recovery
- Sửa workspace để `pnpm install`, `pnpm healthcheck`, `pnpm test` có baseline sạch.
- Chuẩn hóa line endings, port handling, lint.
- Đóng băng feature work nếu baseline chưa sạch.

## Phase 2: Data Foundation
- Dựng PostgreSQL schema.
- Viết migration/backfill từ SQLite blobs.
- Chuyển hot-path read APIs sang Postgres:
  - declarations
  - MST
  - teams
  - rules
  - adjustments

## Phase 3: Backend Modular Monolith
- Tạo `apps/api` bằng TypeScript.
- Mỗi domain tách route/service/repository/schema/tests.
- Đưa auth/permission thành middleware/guard chuẩn.
- Chuẩn hóa request/response bằng Zod DTO.

## Phase 4: UI Shell And Design System
- Tạo `packages/ui`.
- Tách app shell, command center, table primitives, filter bar, form primitives.
- Refactor dần:
  - `DataImporter`
  - `ReportViewer`
  - `KPIAdjustments`
  - `MSTAssignment`

## Phase 5: ECUS Bridge
- Tách sync khỏi web app.
- Tạo Windows service riêng cho SQL Server 2008 R2 + DPAPI.
- Đồng bộ theo job/batch.
- Backend chính chỉ nhận normalized payload/job results.

## Phase 6: Reporting And Analytics Optimization
- Precompute monthly KPI stats.
- Server-side search/pagination.
- Add observability: job runs, API latency, sync failures, data freshness.

## 8. Non-Negotiable Engineering Rules For V4
- Không module nào > 800 LOC nếu có thể.
- Mọi module mới phải có test.
- Business rule không được nằm trong component UI lớn.
- Không dùng generic JSON blob cho hot business entities.
- Không để route nhạy cảm sống mà thiếu authz test.
- Không để startup phụ thuộc vào full snapshot cho mọi client.

## 9. Recommended First Deliverables

Nếu làm theo thứ tự đúng, tôi khuyên bắt đầu bằng 5 deliverable này:

1. Security patch release cho các route công khai.
2. Baseline build/test recovery.
3. PostgreSQL schema draft + migration map từ `kv_store`.
4. App shell + design system spec cho frontend v4.
5. RFC cho `ECUS Bridge` tách khỏi core app.

## 10. Final Recommendation

Tôi **ủng hộ mạnh** việc:
- chuyển sang PostgreSQL
- chuyển sang TypeScript
- tách integration Windows/ECUS ra khỏi core app
- refactor theo modular monolith

Tôi **không ủng hộ**:
- giữ SQLite JSON blob làm trung tâm lâu dài
- rewrite toàn bộ sang ngôn ngữ khác ngay lập tức
- tách microservices sớm
- làm mới UI trước khi vá security boundary và data model
