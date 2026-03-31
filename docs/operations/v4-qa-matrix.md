# V4 QA Matrix

Tài liệu này gom các lệnh verify tối thiểu trước khi mở thêm traffic cho `server-v4`.

## Mục tiêu

- Xác nhận `server-v4` vẫn mount đúng shell và module catalog.
- Giữ parity cho các boundary đã tách ra ở monolith: reporting, ECUS bridge, importer shell.
- Bảo đảm migration/readiness gate không bị bỏ qua khi bật thêm read hoặc write path.

## Ma trận verify

| Area | Command | Expected signal | Scope |
| --- | --- | --- | --- |
| One-shot parity runner (W5-6) | `pnpm run verify:v4:parity` | exit `0`, summary `failed=0` | adapter-vs-canonical parity + migration rehearsal baseline |
| Rollout rehearsal evidence capture | `pnpm run verify:v4:rehearsal -- --label <env>` | exit `0` khi khong co blocker gate, ghi `.json` + `.md` vao `docs/operations/v4-rollout-evidence` | luu bang chung `/api/v4/health` + `/api/v4/meta/rollout` moi lan rehearsal |
| `server-v4` shell health + rollout metadata | `pnpm exec vitest run tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js` | `5/5` pass | `/api/v4/health`, `/api/v4/meta/modules`, `/api/v4/meta/rollout` |
| `server-v4` runtime reporting parity | `pnpm exec vitest run tests/server-v4/runtimeRoutes.test.js tests/server-v4/reportingService.test.js tests/server-v4/legacyReportBridge.test.js` | all green | reporting read/write boundary + legacy math seam |
| Monolith ECUS bridge extraction | `pnpm exec vitest run tests/server.ecusBridgeService.test.js tests/server.ecusSqlBridge.test.js tests/server.api.test.js tests/server.seed.test.js` | all green | SQL Server bridge, sync health, API integration |
| Import workflow regression | `pnpm exec vitest run tests/dataImporter.preview.test.jsx tests/dataImporterWorkflowGuide.test.jsx tests/useDataImporterWorkflowSession.test.jsx` | all green | guided workflow, sync preview promotion, preview/save flow |
| Reporting client + viewer parity | `pnpm exec vitest run tests/reportingClient.test.js tests/reportViewer.test.jsx` | all green | reporting view model + dashboard rendering |
| Static verification | `pnpm run typecheck:server-v4` | exit `0` | TS surface stays consistent |
| Lint verification | `pnpm exec eslint server-v4/src/app/build-v4-app.ts server-v4/src/app/v4-rollout-status.ts tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js` | `0` errors, `0` warnings | rollout/health slice |
| Diff hygiene | `git diff --check -- server-v4/src/app/build-v4-app.ts server-v4/src/app/v4-rollout-status.ts tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js docs/operations/v4-qa-matrix.md docs/operations/v4-rollout-plan.md` | no output | CRLF + whitespace discipline |

### Quick parity check

- `pnpm run verify:v4:parity:quick` khi can rerun nhanh 5 lane quan trong truoc khi day full matrix.
- `pnpm run verify:v4:parity -- --with-diff` neu can gom them diff hygiene command vao cung mot lan chay.

## Manual spot checks

1. Gọi `GET /api/v4/health` và xác nhận `readiness.state` không phải `blocked`.
2. Gọi `GET /api/v4/meta/rollout` và kiểm tra:
   - `health.dbFile.state` là `ready` trên môi trường rollout thật.
   - `migrationVerification.checks` không có `fail`.
   - `rollout.currentStage` khớp stage đang công bố.
3. Mở Data Health Dashboard và xác nhận monolith vẫn báo healthy cho ECUS SQL/backup path trước khi bật bất kỳ write traffic nào sang `v4`.

### Rehearsal helper

- Dùng `pnpm run verify:v4:rehearsal -- --label staging --expected-stage module-parity` để tự động:
  - fetch `/api/v4/health` + `/api/v4/meta/rollout`
  - đánh giá gate (`readiness blocked`, `migration checks fail`)
  - ghi bằng chứng JSON/Markdown dưới `docs/operations/v4-rollout-evidence/`
- Thêm `--allow-failed-gates` chỉ khi cần chụp chứng cứ điều tra mà không muốn command fail CI.

## Exit rule

Không bật stage kế tiếp nếu:

- Có bất kỳ command nào trong bảng trên fail.
- `/api/v4/meta/rollout` trả `health.readiness.state = "blocked"`.
- `migrationVerification.checks` có ít nhất một mục `status = "fail"`.
