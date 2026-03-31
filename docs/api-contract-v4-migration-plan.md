# API Contract v4 Migration Plan

Last updated: 2026-03-31

Tracking board: [docs/big-bang-execution-status.md](/E:/GPT/kpi_source_code_v4/docs/big-bang-execution-status.md)  
Program beads: `cng-mbu.1` (contract freeze), `cng-mbu.3` (frontend canonical client)

## Scope

Mục tiêu tài liệu này là chốt inventory route frontend để migrate dần về contract canonical `/api/v4/*` trước big-bang cutover.

## W1 Contract Freeze Baseline (`cng-mbu.1`)

### Canonical API inventory (server-v4)

Nguồn inventory: `server-v4/src/modules/*.module.ts` + `server-v4/src/app/build-v4-app.ts`.

| Module | Base path | Core routes |
|---|---|---|
| auth | `/api/v4/auth` | `/session`, `/login`, `/logout`, `/accounts`, `/accounts/:username` |
| alerts | `/api/v4/alerts` | `/summary`, `/config`, `/notifications`, `/notifications/stream`, `/review`, `/unreview` |
| backup | `/api/v4/backups` | `/summary`, `/files`, `/run`, `/schedule`, `/restore` |
| declarations | `/api/v4/declarations` | `/imports/ecus-*`, `/imports/co-*`, `/imports/alerts*`, `/`, `/:declarationId`, `/:declarationId/events` |
| hq-agencies | `/api/v4/hq-agencies` | `/`, `/history`, `/:taxCode` |
| kpi-adjustments | `/api/v4/kpi-adjustments` | `/`, `/:adjustmentId`, `/settings` |
| kpi-rules | `/api/v4/kpi-rules` | `/`, `/:ruleSetId/activate` |
| mst-assignments | `/api/v4/mst-assignments` | `/`, `/resolve`, `/:assignmentId`, `/history` |
| reporting | `/api/v4/reporting` | `/summary`, `/staff`, `/teams`, `/aggregates/monthly`, `/exports`, `/schedules` |
| teams | `/api/v4/teams` | `/`, `/:teamId`, `/:teamId/members`, `/members/:memberId` |
| app meta | `/api/v4/meta` | `/modules`, `/rollout` |

### Response envelope baseline

Nguồn chuẩn controller: `server-v4/src/http/BaseController.ts`.

- Success (chuẩn canonical):  
  - `{"ok": true, "data": ...}`
- Error (chuẩn canonical):  
  - `{"ok": false, "error": {"code": string, "message": string, "details"?: unknown}}`
- Transitional (đang chấp nhận trong W1 do endpoint metadata/health):  
  - `{"ok": true, ...payloadTopLevel}`

Mapping mã lỗi HTTP chuẩn hóa:

| HTTP | `error.code` điển hình |
|---|---|
| 400 | `validation_error`, `invalid_request`, `no_change` |
| 401 | `auth_required` |
| 403 | `forbidden` |
| 404 | `not_found` |
| 409 | `review_locked` (domain-specific conflict) |
| 500 | `internal_error` |

### Permission model baseline

Nguồn chuẩn role/permission: `packages/domain/src/accountRoles.js`.

- Role chuẩn: `staff`, `lead`, `manager`, `admin`.
- Permission keys chuẩn:
  - `importEdit`, `importUpload`, `mstEdit`, `rulesEdit`, `teamsEdit`, `syncManage`, `reportsExport`, `alertsManage`, `auditView`, `accountManage`, `adjustSubmit`, `adjustApprove`, `adjustOverridePoints`, `aiAssistUse`, `aiAssistManage`, `dataHealthView`, `dataHealthManage`.
- Nguyên tắc freeze:
  - Mọi route mutation/restricted read đều dựa trên permission key rõ ràng (không hard-code role rời rạc).
  - Khi từ chối, trả `403` + envelope lỗi chuẩn.

### Pagination / filter / sort contract baseline

Nguồn chính: controllers/services ở `declarations`, `hq-agencies`, `kpi-adjustments`, `reporting`, `alerts`, `backup`.

- Query chuẩn:
  - `limit`: positive integer, max theo endpoint (thường `<=500`)
  - `page`, `pageSize`: positive integer cho các endpoint phân trang thực
  - Filter fields giữ tên theo domain (`mst`, `company`, `agent`, `jobSearch`, `jobStatus`, ...)
- Response pattern:
  - List đơn giản: `{ total, items }`
  - Paged search: `{ total, page, pageSize, rows }`
  - Observability nhiều panel: payload có pagination riêng theo nhóm dữ liệu
- Freeze decision:
  - Không thêm biến thể key mới ngoài `limit/page/pageSize` cho phân trang.
  - Khi cần mở rộng filter, bắt buộc document ở bảng contract domain trước khi implement.

## Completed in current wave

| Domain | Legacy route | Canonical route | Status |
|---|---|---|---|
| HQ history | `/api/hq/history` | `/api/v4/hq-agencies/history` | Done |
| Backups summary | `/api/admin/backups/summary` | `/api/v4/backups/summary` | Done |
| Backups files | `/api/admin/backups/files` | `/api/v4/backups/files` | Done |
| Backups schedule | `/api/admin/backups/schedule` | `/api/v4/backups/schedule` | Done |
| Backup run | `/api/admin/backups/run` | `/api/v4/backups/run` | Done |
| Backup restore | `/api/admin/backups/restore` | `/api/v4/backups/restore` | Done |

## Pending migration lanes

| Domain | Current frontend route(s) | Target state | Note |
|---|---|---|---|
| Data health | `/api/data-health/summary` | `/api/v4/data-health/summary` | Da co module `server-v4`; chua migrate frontend caller |
| Duplicate policy | `/api/duplicate-policy` | `/api/v4/duplicate-policy` | Da co module `server-v4`; chua migrate frontend caller |
| Filter presets | `/api/filter-presets*` | `/api/v4/filter-presets*` | Da co module `server-v4`; chua migrate frontend caller |
| Feedback/training | `/api/training-resources`, `/api/feedback*` | `/api/v4/feedback-training/*` | Da co module `server-v4`; chua migrate frontend caller |
| AI assistant | `/api/ai/*` | `/api/v4/ai/*` | Có thể migrate theo từng subdomain |
| Report export | `/api/reports/export*`, `/api/admin/audit/export` | `/api/v4/reporting/*` | Cần chuẩn hoá response + file export flow |

## W1 Sign-off: Locked Migration Domain Ownership (W2/W3)

Phan vi domain duoi day duoc freeze de trien khai, khong doi ten lane trong qua trinh lam:

| Domain lane | Backend ownership (`cng-mbu.2`) | Frontend ownership (`cng-mbu.3`) | Done when |
|---|---|---|---|
| data-health | Tao module `server-v4` + compat adapter `/api/data-health/*` | Chuyen UI qua route canonical trong `apiRoutes` | Frontend khong goi legacy route nua |
| duplicate-policy | Da co module `server-v4` + contract policy API (`GET/PUT /api/v4/duplicate-policy`) | Chuyen cac man hinh rule/policy sang canonical route | `api:contract:report` khong con route legacy lane nay |
| filter-presets | Tach persistence module + canonical `/api/v4/filter-presets*` | Chuyen hooks/preset client sang canonical | Preset CRUD parity voi legacy |
| feedback-training | Tach module training-resources/feedback | Chuyen feedback client ve canonical API | Dashboard feedback khong phu thuoc legacy |
| ai-assistant canonicalization | Chuan hoa route contract cho AI module (giu compat neu can) | Chuyen `aiClient` sang route canonical da freeze | Khong con legacy-only endpoint trong AI lane |
| rules-history | Chot canonical endpoint cho history trail cua rules | Chuyen caller lich su quy tac sang canonical | Lich su quy tac di qua 1 contract duy nhat |
| reports-export + audit-export | Chot export contract vao `reporting` module | Chuyen export buttons/workflows sang canonical | Export flow qua reporting contract thong nhat |
| notifications parity cleanup | Chot route doc/ack/review theo alerts module | Chuyen notification client sang canonical route | Notification center dung contract alerts v4 |

Quy tac freeze:
- Domain nao khong nam trong bang tren thi khong chen vao W2/W3.
- Neu can mo rong scope, phai update bang nay truoc, kem bead follow-up ro rang.

## Guardrails

- Frontend route constants tập trung ở `src/lib/apiRoutes.js`.
- Báo cáo usage route qua script:
  - `pnpm run api:contract:report`
- Release gate (khi sẵn sàng):
  - `pnpm run api:contract:gate`

## cng-mbu.1 Exit Criteria

- [x] Chốt xong canonical inventory (module + route group) và được xem là source-of-truth cho W2/W3.
- [x] Chốt envelope/error contract áp dụng cho toàn bộ route mới.
- [x] Chốt permission key taxonomy + mapping domain mutation.
- [x] Chốt chuẩn pagination/filter ở mức key và response shape.
- [x] Lock domain ownership matrix cho W2/W3.
- [x] Còn lại chỉ là migration implementation ở `cng-mbu.2` (backend) và `cng-mbu.3` (frontend), không thay đổi contract tùy tiện.

W1 sign-off record:
- Date: 2026-03-31
- Evidence commands:
  - `pnpm run api:contract:report`
  - `pnpm bd:check`
  - `pnpm bd:safe -- show cng-mbu.1`
