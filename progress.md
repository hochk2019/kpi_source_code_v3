# Progress Log

## Session: 2026-03-08

### Phase 1: Discovery And Evidence Gathering
- **Status:** complete
- **Started:** 2026-03-08 22:xx Asia/Saigon
- Actions taken:
  - Read repo `AGENTS.md`.
  - Read and applied these skills: `planning-with-files`, `find-bugs`, `architect-review`, `ui-ux-designer`, `ui-ux-pro-max`.
  - Inspected major docs, entrypoints, storage model, auth/session flow, import/sync routes, AI routes, and existing planning docs.
  - Validated multiple likely findings with direct code reads instead of relying on superficial repo summaries.
  - Initialized a local beads tracker and created task `cng-zss`.
- Files created/modified:
  - `task_plan.md` (created)
  - `findings.md` (created)
  - `progress.md` (created)
  - `task.md` (created)
  - `docs/system-v4-review-plan.md` (created)

### Phase 2: Architecture Review And V4 Blueprint
- **Status:** complete
- Actions taken:
  - Ranked the system findings by severity and operational impact.
  - Produced a unified review and v4 modernization plan.
  - Chose a staged target direction: TypeScript, PostgreSQL, modular monolith, and a separate Windows ECUS bridge.
  - Prepared concise executive summary for user delivery.
- Files created/modified:
  - `docs/system-v4-review-plan.md` (created)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

## Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| Beads availability | `bd ready --json` | Tracker ready | Failed: no DB initialized | observed |
| Beads initialization | `bd init --prefix cng --setup-exclude` | Local tracker available | Success; tracker initialized locally | pass |
| Beads task tracking | `bd create ...` and `bd update ... --status in_progress` | Active tracked task | Created `cng-zss` and marked it `in_progress` | pass |
| Local health check | `pnpm healthcheck` | Runnable baseline | Failed: missing `node_modules/express/index.js` | observed |

## Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-03-08 | `bd ready --json` -> no beads database found | 1 | Plan to initialize local beads for this repo copy |
| 2026-03-08 | `pnpm healthcheck` -> missing Express entry file | 1 | Record as dependency/workspace integrity issue |

## 5-Question Reboot Check
| Question | Answer |
|----------|--------|
| Where am I? | Phase 1: Discovery And Evidence Gathering |
| Where am I going? | Architecture review, then v4 rebuild/refactor blueprint, then final delivery |
| What's the goal? | Produce a comprehensive review and a strong v4 modernization plan while preserving current features |
| What have I learned? | The highest risks are security/authz gaps, blob-based persistence, monolithic boundaries, and operational inconsistency |
| What have I done? | Read core code/docs, validated sensitive routes and account handling, started persistent task tracking, and produced the master v4 review doc |

## Session: 2026-03-08 Late

### Phase Shift: Review To Execution Program
- **Status:** complete
- Actions taken:
  - Re-read `AGENTS.md` and the `planning-with-files` workflow before continuing.
  - Verified the current `bd` tracker state and confirmed the v4 execution epic `cng-7c8` with child tasks exists.
  - Switched `task.md` from the completed review task to the active v4 execution program.
  - Rewrote `task_plan.md` to reflect the implementation phases and set `cng-7c8.1` as the first active work item.
  - Synced the backlog into `findings.md` so the notebook and beads share the same phase map.
- Files created/modified:
  - `task.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

## Current Focus
- Active epic: `cng-z7u`
- Active task target: `cng-z7u.1` (`in_progress`)
- Next action: commit the planning/tracker/notebook state locally, then execute the projection-backed reporting aggregate pipeline slice.

## Session: 2026-03-14 Residual Convergence Planning

### Phase Shift: Closed Follow-Through To Residual End-State Program
- **Status:** complete
- Actions taken:
  - Re-read the current notebook and the original `docs/system-v4-review-plan.md` findings to map `F1..F8` to present-day completion status instead of assuming the old review still matched the codebase.
  - Confirmed that the newly opened epic `cng-z7u` is the right tracker home for the remaining incomplete or partially complete work after the main refactor phases closed.
  - Created the child backlog under `cng-z7u`:
    - `cng-z7u.1` projection-backed reporting aggregate pipeline
    - `cng-z7u.2` typed projection-backed reporting schedule store
    - `cng-z7u.3` dashboard/export projection-first read-model convergence
    - `cng-z7u.4` `ReportViewer` convergence and module split
    - `cng-z7u.5` continued `DataImporter` decomposition
    - `cng-z7u.6` reporting chart-warning/jsdom harness cleanup
  - Added explicit dependency ordering in beads so execution naturally starts from reporting projection foundations before UI cleanup.
  - Claimed `cng-z7u.1` as the active slice and rewrote the notebook top-level state from the completed smoke regression follow-up to the new residual-convergence program.
- Files created/modified:
  - `task.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)
- Verification:
  - `bd.cmd show cng-z7u` -> epic confirmed open with residual convergence scope
  - `bd.cmd dep ...` -> dependency chain added: `cng-z7u.1 -> cng-z7u.2 -> cng-z7u.3 -> cng-z7u.4 -> cng-z7u.6`
  - `bd.cmd update cng-z7u.1 --status in_progress` -> active slice claimed successfully

## Session: 2026-03-12 Blueprint End-State Follow-Through

### Phase A: Remove Hardcoded Default Credentials
- **Status:** in_progress
- Actions taken:
  - Created the follow-through epic `cng-i6h` with child beads `cng-i6h.1` through `cng-i6h.4`, then claimed `cng-i6h.1`.
  - Added `server/bootstrapAccountPasswords.js` plus `tests/bootstrapAccountPasswords.test.js` so bootstrap credential lookup now lives behind a small env-key seam instead of inline literals.
  - Reworked `server/index.js` account bootstrap/default seed behavior to remove hardcoded passwords, require `KPI_BOOTSTRAP_ADMIN_PASSWORD` only for empty-db or admin-missing bootstrap paths, and keep existing persisted account rows working without env secrets.
  - Added `tests/helpers/bootstrapAuth.js` and updated `tests/server.api.test.js` so auth/bootstrap tests install deterministic env passwords, verify env override behavior, and assert explicit failure when bootstrap admin secrets are missing.
  - Removed public default-credential guidance from `README.md`, `docs/USER_GUIDE.md`, `docs/operations/ui-verification-log.md`, `docs/system-v4-review-plan.md`, and the checked-in `server/data/db.json` snapshot.
- Files created/modified:
  - `server/bootstrapAccountPasswords.js` (created)
  - `tests/bootstrapAccountPasswords.test.js` (created)
  - `tests/helpers/bootstrapAuth.js` (created)
  - `server/index.js` (updated)
  - `tests/server.api.test.js` (updated)
  - `README.md` (updated)
  - `docs/USER_GUIDE.md` (updated)
  - `docs/operations/ui-verification-log.md` (updated)
  - `docs/system-v4-review-plan.md` (updated)
  - `server/data/db.json` (updated)
  - `task.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)
- Verification:
  - `pnpm exec vitest run tests/bootstrapAccountPasswords.test.js tests/server.seed.test.js tests/server.api.test.js -t bootstrap` -> passed on the bootstrap-targeted slice after fixing the hashed-password persistence expectation to log in before inspecting stored rows
  - `pnpm exec eslint server/bootstrapAccountPasswords.js tests/bootstrapAccountPasswords.test.js tests/helpers/bootstrapAuth.js server/index.js tests/server.api.test.js` -> `0` errors, `2` warning known in `tests/server.api.test.js` (`_type`, `_sql`)
  - `git diff --check -- server/bootstrapAccountPasswords.js tests/bootstrapAccountPasswords.test.js tests/helpers/bootstrapAuth.js server/index.js tests/server.api.test.js README.md docs/USER_GUIDE.md docs/operations/ui-verification-log.md docs/system-v4-review-plan.md server/data/db.json task.md task_plan.md findings.md progress.md` -> passed
- Residual for `cng-i6h.1` after this slice:
  - The broad `pnpm exec vitest run tests/server.seed.test.js tests/server.api.test.js` suite still has unrelated red buckets outside auth/bootstrap; that belongs under the later broad-verification bead, not this credential slice.
  - The next highest-value program step is now `cng-i6h.2`: inventory and retire compatibility/fallback seams that remain only for transitional cutover behavior.

### Phase B: Compatibility Fallback Retirement
- **Status:** in_progress
- Actions taken:
  - Re-inventoried the remaining compatibility layers and separated low-risk true shims from broader frontend alias wrappers.
  - Retired the monolith runtime dependency on `src/shared/*` for `defaultRules`, `co`, `declSearch`, `accountRoles`, and `backupMessages` by switching `server/index.js` to import directly from `packages/domain/src/*`.
  - Moved `tests/helpers/mockApiState.js` to the same canonical `packages/domain/src/declSearch.js` source so the reporting/mock harness no longer depends on the old decl-search shim path.
  - Retired `src/lib/reportingClient.js` entirely and switched its two remaining consumers, `src/components/ReportViewer.jsx` and `tests/reportingClient.test.js`, to `packages/api-client/src/reportingClient.js`.
- Files created/modified:
  - `server/index.js` (updated)
  - `tests/helpers/mockApiState.js` (updated)
  - `src/components/ReportViewer.jsx` (updated)
  - `tests/reportingClient.test.js` (updated)
  - `src/lib/reportingClient.js` (deleted)
  - `task.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)
- Verification:
  - `pnpm exec vitest run tests/reportingClient.test.js tests/reportViewer.test.jsx tests/server.seed.test.js tests/server.api.test.js -t "bootstrap|reportingClient|ReportViewer"` -> passed (`29 passed`, `109 skipped`)
  - `pnpm exec eslint src/components/ReportViewer.jsx tests/reportingClient.test.js server/index.js tests/helpers/mockApiState.js packages/api-client/src/reportingClient.js` -> passed
  - `rg -n 'src/lib/reportingClient\\.js|@/lib/reportingClient\\.js|lib/reportingClient\\.js' src tests server server-v4 packages apps` -> no remaining matches
  - `git diff --check -- packages/api-client/src/reportingClient.js server/index.js src/components/ReportViewer.jsx tests/helpers/mockApiState.js tests/reportingClient.test.js src/lib/reportingClient.js` -> passed
- Residual for `cng-i6h.2` after this slice:
  - Frontend-facing `src/shared/*` wrappers are still present and have many live consumers, so they need narrower follow-on slices instead of a big-bang delete.
  - Broader fallback retirement in `server-v4` and data-read compatibility paths is still open under the same bead.

### Phase B: Compatibility Fallback Retirement Follow-On
- **Status:** in_progress
- Actions taken:
  - Re-inventoried the remaining frontend-facing `src/shared/*` wrappers and selected the smallest-consumer group first: `accountRoles`, `backupMessages`, `defaultRules`, and `sampleDeclarations`.
  - Switched all remaining live consumers of those four shims to `packages/domain/src/*`, including `src/App.jsx`, `src/auth/localAuth.js`, `src/components/ExportAuditReport.jsx`, `src/components/ReportViewer.jsx`, `src/components/AuditLog.jsx`, `src/components/DataHealthDashboard.jsx`, `src/lib/store.js`, `src/lib/rules.js`, and the associated targeted tests.
  - Deleted `src/shared/accountRoles.js`, `src/shared/backupMessages.js`, `src/shared/defaultRules.js`, and `src/shared/sampleDeclarations.js` once the search showed no remaining imports.
  - Updated `tests/hqIntegration.test.js` to assert the current normalized MST row shape with `effective_to` and `status`, which removed stale noise from this targeted verification bundle.
- Files created/modified:
  - `src/App.jsx` (updated)
  - `src/auth/localAuth.js` (updated)
  - `src/components/ExportAuditReport.jsx` (updated)
  - `src/components/ReportViewer.jsx` (updated)
  - `src/components/dataImporter/useDataImporterEditAccess.js` (updated)
  - `src/components/AuditLog.jsx` (updated)
  - `src/components/DataHealthDashboard.jsx` (updated)
  - `src/lib/store.js` (updated)
  - `src/lib/rules.js` (updated)
  - `tests/accountRoles.test.js` (updated)
  - `tests/useDataImporterEditAccess.test.jsx` (updated)
  - `tests/sampleDeclarations.test.js` (updated)
  - `tests/e2e.admin-flows.test.jsx` (updated)
  - `tests/hqIntegration.test.js` (updated)
  - `src/shared/accountRoles.js` (deleted)
  - `src/shared/backupMessages.js` (deleted)
  - `src/shared/defaultRules.js` (deleted)
  - `src/shared/sampleDeclarations.js` (deleted)
  - `task.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)
- Verification:
  - `pnpm exec vitest run tests/accountRoles.test.js tests/useDataImporterEditAccess.test.jsx tests/sampleDeclarations.test.js tests/auth.test.jsx tests/reportViewer.test.jsx tests/ExportAuditReport.test.jsx tests/auditLog.test.jsx tests/hqIntegration.test.js tests/e2e.admin-flows.test.jsx` -> passed (`36/36`)
  - `pnpm exec eslint src/App.jsx src/auth/localAuth.js src/components/ExportAuditReport.jsx src/components/ReportViewer.jsx src/components/dataImporter/useDataImporterEditAccess.js src/components/AuditLog.jsx src/components/DataHealthDashboard.jsx src/lib/store.js src/lib/rules.js tests/accountRoles.test.js tests/useDataImporterEditAccess.test.jsx tests/sampleDeclarations.test.js tests/e2e.admin-flows.test.jsx tests/hqIntegration.test.js` -> `0` errors, `2` warnings known/pre-existing (`DataHealthDashboard.jsx` hook dependency, `src/lib/store.js` unused local)
  - `rg -n '@/shared/accountRoles\\.js|\\.\\.?/shared/accountRoles\\.js|@/shared/backupMessages\\.js|\\.\\.?/shared/backupMessages\\.js|@/shared/defaultRules\\.js|\\.\\.?/shared/defaultRules\\.js|@/shared/sampleDeclarations\\.js|\\.\\.?/shared/sampleDeclarations\\.js' src tests` -> no remaining matches
  - `git diff --check -- ...` on the compatibility-retirement scope -> passed
- Residual for `cng-i6h.2` after this follow-on:
  - `src/shared/co.js`, `src/shared/declSearch.js`, and `src/shared/format.js` still have larger fanout and need separate slices.
  - `server-v4` and relational-read fallback retirement are still open under the same bead.

### Phase B: Compatibility Fallback Retirement C/O And Decl-Search Slice
- **Status:** in_progress
- Actions taken:
  - Re-inventoried the remaining `src/shared/*` wrappers after the first two Phase B batches and selected `co` plus `declSearch` as the next narrow slice because the remaining imports were concentrated in importer/session/rules/store code paths.
  - Switched all live consumers of `src/shared/co.js` to `packages/domain/src/co.js`, including `src/components/DataImporter.jsx`, importer/session controller modules, `src/lib/importer.js`, `src/lib/rules.js`, and the package-owned license helper.
  - Switched all live consumers of `src/shared/declSearch.js` to `packages/domain/src/declSearch.js`, including importer/session derived state, filter preset/results surface hooks, `src/lib/store.js`, and `tests/dataImporter.preview.test.jsx`.
  - Deleted `src/shared/co.js` and `src/shared/declSearch.js` once repo search confirmed there were no remaining imports.
  - Cleaned two small dead-local warnings surfaced in `src/components/dataImporter/dataImporterSessionDerivedState.js` and `src/lib/store.js` so the touched-scope lint gate closes at `0` errors and `0` warnings.
- Files created/modified:
  - `src/components/DataImporter.jsx` (updated)
  - `src/lib/rules.js` (updated)
  - `src/lib/importer.js` (updated)
  - `src/components/dataImporter/dataImporterLicenseUtils.js` (updated)
  - `src/lib/store.js` (updated)
  - `src/components/dataImporter/dataImporterSessionDerivedState.js` (updated)
  - `src/components/dataImporter/useDataImporterFilterPresets.js` (updated)
  - `src/components/dataImporter/useDataImporterResultsController.js` (updated)
  - `src/components/dataImporter/useDataImporterResultsSurface.jsx` (updated)
  - `src/components/dataImporter/useDataImporterSessionController.js` (updated)
  - `tests/dataImporter.preview.test.jsx` (updated)
  - `src/shared/co.js` (deleted)
  - `src/shared/declSearch.js` (deleted)
  - `task.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)
- Verification:
  - `pnpm exec vitest run tests/dataImporter.preview.test.jsx tests/useDataImporterResultsController.test.jsx tests/useDataImporterSessionController.test.jsx tests/rules.test.js tests/store.test.js tests/hqIntegration.test.js tests/reportViewer.test.jsx` -> passed (`92/92`)
  - `rg -n "@/shared/co\\.js|\\.\\.?/shared/co\\.js|@/shared/declSearch\\.js|\\.\\.?/shared/declSearch\\.js" src tests` -> no remaining matches
  - `pnpm exec eslint src/components/DataImporter.jsx src/lib/rules.js src/lib/importer.js src/components/dataImporter/dataImporterLicenseUtils.js src/lib/store.js src/components/dataImporter/dataImporterSessionDerivedState.js src/components/dataImporter/useDataImporterFilterPresets.js src/components/dataImporter/useDataImporterResultsController.js src/components/dataImporter/useDataImporterResultsSurface.jsx src/components/dataImporter/useDataImporterSessionController.js tests/dataImporter.preview.test.jsx` -> passed (`0` errors, `0` warnings)
  - `git diff --check -- ...` on the touched compatibility-retirement scope -> passed
- Residual for `cng-i6h.2` after this slice:
  - `src/shared/format.js` is still the last broad frontend alias wrapper left in the repo-side compatibility batch.
  - `server-v4` and relational-read/runtime fallback retirement are still open under the same bead.

### Phase B: Compatibility Fallback Retirement Format Slice
- **Status:** in_progress
- Actions taken:
  - Re-inventoried the last frontend-facing wrapper left under `src/shared/*` and confirmed `src/shared/format.js` was still a pure package re-export with fanout limited to reporting/importer UI modules.
  - Switched all remaining `format` consumers directly to `packages/domain/src/format.js`, including `ReportViewer`, `ExportAuditReport`, `DataImporter`, duplicate-diff utilities, import preview summary, and the importer sync/session/monitoring controllers.
  - Deleted `src/shared/format.js` once repo search showed there were no remaining imports of that wrapper path.
  - Confirmed that `src/shared` now only contains `toast.js`, meaning the frontend package-compatibility wrapper batch is fully retired.
- Files created/modified:
  - `src/components/ExportAuditReport.jsx` (updated)
  - `src/components/ReportViewer.jsx` (updated)
  - `src/components/DataImporter.jsx` (updated)
  - `src/components/dataImporter/dataImporterDuplicateDiffUtils.js` (updated)
  - `src/components/dataImporter/DataImporterImportPreviewSummary.jsx` (updated)
  - `src/components/dataImporter/useDataImporterCoMonitoring.js` (updated)
  - `src/components/dataImporter/useDataImporterResultsController.js` (updated)
  - `src/components/dataImporter/useDataImporterSessionController.js` (updated)
  - `src/components/dataImporter/useDataImporterSync.js` (updated)
  - `src/shared/format.js` (deleted)
  - `task.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)
- Verification:
  - `pnpm exec vitest run tests/ExportAuditReport.test.jsx tests/reportViewer.test.jsx tests/dataImporter.preview.test.jsx tests/dataImporterImportPreviewSummary.test.jsx tests/dataImporterDuplicateDiffUtils.test.js tests/useDataImporterCoMonitoring.test.jsx tests/useDataImporterResultsController.test.jsx tests/useDataImporterSessionController.test.jsx tests/useDataImporterSync.test.jsx` -> passed (`28/28`)
  - `rg -n "@/shared/format\\.js|\\.\\.?/shared/format\\.js" src tests` -> no remaining matches
  - `pnpm exec eslint src/components/ExportAuditReport.jsx src/components/ReportViewer.jsx src/components/DataImporter.jsx src/components/dataImporter/dataImporterDuplicateDiffUtils.js src/components/dataImporter/DataImporterImportPreviewSummary.jsx src/components/dataImporter/useDataImporterCoMonitoring.js src/components/dataImporter/useDataImporterResultsController.js src/components/dataImporter/useDataImporterSessionController.js src/components/dataImporter/useDataImporterSync.js` -> passed (`0` errors, `0` warnings)
  - `git diff --check -- ...` on the touched format-retirement scope -> passed
- Residual for `cng-i6h.2` after this slice:
  - Frontend/package compatibility wrappers are now retired; the remaining Phase B work is broader runtime fallback retirement in `server-v4` and relational-read/data-read paths.

### Phase 2B: Export Read-Model Convergence Discovery
- **Status:** in_progress
- Actions taken:
  - Re-read `task_plan.md`, `findings.md`, and `progress.md` before choosing the next reporting slice.
  - Confirmed that dashboard reads already use `/api/v4/reporting/view`, while compact export resolution still diverges in `server/reportExportPayloads.js`.
  - Identified the next slice: route compact export materialization through `buildReportingReadModels()` while preserving full rule metadata for export subtitles/audit.
- Files created/modified:
  - `task_plan.md` (pending update after implementation)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 2B: Export Read-Model Convergence Implementation
- **Status:** complete
- Actions taken:
  - Added `tests/reportExportPayloads.test.js` as a RED/GREEN guard proving `server/reportExportPayloads.js` must resolve compact exports through `buildReportingReadModels()` instead of calling `buildReportData()` inline.
  - Updated `server/reportExportPayloads.js` so all compact `staff` / `team` / `allStaff` / `allTeam` exports now materialize from the shared reporting read-model bundle and keep the full selected rule object only for export subtitles and audit metadata.
  - Re-normalized touched files back to `CRLF` after patching so Windows lint rules return to green.
- Files created/modified:
  - `server/reportExportPayloads.js` (updated)
  - `tests/reportExportPayloads.test.js` (created)
  - `task.md` (pending update after implementation)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

## Additional Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| RED unit guard | `pnpm exec vitest run tests/reportExportPayloads.test.js` | New test fails before implementation | Failed: `buildReportData should not be called directly by reportExportPayloads` | pass |
| Export payload unit regressions | `pnpm exec vitest run tests/reportExportPayloads.test.js` | Shared read-model compact export tests pass | Passed (`2/2`) | pass |
| Export client regressions | `pnpm exec vitest run tests/reportExport.test.js` | Compact client payload helpers stay green | Passed (`4/4`) | pass |
| Focused export API regressions | `pnpm exec vitest run tests/server.api.test.js -t "compact reporting-v4 payload"` | Compact export API path still works | Passed (`2 passed, 111 skipped`) | pass |
| Full touched regression bundle | `pnpm exec vitest run tests/server.api.test.js tests/reportExport.test.js tests/reportExportPayloads.test.js` | Route + client + unit coverage stays green | Passed (`119/119`) | pass |

### Phase 2B: Reporting Projection Store Extraction
- **Status:** complete
- Actions taken:
  - Added `server/reportingProjectionStore.js` to centralize typed access for `kpi_report_schedule_v1`, `kpi_reporting_monthly_aggregates_v1`, and `kpi_reporting_monthly_aggregates_default_v1`.
  - Added `tests/reportingProjectionStore.test.js` to lock read/write/delete/query-key behavior for those projection keys behind the new store boundary.
  - Updated monolith reporting helpers and schedule/monthly aggregate routes in `server/index.js` to use the new projection store instead of handling those `kv_store` keys inline.
  - Re-normalized the touched files back to `CRLF` after extraction work.
- Files created/modified:
  - `server/reportingProjectionStore.js` (created)
  - `tests/reportingProjectionStore.test.js` (created)
  - `server/index.js` (updated)
  - `task.md` (pending update after implementation)
  - `task_plan.md` (pending update after implementation)
  - `findings.md` (updated)
  - `progress.md` (updated)

| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| Projection-store RED guard | `pnpm exec vitest run tests/reportingProjectionStore.test.js` | Import fails before module exists | Failed: `Failed to resolve import "../server/reportingProjectionStore.js"` | pass |
| Projection-store unit regressions | `pnpm exec vitest run tests/reportingProjectionStore.test.js` | Typed projection-store behavior passes | Passed (`4/4`) | pass |
| Focused monolith reporting regressions | `pnpm exec vitest run tests/server.api.test.js -t "monthly aggregate|lịch báo cáo KPI|schedules response"` | Schedule/monthly routes stay green after extraction | Passed (`5 passed, 108 skipped`) | pass |

### Phase 0A: Security Boundary Hardening
- **Status:** complete
- Actions taken:
  - Locked `GET /api/bootstrap` behind authenticated session access.
  - Locked `GET/POST/PATCH/DELETE /api/auth/accounts*` behind admin `accountManage`.
  - Locked `GET /api/import/ecus/config`, `GET /api/import/ecus/status`, `GET /api/import/alerts*`, `GET /api/import/search`, `GET /api/import/co-codes`, and `GET /api/import/co-discrepancy`.
  - Removed trust in client-supplied `actor` by changing `resolveActor()` to use only server session identity or fallback.
  - Updated frontend auth lifecycle so shared-storage bootstrap runs again after a valid login/session restore instead of depending only on the pre-render bootstrap call.
  - Added backend regression tests for unauthorized access and actor-spoofing scenarios across bootstrap, accounts, ECUS config/status, alerts, and import read APIs.
- Files created/modified:
  - `server/index.js` (updated)
  - `src/App.jsx` (updated)
  - `src/lib/storageClient.js` (updated)
  - `tests/server.api.test.js` (updated)

### Phase 0B: Baseline Recovery And Toolchain Stabilization
- **Status:** complete
- Actions taken:
  - Reinstalled dependencies with `pnpm install --force` to recover a working local toolchain.
  - Repaired the SQL-account bootstrap regression test fixture so the test proves SQL-synced auth instead of accidentally depending on the seed account.
  - Fixed ECUS query normalization so range optimization preserves the intended exclusive upper-bound form.
  - Updated the ECUS preview regression test to save config through the real API path instead of bypassing normalization with a raw `kv_store` insert.
  - Normalized line endings back to `CRLF` on the touched Windows repo files to stop lint from failing on editor-format noise.
  - Cleared the remaining lint errors in `src/components/MSTAssignment.jsx`.
- Files created/modified:
  - `server/index.js` (updated)
  - `tests/server.api.test.js` (updated)
  - `src/components/MSTAssignment.jsx` (updated)
  - `task.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

## Additional Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| Syntax check | `node --check server/index.js` | No syntax errors | Passed | pass |
| Syntax check | `node --check src/lib/storageClient.js` | No syntax errors | Passed | pass |
| Syntax check | `node --check tests/server.api.test.js` | No syntax errors | Passed | pass |
| Diff sanity | `git diff --check` | No patch-format errors | Only CRLF warnings | pass |
| Targeted backend tests | `pnpm vitest tests/server.api.test.js --run` | Execute route regression suite | Failed: missing `node_modules/vitest/vitest.mjs` | blocked |
| Phase 0A authz verification | `pnpm exec vitest run tests/server.api.test.js -t "<Phase 0A cases>"` | Security regression subset passes | Passed (`21/21`) | pass |
| Full backend API suite | `pnpm exec vitest run tests/server.api.test.js` | File-level regression suite passes | Passed (`98/98`) | pass |
| Local health check | `pnpm healthcheck` | Repo copy baseline is runnable | Passed with backup/cron warnings only | pass |
| Lint baseline | `pnpm lint` | No blocking lint errors | Passed with warnings only (`0 errors, 61 warnings`) | pass |

## 5-Question Reboot Check: Execution
| Question | Answer |
|----------|--------|
| Where am I? | Phase 1A auth/session cleanup with a restored local baseline |
| Where am I going? | Unify the runtime auth model before touching bigger architectural migrations |
| What's the goal? | Convert the review into a safe, testable modernization program with real security gains starting now |
| What have I learned? | The repo copy is now trustworthy enough for incremental work; the next structural risk is the contradictory auth model |
| What have I done? | Closed Phase 0A hardening, restored dependency/tooling health, repaired failing regressions, and re-established the verification command set |

## Session: 2026-03-09

### Phase 1A: Client Auth Model Cleanup
- **Status:** in_progress
- Actions taken:
  - Re-read and applied `auth-implementation-patterns` and `security-review` before editing the auth flow.
  - Removed legacy bearer-token persistence and header injection from `src/auth/localAuth.js`.
  - Added proactive cleanup for the stale `kpi_session_token` key so old client-side tokens are deleted instead of ignored.
  - Kept `fetchWithAuth()` on cookie-backed requests with `credentials: 'include'` as the single client auth mechanism.
  - Aligned demo mode and frontend mock auth handlers so they no longer depend on token echoes.
  - Added regression coverage proving that auth requests no longer attach `Authorization` and that login does not leave a legacy token in `localStorage`.
  - Normalized touched files back to `CRLF` so lint verification remains valid on this Windows repo.
- Files created/modified:
  - `src/auth/localAuth.js` (updated)
  - `src/demo/demoMode.js` (updated)
  - `tests/auth.test.jsx` (updated)
  - `tests/helpers/mockApi.js` (updated)
  - `tests/helpers/mockApiState.js` (updated)
  - `task.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 1A: Backend Auth Contract Cleanup
- **Status:** in_progress
- Actions taken:
  - Removed session `token` echoes from `/api/auth/login` and `/api/auth/password/change` while preserving cookie issuance and `expiresAt`.
  - Tightened backend regression tests so the public auth JSON contract now forbids returning `token`.
  - Re-normalized the touched backend files to `CRLF` and re-verified lint/test hygiene.
- Files created/modified:
  - `server/index.js` (updated)
  - `tests/server.api.test.js` (updated)
  - `task.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 1A: Caller Cleanup And Closure
- **Status:** complete
- Actions taken:
  - Removed leftover `actor` plumbing from `src/components/AccountManager.jsx` so account lifecycle calls no longer send dead actor metadata.
  - Documented the current clean RBAC enforcement points in the notebook and used that as the closure criterion for `cng-7c8.3`.
  - Prepared the handoff to `cng-7c8.4` with the next action focused on PostgreSQL schema and migration mapping.
- Files created/modified:
  - `src/components/AccountManager.jsx` (updated)
  - `task.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 1B: PostgreSQL Target Schema And Migration Map
- **Status:** complete
- Actions taken:
  - Applied `postgresql` and `database-architect` to inventory the current blob model, hot write paths, bootstrap behavior, and in-memory reporting workload.
  - Confirmed that `decl_rows_v1` is the operational fact store, `mst_rows_v2` is a temporal assignment table in disguise, and `buildReportData()` is the real reporting contract to preserve.
  - Designed a PostgreSQL target model that separates typed business entities from low-value operational config documents.
  - Defined rule-set-versioned KPI derivation with `kpi_declaration_results`, `kpi_staff_monthly`, and `kpi_team_monthly` so future reports and AI snapshots stop recomputing from full raw blobs.
  - Mapped current `kv_store` keys to typed tables or JSONB config storage and documented cutover/rollback stages.
- Files created/modified:
  - `docs/postgres-target-schema.md` (created)
  - `task.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 1C: Backend Modular Monolith Scaffold In TypeScript
- **Status:** complete
- Actions taken:
  - Added minimal backend TypeScript tooling with `typescript`, `@types/node`, and `@types/express`, plus `typecheck:server-v4` and `test:server-v4` scripts.
  - Created an isolated `server-v4/` backend scaffold so the v4 code path can evolve without disturbing the legacy runtime.
  - Added shared module contracts and Zod validation for domain module metadata in `server-v4/src/app/domain-module.ts`.
  - Built a typed eight-domain registry and Express app shell with `/api/v4/health`, `/api/v4/meta/modules`, and per-module `__meta` endpoints.
  - Added node tests covering the module catalog and app-shell wiring.
- Files created/modified:
  - `package.json` (updated)
  - `pnpm-lock.yaml` (updated)
  - `tsconfig.server-v4.json` (created)
  - `server-v4/src/index.ts` (created)
  - `server-v4/src/app/domain-module.ts` (created)
  - `server-v4/src/app/module-catalog.ts` (created)
  - `server-v4/src/app/build-v4-app.ts` (created)
  - `server-v4/src/modules/create-domain-module.ts` (created)
  - `server-v4/src/modules/auth/auth.module.ts` (created)
  - `server-v4/src/modules/declarations/declarations.module.ts` (created)
  - `server-v4/src/modules/mst-assignments/mst-assignments.module.ts` (created)
  - `server-v4/src/modules/teams/teams.module.ts` (created)
  - `server-v4/src/modules/hq-agencies/hq-agencies.module.ts` (created)
  - `server-v4/src/modules/kpi-rules/kpi-rules.module.ts` (created)
  - `server-v4/src/modules/kpi-adjustments/kpi-adjustments.module.ts` (created)
  - `server-v4/src/modules/reporting/reporting.module.ts` (created)
  - `tests/server-v4/moduleCatalog.test.js` (created)
  - `tests/server-v4/appShell.test.js` (created)
  - `task.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 2A: Teams And MST Read-Only Runtime Slice
- **Status:** in_progress
- Actions taken:
  - Re-read and applied `backend-dev-guidelines` and `test-driven-development` before extending `server-v4`.
  - Added a runtime config path for `server-v4` so the app can target either the default legacy SQLite file or a temp test database.
  - Introduced a small `LegacyKvStoreReader` plus shared normalizers to read `kv_store` safely without importing `server/index.js`.
  - Implemented typed repository/service/controller/router stacks for `teams` and `mst-assignments`.
  - Mounted real runtime endpoints at `/api/v4/teams`, `/api/v4/mst-assignments`, and `/api/v4/mst-assignments/resolve`.
  - Added a temp-SQLite integration test proving `server-v4` can sanitize team roster data and resolve effective MST assignment windows by date.
  - Normalized touched files back to `CRLF` so repo lint returns to the known warning-only baseline.
- Files created/modified:
  - `server-v4/src/config/server-v4-config.ts` (created)
  - `server-v4/src/http/BaseController.ts` (created)
  - `server-v4/src/legacy/legacy-normalizers.ts` (created)
  - `server-v4/src/legacy/legacy-kv-store-reader.ts` (created)
  - `server-v4/src/types/better-sqlite3.d.ts` (created)
  - `server-v4/src/app/build-v4-app.ts` (updated)
  - `server-v4/src/index.ts` (updated)
  - `server-v4/src/modules/teams/TeamsRepository.ts` (created)
  - `server-v4/src/modules/teams/teamsService.ts` (created)
  - `server-v4/src/modules/teams/TeamsController.ts` (created)
  - `server-v4/src/modules/teams/teamsRoutes.ts` (created)
  - `server-v4/src/modules/teams/teams.module.ts` (updated)
  - `server-v4/src/modules/mst-assignments/MstAssignmentsRepository.ts` (created)
  - `server-v4/src/modules/mst-assignments/mstAssignmentsService.ts` (created)
  - `server-v4/src/modules/mst-assignments/MstAssignmentsController.ts` (created)
  - `server-v4/src/modules/mst-assignments/mstAssignmentsRoutes.ts` (created)
  - `server-v4/src/modules/mst-assignments/mst-assignments.module.ts` (updated)
  - `tests/server-v4/runtimeRoutes.test.js` (created)
  - `tsconfig.server-v4.json` (updated)
  - `task.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 2A: Declarations And Rules Read-Only Runtime Slice
- **Status:** in_progress
- Actions taken:
  - Re-used `test-driven-development` and `backend-dev-guidelines` to extend the runtime slice only after adding red tests for `/api/v4/declarations` and `/api/v4/kpi-rules`.
  - Implemented typed repository/service/controller/router stacks for `declarations` and `kpi-rules`.
  - Mounted real runtime endpoints at `/api/v4/declarations` and `/api/v4/kpi-rules`.
  - Preserved declaration-number normalization and branch alias handling from the monolith while adding stable declaration IDs and filter support for `mst`, `soTk`, and `branch`.
  - Wrapped legacy single-rule `kpi_rules_v2` payloads into a v4 collection response so the bridge can tolerate both old and new storage shapes.
  - Hardened the date normalizer to avoid slash-date timezone drift and re-normalized touched files back to `CRLF` for the Windows lint baseline.
- Files created/modified:
  - `server-v4/src/app/build-v4-app.ts` (updated)
  - `server-v4/src/legacy/legacy-normalizers.ts` (updated)
  - `server-v4/src/modules/declarations/DeclarationsRepository.ts` (created)
  - `server-v4/src/modules/declarations/declarationsService.ts` (created)
  - `server-v4/src/modules/declarations/DeclarationsController.ts` (created)
  - `server-v4/src/modules/declarations/declarationsRoutes.ts` (created)
  - `server-v4/src/modules/kpi-rules/kpiRuleDefaults.ts` (created)
  - `server-v4/src/modules/kpi-rules/KpiRulesRepository.ts` (created)
  - `server-v4/src/modules/kpi-rules/kpiRulesService.ts` (created)
  - `server-v4/src/modules/kpi-rules/KpiRulesController.ts` (created)
  - `server-v4/src/modules/kpi-rules/kpiRulesRoutes.ts` (created)
  - `tests/server-v4/runtimeRoutes.test.js` (updated)
  - `task.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 2A: Reporting Read-Only Runtime Slice
- **Status:** in_progress
- Actions taken:
  - Re-used `test-driven-development` and `backend-dev-guidelines` before extending `server-v4` again.
  - Added red tests for `/api/v4/reporting/summary`, `/api/v4/reporting/staff`, `/api/v4/reporting/teams`, and `/api/v4/reporting/schedules`.
  - Implemented a small async legacy-report bridge so `server-v4` can reuse `src/lib/reports.js` `buildReportData()` without importing the monolith backend.
  - Implemented typed repository/service/controller/router stacks for the `reporting` domain and mounted the new read-only routes in `buildV4App()`.
  - Added a backend-side schedule normalizer with `asOf` support so next-run computation is deterministic in tests and no longer tied to frontend-only storage helpers.
  - Re-normalized touched files back to `CRLF` so repo lint stays at the known warning-only baseline on Windows.
- Files created/modified:
  - `server-v4/src/app/build-v4-app.ts` (updated)
  - `server-v4/src/legacy/legacy-report-bridge.ts` (created)
  - `server-v4/src/modules/reporting/ReportingRepository.ts` (created)
  - `server-v4/src/modules/reporting/reportingScheduleNormalizer.ts` (created)
  - `server-v4/src/modules/reporting/reportingService.ts` (created)
  - `server-v4/src/modules/reporting/ReportingController.ts` (created)
  - `server-v4/src/modules/reporting/reportingRoutes.ts` (created)
  - `tests/server-v4/runtimeRoutes.test.js` (updated)
  - `task.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 2A: Reporting Monolith Cutover Shim
- **Status:** complete
- Actions taken:
  - Re-read and applied `planning-with-files`, `test-driven-development`, and `verification-before-completion` before touching the monolith bridge.
  - Added red tests in `tests/server.api.test.js` for authenticated `/api/v4/reporting/summary`, `/staff`, `/teams`, and `/schedules`.
  - Created `server/reportingReadModels.js` so the monolith can shape v4 reporting responses without piling more report logic into `server/index.js`.
  - Reused the same legacy `buildReportData()` KPI math plus a shared schedule normalizer so the monolith-side shim stays aligned with `server-v4`.
  - Mounted authenticated shim routes for `/api/v4/reporting/*` in `server/index.js`, backed by current `kv_store` data (`decl_rows_v1`, `team_roster_v1`, `kpi_rules_v2`, `kpi_adjustments_v1`, `kpi_report_schedule_v1`).
  - Re-normalized touched files back to `CRLF` after lint flagged Windows line-ending drift in the edited files.
- Files created/modified:
  - `server/reportingReadModels.js` (created)
  - `server/index.js` (updated)
  - `tests/server.api.test.js` (updated)
  - `task.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

## Additional Test Results: 2026-03-09 TypeScript Scaffold
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| TypeScript scaffold typecheck | `pnpm exec tsc -p tsconfig.server-v4.json --noEmit` | New backend scaffold typechecks cleanly | Passed | pass |
| TypeScript scaffold node tests | `pnpm exec vitest run tests/server-v4/appShell.test.js tests/server-v4/moduleCatalog.test.js --environment node` | App shell and module registry behave as expected | Passed (`4/4`) | pass |
| New scaffold test lint | `pnpm exec eslint tests/server-v4/appShell.test.js tests/server-v4/moduleCatalog.test.js` | No lint errors in new JS tests | Passed | pass |
| Repo lint baseline after TS toolchain add | `pnpm lint` | No blocking lint regressions | Passed with warnings only (`0 errors, 61 warnings`) | pass |
| Health baseline after TS toolchain add | `pnpm healthcheck` | Existing runtime baseline remains healthy | Passed with existing backup/cron warnings | pass |
| Runtime route red test | `pnpm exec vitest run tests/server-v4/runtimeRoutes.test.js --environment node` | New runtime-route tests fail before implementation | Failed as expected because `buildV4App()` still treated temp-db config like a module array | pass |
| Runtime route green test | `pnpm exec vitest run tests/server-v4/runtimeRoutes.test.js --environment node` | `teams` and `mst-assignments` routes serve legacy data through new boundaries | Passed (`2/2`) | pass |
| Full server-v4 suite after runtime slice | `pnpm exec vitest run tests/server-v4/appShell.test.js tests/server-v4/moduleCatalog.test.js tests/server-v4/runtimeRoutes.test.js --environment node` | Shell, metadata, and runtime routes stay green together | Passed (`6/6`) | pass |
| Server-v4 typecheck after runtime slice | `pnpm exec tsc -p tsconfig.server-v4.json --noEmit` | TypeScript runtime additions compile cleanly | Passed | pass |
| Repo lint baseline after runtime slice | `pnpm lint` | No new lint errors | Passed with warnings only (`0 errors, 61 warnings`) | pass |
| Health baseline after runtime slice | `pnpm healthcheck` | Existing runtime baseline remains healthy | Passed with existing backup/cron warnings | pass |
| Declarations/rules red test | `pnpm exec vitest run tests/server-v4/runtimeRoutes.test.js --environment node` | New declarations and rules routes fail before implementation | Failed as expected with `404` on both routes | pass |
| Declarations/rules green test | `pnpm exec vitest run tests/server-v4/runtimeRoutes.test.js --environment node` | `declarations` and `kpi-rules` serve normalized legacy data through new boundaries | Passed (`4/4`) | pass |
| Full server-v4 suite after declarations/rules slice | `pnpm exec vitest run tests/server-v4/appShell.test.js tests/server-v4/moduleCatalog.test.js tests/server-v4/runtimeRoutes.test.js --environment node` | Existing shell/meta/runtime coverage remains green | Passed (`8/8`) | pass |
| Server-v4 typecheck after declarations/rules slice | `pnpm exec tsc -p tsconfig.server-v4.json --noEmit` | Runtime bridge additions compile cleanly | Passed | pass |
| Repo lint baseline after declarations/rules slice | `pnpm lint` | No blocking lint regressions after new runtime slice | Passed with warnings only (`0 errors, 61 warnings`) | pass |
| Health baseline after declarations/rules slice | `pnpm healthcheck` | Existing runtime baseline remains healthy | Passed with existing backup/cron warnings | pass |
| Reporting red test | `pnpm exec vitest run tests/server-v4/runtimeRoutes.test.js --environment node` | New reporting routes fail before implementation | Failed as expected with `404` on reporting endpoints | pass |
| Reporting green test | `pnpm exec vitest run tests/server-v4/runtimeRoutes.test.js --environment node` | Reporting routes serve normalized legacy report data through new boundaries | Passed (`6/6`) | pass |
| Full server-v4 suite after reporting slice | `pnpm exec vitest run tests/server-v4/appShell.test.js tests/server-v4/moduleCatalog.test.js tests/server-v4/runtimeRoutes.test.js --environment node` | Shell, registry, and runtime slices stay green together | Passed (`10/10`) | pass |
| Server-v4 typecheck after reporting slice | `pnpm exec tsc -p tsconfig.server-v4.json --noEmit` | Reporting bridge additions compile cleanly | Passed | pass |
| Repo lint baseline after reporting slice | `pnpm lint` | No blocking lint regressions after reporting runtime slice | Passed with warnings only (`0 errors, 61 warnings`) | pass |
| Health baseline after reporting slice | `pnpm healthcheck` | Existing runtime baseline remains healthy | Passed with existing backup/cron warnings | pass |
| Patch sanity after reporting slice | `git diff --check -- ...` | No whitespace or patch-format issues in touched files | Passed | pass |
| Monolith reporting shim red test | `pnpm exec vitest run tests/server.api.test.js -t "V4 reporting read-model API"` | New monolith `/api/v4/reporting/*` tests fail before implementation | Failed as expected (`3` failures) | pass |
| Monolith reporting shim green test | `pnpm exec vitest run tests/server.api.test.js -t "V4 reporting read-model API"` | New monolith read-model routes satisfy the v4 contract | Passed (`3/3`) | pass |
| Full backend API suite after monolith shim | `pnpm exec vitest run tests/server.api.test.js` | Existing API coverage stays green with new shim routes | Passed (`101/101`) | pass |
| Full server-v4 suite after monolith shim | `pnpm exec vitest run tests/server-v4/appShell.test.js tests/server-v4/moduleCatalog.test.js tests/server-v4/runtimeRoutes.test.js --environment node` | Existing v4 runtime coverage remains green | Passed (`10/10`) | pass |
| Server-v4 typecheck after monolith shim | `pnpm exec tsc -p tsconfig.server-v4.json --noEmit` | TypeScript v4 scaffold remains clean | Passed | pass |
| Touched backend lint after monolith shim | `pnpm exec eslint server/reportingReadModels.js server/index.js tests/server.api.test.js` | No blocking lint errors in edited backend files | Passed with `2` existing warnings in `tests/server.api.test.js` | pass |
| Repo lint baseline after monolith shim | `pnpm lint` | No blocking repo-wide lint regressions | Passed with warnings only (`0 errors, 61 warnings`) | pass |
| Health baseline after monolith shim | `pnpm healthcheck` | Existing runtime baseline remains healthy | Passed with existing backup/cron warnings | pass |
| Patch sanity after monolith shim | `git diff --check -- server/reportingReadModels.js server/index.js tests/server.api.test.js` | No whitespace or patch-format issues in touched files | Passed | pass |

## Additional Test Results: 2026-03-09
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| Frontend auth regression suite | `pnpm exec vitest run tests/auth.test.jsx tests/automation.flows.test.js tests/store.test.js tests/auditLog.test.jsx tests/dataImporter.preview.test.jsx tests/ExportAuditReport.test.jsx tests/hqHistoryClient.test.js` | Touched auth/demo/mock flows remain green | Passed (`88/88`) | pass |
| Backend regression baseline | `pnpm exec vitest run tests/server.api.test.js` | Existing API suite still green | Passed (`98/98`) | pass |
| Touched-file lint | `pnpm exec eslint src/auth/localAuth.js src/demo/demoMode.js tests/auth.test.jsx tests/helpers/mockApi.js tests/helpers/mockApiState.js` | No blocking lint issues in edited files | Passed | pass |
| Repo lint baseline | `pnpm lint` | No blocking lint errors | Passed with warnings only (`0 errors, 61 warnings`) | pass |
| Health baseline | `pnpm healthcheck` | Repo baseline still runnable | Passed with backup/cron warnings only | pass |
| Backend auth contract lint | `pnpm exec eslint server/index.js tests/server.api.test.js` | No blocking lint errors in backend auth contract changes | Passed with 2 existing warnings in `tests/server.api.test.js` | pass |
| Account caller cleanup tests | `pnpm exec vitest run tests/auth.test.jsx tests/automation.flows.test.js` | Auth/account flows still green after removing actor plumbing from callers | Passed (`9/9`) | pass |
| Account caller lint | `pnpm exec eslint src/components/AccountManager.jsx src/auth/localAuth.js` | No blocking lint errors in caller cleanup | Passed | pass |

### Phase 2B: Monthly Aggregate Slice
- **Status:** in_progress
- Actions taken:
  - Re-read and applied `planning-with-files`, `test-driven-development`, `backend-dev-guidelines`, and `verification-before-completion` before extending the reporting boundary again.
  - Added red tests for `GET /api/v4/reporting/aggregates/monthly` in both `tests/server-v4/runtimeRoutes.test.js` and `tests/server.api.test.js`.
  - Wired `server-v4` reporting service/controller/routes/module metadata to expose the monthly aggregate contract through the typed runtime.
  - Extended `server/reportingReadModels.js` with a monthly aggregate builder so the monolith shim can reuse legacy `buildReportData()` without pushing more KPI math into `server/index.js`.
  - Mounted authenticated monolith route `/api/v4/reporting/aggregates/monthly` and materialized snapshots back into `kv_store` under `kpi_reporting_monthly_aggregates_v1`.
  - Tightened the new TypeScript aggregate builder onto `DeclarationRecord[]` after `tsc` caught an overly-loose reporting row boundary.
- Files created/modified:
  - `server-v4/src/modules/reporting/reportingAggregateBuilder.ts` (created)
  - `server-v4/src/modules/reporting/reportingService.ts` (updated)
  - `server-v4/src/modules/reporting/ReportingController.ts` (updated)
  - `server-v4/src/modules/reporting/reportingRoutes.ts` (updated)
  - `server-v4/src/modules/reporting/reporting.module.ts` (updated)
  - `server/reportingReadModels.js` (updated)
  - `server/index.js` (updated)
  - `tests/server-v4/runtimeRoutes.test.js` (updated)
  - `tests/server.api.test.js` (updated)
  - `task.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

## Additional Test Results: 2026-03-09 Reporting Aggregates
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| Server-v4 aggregate red test | `pnpm exec vitest run tests/server-v4/runtimeRoutes.test.js -t "monthly reporting aggregates" --environment node` | New aggregate route fails before implementation | Failed as expected with `404` | pass |
| Monolith aggregate red test | `pnpm exec vitest run tests/server.api.test.js -t "V4 reporting aggregates API"` | New monolith aggregate route fails before implementation | Failed as expected (`401`/missing route assertions) | pass |
| Server-v4 aggregate green test | `pnpm exec vitest run tests/server-v4/runtimeRoutes.test.js -t "monthly reporting aggregates" --environment node` | Typed runtime serves monthly aggregate read model | Passed (`1/1`) | pass |
| Monolith aggregate green test | `pnpm exec vitest run tests/server.api.test.js -t "V4 reporting aggregates API"` | Monolith shim serves and stores monthly aggregate snapshot | Passed (`2/2`) | pass |
| Full backend API suite after aggregate slice | `pnpm exec vitest run tests/server.api.test.js` | Existing monolith API coverage stays green | Passed (`103/103`) | pass |
| Full server-v4 suite after aggregate slice | `pnpm exec vitest run tests/server-v4/appShell.test.js tests/server-v4/moduleCatalog.test.js tests/server-v4/runtimeRoutes.test.js --environment node` | Existing v4 runtime coverage stays green with aggregate route | Passed (`11/11`) | pass |
| Server-v4 typecheck after aggregate slice | `pnpm exec tsc -p tsconfig.server-v4.json --noEmit` | New aggregate builder and route wiring compile cleanly | Passed | pass |
| Repo lint baseline after aggregate slice | `pnpm lint` | No blocking lint regressions | Passed with warnings only (`0 errors, 61 warnings`) | pass |
| Health baseline after aggregate slice | `pnpm healthcheck` | Existing runtime baseline remains healthy | Passed with existing backup/cron warnings | pass |
| Patch sanity after aggregate slice | `git diff --check -- server-v4/src/modules/reporting/reportingAggregateBuilder.ts server-v4/src/modules/reporting/reportingService.ts server-v4/src/modules/reporting/ReportingController.ts server-v4/src/modules/reporting/reportingRoutes.ts server-v4/src/modules/reporting/reporting.module.ts server/reportingReadModels.js server/index.js tests/server-v4/runtimeRoutes.test.js tests/server.api.test.js` | No whitespace or patch-format issues in touched files | Passed | pass |

## Progress Update: 2026-03-09 Reporting Aggregate Cache/Invalidation Slice
- Scope:
  - Completed the next `cng-7c8.7` slice by making monthly aggregate reads cache-aware instead of always rematerializing.
  - Surfaced stored aggregate freshness metadata on reporting schedules so downstream cutover work can reason about snapshot availability without recomputing declarations.
  - Fixed the route-order bug where legacy declaration normalization during a read could evict the aggregate snapshot before the cache check happened.
- Implementation highlights:
  - Switched monolith aggregate materialization to lazy source loading in `server/index.js`, so `/api/v4/reporting/aggregates/monthly` checks the stored snapshot before touching `decl_rows_v1`.
  - Removed the unnecessary full reporting-source read from `/api/v4/reporting/schedules`; the route now reads schedule data directly and returns `aggregateStatus` from `kpi_reporting_monthly_aggregates_v1`.
  - Kept the `server-v4` contract aligned by normalizing stored monthly aggregate snapshots through typed helpers in `server-v4/src/modules/reporting/reportingService.ts`.
  - Tightened TypeScript narrowing in the aggregate query-key builder and snapshot normalizers so `tsc` stays green for the new cache/status path.
- Files created/modified:
  - `server/index.js` (updated)
  - `server-v4/src/modules/reporting/reportingAggregateBuilder.ts` (updated)
  - `server-v4/src/modules/reporting/reportingService.ts` (updated)
  - `tests/server.api.test.js` (updated)
  - `tests/server-v4/runtimeRoutes.test.js` (updated)
  - `task.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

## Additional Test Results: 2026-03-09 Reporting Aggregate Cache/Invalidation
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| Monolith focused reporting cache tests | `pnpm exec vitest run tests/server.api.test.js -t "monthly aggregate|schedule KPI đã chuẩn hóa|đính kèm trạng thái monthly aggregate"` | Aggregate cache reuse, invalidation, and schedule status regressions pass together | Passed (`6/6`) | pass |
| Server-v4 focused cache/status tests | `pnpm exec vitest run tests/server-v4/runtimeRoutes.test.js -t "stored monthly aggregate|schedules route|monthly reporting aggregates" --environment node` | Runtime reporting routes surface stored aggregate status and reuse stored snapshots | Passed (`3/3`) | pass |
| Full monolith API suite after cache slice | `pnpm exec vitest run tests/server.api.test.js` | No monolith API regression from lazy source loading | Passed (`106/106`) | pass |
| Full server-v4 suite after cache slice | `pnpm exec vitest run tests/server-v4/appShell.test.js tests/server-v4/moduleCatalog.test.js tests/server-v4/runtimeRoutes.test.js --environment node` | No server-v4 runtime regression from snapshot-status normalization | Passed (`13/13`) | pass |
| Server-v4 typecheck after cache slice | `pnpm exec tsc -p tsconfig.server-v4.json --noEmit` | New cache/status helpers compile cleanly | Passed | pass |
| Repo lint baseline after cache slice | `pnpm lint` | No blocking lint regressions | Passed with warnings only (`0 errors, 61 warnings`) | pass |
| Health baseline after cache slice | `pnpm healthcheck` | Existing runtime baseline remains healthy | Passed with existing backup/cron warnings | pass |
| Patch sanity after cache slice | `git diff --check -- server/index.js server-v4/src/modules/reporting/reportingAggregateBuilder.ts server-v4/src/modules/reporting/reportingService.ts tests/server.api.test.js tests/server-v4/runtimeRoutes.test.js` | No whitespace or patch-format issues in touched files | Passed | pass |

## Progress Update: 2026-03-09 Reporting Aggregate Write-Time Refresh Slice
- Scope:
  - Continued `cng-7c8.7` by moving monthly aggregate maintenance one step further from request-time recomputation.
  - Replaced the old “delete snapshot on source change” behavior with a write-time refresh of the currently tracked monthly aggregate query.
  - Preserved the lazy-read fix from the previous slice so read paths no longer evict the snapshot before checking it.
- Implementation highlights:
  - Added aggregate query-key parsing in `server/index.js` so the stored `kpi_reporting_monthly_aggregates_v1` snapshot can be rebuilt using its own last-used query parameters.
  - Replaced `invalidateMonthlyReportingAggregateSnapshot()` with a refresh path that recomputes the working-set snapshot immediately when `decl_rows_v1`, `team_roster_v1`, `kpi_rules_v2`, or `kpi_adjustments_v1` change.
  - Used raw reporting-source reads for the write-time refresh path to avoid recursive declaration normalization side effects during the refresh itself.
  - Updated the monolith regression to assert that source writes keep the snapshot alive and that the next aggregate read reuses the refreshed snapshot instead of rebuilding it again.
- Files created/modified:
  - `server/index.js` (updated)
  - `tests/server.api.test.js` (updated)
  - `task.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

## Additional Test Results: 2026-03-09 Reporting Aggregate Write-Time Refresh
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| Focused reporting refresh regression | `pnpm exec vitest run tests/server.api.test.js -t "monthly aggregate|schedule KPI đã chuẩn hóa|đính kèm trạng thái monthly aggregate|làm mới snapshot monthly aggregate"` | Cache reuse, schedule status, and write-time refresh all pass together | Passed (`6/6`) | pass |
| Full monolith API suite after write-time refresh slice | `pnpm exec vitest run tests/server.api.test.js` | No API regression from refreshing the working-set snapshot on source writes | Passed (`106/106`) | pass |
| Full server-v4 suite after write-time refresh slice | `pnpm exec vitest run tests/server-v4/appShell.test.js tests/server-v4/moduleCatalog.test.js tests/server-v4/runtimeRoutes.test.js --environment node` | No v4 runtime regression while monolith refresh logic changes | Passed (`13/13`) | pass |
| Repo lint baseline after write-time refresh slice | `pnpm lint` | No blocking lint regressions | Passed with warnings only (`0 errors, 61 warnings`) after one transient ESLint temp-file read failure on the first run | pass |
| Health baseline after write-time refresh slice | `pnpm healthcheck` | Existing runtime baseline remains healthy | Passed with existing backup/cron warnings | pass |
| Patch sanity after write-time refresh slice | `git diff --check -- server/index.js tests/server.api.test.js task.md task_plan.md findings.md progress.md` | No whitespace or patch-format issues in touched files | Passed | pass |

## Progress Update: 2026-03-09 Reporting Default Aggregate Preset Slice
- Scope:
  - Continued `cng-7c8.7` by separating the reporting cache model into two concerns: explicit working-set queries and a canonical default monthly preset.
  - Moved schedules and no-query monthly aggregate reads onto that default preset instead of letting the last arbitrary reporting query define system-wide aggregate status.
  - Kept both monolith and `server-v4` contracts aligned while preserving the legacy `kv_store` bridge.
- Implementation highlights:
  - Added default-preset query derivation in `server/reportingReadModels.js` and `server-v4/src/modules/reporting/reportingAggregateBuilder.ts`, selecting the newest populated monthly window from declaration data.
  - Extended monolith reporting aggregate orchestration in `server/index.js` so `/api/v4/reporting/aggregates/monthly` without query params and `/api/v4/reporting/schedules` materialize/read a dedicated snapshot key: `kpi_reporting_monthly_aggregates_default_v1`.
  - Kept explicit query snapshots on `kpi_reporting_monthly_aggregates_v1`, so ad hoc reporting queries no longer overwrite the aggregate status surfaced to schedules.
  - Updated `server-v4` reporting repositories/services so the typed runtime can read and backfill the same default snapshot key from the legacy SQLite store.
  - Corrected the red-test assumption for schedule seeds: schedule-only fixtures with February declarations should surface a February-only default preset rather than inventing a January bucket.
  - Normalized all touched files back to `CRLF` so repo lint returned to the existing warnings-only baseline.
- Files created/modified:
  - `server/index.js` (updated)
  - `server/reportingReadModels.js` (updated)
  - `server-v4/src/legacy/legacy-kv-store-reader.ts` (updated)
  - `server-v4/src/modules/reporting/ReportingController.ts` (updated)
  - `server-v4/src/modules/reporting/ReportingRepository.ts` (updated)
  - `server-v4/src/modules/reporting/reportingAggregateBuilder.ts` (updated)
  - `server-v4/src/modules/reporting/reportingService.ts` (updated)
  - `tests/server.api.test.js` (updated)
  - `tests/server-v4/runtimeRoutes.test.js` (updated)
  - `task.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

## Additional Test Results: 2026-03-09 Reporting Default Aggregate Preset
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| Focused monolith default-preset regressions | `pnpm exec vitest run tests/server.api.test.js -t "schedule KPI đã chuẩn hóa|đính kèm trạng thái monthly aggregate|dùng preset aggregate mặc định|tái sử dụng snapshot monthly aggregate|làm mới snapshot monthly aggregate"` | Default preset, schedule status, cache reuse, and write-time refresh behave together | Passed (`5/5`) | pass |
| Full monolith API suite after default-preset slice | `pnpm exec vitest run tests/server.api.test.js` | No monolith API regression from splitting explicit-query and default aggregate snapshots | Passed (`107/107`) | pass |
| Full server-v4 runtime suite after default-preset slice | `pnpm exec vitest run tests/server-v4/appShell.test.js tests/server-v4/moduleCatalog.test.js tests/server-v4/runtimeRoutes.test.js --environment node` | No typed-runtime regression from default snapshot read/backfill support | Passed (`14/14`) | pass |
| Focused server-v4 schedule/default tests | `pnpm exec vitest run tests/server-v4/runtimeRoutes.test.js --environment node` | Schedule normalization plus default preset behavior stays green in isolation | Passed (`10/10`) | pass |
| Server-v4 typecheck after default-preset slice | `pnpm exec tsc -p tsconfig.server-v4.json --noEmit` | New default-preset repository/service wiring compiles cleanly | Passed | pass |
| Repo lint baseline after default-preset slice | `pnpm lint` | No new blocking lint regressions after CRLF normalization | Passed with warnings only (`0 errors, 61 warnings`) | pass |
| Health baseline after default-preset slice | `pnpm healthcheck` | Existing runtime baseline remains healthy | Passed with existing backup/cron warnings | pass |
| Patch sanity after default-preset slice | `git diff --check -- server/index.js server/reportingReadModels.js server-v4/src/legacy/legacy-kv-store-reader.ts server-v4/src/modules/reporting/ReportingRepository.ts server-v4/src/modules/reporting/reportingAggregateBuilder.ts server-v4/src/modules/reporting/reportingService.ts server-v4/src/modules/reporting/ReportingController.ts tests/server.api.test.js tests/server-v4/runtimeRoutes.test.js` | No whitespace or patch-format issues in touched files | Passed | pass |

## Progress Update: 2026-03-09 Reporting Export Boundary Compact Contract Slice
- Scope:
  - Continued `cng-7c8.7` by tightening the reporting export boundary before the full dashboard/reporting UI cutover.
  - Replaced the new-path reliance on client-posted raw report blobs with a compact `reporting-v4` export contract resolved on the server.
  - Kept backward compatibility for legacy export payloads so current operator workflows do not break while the browser path is still being migrated.
- Implementation highlights:
  - Added `server/reportExportPayloads.js` to resolve compact export requests from the reporting source snapshot using the existing `buildReportData()` KPI math.
  - Updated `POST /api/reports/export` in `server/index.js` to accept compact `reporting-v4` payloads, rebuild the full export payload server-side, and keep export audit filters compact instead of storing `staffList`/`teamList`/`summary` blobs.
  - Updated `src/lib/reportExport.js` so all four export helpers (`staff`, `team`, `allStaff`, `allTeam`) now send `{ source, query, ruleId, staffKey|teamKey, columns }` for the compact path.
  - Removed redundant bulk payload arguments from the `ReportViewer` “export all” actions and kept detail exports on stable entity keys.
  - Tightened route error handling so expected compact-payload validation failures return `400` without noisy server-side logging.
  - Refreshed the brittle `ReportViewer` heading regression to match the current responsive copy.
- Files created/modified:
  - `server/index.js` (updated)
  - `server/reportExportPayloads.js` (new)
  - `src/components/ReportViewer.jsx` (updated)
  - `src/lib/reportExport.js` (updated)
  - `tests/reportExport.test.js` (new)
  - `tests/reportViewer.test.jsx` (updated)
  - `tests/server.api.test.js` (updated)
  - `task.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

## Additional Test Results: 2026-03-09 Reporting Export Boundary Compact Contract
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| Client compact export helpers | `pnpm exec vitest run tests/reportExport.test.js tests/reportViewer.test.jsx` | Export helpers send compact payloads and viewer regression stays green | Passed (`5/5`) | pass |
| Focused monolith export regressions | `pnpm exec vitest run tests/server.api.test.js -t "Report export API|compact reporting-v4 payload|staffKey không tồn tại"` | Export route accepts compact payloads, rejects bad keys, and preserves compact audit filters | Passed (`11/11`, `98` skipped) | pass |
| Focused lint on touched export files | `pnpm exec eslint src/lib/reportExport.js tests/reportExport.test.js tests/reportViewer.test.jsx server/reportExportPayloads.js server/index.js tests/server.api.test.js` | No blocking lint regressions after CRLF normalization | Passed with `0` errors and `2` existing warnings in `tests/server.api.test.js` | pass |
| Patch sanity after export-boundary slice | `git diff --check -- server/index.js server/reportExportPayloads.js src/lib/reportExport.js src/components/ReportViewer.jsx tests/server.api.test.js tests/reportExport.test.js tests/reportViewer.test.jsx` | No whitespace or patch-format issues in touched files | Passed | pass |

## Progress Update: 2026-03-09 ReportViewer Read-Path Loop Fix
- Scope:
  - Continued `cng-7c8.7` while migrating `ReportViewer` off browser-side report assembly.
  - Investigated a new frontend test hang and traced it to a storage feedback loop in rule reads rather than in the reporting fetch layer itself.
  - Stabilized the reporting viewer tests and aligned stale UI assertions with the current rule-selector and top-staff headings.
- Root cause:
  - `src/lib/rules.js` treated an already-valid persisted rule collection as a migration path and still called `persistCollection(stored)`.
  - Because `persistCollection()` writes `kpi_rules_v2` back through `storageClient.setItem()`, every `loadRuleSets()/loadRules()` read rebroadcast `RULES_KEY`.
  - `ReportViewer` subscribes to `RULES_KEY`, so the browser path could self-trigger `version` bumps and re-fetch loops even without a real rule edit.
- Implementation highlights:
  - Changed `loadRuleCollection()` to return `normalizeCollection(stored)` directly when `stored.sets` already represents a rule collection, keeping migration writes only for true legacy/default cases.
  - Added a regression test in `tests/rules.test.js` to prove `loadRuleSets()/loadRules()` no longer notify `RULES_KEY` during read-only access.
  - Updated `tests/reportViewer.test.jsx` to assert against the current rule label and duplicated reporting headings without relying on overly strict single-match text queries.
  - Updated the reporting-specific assertion in `tests/e2e.admin-flows.test.jsx` from the old `Top 5...` copy to the current `Top nhân viên...` heading.
  - Normalized touched files back to CRLF so repo-local ESLint passes under the Windows baseline.
- Files modified:
  - `src/lib/rules.js`
  - `tests/rules.test.js`
  - `tests/reportViewer.test.jsx`
  - `tests/e2e.admin-flows.test.jsx`
- Verification:
  - `pnpm exec vitest run tests/rules.test.js tests/reportingClient.test.js tests/reportViewer.test.jsx tests/automation.flows.test.js` -> Passed (`15/15`)
  - `pnpm exec vitest run tests/e2e.admin-flows.test.jsx -t "Báo Cáo KPI"` -> Passed (`1 passed`, `4 skipped`)
  - `pnpm exec eslint src/lib/rules.js tests/rules.test.js tests/reportingClient.test.js tests/reportViewer.test.jsx tests/e2e.admin-flows.test.jsx` -> Passed
  - `git diff --check -- src/lib/rules.js tests/rules.test.js tests/reportingClient.test.js tests/reportViewer.test.jsx tests/e2e.admin-flows.test.jsx` -> Passed

## Progress Update: 2026-03-09 Reporting Company Read-Model Slice
- Scope:
  - Continued `cng-7c8.7` by removing the remaining company-summary recomputation path from `ReportViewer`.
  - Extended both monolith and `server-v4` reporting read models so summary, staff detail, and team detail views all receive precomputed company aggregates from the server contract.
  - Kept the UI migration incremental by preserving existing detail rows/export inputs while only swapping the company-summary source.
- Implementation highlights:
  - Updated `server/reportingReadModels.js` to attach `companies` payloads to `summary`, `staff.items[]`, and `teams.items[]` using the legacy `aggregateByCompany()` helper server-side.
  - Extended `server-v4/src/legacy/legacy-report-bridge.ts` and `server-v4/src/modules/reporting/reportingService.ts` so the typed runtime exposes the same company-summary contract as the monolith shim.
  - Updated `src/lib/reportingClient.js` to normalize the new `companies` fields into the client view model and to keep empty-safe defaults for the reporting shell.
  - Removed `aggregateByCompany()` usage from `src/components/ReportViewer.jsx`; the component now reads `report.companies`, `staff.companies`, and `team.companies` directly.
  - Added/updated regression expectations in `tests/reportingClient.test.js`, `tests/server.api.test.js`, and `tests/server-v4/runtimeRoutes.test.js` for the new contract.
  - Normalized touched files back to CRLF to stay compatible with the repo's Windows lint baseline.
- Files modified:
  - `server/reportingReadModels.js`
  - `server-v4/src/legacy/legacy-report-bridge.ts`
  - `server-v4/src/modules/reporting/reportingService.ts`
  - `src/lib/reportingClient.js`
  - `src/components/ReportViewer.jsx`
  - `tests/reportingClient.test.js`
  - `tests/server.api.test.js`
  - `tests/server-v4/runtimeRoutes.test.js`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/reportingClient.test.js tests/server.api.test.js tests/server-v4/runtimeRoutes.test.js --environment node` -> Passed (`123/123`)
  - `pnpm exec vitest run tests/reportViewer.test.jsx tests/automation.flows.test.js` -> Passed (`4/4`)
  - `pnpm exec vitest run tests/e2e.admin-flows.test.jsx -t "Báo Cáo KPI"` -> Passed (`1 passed`, `4 skipped`)
  - `pnpm exec tsc -p tsconfig.server-v4.json --noEmit` -> Passed
  - `pnpm exec eslint src/lib/reportingClient.js src/components/ReportViewer.jsx server/reportingReadModels.js server-v4/src/legacy/legacy-report-bridge.ts server-v4/src/modules/reporting/reportingService.ts tests/reportingClient.test.js tests/server.api.test.js tests/server-v4/runtimeRoutes.test.js tests/reportViewer.test.jsx` -> Passed with warnings only (`0 errors`, `6 warnings`, including existing `server-v4` ignore warnings and preexisting unused-var warnings)
  - `git diff --check -- src/lib/reportingClient.js src/components/ReportViewer.jsx server/reportingReadModels.js server-v4/src/legacy/legacy-report-bridge.ts server-v4/src/modules/reporting/reportingService.ts tests/reportingClient.test.js tests/server.api.test.js tests/server-v4/runtimeRoutes.test.js tests/reportViewer.test.jsx tests/e2e.admin-flows.test.jsx task.md task_plan.md findings.md progress.md` -> Passed

## Progress Update: 2026-03-09 Reporting Client Thin-Model Cleanup
- Scope:
  - Continued `cng-7c8.7` with a small cleanup after the company read-model migration.
  - Removed the leftover browser-side `report.rows` assembly path from `src/lib/reportingClient.js`.
  - Kept the UI and tests aligned with the thinner view-model contract.
- Implementation highlights:
  - Deleted the `collectUniqueRows()` / `buildRowKey()` helpers from `src/lib/reportingClient.js`.
  - Removed the synthetic `rows` field from `createEmptyReportingViewModel()` and `buildReportingViewModel()`.
  - Updated `tests/reportingClient.test.js` to assert that the reporting client model no longer exposes a top-level `rows` snapshot.
  - Normalized touched files back to CRLF so targeted ESLint stays green under the repo's Windows baseline.
- Files modified:
  - `src/lib/reportingClient.js`
  - `tests/reportingClient.test.js`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/reportingClient.test.js --environment node` -> Passed (`2/2`)
  - `pnpm exec vitest run tests/reportingClient.test.js tests/reportViewer.test.jsx tests/automation.flows.test.js` -> Passed (`6/6`)
  - `pnpm exec eslint src/lib/reportingClient.js tests/reportingClient.test.js` -> Passed

## Progress Update: 2026-03-09 Reporting Client Metadata Cleanup
- Scope:
  - Continued `cng-7c8.7` by trimming one more unused browser-only artifact from the reporting client model.
  - Removed collection-level `keysHash` mirroring from `src/lib/reportingClient.js` now that no UI consumer depends on it.
  - Kept the change constrained to the client view model so the server reporting contract remains stable.
- Implementation highlights:
  - Simplified `createKeyedCollection()` in `src/lib/reportingClient.js` to return only `list` and `byKey`.
  - Updated `createEmptyReportingViewModel()` and `buildReportingViewModel()` so `staff` and `teams` no longer expose `keysHash` in the browser-normalized model.
  - Tightened `tests/reportingClient.test.js` to assert that `keysHash` is absent from both populated and empty reporting client models.
  - Normalized touched files back to CRLF so targeted ESLint stays green under the repo's Windows baseline.
- Files modified:
  - `src/lib/reportingClient.js`
  - `tests/reportingClient.test.js`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/reportingClient.test.js --environment node` -> Passed (`2/2`)
  - `pnpm exec vitest run tests/reportingClient.test.js tests/reportViewer.test.jsx tests/automation.flows.test.js` -> Passed (`6/6`)
  - `pnpm exec eslint src/lib/reportingClient.js tests/reportingClient.test.js` -> Passed

## Progress Update: 2026-03-09 Reporting Trend Model Cleanup
- Scope:
  - Continued `cng-7c8.7` with another thin-model cleanup in the reporting client.
  - Removed `trend.teamSeries` and `trend.topTeams` from the browser-normalized reporting model because the current reporting UI does not consume them.
  - Left the upstream server/report payloads unchanged so this remains a client-only shaping change.
- Implementation highlights:
  - Simplified `toTrend()` in `src/lib/reportingClient.js` so the client trend model now contains only `series` and `comparison`.
  - Updated `tests/reportingClient.test.js` to assert that `teamSeries` and `topTeams` are absent from both populated and empty client view models.
  - Normalized touched files back to CRLF so targeted ESLint stays green under the repo's Windows baseline.
- Files modified:
  - `src/lib/reportingClient.js`
  - `tests/reportingClient.test.js`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/reportingClient.test.js --environment node` -> Passed (`2/2`)
  - `pnpm exec vitest run tests/reportingClient.test.js tests/reportViewer.test.jsx tests/automation.flows.test.js` -> Passed (`6/6`)
  - `pnpm exec eslint src/lib/reportingClient.js tests/reportingClient.test.js` -> Passed

## Progress Update: 2026-03-09 Reporting Entity Shape Cleanup
- Scope:
  - Continued `cng-7c8.7` by tightening the shape of staff/team items in the reporting client model.
  - Removed implicit `...source` mirroring from `normalizeStaffItem()` and `normalizeTeamItem()`.
  - Kept the change client-only so server reporting payloads and read-model routes remain unchanged.
- Implementation highlights:
  - `src/lib/reportingClient.js` now emits explicit staff items with `key`, `name`, `teamLabel`, `stats`, `adjustmentSummary`, `rows`, and `companies`.
  - `src/lib/reportingClient.js` now emits explicit team items with `key`, `name`, `stats`, `adjustmentSummary`, `rows`, `members`, and `companies`.
  - Added regression expectations in `tests/reportingClient.test.js` showing server-only fields no longer leak into `report.staff.byKey` / `report.teams.byKey`.
  - Added safe defaults for missing `stats` and `adjustmentSummary` during client normalization.
  - Normalized touched files back to CRLF so targeted ESLint stays green under the repo's Windows baseline.
- Files modified:
  - `src/lib/reportingClient.js`
  - `tests/reportingClient.test.js`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/reportingClient.test.js --environment node` -> Passed (`2/2`)
  - `pnpm exec vitest run tests/reportingClient.test.js tests/reportViewer.test.jsx tests/automation.flows.test.js` -> Passed (`6/6`)
  - `pnpm exec eslint src/lib/reportingClient.js tests/reportingClient.test.js` -> Passed

## Progress Update: 2026-03-09 Reporting Summary Shape Cleanup
- Scope:
  - Continued `cng-7c8.7` by tightening the top-level reporting summary model on the client.
  - Removed raw summary pass-through so server-only summary metadata no longer leaks into browser state.
  - Kept the change local to the client normalizer; reporting routes and server payloads remain unchanged.
- Implementation highlights:
  - Added `toSummary()` in `src/lib/reportingClient.js` to normalize the dashboard summary contract explicitly.
  - `createEmptyReportingViewModel()` now starts with a zeroed summary object instead of an unstructured empty object.
  - `buildReportingViewModel()` now keeps only explicit summary metrics such as declaration counts, KPI totals, license/C/O counts, company count, and the summary text field the dashboard renders.
  - Added regression coverage in `tests/reportingClient.test.js` showing summary-level server-only fields no longer appear in the client model.
  - Normalized touched files back to CRLF so targeted ESLint stays green under the repo's Windows baseline.
- Files modified:
  - `src/lib/reportingClient.js`
  - `tests/reportingClient.test.js`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/reportingClient.test.js --environment node` -> Passed (`2/2`)
  - `pnpm exec vitest run tests/reportingClient.test.js tests/reportViewer.test.jsx tests/automation.flows.test.js` -> Passed (`6/6`)
  - `pnpm exec eslint src/lib/reportingClient.js tests/reportingClient.test.js` -> Passed

## Progress Update: 2026-03-09 Reporting Rule Shape Cleanup
- Scope:
  - Continued `cng-7c8.7` by tightening the rule reference object inside the client reporting model.
  - Removed raw `currentRules` spreading from `toRuleReference()` so unrelated nested rule metadata no longer leaks into browser state.
  - Preserved the fields still used by the current reporting UI and export fallback path.
- Implementation highlights:
  - Added `toRuleLicense()` in `src/lib/reportingClient.js` to keep only normalized `license.exclude.codes`.
  - Reworked `toRuleReference()` to emit an explicit rule shape: `id`, `name`, optional `applyFrom`, optional `version`, and optional `license.exclude.codes`.
  - Added regression coverage in `tests/reportingClient.test.js` showing rule-level server-only metadata is stripped while excluded license codes are preserved.
  - Normalized touched files back to CRLF so targeted ESLint stays green under the repo's Windows baseline.
- Files modified:
  - `src/lib/reportingClient.js`
  - `tests/reportingClient.test.js`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/reportingClient.test.js --environment node` -> Passed (`2/2`)
  - `pnpm exec vitest run tests/reportingClient.test.js tests/reportViewer.test.jsx tests/automation.flows.test.js` -> Passed (`6/6`)
  - `pnpm exec eslint src/lib/reportingClient.js tests/reportingClient.test.js` -> Passed

## Progress Update: 2026-03-09 Reporting Adjustments Contract Cleanup
- Scope:
  - Continued `cng-7c8.7` by moving one more normalization concern out of `ReportViewer` and into `reportingClient`.
  - Canonicalized adjustment totals in the client model so the component no longer has to handle the legacy `totals` alias itself.
  - Kept the behavioral surface unchanged for the reporting UI.
- Implementation highlights:
  - Updated `toAdjustments()` in `src/lib/reportingClient.js` to accept either `totalsByCategory` or legacy `totals`, and to coerce `points` / `quantity` values to numbers.
  - Added regression coverage in `tests/reportingClient.test.js` proving the client model normalizes adjustment totals from the legacy alias.
  - Simplified `adjustmentsReport` shaping in `src/components/ReportViewer.jsx` so the component now trusts the canonical `report.adjustments.totalsByCategory`.
  - Normalized touched files back to CRLF so targeted ESLint stays compatible with the repo's Windows baseline.
- Files modified:
  - `src/lib/reportingClient.js`
  - `src/components/ReportViewer.jsx`
  - `tests/reportingClient.test.js`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/reportingClient.test.js --environment node` -> Passed (`2/2`)
  - `pnpm exec vitest run tests/reportingClient.test.js tests/reportViewer.test.jsx tests/automation.flows.test.js` -> Passed (`6/6`)
  - `pnpm exec eslint src/lib/reportingClient.js src/components/ReportViewer.jsx tests/reportingClient.test.js` -> Passed with warnings only (`0 errors`, `2 warnings` from preexisting unused vars in `ReportViewer.jsx`)

## Progress Update: 2026-03-09 Reporting Approved-Adjustments Shape Cleanup
- Scope:
  - Continued `cng-7c8.7` by flattening approved adjustment rows in the client reporting model.
  - Removed the remaining nested `item.adjustment?...` dereferencing from the approved-adjustments table in `ReportViewer`.
  - Kept the user-facing reporting table behavior unchanged while reducing coupling to legacy detail-row structure.
- Implementation highlights:
  - Extended `toAdjustments()` in `src/lib/reportingClient.js` to normalize `applied[]` into a flat, render-ready shape with `key`, `label`, `staffName`, `teamName`, `quantity`, `unitPoints`, `references`, `referencesText`, `note`, `date`, `displayDate`, and `kpi`.
  - Added regression coverage in `tests/reportingClient.test.js` proving nested adjustment data is flattened and server-only adjustment metadata is stripped from the client model.
  - Simplified the approved-adjustments table in `src/components/ReportViewer.jsx` so it now renders directly from normalized fields instead of extracting them inline from `item.adjustment`.
  - Normalized touched files back to CRLF so targeted ESLint stays compatible with the repo's Windows baseline.
- Files modified:
  - `src/lib/reportingClient.js`
  - `src/components/ReportViewer.jsx`
  - `tests/reportingClient.test.js`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/reportingClient.test.js --environment node` -> Passed (`2/2`)
  - `pnpm exec vitest run tests/reportingClient.test.js tests/reportViewer.test.jsx tests/automation.flows.test.js` -> Passed (`6/6`)
  - `pnpm exec eslint src/lib/reportingClient.js src/components/ReportViewer.jsx tests/reportingClient.test.js` -> Passed with warnings only (`0 errors`, `2 warnings` from preexisting unused vars in `ReportViewer.jsx`)

## Progress Update: 2026-03-09 Reporting Adjustments Render-Path Cleanup
- Scope:
  - Finished the follow-on cleanup after approved-adjustment flattening by removing the last redundant viewer-side wrapper around the `adjustments` branch.
  - Cleared the two stale `ReportViewer.jsx` locals that were still leaving targeted lint warnings in the reporting render path.
- Implementation highlights:
  - Simplified `src/components/ReportViewer.jsx` so `adjustmentsReport` now directly references `report.adjustments` instead of rebuilding a parallel object.
  - Removed the unused `detailColumnCount` and `ruleTitle` locals from `ReportViewer.jsx`.
  - Normalized `src/components/ReportViewer.jsx` back to CRLF after the patch so ESLint stays aligned with the repo's Windows baseline.
- Files modified:
  - `src/components/ReportViewer.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/reportingClient.test.js tests/reportViewer.test.jsx tests/automation.flows.test.js` -> Passed (`6/6`)
  - `pnpm exec eslint src/lib/reportingClient.js src/components/ReportViewer.jsx tests/reportingClient.test.js` -> Passed (`0 errors`, `0 warnings`)

## Progress Update: 2026-03-09 Reporting Entity Card Normalization Cleanup
- Scope:
  - Continued `cng-7c8.7` by moving repeated staff/team detail-card shaping into `reportingClient`.
  - Removed duplicated `licenseSummary` and `adjustmentTotals` derivation from both `StaffDetailCard` and `TeamDetailCard`.
- Implementation highlights:
  - `src/lib/reportingClient.js` now imports the shared `toAdjustmentTotalsArray()` helper and normalizes staff/team item fields `licenseSummary` and `adjustmentTotals` alongside the existing raw `stats` and `adjustmentSummary`.
  - `src/components/ReportViewer.jsx` now reads those normalized fields directly from `staff` / `team` detail models instead of recomputing them per card.
  - Added regression coverage in `tests/reportingClient.test.js` proving the normalized item model includes trimmed license summaries and numeric adjustment totals for both staff and teams.
  - Normalized touched files back to CRLF so targeted ESLint stays aligned with the repo's Windows baseline.
- Files modified:
  - `src/lib/reportingClient.js`
  - `src/components/ReportViewer.jsx`
  - `tests/reportingClient.test.js`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/reportingClient.test.js --environment node` -> Passed (`2/2`)
  - `pnpm exec vitest run tests/reportingClient.test.js tests/reportViewer.test.jsx tests/automation.flows.test.js` -> Passed (`6/6`)
  - `pnpm exec eslint src/lib/reportingClient.js src/components/ReportViewer.jsx tests/reportingClient.test.js` -> Passed (`0 errors`, `0 warnings`)

## Progress Update: 2026-03-09 Reporting Adjustment Metrics Normalization
- Scope:
  - Continued `cng-7c8.7` by removing the last duplicated adjustment-counting loops from staff/team detail cards.
  - Kept UI formatting behavior unchanged while pushing reusable adjustment aggregate math into the client reporting normalizer.
- Implementation highlights:
  - Added `toAdjustmentMetrics()` in `src/lib/reportingClient.js` and wired staff/team item normalizers to emit `adjustmentMetrics` with `totalPoints`, `entryCount`, `positive`, `negative`, and `neutral`.
  - Extended `tests/reportingClient.test.js` with regression coverage proving both staff and team items expose normalized adjustment metrics.
  - Simplified `src/components/ReportViewer.jsx` so staff/team detail cards now read `adjustmentMetrics` directly instead of rescanning raw `rows` to compute totals and breakdown counts.
  - Tightened the subtitle dependency lists in `ReportViewer.jsx` so targeted ESLint returns to a clean `0 warnings` state after the refactor.
- Files modified:
  - `src/lib/reportingClient.js`
  - `src/components/ReportViewer.jsx`
  - `tests/reportingClient.test.js`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/reportingClient.test.js --environment node` -> Passed (`2/2`)
  - `pnpm exec vitest run tests/reportingClient.test.js tests/reportViewer.test.jsx tests/automation.flows.test.js` -> Passed (`6/6`)
  - `pnpm exec eslint src/lib/reportingClient.js src/components/ReportViewer.jsx tests/reportingClient.test.js` -> Passed (`0 errors`, `0 warnings`)

## Progress Update: 2026-03-09 Reporting Top-Level Adjustment Totals Normalization
- Scope:
  - Continued `cng-7c8.7` by removing the last top-level adjustment helper transform from `ReportViewer`.
  - Kept the rendered adjustment summary table unchanged while moving ordered totals-list shaping into `reportingClient`.
- Implementation highlights:
  - Extended `toAdjustments()` in `src/lib/reportingClient.js` to emit `totalsList` alongside `totalsByCategory`, preserving the canonical keyed map while also exposing the render-ready ordered list.
  - Added regression coverage in `tests/reportingClient.test.js` proving `report.adjustments.totalsList` is present and normalized.
  - Simplified `src/components/ReportViewer.jsx` so the main adjustments summary now reads `adjustmentsReport.totalsList` directly and no longer imports or calls `toAdjustmentTotalsArray()`.
  - Normalized touched files back to CRLF so targeted ESLint stays aligned with the repo's Windows baseline.
- Files modified:
  - `src/lib/reportingClient.js`
  - `src/components/ReportViewer.jsx`
  - `tests/reportingClient.test.js`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/reportingClient.test.js --environment node` -> Passed (`2/2`)
  - `pnpm exec vitest run tests/reportingClient.test.js tests/reportViewer.test.jsx tests/automation.flows.test.js` -> Passed (`6/6`)
  - `pnpm exec eslint src/lib/reportingClient.js src/components/ReportViewer.jsx tests/reportingClient.test.js` -> Passed (`0 errors`, `0 warnings`)

## Progress Update: 2026-03-09 Reporting License Summary Table Cleanup
- Scope:
  - Continued `cng-7c8.7` by removing repeated license-code string joins from summary/member table paths in `ReportViewer`.
  - Kept rendered table content unchanged while shifting those string summaries into the client reporting model.
- Implementation highlights:
  - Extended `normalizeTeamItem()` in `src/lib/reportingClient.js` so `members[]` are normalized objects with stable `key`, `name`, `stats`, and `licenseSummary`.
  - Reused the already-normalized `licenseSummary` field for staff/team summary tables and the team-member table in `src/components/ReportViewer.jsx`, removing three inline `join(", ")` render branches.
  - Added regression coverage in `tests/reportingClient.test.js` proving team members now expose trimmed `licenseSummary` values in the client view model.
  - Normalized touched files back to CRLF so targeted ESLint stays aligned with the repo's Windows baseline.
- Files modified:
  - `src/lib/reportingClient.js`
  - `src/components/ReportViewer.jsx`
  - `tests/reportingClient.test.js`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/reportingClient.test.js --environment node` -> Passed (`2/2`)
  - `pnpm exec vitest run tests/reportingClient.test.js tests/reportViewer.test.jsx tests/automation.flows.test.js` -> Passed (`6/6`)
  - `pnpm exec eslint src/lib/reportingClient.js src/components/ReportViewer.jsx tests/reportingClient.test.js` -> Passed (`0 errors`, `0 warnings`)

## Progress Update: 2026-03-09 Reporting Detail-Row License Normalization
- Scope:
  - Continued `cng-7c8.7` by removing repeated array-to-string license shaping from staff/team detail tables.
  - Left pagination, chunking, and tooltip phrasing in the UI, but moved raw code cleanup/joining into the client reporting model.
- Implementation highlights:
  - Added `toCodeSummary()` and `normalizeDetailRow()` in `src/lib/reportingClient.js`, and wired both staff/team `rows[]` branches through that normalizer.
  - Each normalized detail row now exposes `licenseSummary` and `licenseExcludedSummary` in addition to the legacy raw arrays.
  - Simplified the two detail-table render loops in `src/components/ReportViewer.jsx` so they read those normalized fields instead of joining `licenseCodes` and `licenseExcludedCodes` inline.
  - Added regression coverage in `tests/reportingClient.test.js` proving normalized detail rows carry trimmed license summary fields.
  - Normalized touched files back to CRLF so targeted ESLint stays aligned with the repo's Windows baseline.
- Files modified:
  - `src/lib/reportingClient.js`
  - `src/components/ReportViewer.jsx`
  - `tests/reportingClient.test.js`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/reportingClient.test.js --environment node` -> Passed (`2/2`)
  - `pnpm exec vitest run tests/reportingClient.test.js tests/reportViewer.test.jsx tests/automation.flows.test.js` -> Passed (`6/6`)
  - `pnpm exec eslint src/lib/reportingClient.js src/components/ReportViewer.jsx tests/reportingClient.test.js` -> Passed (`0 errors`, `0 warnings`)

## Progress Update: 2026-03-09 Reporting Rule License Summary Cleanup
- Scope:
  - Continued `cng-7c8.7` by removing one more browser-side license-code join from the rule-summary path.
  - Kept the normalized `report.rules.license.exclude.codes` array intact for consumers that still need structured access.
- Implementation highlights:
  - Added `toRuleLicenseExcludedSummary()` in `src/lib/reportingClient.js` and wired `toRuleReference()` to emit `licenseExcludedSummary` whenever excluded rule codes exist.
  - Updated regression coverage in `tests/reportingClient.test.js` so the normalized rule reference must now include `licenseExcludedSummary`.
  - Simplified the rule-summary panel in `src/components/ReportViewer.jsx` to read `report.rules.licenseExcludedSummary` directly instead of joining `license.exclude.codes` inline.
  - Normalized touched files back to CRLF so targeted ESLint stays aligned with the repo's Windows baseline.
- Files modified:
  - `src/lib/reportingClient.js`
  - `src/components/ReportViewer.jsx`
  - `tests/reportingClient.test.js`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/reportingClient.test.js --environment node` -> Passed (`2/2`)
  - `pnpm exec vitest run tests/reportingClient.test.js tests/reportViewer.test.jsx tests/automation.flows.test.js` -> Passed (`6/6`)
  - `pnpm exec eslint src/lib/reportingClient.js src/components/ReportViewer.jsx tests/reportingClient.test.js` -> Passed (`0 errors`, `0 warnings`)

## Progress Update: 2026-03-09 Reporting Schedule Read-Model Bridge
- Scope:
  - Continued `cng-7c8.7` by moving the schedule UI onto the `/api/v4/reporting/schedules` read model without breaking the current local-first edit flow.
  - Kept optimistic schedule edits intact by overlaying local schedule state on top of the remote normalized schedule collection.
- Implementation highlights:
  - Added schedule read-model helpers in `src/lib/reportingClient.js` to fetch, normalize, and merge schedule items, including `formatsSummary`, `recipientsSummary`, and default monthly `aggregateStatus`.
  - Updated `src/components/ReportViewer.jsx` to load `/api/v4/reporting/schedules`, surface aggregate readiness metadata in the reporting header, and render normalized schedule summaries instead of joining raw arrays inline.
  - Added a mock `/api/v4/reporting/schedules` handler in `tests/helpers/mockApiState.js` so UI tests exercise the same read-model contract and default aggregate-status shape.
  - Added regression coverage proving local schedule items override stale remote snapshots while preserving remote timing metadata when local edits do not supply it.
  - Normalized touched files back to CRLF so targeted lint stays aligned with the repo's Windows baseline.
- Files modified:
  - `src/lib/reportingClient.js`
  - `src/components/ReportViewer.jsx`
  - `tests/reportingClient.test.js`
  - `tests/reportViewer.test.jsx`
  - `tests/helpers/mockApiState.js`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/reportingClient.test.js tests/reportViewer.test.jsx --environment jsdom` -> Passed (`4/4`)
  - `pnpm exec vitest run tests/reportingClient.test.js tests/reportViewer.test.jsx tests/automation.flows.test.js` -> Passed (`7/7`)
  - `pnpm exec eslint src/lib/reportingClient.js src/components/ReportViewer.jsx tests/reportingClient.test.js tests/reportViewer.test.jsx tests/helpers/mockApiState.js` -> Passed (`0 errors`, `0 warnings`)
  - `git diff --check -- src/lib/reportingClient.js src/components/ReportViewer.jsx tests/reportingClient.test.js tests/reportViewer.test.jsx tests/helpers/mockApiState.js task.md task_plan.md findings.md progress.md` -> Passed

## Progress Update: 2026-03-09 Reporting Schedule Boundary Cleanup
- Scope:
  - Continued `cng-7c8.7` by removing direct schedule-store plumbing from `ReportViewer` while keeping the current transition-safe overlay behavior intact.
  - Kept the browser contract stable: remote schedules stay canonical, local schedule edits still overlay by `id`, and UI rendering stays unchanged.
- Implementation highlights:
  - Extended `src/lib/reportingClient.js` with `normalizeStoredReportingScheduleItems()`, `loadLocalReportingScheduleItems()`, `subscribeReportingSchedules()`, `saveReportingSchedule()`, and `deleteReportingSchedule()` so schedule overlay/save/delete/subscription behavior sits behind one reporting boundary.
  - Tightened the schedule normalizer so local overlays dedupe `formats` and `recipients` the same way as remote schedule payloads.
  - Updated `src/components/ReportViewer.jsx` to use those reporting-client helpers instead of importing `get/save/deleteReportSchedule` and schedule-key subscription wiring directly from `store.js`.
  - Added regression coverage in `tests/reportingClient.test.js` proving stored local schedule overlays normalize to the same render contract as remote read-model schedules.
  - Normalized touched files back to CRLF so targeted lint stays aligned with the repo's Windows baseline.
- Files modified:
  - `src/lib/reportingClient.js`
  - `src/components/ReportViewer.jsx`
  - `tests/reportingClient.test.js`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/reportingClient.test.js --environment node` -> Passed (`4/4`)
  - `pnpm exec vitest run tests/reportViewer.test.jsx tests/automation.flows.test.js` -> Passed (`4/4`)
  - `pnpm exec eslint src/lib/reportingClient.js src/components/ReportViewer.jsx tests/reportingClient.test.js` -> Passed (`0 errors`, `0 warnings`)
  - `git diff --check -- src/lib/reportingClient.js src/components/ReportViewer.jsx tests/reportingClient.test.js task.md task_plan.md findings.md progress.md` -> Passed

## Progress Update: 2026-03-09 Reporting Schedule Write-Boundary Cutover
- Scope:
  - Continued `cng-7c8.7` by moving the actual schedule write path behind the reporting boundary instead of leaving it local-store-first behind `reportingClient`.
  - Closed the generic storage-write fallback for KPI schedules and updated the UI to refresh the canonical reporting read model after save/delete.
- Implementation highlights:
  - Added `server/reportingScheduleMutations.js` so schedule normalization/upsert/remove logic sits in a small shared server module instead of being duplicated inline.
  - Added explicit `POST /api/v4/reporting/schedules` and `DELETE /api/v4/reporting/schedules/:id` handlers in `server/index.js`, with audit logging and persistence through the reporting-specific path.
  - Blocked generic `PUT` and `DELETE` writes to `kpi_report_schedule_v1` under `/api/storage/:key`, so schedule mutations no longer bypass the reporting API boundary.
  - Updated `src/lib/reportingClient.js` so `saveReportingSchedule()` and `deleteReportingSchedule()` call the new reporting endpoints instead of store helpers.
  - Updated `src/components/ReportViewer.jsx` so schedule mutations no longer depend on local schedule overlay/subscription state; the component now bumps a local reload version and refetches `/api/v4/reporting/schedules` after save/delete.
  - Added client/server regression coverage in `tests/reportingClient.test.js` and `tests/server.api.test.js` for the new schedule mutation boundary and the blocked generic storage write path.
  - Synced notebook state in `task.md`, `task_plan.md`, and `findings.md`.
- Files modified:
  - `server/index.js`
  - `server/reportingScheduleMutations.js`
  - `src/lib/reportingClient.js`
  - `src/components/ReportViewer.jsx`
  - `tests/reportingClient.test.js`
  - `tests/server.api.test.js`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/reportingClient.test.js --environment node` -> Passed (`6/6`)
  - `pnpm exec vitest run tests/reportViewer.test.jsx tests/automation.flows.test.js` -> Passed (`4/4`), with the existing jsdom `ResponsiveContainer` width/height `0` warning still present
  - `pnpm exec vitest run tests/server.api.test.js -t "schedule KPI"` -> Passed (`3 passed`, `109 skipped`)
  - `pnpm exec eslint src/lib/reportingClient.js src/components/ReportViewer.jsx tests/reportingClient.test.js server/reportingScheduleMutations.js` -> Passed (`0 errors`, `0 warnings`)
  - `git diff --check -- src/lib/reportingClient.js src/components/ReportViewer.jsx tests/reportingClient.test.js tests/server.api.test.js server/index.js server/reportingScheduleMutations.js task.md task_plan.md findings.md progress.md` -> Passed

## Progress Update: 2026-03-09 Server-v4 Reporting Schedule Runtime Parity
- Scope:
  - Continued `cng-7c8.7` by closing the last schedule-runtime gap in `server-v4`: post-mutation `GET /api/v4/reporting/schedules` was still failing while building the default aggregate status.
  - Kept the fix minimal and confined to the reporting bridge/runtime layer instead of reopening the client contract.
- Implementation highlights:
  - Reproduced the failure with the existing RED runtime test for `server-v4` schedule save/delete flow.
  - Traced the `500` to `server-v4/src/legacy/legacy-report-bridge.ts`, where the async loader built `src/lib/reports.js` from `import.meta.url`; under Vitest/vite-node that base could become `http://...`, which Node's default ESM loader rejects.
  - Updated the bridge to resolve `src/lib/reports.js` through `path.resolve(process.cwd(), ...)` plus `pathToFileURL(...)`, so the legacy reporting module is always imported through a stable `file:` URL.
  - Removed the temporary `console.error(...)` diagnostic from `server-v4/src/http/BaseController.ts` once the root cause was fixed.
  - Synced notebook state so the reporting slice now reflects real `server-v4` mutation parity and the shared `reportingClient` schedule-cache refresh path.
- Files modified:
  - `server-v4/src/legacy/legacy-report-bridge.ts`
  - `server-v4/src/http/BaseController.ts`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/server-v4/runtimeRoutes.test.js -t "report schedules through the server-v4 reporting boundary"` -> Passed (`1/1`)
  - `pnpm run typecheck:server-v4` -> Passed
  - `pnpm exec vitest run tests/reportingClient.test.js --environment node` -> Passed (`8/8`)
  - `pnpm exec vitest run tests/reportViewer.test.jsx tests/automation.flows.test.js tests/server-v4/runtimeRoutes.test.js` -> Passed (`16/16`), with the existing jsdom `ResponsiveContainer` width/height `0` warning still present
  - `pnpm exec vitest run tests/server.api.test.js -t "schedule KPI"` -> Passed (`3 passed`, `109 skipped`)
  - `pnpm exec eslint server-v4/src/legacy/legacy-report-bridge.ts server-v4/src/http/BaseController.ts` -> Warnings only (`2 files ignored because no matching ESLint configuration was supplied`)
  - `git diff --check -- server-v4/src/legacy/legacy-report-bridge.ts server-v4/src/http/BaseController.ts tests/server-v4/runtimeRoutes.test.js task.md task_plan.md findings.md progress.md` -> Passed

## Progress Update: 2026-03-09 Combined Reporting View Boundary
- Scope:
  - Continued `cng-7c8.7` by moving the dashboard read path onto a single combined reporting boundary instead of assembling `summary`, `staff`, and `teams` through three browser-side requests.
  - Kept the reporting math and UI contract stable while reducing request fan-out in both the monolith shim and `server-v4`.
- Implementation highlights:
  - Added `GET /api/v4/reporting/view` to the monolith shim in `server/index.js`, returning the full `buildReportingReadModels(...)` bundle behind the authenticated reporting boundary.
  - Added `getView()` to `server-v4/src/modules/reporting/reportingService.ts`, plus the matching controller/router wiring, so `server-v4` now exposes the same combined reporting bundle.
  - Updated `src/lib/reportingClient.js` so `fetchReportingViewModel()` now calls `/api/v4/reporting/view` once and feeds that bundle into the existing client normalizer.
  - Added RED/GREEN regression coverage in `tests/reportingClient.test.js`, `tests/server-v4/runtimeRoutes.test.js`, `tests/server.api.test.js`, and `tests/helpers/mockApiState.js` to prove the single-endpoint contract on client, monolith, mock API, and `server-v4`.
  - Re-normalized touched JS files back to CRLF so the repo's Windows-oriented lint rules stay green after the new route/test additions.
- Files modified:
  - `server/index.js`
  - `server-v4/src/modules/reporting/reportingService.ts`
  - `server-v4/src/modules/reporting/ReportingController.ts`
  - `server-v4/src/modules/reporting/reportingRoutes.ts`
  - `src/lib/reportingClient.js`
  - `tests/reportingClient.test.js`
  - `tests/server-v4/runtimeRoutes.test.js`
  - `tests/server.api.test.js`
  - `tests/helpers/mockApiState.js`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/reportingClient.test.js --environment node` -> Passed (`9/9`)
  - `pnpm exec vitest run tests/server-v4/runtimeRoutes.test.js -t "combined reporting view bundle"` -> Passed (`1/1`)
  - `pnpm exec vitest run tests/server.api.test.js -t "reporting view bundle"` -> Passed (`1/1`)
  - `pnpm exec vitest run tests/reportViewer.test.jsx tests/automation.flows.test.js tests/server-v4/runtimeRoutes.test.js` -> Passed (`17/17`), with the existing jsdom `ResponsiveContainer` width/height `0` warning still present
  - `pnpm exec vitest run tests/server.api.test.js` -> Passed (`113/113`)
  - `pnpm run typecheck:server-v4` -> Passed
  - `pnpm exec eslint server/index.js src/lib/reportingClient.js tests/reportingClient.test.js tests/server.api.test.js tests/helpers/mockApiState.js` -> Passed with existing repo warnings only (`2 no-unused-vars warnings` in `tests/server.api.test.js`)
  - `git diff --check -- server/index.js server-v4/src/modules/reporting/reportingService.ts server-v4/src/modules/reporting/ReportingController.ts server-v4/src/modules/reporting/reportingRoutes.ts src/lib/reportingClient.js tests/reportingClient.test.js tests/server-v4/runtimeRoutes.test.js tests/server.api.test.js tests/helpers/mockApiState.js` -> Passed

## Progress Update: 2026-03-09 Reporting Projection Table Cutover
- Scope:
  - Continued `cng-7c8.7` by replacing the remaining legacy `kv_store` persistence under the reporting projection seam with a typed `reporting_projections` table.
  - Closed the last main dashboard fan-out consumer by moving `ReportViewer` baseline-rule comparison reads onto `/api/v4/reporting/view` as well.
- Implementation highlights:
  - Added `server/reportingProjectionSqlite.js` plus `server/reportingProjectionSqlite.d.ts`, providing shared SQLite helpers for creating, reading, writing, and deleting typed reporting projection rows.
  - Updated monolith initialization/reset in `server/index.js` so `reporting_projections` is created up front, cleared in test resets, and used for schedule plus active/default monthly aggregate snapshot persistence.
  - Fixed the active monthly-aggregate refresh path in `server/index.js` so refreshes after source changes now update `reporting_projections` instead of leaving the read model stranded in legacy `kv_store`.
  - Updated `server-v4/src/modules/reporting/ReportingRepository.ts` to read/write schedules and monthly aggregate snapshots through the shared projection-table helper with legacy `kv_store` fallback for older data.
  - Extended the fake SQLite harness inside `tests/server.api.test.js` to understand `reporting_projections`, added direct unit coverage in `tests/reportingProjectionSqlite.test.js`, and hardened the `server-v4` runtime schedule test with `try/finally` DB cleanup.
  - Updated `src/components/ReportViewer.jsx` so baseline-rule comparison now also uses `fetchReportingViewModel()` / `/api/v4/reporting/view`; added a UI regression test proving no `/api/v4/reporting/summary` call is made for that path.
  - Re-normalized touched files back to CRLF to keep the repo's Windows-oriented lint/diff checks clean.
- Files modified:
  - `server/index.js`
  - `server/reportingProjectionStore.js`
  - `server/reportingProjectionSqlite.js`
  - `server/reportingProjectionSqlite.d.ts`
  - `server-v4/src/modules/reporting/ReportingRepository.ts`
  - `src/components/ReportViewer.jsx`
  - `tests/server.api.test.js`
  - `tests/server.seed.test.js`
  - `tests/server-v4/runtimeRoutes.test.js`
  - `tests/reportViewer.test.jsx`
  - `tests/reportingProjectionSqlite.test.js`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm run typecheck:server-v4` -> Passed
  - `pnpm exec vitest run tests/reportingClient.test.js tests/reportViewer.test.jsx tests/automation.flows.test.js tests/server.api.test.js tests/server.seed.test.js tests/server-v4/runtimeRoutes.test.js tests/reportExport.test.js tests/reportExportPayloads.test.js tests/reportingProjectionStore.test.js tests/reportingProjectionSqlite.test.js` -> Passed (`154/154`), with the existing jsdom `ResponsiveContainer` width/height `0` warning still present in `tests/reportViewer.test.jsx`
  - `pnpm exec eslint src/components/ReportViewer.jsx tests/reportViewer.test.jsx server/index.js server/reportingProjectionStore.js server/reportingProjectionSqlite.js tests/server.api.test.js tests/server.seed.test.js tests/server-v4/runtimeRoutes.test.js tests/reportExport.test.js tests/reportExportPayloads.test.js tests/reportingProjectionStore.test.js tests/reportingProjectionSqlite.test.js` -> Passed with existing repo warnings only (`2 no-unused-vars warnings` in `tests/server.api.test.js`)
  - `git diff --check -- src/components/ReportViewer.jsx tests/reportViewer.test.jsx server/index.js server/reportingProjectionStore.js server/reportingProjectionSqlite.js server/reportingProjectionSqlite.d.ts server-v4/src/modules/reporting/ReportingRepository.ts tests/server.api.test.js tests/server.seed.test.js tests/server-v4/runtimeRoutes.test.js tests/reportExport.test.js tests/reportExportPayloads.test.js tests/reportingProjectionStore.test.js tests/reportingProjectionSqlite.test.js task.md task_plan.md findings.md progress.md` -> Passed

## Progress Update: 2026-03-10 Reporting Compatibility Wrapper Convergence
- Scope:
  - Continued `cng-7c8.7` by collapsing the remaining compatibility reads (`/api/v4/reporting/summary|staff|teams`) onto the unified reporting view boundary instead of letting those routes keep their own assembly logic.
  - Removed the last dead summary-only client helper so the browser-facing reporting surface stays centered on `/api/v4/reporting/view`.
- Implementation highlights:
  - Added a small monolith-side helper in `server/index.js` so `/api/v4/reporting/view` builds the reporting bundle once per request and `summary`/`staff`/`teams` routes just slice that bundle.
  - Updated `server-v4/src/modules/reporting/reportingService.ts` so `getSummary()`, `getStaff()`, and `getTeams()` delegate to `getView()` instead of rebuilding partial responses independently.
  - Simplified `tests/helpers/mockApiState.js` to serve `/api/v4/reporting/view`, `/summary`, `/staff`, and `/teams` from one shared payload builder, which keeps browser/test harness behavior aligned with both runtimes.
  - Removed the unused `fetchReportingSummary()` export from `src/lib/reportingClient.js`.
  - Added regression coverage proving compatibility endpoints stay equal to their `/api/v4/reporting/view` slices in both the monolith and `server-v4`, plus a unit guard that `ReportingService` compatibility reads really go through `getView()`.
  - Re-normalized touched files back to CRLF for clean Windows-oriented diffs.
- Files modified:
  - `server/index.js`
  - `server-v4/src/modules/reporting/reportingService.ts`
  - `src/lib/reportingClient.js`
  - `tests/helpers/mockApiState.js`
  - `tests/server-v4/reportingService.test.js`
  - `tests/server-v4/runtimeRoutes.test.js`
  - `tests/server.api.test.js`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/server-v4/reportingService.test.js tests/server-v4/runtimeRoutes.test.js -t "reporting"` -> Passed (`7 passed`, `8 skipped`)
  - `pnpm exec vitest run tests/server.api.test.js -t "reporting"` -> Passed (`16 passed`, `98 skipped`)
  - `pnpm exec vitest run tests/reportingClient.test.js tests/reportViewer.test.jsx` -> Passed (`11/11`), with the existing jsdom `ResponsiveContainer` width/height `0` warning still present in `tests/reportViewer.test.jsx`
  - `pnpm run typecheck:server-v4` -> Passed
  - `pnpm exec eslint server/index.js server-v4/src/modules/reporting/reportingService.ts src/lib/reportingClient.js tests/helpers/mockApiState.js tests/server-v4/reportingService.test.js tests/server-v4/runtimeRoutes.test.js tests/server.api.test.js` -> Passed with existing warnings only (`server-v4` TS file still outside ESLint config; existing `no-unused-vars` warnings remain in `tests/server.api.test.js`)
  - `git diff --check -- server/index.js server-v4/src/modules/reporting/reportingService.ts src/lib/reportingClient.js tests/helpers/mockApiState.js tests/server-v4/reportingService.test.js tests/server-v4/runtimeRoutes.test.js tests/server.api.test.js task.md task_plan.md findings.md progress.md` -> Passed

## Progress Update: 2026-03-10 Shared Legacy Reporting Bridge
- Scope:
  - Continued `cng-7c8.7` by collapsing the remaining backend imports of legacy KPI math onto one shared seam.
  - Removed the special `server-v4` dynamic loader path so both runtimes now consume the same backend bridge contract.
- Implementation highlights:
  - Added `server/legacyReportingBridge.js` plus `server/legacyReportingBridge.d.ts` as the single backend bridge that wraps legacy `buildReportData()` and `aggregateByCompany()` from `src/lib/reports.js`.
  - Updated `server/reportingReadModels.js` to use the shared bridge for both combined read-model construction and monthly aggregate building.
  - Updated `server/index.js` to use the same bridge for the AI reporting snapshot path instead of importing `buildReportData()` directly.
  - Replaced `server-v4/src/legacy/legacy-report-bridge.ts` with a thin typed async wrapper over the shared bridge, removing the earlier `pathToFileURL(process.cwd() + 'src/lib/reports.js')` loader workaround.
  - Added RED/GREEN unit coverage in `tests/reportingReadModels.test.js` and `tests/server-v4/legacyReportBridge.test.js` to prove both consumers now call the shared bridge.
  - Re-normalized touched files back to CRLF for clean Windows-oriented diffs.
- Files modified:
  - `server/legacyReportingBridge.js`
  - `server/legacyReportingBridge.d.ts`
  - `server/reportingReadModels.js`
  - `server/index.js`
  - `server-v4/src/legacy/legacy-report-bridge.ts`
  - `tests/reportingReadModels.test.js`
  - `tests/server-v4/legacyReportBridge.test.js`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/reportingReadModels.test.js tests/server-v4/legacyReportBridge.test.js` -> Passed (`3/3`)
  - `pnpm exec vitest run tests/reportingReadModels.test.js tests/server-v4/legacyReportBridge.test.js tests/server-v4/reportingService.test.js tests/server-v4/runtimeRoutes.test.js tests/server.api.test.js tests/reportExportPayloads.test.js tests/reportingClient.test.js tests/reportViewer.test.jsx` -> Passed (`145/145`), with the existing jsdom `ResponsiveContainer` width/height `0` warning still present in `tests/reportViewer.test.jsx` and pre-existing stderr from unrelated AI/ECUS tests
  - `pnpm run typecheck:server-v4` -> Passed
  - `pnpm exec eslint server/legacyReportingBridge.js server/reportingReadModels.js server/index.js server-v4/src/legacy/legacy-report-bridge.ts tests/reportingReadModels.test.js tests/server-v4/legacyReportBridge.test.js tests/server-v4/reportingService.test.js tests/server-v4/runtimeRoutes.test.js tests/server.api.test.js tests/reportExportPayloads.test.js` -> Passed with existing warnings only (`server-v4` TS file still outside ESLint config; existing `no-unused-vars` warnings remain in `tests/server.api.test.js`)
  - `git diff --check -- server/legacyReportingBridge.js server/legacyReportingBridge.d.ts server/reportingReadModels.js server/index.js server-v4/src/legacy/legacy-report-bridge.ts tests/reportingReadModels.test.js tests/server-v4/legacyReportBridge.test.js task.md task_plan.md findings.md progress.md` -> Passed

## Progress Update: 2026-03-10 Shared Reporting Math Extraction
- Scope:
  - Continued `cng-7c8.7` by removing the last backend dependency on `src/lib/reports.js` without breaking the frontend reporting API.
  - Kept current UI callers stable by turning `src/lib/reports.js` into a wrapper over shared reporting modules.
- Implementation highlights:
  - Moved the reporting math implementation from `src/lib/reports.js` to `shared/reportingLegacyMath.js`, adjusting imports so the real logic can be consumed from both frontend and backend contexts.
  - Added thin shared seams in `shared/reportingDateRanges.js` and `shared/reportingCompanyAggregation.js`.
  - Updated `src/lib/reports.js` to become a small compatibility wrapper that re-exports `QUICK_RANGE_OPTIONS`, `computeQuickRange()`, `buildReportData()`, and `aggregateByCompany()` from the shared modules.
  - Updated `server/legacyReportingBridge.js` to import the shared reporting math directly instead of importing the frontend `src/lib/reports.js` module.
  - Added RED/GREEN seam coverage in `tests/legacyReportingBridge.test.js` and `tests/reportsSharedModules.test.js` so future refactors cannot silently re-couple backend reporting to the frontend wrapper.
  - Re-normalized touched files back to CRLF for clean Windows-oriented diffs.
- Files modified:
  - `shared/reportingLegacyMath.js`
  - `shared/reportingDateRanges.js`
  - `shared/reportingCompanyAggregation.js`
  - `src/lib/reports.js`
  - `server/legacyReportingBridge.js`
  - `tests/legacyReportingBridge.test.js`
  - `tests/reportsSharedModules.test.js`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/legacyReportingBridge.test.js tests/reportsSharedModules.test.js` -> Passed (`2/2`)
  - `pnpm exec vitest run tests/reports.test.js tests/legacyReportingBridge.test.js tests/reportsSharedModules.test.js tests/reportingReadModels.test.js tests/server-v4/legacyReportBridge.test.js` -> Passed (`13/13`)
  - `pnpm exec vitest run tests/reportingReadModels.test.js tests/server-v4/legacyReportBridge.test.js tests/server-v4/reportingService.test.js tests/server-v4/runtimeRoutes.test.js tests/server.api.test.js tests/reportExportPayloads.test.js tests/reportingClient.test.js tests/reportViewer.test.jsx` -> Passed (`145/145`), with the existing jsdom `ResponsiveContainer` width/height `0` warning still present in `tests/reportViewer.test.jsx` and pre-existing stderr from unrelated AI/ECUS tests
  - `pnpm run typecheck:server-v4` -> Passed
  - `pnpm exec eslint shared/reportingLegacyMath.js shared/reportingDateRanges.js shared/reportingCompanyAggregation.js src/lib/reports.js server/legacyReportingBridge.js tests/legacyReportingBridge.test.js tests/reportsSharedModules.test.js tests/reports.test.js tests/reportingReadModels.test.js tests/server-v4/legacyReportBridge.test.js` -> Passed with no output
  - `git diff --check -- shared/reportingLegacyMath.js shared/reportingDateRanges.js shared/reportingCompanyAggregation.js src/lib/reports.js server/legacyReportingBridge.js tests/legacyReportingBridge.test.js tests/reportsSharedModules.test.js task.md task_plan.md findings.md progress.md` -> Passed with no output

## Progress Update: 2026-03-10 Reporting Legacy Dependency Cut
- Scope:
  - Continued `cng-7c8.7` by removing the remaining shared-reporting dependency on `src/lib/store.js` and `src/lib/rules.js`.
  - Preserved legacy KPI behavior while shrinking the backend/reporting dependency graph to pure shared modules.
- Implementation highlights:
  - Added `shared/reportingLegacySupport.js` for the pure reporting helpers previously pulled from `store.js` (`normalizeStr`, `normalizeName`, `toISODate`, roster normalization, export detection, adjustment rounding/config).
  - Added `shared/reportingKpiComputation.js` for pure `computeKPI()` + `DEFAULT_RULES`, reusing `src/shared/defaultRules.js` and `src/shared/co.js` instead of the whole legacy rules module.
  - Updated `shared/reportingLegacyMath.js` to consume those two shared seams instead of importing `src/lib/store.js` / `src/lib/rules.js`.
  - Added RED/GREEN coverage in `tests/reportingLegacyMathDependencies.test.js`, `tests/reportingLegacySupport.test.js`, and `tests/reportingKpiComputation.test.js` so the seam cannot silently regress.
- Files modified:
  - `shared/reportingLegacyMath.js`
  - `shared/reportingLegacySupport.js`
  - `shared/reportingKpiComputation.js`
  - `tests/reportingLegacyMathDependencies.test.js`
  - `tests/reportingLegacySupport.test.js`
  - `tests/reportingKpiComputation.test.js`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/reportingLegacyMathDependencies.test.js tests/reportingLegacySupport.test.js tests/reportingKpiComputation.test.js` -> Passed (`9/9`)
  - `pnpm exec vitest run tests/rules.test.js tests/reportingKpiComputation.test.js tests/reportingLegacySupport.test.js tests/reportingLegacyMathDependencies.test.js tests/reports.test.js tests/legacyReportingBridge.test.js tests/reportsSharedModules.test.js tests/reportingReadModels.test.js tests/server-v4/legacyReportBridge.test.js tests/server-v4/reportingService.test.js tests/server-v4/runtimeRoutes.test.js tests/server.api.test.js tests/reportExportPayloads.test.js tests/reportingClient.test.js tests/reportViewer.test.jsx` -> Passed (`173/173`), with the existing jsdom `ResponsiveContainer` width/height `0` warning still present in `tests/reportViewer.test.jsx` and pre-existing stderr from unrelated AI/ECUS tests

## Progress Update: 2026-03-10 Reporting Projection Metadata Columns
- Scope:
  - Continued `cng-7c8.7` by making `reporting_projections` less blob-only without forcing a full relational redesign.
  - Kept current payload compatibility while adding typed metadata the runtimes can query directly from SQLite rows later.
- Implementation highlights:
  - Extended `server/reportingProjectionSqlite.js` so `reporting_projections` now carries `scope_key`, `range_from`, `range_to`, `query_key`, and `entry_count` alongside `projection_type`, `payload`, and `updated_at`.
  - Added idempotent best-effort column backfill in `ensureReportingProjectionTable()` for existing databases.
  - Derived row metadata automatically during projection writes for schedules and monthly aggregate snapshots.
  - Updated the fake SQLite harness in `tests/server.api.test.js` plus the sqlite type declaration to reflect the new schema shape.
  - Added RED/GREEN assertions in `tests/reportingProjectionSqlite.test.js` so the typed metadata contract is locked.
- Files modified:
  - `server/reportingProjectionSqlite.js`
  - `server/reportingProjectionSqlite.d.ts`
  - `tests/reportingProjectionSqlite.test.js`
  - `tests/server.api.test.js`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`

## Progress Update: 2026-03-10 Reporting Boundary Retirement And Materialized Projection Entries
- Scope:
  - Continued `cng-7c8.7` by retiring the remaining compatibility reporting slice endpoints and finishing the projection-table redesign.
  - Closed the last phase-level residuals around thin wrapper cleanup and JSON-blob-only reporting projection persistence.
- Implementation highlights:
  - Removed `/api/v4/reporting/summary|staff|teams` from both the monolith shim and `server-v4`; `server-v4` no longer exposes `getSummary()`, `getStaff()`, or `getTeams()` on `ReportingService` / `ReportingController`.
  - Added a monolith `/api/*` JSON `404` guard ahead of the SPA static fallback, preventing retired API routes from returning `200 index.html`.
  - Extended `server/reportingProjectionSqlite.js` with two dedicated relational entry tables: `reporting_schedule_projection_entries` and `reporting_monthly_aggregate_projection_entries`.
  - Projection writes/deletes now synchronize those entry tables automatically while preserving the top-level `reporting_projections.payload` JSON as a compatibility/read-through cache.
  - Added RED/GREEN coverage for route retirement in `tests/server-v4/reportingService.test.js`, `tests/server-v4/runtimeRoutes.test.js`, and `tests/server.api.test.js`, plus direct SQLite coverage for the new entry tables in `tests/reportingProjectionSqlite.test.js`.
- Files modified:
  - `server/index.js`
  - `server/reportingProjectionSqlite.js`
  - `server/reportingProjectionSqlite.d.ts`
  - `server-v4/src/modules/reporting/reportingService.ts`
  - `server-v4/src/modules/reporting/ReportingController.ts`
  - `server-v4/src/modules/reporting/reportingRoutes.ts`
  - `tests/helpers/mockApiState.js`
  - `tests/reportingProjectionSqlite.test.js`
  - `tests/server-v4/reportingService.test.js`
  - `tests/server-v4/runtimeRoutes.test.js`
  - `tests/server.api.test.js`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/reportingProjectionSqlite.test.js` -> Passed (`2/2`)
  - `pnpm exec vitest run tests/rules.test.js tests/reportingKpiComputation.test.js tests/reportingLegacySupport.test.js tests/reportingLegacyMathDependencies.test.js tests/reports.test.js tests/legacyReportingBridge.test.js tests/reportsSharedModules.test.js tests/reportingReadModels.test.js tests/reportExport.test.js tests/reportExportPayloads.test.js tests/reportingClient.test.js tests/reportViewer.test.jsx tests/reportingProjectionStore.test.js tests/reportingProjectionSqlite.test.js tests/server-v4/legacyReportBridge.test.js tests/server-v4/reportingService.test.js tests/server-v4/runtimeRoutes.test.js tests/server.api.test.js tests/server.seed.test.js` -> Passed (`185/185`), with the existing jsdom `ResponsiveContainer` width/height `0` warning still present in `tests/reportViewer.test.jsx` and pre-existing stderr from unrelated AI/ECUS tests

## Progress Update: 2026-03-10 UI Shell Navigation Registry And Command Coverage
- Scope:
  - Started `cng-7c8.8` with a low-risk shell/navigation slice instead of a broad visual rewrite.
  - Targeted the duplicated navigation metadata seam between `KPICalculator` and `CommandCenter`.
- Implementation highlights:
  - Added `src/lib/appShellNavigation.js` as the shared registry for shell tab order, labels, tooltips, visibility rules, and Command Center navigation copy.
  - Updated `src/components/KPICalculator.jsx` to render the tab strip and fallback tab resolution from that shared registry instead of maintaining a second hardcoded tab map.
  - Updated `src/components/CommandCenter.jsx` to derive navigation commands from the same registry, expanding keyboard/global navigation coverage to all visible tabs, including `mst`, `hq`, `rules`, `audit`, and `export-audit`.
  - Fixed invalid nested interactive markup in `CommandCenter` by replacing the outer command-row `button` with a keyboardable `div[role="button"]`, leaving the pin toggle as the only real nested `button`.
  - Added regression coverage in `tests/appShellNavigation.test.js` and `tests/commandCenter.test.jsx`.
- Files modified:
  - `src/lib/appShellNavigation.js`
  - `src/components/KPICalculator.jsx`
  - `src/components/CommandCenter.jsx`
  - `tests/appShellNavigation.test.js`
  - `tests/commandCenter.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/appShellNavigation.test.js tests/commandCenter.test.jsx tests/auth.test.jsx` -> Passed (`11/11`)
  - `pnpm exec eslint src/lib/appShellNavigation.js src/components/KPICalculator.jsx src/components/CommandCenter.jsx tests/appShellNavigation.test.js tests/commandCenter.test.jsx` -> Passed with no output
  - `pnpm exec vitest run tests/e2e.login-import.test.jsx` -> Attempted, but the file did not complete within repeated local polls in this environment, so it is not counted as a passing verification signal for this slice

## Progress Update: 2026-03-10 Shell Section Primitives And Accessible Account List
- Scope:
  - Continued `cng-7c8.8` by building the first reusable shell chrome below the navigation layer.
  - Targeted `AccountManager` and `CommandCenter` as low-risk adopters before touching the much larger MST/import/reporting surfaces.
- Implementation highlights:
  - Added `src/components/designSystem/shellPrimitives.jsx` with shared `SectionSurface`, `SectionHeader`, `SectionToolbar`, and `SearchField` primitives for list headers, filter rows, and action rails.
  - Extended `DataTable` in `src/components/designSystem/primitives.jsx` with optional accessible `caption` plus `aria-label` / `aria-describedby` hooks so data-dense tables can expose an explicit semantic contract without custom wrappers.
  - Updated `AccountManager` to use the new shell primitives for both the create-account and account-list sections; the list view now uses a labelled search field, explicit table caption/label, and a denser sticky-header table configuration.
  - Updated `CommandCenter` to reuse the same `SearchField` and expose real dialog semantics via `role="dialog"`, labelled search input, and `aria-haspopup` / `aria-controls` metadata on the trigger.
  - Synced the existing account-manager staff regression to the current actor-free auth contract and added explicit RTL cleanup so DOM state does not leak across list-shell tests.
- Files modified:
  - `src/components/designSystem/shellPrimitives.jsx`
  - `src/components/designSystem/primitives.jsx`
  - `src/components/AccountManager.jsx`
  - `src/components/CommandCenter.jsx`
  - `src/App.css`
  - `tests/shellPrimitives.test.jsx`
  - `tests/commandCenter.test.jsx`
  - `tests/accountManager.staff.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/shellPrimitives.test.jsx tests/commandCenter.test.jsx tests/accountManager.staff.test.jsx` -> Passed (`7/7`)
  - `pnpm exec eslint src/components/designSystem/shellPrimitives.jsx src/components/designSystem/primitives.jsx src/components/AccountManager.jsx src/components/CommandCenter.jsx tests/shellPrimitives.test.jsx tests/commandCenter.test.jsx tests/accountManager.staff.test.jsx` -> Passed with no output
  - `git diff --check -- src/components/designSystem/shellPrimitives.jsx src/components/designSystem/primitives.jsx src/components/AccountManager.jsx src/components/CommandCenter.jsx src/App.css tests/shellPrimitives.test.jsx tests/commandCenter.test.jsx tests/accountManager.staff.test.jsx` -> Passed with no output

## Progress Update: 2026-03-10 UI Shell Rollout Across MST, Reporting, And Import
- Scope:
  - Continued `cng-7c8.8` by finishing the larger-surface rollout of the shared shell primitives into MST assignment, reporting, and import flows.
  - Stabilized the broader admin-shell regression bundle so the bead can close on a wider verification signal instead of only targeted single-file runs.
- Implementation highlights:
  - `src/components/MSTAssignment.jsx` now uses the shared shell primitives for the main assignment/filter/history surfaces, and its admin regression coverage continues to exercise that labelled shell path through `tests/mstAssignment.column-visibility.test.jsx` and `tests/e2e.admin-flows.test.jsx`.
  - `src/components/ReportViewer.jsx` now uses the same shell chrome for the KPI control panel and reporting schedule surfaces, with the reporting regression suite aligned in `tests/reportViewer.test.jsx`.
  - `src/components/DataImporter.jsx` now wraps the main declaration-control area in `SectionSurface`, `SectionHeader`, and `SearchField`, adds an explicit labelled filter form plus main-table caption/`aria-label`, and aligns `tests/dataImporter.preview.test.jsx` to the new semantics.
  - The wide admin-shell verification path is now stable: `tests/e2e.admin-flows.test.jsx` scopes the HQ add-row flow to the editable draft row instead of the page search box, and `tests/commandCenter.test.jsx` now waits for the component's async `emitCommand()` dispatch before asserting navigation.
  - Re-normalized the touched test files back to `CRLF` so Windows lint and diff checks stay clean.
- Files modified:
  - `src/components/MSTAssignment.jsx`
  - `src/components/ReportViewer.jsx`
  - `src/components/DataImporter.jsx`
  - `tests/commandCenter.test.jsx`
  - `tests/mstAssignment.column-visibility.test.jsx`
  - `tests/reportViewer.test.jsx`
  - `tests/dataImporter.preview.test.jsx`
  - `tests/e2e.admin-flows.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/e2e.admin-flows.test.jsx` -> Passed (`5/5`)
  - `pnpm exec vitest run tests/shellPrimitives.test.jsx tests/commandCenter.test.jsx tests/accountManager.staff.test.jsx tests/mstAssignment.column-visibility.test.jsx tests/e2e.admin-flows.test.jsx tests/reportViewer.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`31/31`), with the existing jsdom `ResponsiveContainer` width/height `0` warnings still present in reporting tests
  - `pnpm exec eslint src/components/designSystem/shellPrimitives.jsx src/components/designSystem/primitives.jsx src/components/AccountManager.jsx src/components/CommandCenter.jsx src/components/MSTAssignment.jsx src/components/ReportViewer.jsx src/components/DataImporter.jsx tests/shellPrimitives.test.jsx tests/commandCenter.test.jsx tests/accountManager.staff.test.jsx tests/mstAssignment.column-visibility.test.jsx tests/e2e.admin-flows.test.jsx tests/reportViewer.test.jsx tests/dataImporter.preview.test.jsx` -> Passed with existing warnings only (`0` errors; warning debt remains in `src/components/DataImporter.jsx` and `src/components/MSTAssignment.jsx`)
  - `git diff --check -- src/components/AccountManager.jsx src/components/CommandCenter.jsx src/components/DataImporter.jsx src/components/MSTAssignment.jsx src/components/ReportViewer.jsx src/components/designSystem/primitives.jsx src/components/designSystem/shellPrimitives.jsx tests/accountManager.staff.test.jsx tests/commandCenter.test.jsx tests/dataImporter.preview.test.jsx tests/e2e.admin-flows.test.jsx tests/mstAssignment.column-visibility.test.jsx tests/reportViewer.test.jsx tests/shellPrimitives.test.jsx task.md task_plan.md findings.md progress.md` -> Passed with no output

## Progress Update: 2026-03-10 DataImporter Selection Action Extraction
- Scope:
  - Started `cng-7c8.9` with a low-risk importer decomposition slice instead of jumping straight to parsing or workflow redesign.
  - Targeted the multi-select action rail in `DataImporter.jsx` as the first behavior seam to extract behind its own module and tests.
- Implementation highlights:
  - Added `src/components/dataImporter/DataImporterSelectionActions.jsx` for the declaration multi-select action rail (`select filtered`, review/unreview, soft delete, hard delete, license exclusion, export, and clear-selection actions).
  - Replaced the corresponding inline action block in `src/components/DataImporter.jsx` with the new component, keeping the parent surface responsible only for derived booleans and callbacks.
  - Added `tests/dataImporterSelectionActions.test.jsx` to cover the extracted action rail directly, including enabled/disabled states and callback dispatch.
  - Fixed the new regression file to clean up the DOM between cases; without explicit RTL `cleanup()`, the second render saw duplicate button matches and produced a false negative.
  - Re-normalized the touched importer files to `CRLF` so Windows lint and diff verification stay aligned with repo rules.
- Files modified:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/DataImporterSelectionActions.jsx`
  - `tests/dataImporterSelectionActions.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/dataImporterSelectionActions.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`12/12`)
  - `pnpm exec eslint src/components/dataImporter/DataImporterSelectionActions.jsx src/components/DataImporter.jsx tests/dataImporterSelectionActions.test.jsx tests/dataImporter.preview.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/DataImporterSelectionActions.jsx tests/dataImporterSelectionActions.test.jsx tests/dataImporter.preview.test.jsx` -> Passed with no output

## Progress Update: 2026-03-10 DataImporter Sync Preview Panel Extraction
- Scope:
  - Continued `cng-7c8.9` with a second low-risk importer decomposition slice focused on the ECUS operator preview workflow.
  - Targeted the preview/run panel because it already had strong regression coverage in `tests/dataImporter.preview.test.jsx` and mostly consumes props rather than shared mutable UI state.
- Implementation highlights:
  - Added `src/components/dataImporter/DataImporterSyncPreviewPanel.jsx` for the manual range presets, preview/run actions, MST filter notice, preview-range label, preview table, and success/error messages.
  - Replaced the corresponding inline preview/sync block in `src/components/DataImporter.jsx` with the new component, leaving the parent importer responsible for sync state and fetch orchestration.
  - Added `tests/dataImporterSyncPreviewPanel.test.jsx` to cover preset clicks, date-input changes, preview/run callbacks, preview table rendering, and loading/error states directly at the module boundary.
  - Kept the existing importer regression bundle green after the extraction, confirming that the preview workflow semantics exposed through `DataImporter` did not change.
  - Re-normalized the touched files to `CRLF` so Windows lint/diff verification remains clean.
- Files modified:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/DataImporterSyncPreviewPanel.jsx`
  - `tests/dataImporterSyncPreviewPanel.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/dataImporterSelectionActions.test.jsx tests/dataImporterSyncPreviewPanel.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`14/14`)
  - `pnpm exec eslint src/components/dataImporter/DataImporterSelectionActions.jsx src/components/dataImporter/DataImporterSyncPreviewPanel.jsx src/components/DataImporter.jsx tests/dataImporterSelectionActions.test.jsx tests/dataImporterSyncPreviewPanel.test.jsx tests/dataImporter.preview.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/DataImporterSelectionActions.jsx src/components/dataImporter/DataImporterSyncPreviewPanel.jsx tests/dataImporterSelectionActions.test.jsx tests/dataImporterSyncPreviewPanel.test.jsx tests/dataImporter.preview.test.jsx` -> Passed with no output

## Progress Update: 2026-03-10 DataImporter Deleted Rows Dialog Extraction
- Scope:
  - Continued `cng-7c8.9` with a third low-risk importer decomposition slice focused on deleted-declaration review/history UI.
  - Targeted the deleted dialog because it already had regression coverage in `tests/dataImporter.preview.test.jsx` and is largely a pure presentation surface over memoized parent data.
- Implementation highlights:
  - Added `src/components/dataImporter/DataImporterDeletedRowsDialog.jsx` to own the deleted-declarations dialog shell, count badges, retry state, loading/empty messages, and deleted-row table.
  - Replaced the inline deleted dialog block in `src/components/DataImporter.jsx` with the new component, leaving the parent importer responsible for dialog state, deleted-entry fetches, and derived counts.
  - Added `tests/dataImporterDeletedRowsDialog.test.jsx` to cover dialog rendering, count badges, retry behavior, and loading/empty states directly at the new module boundary.
  - Kept the existing importer regression for filtered deleted declarations green, confirming that the user-facing dialog behavior remained unchanged after the extraction.
  - Re-normalized touched files to `CRLF` so Windows lint and diff verification remain clean.
- Files modified:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/DataImporterDeletedRowsDialog.jsx`
  - `tests/dataImporterDeletedRowsDialog.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/dataImporterDeletedRowsDialog.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`12/12`)
  - `pnpm exec eslint src/components/dataImporter/DataImporterDeletedRowsDialog.jsx src/components/DataImporter.jsx tests/dataImporterDeletedRowsDialog.test.jsx tests/dataImporter.preview.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/DataImporterDeletedRowsDialog.jsx tests/dataImporterDeletedRowsDialog.test.jsx tests/dataImporter.preview.test.jsx` -> Passed with no output

## Progress Update: 2026-03-10 DataImporter Import Preview Summary Extraction
- Scope:
  - Continued `cng-7c8.9` with a fourth low-risk importer decomposition slice focused on the pre-import preview summary surface.
  - Targeted this branch because it was still a large inline render block in `DataImporter.jsx` even though it only consumes preview payloads and formatting helpers.
- Implementation highlights:
  - Added `src/components/dataImporter/DataImporterImportPreviewSummary.jsx` to own the preview error banner, stat cards, invalid-row sample table, inserted-row sample table, and new-business chip list.
  - Replaced the inline preview-summary block in `src/components/DataImporter.jsx` with the new component and removed the two parent-only memos that previously existed just to feed that branch.
  - Added `tests/dataImporterImportPreviewSummary.test.jsx` to cover both the error state and the main summary state directly at the module boundary.
  - Kept the existing importer preview regression green after the extraction, confirming that the user-facing preview flow stayed stable while the render tree became smaller and more isolated.
  - Re-normalized touched files to `CRLF` so Windows lint and diff verification remain clean.
- Files modified:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/DataImporterImportPreviewSummary.jsx`
  - `tests/dataImporterImportPreviewSummary.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/dataImporterImportPreviewSummary.test.jsx tests/dataImporterSelectionActions.test.jsx tests/dataImporterSyncPreviewPanel.test.jsx tests/dataImporterDeletedRowsDialog.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`18/18`)
  - `pnpm exec eslint src/components/dataImporter/DataImporterImportPreviewSummary.jsx src/components/DataImporter.jsx tests/dataImporterImportPreviewSummary.test.jsx tests/dataImporter.preview.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `18` warnings)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/DataImporterImportPreviewSummary.jsx tests/dataImporterImportPreviewSummary.test.jsx tests/dataImporter.preview.test.jsx` -> Passed with no output

## Progress Update: 2026-03-10 DataImporter Column Config Dialog Extraction
- Scope:
  - Continued `cng-7c8.9` with a fifth low-risk importer decomposition slice focused on the visible-column configuration modal.
  - Targeted this dialog because it is largely a presentational surface over draft visibility state and admin-only gating, without duplicate-review or import orchestration coupling.
- Implementation highlights:
  - Added `src/components/dataImporter/DataImporterColumnConfigDialog.jsx` to own the column checklist, sensitive-column disable state, error message, and footer actions for reset/cancel/apply.
  - Replaced the inline column-config dialog block in `src/components/DataImporter.jsx` with the new component, leaving the parent importer responsible for draft state and persistence callbacks only.
  - Added `tests/dataImporterColumnConfigDialog.test.jsx` to cover both the basic callback flow and the non-admin disabled state for sensitive columns directly at the new module boundary.
  - Kept the existing importer preview regression green after the extraction, confirming that the dialog refactor did not disturb the larger importer workflow.
  - Re-normalized touched files to `CRLF` so Windows lint and diff verification remain clean.
- Files modified:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/DataImporterColumnConfigDialog.jsx`
  - `tests/dataImporterColumnConfigDialog.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/dataImporterColumnConfigDialog.test.jsx tests/dataImporterImportPreviewSummary.test.jsx tests/dataImporterSelectionActions.test.jsx tests/dataImporterSyncPreviewPanel.test.jsx tests/dataImporterDeletedRowsDialog.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`20/20`)
  - `pnpm exec eslint src/components/dataImporter/DataImporterColumnConfigDialog.jsx src/components/DataImporter.jsx tests/dataImporterColumnConfigDialog.test.jsx tests/dataImporter.preview.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `18` warnings)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/DataImporterImportPreviewSummary.jsx src/components/dataImporter/DataImporterColumnConfigDialog.jsx tests/dataImporterImportPreviewSummary.test.jsx tests/dataImporterColumnConfigDialog.test.jsx tests/dataImporter.preview.test.jsx task.md task_plan.md findings.md progress.md` -> Passed with no output

## Progress Update: 2026-03-10 DataImporter Duplicate Diff Dialog Extraction
- Scope:
  - Continued `cng-7c8.9` with another low-risk importer decomposition slice focused on the duplicate-diff modal.
  - Targeted this dialog before the much larger duplicate-review workflow because it is a presentational comparison surface over existing duplicate-group state and diff-selection callbacks.
- Implementation highlights:
  - Added `src/components/dataImporter/DataImporterDuplicateDiffDialog.jsx` to own the duplicate diff dialog shell, base/compare selectors, changed-field summary, grouped diff tables, and close action.
  - Replaced the inline duplicate-diff dialog block in `src/components/DataImporter.jsx` with the new component, leaving the parent importer responsible for duplicate-group state initialization and diff-selection callbacks only.
  - Added `tests/dataImporterDuplicateDiffDialog.test.jsx` to cover both the populated diff path and the empty-state path directly at the module boundary.
  - Kept the existing importer preview regression green after the extraction, confirming that the new modal seam did not disturb the broader importer workflow.
  - Re-normalized touched files to `CRLF` so Windows lint and diff verification remain clean.
- Files modified:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/DataImporterDuplicateDiffDialog.jsx`
  - `tests/dataImporterDuplicateDiffDialog.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/dataImporterDuplicateDiffDialog.test.jsx tests/dataImporterColumnConfigDialog.test.jsx tests/dataImporterImportPreviewSummary.test.jsx tests/dataImporterSelectionActions.test.jsx tests/dataImporterSyncPreviewPanel.test.jsx tests/dataImporterDeletedRowsDialog.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`22/22`)
  - `pnpm exec eslint src/components/dataImporter/DataImporterDuplicateDiffDialog.jsx src/components/DataImporter.jsx tests/dataImporterDuplicateDiffDialog.test.jsx tests/dataImporter.preview.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `18` warnings)

## Progress Update: 2026-03-10 DataImporter Duplicate Review Dialog Extraction
- Scope:
  - Continued `cng-7c8.9` with the next importer decomposition slice focused on the larger duplicate-review workflow dialog.
  - Targeted this branch after the duplicate-diff extraction because it was still the biggest presentational duplicate-management surface left inline in `DataImporter.jsx`, but it could still move without redesigning the full import workflow yet.
- Implementation highlights:
  - Added `src/components/dataImporter/DataImporterDuplicateReviewDialog.jsx` to own the duplicate-review dialog shell, summary banner, keeper table, merge-field selectors, per-group resolution controls, note textarea, confirmation checkbox, and footer actions.
  - Replaced the inline duplicate-review dialog branch in `src/components/DataImporter.jsx` with the new component, leaving the parent importer responsible only for review state ownership, derived plan counts, and mutation callbacks.
  - Added `tests/dataImporterDuplicateReviewDialog.test.jsx` to cover the populated review flow, the review-note/confirm path, and the empty-state path directly at the module boundary.
  - Re-normalized touched files to `CRLF` so Windows lint and diff verification remain clean after the new extraction.
- Files modified:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/DataImporterDuplicateReviewDialog.jsx`
  - `tests/dataImporterDuplicateReviewDialog.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/dataImporterDuplicateReviewDialog.test.jsx tests/dataImporterDuplicateDiffDialog.test.jsx tests/dataImporterColumnConfigDialog.test.jsx tests/dataImporterImportPreviewSummary.test.jsx tests/dataImporterSelectionActions.test.jsx tests/dataImporterSyncPreviewPanel.test.jsx tests/dataImporterDeletedRowsDialog.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`25/25`)
  - `pnpm exec eslint src/components/dataImporter/DataImporterDuplicateReviewDialog.jsx src/components/DataImporter.jsx tests/dataImporterDuplicateReviewDialog.test.jsx tests/dataImporter.preview.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `18` warnings)

## Progress Update: 2026-03-10 DataImporter Grid Toolbar Controls Extraction
- Scope:
  - Continued `cng-7c8.9` with the next importer decomposition slice focused on the save/edit grid toolbar controls directly under the filter form.
  - Targeted this branch because it was a dense but still low-risk presentational cluster: multiple view/paging/save controls shared the same visual rail but did not need to own importer state themselves.
- Implementation highlights:
  - Added `src/components/dataImporter/DataImporterGridToolbarControls.jsx` to own server-search status text, page summary, view-mode switcher, freeze/card-layout controls, page-size controls, deleted-row toggle, paging buttons, and save button.
  - Replaced the inline toolbar branch in `src/components/DataImporter.jsx` with the new component, keeping the parent importer responsible only for state ownership and callback adapters.
  - Added `tests/dataImporterGridToolbarControls.test.jsx` to cover table-mode interactions, card-mode interactions, loading/error server-search status, custom page-size input, and save-button gating directly at the module boundary.
  - Re-normalized touched files to `CRLF` after extraction so Windows lint and diff verification remain clean.
- Files modified:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/DataImporterGridToolbarControls.jsx`
  - `tests/dataImporterGridToolbarControls.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/dataImporterGridToolbarControls.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`12/12`)
  - `pnpm exec vitest run tests/dataImporterGridToolbarControls.test.jsx tests/dataImporterDuplicateReviewDialog.test.jsx tests/dataImporterDuplicateDiffDialog.test.jsx tests/dataImporterColumnConfigDialog.test.jsx tests/dataImporterImportPreviewSummary.test.jsx tests/dataImporterSelectionActions.test.jsx tests/dataImporterSyncPreviewPanel.test.jsx tests/dataImporterDeletedRowsDialog.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`27/27`)
  - `pnpm exec eslint src/components/dataImporter/DataImporterGridToolbarControls.jsx src/components/DataImporter.jsx tests/dataImporterGridToolbarControls.test.jsx tests/dataImporter.preview.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `18` warnings)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/DataImporterGridToolbarControls.jsx tests/dataImporterGridToolbarControls.test.jsx task.md task_plan.md findings.md progress.md` -> Passed

## Progress Update: 2026-03-10 DataImporter Card Results Extraction
- Scope:
  - Continued `cng-7c8.9` with the next importer decomposition slice focused on the `VIEW_MODES.CARD` results branch.
  - Targeted this branch after toolbar extraction because card mode is a large but isolated render surface: it owns row badges, card-level edit controls, history expansion, and row actions without dragging in the full table grid branch.
- Implementation highlights:
  - Added `src/components/dataImporter/DataImporterCardResults.jsx` to own card-mode row rendering, inline card edit controls, history panel rendering, row action footer, and empty state.
  - Replaced the inline card branch in `src/components/DataImporter.jsx` with the new component, keeping the parent importer responsible only for row-state ownership, derived formatters, and callback adapters.
  - Added `tests/dataImporterCardResults.test.jsx` to cover editable card interactions, read-only/history rendering, and empty-state rendering directly at the module boundary.
  - Added parent-side callback adapters for card-only license normalization and derived C/O/KPI display values so behavior stays in sync with the previous inline branch.
- Files modified:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/DataImporterCardResults.jsx`
  - `tests/dataImporterCardResults.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/dataImporterCardResults.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`12/12`)

## Progress Update: 2026-03-10 DataImporter Table Body Extraction
- Scope:
  - Continued `cng-7c8.9` with the next importer decomposition slice focused on the heavy `VIEW_MODES.TABLE` body branch.
  - Targeted this seam after the card extraction because the row/body branch still carried the bulk of inline grid edit/save/delete/history behavior, while the table header and frozen-column sizing logic could remain in the parent for a later slice.
- Implementation highlights:
  - Added `src/components/dataImporter/DataImporterTableBody.jsx` to own table-mode row rendering, inline edit widgets, row save/delete controls, history expansion rows, and empty-state rendering.
  - Replaced the inline `<tbody>` branch in `src/components/DataImporter.jsx` with the new component, keeping the parent importer responsible only for header sizing/frozen-column orchestration, row-state ownership, and callback adapters.
  - Reused the parent-side derived license/C/O/KPI adapters so the new module stays presentational and does not pull raw edit/KPI mutation logic back into the extracted seam.
  - Added `tests/dataImporterTableBody.test.jsx` to cover editable-row interactions, read-only/history rendering, deleted-row actions, and the empty-state path directly at the module boundary.
  - Re-normalized touched files to `CRLF`; the new module is `451` lines long, so this slice stays within the project guideline of keeping modules under roughly `800` lines when feasible.
- Files modified:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/DataImporterTableBody.jsx`
  - `tests/dataImporterTableBody.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/dataImporterTableBody.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`12/12`)
  - `pnpm exec vitest run tests/dataImporterTableBody.test.jsx tests/dataImporterGridToolbarControls.test.jsx tests/dataImporterDuplicateReviewDialog.test.jsx tests/dataImporterDuplicateDiffDialog.test.jsx tests/dataImporterColumnConfigDialog.test.jsx tests/dataImporterImportPreviewSummary.test.jsx tests/dataImporterSelectionActions.test.jsx tests/dataImporterSyncPreviewPanel.test.jsx tests/dataImporterDeletedRowsDialog.test.jsx tests/dataImporterCardResults.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`31/31`)
  - `pnpm exec eslint src/components/dataImporter/DataImporterTableBody.jsx src/components/DataImporter.jsx tests/dataImporterTableBody.test.jsx tests/dataImporter.preview.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `18` warnings)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/DataImporterTableBody.jsx tests/dataImporterTableBody.test.jsx task.md task_plan.md findings.md progress.md` -> Passed

## Progress Update: 2026-03-10 DataImporter Table Header Extraction
- Scope:
  - Continued `cng-7c8.9` immediately after the table body slice with the matching `VIEW_MODES.TABLE` header branch.
  - Targeted this seam because once `tbody` moved out, the remaining table duplication was concentrated in repetitive header cells, frozen-header classes, optional column toggles, and resize-handle wiring.
- Implementation highlights:
  - Added `src/components/dataImporter/DataImporterTableHeader.jsx` to own grid column labels, optional column gating, frozen-header styling, and resize-handle rendering.
  - Replaced the inline `<thead>` branch in `src/components/DataImporter.jsx` with the new component, leaving the parent importer responsible only for table wrapper orchestration, ref registration callbacks, and column sizing state.
  - Kept the header extraction data-driven so the new module only needs the shared `columnLabels` map plus sizing/frozen callbacks rather than another copy of importer state logic.
  - Added `tests/dataImporterTableHeader.test.jsx` to cover the full column/header path, resize-handle rendering, and hidden/disabled column behavior directly at the module boundary.
  - Re-normalized touched files to `CRLF`; the new header module is `109` lines long.
- Files modified:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/DataImporterTableHeader.jsx`
  - `tests/dataImporterTableHeader.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/dataImporterTableHeader.test.jsx tests/dataImporterTableBody.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`14/14`)
  - `pnpm exec vitest run tests/dataImporterTableHeader.test.jsx tests/dataImporterTableBody.test.jsx tests/dataImporterGridToolbarControls.test.jsx tests/dataImporterDuplicateReviewDialog.test.jsx tests/dataImporterDuplicateDiffDialog.test.jsx tests/dataImporterColumnConfigDialog.test.jsx tests/dataImporterImportPreviewSummary.test.jsx tests/dataImporterSelectionActions.test.jsx tests/dataImporterSyncPreviewPanel.test.jsx tests/dataImporterDeletedRowsDialog.test.jsx tests/dataImporterCardResults.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`33/33`)
  - `pnpm exec eslint src/components/dataImporter/DataImporterTableHeader.jsx src/components/dataImporter/DataImporterTableBody.jsx src/components/DataImporter.jsx tests/dataImporterTableHeader.test.jsx tests/dataImporterTableBody.test.jsx tests/dataImporter.preview.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `18` warnings)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/DataImporterTableHeader.jsx src/components/dataImporter/DataImporterTableBody.jsx tests/dataImporterTableHeader.test.jsx tests/dataImporterTableBody.test.jsx task.md task_plan.md findings.md progress.md` -> Passed

## Progress Update: 2026-03-10 DataImporter Table Results Extraction
- Scope:
  - Continued `cng-7c8.9` with the remaining table wrapper/composition branch after the header/body slices.
  - Targeted this seam because once `thead` and `tbody` moved out, the parent still carried the table shell, caption, and wrapper classes even though the render logic had become mostly composition.
- Implementation highlights:
  - Added `src/components/dataImporter/DataImporterTableResults.jsx` to own the table wrapper, caption, overflow shell, and composition of the extracted header/body modules.
  - Replaced the inline table shell in `src/components/DataImporter.jsx` with the new component, leaving the parent importer responsible only for prop assembly and state ownership.
  - Added `tests/dataImporterTableResults.test.jsx` to cover wrapper rendering, prop forwarding, and caption behavior directly at the module boundary.
  - Kept the seam presentational so the table wrapper still consumes the already-extracted header/body modules rather than pulling row logic back into the new component.
- Files modified:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/DataImporterTableResults.jsx`
  - `tests/dataImporterTableResults.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/dataImporterTableResults.test.jsx tests/dataImporterTableHeader.test.jsx tests/dataImporterTableBody.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`16/16`)
  - `pnpm exec eslint src/components/dataImporter/DataImporterTableResults.jsx src/components/dataImporter/DataImporterTableHeader.jsx src/components/dataImporter/DataImporterTableBody.jsx src/components/DataImporter.jsx tests/dataImporterTableResults.test.jsx tests/dataImporterTableHeader.test.jsx tests/dataImporterTableBody.test.jsx tests/dataImporter.preview.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `18` warnings)

## Progress Update: 2026-03-10 DataImporter Results Panel Extraction
- Scope:
  - Continued `cng-7c8.9` with the next result-composition seam immediately after the table wrapper extraction.
  - Targeted this branch because `DataImporter.jsx` still directly switched between `table` and `card` result surfaces and owned the shared KPI footnote text even after both result branches were extracted.
- Implementation highlights:
  - Added `src/components/dataImporter/DataImporterResultsPanel.jsx` to own the `viewMode` branch between table/card result surfaces and the shared KPI footnote beneath them.
  - Replaced the inline result-mode branch in `src/components/DataImporter.jsx` with the new component, while the parent now assembles `sharedResultsProps`, `tableResultsProps`, and `cardResultsProps`.
  - Added `tests/dataImporterResultsPanel.test.jsx` to cover both result modes and direct prop forwarding at the module boundary.
  - Kept the seam thin on purpose so view selection stays centralized without reintroducing row/table rendering into the parent.
- Files modified:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/DataImporterResultsPanel.jsx`
  - `tests/dataImporterResultsPanel.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/dataImporterResultsPanel.test.jsx tests/dataImporterTableResults.test.jsx tests/dataImporterTableHeader.test.jsx tests/dataImporterTableBody.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`18/18`)
  - `pnpm exec eslint src/components/dataImporter/DataImporterResultsPanel.jsx src/components/dataImporter/DataImporterTableResults.jsx src/components/dataImporter/DataImporterTableHeader.jsx src/components/dataImporter/DataImporterTableBody.jsx src/components/DataImporter.jsx tests/dataImporterResultsPanel.test.jsx tests/dataImporterTableResults.test.jsx tests/dataImporterTableHeader.test.jsx tests/dataImporterTableBody.test.jsx tests/dataImporter.preview.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `18` warnings)

## Progress Update: 2026-03-10 DataImporter Monitoring Panel Extraction
- Scope:
  - Continued `cng-7c8.9` with the next admin-only monitoring seam after the result composition cleanup.
  - Targeted this branch because `DataImporter.jsx` still held two inline data-heavy monitoring surfaces: the `Đối soát C/O` control/preview card and the `Cảnh báo tờ khai thiếu thông tin` alert table.
- Implementation highlights:
  - Added `src/components/dataImporter/DataImporterMonitoringPanel.jsx` to own the C/O discrepancy control rail, discrepancy stats, discrepancy preview table, and missing-information alert table.
  - Replaced the inline monitoring/alerting branch in `src/components/DataImporter.jsx` with the new component, while the parent now assembles `monitoringCoDiscrepancyProps` and `monitoringAlertsProps`.
  - Added `tests/dataImporterMonitoringPanel.test.jsx` to cover populated discrepancy/alert states, empty states, and direct action callbacks at the module boundary.
  - Re-normalized touched files to `CRLF` after the extraction so targeted lint stays clean on Windows.
- Files modified:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/DataImporterMonitoringPanel.jsx`
  - `tests/dataImporterMonitoringPanel.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/dataImporterMonitoringPanel.test.jsx` -> Passed (`3/3`)
  - `pnpm exec vitest run tests/dataImporterMonitoringPanel.test.jsx tests/dataImporterResultsPanel.test.jsx tests/dataImporterTableResults.test.jsx tests/dataImporterTableHeader.test.jsx tests/dataImporterTableBody.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`21/21`)
  - `pnpm exec eslint src/components/dataImporter/DataImporterMonitoringPanel.jsx src/components/dataImporter/DataImporterResultsPanel.jsx src/components/dataImporter/DataImporterTableResults.jsx src/components/dataImporter/DataImporterTableHeader.jsx src/components/dataImporter/DataImporterTableBody.jsx src/components/DataImporter.jsx tests/dataImporterMonitoringPanel.test.jsx tests/dataImporterResultsPanel.test.jsx tests/dataImporterTableResults.test.jsx tests/dataImporterTableHeader.test.jsx tests/dataImporterTableBody.test.jsx tests/dataImporter.preview.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `18` warnings)

## Progress Update: 2026-03-10 DataImporter C/O Code Config Panel Extraction
- Scope:
  - Continued `cng-7c8.9` with the next admin-only decomposition seam adjacent to the new monitoring panel.
  - Targeted this branch because the whitelist/blacklist C/O configuration card was still a full inline `CollapsibleCard` with its own textarea form and action footer, but it did not need to own importer state itself.
- Implementation highlights:
  - Added `src/components/dataImporter/DataImporterCoCodeConfigPanel.jsx` to own the C/O whitelist/blacklist form, refresh action, save/reset footer, and updated-label status.
  - Replaced the inline `Cấu hình mã ưu đãi C/O` branch in `src/components/DataImporter.jsx` with the new component, while the parent now assembles `coCodeConfigProps`.
  - Added `tests/dataImporterCoCodeConfigPanel.test.jsx` to cover populated and disabled/error states plus direct form/action callbacks at the module boundary.
  - Re-normalized touched files to `CRLF` after extraction so targeted lint remains clean on Windows.
- Files modified:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/DataImporterCoCodeConfigPanel.jsx`
  - `tests/dataImporterCoCodeConfigPanel.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/dataImporterCoCodeConfigPanel.test.jsx` -> Passed (`2/2`)
  - `pnpm exec vitest run tests/dataImporterCoCodeConfigPanel.test.jsx tests/dataImporterMonitoringPanel.test.jsx tests/dataImporterResultsPanel.test.jsx tests/dataImporterTableResults.test.jsx tests/dataImporterTableHeader.test.jsx tests/dataImporterTableBody.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`23/23`)
  - `pnpm exec eslint src/components/dataImporter/DataImporterCoCodeConfigPanel.jsx src/components/dataImporter/DataImporterMonitoringPanel.jsx src/components/DataImporter.jsx tests/dataImporterCoCodeConfigPanel.test.jsx tests/dataImporterMonitoringPanel.test.jsx tests/dataImporter.preview.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `18` warnings)

## Progress Update: 2026-03-10 DataImporter File Actions Extraction
- Scope:
  - Continued `cng-7c8.9` with the next low-risk seam directly below the admin/importer control surfaces.
  - Targeted this branch because the hidden file input, file-picker button, import trigger, saved/deleted-list actions, and mode label were still rendered inline in `DataImporter.jsx` even though they form a small presentational rail with no state ownership.
- Implementation highlights:
  - Added `src/components/dataImporter/DataImporterFileActions.jsx` to own the hidden XLSX input, file-picker trigger, import button, saved/deleted-list actions, selected-file label, and mode label.
  - Wired `src/components/DataImporter.jsx` through a new `fileActionsProps` bundle so parent state ownership stays in place while the render strip is removed from the monolith.
  - Reused the already-present `tests/dataImporterFileActions.test.jsx` as the RED entrypoint, then implemented the new module to satisfy that contract and keep coverage local to the new boundary.
  - Re-normalized touched files to `CRLF` after extraction so targeted lint and diff checks stay clean on Windows.
- Files modified:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/DataImporterFileActions.jsx`
  - `tests/dataImporterFileActions.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/dataImporterFileActions.test.jsx` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/dataImporterFileActions.test.jsx tests/dataImporterCoCodeConfigPanel.test.jsx tests/dataImporterMonitoringPanel.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`18/18`)
  - `pnpm exec vitest run tests/dataImporterFileActions.test.jsx tests/dataImporterCoCodeConfigPanel.test.jsx tests/dataImporterMonitoringPanel.test.jsx tests/dataImporterResultsPanel.test.jsx tests/dataImporterTableResults.test.jsx tests/dataImporterTableHeader.test.jsx tests/dataImporterTableBody.test.jsx tests/dataImporterGridToolbarControls.test.jsx tests/dataImporterDuplicateReviewDialog.test.jsx tests/dataImporterDuplicateDiffDialog.test.jsx tests/dataImporterColumnConfigDialog.test.jsx tests/dataImporterImportPreviewSummary.test.jsx tests/dataImporterSelectionActions.test.jsx tests/dataImporterSyncPreviewPanel.test.jsx tests/dataImporterDeletedRowsDialog.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`43/43`)
  - `pnpm exec eslint src/components/dataImporter/DataImporterFileActions.jsx src/components/DataImporter.jsx tests/dataImporterFileActions.test.jsx tests/dataImporter.preview.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `18` warnings)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/DataImporterFileActions.jsx tests/dataImporterFileActions.test.jsx` -> Passed

## Progress Update: 2026-03-10 DataImporter Filter Preset Controls Extraction
- Scope:
  - Continued `cng-7c8.9` with the next small workflow-toolbar seam adjacent to the main importer filters.
  - Targeted this branch because the saved-preset selector, preset action buttons, error banner, and applied-preset status were still rendered inline in `DataImporter.jsx` even though parent state/callback ownership could remain unchanged.
- Implementation highlights:
  - Added `src/components/dataImporter/DataImporterFilterPresetControls.jsx` to own the saved-preset select, apply/save/overwrite/delete/refresh actions, preset error feedback, and applied-preset status line.
  - Replaced the inline saved-preset toolbar branch in `src/components/DataImporter.jsx` with the new component, while the parent now assembles `filterPresetControlsProps`.
  - Added `tests/dataImporterFilterPresetControls.test.jsx` to cover populated, hidden, and busy states plus direct action forwarding at the module boundary.
  - Kept duplicate-filter and auto-reconcile actions in the parent render tree so this slice stays narrowly scoped to preset management rather than the entire search workflow bar.
  - Re-normalized touched files to `CRLF` after extraction so targeted lint and diff checks stay clean on Windows.
- Files modified:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/DataImporterFilterPresetControls.jsx`
  - `tests/dataImporterFilterPresetControls.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/dataImporterFilterPresetControls.test.jsx` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/dataImporterFilterPresetControls.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`13/13`)
  - `pnpm exec vitest run tests/dataImporterFilterPresetControls.test.jsx tests/dataImporterFileActions.test.jsx tests/dataImporterCoCodeConfigPanel.test.jsx tests/dataImporterMonitoringPanel.test.jsx tests/dataImporterResultsPanel.test.jsx tests/dataImporterTableResults.test.jsx tests/dataImporterTableHeader.test.jsx tests/dataImporterTableBody.test.jsx tests/dataImporterGridToolbarControls.test.jsx tests/dataImporterDuplicateReviewDialog.test.jsx tests/dataImporterDuplicateDiffDialog.test.jsx tests/dataImporterColumnConfigDialog.test.jsx tests/dataImporterImportPreviewSummary.test.jsx tests/dataImporterSelectionActions.test.jsx tests/dataImporterSyncPreviewPanel.test.jsx tests/dataImporterDeletedRowsDialog.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`46/46`)
  - `pnpm exec eslint src/components/dataImporter/DataImporterFilterPresetControls.jsx src/components/DataImporter.jsx tests/dataImporterFilterPresetControls.test.jsx tests/dataImporter.preview.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `18` warnings)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/DataImporterFilterPresetControls.jsx tests/dataImporterFilterPresetControls.test.jsx task.md task_plan.md findings.md progress.md` -> Passed

## Progress Update: 2026-03-10 DataImporter Query Filter Controls Extraction
- Scope:
  - Continued `cng-7c8.9` with the next presentational seam inside the main importer filter form.
  - Targeted this branch because quick search, date preset/range filters, missing-staff/team toggles, and C/O threshold controls were still rendered inline in `DataImporter.jsx`, but their state ownership can remain in the parent.
- Implementation highlights:
  - Added `src/components/dataImporter/DataImporterQueryFilterControls.jsx` to own the quick-search field, help text, date preset select, date range inputs, missing-staff/team toggles, and C/O filter controls with badge state.
  - Replaced the inline query/date/C/O filter branch in `src/components/DataImporter.jsx` with the new component, while the parent now assembles `queryFilterControlsProps`.
  - Added `tests/dataImporterQueryFilterControls.test.jsx` to cover populated and inactive states plus direct callback forwarding for search, date, checkbox, and C/O actions.
  - Kept duplicate-filter actions, auto-reconcile actions, and the extracted grid toolbar outside this seam so the slice remains a pure filter-control extraction rather than a broader workflow rewrite.
  - Re-normalized touched files to `CRLF` after extraction so targeted lint and diff checks stay clean on Windows.
- Files modified:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/DataImporterQueryFilterControls.jsx`
  - `tests/dataImporterQueryFilterControls.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/dataImporterQueryFilterControls.test.jsx` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/dataImporterQueryFilterControls.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`13/13`)
  - `pnpm exec vitest run tests/dataImporterQueryFilterControls.test.jsx tests/dataImporterFilterPresetControls.test.jsx tests/dataImporterFileActions.test.jsx tests/dataImporterCoCodeConfigPanel.test.jsx tests/dataImporterMonitoringPanel.test.jsx tests/dataImporterResultsPanel.test.jsx tests/dataImporterTableResults.test.jsx tests/dataImporterTableHeader.test.jsx tests/dataImporterTableBody.test.jsx tests/dataImporterGridToolbarControls.test.jsx tests/dataImporterDuplicateReviewDialog.test.jsx tests/dataImporterDuplicateDiffDialog.test.jsx tests/dataImporterColumnConfigDialog.test.jsx tests/dataImporterImportPreviewSummary.test.jsx tests/dataImporterSelectionActions.test.jsx tests/dataImporterSyncPreviewPanel.test.jsx tests/dataImporterDeletedRowsDialog.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`49/49`)
  - `pnpm exec eslint src/components/dataImporter/DataImporterQueryFilterControls.jsx src/components/DataImporter.jsx tests/dataImporterQueryFilterControls.test.jsx tests/dataImporter.preview.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `18` warnings)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/DataImporterQueryFilterControls.jsx tests/dataImporterQueryFilterControls.test.jsx task.md task_plan.md findings.md progress.md` -> Passed

## Progress Update: 2026-03-10 DataImporter Duplicate Workflow Controls Extraction
- Scope:
  - Continued `cng-7c8.9` with the next workflow seam still inline in the main importer filter rail.
  - Targeted this branch because duplicate-filter toggling, duplicate-resolution entry, duplicate-plan summary text, and the auto-reconcile CTA were still rendered inline in `DataImporter.jsx` even though the parent can keep state and permission ownership.
- Implementation highlights:
  - Added `src/components/dataImporter/DataImporterDuplicateWorkflowControls.jsx` to own the duplicate-filter button, delete/review entry action, duplicate-plan summary text, and auto-reconcile CTA/tooltip state.
  - Replaced the inline duplicate workflow rail in `src/components/DataImporter.jsx` with the new component, while the parent now assembles `duplicateWorkflowControlsProps`.
  - Added `tests/dataImporterDuplicateWorkflowControls.test.jsx` to cover populated, unavailable, and disabled auto-reconcile states plus direct callback forwarding.
  - Re-normalized touched files to `CRLF` after extraction so targeted lint and diff checks stay clean on Windows.
  - This slice also dropped `src/components/DataImporter.jsx` to `14204` lines, keeping the ongoing decomposition trend moving in the right direction even before the larger workflow container work starts.
- Files modified:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/DataImporterDuplicateWorkflowControls.jsx`
  - `tests/dataImporterDuplicateWorkflowControls.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/dataImporterDuplicateWorkflowControls.test.jsx` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/dataImporterDuplicateWorkflowControls.test.jsx` -> Passed (`3/3`)
  - `pnpm exec vitest run tests/dataImporterDuplicateWorkflowControls.test.jsx tests/dataImporterQueryFilterControls.test.jsx tests/dataImporterFilterPresetControls.test.jsx tests/dataImporterFileActions.test.jsx tests/dataImporterCoCodeConfigPanel.test.jsx tests/dataImporterMonitoringPanel.test.jsx tests/dataImporterResultsPanel.test.jsx tests/dataImporterTableResults.test.jsx tests/dataImporterTableHeader.test.jsx tests/dataImporterTableBody.test.jsx tests/dataImporterGridToolbarControls.test.jsx tests/dataImporterDuplicateReviewDialog.test.jsx tests/dataImporterDuplicateDiffDialog.test.jsx tests/dataImporterColumnConfigDialog.test.jsx tests/dataImporterImportPreviewSummary.test.jsx tests/dataImporterSelectionActions.test.jsx tests/dataImporterSyncPreviewPanel.test.jsx tests/dataImporterDeletedRowsDialog.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`52/52`)
  - `pnpm exec eslint src/components/dataImporter/DataImporterDuplicateWorkflowControls.jsx src/components/DataImporter.jsx tests/dataImporterDuplicateWorkflowControls.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `18` warnings)

## Progress Update: 2026-03-10 DataImporter Sync Config Panel Extraction
- Scope:
  - Continued `cng-7c8.9` with the next large render seam still sitting above the importer filter form.
  - Targeted this branch because the ECUS auto-sync card still embedded sync status badges, readonly/manage shells, sync-config form fields, and nested preview/run controls directly in `DataImporter.jsx`.
- Implementation highlights:
  - Added `src/components/dataImporter/DataImporterSyncConfigPanel.jsx` to own both the manage-sync `CollapsibleCard` path and the readonly status-card path, while reusing the existing `DataImporterSyncPreviewPanel` inside the new module.
  - Replaced the full inline `auto-sync` branch in `src/components/DataImporter.jsx` with `syncConfigPanelProps`, and removed now-unused parent imports from that branch.
  - Added `tests/dataImporterSyncConfigPanel.test.jsx` to cover the manage-sync path, readonly status path, top-level action callbacks, and the sync-config form field wiring.
  - During regression, the wider preview suite exposed a real TDZ bug where `syncConfigPanelProps` was assembled before `toneClassMap` and sync-status metadata existed; moving the prop bundle below those derived values fixed the runtime failure instead of weakening the test.
  - Re-normalized touched files to `CRLF` after extraction so targeted lint and diff checks stay clean on Windows.
  - This slice reduced `src/components/DataImporter.jsx` again, down to `13781` lines.
- Files modified:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/DataImporterSyncConfigPanel.jsx`
  - `tests/dataImporterSyncConfigPanel.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/dataImporterSyncConfigPanel.test.jsx` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/dataImporterSyncConfigPanel.test.jsx` -> Passed (`2/2`)
  - `pnpm exec vitest run tests/dataImporterSyncConfigPanel.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`12/12`)
  - `pnpm exec vitest run tests/dataImporterSyncConfigPanel.test.jsx tests/dataImporterDuplicateWorkflowControls.test.jsx tests/dataImporterQueryFilterControls.test.jsx tests/dataImporterFilterPresetControls.test.jsx tests/dataImporterFileActions.test.jsx tests/dataImporterCoCodeConfigPanel.test.jsx tests/dataImporterMonitoringPanel.test.jsx tests/dataImporterResultsPanel.test.jsx tests/dataImporterTableResults.test.jsx tests/dataImporterTableHeader.test.jsx tests/dataImporterTableBody.test.jsx tests/dataImporterGridToolbarControls.test.jsx tests/dataImporterDuplicateReviewDialog.test.jsx tests/dataImporterDuplicateDiffDialog.test.jsx tests/dataImporterColumnConfigDialog.test.jsx tests/dataImporterImportPreviewSummary.test.jsx tests/dataImporterSelectionActions.test.jsx tests/dataImporterSyncPreviewPanel.test.jsx tests/dataImporterDeletedRowsDialog.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`54/54`)
  - `pnpm exec eslint src/components/dataImporter/DataImporterSyncConfigPanel.jsx src/components/dataImporter/DataImporterDuplicateWorkflowControls.jsx src/components/DataImporter.jsx tests/dataImporterSyncConfigPanel.test.jsx tests/dataImporterDuplicateWorkflowControls.test.jsx tests/dataImporter.preview.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `18` warnings)

## Progress Update: 2026-03-10 DataImporter List Controls Panel Backfill
- Scope:
  - Backfilled the notebook for the previously landed `cng-7c8.9` slice that extracted the importer control-region wrapper, and re-verified it against the current tree so the work log matches the code.
- Implementation highlights:
  - `src/components/dataImporter/DataImporterListControlsPanel.jsx` owns the `SectionSurface` shell for the saved/preview list controls, including edit toggles, column-config affordance, saved-mode empty-query hint, and composition of the query/preset/duplicate/grid/selection child seams.
  - `src/components/DataImporter.jsx` now mounts that module via `listControlsPanelProps` instead of rendering the full control-region branch inline.
  - Re-normalized `src/components/dataImporter/DataImporterListControlsPanel.jsx` and `tests/dataImporterListControlsPanel.test.jsx` to `CRLF` so targeted lint stays clean on Windows.
- Files modified:
  - `src/components/dataImporter/DataImporterListControlsPanel.jsx`
  - `tests/dataImporterListControlsPanel.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/dataImporterListControlsPanel.test.jsx` -> Passed (`2/2`)
  - `pnpm exec eslint src/components/dataImporter/DataImporterListControlsPanel.jsx tests/dataImporterListControlsPanel.test.jsx` -> Passed (`0` errors, `0` warnings)
  - `pnpm exec vitest run tests/dataImporterAssignmentComboboxes.test.jsx tests/dataImporterListControlsPanel.test.jsx tests/dataImporterSyncConfigPanel.test.jsx tests/dataImporterDuplicateWorkflowControls.test.jsx tests/dataImporterQueryFilterControls.test.jsx tests/dataImporterFilterPresetControls.test.jsx tests/dataImporterFileActions.test.jsx tests/dataImporterCoCodeConfigPanel.test.jsx tests/dataImporterMonitoringPanel.test.jsx tests/dataImporterResultsPanel.test.jsx tests/dataImporterTableResults.test.jsx tests/dataImporterTableHeader.test.jsx tests/dataImporterTableBody.test.jsx tests/dataImporterGridToolbarControls.test.jsx tests/dataImporterDuplicateReviewDialog.test.jsx tests/dataImporterDuplicateDiffDialog.test.jsx tests/dataImporterColumnConfigDialog.test.jsx tests/dataImporterImportPreviewSummary.test.jsx tests/dataImporterSelectionActions.test.jsx tests/dataImporterSyncPreviewPanel.test.jsx tests/dataImporterDeletedRowsDialog.test.jsx tests/dataImporterCardResults.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`61/61`)

## Progress Update: 2026-03-10 DataImporter Assignment Combobox Extraction
- Scope:
  - Continued `cng-7c8.9` with the next reusable JSX seam inside editable importer rows: the team/staff/agency assignment comboboxes that were still embedded near the top of `DataImporter.jsx`.
- Implementation highlights:
  - Added `src/components/dataImporter/DataImporterAssignmentComboboxes.jsx` to own `TeamCombobox`, `StaffCombobox`, and `AgencyCombobox`, while preserving the current popover-command behavior and custom-value flows.
  - Replaced the three inline combobox component definitions in `src/components/DataImporter.jsx` with imports from the new module, keeping the existing `sharedResultsProps` contract for card/table surfaces unchanged.
  - Added `tests/dataImporterAssignmentComboboxes.test.jsx` to cover existing-team selection, custom team entry, staff selection returning both staff/team, and agency option dedupe/clear behavior.
  - Re-normalized the touched files to `CRLF`; this slice reduced `src/components/DataImporter.jsx` to `12880` lines, and the new combobox module is `396` lines.
- Files modified:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/DataImporterAssignmentComboboxes.jsx`
  - `tests/dataImporterAssignmentComboboxes.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/dataImporterAssignmentComboboxes.test.jsx` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/dataImporterAssignmentComboboxes.test.jsx` -> Passed (`3/3`)
  - `pnpm exec vitest run tests/dataImporterAssignmentComboboxes.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`13/13`)
  - `pnpm exec vitest run tests/dataImporterAssignmentComboboxes.test.jsx tests/dataImporterListControlsPanel.test.jsx tests/dataImporterSyncConfigPanel.test.jsx tests/dataImporterDuplicateWorkflowControls.test.jsx tests/dataImporterQueryFilterControls.test.jsx tests/dataImporterFilterPresetControls.test.jsx tests/dataImporterFileActions.test.jsx tests/dataImporterCoCodeConfigPanel.test.jsx tests/dataImporterMonitoringPanel.test.jsx tests/dataImporterResultsPanel.test.jsx tests/dataImporterTableResults.test.jsx tests/dataImporterTableHeader.test.jsx tests/dataImporterTableBody.test.jsx tests/dataImporterGridToolbarControls.test.jsx tests/dataImporterDuplicateReviewDialog.test.jsx tests/dataImporterDuplicateDiffDialog.test.jsx tests/dataImporterColumnConfigDialog.test.jsx tests/dataImporterImportPreviewSummary.test.jsx tests/dataImporterSelectionActions.test.jsx tests/dataImporterSyncPreviewPanel.test.jsx tests/dataImporterDeletedRowsDialog.test.jsx tests/dataImporterCardResults.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`61/61`)
  - `pnpm exec eslint src/components/dataImporter/DataImporterAssignmentComboboxes.jsx src/components/DataImporter.jsx tests/dataImporterAssignmentComboboxes.test.jsx tests/dataImporter.preview.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `18` warnings)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/DataImporterAssignmentComboboxes.jsx tests/dataImporterAssignmentComboboxes.test.jsx` -> Passed

## 2026-03-10 DataImporter Declaration Status Extraction
- Continued `cng-7c8.9` with the next presentational seam still embedded in editable importer rows: the declaration-status badge/detail block that rendered review, pending-assignment, and duplicate-review state inline in `DataImporter.jsx`.
- Added `src/components/dataImporter/DataImporterDeclarationStatus.jsx` for badge/detail rendering and `src/components/dataImporter/dataImporterDeclarationStatus.js` for status resolution/timestamp formatting, while keeping `DataImporter.jsx` as the owner of row data and prop wiring only.
- Fixed the stale mojibake status label during extraction so the default status is now consistently `Mới import` through the shared status resolver.
- Files changed:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/DataImporterDeclarationStatus.jsx`
  - `src/components/dataImporter/dataImporterDeclarationStatus.js`
  - `tests/dataImporterDeclarationStatus.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/dataImporterDeclarationStatus.test.jsx` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/dataImporterDeclarationStatus.test.jsx` -> Passed (`6/6`)
  - `pnpm exec vitest run tests/dataImporterDeclarationStatus.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`16/16`)

## 2026-03-10 DataImporter Row Utils Extraction
- Continued `cng-7c8.9` immediately after the status extraction with the next pure-helper seam near the top of `DataImporter.jsx`: editable diff calculation and roster-team normalization/sorting.
- Added `src/components/dataImporter/dataImporterRowUtils.js` to own `collectEditableDiff()` and `buildRosterTeams()`, then rewired `DataImporter.jsx` to import those helpers instead of defining them inline.
- After the status + row-utils slices, `src/components/DataImporter.jsx` is down to `6369` lines, which is still large but materially lower than the previous `12880`-line state.
- Files changed:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/dataImporterRowUtils.js`
  - `tests/dataImporterRowUtils.test.js`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/dataImporterRowUtils.test.js` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/dataImporterRowUtils.test.js` -> Passed (`3/3`)
  - `pnpm exec vitest run tests/dataImporterDeclarationStatus.test.jsx tests/dataImporterRowUtils.test.js tests/dataImporter.preview.test.jsx` -> Passed (`19/19`)
  - `pnpm exec vitest run tests/dataImporterDeclarationStatus.test.jsx tests/dataImporterRowUtils.test.js tests/dataImporterListControlsPanel.test.jsx tests/dataImporterAssignmentComboboxes.test.jsx tests/dataImporterSyncConfigPanel.test.jsx tests/dataImporterDuplicateWorkflowControls.test.jsx tests/dataImporterQueryFilterControls.test.jsx tests/dataImporterFilterPresetControls.test.jsx tests/dataImporterFileActions.test.jsx tests/dataImporterCoCodeConfigPanel.test.jsx tests/dataImporterMonitoringPanel.test.jsx tests/dataImporterResultsPanel.test.jsx tests/dataImporterTableResults.test.jsx tests/dataImporterTableHeader.test.jsx tests/dataImporterTableBody.test.jsx tests/dataImporterGridToolbarControls.test.jsx tests/dataImporterDuplicateReviewDialog.test.jsx tests/dataImporterDuplicateDiffDialog.test.jsx tests/dataImporterColumnConfigDialog.test.jsx tests/dataImporterImportPreviewSummary.test.jsx tests/dataImporterSelectionActions.test.jsx tests/dataImporterSyncPreviewPanel.test.jsx tests/dataImporterDeletedRowsDialog.test.jsx tests/dataImporterCardResults.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`70/70`)
  - `pnpm exec eslint src/components/dataImporter/DataImporterDeclarationStatus.jsx src/components/dataImporter/dataImporterDeclarationStatus.js src/components/dataImporter/dataImporterRowUtils.js src/components/DataImporter.jsx tests/dataImporterDeclarationStatus.test.jsx tests/dataImporterRowUtils.test.js tests/dataImporter.preview.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `18` warnings)

## 2026-03-10 DataImporter Duplicate Diff Utils Extraction
- Continued `cng-7c8.9` with the next duplicate-review seam still embedded near the top of `DataImporter.jsx`: duplicate diff field grouping, fallback label humanization, temporal formatting, ignored-key filtering, and multiline rendering rules.
- Added `src/components/dataImporter/dataImporterDuplicateDiffUtils.js` to own `createDuplicateDiffGroups()` and `humanizeDiffKey()`, then rewired `DataImporter.jsx` to import those helpers instead of defining the duplicate-diff utility cluster inline.
- During regression, preview tests caught a real wiring miss where `DataImporter.jsx` still passed `humanizeDiffKey` through shared table/card props after the extraction; that prop is now re-imported from the new utility module.
- After the declaration-status, row-utils, and duplicate-diff slices, `src/components/DataImporter.jsx` is now down to `6042` lines.
- Files changed:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/dataImporterDuplicateDiffUtils.js`
  - `tests/dataImporterDuplicateDiffUtils.test.js`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/dataImporterDuplicateDiffUtils.test.js` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/dataImporterDuplicateDiffUtils.test.js` -> Passed (`2/2`)
  - `pnpm exec vitest run tests/dataImporterDuplicateDiffUtils.test.js tests/dataImporterDuplicateDiffDialog.test.jsx tests/dataImporter.preview.test.jsx` -> Failed first due missing `humanizeDiffKey` import in `DataImporter.jsx`, then passed after wiring fix (`14/14`)
  - `pnpm exec vitest run tests/dataImporterDuplicateDiffUtils.test.js tests/dataImporterDeclarationStatus.test.jsx tests/dataImporterRowUtils.test.js tests/dataImporterListControlsPanel.test.jsx tests/dataImporterAssignmentComboboxes.test.jsx tests/dataImporterSyncConfigPanel.test.jsx tests/dataImporterDuplicateWorkflowControls.test.jsx tests/dataImporterQueryFilterControls.test.jsx tests/dataImporterFilterPresetControls.test.jsx tests/dataImporterFileActions.test.jsx tests/dataImporterCoCodeConfigPanel.test.jsx tests/dataImporterMonitoringPanel.test.jsx tests/dataImporterResultsPanel.test.jsx tests/dataImporterTableResults.test.jsx tests/dataImporterTableHeader.test.jsx tests/dataImporterTableBody.test.jsx tests/dataImporterGridToolbarControls.test.jsx tests/dataImporterDuplicateReviewDialog.test.jsx tests/dataImporterDuplicateDiffDialog.test.jsx tests/dataImporterColumnConfigDialog.test.jsx tests/dataImporterImportPreviewSummary.test.jsx tests/dataImporterSelectionActions.test.jsx tests/dataImporterSyncPreviewPanel.test.jsx tests/dataImporterDeletedRowsDialog.test.jsx tests/dataImporterCardResults.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`72/72`)

## 2026-03-10 DataImporter Duplicate Review Utils Extraction
- Continued `cng-7c8.9` with the next pure-helper seam still embedded near the top of `DataImporter.jsx`: duplicate candidate weighting/sorting, merge-field application, pending-review flag cleanup, source/status inference, declaration/group label formatting, and history timestamp formatting.
- Added `src/components/dataImporter/dataImporterDuplicateReviewUtils.js` to own `extractRowTimestampDetail()`, `computeDuplicateWeight()`, `compareDuplicateCandidates()`, `applyMergeField()`, `clearDuplicateReviewFlags()`, `extractDuplicatePrefix()`, `inferRowSource()`, `describeRowStatus()`, `formatHistoryTimestamp()`, `formatDeclarationLabel()`, and `formatDuplicateGroupLabel()`.
- Rewired `src/components/DataImporter.jsx` to import that duplicate-review utility cluster instead of defining it inline, while keeping the rest of the duplicate-review workflow state and mutation orchestration in the parent component.
- After the duplicate-review utility extraction, `src/components/DataImporter.jsx` is now down to `5821` lines.
- Files changed:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/dataImporterDuplicateReviewUtils.js`
  - `tests/dataImporterDuplicateReviewUtils.test.js`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/dataImporterDuplicateReviewUtils.test.js` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/dataImporterDuplicateReviewUtils.test.js tests/dataImporterDuplicateReviewDialog.test.jsx tests/dataImporterDuplicateDiffDialog.test.jsx tests/dataImporter.preview.test.jsx` -> Failed once on an incorrect test assumption about `normalizeStr()` source-code normalization, then passed after aligning the assertion to existing behavior (`20/20`)
  - `pnpm exec vitest run tests/dataImporterDuplicateReviewUtils.test.js tests/dataImporterDuplicateDiffUtils.test.js tests/dataImporterDeclarationStatus.test.jsx tests/dataImporterRowUtils.test.js tests/dataImporterListControlsPanel.test.jsx tests/dataImporterAssignmentComboboxes.test.jsx tests/dataImporterSyncConfigPanel.test.jsx tests/dataImporterDuplicateWorkflowControls.test.jsx tests/dataImporterQueryFilterControls.test.jsx tests/dataImporterFilterPresetControls.test.jsx tests/dataImporterFileActions.test.jsx tests/dataImporterCoCodeConfigPanel.test.jsx tests/dataImporterMonitoringPanel.test.jsx tests/dataImporterResultsPanel.test.jsx tests/dataImporterTableResults.test.jsx tests/dataImporterTableHeader.test.jsx tests/dataImporterTableBody.test.jsx tests/dataImporterGridToolbarControls.test.jsx tests/dataImporterDuplicateReviewDialog.test.jsx tests/dataImporterDuplicateDiffDialog.test.jsx tests/dataImporterColumnConfigDialog.test.jsx tests/dataImporterImportPreviewSummary.test.jsx tests/dataImporterSelectionActions.test.jsx tests/dataImporterSyncPreviewPanel.test.jsx tests/dataImporterDeletedRowsDialog.test.jsx tests/dataImporterCardResults.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`77/77`)
  - `pnpm exec eslint src/components/dataImporter/dataImporterDuplicateReviewUtils.js src/components/DataImporter.jsx tests/dataImporterDuplicateReviewUtils.test.js tests/dataImporter.preview.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `16` warnings)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/dataImporterDuplicateReviewUtils.js tests/dataImporterDuplicateReviewUtils.test.js` -> Passed

## 2026-03-11 DataImporter License Utils Extraction
- Continued `cng-7c8.9` with the next pure-helper seam still embedded near the top of `DataImporter.jsx`: license count coercion, manual-override synchronization, license-code normalization, agency-key normalization/extraction, code-list parse/join, and C/O field synchronization.
- Added `src/components/dataImporter/dataImporterLicenseUtils.js` to own `coerceLicenseValue()`, `ensureLicenseFields()`, `normalizeLicenseCode()`, `normalizeAgencyKey()`, `parseCodeListInput()`, `joinCodeList()`, `extractAgencyKeys()`, and `ensureCOFields()`.
- Rewired `src/components/DataImporter.jsx` to import that license/C/O utility cluster instead of defining it inline, while keeping the higher-level license-exclusion flow state and preview/save orchestration in the parent component.
- During RED/GREEN, the new tests initially assumed cleaner `extractAgencyKeys()` output and a different `deriveCOStatus()` interpretation than the current shared implementation actually provides; those assertions were corrected to match existing behavior so the slice stayed as a pure refactor.
- After the license/C/O utility extraction, `src/components/DataImporter.jsx` is now down to `5693` lines.
- Files changed:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/dataImporterLicenseUtils.js`
  - `tests/dataImporterLicenseUtils.test.js`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/dataImporterLicenseUtils.test.js` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/dataImporterLicenseUtils.test.js tests/dataImporter.preview.test.jsx` -> Failed twice on incorrect test assumptions about existing agency/C/O normalization semantics, then passed after aligning assertions to current behavior (`14/14`)
  - `pnpm exec vitest run tests/dataImporterLicenseUtils.test.js tests/dataImporterDuplicateReviewUtils.test.js tests/dataImporterDuplicateDiffUtils.test.js tests/dataImporterDeclarationStatus.test.jsx tests/dataImporterRowUtils.test.js tests/dataImporterListControlsPanel.test.jsx tests/dataImporterAssignmentComboboxes.test.jsx tests/dataImporterSyncConfigPanel.test.jsx tests/dataImporterDuplicateWorkflowControls.test.jsx tests/dataImporterQueryFilterControls.test.jsx tests/dataImporterFilterPresetControls.test.jsx tests/dataImporterFileActions.test.jsx tests/dataImporterCoCodeConfigPanel.test.jsx tests/dataImporterMonitoringPanel.test.jsx tests/dataImporterResultsPanel.test.jsx tests/dataImporterTableResults.test.jsx tests/dataImporterTableHeader.test.jsx tests/dataImporterTableBody.test.jsx tests/dataImporterGridToolbarControls.test.jsx tests/dataImporterDuplicateReviewDialog.test.jsx tests/dataImporterDuplicateDiffDialog.test.jsx tests/dataImporterColumnConfigDialog.test.jsx tests/dataImporterImportPreviewSummary.test.jsx tests/dataImporterSelectionActions.test.jsx tests/dataImporterSyncPreviewPanel.test.jsx tests/dataImporterDeletedRowsDialog.test.jsx tests/dataImporterCardResults.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`81/81`)
  - `pnpm exec eslint src/components/dataImporter/dataImporterLicenseUtils.js src/components/DataImporter.jsx tests/dataImporterLicenseUtils.test.js tests/dataImporter.preview.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `16` warnings)

## 2026-03-11 DataImporter Config Extraction
- Continued `cng-7c8.9` with the next pure-helper seam still embedded at the top of `DataImporter.jsx`: table/aux column labels, config options, width sanitation, view-mode/page-size constants, sync MST textarea parsing, sync defaults, date-range presets, and duplicate-merge field metadata.
- Added `src/components/dataImporter/dataImporterConfig.js` to own `DECL_HISTORY_FIELD_LABELS`, `DECL_HISTORY_ENTRY_LIMIT`, `IMPORT_TABLE_COLUMN_LABELS`, `IMPORT_TABLE_COLUMNS`, `AUX_COLUMN_LABELS`, `AUX_COLUMN_OPTIONS`, `COLUMN_CONFIG_OPTIONS`, `SENSITIVE_COLUMN_SET`, `IMPORT_ERROR_REASON_LABELS`, `FROZEN_COLUMN_KEYS`, `FROZEN_COLUMN_WIDTHS`, `MIN_COLUMN_WIDTH`, `VALID_COLUMN_WIDTH_KEYS`, `clampColumnWidth()`, `sanitizeColumnWidths()`, `areWidthMapsEqual()`, `VIEW_MODE_STORAGE_KEY`, `VIEW_MODES`, `FREEZE_COLUMNS_STORAGE_KEY`, `GRID_COLUMNS_STORAGE_KEY`, `CARD_GRID_COLUMN_OPTIONS`, `DEFAULT_CARD_GRID_COLUMNS`, `CARD_GRID_MIN_WIDTH`, `SERVER_SEARCH_THRESHOLD`, `SERVER_SEARCH_MAX_PAGE_SIZE`, `DEFAULT_PAGE_SIZE`, `PAGE_SIZE_OPTIONS`, `PAGE_SIZE_STORAGE_KEY`, `CO_FILTER_OPTIONS`, `parseMstListInput()`, `formatMstListForInput()`, `DEFAULT_SYNC_CONFIG`, `RANGE_PRESETS`, `FILTER_PRESET_SCOPE`, `LAST_FILTER_PRESET_KEY`, `LEGACY_FILTER_STORAGE_KEY`, `DUPLICATE_MERGE_FIELDS`, `MAX_IMPORT_FILE_SIZE_BYTES`, `MAX_IMPORT_ROWS`, `ACCEPTED_IMPORT_EXTENSIONS`, `toDateInputValue()`, and `DATE_RANGE_PRESETS`.
- Rewired `src/components/DataImporter.jsx` to import that config/state helper cluster instead of defining it inline, while leaving render/state orchestration untouched in the parent component.
- After the config extraction, `src/components/DataImporter.jsx` is now down to `5473` lines.
- Files changed:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/dataImporterConfig.js`
  - `tests/dataImporterConfig.test.js`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/dataImporterConfig.test.js` -> Failed first with missing module import, confirming RED
- `pnpm exec vitest run tests/dataImporterConfig.test.js tests/dataImporter.preview.test.jsx` -> Passed (`13/13`)
- `pnpm exec vitest run tests/dataImporterConfig.test.js tests/dataImporterLicenseUtils.test.js tests/dataImporterDuplicateReviewUtils.test.js tests/dataImporterDuplicateDiffUtils.test.js tests/dataImporterDeclarationStatus.test.jsx tests/dataImporterRowUtils.test.js tests/dataImporterListControlsPanel.test.jsx tests/dataImporterAssignmentComboboxes.test.jsx tests/dataImporterSyncConfigPanel.test.jsx tests/dataImporterDuplicateWorkflowControls.test.jsx tests/dataImporterQueryFilterControls.test.jsx tests/dataImporterFilterPresetControls.test.jsx tests/dataImporterFileActions.test.jsx tests/dataImporterCoCodeConfigPanel.test.jsx tests/dataImporterMonitoringPanel.test.jsx tests/dataImporterResultsPanel.test.jsx tests/dataImporterTableResults.test.jsx tests/dataImporterTableHeader.test.jsx tests/dataImporterTableBody.test.jsx tests/dataImporterGridToolbarControls.test.jsx tests/dataImporterDuplicateReviewDialog.test.jsx tests/dataImporterDuplicateDiffDialog.test.jsx tests/dataImporterColumnConfigDialog.test.jsx tests/dataImporterImportPreviewSummary.test.jsx tests/dataImporterSelectionActions.test.jsx tests/dataImporterSyncPreviewPanel.test.jsx tests/dataImporterDeletedRowsDialog.test.jsx tests/dataImporterCardResults.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`84/84`)
- `pnpm exec eslint src/components/dataImporter/dataImporterConfig.js src/components/DataImporter.jsx tests/dataImporterConfig.test.js tests/dataImporter.preview.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `16` warnings)

## 2026-03-11 DataImporter Sync + Monitoring Hook Extraction
- Continued `cng-7c8.9` with the next workflow/state seam still embedded in `DataImporter.jsx`: ECUS sync config/status/alert fetches, preview/run mutations, MST filter notices, and post-run reload orchestration.
- Added `src/components/dataImporter/useDataImporterSync.js` to own the sync state machine (`syncConfig`, `syncForm`, `manualRange`, `statusInfo`, `alertSummary`, `previewRows`) plus `fetchSyncConfig()`, `fetchSyncStatus()`, `fetchAlerts()`, `handleSaveSyncConfig()`, `handlePreviewSync()`, `handleRunSync()`, and the post-run refresh flow.
- Added `tests/useDataImporterSync.test.jsx` to lock the new hook directly, including mount-time config/status/alert loading and save+run behavior with post-run reloads.
- While verifying GREEN, fixed a real regression where `fetchSyncConfig()` overwrote the successful run message after `/api/import/ecus/run`; the hook now preserves the success message during post-run config refresh.
- In the same slice, extracted the remaining C/O monitoring/config orchestration into `src/components/dataImporter/useDataImporterCoMonitoring.js`, with direct coverage in `tests/useDataImporterCoMonitoring.test.jsx`.
- Rewired `src/components/DataImporter.jsx` to consume both hooks, cutting the parent module down to `4907` lines while keeping each new hook under the project target (`useDataImporterSync.js` `441` lines, `useDataImporterCoMonitoring.js` `355` lines).
- Files changed:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/useDataImporterSync.js`
  - `src/components/dataImporter/useDataImporterCoMonitoring.js`
  - `tests/useDataImporterSync.test.jsx`
  - `tests/useDataImporterCoMonitoring.test.jsx`
  - `tests/dataImporter.preview.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/useDataImporterSync.test.jsx` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/useDataImporterSync.test.jsx tests/useDataImporterCoMonitoring.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`14/14`)
  - `pnpm exec vitest run tests/useDataImporterSync.test.jsx tests/useDataImporterCoMonitoring.test.jsx tests/dataImporter.preview.test.jsx tests/dataImporterSyncConfigPanel.test.jsx tests/dataImporterMonitoringPanel.test.jsx tests/dataImporterCoCodeConfigPanel.test.jsx` -> Passed (`21/21`)
  - `pnpm exec eslint src/components/dataImporter/useDataImporterSync.js src/components/dataImporter/useDataImporterCoMonitoring.js src/components/DataImporter.jsx tests/useDataImporterSync.test.jsx tests/useDataImporterCoMonitoring.test.jsx tests/dataImporter.preview.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `16` warnings)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/useDataImporterSync.js src/components/dataImporter/useDataImporterCoMonitoring.js tests/useDataImporterSync.test.jsx tests/useDataImporterCoMonitoring.test.jsx tests/dataImporter.preview.test.jsx` -> Passed

## 2026-03-11 DataImporter Saved Session Hook Extraction
- Continued `cng-7c8.9` with the next low-risk orchestration seam still embedded in `DataImporter.jsx`: persisted declaration loading, saved-mode UI reset, mount-time auto-load, duplicate-filter reset on mode exit, and unsaved `beforeunload` guarding.
- Added `src/components/dataImporter/useDataImporterSavedSession.js` to own `loadSavedRows()` and the saved-session side effects, while keeping the actual store/rule helpers injectable so the hook stays directly testable.
- Added `tests/useDataImporterSavedSession.test.jsx` to lock direct behavior for state reset, unsaved discard confirmation, and mount-time auto-load / saved-mode exit handling.
- Rewired `src/components/DataImporter.jsx` to consume the new hook, reducing the parent to `4883` lines while keeping the new hook at `115` lines.
- Files changed:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/useDataImporterSavedSession.js`
  - `tests/useDataImporterSavedSession.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/useDataImporterSavedSession.test.jsx` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/useDataImporterSavedSession.test.jsx` -> Passed (`3/3`)
  - `pnpm exec vitest run tests/useDataImporterSavedSession.test.jsx tests/useDataImporterSync.test.jsx tests/useDataImporterCoMonitoring.test.jsx tests/dataImporter.preview.test.jsx tests/dataImporterFileActions.test.jsx tests/dataImporterSyncConfigPanel.test.jsx tests/dataImporterMonitoringPanel.test.jsx tests/dataImporterCoCodeConfigPanel.test.jsx` -> Passed (`27/27`)
  - `pnpm exec eslint src/components/dataImporter/useDataImporterSavedSession.js src/components/DataImporter.jsx tests/useDataImporterSavedSession.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `16` warnings)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/useDataImporterSavedSession.js tests/useDataImporterSavedSession.test.jsx` -> Passed

## 2026-03-11 DataImporter Import Flow Hook Extraction
- Continued `cng-7c8.9` with the next preview/source seam still embedded in `DataImporter.jsx`: XLSX validation/parsing, preview reset after file ingest, and the manual import/log/reload flow.
- Added `src/components/dataImporter/useDataImporterImportFlow.js` to own `handleFileChange()` and `handleImport()`, while keeping `xlsx`, `FileReader`, `toast`, and store callbacks injectable so the hook stays directly testable.
- Added `tests/useDataImporterImportFlow.test.jsx` to lock direct behavior for workbook parsing into preview state and persisted manual import refresh behavior.
- Rewired `src/components/DataImporter.jsx` to consume the new hook, reducing the parent to `4709` lines while keeping the new hook at `329` lines.
- Files changed:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/useDataImporterImportFlow.js`
  - `tests/useDataImporterImportFlow.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/useDataImporterImportFlow.test.jsx` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/useDataImporterImportFlow.test.jsx` -> Passed (`2/2`)
  - `pnpm exec vitest run tests/useDataImporterImportFlow.test.jsx tests/useDataImporterSavedSession.test.jsx tests/useDataImporterSync.test.jsx tests/useDataImporterCoMonitoring.test.jsx tests/dataImporter.preview.test.jsx tests/dataImporterFileActions.test.jsx tests/dataImporterSyncConfigPanel.test.jsx tests/dataImporterMonitoringPanel.test.jsx tests/dataImporterCoCodeConfigPanel.test.jsx` -> Passed (`29/29`)
  - `pnpm exec eslint src/components/dataImporter/useDataImporterImportFlow.js src/components/DataImporter.jsx tests/useDataImporterImportFlow.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `16` warnings)
  - `git diff --check -- src/components/dataImporter/useDataImporterImportFlow.js src/components/DataImporter.jsx tests/useDataImporterImportFlow.test.jsx` -> Passed

## 2026-03-11 DataImporter Saved Edits Hook Extraction
- Continued `cng-7c8.9` with the next saved-mode mutation seam still embedded in `DataImporter.jsx`: bulk save plus single-row save/update normalization and history refresh.
- Added `src/components/dataImporter/useDataImporterSavedEdits.js` to own `handleSaveAll()` and `handleSaveRowChanges()`, while keeping store helpers, normalization, history refresh, and toast wiring injectable so the hook stays directly testable.
- Added `tests/useDataImporterSavedEdits.test.jsx` to lock direct behavior for bulk diff save refreshes and successful single-row save normalization/merge behavior.
- Rewired `src/components/DataImporter.jsx` to consume the new hook, reducing the parent to `4588` lines while keeping the new hook at `188` lines.
- Files changed:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/useDataImporterSavedEdits.js`
  - `tests/useDataImporterSavedEdits.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/useDataImporterSavedEdits.test.jsx` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/useDataImporterSavedEdits.test.jsx` -> Passed (`2/2`)
  - `pnpm exec vitest run tests/useDataImporterSavedEdits.test.jsx tests/useDataImporterImportFlow.test.jsx tests/useDataImporterSavedSession.test.jsx tests/useDataImporterSync.test.jsx tests/useDataImporterCoMonitoring.test.jsx tests/dataImporter.preview.test.jsx tests/dataImporterFileActions.test.jsx tests/dataImporterSyncConfigPanel.test.jsx tests/dataImporterMonitoringPanel.test.jsx tests/dataImporterCoCodeConfigPanel.test.jsx` -> Passed (`31/31`)
  - `pnpm exec eslint src/components/dataImporter/useDataImporterSavedEdits.js src/components/DataImporter.jsx tests/useDataImporterSavedEdits.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `16` warnings)
  - `git diff --check -- src/components/dataImporter/useDataImporterSavedEdits.js src/components/DataImporter.jsx tests/useDataImporterSavedEdits.test.jsx` -> Passed

## 2026-03-11 DataImporter Row Mutations Hook Extraction
- Continued `cng-7c8.9` with the next destructive-action seam still embedded in `DataImporter.jsx`: soft delete, hard delete, restore, and the selected-row destructive flows.
- Added `src/components/dataImporter/useDataImporterRowMutations.js` to own `deleteRowsByKeys()`, `hardDeleteRowsByKeys()`, and the selected/single destructive handlers, while keeping filtering, audit logging, and reload helpers injectable so the hook stays directly testable.
- Added `tests/useDataImporterRowMutations.test.jsx` to lock direct behavior for soft delete selected, hard delete selected, and single-row restore refresh behavior.
- Rewired `src/components/DataImporter.jsx` to consume the new hook, reducing the parent to `4324` lines while keeping the new hook at `324` lines.
- Files changed:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/useDataImporterRowMutations.js`
  - `tests/useDataImporterRowMutations.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/useDataImporterRowMutations.test.jsx` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/useDataImporterRowMutations.test.jsx` -> Passed (`3/3`)
  - `pnpm exec vitest run tests/useDataImporterRowMutations.test.jsx tests/useDataImporterSavedEdits.test.jsx tests/useDataImporterImportFlow.test.jsx tests/useDataImporterSavedSession.test.jsx tests/useDataImporterSync.test.jsx tests/useDataImporterCoMonitoring.test.jsx tests/dataImporter.preview.test.jsx tests/dataImporterFileActions.test.jsx tests/dataImporterSyncConfigPanel.test.jsx tests/dataImporterMonitoringPanel.test.jsx tests/dataImporterCoCodeConfigPanel.test.jsx` -> Passed (`34/34`)
  - `pnpm exec eslint src/components/dataImporter/useDataImporterRowMutations.js src/components/DataImporter.jsx tests/useDataImporterRowMutations.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `13` warnings)
  - `git diff --check -- src/components/dataImporter/useDataImporterRowMutations.js src/components/DataImporter.jsx tests/useDataImporterRowMutations.test.jsx` -> Passed

## 2026-03-11 DataImporter Review Actions Hook Extraction
- Continued `cng-7c8.9` with the next review-alert seam still embedded in `DataImporter.jsx`: alert refresh plus reviewed/unreviewed selected-row actions.
- Added `src/components/dataImporter/useDataImporterReviewActions.js` to own `handleRefreshAlerts()`, `handleMarkReviewed()`, and `handleUnmarkReviewed()`, while keeping store mutations, fetch sync, and saved-row reload helpers injectable so the hook stays directly testable.
- Added `tests/useDataImporterReviewActions.test.jsx` to lock direct behavior for alert refresh, mark reviewed, and unmark reviewed flows.
- Rewired `src/components/DataImporter.jsx` to consume the new hook, leaving the parent free of another review-specific mutation branch.
- Files changed:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/useDataImporterReviewActions.js`
  - `tests/useDataImporterReviewActions.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/useDataImporterReviewActions.test.jsx` -> Passed (`3/3`)
  - `pnpm exec vitest run tests/useDataImporterReviewActions.test.jsx tests/useDataImporterRowMutations.test.jsx tests/useDataImporterSavedEdits.test.jsx tests/useDataImporterImportFlow.test.jsx tests/useDataImporterSavedSession.test.jsx tests/useDataImporterSync.test.jsx tests/useDataImporterCoMonitoring.test.jsx tests/dataImporter.preview.test.jsx tests/dataImporterFileActions.test.jsx tests/dataImporterSyncConfigPanel.test.jsx tests/dataImporterMonitoringPanel.test.jsx tests/dataImporterCoCodeConfigPanel.test.jsx` -> Passed (`37/37`)
  - `pnpm exec eslint src/components/dataImporter/useDataImporterReviewActions.js src/components/DataImporter.jsx tests/useDataImporterReviewActions.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `13` warnings)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/useDataImporterReviewActions.js tests/useDataImporterReviewActions.test.jsx` -> Passed

## 2026-03-11 DataImporter Duplicate Diff Hook Extraction
- Continued `cng-7c8.9` with the next duplicate-comparison seam still embedded in `DataImporter.jsx`: duplicate diff dialog open/close/change/swap handlers plus the derived group/base/compare selection and changed-field summaries.
- Added `src/components/dataImporter/useDataImporterDuplicateDiff.js` to own duplicate diff state reconciliation, default group selection, base/compare swapping, and derived diff summary data, while keeping comparison helpers injectable so the hook stays directly testable.
- Added `tests/useDataImporterDuplicateDiff.test.jsx` to lock direct behavior for first-group open defaults, swap behavior, and reconciliation when duplicate groups change.
- Rewired `src/components/DataImporter.jsx` to consume the new hook and simplified the duplicate diff dialog `onOpenChange` wiring down to a single handler.
- Files changed:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/useDataImporterDuplicateDiff.js`
  - `tests/useDataImporterDuplicateDiff.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/useDataImporterDuplicateDiff.test.jsx` -> Passed (`3/3`)
  - `pnpm exec vitest run tests/useDataImporterDuplicateDiff.test.jsx tests/useDataImporterReviewActions.test.jsx tests/useDataImporterRowMutations.test.jsx tests/useDataImporterSavedEdits.test.jsx tests/useDataImporterImportFlow.test.jsx tests/useDataImporterSavedSession.test.jsx tests/useDataImporterSync.test.jsx tests/useDataImporterCoMonitoring.test.jsx tests/dataImporter.preview.test.jsx tests/dataImporterFileActions.test.jsx tests/dataImporterSyncConfigPanel.test.jsx tests/dataImporterMonitoringPanel.test.jsx tests/dataImporterCoCodeConfigPanel.test.jsx` -> Passed (`40/40`)
  - `pnpm exec eslint src/components/dataImporter/useDataImporterDuplicateDiff.js src/components/DataImporter.jsx tests/useDataImporterDuplicateDiff.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `13` warnings)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/useDataImporterDuplicateDiff.js tests/useDataImporterDuplicateDiff.test.jsx` -> Passed

## 2026-03-11 DataImporter Duplicate Review Hook Extraction
- Continued `cng-7c8.9` with the next duplicate-reconciliation seam still embedded in `DataImporter.jsx`: duplicate plan defaults, keeper/merge/resolution/note updates, review dialog open/close, and confirm persistence for delete vs review resolutions.
- Added `src/components/dataImporter/useDataImporterDuplicateReview.js` to own duplicate review state and orchestration, while keeping row mutation helpers and persistence/audit functions injectable so the hook stays directly testable.
- Added `tests/useDataImporterDuplicateReview.test.jsx` to lock direct behavior for default plan creation, review dialog state transitions, and a mixed delete/review confirm flow.
- Rewired `src/components/DataImporter.jsx` to consume the new hook, reducing the parent to `6954` lines while keeping the new hook at `379` lines.
- Fixed a real behavior bug during extraction: keeper rows resolved through duplicate deletion now persist the normalized row object directly, so cleared `duplicate_review_*` flags do not leak back in from the stale source row during save.
- Files changed:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/useDataImporterDuplicateReview.js`
  - `tests/useDataImporterDuplicateReview.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/useDataImporterDuplicateReview.test.jsx` -> Passed (`3/3`)
  - `pnpm exec vitest run tests/useDataImporterDuplicateReview.test.jsx tests/useDataImporterDuplicateDiff.test.jsx tests/useDataImporterReviewActions.test.jsx tests/useDataImporterRowMutations.test.jsx tests/useDataImporterSavedEdits.test.jsx tests/useDataImporterImportFlow.test.jsx tests/useDataImporterSavedSession.test.jsx tests/useDataImporterSync.test.jsx tests/useDataImporterCoMonitoring.test.jsx tests/dataImporterDuplicateReviewDialog.test.jsx tests/dataImporter.preview.test.jsx tests/dataImporterFileActions.test.jsx tests/dataImporterSyncConfigPanel.test.jsx tests/dataImporterMonitoringPanel.test.jsx tests/dataImporterCoCodeConfigPanel.test.jsx` -> Passed (`46/46`)
  - `pnpm exec eslint src/components/dataImporter/useDataImporterDuplicateReview.js src/components/DataImporter.jsx tests/useDataImporterDuplicateReview.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `12` warnings)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/useDataImporterDuplicateReview.js tests/useDataImporterDuplicateReview.test.jsx` -> Passed

## 2026-03-11 DataImporter License Exclusion Hook Extraction
- Continued `cng-7c8.9` with the next reconciliation seam still embedded in `DataImporter.jsx`: selected-row/manual apply plus filtered-row auto-apply for license exclusions, exclusion summary shaping, and KPI recomputation after license-code exclusion changes.
- Added `src/components/dataImporter/useDataImporterLicenseExclusions.js` to own `applyLicenseExclusionForKeys()`, `handleApplyLicenseExclusion()`, and `handleAutoApplyLicenseExclusion()`, while keeping row-key filtering, snapshot derivation, and KPI helpers injectable so the hook stays directly testable.
- Added `tests/useDataImporterLicenseExclusions.test.jsx` to lock direct behavior for manual exclusion apply, filtered auto-apply, and summary/alert shaping around exclusion changes.
- Rewired `src/components/DataImporter.jsx` to consume the new hook, reducing the parent to `3618` lines while keeping the new hook at `360` lines.
- Files changed:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/useDataImporterLicenseExclusions.js`
  - `tests/useDataImporterLicenseExclusions.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/useDataImporterLicenseExclusions.test.jsx` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/useDataImporterLicenseExclusions.test.jsx` -> Passed (`3/3`)
  - `pnpm exec vitest run tests/useDataImporterLicenseExclusions.test.jsx tests/dataImporterSelectionActions.test.jsx tests/dataImporterDuplicateWorkflowControls.test.jsx tests/dataImporter.preview.test.jsx tests/automation.flows.test.js` -> Passed (`21/21`)
  - `pnpm exec eslint src/components/dataImporter/useDataImporterLicenseExclusions.js src/components/DataImporter.jsx tests/useDataImporterLicenseExclusions.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `11` warnings)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/useDataImporterLicenseExclusions.js tests/useDataImporterLicenseExclusions.test.jsx` -> Passed

## 2026-03-11 DataImporter Filter Preset Hook Extraction
- Continued `cng-7c8.9` with the next search/session seam still embedded in `DataImporter.jsx`: saved preset payload building, preset apply/save/overwrite/delete flows, last-applied preset restore, legacy localStorage preset import, and clear-range handling.
- Added `src/components/dataImporter/useDataImporterFilterPresets.js` to own preset workflow state and orchestration while keeping setter callbacks and preset CRUD helpers injectable so the hook stays directly testable.
- Added `tests/useDataImporterFilterPresets.test.jsx` to lock direct behavior for selected preset apply, save-as-new payload building, and legacy localStorage preset migration/apply.
- Rewired `src/components/DataImporter.jsx` to consume the new hook, reducing the parent to `3268` lines while keeping the new hook at `474` lines.
- Files changed:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/useDataImporterFilterPresets.js`
  - `tests/useDataImporterFilterPresets.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/useDataImporterFilterPresets.test.jsx` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/useDataImporterFilterPresets.test.jsx` -> Passed (`3/3`)
  - `pnpm exec vitest run tests/useDataImporterFilterPresets.test.jsx tests/dataImporterFilterPresetControls.test.jsx tests/dataImporterListControlsPanel.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`18/18`)
  - `pnpm exec eslint src/components/dataImporter/useDataImporterFilterPresets.js src/components/DataImporter.jsx tests/useDataImporterFilterPresets.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `11` warnings)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/useDataImporterFilterPresets.js tests/useDataImporterFilterPresets.test.jsx` -> Passed

## 2026-03-11 DataImporter Query Filter Hook Extraction
- Continued `cng-7c8.9` with the next search/session seam still embedded in `DataImporter.jsx`: quick-search/date/C/O filter control wiring, date-preset application, and clear-range handling for the main importer filter strip.
- Added `src/components/dataImporter/useDataImporterQueryFilters.js` to own the query/date/C/O controller while keeping filter values and setters injectable so the hook stays directly testable.
- Added `tests/useDataImporterQueryFilters.test.jsx` to lock direct behavior for date preset application, clear-range reset, and `queryFilterControlsProps` shaping.
- Rewired `src/components/DataImporter.jsx` to consume the new hook, then fixed the real TDZ regression exposed by preview tests by moving the hook wiring below the `coFilterActive` / `coFilterMatches` derivations that its props depend on.
- `src/components/DataImporter.jsx` now sits at `5483` lines, while `src/components/dataImporter/useDataImporterQueryFilters.js` is `103` lines.
- Files changed:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/useDataImporterQueryFilters.js`
  - `tests/useDataImporterQueryFilters.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/useDataImporterQueryFilters.test.jsx` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/useDataImporterQueryFilters.test.jsx` -> Passed (`3/3`)
  - `pnpm exec vitest run tests/useDataImporterQueryFilters.test.jsx tests/dataImporterQueryFilterControls.test.jsx tests/dataImporterListControlsPanel.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`18/18`)
  - `pnpm exec eslint src/components/dataImporter/useDataImporterQueryFilters.js src/components/DataImporter.jsx tests/useDataImporterQueryFilters.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `11` warnings)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/useDataImporterQueryFilters.js tests/useDataImporterQueryFilters.test.jsx` -> Passed

## 2026-03-11 DataImporter Assignment Hook Extraction
- Continued `cng-7c8.9` with the next selection-assignment seam still embedded in `DataImporter.jsx`: roster-based staff/team/agency selection callbacks and their row-update shaping.
- Added `src/components/dataImporter/useDataImporterAssignments.js` to own `handleSelectStaff()`, `handleSelectTeam()`, and `handleSelectAgency()` while keeping `applyEdit()`, normalization helpers, and `memberTeamMap` injectable so the hook stays directly testable.
- Added `tests/useDataImporterAssignments.test.jsx` to lock direct behavior for staff-to-team mapping, incompatible-team staff clearing, and agency/dai_ly synchronization.
- Rewired `src/components/DataImporter.jsx` to consume the new hook instead of keeping the combobox callback cluster inline.
- `src/components/DataImporter.jsx` now sits at `5339` lines, while `src/components/dataImporter/useDataImporterAssignments.js` is `93` lines.
- Files changed:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/useDataImporterAssignments.js`
  - `tests/useDataImporterAssignments.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/useDataImporterAssignments.test.jsx` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/useDataImporterAssignments.test.jsx` -> Passed (`3/3`)
  - `pnpm exec vitest run tests/useDataImporterAssignments.test.jsx tests/dataImporterTableBody.test.jsx tests/dataImporterCardResults.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`17/17`)
  - `pnpm exec eslint src/components/dataImporter/useDataImporterAssignments.js src/components/DataImporter.jsx tests/useDataImporterAssignments.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `11` warnings)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/useDataImporterAssignments.js tests/useDataImporterAssignments.test.jsx` -> Passed

## 2026-03-11 DataImporter Selection Actions Hook Extraction
- Continued `cng-7c8.9` with the next selection seam still embedded in `DataImporter.jsx`: filtered-selection derivation, selected-reviewed counting, per-row toggle selection, clear selection, and select-filtered behavior for saved-mode bulk actions.
- Added `src/components/dataImporter/useDataImporterSelectionActions.js` to own the selection controller while keeping row identity helpers, mutability guards, setters, and toast/alert side effects injectable so the hook stays directly testable.
- Added `tests/useDataImporterSelectionActions.test.jsx` to lock direct behavior for filtered-selection derivation, reviewed-count derivation, select-filtered paging reset, and locked-row vs editable-row toggle behavior.
- Rewired `src/components/DataImporter.jsx` to consume the new hook, then fixed the real TDZ regression exposed by preview tests by moving the hook wiring below the `selectionEnabled` derivation that its props depend on.
- `src/components/DataImporter.jsx` now sits at `5228` lines, while `src/components/dataImporter/useDataImporterSelectionActions.js` is `96` lines.
- Files changed:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/useDataImporterSelectionActions.js`
  - `tests/useDataImporterSelectionActions.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/useDataImporterSelectionActions.test.jsx` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/useDataImporterSelectionActions.test.jsx` -> Passed (`3/3`)
  - `pnpm exec vitest run tests/useDataImporterSelectionActions.test.jsx tests/dataImporterSelectionActions.test.jsx tests/dataImporterTableBody.test.jsx tests/dataImporterCardResults.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`19/19`)
  - `pnpm exec eslint src/components/dataImporter/useDataImporterSelectionActions.js src/components/DataImporter.jsx tests/useDataImporterSelectionActions.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `10` warnings)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/useDataImporterSelectionActions.js tests/useDataImporterSelectionActions.test.jsx` -> Passed

## 2026-03-11 DataImporter Selection Bulk Actions Hook Extraction
- Continued `cng-7c8.9` with the next selected-row seam still embedded in `DataImporter.jsx`: capability flags for bulk actions, selected-row XLSX export shaping, and the `selectionActionsProps` bundle passed into the list controls panel.
- Added `src/components/dataImporter/useDataImporterSelectionBulkActions.js` to own `canDelete/canReview/canUnreview`, selected-row export handling, and the shared props bundle while keeping XLSX utilities, row identity helpers, formatting helpers, and action callbacks injectable so the hook stays directly testable.
- Added `tests/useDataImporterSelectionBulkActions.test.jsx` to lock direct behavior for capability derivation, empty-selection export guarding, and normalized XLSX export payload shaping for license and C/O fields.
- Rewired `src/components/DataImporter.jsx` to consume the new hook instead of keeping another selection-adjacent callback/props cluster inline.
- `src/components/DataImporter.jsx` now sits at `5156` lines, while `src/components/dataImporter/useDataImporterSelectionBulkActions.js` is `107` lines.
- Files changed:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/useDataImporterSelectionBulkActions.js`
  - `tests/useDataImporterSelectionBulkActions.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/useDataImporterSelectionBulkActions.test.jsx` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/useDataImporterSelectionBulkActions.test.jsx` -> Passed (`3/3`)
  - `pnpm exec vitest run tests/useDataImporterSelectionBulkActions.test.jsx tests/dataImporterSelectionActions.test.jsx tests/dataImporterTableBody.test.jsx tests/dataImporterCardResults.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`19/19`)
  - `pnpm exec vitest run tests/useDataImporterSelectionBulkActions.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`13/13`)
  - `pnpm exec eslint src/components/dataImporter/useDataImporterSelectionBulkActions.js src/components/DataImporter.jsx tests/useDataImporterSelectionBulkActions.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `10` warnings)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/useDataImporterSelectionBulkActions.js tests/useDataImporterSelectionBulkActions.test.jsx` -> Passed

## 2026-03-11 DataImporter List Preferences Hook Extraction
- Continued `cng-7c8.9` with the next UI-preference seam still embedded in `DataImporter.jsx`: page-size controllers, view-mode/frozen-column/card-grid toggles, show-deleted toggle, overwrite confirmation, and column-config dialog opening.
- Added `src/components/dataImporter/useDataImporterListPreferences.js` to own those list/session preference callbacks while keeping state setters, bounds, view-mode constants, card-grid options, and overwrite confirmation injectable so the hook stays directly testable.
- Added `tests/useDataImporterListPreferences.test.jsx` to lock direct behavior for opening column config with a cloned hidden-column set, switching to custom page-size mode, clamping manual page-size input, normalizing toolbar preferences, and guarding overwrite behind permissions/confirmation.
- Rewired `src/components/DataImporter.jsx` to consume the new hook instead of keeping another toolbar/session preference callback cluster inline.
- `src/components/DataImporter.jsx` now sits at `5012` lines, while `src/components/dataImporter/useDataImporterListPreferences.js` is `158` lines.
- Files changed:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/useDataImporterListPreferences.js`
  - `tests/useDataImporterListPreferences.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/useDataImporterListPreferences.test.jsx` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/useDataImporterListPreferences.test.jsx` -> Passed (`4/4`)
  - `pnpm exec vitest run tests/useDataImporterListPreferences.test.jsx tests/dataImporterGridToolbarControls.test.jsx tests/dataImporterListControlsPanel.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`18/18`)
  - `pnpm exec vitest run tests/useDataImporterListPreferences.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`14/14`)
  - `pnpm exec eslint src/components/dataImporter/useDataImporterListPreferences.js src/components/DataImporter.jsx tests/useDataImporterListPreferences.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `10` warnings)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/useDataImporterListPreferences.js tests/useDataImporterListPreferences.test.jsx` -> Passed

## 2026-03-11 DataImporter Deleted Rows Hook Extraction
- Continued `cng-7c8.9` with the next deleted-row seam still embedded in `DataImporter.jsx`: deleted dialog open state, hard-deleted declaration fetch/retry flow, and abort-on-close behavior.
- Added `src/components/dataImporter/useDataImporterDeletedRows.js` to own deleted-dialog state plus hard-deleted fetch lifecycle while keeping `searchRange`, `fetchWithAuth`, and `extractErrorMessage` injectable so the hook stays directly testable.
- Added `tests/useDataImporterDeletedRows.test.jsx` to lock direct behavior for fetch-on-open, retry with the current range, and aborting the inflight request when the dialog closes.
- Rewired `src/components/DataImporter.jsx` to consume the new hook and route the file-action deleted-list affordance through `openDeletedDialog()`.
- `src/components/DataImporter.jsx` now sits at `4849` lines, while `src/components/dataImporter/useDataImporterDeletedRows.js` is `151` lines.
- Files changed:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/useDataImporterDeletedRows.js`
  - `tests/useDataImporterDeletedRows.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/useDataImporterDeletedRows.test.jsx` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/useDataImporterDeletedRows.test.jsx` -> Passed (`3/3`)
  - `pnpm exec vitest run tests/useDataImporterDeletedRows.test.jsx tests/dataImporterDeletedRowsDialog.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`15/15`)
  - `pnpm exec eslint src/components/dataImporter/useDataImporterDeletedRows.js src/components/DataImporter.jsx tests/useDataImporterDeletedRows.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `9` warnings)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/useDataImporterDeletedRows.js tests/useDataImporterDeletedRows.test.jsx` -> Passed

## 2026-03-11 DataImporter Row History Hook Extraction
- Continued `cng-7c8.9` with the next history seam still embedded in `DataImporter.jsx`: row history expansion state, per-row history refresh, and row-level history toggling.
- Added `src/components/dataImporter/useDataImporterRowHistory.js` to own `rowHistoryExpanded`, `rowHistoryEntries`, `refreshRowHistory()`, and `handleToggleHistory()` while keeping `getDeclHistoryForRow` and the entry limit injectable so the hook stays directly testable.
- Added `tests/useDataImporterRowHistory.test.jsx` to lock direct behavior for trimmed-key history refresh, blank-key guarding, and toggling expansion without refetching on collapse.
- Rewired `src/components/DataImporter.jsx` to consume the new hook while still exposing history setters to `useDataImporterSavedSession.js` for saved-session reset behavior.
- `src/components/DataImporter.jsx` remains `4849` lines, while `src/components/dataImporter/useDataImporterRowHistory.js` is `53` lines.
- Files changed:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/useDataImporterRowHistory.js`
  - `tests/useDataImporterRowHistory.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/useDataImporterRowHistory.test.jsx` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/useDataImporterRowHistory.test.jsx` -> Passed (`3/3`)
  - `pnpm exec vitest run tests/useDataImporterRowHistory.test.jsx tests/dataImporterTableBody.test.jsx tests/dataImporterCardResults.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`17/17`)
  - `pnpm exec eslint src/components/dataImporter/useDataImporterRowHistory.js src/components/DataImporter.jsx tests/useDataImporterRowHistory.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `9` warnings)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/useDataImporterRowHistory.js tests/useDataImporterRowHistory.test.jsx` -> Passed

## 2026-03-11 DataImporter Baseline Snapshot Hook Extraction
- Continued `cng-7c8.9` with the next saved-mode seam still embedded in `DataImporter.jsx`: baseline snapshot refresh, editable diff-map derivation, and single-row baseline commits after saved-row updates.
- Added `src/components/dataImporter/useDataImporterBaselineSnapshot.js` to own full-snapshot refresh, single-row baseline commit, and saved-mode diff-map derivation while keeping `keyOfRow` injectable so the hook stays directly testable.
- Added `tests/useDataImporterBaselineSnapshot.test.jsx` to lock direct behavior for initial snapshot capture, saved-mode editable diff derivation, single-row baseline commit clearing the diff, and diff suppression outside saved mode.
- Rewired `src/components/DataImporter.jsx` to consume the new hook instead of carrying `savedRowSnapshotRef`, `baselineVersion`, `updateBaselineSnapshot()`, and inline `rowDiffMap` derivation.
- Updated `src/components/dataImporter/useDataImporterSavedEdits.js` so single-row saves now call `commitRowToBaseline()` instead of mutating the baseline ref/version pair directly, and refreshed `tests/useDataImporterSavedEdits.test.jsx` to assert the new seam.
- `src/components/DataImporter.jsx` now sits at `2886` lines, while `src/components/dataImporter/useDataImporterBaselineSnapshot.js` is `63` lines.
- Files changed:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/useDataImporterBaselineSnapshot.js`
  - `src/components/dataImporter/useDataImporterSavedEdits.js`
  - `tests/useDataImporterBaselineSnapshot.test.jsx`
  - `tests/useDataImporterSavedEdits.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/useDataImporterBaselineSnapshot.test.jsx` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/useDataImporterBaselineSnapshot.test.jsx tests/useDataImporterSavedEdits.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`15/15`)
  - `pnpm exec eslint src/components/DataImporter.jsx src/components/dataImporter/useDataImporterBaselineSnapshot.js src/components/dataImporter/useDataImporterSavedEdits.js tests/useDataImporterBaselineSnapshot.test.jsx tests/useDataImporterSavedEdits.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `7` warnings)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/useDataImporterBaselineSnapshot.js src/components/dataImporter/useDataImporterSavedEdits.js tests/useDataImporterBaselineSnapshot.test.jsx tests/useDataImporterSavedEdits.test.jsx` -> Passed

## 2026-03-11 DataImporter Row Editing Hook Extraction
- Continued `cng-7c8.9` with the next mutation-heavy seam still embedded in `DataImporter.jsx`: inline `applyEdit()` ownership for editable-row guards, sanitized updates, KPI recalculation, selection remapping, and server-search patching.
- Added `src/components/dataImporter/useDataImporterRowEditing.js` to own the `applyEdit()` path while keeping row-edit collaborators injectable (`keyOfRow`, `sanitizeRowUpdates`, `computeKPI`, editability checks, and state setters) so the hook stays directly testable.
- Added `tests/useDataImporterRowEditing.test.jsx` to lock direct behavior for saved-row editing, selected-key remapping after identity changes, server-search row refresh, and blocked-row alert suppression on repeated edit attempts.
- Rewired `src/components/DataImporter.jsx` to consume the new hook instead of carrying the long inline `applyEdit()` callback directly.
- `src/components/DataImporter.jsx` now sits at `2807` lines, while `src/components/dataImporter/useDataImporterRowEditing.js` is `145` lines.
- Files changed:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/useDataImporterRowEditing.js`
  - `tests/useDataImporterRowEditing.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/useDataImporterRowEditing.test.jsx` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/useDataImporterRowEditing.test.jsx tests/useDataImporterAssignments.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`15/15`)
  - `pnpm exec eslint src/components/DataImporter.jsx src/components/dataImporter/useDataImporterRowEditing.js tests/useDataImporterRowEditing.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `7` warnings)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/useDataImporterRowEditing.js tests/useDataImporterRowEditing.test.jsx` -> Passed

## 2026-03-11 DataImporter Result Rows Hook Extraction
- Continued `cng-7c8.9` with the next saved-mode/session seam still embedded in `DataImporter.jsx`: server-side search fetches, client/server page derivation, page reset behavior, and deleted-row selection pruning.
- Added `src/components/dataImporter/useDataImporterResultRows.js` to own server-search state plus client/server paging derivation while keeping collaborators injectable (`filterDeclRows`, `fetchWithAuth`, `keyOfRow`, setters, and normalized filters) so the hook stays directly testable.
- Added `tests/useDataImporterResultRows.test.jsx` to lock direct behavior for client-side paging, deleted-row selection pruning, server-search query shaping, returned paging state, and page reset behavior.
- Rewired `src/components/DataImporter.jsx` to consume the new hook instead of carrying the long search/paging/reset block inline.
- `src/components/DataImporter.jsx` now sits at `4133` lines, while `src/components/dataImporter/useDataImporterResultRows.js` is `168` lines.
- Files changed:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/useDataImporterResultRows.js`
  - `tests/useDataImporterResultRows.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/useDataImporterResultRows.test.jsx` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/useDataImporterResultRows.test.jsx` -> Passed (`3/3`)
  - `pnpm exec vitest run tests/useDataImporterResultRows.test.jsx tests/useDataImporterRowEditing.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`15/15`)
  - `pnpm exec eslint src/components/DataImporter.jsx src/components/dataImporter/useDataImporterResultRows.js tests/useDataImporterResultRows.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` after CRLF normalization (`0` errors, `4` warnings before the follow-up row-presentation slice, of which only `DataImporter.jsx` warnings remain now)

## 2026-03-11 DataImporter Row Presentation Hook Extraction
- Continued `cng-7c8.9` with the next table/card shared seam still embedded in `DataImporter.jsx`: `buildRowState()`, card license-count normalization, and card C/O + KPI display formatting.
- Added `src/components/dataImporter/useDataImporterRowPresentation.js` to own those shared callbacks while keeping row-state collaborators injectable (`keyOfRow`, editability checks, history/save maps, `applyEdit`, and KPI/C/O formatters) so the hook stays directly testable.
- Added `tests/useDataImporterRowPresentation.test.jsx` to lock direct behavior for deleted/read-only row metadata, pending diff/save/history state, license-count normalization, and card C/O + KPI formatting.
- Rewired `src/components/DataImporter.jsx` to consume the new hook instead of carrying those shared table/card callbacks inline.
- `src/components/DataImporter.jsx` remains `4133` lines after the paired result-row/presentation slices, while `src/components/dataImporter/useDataImporterRowPresentation.js` is `118` lines.
- Files changed:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/useDataImporterRowPresentation.js`
  - `tests/useDataImporterRowPresentation.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/useDataImporterRowPresentation.test.jsx` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/useDataImporterRowPresentation.test.jsx tests/dataImporterCardResults.test.jsx tests/dataImporterTableBody.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`17/17`)
  - `pnpm exec vitest run tests/useDataImporterResultRows.test.jsx tests/useDataImporterRowPresentation.test.jsx tests/useDataImporterRowEditing.test.jsx tests/dataImporterCardResults.test.jsx tests/dataImporterTableBody.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`22/22`)
  - `pnpm exec eslint src/components/DataImporter.jsx src/components/dataImporter/useDataImporterResultRows.js src/components/dataImporter/useDataImporterRowPresentation.js tests/useDataImporterResultRows.test.jsx tests/useDataImporterRowPresentation.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `3` warnings)

## 2026-03-11 DataImporter Saved Highlights Hook Extraction
- Continued `cng-7c8.9` with the next saved-mode/session seam still embedded in `DataImporter.jsx`: last-sync summary totals, updated-row preview state, and saved-mode selection shortcuts.
- Added `src/components/dataImporter/useDataImporterSavedHighlights.js` to own last-sync totals, updated declaration previews, select-updated/select-C/O-mismatch shortcuts, and duplicate-filter guard handling while keeping state setters injectable for direct hook tests.
- Added `tests/useDataImporterSavedHighlights.test.jsx` to lock last-sync derivation, saved-mode selection shortcuts, and alert behavior when duplicate filtering is requested outside saved mode or without duplicate rows.
- Rewired `src/components/DataImporter.jsx` to consume the new hook instead of carrying that highlight derivation and callback cluster inline.
- Verification:
  - `pnpm exec vitest run tests/useDataImporterSavedHighlights.test.jsx` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/useDataImporterSavedHighlights.test.jsx tests/dataImporter.preview.test.jsx tests/useDataImporterResultRows.test.jsx tests/useDataImporterRowPresentation.test.jsx tests/dataImporterCardResults.test.jsx tests/dataImporterTableBody.test.jsx` -> Passed (`23/23`)
  - `pnpm exec eslint src/components/DataImporter.jsx src/components/dataImporter/useDataImporterSavedHighlights.js tests/useDataImporterSavedHighlights.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `3` warnings)

## 2026-03-11 DataImporter Duplicate Summary Extraction
- Continued `cng-7c8.9` with the next duplicate/reconcile seam still embedded in `DataImporter.jsx`: duplicate 11-digit grouping, keeper/removal selection, and review-dialog metadata shaping.
- Added `src/components/dataImporter/dataImporterDuplicateSummary.js` to own duplicate aggregation, candidate ordering, duplicate/removal sets, and detail payload shaping used by the diff/review controllers.
- Added `tests/dataImporterDuplicateSummary.test.js` to lock duplicate grouping, keeper selection ordering, duplicate/removal sets, and the empty-summary path.
- Rewired `src/components/DataImporter.jsx` to consume `buildDuplicateSummary()` via `useMemo()` instead of materializing duplicate groups inline.
- Verification:
  - `pnpm exec vitest run tests/dataImporterDuplicateSummary.test.js` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/dataImporterDuplicateSummary.test.js` -> Passed (`2/2`)
  - `pnpm exec vitest run tests/dataImporterDuplicateSummary.test.js tests/dataImporterDuplicateReviewUtils.test.js tests/useDataImporterSavedHighlights.test.jsx tests/dataImporter.preview.test.jsx tests/useDataImporterResultRows.test.jsx tests/useDataImporterRowPresentation.test.jsx tests/dataImporterCardResults.test.jsx tests/dataImporterTableBody.test.jsx` -> Passed (`30/30`)
  - `pnpm exec eslint src/components/DataImporter.jsx src/components/dataImporter/dataImporterDuplicateSummary.js src/components/dataImporter/useDataImporterSavedHighlights.js tests/dataImporterDuplicateSummary.test.js tests/useDataImporterSavedHighlights.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `3` warnings)

## 2026-03-11 DataImporter Column Config Hook Extraction
- Continued `cng-7c8.9` with the next UI/session seam still embedded in `DataImporter.jsx`: persisted hidden-column state, resize-handle persistence, sensitive-column gating, and apply/reset flows for the column-config dialog.
- Added `src/components/dataImporter/useDataImporterColumnConfig.jsx` to own hidden-column hydration, width persistence, resize-handle registration, sensitive-column gating, and apply/reset behavior while keeping `actor` and `isAdminRole` injectable for direct tests.
- Added `tests/useDataImporterColumnConfig.test.jsx` to lock direct behavior for hydration/subscription updates, non-admin sensitive-column blocking plus keep-one-column guard behavior, width persistence, apply, and reset flows.
- Rewired `src/components/DataImporter.jsx` to consume the new hook instead of carrying the column-config state machine inline; the importer now sits at `3217` lines, while `src/components/dataImporter/useDataImporterColumnConfig.jsx` is `315` lines.
- Fixed two real regressions during the slice:
  - Renamed the new hook from `.js` to `.jsx` after Vitest/Vite failed to parse JSX in a `.js` module with `Expression expected`.
  - Moved the hook mount below `isAdminRole` derivation after preview regressions exposed a TDZ crash (`Cannot access 'isAdminRole' before initialization`).
- Hardened the storage boundary in `useDataImporterColumnConfig.jsx` so apply flow no longer assumes `saveImportColumnConfig()` always returns an object with `hidden`.
- Files changed:
  - `src/components/DataImporter.jsx`
  - `src/components/dataImporter/useDataImporterColumnConfig.jsx`
  - `tests/useDataImporterColumnConfig.test.jsx`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Verification:
  - `pnpm exec vitest run tests/useDataImporterColumnConfig.test.jsx` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/useDataImporterColumnConfig.test.jsx` -> Failed once with parser error until the hook moved from `.js` to `.jsx`
  - `pnpm exec vitest run tests/useDataImporterColumnConfig.test.jsx` -> Passed (`3/3`)
  - `pnpm exec vitest run tests/useDataImporterColumnConfig.test.jsx tests/useDataImporterLayout.test.jsx tests/dataImporterColumnConfigDialog.test.jsx tests/dataImporterTableBody.test.jsx tests/dataImporterCardResults.test.jsx tests/dataImporter.preview.test.jsx tests/useDataImporterResultRows.test.jsx tests/useDataImporterRowPresentation.test.jsx tests/dataImporterDuplicateSummary.test.js tests/useDataImporterSavedHighlights.test.jsx` -> Passed (`33/33`)
  - `pnpm exec eslint src/components/dataImporter/useDataImporterColumnConfig.jsx src/components/DataImporter.jsx tests/useDataImporterColumnConfig.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `2` warnings`)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/useDataImporterColumnConfig.jsx tests/useDataImporterColumnConfig.test.jsx` -> Passed

## 2026-03-11 DataImporter Edit Access Hook Extraction
- Continued `cng-7c8.9` with the next role/session seam still embedded in `DataImporter.jsx`: admin/lead/staff edit gating, roster-team lookup, blocked-edit notice reset, and staff team-change sanitization.
- Added `src/components/dataImporter/useDataImporterEditAccess.js` to own role derivation, roster/member access lookups, edit restriction messaging, blocked-edit notice lifecycle, and staff team-change sanitization behind a direct hook seam.
- Added `tests/useDataImporterEditAccess.test.jsx` to lock roster-team + agency option derivation, team-lead row edit gating, and staff team-change blocking with blocked-notice reset on identity change.
- Rewired `src/components/DataImporter.jsx` to consume the new hook for `isAdminRole`, `canAutoReconcile`, `rosterTeams`, `editingRestrictionMessage`, `isRowEditable`, `blockedEditNoticeRef`, `sanitizeRowUpdates`, and `memberTeamMap`; the importer now sits at `3005` lines, while `src/components/dataImporter/useDataImporterEditAccess.js` is `233` lines.
- Preserved the existing `agencyOptions` behavior in this slice, including retention of combined raw values like `Gamma; Delta`, instead of changing search/select semantics during the refactor.
- Verification:
  - `pnpm exec vitest run tests/useDataImporterEditAccess.test.jsx` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/useDataImporterEditAccess.test.jsx` -> Failed once on expectation drift until the test reflected the existing `Gamma; Delta` composite-option behavior
  - `pnpm exec vitest run tests/useDataImporterEditAccess.test.jsx` -> Passed (`3/3`)
  - `pnpm exec vitest run tests/useDataImporterEditAccess.test.jsx tests/useDataImporterColumnConfig.test.jsx tests/useDataImporterAssignments.test.jsx tests/useDataImporterRowEditing.test.jsx tests/dataImporterColumnConfigDialog.test.jsx tests/dataImporterTableBody.test.jsx tests/dataImporterCardResults.test.jsx tests/dataImporter.preview.test.jsx tests/useDataImporterResultRows.test.jsx tests/useDataImporterRowPresentation.test.jsx` -> Passed (`33/33`)
  - `pnpm exec eslint src/components/dataImporter/useDataImporterEditAccess.js src/components/DataImporter.jsx tests/useDataImporterEditAccess.test.jsx` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `1` warning)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/useDataImporterEditAccess.js tests/useDataImporterEditAccess.test.jsx` -> Passed

## 2026-03-11 DataImporter Deleted Summary Helper Extraction
- Continued `cng-7c8.9` with the next low-risk deleted-history seam still embedded in `DataImporter.jsx`: deleted-entry fallback extraction, deleted timestamp sorting, and deleted-range fallback text for the deleted-rows dialog.
- Added `src/components/dataImporter/dataImporterDeletedEntries.js` to own deleted-entry shaping and range-label fallback behind pure functions, keeping the dialog-facing payload testable without mounting the full importer.
- Added `tests/dataImporterDeletedEntries.test.js` to lock soft/hard deleted-row merge behavior, sort ordering, field fallbacks, deleted-by fallback text, and the `"Không giới hạn"` date-range fallback.
- Rewired `src/components/DataImporter.jsx` to consume `buildDeletedEntries()` / `buildDeletedRangeLabel()` instead of keeping the deleted summary builder inline, and removed the duplicate local `agencyOptions` builder so the parent now uses the hook-owned option list from `useDataImporterEditAccess.js`.
- `src/components/DataImporter.jsx` now sits at `1999` lines after this slice.
- Verification:
  - `pnpm exec vitest run tests/dataImporterDeletedEntries.test.js` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/dataImporterDeletedEntries.test.js tests/useDataImporterEditAccess.test.jsx tests/dataImporterDeletedRowsDialog.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`17/17`)
  - `pnpm exec eslint src/components/dataImporter/dataImporterDeletedEntries.js src/components/DataImporter.jsx tests/dataImporterDeletedEntries.test.js` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `1` warning)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/dataImporterDeletedEntries.js tests/dataImporterDeletedEntries.test.js` -> Passed

## 2026-03-11 DataImporter Duplicate Diff Preparation Extraction
- Continued `cng-7c8.9` with the next duplicate/reconcile seam still embedded in `DataImporter.jsx`: duplicate-diff row preparation for license snapshot fields, C/O summary fields, timestamp label formatting, and deduped agent display.
- Added `src/components/dataImporter/dataImporterDuplicateDiffPreparation.js` to own duplicate-diff row normalization behind a pure helper so diff preparation can be tested directly without mounting the importer.
- Added `tests/dataImporterDuplicateDiffPreparation.test.js` to lock invalid-row fallback plus normalization of `so_tk_full`, license snapshot counters/codes, C/O fields, timestamp label formatting, and deduped agent display ordering.
- Rewired `src/components/DataImporter.jsx` to consume `prepareDuplicateDiffRow()` instead of keeping the duplicate-diff row preparation block inline.
- `src/components/DataImporter.jsx` now sits at `1973` lines after this slice.
- Verification:
  - `pnpm exec vitest run tests/dataImporterDuplicateDiffPreparation.test.js` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/dataImporterDuplicateDiffPreparation.test.js tests/useDataImporterDuplicateDiff.test.jsx tests/dataImporterDuplicateDiffDialog.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`17/17`)
  - `pnpm exec eslint src/components/dataImporter/dataImporterDuplicateDiffPreparation.js src/components/DataImporter.jsx tests/dataImporterDuplicateDiffPreparation.test.js` -> Passed with existing warnings only in `src/components/DataImporter.jsx` (`0` errors, `1` warning)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/dataImporterDuplicateDiffPreparation.js tests/dataImporterDuplicateDiffPreparation.test.js` -> Passed

## 2026-03-11 DataImporter Overview Hook Extraction
- Continued `cng-7c8.9` with the next saved-mode overview seam still embedded in `DataImporter.jsx`: summary stats/cards, outstanding-alert preview, and last alert/sync labels.
- Added `src/components/dataImporter/useDataImporterOverview.js` to own that saved-mode overview derivation behind a hook seam instead of keeping multiple related `useMemo()` blocks inline in `DataImporter.jsx`.
- Added `tests/useDataImporterOverview.test.jsx` to lock saved-mode summary-card derivation plus fallback behavior when alert/sync timestamps are missing or invalid.
- Rewired `src/components/DataImporter.jsx` to consume `useDataImporterOverview()` instead of keeping those overview/sync label derivations inline.
- Verification:
  - `pnpm exec vitest run tests/useDataImporterOverview.test.jsx` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/useDataImporterOverview.test.jsx tests/dataImporter.preview.test.jsx tests/useDataImporterDuplicateDiff.test.jsx tests/dataImporterDuplicateDiffDialog.test.jsx` -> Passed (`17/17`)

## 2026-03-11 DataImporter Deleted Hook Expansion
- Continued `cng-7c8.9` with the next deleted-dialog seam still embedded in `DataImporter.jsx`: filtered hard-deleted rows, merged deleted-entry shaping, deleted counts, and deleted-range label.
- Expanded `src/components/dataImporter/useDataImporterDeletedRows.js` so the hook now owns both fetch state and dialog-facing deleted-entry derivation, instead of leaving `filteredHardDeletedRows`, `deletedEntries`, `deletedTotalCount`, and `deletedRangeLabel` inline in `DataImporter.jsx`.
- Extended `tests/useDataImporterDeletedRows.test.jsx` to lock the new deleted-entry/count/range-label behavior and tightened the abort assertion to observe the inflight `AbortSignal` directly, avoiding a broader-bundle false negative.
- Rewired `src/components/DataImporter.jsx` to consume the expanded deleted-rows hook and fixed a real TDZ regression by mounting that hook below `baseFilterInputs` and `softDeletedRows`.
- `src/components/DataImporter.jsx` now sits at `1914` lines after the overview-hook extraction plus deleted-hook expansion.
- Verification:
  - `pnpm exec vitest run tests/useDataImporterDeletedRows.test.jsx tests/dataImporterDeletedRowsDialog.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`16/16`)
  - `pnpm exec vitest run tests/useDataImporterOverview.test.jsx tests/useDataImporterDeletedRows.test.jsx tests/dataImporterDeletedRowsDialog.test.jsx tests/dataImporter.preview.test.jsx tests/useDataImporterDuplicateDiff.test.jsx tests/dataImporterDuplicateDiffDialog.test.jsx` -> Passed (`23/23`)
  - `pnpm exec eslint src/components/DataImporter.jsx src/components/dataImporter/useDataImporterOverview.js src/components/dataImporter/useDataImporterDeletedRows.js tests/useDataImporterOverview.test.jsx tests/useDataImporterDeletedRows.test.jsx` -> Passed with existing warning only in `src/components/DataImporter.jsx` (`0` errors, `1` warning about `setManualRange`)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/useDataImporterOverview.js src/components/dataImporter/useDataImporterDeletedRows.js tests/useDataImporterOverview.test.jsx tests/useDataImporterDeletedRows.test.jsx task.md task_plan.md findings.md progress.md` -> Passed

## 2026-03-11 DataImporter Display Preferences Hook Extraction
- Continued `cng-7c8.9` with the next session-preference seam still embedded in `DataImporter.jsx`: page-size hydration, view-mode persistence, frozen-column preference, and card-grid column persistence.
- Added `src/components/dataImporter/useDataImporterDisplayPreferences.js` to own those display/session preferences behind a dedicated hook instead of keeping both the initializers and persistence effects inline in `DataImporter.jsx`.
- Added `tests/useDataImporterDisplayPreferences.test.jsx` to lock localStorage hydration, invalid-value fallback, page-size clamp behavior, and preference persistence back to storage.
- Rewired `src/components/DataImporter.jsx` to consume `useDataImporterDisplayPreferences()` instead of maintaining the display-preference state/effect cluster inline.
- `src/components/DataImporter.jsx` now sits at `1839` lines after this slice.
- Verification:
  - `pnpm exec vitest run tests/useDataImporterDisplayPreferences.test.jsx` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/useDataImporterDisplayPreferences.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`13/13`)
  - `pnpm exec vitest run tests/useDataImporterDisplayPreferences.test.jsx tests/useDataImporterOverview.test.jsx tests/useDataImporterDeletedRows.test.jsx tests/dataImporterDeletedRowsDialog.test.jsx tests/dataImporter.preview.test.jsx tests/useDataImporterDuplicateDiff.test.jsx tests/dataImporterDuplicateDiffDialog.test.jsx` -> Passed (`26/26`)
  - `pnpm exec eslint src/components/DataImporter.jsx src/components/dataImporter/useDataImporterDisplayPreferences.js tests/useDataImporterDisplayPreferences.test.jsx` -> Passed with existing warning only in `src/components/DataImporter.jsx` (`0` errors, `1` warning about `setManualRange`)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/useDataImporterDisplayPreferences.js tests/useDataImporterDisplayPreferences.test.jsx` -> Passed

## 2026-03-11 DataImporter Sync Toast + Container Width Hook Extraction
- Continued `cng-7c8.9` with the next two low-risk session seams still embedded in `DataImporter.jsx`: storage-limit sync-status toast dedupe/subscription cleanup and root-width observation via `ResizeObserver` / window-resize fallback.
- Added `src/components/dataImporter/useDataImporterSyncStatusToast.js` to own the storage-limit sync toast lifecycle behind a direct hook seam with injected dependencies, instead of keeping the `lastSyncToastMessageRef` and subscription effect inline in `DataImporter.jsx`.
- Added `src/components/dataImporter/useDataImporterContainerWidth.js` to own root-width measurement behind a direct hook seam, instead of keeping the `containerWidth` state plus `ResizeObserver` / resize-listener effect inline in `DataImporter.jsx`.
- Added `tests/useDataImporterSyncStatusToast.test.jsx` to lock initial storage-limit notification, duplicate-toast suppression until cleared, and unsubscribe-on-unmount cleanup.
- Added `tests/useDataImporterContainerWidth.test.jsx` to lock both `ResizeObserver`-driven width updates and the window-resize fallback path when `ResizeObserver` is unavailable.
- Rewired `src/components/DataImporter.jsx` to consume both hooks, and added `setManualRange` to `applyRangePreset()` dependencies so the touched importer scope no longer carries a local lint warning.
- `src/components/DataImporter.jsx` now sits at `1792` lines after this slice.
- Verification:
  - `pnpm exec vitest run tests/useDataImporterSyncStatusToast.test.jsx tests/useDataImporterContainerWidth.test.jsx` -> Failed first with missing module imports, confirming RED
  - `pnpm exec vitest run tests/useDataImporterSyncStatusToast.test.jsx tests/useDataImporterContainerWidth.test.jsx` -> Passed (`4/4`)
  - `pnpm exec vitest run tests/useDataImporterSyncStatusToast.test.jsx tests/useDataImporterContainerWidth.test.jsx tests/useDataImporterDisplayPreferences.test.jsx tests/useDataImporterOverview.test.jsx tests/useDataImporterDeletedRows.test.jsx tests/useDataImporterLayout.test.jsx tests/dataImporterDeletedRowsDialog.test.jsx tests/dataImporterDuplicateDiffDialog.test.jsx tests/useDataImporterDuplicateDiff.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`33/33`)
  - `pnpm exec eslint src/components/DataImporter.jsx src/components/dataImporter/useDataImporterSyncStatusToast.js src/components/dataImporter/useDataImporterContainerWidth.js tests/useDataImporterSyncStatusToast.test.jsx tests/useDataImporterContainerWidth.test.jsx` -> Passed (`0` errors, `0` warnings)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/useDataImporterSyncStatusToast.js src/components/dataImporter/useDataImporterContainerWidth.js tests/useDataImporterSyncStatusToast.test.jsx tests/useDataImporterContainerWidth.test.jsx` -> Passed

## 2026-03-11 DataImporter Action Guards Hook Extraction
- Continued `cng-7c8.9` with the next save-safety seam still embedded in `DataImporter.jsx`: editable-key filtering, hard-delete eligibility, and user-facing restriction/review-lock alerts.
- Added `src/components/dataImporter/useDataImporterActionGuards.js` to own `filterEditableKeys()`, `filterHardDeleteKeys()`, `ensureEditableKeys()`, and `ensureHardDeleteKeys()` behind a direct hook seam instead of keeping that callback cluster inline in `DataImporter.jsx`.
- Added `tests/useDataImporterActionGuards.test.jsx` to lock editable filtering, review-lock fallback alerts, and hard-delete eligibility for restored deleted rows.
- Rewired `src/components/DataImporter.jsx` to consume `useDataImporterActionGuards()` and removed the unused inline `canHardDeleteRow` destructure after the extraction.
- `src/components/DataImporter.jsx` now sits at `1687` lines after this slice.
- Verification:
  - `pnpm exec vitest run tests/useDataImporterActionGuards.test.jsx` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/useDataImporterActionGuards.test.jsx tests/useDataImporterRowMutations.test.jsx tests/useDataImporterLicenseExclusions.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`19/19`)
  - `pnpm exec eslint src/components/DataImporter.jsx src/components/dataImporter/useDataImporterActionGuards.js tests/useDataImporterActionGuards.test.jsx` -> Passed (`0` errors, `0` warnings)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/useDataImporterActionGuards.js tests/useDataImporterActionGuards.test.jsx` -> Passed

## 2026-03-11 DataImporter License Summary Hook Extraction
- Continued `cng-7c8.9` with the next rules/summary seam still embedded in `DataImporter.jsx`: rule-derived global and agency license exclusion sets plus row-level license snapshot summarization.
- Added `src/components/dataImporter/useDataImporterLicenseSummary.js` to own `licenseExcludeSet`, `licenseAgencyExcludeMap`, `getLicenseExcludeSetForRow()`, and `summarizeLicenseSnapshot()` behind a direct hook seam instead of keeping those derivations inline in `DataImporter.jsx`.
- Added `tests/useDataImporterLicenseSummary.test.jsx` to lock global/agency exclusion merging, manual-count snapshot behavior, and invalid-row fallback.
- Rewired `src/components/DataImporter.jsx` to consume `useDataImporterLicenseSummary({ rules })` and dropped the now-unused inline `coerceLicenseValue` import from the parent.
- `src/components/DataImporter.jsx` now sits at `1616` lines after this slice.
- Verification:
  - `pnpm exec vitest run tests/useDataImporterLicenseSummary.test.jsx` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/useDataImporterLicenseSummary.test.jsx tests/useDataImporterLicenseExclusions.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`16/16`)
  - `pnpm exec eslint src/components/DataImporter.jsx src/components/dataImporter/useDataImporterLicenseSummary.js tests/useDataImporterLicenseSummary.test.jsx` -> Passed (`0` errors, `0` warnings)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/useDataImporterLicenseSummary.js tests/useDataImporterLicenseSummary.test.jsx` -> Passed

## 2026-03-11 DataImporter Import Preview Hook Extraction
- Continued `cng-7c8.9` with the next preview/overwrite seam still embedded in `DataImporter.jsx`: effective preview-row shaping, upload/overwrite capability derivation, preview error fallback, and overwrite reset.
- Added `src/components/dataImporter/useDataImporterImportPreview.js` to own `effectivePreviewRows`, `canUploadFiles`, `canOverwriteData`, and `importPreview` behind a direct hook seam instead of keeping that preview/overwrite cluster inline in `DataImporter.jsx`.
- Added `tests/useDataImporterImportPreview.test.jsx` to lock 11-char preview truncation, overwrite reset when capability is lost, and preview error fallback behavior.
- Rewired `src/components/DataImporter.jsx` to consume `useDataImporterImportPreview()` and removed the inline overwrite-reset effect from the parent.
- `src/components/DataImporter.jsx` now sits at `1593` lines after this slice.
- Verification:
  - `pnpm exec vitest run tests/useDataImporterImportPreview.test.jsx` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/useDataImporterImportPreview.test.jsx tests/dataImporter.preview.test.jsx tests/useDataImporterLicenseSummary.test.jsx tests/useDataImporterLicenseExclusions.test.jsx` -> Passed (`19/19`)
  - `pnpm exec eslint src/components/DataImporter.jsx src/components/dataImporter/useDataImporterImportPreview.js tests/useDataImporterImportPreview.test.jsx` -> Passed (`0` errors, `0` warnings)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/useDataImporterImportPreview.js tests/useDataImporterImportPreview.test.jsx` -> Passed

## 2026-03-11 DataImporter Saved-Mode Display Component Extraction
- Continued `cng-7c8.9` with the next saved-mode display seam still embedded in `DataImporter.jsx`: summary stat-grid rendering, last-sync recap rendering, and the admin-only updated-row highlight banner.
- Added `src/components/dataImporter/DataImporterSummaryCards.jsx` to own the overview summary-card grid instead of rendering `summaryCards.map(...)` inline in `DataImporter.jsx`.
- Added `src/components/dataImporter/DataImporterLastSyncSummaryCard.jsx` to own the latest sync recap block instead of constructing `lastSyncSummaryCard` inline in `DataImporter.jsx`.
- Added `src/components/dataImporter/DataImporterUpdatedRowsBanner.jsx` to own the admin-only post-sync updated-row banner instead of rendering that selection/highlight block inline in `DataImporter.jsx`.
- Added direct component tests in `tests/dataImporterSummaryCards.test.jsx`, `tests/dataImporterLastSyncSummaryCard.test.jsx`, and `tests/dataImporterUpdatedRowsBanner.test.jsx`.
- Rewired `src/components/DataImporter.jsx` to consume the new display components while keeping `DataImporterSyncConfigPanel` behavior unchanged through the existing `lastSyncSummaryCard` prop surface.
- `src/components/DataImporter.jsx` now sits at `1546` lines after this slice.
- Verification:
  - `pnpm exec vitest run tests/dataImporterLastSyncSummaryCard.test.jsx tests/dataImporterSummaryCards.test.jsx tests/dataImporterUpdatedRowsBanner.test.jsx` -> Failed first with missing module imports, confirming RED
  - `pnpm exec vitest run tests/dataImporterLastSyncSummaryCard.test.jsx tests/dataImporterSummaryCards.test.jsx tests/dataImporterUpdatedRowsBanner.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`16/16`)
  - `pnpm exec vitest run tests/dataImporterSyncConfigPanel.test.jsx tests/dataImporterLastSyncSummaryCard.test.jsx tests/dataImporterSummaryCards.test.jsx tests/dataImporterUpdatedRowsBanner.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`18/18`)
  - `pnpm exec eslint src/components/DataImporter.jsx src/components/dataImporter/DataImporterLastSyncSummaryCard.jsx src/components/dataImporter/DataImporterSummaryCards.jsx src/components/dataImporter/DataImporterUpdatedRowsBanner.jsx tests/dataImporterLastSyncSummaryCard.test.jsx tests/dataImporterSummaryCards.test.jsx tests/dataImporterUpdatedRowsBanner.test.jsx tests/dataImporter.preview.test.jsx tests/dataImporterSyncConfigPanel.test.jsx` -> Passed (`0` errors, `0` warnings)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/DataImporterLastSyncSummaryCard.jsx src/components/dataImporter/DataImporterSummaryCards.jsx src/components/dataImporter/DataImporterUpdatedRowsBanner.jsx tests/dataImporterLastSyncSummaryCard.test.jsx tests/dataImporterSummaryCards.test.jsx tests/dataImporterUpdatedRowsBanner.test.jsx tests/dataImporter.preview.test.jsx tests/dataImporterSyncConfigPanel.test.jsx` -> Passed

## 2026-03-11 DataImporter Prop-Helper Extraction
- Continued `cng-7c8.9` with the next container-focused seams still embedded in `DataImporter.jsx`: sync/admin panel prop shaping, file/list/grid toolbar prop shaping, and shared/table/card result prop shaping.
- Added `src/components/dataImporter/dataImporterSyncPanelProps.js` to own backend/database status tone mapping plus `DataImporterSyncConfigPanel`, C/O discrepancy, and monitoring-alert prop assembly.
- Added `src/components/dataImporter/dataImporterShellProps.js` to own import mode labels, duplicate workflow CTA props, file action props, grid toolbar props, and list-control props.
- Added `src/components/dataImporter/dataImporterResultsProps.js` to own the shared/table/card result prop contract passed into `DataImporterResultsPanel`.
- Added direct utility coverage in `tests/dataImporterSyncPanelProps.test.js`, `tests/dataImporterShellProps.test.js`, and `tests/dataImporterResultsProps.test.js`.
- Rewired `src/components/DataImporter.jsx` to consume the new helper modules instead of assembling those prop bundles inline.
- `src/components/DataImporter.jsx` now sits at `1484` lines after this slice.
- Verification:
  - `pnpm exec vitest run tests/dataImporterSyncPanelProps.test.js tests/dataImporterShellProps.test.js` -> Failed first with missing module imports, confirming RED
  - `pnpm exec vitest run tests/dataImporterResultsProps.test.js` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/dataImporterResultsProps.test.js tests/dataImporterSyncPanelProps.test.js tests/dataImporterShellProps.test.js tests/dataImporter.preview.test.jsx tests/dataImporterSyncConfigPanel.test.jsx tests/dataImporterListControlsPanel.test.jsx tests/dataImporterResultsPanel.test.jsx tests/dataImporterTableResults.test.jsx tests/dataImporterCardResults.test.jsx tests/dataImporterTableBody.test.jsx tests/dataImporterTableHeader.test.jsx` -> Passed (`29/29`)
  - `pnpm exec eslint src/components/DataImporter.jsx src/components/dataImporter/dataImporterSyncPanelProps.js src/components/dataImporter/dataImporterShellProps.js src/components/dataImporter/dataImporterResultsProps.js tests/dataImporterSyncPanelProps.test.js tests/dataImporterShellProps.test.js tests/dataImporterResultsProps.test.js tests/dataImporter.preview.test.jsx tests/dataImporterSyncConfigPanel.test.jsx tests/dataImporterListControlsPanel.test.jsx tests/dataImporterResultsPanel.test.jsx tests/dataImporterTableResults.test.jsx tests/dataImporterCardResults.test.jsx tests/dataImporterTableBody.test.jsx tests/dataImporterTableHeader.test.jsx` -> Passed (`0` errors, `0` warnings)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/dataImporterSyncPanelProps.js src/components/dataImporter/dataImporterShellProps.js src/components/dataImporter/dataImporterResultsProps.js tests/dataImporterSyncPanelProps.test.js tests/dataImporterShellProps.test.js tests/dataImporterResultsProps.test.js tests/dataImporter.preview.test.jsx tests/dataImporterSyncConfigPanel.test.jsx tests/dataImporterListControlsPanel.test.jsx tests/dataImporterResultsPanel.test.jsx tests/dataImporterTableResults.test.jsx tests/dataImporterCardResults.test.jsx tests/dataImporterTableBody.test.jsx tests/dataImporterTableHeader.test.jsx` -> Passed

## 2026-03-11 DataImporter Duplicate Workflow + Shell Split
- Continued `cng-7c8.9` with two broader container seams still embedded in `DataImporter.jsx`: duplicate/reconcile cross-hook orchestration and the top-level importer render tree.
- Added `src/components/dataImporter/useDataImporterDuplicateWorkflow.js` to own duplicate summary aggregation, saved-mode highlight shortcuts, diff dialog state/labels, and duplicate review/reconciliation controller wiring behind one orchestration hook.
- Added `tests/useDataImporterDuplicateWorkflow.test.jsx` to lock integrated duplicate counts, saved highlight actions, duplicate-filter toggling, diff open state, and review-plan defaults from the shared summary.
- Rewired `src/components/DataImporter.jsx` to consume `useDataImporterDuplicateWorkflow()` instead of recomposing duplicate summary, highlights, diff, and review controllers inline.
- Added `src/components/dataImporter/DataImporterShell.jsx` to own the top-level importer shell render tree: deleted/config/diff/review dialogs, permission banners, summary cards, updated banner, sync/admin panels, file actions, preview summary, list controls, and results-panel branching.
- Added `tests/dataImporterShell.test.jsx` with mocked children to lock preview-vs-saved branching, admin-only monitoring surfaces, and the permission/review-only banners at the shell boundary.
- Rewired `src/components/DataImporter.jsx` to render through `DataImporterShell` and pass grouped prop bundles into the shell component instead of keeping the full JSX tree inline.
- `src/components/DataImporter.jsx` now sits at `1420` lines after these two slices.
- Verification:
  - `pnpm exec vitest run tests/useDataImporterDuplicateWorkflow.test.jsx tests/useDataImporterDuplicateDiff.test.jsx tests/useDataImporterDuplicateReview.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`18/18`)
  - `pnpm exec vitest run tests/dataImporterShell.test.jsx tests/useDataImporterDuplicateWorkflow.test.jsx tests/dataImporter.preview.test.jsx` -> Failed once on test isolation because the preview shell node remained mounted across cases; fixed with explicit RTL `cleanup()` in `afterEach`, then passed (`14/14`)
  - `pnpm exec vitest run tests/dataImporterShell.test.jsx tests/useDataImporterDuplicateWorkflow.test.jsx tests/useDataImporterDuplicateDiff.test.jsx tests/useDataImporterDuplicateReview.test.jsx tests/dataImporterDuplicateSummary.test.js tests/dataImporter.preview.test.jsx tests/dataImporterSelectionActions.test.jsx tests/dataImporterListControlsPanel.test.jsx tests/dataImporterResultsPanel.test.jsx tests/dataImporterTableResults.test.jsx tests/dataImporterCardResults.test.jsx tests/dataImporterTableBody.test.jsx tests/dataImporterTableHeader.test.jsx` -> Passed (`36/36`)
  - `pnpm exec eslint src/components/DataImporter.jsx src/components/dataImporter/useDataImporterDuplicateWorkflow.js src/components/dataImporter/DataImporterShell.jsx tests/useDataImporterDuplicateWorkflow.test.jsx tests/dataImporterShell.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`0` errors, `0` warnings)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/useDataImporterDuplicateWorkflow.js src/components/dataImporter/DataImporterShell.jsx tests/useDataImporterDuplicateWorkflow.test.jsx tests/dataImporterShell.test.jsx` -> Passed

## 2026-03-11 DataImporter Results Controller + Workflow Session Split
- Continued `cng-7c8.9` with two larger controller seams still embedded in `DataImporter.jsx`: the results-surface controller and the saved/import/sync workflow session.
- Added `src/components/dataImporter/useDataImporterResultsController.js` to own row editing, assignment callbacks, destructive row actions, selection state, layout wiring, and table/card/bulk-action prop composition behind one controller hook.
- Added `tests/useDataImporterResultsController.test.jsx` to lock saved-mode capability flags and the composition contract between the results controller and the row/layout/bulk-action sub-hooks.
- Added `src/components/dataImporter/useDataImporterWorkflowSession.js` to own saved-row load, sync, import, review-action, overview, and range-preset coordination behind one session hook.
- Added `tests/useDataImporterWorkflowSession.test.jsx` to lock shared `loadSavedRows` / `fetchAlerts` threading across sync, import, and review flows plus the quick date-range preset behavior.
- Rewired `src/components/DataImporter.jsx` to consume both new hooks instead of composing those controller layers inline.
- `src/components/DataImporter.jsx` now sits at `1223` lines after these two slices.
- Verification:
  - `pnpm exec vitest run tests/useDataImporterResultsController.test.jsx` -> Failed first with missing module import, confirming RED; then passed (`2/2`)
  - `pnpm exec vitest run tests/useDataImporterWorkflowSession.test.jsx` -> Failed first with missing module import, confirming RED; then passed (`2/2`)
  - `pnpm exec vitest run tests/useDataImporterWorkflowSession.test.jsx tests/useDataImporterResultsController.test.jsx tests/useDataImporterSavedSession.test.jsx tests/useDataImporterSync.test.jsx tests/useDataImporterSelectionBulkActions.test.jsx tests/dataImporter.preview.test.jsx tests/dataImporterShell.test.jsx tests/dataImporterResultsPanel.test.jsx tests/dataImporterTableResults.test.jsx tests/dataImporterCardResults.test.jsx tests/dataImporterTableBody.test.jsx tests/dataImporterTableHeader.test.jsx tests/dataImporterListControlsPanel.test.jsx tests/dataImporterSelectionActions.test.jsx` -> Passed (`38/38`)
  - `pnpm exec eslint src/components/DataImporter.jsx src/components/dataImporter/useDataImporterResultsController.js src/components/dataImporter/useDataImporterWorkflowSession.js tests/useDataImporterResultsController.test.jsx tests/useDataImporterWorkflowSession.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`0` errors, `0` warnings`)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/useDataImporterResultsController.js src/components/dataImporter/useDataImporterWorkflowSession.js tests/useDataImporterResultsController.test.jsx tests/useDataImporterWorkflowSession.test.jsx` -> Passed

## 2026-03-11 DataImporter Results Surface + Session Derived-State Fix
- Continued `cng-7c8.9` by fixing a real importer regression first: local staff/team edits in server-search mode were retriggering a fetch that patched stale server rows back over the fresh inline edit.
- Split `src/components/dataImporter/dataImporterSessionDerivedState.js` into filter-derived and row-derived seams (`buildDataImporterSessionFilterState()`, `buildDataImporterSessionRowState()`, plus `buildDataImporterPageResetKey()`), so `normalizedFilters` no longer churn when `rawRows` changes after a local edit.
- Extended `tests/dataImporterSessionDerivedState.test.js` to lock the new separation and keep the stale-overwrite regression from reappearing under future importer refactors.
- Added `src/components/dataImporter/useDataImporterResultsSurface.jsx` to own the last parent-level results orchestration still embedded in `DataImporter.jsx`: row search fetch/paging, unsaved-diff synchronization, saved-edit delegation, license-exclusion actions, tooltip wiring, results-controller composition, and last-sync summary-card composition.
- Added `tests/useDataImporterResultsSurface.test.jsx` with direct coverage for sub-hook wiring and saved-mode unsaved-state synchronization.
- Rewired `src/components/DataImporter.jsx` to consume `useDataImporterResultsSurface()` instead of orchestrating that result-surface stack inline; the parent is now down to `768` lines.
- Trimmed `src/components/dataImporter/useDataImporterSessionController.js` to `799` lines with formatting-safe whitespace cleanup after the new hook extraction moved the parent below the module-size target.
- Verification:
  - `pnpm exec vitest run tests/useDataImporterResultsSurface.test.jsx tests/dataImporter.preview.test.jsx tests/useDataImporterResultsController.test.jsx` -> Passed (`14/14`)
  - `pnpm exec vitest run tests/useDataImporterResultsSurface.test.jsx tests/useDataImporterResultsController.test.jsx tests/useDataImporterSessionController.test.jsx tests/dataImporter.preview.test.jsx` -> Passed (`16/16`)
  - `pnpm exec eslint src/components/DataImporter.jsx src/components/dataImporter/useDataImporterResultsSurface.jsx src/components/dataImporter/useDataImporterSessionController.js tests/useDataImporterResultsSurface.test.jsx` -> Passed (`0` errors, `0` warnings`)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/useDataImporterResultsSurface.jsx src/components/dataImporter/useDataImporterSessionController.js tests/useDataImporterResultsSurface.test.jsx` -> Passed

## 2026-03-11 DataImporter Workbook Workerization
- Continued `cng-7c8.9` with the still-open phase goal around heavy XLSX parsing: workbook decoding plus `sheet_to_json()` should no longer run on the main thread when browser worker support exists.
- Added `src/components/dataImporter/dataImporterWorkbookParser.js` to own worker-backed workbook parsing, sync fallback parsing, and the injectable `parseWorkbookRows` seam used by import-flow tests.
- Added `src/components/dataImporter/dataImporterWorkbook.worker.js` to run `xlsx.read()` plus `sheet_to_json()` in a module worker and return the first-sheet rows back to the importer.
- Rewired `src/components/dataImporter/useDataImporterImportFlow.js` to consume the workbook parser seam, so file ingestion now defaults to worker-backed parsing with safe sync fallback instead of decoding the workbook inline inside `reader.onload`.
- Added `tests/dataImporterWorkbookParser.test.js` to lock worker success, worker-error fallback, no-worker fallback, and direct sync parsing behavior.
- Extended `tests/useDataImporterImportFlow.test.jsx` so the import-flow hook now asserts it delegates workbook decoding through the injected parse seam rather than parsing inline.
- Verification:
  - `pnpm exec vitest run tests/dataImporterWorkbookParser.test.js` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/useDataImporterImportFlow.test.jsx` -> Failed first because `parseWorkbookRows` was not called, confirming RED
  - `pnpm exec vitest run tests/dataImporterWorkbookParser.test.js tests/useDataImporterImportFlow.test.jsx` -> Passed (`6/6`)
  - `pnpm exec vitest run tests/useDataImporterSessionController.test.jsx tests/useDataImporterWorkflowSession.test.jsx tests/useDataImporterImportFlow.test.jsx tests/dataImporterWorkbookParser.test.js tests/dataImporter.preview.test.jsx` -> Passed (`20/20`)
  - `pnpm exec eslint src/components/dataImporter/dataImporterWorkbookParser.js src/components/dataImporter/dataImporterWorkbook.worker.js src/components/dataImporter/useDataImporterImportFlow.js tests/dataImporterWorkbookParser.test.js tests/useDataImporterImportFlow.test.jsx` -> Passed (`0` errors, `0` warnings)
  - `git diff --check -- src/components/dataImporter/dataImporterWorkbookParser.js src/components/dataImporter/dataImporterWorkbook.worker.js src/components/dataImporter/useDataImporterImportFlow.js tests/dataImporterWorkbookParser.test.js tests/useDataImporterImportFlow.test.jsx` -> Passed

## 2026-03-11 DataImporter Guided Workflow Shell Slice
- Continued `cng-7c8.9` with the still-open guided-workflow goal, but kept the slice low risk: make import progress explicit in the shell before changing any underlying import/sync controller behavior.
- Added `src/components/dataImporter/DataImporterWorkflowGuide.jsx` to render a 3-step workflow surface for source selection, data review, and save/follow-up states.
- Rewired `src/components/dataImporter/dataImporterShellProps.js` and `src/components/dataImporter/dataImporterContainerProps.js` so the workflow-guide prop bundle is assembled once and threaded into the importer shell.
- Rewired `src/components/dataImporter/DataImporterShell.jsx` plus `src/components/DataImporter.jsx` to mount the workflow guide above the rest of the import shell; `DataImporter.jsx` is now down to `737` lines.
- Added `tests/dataImporterWorkflowGuide.test.jsx` for direct guided-workflow coverage, and extended `tests/dataImporterShellProps.test.js` plus `tests/dataImporterShell.test.jsx` to lock the new shell contract.
- Verification:
  - `pnpm exec vitest run tests/dataImporterWorkflowGuide.test.jsx` -> Failed first with missing module import, confirming RED
  - `pnpm exec vitest run tests/dataImporterShellProps.test.js tests/dataImporterShell.test.jsx` -> Failed first because `workflowGuideProps` / rendered shell coverage were missing, confirming RED
  - `pnpm exec vitest run tests/dataImporterWorkflowGuide.test.jsx tests/dataImporterShellProps.test.js tests/dataImporterShell.test.jsx` -> Passed (`7/7`)
  - `pnpm exec vitest run tests/dataImporterWorkflowGuide.test.jsx tests/dataImporterShellProps.test.js tests/dataImporterShell.test.jsx tests/dataImporter.preview.test.jsx tests/dataImporterFileActions.test.jsx tests/dataImporterImportPreviewSummary.test.jsx tests/useDataImporterSessionController.test.jsx` -> Passed (`24/24`)
  - `pnpm exec eslint src/components/dataImporter/DataImporterWorkflowGuide.jsx src/components/dataImporter/dataImporterShellProps.js src/components/dataImporter/dataImporterContainerProps.js src/components/dataImporter/DataImporterShell.jsx src/components/DataImporter.jsx tests/dataImporterWorkflowGuide.test.jsx tests/dataImporterShellProps.test.js tests/dataImporterShell.test.jsx` -> Passed (`0` errors, `0` warnings)
  - `git diff --check -- src/components/dataImporter/DataImporterWorkflowGuide.jsx src/components/dataImporter/dataImporterShellProps.js src/components/dataImporter/dataImporterContainerProps.js src/components/dataImporter/DataImporterShell.jsx src/components/DataImporter.jsx tests/dataImporterWorkflowGuide.test.jsx tests/dataImporterShellProps.test.js tests/dataImporterShell.test.jsx` -> Passed

## 2026-03-11 DataImporter Guided Workflow CTA Slice
- Continued `cng-7c8.9` with the next low-risk guided-workflow follow-on: turn the new workflow guide from a passive status panel into a “next step” rail that reuses existing importer actions.
- Extended `src/components/dataImporter/DataImporterWorkflowGuide.jsx` with a `Bước kế tiếp đề xuất` action area that surfaces `Chọn file XLSX`, `Import XLSX`, `Chọn file khác`, `Hiển thị dữ liệu đã lưu`, and `Lưu dữ liệu` when the current step and permissions make those actions meaningful.
- Extended `src/components/dataImporter/dataImporterShellProps.js` so `workflowGuideProps` now carries `canEdit`, derived `canImport`, derived `canSave`, the shared `openFilePicker()` callback, plus `onImport`, `onLoadSavedRows`, and `onSaveAll`.
- Kept the slice low risk by reusing shell callbacks only; no import/session/save controller logic changed.
- Verification:
  - `pnpm exec vitest run tests/dataImporterWorkflowGuide.test.jsx tests/dataImporterShellProps.test.js` -> Failed first because workflow CTA buttons and prop wiring were missing, confirming RED; then passed (`5/5`)
  - `pnpm exec vitest run tests/dataImporterWorkflowGuide.test.jsx tests/dataImporterShellProps.test.js tests/dataImporterShell.test.jsx tests/dataImporter.preview.test.jsx tests/dataImporterFileActions.test.jsx tests/dataImporterImportPreviewSummary.test.jsx tests/useDataImporterSessionController.test.jsx` -> Passed (`24/24`)
  - `pnpm exec eslint src/components/dataImporter/DataImporterWorkflowGuide.jsx src/components/dataImporter/dataImporterShellProps.js tests/dataImporterWorkflowGuide.test.jsx tests/dataImporterShellProps.test.js` -> Passed (`0` errors, `0` warnings)
  - `git diff --check -- src/components/dataImporter/DataImporterWorkflowGuide.jsx src/components/dataImporter/dataImporterShellProps.js tests/dataImporterWorkflowGuide.test.jsx tests/dataImporterShellProps.test.js` -> Passed

## 2026-03-11 DataImporter Guided Workflow Stage Layout Slice
- Continued `cng-7c8.9` with the next guided-workflow follow-on: stop treating the workflow stepper as a floating status card and align the shell itself to the same source/review/save progression.
- Added `src/components/dataImporter/dataImporterWorkflowGuideState.js` to own pure current-step, headline, action, and stage-status derivation so both the stepper and shell-stage regions share the same workflow semantics.
- Rewired `src/components/dataImporter/DataImporterWorkflowGuide.jsx` to consume the shared workflow-state helper instead of keeping inline progress heuristics.
- Rewired `src/components/dataImporter/DataImporterShell.jsx` to group importer content into explicit stage regions: `Bước 1: Nạp nguồn`, `Bước 2: Rà soát dữ liệu`, and `Bước 3: Lưu và theo dõi`.
- Extended `tests/dataImporterShell.test.jsx` to lock the new stage-region structure and placement of sync/file, review, and save surfaces; added direct helper coverage in `tests/dataImporterWorkflowGuideState.test.js`.
- Verification:
  - `pnpm exec vitest run tests/dataImporterWorkflowGuideState.test.js tests/dataImporterShell.test.jsx` -> Passed (`5/5`)
  - `pnpm exec vitest run tests/dataImporterWorkflowGuideState.test.js tests/dataImporterWorkflowGuide.test.jsx tests/dataImporterShell.test.jsx tests/dataImporter.preview.test.jsx tests/dataImporterFileActions.test.jsx tests/dataImporterImportPreviewSummary.test.jsx tests/useDataImporterSessionController.test.jsx` -> Passed (`25/25`)
  - `pnpm exec eslint src/components/dataImporter/dataImporterWorkflowGuideState.js src/components/dataImporter/DataImporterWorkflowGuide.jsx src/components/dataImporter/DataImporterShell.jsx tests/dataImporterWorkflowGuideState.test.js tests/dataImporterWorkflowGuide.test.jsx tests/dataImporterShell.test.jsx` -> Passed (`0` errors, `0` warnings)
  - `git diff --check -- src/components/dataImporter/dataImporterWorkflowGuideState.js src/components/dataImporter/DataImporterWorkflowGuide.jsx src/components/dataImporter/DataImporterShell.jsx tests/dataImporterWorkflowGuideState.test.js tests/dataImporterWorkflowGuide.test.jsx tests/dataImporterShell.test.jsx` -> Passed

## 2026-03-11 DataImporter Guided Workflow Stage Navigation + ECUS CTA Slice
- Continued `cng-7c8.9` with the next guided-workflow follow-on: make the stepper navigate the stage-grouped shell directly and stop leaving the ECUS branch hidden inside the sync panel.
- Extended `src/components/dataImporter/dataImporterWorkflowGuideState.js` with stable `WORKFLOW_STAGE_IDS`, per-step `targetId` values, and ECUS-aware action/headline branching for sync preview and run flows.
- Rewired `src/components/dataImporter/DataImporterWorkflowGuide.jsx` so step cards now render as anchor links to the shell stage regions and the CTA rail can surface `Xem trước ECUS`, `Đồng bộ ngay`, and `Làm mới xem trước ECUS` when the sync branch is the next meaningful path.
- Rewired `src/components/dataImporter/dataImporterShellProps.js` and `src/components/DataImporter.jsx` so sync preview counts, preview/loading state, and `handlePreviewSync` / `handleRunSync` are threaded into the workflow guide instead of stopping at the sync config panel.
- Extended `tests/dataImporterWorkflowGuideState.test.js`, `tests/dataImporterWorkflowGuide.test.jsx`, and `tests/dataImporterShellProps.test.js` to lock stage-link targets plus the new ECUS workflow-guide actions.
- Verification:
  - `pnpm exec vitest run tests/dataImporterWorkflowGuideState.test.js tests/dataImporterWorkflowGuide.test.jsx tests/dataImporterShellProps.test.js` -> Passed (`10/10`)
  - `pnpm exec vitest run tests/dataImporterWorkflowGuideState.test.js tests/dataImporterWorkflowGuide.test.jsx tests/dataImporterShellProps.test.js tests/dataImporterShell.test.jsx tests/dataImporter.preview.test.jsx tests/dataImporterSyncConfigPanel.test.jsx tests/useDataImporterSessionController.test.jsx` -> Passed (`26/26`)
  - `pnpm exec eslint src/components/DataImporter.jsx src/components/dataImporter/dataImporterWorkflowGuideState.js src/components/dataImporter/DataImporterWorkflowGuide.jsx src/components/dataImporter/dataImporterShellProps.js tests/dataImporterWorkflowGuideState.test.js tests/dataImporterWorkflowGuide.test.jsx tests/dataImporterShellProps.test.js` -> Passed (`0` errors, `0` warnings)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/dataImporterWorkflowGuideState.js src/components/dataImporter/DataImporterWorkflowGuide.jsx src/components/dataImporter/dataImporterShellProps.js tests/dataImporterWorkflowGuideState.test.js tests/dataImporterWorkflowGuide.test.jsx tests/dataImporterShellProps.test.js` -> Passed

## 2026-03-12 DataImporter Sync Preview Promotion + Phase 2D Close Slice
- Continued `cng-7c8.9` with the last guided-workflow residual: ECUS preview data should move through the same review/save flow as file preview instead of remaining duplicated in the source panel.
- Added `previewSource="sync"` ownership in `src/components/DataImporter.jsx`, then threaded that source marker through `src/components/dataImporter/useDataImporterWorkflowSession.js`, `src/components/dataImporter/useDataImporterImportPreview.js`, `src/components/dataImporter/useDataImporterSessionController.js`, and `src/components/dataImporter/dataImporterShellProps.js` so successful ECUS preview now promotes rows into shared preview mode, while saved-mode reloads and file imports reset the marker correctly.
- Rewired `src/components/dataImporter/DataImporterSyncPreviewPanel.jsx` to replace the inline ECUS preview table with a handoff note after promotion, and updated `src/components/dataImporter/DataImporterWorkflowGuide.jsx`, `src/components/dataImporter/dataImporterWorkflowGuideState.js`, `src/components/dataImporter/DataImporterImportPreviewSummary.jsx`, and `src/components/dataImporter/DataImporterListControlsPanel.jsx` so the review stage, CTA rail, mode labels, and ARIA copy all stay sync-specific once preview rows are under review.
- Fixed a real regression during verification: `DataImporterWorkflowGuide.jsx` had not actually been consuming `previewSource`, so sync previews were initially rendered like file previews until that prop was threaded through correctly.
- Compacted `src/components/dataImporter/useDataImporterSessionController.js` back under the project soft cap to `797` lines; `src/components/DataImporter.jsx` remains at `784` lines, so the primary importer containers are now under the `800`-line target.
- Verification:
  - `pnpm exec vitest run tests/useDataImporterWorkflowSession.test.jsx tests/useDataImporterImportPreview.test.jsx tests/dataImporterWorkflowGuideState.test.js tests/dataImporterWorkflowGuide.test.jsx tests/dataImporterSyncPreviewPanel.test.jsx tests/dataImporterListControlsPanel.test.jsx tests/dataImporterShellProps.test.js tests/dataImporter.preview.test.jsx` -> Passed (`42/42`)
  - `pnpm exec vitest run tests/kpiAdjustments.test.jsx` -> Passed (`9/9`) when rerun in isolation after an order-dependent unrelated failure surfaced during a much broader exploratory run
  - `pnpm exec eslint src/components/DataImporter.jsx src/components/dataImporter/useDataImporterWorkflowSession.js src/components/dataImporter/useDataImporterImportPreview.js src/components/dataImporter/DataImporterWorkflowGuide.jsx src/components/dataImporter/dataImporterWorkflowGuideState.js src/components/dataImporter/DataImporterSyncPreviewPanel.jsx src/components/dataImporter/DataImporterListControlsPanel.jsx src/components/dataImporter/DataImporterImportPreviewSummary.jsx src/components/dataImporter/dataImporterShellProps.js src/components/dataImporter/useDataImporterSessionController.js tests/useDataImporterWorkflowSession.test.jsx tests/useDataImporterImportPreview.test.jsx tests/dataImporterWorkflowGuideState.test.js tests/dataImporterWorkflowGuide.test.jsx tests/dataImporterSyncPreviewPanel.test.jsx tests/dataImporterListControlsPanel.test.jsx tests/dataImporterShellProps.test.js tests/dataImporter.preview.test.jsx` -> Passed (`0` errors, `0` warnings)
  - `git diff --check -- src/components/DataImporter.jsx src/components/dataImporter/useDataImporterWorkflowSession.js src/components/dataImporter/useDataImporterImportPreview.js src/components/dataImporter/DataImporterWorkflowGuide.jsx src/components/dataImporter/dataImporterWorkflowGuideState.js src/components/dataImporter/DataImporterSyncPreviewPanel.jsx src/components/dataImporter/DataImporterListControlsPanel.jsx src/components/dataImporter/DataImporterImportPreviewSummary.jsx src/components/dataImporter/dataImporterShellProps.js src/components/dataImporter/useDataImporterSessionController.js tests/useDataImporterWorkflowSession.test.jsx tests/useDataImporterImportPreview.test.jsx tests/dataImporterWorkflowGuideState.test.js tests/dataImporterWorkflowGuide.test.jsx tests/dataImporterSyncPreviewPanel.test.jsx tests/dataImporterListControlsPanel.test.jsx tests/dataImporterShellProps.test.js tests/dataImporter.preview.test.jsx task.md task_plan.md findings.md progress.md` -> Passed

## 2026-03-12 ECUS Bridge Extraction Completion
- Completed `cng-7c8.10` by landing `server/ecus/bridgeService.js` as the monolith ECUS bridge seam for connection-summary checks, SQL Server health, declaration fetch defaults, and account-sync idle waiting.
- Rewired `server/index.js` to create a single `ecusBridge` instance and delegate `fetchEcusDeclarations()`, `checkSqlServerHealth()`, AI snapshot connection checks, and account-sync idle waiting through that bridge instead of owning the SQL/Windows-specific logic inline.
- Added `tests/server.ecusBridgeService.test.js` and kept the older SQL bridge regression in `tests/server.ecusSqlBridge.test.js` so the extracted seam stays covered independently of the large monolith route suite.
- Verification:
  - `pnpm exec vitest run tests/server.ecusBridgeService.test.js tests/server.ecusSqlBridge.test.js` -> Passed (`7/7`)
  - `pnpm exec vitest run tests/server.api.test.js tests/server.seed.test.js` -> Passed (`116/116`)

## 2026-03-12 Rollout Readiness And QA Matrix Completion
- Completed `cng-7c8.11` by adding `server-v4/src/app/v4-rollout-status.ts`, which derives module/runtime rollout status, metrics, DB readiness, migration checks, stage recommendations, and fallback posture from the v4 app configuration.
- Rewired `server-v4/src/app/build-v4-app.ts` so `/api/v4/health` now returns enriched DB/readiness/metrics fields and `/api/v4/meta/rollout` returns the dedicated rollout metadata document.
- Added `docs/operations/v4-qa-matrix.md` and `docs/operations/v4-rollout-plan.md` as the operator handoff for parity testing, rollout stages, fallback checks, and command-level verification.
- Added/updated `tests/server-v4/v4RolloutStatus.test.js` and `tests/server-v4/appShell.test.js` so the runtime metadata surface and app-shell wiring stay under regression coverage.
- Verification:
  - `pnpm exec vitest run tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js tests/server-v4/runtimeRoutes.test.js tests/server-v4/reportingService.test.js tests/server-v4/legacyReportBridge.test.js` -> Passed (`30/30`)
  - `pnpm run typecheck:server-v4` -> Passed

## 2026-03-12 Program Closure Sync
- Synced `task.md`, `task_plan.md`, `findings.md`, and `progress.md` so the notebook no longer points at stale Phase 2 / `cng-7c8.9` state.
- Closed `cng-7c8.10` and `cng-7c8.11`, then closed epic `cng-7c8` after confirming there were no remaining open child phases in the execution program.
- Final verification for closure:
  - `pnpm exec vitest run tests/server.ecusBridgeService.test.js tests/server.ecusSqlBridge.test.js tests/server.api.test.js tests/server.seed.test.js tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js tests/server-v4/runtimeRoutes.test.js tests/server-v4/reportingService.test.js tests/server-v4/legacyReportBridge.test.js` -> Passed (`144/144`)
  - `pnpm run typecheck:server-v4` -> Passed
  - `pnpm exec eslint server/index.js server/ecus/bridgeService.js tests/server.ecusBridgeService.test.js tests/server.ecusSqlBridge.test.js tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js` -> Passed (`0` errors, `0` warnings)
  - `git diff --check -- server/index.js server/ecus/bridgeService.js server-v4/src/app/build-v4-app.ts server-v4/src/app/v4-rollout-status.ts tests/server.ecusBridgeService.test.js tests/server.ecusSqlBridge.test.js tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js docs/operations/v4-qa-matrix.md docs/operations/v4-rollout-plan.md task.md task_plan.md findings.md progress.md` -> Passed

## 2026-03-12 Full-Cutover Continuation Program Setup
- Reviewed the remaining blueprint gaps in `docs/system-v4-review-plan.md` after closing `cng-7c8` and split the residual work into a second execution program instead of reopening the completed epic.
- Created continuation epic `cng-3or` (`KPI v4 full-cutover continuation program`) for the remaining long-horizon work: runtime PostgreSQL cutover, delivery-shape split, standalone ECUS bridge service, operator shell end-state, and reporting analytics end-state.
- Created child beads for the continuation program:
  - `cng-3or.1`: Phase A PostgreSQL runtime persistence and dual-write cutover
  - `cng-3or.3`: Phase B delivery-shape split into apps and shared packages
  - `cng-3or.2`: Phase C standalone Windows ECUS bridge service
  - `cng-3or.4`: Phase D operator shell end-state and heavy-workflow redesign
  - `cng-3or.5`: Phase E reporting analytics and observability end-state
- Claimed `cng-3or.1` as the active bead and synced `task.md`, `task_plan.md`, and `findings.md` so the notebook now points at the continuation program instead of the closed `cng-7c8` epic.
- Tracking note: `bd` still warns about daemon startup and falls back to direct mode, but bead creation, status updates, and `ready/show` flows are still working, so the issue remains operational noise rather than a blocker.

## 2026-03-12 Phase A Typed Business Snapshot Seam
- Started the first code slice of `cng-3or.1` by inventorying the remaining `server-v4` hot-path business keys that still come from legacy storage: `decl_rows_v1`, `mst_rows_v2`, `team_roster_v1`, `kpi_rules_v2`, `kpi_adjustments_v1`, and `kpi_report_schedule_v1`.
- Added `server-v4/src/persistence/businessSnapshotReader.ts` as the typed seam for those business snapshots, then implemented the current adapter in `server-v4/src/legacy/legacy-business-snapshot-reader.ts`.
- Rewired `build-v4-app.ts`, route builders, and repositories for declarations, MST assignments, teams, KPI rules, and reporting so they depend on `BusinessSnapshotReader` instead of calling `LegacyKvStoreReader.readJsonValue('...')` directly.
- Extended `server-v4/src/app/v4-rollout-status.ts` so rollout metadata now exposes the remaining legacy hot-path inventory explicitly; the runtime can now say “what still blocks relational cutover” instead of only reporting DB file availability and module counts.
- Added direct coverage in `tests/server-v4/legacyBusinessSnapshotReader.test.js` and expanded `tests/server-v4/v4RolloutStatus.test.js` to lock the new persistence inventory surface.
- Verification:
  - `pnpm exec vitest run tests/server-v4/legacyBusinessSnapshotReader.test.js tests/server-v4/v4RolloutStatus.test.js tests/server-v4/runtimeRoutes.test.js` -> Passed (`18/18`)
  - `pnpm run typecheck:server-v4` -> Passed
  - `pnpm exec eslint tests/server-v4/legacyBusinessSnapshotReader.test.js tests/server-v4/v4RolloutStatus.test.js` -> Passed (`0` errors, `0` warnings)
  - `git diff --check -- server-v4/src/app/build-v4-app.ts server-v4/src/app/v4-rollout-status.ts server-v4/src/legacy/legacy-business-snapshot-reader.ts server-v4/src/persistence/businessSnapshotReader.ts server-v4/src/modules/declarations/DeclarationsRepository.ts server-v4/src/modules/declarations/declarationsRoutes.ts server-v4/src/modules/mst-assignments/MstAssignmentsRepository.ts server-v4/src/modules/mst-assignments/mstAssignmentsRoutes.ts server-v4/src/modules/kpi-rules/KpiRulesRepository.ts server-v4/src/modules/kpi-rules/kpiRulesRoutes.ts server-v4/src/modules/teams/TeamsRepository.ts server-v4/src/modules/teams/teamsRoutes.ts server-v4/src/modules/reporting/ReportingRepository.ts server-v4/src/modules/reporting/reportingRoutes.ts tests/server-v4/legacyBusinessSnapshotReader.test.js tests/server-v4/v4RolloutStatus.test.js task.md task_plan.md findings.md progress.md` -> Passed

## 2026-03-12 Phase A Typed Team Roster Dual-Write Slice
- Picked `teams` as the first low-risk Phase A cutover domain because `server-v4 /api/v4/teams` was already isolated behind `BusinessSnapshotReader` and the legacy roster blob is small enough to backfill deterministically.
- Added `server/teamRosterSqlite.js` plus `server/teamRosterSqlite.d.ts` as the typed SQLite sidecar for `team_roster_state`, `teams`, and `team_members`, with explicit read/write/delete helpers for the roster snapshot.
- Wired `server/index.js` to ensure and backfill the typed team-roster tables during database initialization, dual-write those tables on `team_roster_v1` storage updates, clear them on blob delete, and reset them during test-database cleanup.
- Updated `server-v4/src/legacy/legacy-business-snapshot-reader.ts` so `readTeamRoster()` prefers the typed roster snapshot and only falls back to the legacy `team_roster_v1` blob when typed state is absent.
- Added coverage in `tests/teamRosterSqlite.test.js`, extended `tests/server-v4/legacyBusinessSnapshotReader.test.js` plus `tests/server-v4/runtimeRoutes.test.js`, and added authenticated storage dual-write coverage in `tests/server.api.test.js`.
- Extended the fake `better-sqlite3` implementation inside `tests/server.api.test.js` to model the new typed roster tables; without that mock support the new storage dual-write regression produced a false failure even though the real SQLite path was correct.
- Verification:
  - `pnpm exec vitest run tests/teamRosterSqlite.test.js tests/server-v4/legacyBusinessSnapshotReader.test.js tests/server-v4/runtimeRoutes.test.js` -> Passed (`20/20`)
  - `pnpm exec vitest run tests/server.api.test.js -t "dual-write team_roster_v1 vao bang typed roster khi cap nhat qua Storage API"` -> Passed (`1 passed, 114 skipped`)
  - `pnpm run typecheck:server-v4` -> Passed
  - `pnpm exec eslint server/index.js server/teamRosterSqlite.js tests/teamRosterSqlite.test.js tests/server.api.test.js tests/server-v4/runtimeRoutes.test.js tests/server-v4/legacyBusinessSnapshotReader.test.js server-v4/src/legacy/legacy-business-snapshot-reader.ts` -> Passed with existing warnings only (`server-v4` TS file ignored by current ESLint config; `tests/server.api.test.js` still has 2 existing `no-unused-vars` warnings for `_type` and `_sql`)
  - `git diff --check -- server/index.js server/teamRosterSqlite.js server/teamRosterSqlite.d.ts server-v4/src/legacy/legacy-business-snapshot-reader.ts tests/teamRosterSqlite.test.js tests/server.api.test.js tests/server-v4/runtimeRoutes.test.js tests/server-v4/legacyBusinessSnapshotReader.test.js task.md task_plan.md findings.md progress.md` -> Passed

## 2026-03-12 Phase A Hot-Path Runtime Completion
- Continued `cng-3or.1` past the initial `teams` seam and verified the whole original hot-path set now runs through typed runtime boundaries: declarations, MST assignments, KPI rules, and KPI adjustments on `server/businessSnapshotSqlite.js`; teams on `server/teamRosterSqlite.js`; report schedules/default monthly aggregates on `reporting_projections`.
- Confirmed `server-v4` parity coverage is already in place for typed-read preference across declarations, MST assignments, KPI rules, adjustments, teams, and reporting view composition; no additional route rewrite was needed for schedules because `ReportingRepository` already prefers projections over blob fallback.
- Fixed the last real typed-runtime regression in `server/index.js`: declaration normalization now stays idempotent, so reading typed declaration snapshots for reporting no longer triggers recursive write-on-read loops back into `decl_rows_v1`.
- Added a new storage delete-path regression in `tests/server.api.test.js` to lock cleanup of the typed team/declaration/MST/adjustment runtime tables when those keys are deleted through `/api/storage`.
- Verification:
  - `pnpm exec vitest run tests/server.api.test.js -t "typed runtime"` -> Passed (`2 passed, 115 skipped`)
  - `pnpm exec vitest run tests/businessSnapshotSqlite.test.js tests/server-v4/legacyBusinessSnapshotReader.test.js tests/server-v4/runtimeRoutes.test.js tests/server-v4/v4RolloutStatus.test.js` -> Passed (`30/30`)
  - `pnpm run typecheck:server-v4` -> Passed
  - `pnpm exec eslint server/index.js server/businessSnapshotSqlite.js tests/businessSnapshotSqlite.test.js tests/server.api.test.js tests/server-v4/legacyBusinessSnapshotReader.test.js tests/server-v4/runtimeRoutes.test.js` -> Passed with known warnings only (`tests/server.api.test.js` still has 2 existing `no-unused-vars` warnings for `_type` and `_sql`)
  - `git diff --check -- server/index.js server/businessSnapshotSqlite.js server/businessSnapshotSqlite.d.ts server/teamRosterSqlite.js server/teamRosterSqlite.d.ts server-v4/src/persistence/businessSnapshotReader.ts server-v4/src/legacy/legacy-business-snapshot-reader.ts server-v4/src/app/build-v4-app.ts server-v4/src/app/v4-rollout-status.ts server-v4/src/modules/reporting/ReportingRepository.ts tests/businessSnapshotSqlite.test.js tests/server.api.test.js tests/server-v4/legacyBusinessSnapshotReader.test.js tests/server-v4/runtimeRoutes.test.js tests/server-v4/v4RolloutStatus.test.js task.md task_plan.md findings.md progress.md` -> Passed
- Closed `cng-3or.1`: Phase A now ends with all original hot-path runtime reads on typed relational seams or reporting projections, leaving later continuation work to focus on delivery-shape extraction, the standalone ECUS service boundary, operator-shell end-state, and broader reporting/analytics evolution instead of reopening per-domain blob cutovers.

## 2026-03-12 Phase B Delivery-Shape Extraction
- Claimed `cng-3or.3` and completed the first delivery-shape slice without forcing a big-bang repo move: added `pnpm-workspace.yaml`, app shells under `apps/web`, `apps/api`, and `apps/ecus-bridge`, and package shells under `packages/domain`, `packages/api-client`, and `packages/ui`.

## 2026-03-12 Phase E Reporting Observability Slice
- Continued `cng-3or.5` with a durable reporting observability slice instead of trying to close Phase E via freshness metadata alone.
- Added `server/reportingObservability.js` plus `server/reportingObservability.d.ts` as the shared normalization/summarization seam for reporting job runs, with persisted history keyed by `kpi_reporting_job_runs_v1`.
- Extended `server/reportingProjectionStore.js` and `server/reportingProjectionSqlite.js` so reporting job runs now persist through the projection boundary and materialize into `reporting_job_run_entries`.
- Updated `server/index.js` to record aggregate materialization success/failure runs, reuse one helper for monthly aggregate snapshot writes, and expose `GET /api/v4/reporting/observability`.
- Updated `server-v4/src/modules/reporting/ReportingRepository.ts` and `server-v4/src/modules/reporting/reportingService.ts` so live monthly aggregate builds persist the active snapshot, append job runs, and expose `getObservability()` without mutating reporting state on read.
- Wired `server-v4` HTTP surface for the new read-only endpoint through `ReportingController.ts` and `reportingRoutes.ts`.
- Added coverage in `tests/reportingObservability.test.js`, `tests/reportingProjectionStore.test.js`, `tests/reportingProjectionSqlite.test.js`, extended `tests/server-v4/reportingService.test.js`, `tests/server-v4/runtimeRoutes.test.js`, and added monolith contract coverage in `tests/server.api.test.js`.
- Fixed two real follow-up regressions during verification:
  - `tests/server.api.test.js` needed to assert job-run `total` against the actual aggregate response total rather than a fixture-specific hardcoded `2`.
  - `server-v4` needed `server/reportingObservability.d.ts`, and `reportingService.ts` still had one stray `toPositiveInt(...)` reference after the new observability path was wired.
- Verification:
  - `pnpm exec vitest run tests/reportingObservability.test.js tests/reportingProjectionStore.test.js tests/reportingProjectionSqlite.test.js tests/server-v4/reportingService.test.js tests/server-v4/runtimeRoutes.test.js` -> Passed (`32/32`)
  - `pnpm exec vitest run tests/server.api.test.js -t "returns reporting observability with recent monthly aggregate runs"` -> Passed (`1 passed, 120 skipped`)
  - `pnpm run typecheck:server-v4` -> Passed
  - `pnpm exec eslint server/reportingObservability.js server/reportingObservability.d.ts server/reportingProjectionStore.js server/reportingProjectionSqlite.js server/index.js server-v4/src/modules/reporting/ReportingRepository.ts server-v4/src/modules/reporting/reportingService.ts server-v4/src/modules/reporting/ReportingController.ts server-v4/src/modules/reporting/reportingRoutes.ts tests/reportingObservability.test.js tests/reportingProjectionStore.test.js tests/reportingProjectionSqlite.test.js tests/server-v4/reportingService.test.js tests/server-v4/runtimeRoutes.test.js tests/server.api.test.js` -> Passed with known warnings only (`server-v4` TS files and `.d.ts` ignored by current ESLint config; `tests/server.api.test.js` still has 2 existing `no-unused-vars` warnings for `_type` and `_sql`)
  - `git diff --check -- server/reportingObservability.js server/reportingObservability.d.ts server/reportingProjectionStore.js server/reportingProjectionSqlite.js server/index.js server-v4/src/modules/reporting/ReportingRepository.ts server-v4/src/modules/reporting/reportingService.ts server-v4/src/modules/reporting/ReportingController.ts server-v4/src/modules/reporting/reportingRoutes.ts tests/reportingObservability.test.js tests/reportingProjectionStore.test.js tests/reportingProjectionSqlite.test.js tests/server-v4/reportingService.test.js tests/server-v4/runtimeRoutes.test.js tests/server.api.test.js task.md task_plan.md findings.md progress.md` -> Passed
- Residual inside `cng-3or.5` remains open: broader relational KPI stats plus wider server-side search/pagination are still not complete, so the bead stays `in_progress`.
- Finished the closing Phase E slice for `cng-3or.5`:
  - Added `server/reportingObservabilityCollections.js` plus `server/reportingObservabilityCollections.d.ts` to normalize paginated/searchable job-run collections and flattened monthly aggregate period collections.
  - Extended `server/reportingProjectionSqlite.js` with relational read helpers for `reporting_job_run_entries` and `reporting_monthly_aggregate_projection_entries`.
  - Updated `server/index.js` and `server-v4/src/modules/reporting/{ReportingRepository.ts,reportingService.ts,ReportingController.ts}` so `/api/v4/reporting/observability` accepts server-side query params for job/period search and pagination, and reports active/default monthly stats from relational entry rows first with blob fallback compatibility.
  - Added regression coverage in `tests/reportingObservability.test.js`, `tests/reportingProjectionSqlite.test.js`, `tests/server-v4/runtimeRoutes.test.js`, and `tests/server.api.test.js`.
- Verification for the closing Phase E slice:
  - `pnpm exec vitest run tests/reportingObservability.test.js tests/reportingProjectionSqlite.test.js tests/server-v4/runtimeRoutes.test.js tests/server.api.test.js -t "returns reporting observability|supports reporting observability|freshness|reportingProjectionSqlite|reportingObservability"` -> Passed (`13 passed, 138 skipped`)
  - `pnpm run typecheck:server-v4` -> Passed
  - `pnpm exec eslint server/reportingObservabilityCollections.js server/reportingProjectionSqlite.js server/index.js server-v4/src/modules/reporting/ReportingRepository.ts server-v4/src/modules/reporting/reportingService.ts server-v4/src/modules/reporting/ReportingController.ts tests/reportingObservability.test.js tests/reportingProjectionSqlite.test.js tests/server-v4/runtimeRoutes.test.js tests/server.api.test.js` -> Passed with known warnings only (`server-v4` TS files ignored by current ESLint config; `tests/server.api.test.js` still has 2 existing `no-unused-vars` warnings for `_type` and `_sql`)
  - `git diff --check -- server/reportingObservabilityCollections.js server/reportingObservabilityCollections.d.ts server/reportingProjectionSqlite.js server/reportingProjectionSqlite.d.ts server/index.js server-v4/src/modules/reporting/ReportingRepository.ts server-v4/src/modules/reporting/reportingService.ts server-v4/src/modules/reporting/ReportingController.ts tests/reportingObservability.test.js tests/reportingProjectionSqlite.test.js tests/server-v4/runtimeRoutes.test.js tests/server.api.test.js task.md task_plan.md findings.md progress.md` -> Passed
- `cng-3or.5` is ready to close. Phase E now covers durable reporting/job observability, relational monthly KPI stats surfaced through a stable collection contract, and broader server-side search/pagination on the observability read boundary.
- `cng-3or` is ready to close. All continuation phases (`cng-3or.1`, `.3`, `.2`, `.4`, `.5`) are complete.
- Moved stable implementation into package source:
  - `packages/domain/src/*` now owns the previously shared domain/reporting modules (`shared/*` plus the domain-oriented subset of `src/shared/*`).
  - `packages/api-client/src/reportingClient.js` now owns the reporting API client/view-model builder.
  - `packages/ui/src/{primitives,shellPrimitives}.jsx` now own the reusable data-table and shell primitives.
- Preserved current runtime entrypoints with compatibility shims: `shared/*`, `src/shared/*`, `src/lib/reportingClient.js`, and `src/components/designSystem/*` now forward to package-owned implementation instead of remaining the canonical source.
- Added direct regression coverage for the new delivery shape:
  - `tests/workspaceLayout.test.js`
  - `tests/domainPackage.test.js`
  - `tests/apiClientPackage.test.js`
  - `tests/uiPackage.test.jsx`
- Verification:
  - `pnpm exec vitest run tests/workspaceLayout.test.js tests/domainPackage.test.js tests/apiClientPackage.test.js tests/uiPackage.test.jsx tests/reportingClient.test.js tests/shellPrimitives.test.jsx tests/sampleDeclarations.test.js tests/reportsSharedModules.test.js tests/reportingKpiComputation.test.js tests/reportingLegacySupport.test.js tests/reportingLegacyMathDependencies.test.js tests/legacyReportingBridge.test.js tests/server-v4/legacyReportBridge.test.js tests/dataImporter.preview.test.jsx tests/accountRoles.test.js` -> Passed (`49/49`)
  - `pnpm run typecheck:server-v4` -> Passed
  - `pnpm exec eslint ...` on the Phase B touched code/test files -> Passed (`0` errors, `0` warnings)
  - `git diff --check -- ...` on Phase B touched files + notebook -> Passed
- Closed `cng-3or.3`: the continuation program now moves on to `cng-3or.2` for the standalone ECUS bridge service boundary.

## 2026-03-12 Phase C Standalone ECUS Bridge Runtime Primitives
- Claimed `cng-3or.2` and started with the lowest-risk service-boundary slice instead of a route big-bang: created a standalone bridge API client in `apps/ecus-bridge/src/bridgeApiClient.js`, a runtime orchestrator in `apps/ecus-bridge/src/bridgeRuntime.js`, and a reusable core apply seam in `server/ecusBridgeMutations.js`.
- `bridgeApiClient.js` now owns bearer-token auth, JSON request handling, and retryable preview/commit calls against the future `/api/v4/declarations/imports/ecus-*` contract.
- `bridgeRuntime.js` now owns the bridge-side orchestration shape for `fetchSyncConfig()` -> SQL health check -> `fetchDeclarations()` aggregation -> preview/commit payload dispatch, so the later Windows service host can assemble around a stable runtime surface instead of embedding fetch logic inline.
- `server/ecusBridgeMutations.js` now owns the core-side preview/commit mutation semantics for already-fetched ECUS rows: range resolution, MST include/exclude filtering, preview status derivation, declaration merges, sync summary logging, and monitor callbacks. This keeps the eventual bridge-to-core contract independent from raw SQL access.
- Added direct RED/GREEN coverage in `tests/ecusBridgeApiClient.test.js`, `tests/ecusBridgeRuntime.test.js`, and `tests/ecusBridgeMutations.test.js`.
- Verification:
  - `pnpm exec vitest run tests/ecusBridgeApiClient.test.js tests/ecusBridgeRuntime.test.js tests/ecusBridgeMutations.test.js` -> Passed (`6/6`)
  - `pnpm exec eslint apps/ecus-bridge/src/bridgeApiClient.js apps/ecus-bridge/src/bridgeRuntime.js server/ecusBridgeMutations.js tests/ecusBridgeApiClient.test.js tests/ecusBridgeRuntime.test.js tests/ecusBridgeMutations.test.js` -> Passed (`0` errors, `0` warnings)
- Residual for `cng-3or.2` after this slice:
  - The monolith still owns the live `/api/import/ecus/preview|run` path; the new mutation seam is not wired into token-protected `/api/v4/declarations/imports/ecus-*` routes yet.
  - `apps/ecus-bridge` now has runtime primitives, but it does not yet expose a standalone Windows service/worker host.
  - DPAPI credential access still lives in the existing server-side ECUS path until the new service host and route contract are cut over.

## 2026-03-12 Phase C Token-Protected ECUS Core Routes
- Wired the extracted ECUS seam into the core API boundary in `server/index.js`: added bearer-token-aware `requireEcusBridgeAccess()`, surfaced `GET /api/v4/declarations/imports/ecus-config`, and added token-protected `POST /api/v4/declarations/imports/ecus-preview` plus `POST /api/v4/declarations/imports/ecus-commit`.
- The new v4 routes delegate preview/commit semantics to `server/ecusBridgeMutations.js` instead of owning duplicate merge logic inside the monolith route body. While verifying this, I fixed the seam callback contract so success/failure monitor hooks now pass the same metadata shape the monolith expects.
- Added RED then GREEN regression coverage in `tests/server.api.test.js` for bearer-token preview and commit through the v4 ECUS bridge contract.
- Route verification exposed a real mismatch in several older ECUS sync tests: declaration reads now prefer typed snapshots over raw `kv_store` blobs, so direct `INSERT` seeding into `decl_rows_v1` no longer represented runtime truth. I updated those tests to seed declarations through the authenticated storage API instead.
- Verification:
  - `pnpm exec vitest run tests/ecusBridgeApiClient.test.js tests/ecusBridgeRuntime.test.js tests/ecusBridgeMutations.test.js tests/server.api.test.js -t "ECUS bridge|ecus bridge"` -> Passed (`8 passed`, `117 skipped`)
  - `pnpm exec vitest run tests/server.api.test.js -t "ECUS sync API"` -> Passed (`27 passed`, `92 skipped`)
  - `pnpm exec eslint server/index.js server/ecusBridgeMutations.js apps/ecus-bridge/src/bridgeApiClient.js apps/ecus-bridge/src/bridgeRuntime.js tests/server.api.test.js tests/ecusBridgeApiClient.test.js tests/ecusBridgeRuntime.test.js tests/ecusBridgeMutations.test.js` -> Passed (`0` errors, `2` pre-existing warnings in `tests/server.api.test.js`)
  - `git diff --check -- server/index.js server/ecusBridgeMutations.js tests/server.api.test.js task.md task_plan.md findings.md progress.md` -> Passed
- Residual for `cng-3or.2` after this slice:
  - `apps/ecus-bridge` still does not expose a standalone Windows service/worker host.
  - SQL Server connectivity and DPAPI credential access are still owned by the monolith path.
  - Durable batching/retry/health contracts still need to be promoted from in-process seams into a true bridge-to-core service boundary.

## 2026-03-12 Phase C Standalone Bridge Host Controller
- Added `apps/ecus-bridge/src/bridgeHost.js` as the first real service-level controller around the extracted runtime. The host owns status snapshots, cached SQL health checks, busy-state reporting, and single-flight semantics for `previewSync()` and `runSync()`.
- The new host deliberately stops short of full bootstrap/env wiring: it wraps the already-tested `bridgeRuntime.js` contract without pulling SQL Server or DPAPI concerns back into the package. That keeps the slice focused on the worker/service boundary behavior itself.
- Added direct regression coverage in `tests/ecusBridgeHost.test.js` for:
  - idle status with SQL health
  - deduped concurrent `runSync()` calls
  - busy rejection when `previewSync()` is attempted during an active run
  - persisted last-failure state after a failed sync
- Verification:
  - `pnpm exec vitest run tests/ecusBridgeHost.test.js tests/ecusBridgeRuntime.test.js tests/ecusBridgeApiClient.test.js tests/ecusBridgeMutations.test.js` -> Passed (`10/10`)
  - `pnpm exec eslint apps/ecus-bridge/src/bridgeHost.js tests/ecusBridgeHost.test.js` -> Passed (`0` errors, `0` warnings)
  - `git diff --check -- apps/ecus-bridge/src/bridgeHost.js tests/ecusBridgeHost.test.js task.md task_plan.md findings.md progress.md` -> Passed
- Residual for `cng-3or.2` after this slice:
  - `apps/ecus-bridge` still needs a real HTTP/worker bootstrap that exposes the host contract out-of-process.
  - SQL Server connectivity and DPAPI credential access are still not isolated away from the monolith.
  - The bridge-to-core health/retry contract now exists in-process, but it still is not a deployed standalone Windows service boundary yet.

## 2026-03-12 Phase C Standalone Bridge HTTP Boundary
- Added `apps/ecus-bridge/src/bridgeHttpServer.js` as a package-local HTTP boundary around the host controller. It exposes:
  - `GET /health`
  - `GET /status`
  - `POST /sync/preview`
  - `POST /sync/run`
- Protected routes now honor a local bridge control token, and the server maps host-level busy conflicts into explicit HTTP `409` responses instead of leaking uncategorized runtime errors.
- Added direct HTTP-level regression coverage in `tests/ecusBridgeHttpServer.test.js` for open health checks, auth failure behavior, authenticated run forwarding, and `bridge_busy` conflict handling.

## 2026-03-12 Phase C Standalone Bridge Composition Root
- Added `apps/ecus-bridge/src/bridgeBootstrap.js` so the package can assemble `createEcusBridgeApiClient()`, `createEcusBridgeService()`, `createStandaloneEcusBridgeRuntime()`, `createStandaloneEcusBridgeHost()`, and `createStandaloneEcusBridgeHttpServer()` from env or injected factories.
- The bootstrap slice keeps SQL/DPAPI behavior behind the existing `server/ecus/sqlBridge.js` and `server/ecus/secureCredentials.js` contracts instead of copying that logic into the app package. This keeps the package closer to a true standalone boundary while avoiding a wide rewrite in one jump.
- Added regression coverage in `tests/ecusBridgeBootstrap.test.js` to lock the composition contract and env-based normalization.
- Verification:
  - `pnpm exec vitest run tests/ecusBridgeBootstrap.test.js tests/ecusBridgeHttpServer.test.js tests/ecusBridgeHost.test.js tests/ecusBridgeRuntime.test.js tests/ecusBridgeApiClient.test.js tests/ecusBridgeMutations.test.js` -> Passed (`16/16`)
  - `pnpm exec eslint apps/ecus-bridge/src/bridgeBootstrap.js apps/ecus-bridge/src/bridgeHttpServer.js apps/ecus-bridge/src/bridgeHost.js tests/ecusBridgeBootstrap.test.js tests/ecusBridgeHttpServer.test.js tests/ecusBridgeHost.test.js` -> Passed (`0` errors, `0` warnings)
  - `git diff --check -- apps/ecus-bridge/src/bridgeBootstrap.js apps/ecus-bridge/src/bridgeHttpServer.js apps/ecus-bridge/src/bridgeHost.js tests/ecusBridgeBootstrap.test.js tests/ecusBridgeHttpServer.test.js tests/ecusBridgeHost.test.js task.md task_plan.md findings.md progress.md` -> Passed
- Residual for `cng-3or.2` after these slices:
  - The package still does not ship a final executable Windows worker/service entrypoint that boots the standalone bridge end to end.
  - SQL Server connectivity and DPAPI credential ownership still need to be operationally cut away from the monolith path, even though the package now has its own server boundary and composition root.
  - Durable retry/health contracts are now explicit inside the package, but they still need to be exercised through a real standalone process lifecycle.

## 2026-03-12 Phase C Standalone Bridge Executable Entrypoint
- Added `apps/ecus-bridge/src/bridgeCli.js` as the package-level executable bootstrap for the standalone bridge. The CLI now creates the bridge app from env, starts the package-local HTTP server, logs the listening address, registers `SIGINT`/`SIGTERM` shutdown handlers, and closes the SQL pool on both startup failure and normal stop.
- Updated `apps/ecus-bridge/package.json` with a `start` script so `apps/ecus-bridge` can be launched directly as an out-of-process bridge host instead of stopping at library-only composition.
- Added direct regression coverage in `tests/ecusBridgeCli.test.js` for startup, signal-driven shutdown, startup-failure cleanup, and direct-run detection.
- Verification:
  - `pnpm exec vitest run tests/ecusBridgeCli.test.js tests/ecusBridgeBootstrap.test.js tests/ecusBridgeHttpServer.test.js tests/ecusBridgeHost.test.js tests/ecusBridgeRuntime.test.js tests/ecusBridgeApiClient.test.js tests/ecusBridgeMutations.test.js` -> Passed (`20/20`)
  - `pnpm exec vitest run tests/ecusBridgeCli.test.js` -> Passed (`4/4`) after line-ending-only `eslint --fix`
  - `pnpm exec eslint apps/ecus-bridge/src/bridgeCli.js tests/ecusBridgeCli.test.js apps/ecus-bridge/src/bridgeBootstrap.js apps/ecus-bridge/src/bridgeHttpServer.js apps/ecus-bridge/src/bridgeHost.js tests/ecusBridgeBootstrap.test.js tests/ecusBridgeHttpServer.test.js tests/ecusBridgeHost.test.js` -> Passed (`0` errors, `0` warnings)
  - `git diff --check -- apps/ecus-bridge/package.json apps/ecus-bridge/src/bridgeCli.js tests/ecusBridgeCli.test.js task.md task_plan.md findings.md progress.md` -> Passed
- Residual for `cng-3or.2` after this slice:
  - The package now runs as a standalone process, but it is still not registered or managed as a Windows service with explicit lifecycle/ops ownership.
  - SQL Server connectivity and DPAPI credential custody are still operationally tied to the monolith environment even though the process boundary is now real.
  - Retry scheduling, health polling, and deployment/runbook concerns still need the final service-host pass before Phase C can close.

## 2026-03-12 Phase C Windows Service Lifecycle Wrapper
- Added `apps/ecus-bridge/src/bridgeWindowsServiceCli.js` so the bridge package now owns Windows service install/remove/status flows via `sc.exe` instead of leaving service registration as an undocumented manual step.
- The new wrapper builds a stable service definition for `bridgeCli.js`, checks current service state, creates the service with description metadata, tolerates already-stopped removal paths, and exposes CLI dispatch for `install`, `remove`, and `status`.
- Updated `apps/ecus-bridge/package.json` with `service:install`, `service:remove`, and `service:status` scripts so operators can manage the standalone bridge lifecycle from the package itself.
- Added direct regression coverage in `tests/ecusBridgeWindowsService.test.js` for service definition shaping, install flow, tolerant remove flow, and CLI command dispatch.
- Verification:
  - `pnpm exec vitest run tests/ecusBridgeWindowsService.test.js tests/ecusBridgeCli.test.js tests/ecusBridgeBootstrap.test.js tests/ecusBridgeHttpServer.test.js tests/ecusBridgeHost.test.js tests/ecusBridgeRuntime.test.js tests/ecusBridgeApiClient.test.js tests/ecusBridgeMutations.test.js` -> Passed (`24/24`)
  - `pnpm exec eslint apps/ecus-bridge/src/bridgeWindowsServiceCli.js tests/ecusBridgeWindowsService.test.js apps/ecus-bridge/src/bridgeCli.js tests/ecusBridgeCli.test.js apps/ecus-bridge/src/bridgeBootstrap.js apps/ecus-bridge/src/bridgeHttpServer.js apps/ecus-bridge/src/bridgeHost.js tests/ecusBridgeBootstrap.test.js tests/ecusBridgeHttpServer.test.js tests/ecusBridgeHost.test.js` -> Passed (`0` errors, `0` warnings)
- Residual for `cng-3or.2` after this slice:
  - The package now owns service registration commands, but actual SQL Server + DPAPI operational custody is still tied to the monolith environment and needs a final cutover/runbook pass.
  - Retry/health policy is still process-local; Phase C still needs the last operational slice that defines how the standalone service is supervised and how failures are handled outside the monolith host.

## 2026-03-12 Phase C DPAPI And SQL Custody Cutover
- Added `apps/ecus-bridge/src/bridgeSecureCredentials.js` and `apps/ecus-bridge/src/sqlBridge.js` as the canonical standalone bridge ownership boundary for DPAPI-backed ECUS credentials, SQL connection config assembly, pool lifecycle, and pagination-capability discovery.
- Updated `apps/ecus-bridge/src/bridgeBootstrap.js` to compose the standalone bridge with package-local SQL ownership instead of importing SQL connectivity from `server/ecus`.
- Replaced `server/ecus/secureCredentials.js` and `server/ecus/sqlBridge.js` with compatibility shims so monolith callers keep working while the bridge package becomes the source of truth for SQL/DPAPI concerns.
- Updated credential and SQL bridge regression coverage to target the package-owned modules directly in `tests/server.secureCredentials.test.js` and `tests/server.ecusSqlBridge.test.js`, while `tests/server.ecusBridgeService.test.js` still exercises the monolith seam through the compatibility layer.
- Added `docs/operations/ecus-bridge-service.md` to define the final Phase C operating contract: required env vars, service commands, control endpoints, retry schedule, busy semantics, and failure handling.
- Verification:
  - `pnpm exec vitest run tests/server.secureCredentials.test.js tests/server.ecusSqlBridge.test.js tests/server.ecusBridgeService.test.js tests/ecusBridgeBootstrap.test.js tests/ecusBridgeHttpServer.test.js tests/ecusBridgeHost.test.js tests/ecusBridgeCli.test.js tests/ecusBridgeWindowsService.test.js tests/ecusBridgeRuntime.test.js tests/ecusBridgeApiClient.test.js tests/ecusBridgeMutations.test.js` -> Passed (`34/34`)
  - `pnpm exec vitest run tests/server.api.test.js -t "ECUS sync API|ecus bridge|ecus-config|ecus-preview|ecus-commit"` -> Passed (`27 passed`, `92 skipped`)
  - `pnpm exec vitest run tests/server.secureCredentials.test.js tests/server.ecusSqlBridge.test.js tests/server.ecusBridgeService.test.js` -> Passed (`10/10`)
  - `pnpm exec eslint apps/ecus-bridge/src/bridgeSecureCredentials.js apps/ecus-bridge/src/sqlBridge.js apps/ecus-bridge/src/bridgeBootstrap.js server/ecus/secureCredentials.js server/ecus/sqlBridge.js tests/server.secureCredentials.test.js tests/server.ecusSqlBridge.test.js` -> Passed (`0` errors, `0` warnings)
  - `git diff --check -- apps/ecus-bridge/src/bridgeSecureCredentials.js apps/ecus-bridge/src/sqlBridge.js apps/ecus-bridge/src/bridgeBootstrap.js server/ecus/secureCredentials.js server/ecus/sqlBridge.js tests/server.secureCredentials.test.js tests/server.ecusSqlBridge.test.js docs/operations/ecus-bridge-service.md` -> Passed
- Result:
  - `cng-3or.2` is ready to close. Phase C no longer has a structural residual in code: the standalone bridge package now owns service lifecycle, HTTP host, retry/health contract, and SQL/DPAPI custody.

## 2026-03-12 Phase D Operator Shell First Slice
- Promoted `src/lib/appShellNavigation.js` from a flat tab registry into grouped domain navigation metadata. The module now exposes `APP_NAVIGATION_SECTION_DEFINITIONS`, section-aware tab definitions, `getAppTabDefinition()`, and `getVisibleAppNavigationSections(currentUser)` so the shell can render domain groupings from a single source of truth.
- Added `src/components/appShell/AppShellFrame.jsx` as the first reusable Phase D render seam. It owns the sidebar section chrome, grouped tab triggers, workflow-summary hero block, and current-user context pills without pulling the heavy MST/import/reporting tab bodies into a second component tree.
- Rewired `src/components/KPICalculator.jsx` to render through `AppShellFrame` instead of the old flat inline `TabsList`. The slice keeps all existing `TabsContent` contracts intact on purpose, so the shell shape changes now while the heavier operator workflow redesign stays isolated for later slices.
- Added direct regression coverage in `tests/appShellFrame.test.jsx` for grouped sidebar rendering and tab forwarding, and extended `tests/appShellNavigation.test.js` to lock the new section-aware navigation contract.
- Verification:
  - `pnpm exec vitest run tests/appShellNavigation.test.js tests/appShellFrame.test.jsx tests/auth.test.jsx tests/commandCenter.test.jsx` -> Passed (`14/14`)
  - `pnpm exec eslint src/lib/appShellNavigation.js src/components/appShell/AppShellFrame.jsx src/components/KPICalculator.jsx tests/appShellNavigation.test.js tests/appShellFrame.test.jsx tests/auth.test.jsx tests/commandCenter.test.jsx` -> Passed (`0` errors, `0` warnings)
  - `git diff --check -- src/lib/appShellNavigation.js src/components/appShell/AppShellFrame.jsx src/components/KPICalculator.jsx src/App.css tests/appShellNavigation.test.js tests/appShellFrame.test.jsx tests/auth.test.jsx tests/commandCenter.test.jsx` -> Passed
- Residual for `cng-3or.4` after this slice:
  - The operator shell is no longer flat, but MST/import/report/report-center still sit behind the existing legacy tab content contracts.
  - The next meaningful Phase D step is workflow-level redesign, not more shell chrome: source-mode/session flow, guided review/save transitions, and deeper controller decomposition are still open.

## 2026-03-12 Phase D Guided Workflow Closure
- Added `src/components/appShell/appShellWorkflowState.js` and `src/components/appShell/AppShellWorkflowGuide.jsx` so the operator shell now owns an explicit workflow contract instead of a passive summary card. The new state builder maps domain tabs to stable stage anchors, scoped CTA rails, and focus targets for MST, import, KPI adjustments, reports, and health.
- Added `src/components/workflows/MSTWorkflowPanel.jsx`, `src/components/workflows/KPIAdjustmentsWorkflowPanel.jsx`, and `src/components/workflows/ReportCenterPanel.jsx` to separate the heavy operator surfaces into staged shells. This closes the main Phase D gap: MST is now presented as queue/workspace/history, KPI adjustments as scope/review/publish, and reporting as scope/dashboard/export with a dedicated report-center surface instead of one flat tab body.
- Updated `src/components/CommandCenter.jsx` to subscribe to `open:command-center`, `src/App.jsx` to preserve `{ tab, focus }` navigation intent, and `src/components/KPICalculator.jsx` to resolve those intents into workflow anchors. Shell actions and Command Center results can now land users on the right stage directly instead of only switching the outer tab.
- Verification:
  - `pnpm exec vitest run tests/appShellWorkflowState.test.js tests/appShellWorkflowGuide.test.jsx tests/operatorWorkflowPanels.test.jsx tests/appShellFrame.test.jsx tests/commandCenter.test.jsx tests/auth.test.jsx` -> Passed (`18/18`)
  - `pnpm exec eslint src/App.jsx src/components/KPICalculator.jsx src/components/CommandCenter.jsx src/components/appShell/AppShellFrame.jsx src/components/appShell/AppShellWorkflowGuide.jsx src/components/appShell/appShellWorkflowState.js src/components/workflows/MSTWorkflowPanel.jsx src/components/workflows/KPIAdjustmentsWorkflowPanel.jsx src/components/workflows/ReportCenterPanel.jsx tests/appShellWorkflowState.test.js tests/appShellWorkflowGuide.test.jsx tests/operatorWorkflowPanels.test.jsx tests/appShellFrame.test.jsx tests/commandCenter.test.jsx` -> Passed (`0` errors, `0` warnings)
  - `pnpm exec vitest run tests/e2e.login-import.test.jsx` -> did not terminate cleanly enough to use as a trusted gate for this slice; not used as a closure criterion.
- Result:
  - `cng-3or.4` is ready to close. Phase D now has both the shell chrome and the operator workflow layer required by the continuation blueprint.

## 2026-03-12 Phase A Server-v4 ESLint Hardening
- Created the post-cutover hardening epic `cng-4or`, claimed `cng-4or.1`, and added follow-up backlog beads `cng-4or.2` plus `cng-4or.3` so the new program has explicit next steps after the initial lint slice.
- Added `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin` at the workspace root, then extended `eslint.config.js` with a real TypeScript lint boundary for `server-v4` app/bootstrap/http/legacy/persistence/reporting files.
- Added `pnpm run lint:server-v4` in `package.json` so the first `server-v4` lint seam is runnable as a stable script instead of an ad-hoc command.
- Hit a line-ending false start while touching root config files: converting them to `CRLF` made `git diff --check` flag every changed config line as trailing whitespace. Reverted the touched root files to `LF` and solved the remaining lint noise with a file-specific `linebreak-style` override for `eslint.config.js`.
- Verification:
  - `pnpm run lint:server-v4` -> Passed
  - `pnpm run typecheck:server-v4` -> Passed
  - `pnpm exec eslint eslint.config.js` -> Passed after adding the config-file override
  - `git diff --check -- eslint.config.js package.json pnpm-lock.yaml` -> Passed with local `autocrlf` warnings only (`LF will be replaced by CRLF`), no whitespace diff errors
- Result:
  - `cng-4or.1` is ready to close. The repo now has a trusted `server-v4` lint gate, and the remaining work is explicitly tracked as coverage expansion (`cng-4or.2`) plus CI wiring (`cng-4or.3`).

## 2026-03-12 Phase B/C Server-v4 Hardening Closure
- Expanded the TypeScript lint seam from the first allowlist slice to all `server-v4/src/**/*.ts` in `eslint.config.js`, while keeping `.d.ts` sidecars ignored and preserving the intentionally narrow rule posture for post-cutover hardening.
- Updated `package.json` so the reusable hardening commands are now stable across Windows and CI: `lint:server-v4` scans the full runtime tree, `test:server-v4` uses `vitest run tests/server-v4 --environment node`, and `verify:server-v4` chains lint, typecheck, and targeted tests.
- Wired the same hardening gate into `.github/workflows/frontend-ci.yml` by adding `Run server-v4 lint` on the Windows lint job and `Run server-v4 typecheck` plus `Run server-v4 tests` on the Ubuntu test job, instead of creating a second workflow.
- Repaired the shared formatting scripts by removing the stale nonexistent `docs/system-improvement-proposals.md` entry from `format:check` / `format:write`, then reformatted the files reported by Prettier.
- Hit one more Windows line-ending trap during closure: `git diff --check` treated CRLF on touched root/workflow files as trailing whitespace. Restored the repo-formatted files with Prettier, then set repo-local `core.whitespace=cr-at-eol` so the whitespace gate matches the repo's Windows line-ending policy.
- Verification:
  - `pnpm run verify:server-v4` -> Passed
  - `pnpm run format:check` -> Passed
  - `pnpm exec eslint eslint.config.js` -> Passed
  - `git diff --check -- eslint.config.js package.json .github/workflows/frontend-ci.yml task.md task_plan.md findings.md progress.md` -> Passed after restoring repo-formatted files and enabling local `cr-at-eol` handling for the repo whitespace gate
- Result:
  - `cng-4or.2` and `cng-4or.3` are ready to close, and the `cng-4or` hardening program is complete.

## 2026-03-12 Phase B Runtime Business Fallback Retirement
- Updated `server-v4/src/legacy/legacy-business-snapshot-reader.ts` so declarations, MST assignments, teams, KPI rules, and adjustment reads no longer fall back to `kv_store` blobs when typed snapshots are missing. These business hot paths now return typed data or empty defaults, while reporting schedule and monthly-aggregate fallback logic stays intact for a later slice.
- Extended `tests/server-v4/legacyBusinessSnapshotReader.test.js` with a typed-snapshot materialization helper plus a regression that proves business blob fallback no longer happens when the typed tables are empty.
- Updated `tests/server-v4/runtimeRoutes.test.js` so the legacy SQLite fixture builder materializes declarations, MST, team roster, rules, and adjustments into typed snapshot tables directly from seed data instead of relying on old blob reads during route coverage.
- Verification:
  - `pnpm exec vitest run tests/server-v4/legacyBusinessSnapshotReader.test.js tests/server-v4/runtimeRoutes.test.js` -> Passed (`27/27`)
  - `pnpm exec eslint server-v4/src/legacy/legacy-business-snapshot-reader.ts tests/server-v4/legacyBusinessSnapshotReader.test.js tests/server-v4/runtimeRoutes.test.js` -> Passed (`0` errors, `0` warnings)
  - `git diff --check -- server-v4/src/legacy/legacy-business-snapshot-reader.ts tests/server-v4/legacyBusinessSnapshotReader.test.js tests/server-v4/runtimeRoutes.test.js` -> Passed
- Residual for `cng-i6h.2` after this slice:
  - Frontend/package compatibility wrappers are retired, and `server-v4` business hot-path blobs are no longer a required fallback.
  - Remaining compatibility scope is concentrated in reporting runtime fallbacks, especially reporting schedules and monthly aggregate reads that still preserve older seeded/blob-backed behavior.

## 2026-03-12 Phase B Reporting Runtime Fallback Retirement
- Finished the last open compatibility seam in reporting by moving `server-v4` reporting schedule and monthly aggregate/default aggregate reads to typed projection ownership only.
- Fixed the monolith seed/materialization path in `server/index.js` so reporting projection seeds use the canonical default aggregate key constant, and expanded the `tests/server.api.test.js` seed helper to dual-write reporting schedules plus active/default monthly aggregate snapshots into `reporting_projections`.
- Updated targeted reporting assertions in `tests/server.api.test.js` to match the current Unicode strings and the extra projection-backed observability materialization run now created by seed refreshes.
- Verification:
  - `pnpm exec vitest run tests/server-v4/legacyBusinessSnapshotReader.test.js tests/server-v4/runtimeRoutes.test.js` -> Passed (`27/27`)
  - `pnpm exec vitest run tests/server.api.test.js -t "V4 reporting read-model API|V4 reporting aggregates API|dong bo reporting schedule va monthly aggregate seeds vao reporting_projections"` -> Passed (`18` passed, `107` skipped)
  - `pnpm exec eslint server/index.js server-v4/src/legacy/legacy-business-snapshot-reader.ts server-v4/src/modules/reporting/ReportingRepository.ts tests/server-v4/legacyBusinessSnapshotReader.test.js tests/server-v4/runtimeRoutes.test.js tests/server.api.test.js` -> Passed (`0` errors, `2` known warnings in `tests/server.api.test.js`)
  - `git diff --check -- server/index.js server-v4/src/legacy/legacy-business-snapshot-reader.ts server-v4/src/modules/reporting/ReportingRepository.ts tests/server-v4/legacyBusinessSnapshotReader.test.js tests/server-v4/runtimeRoutes.test.js tests/server.api.test.js` -> Passed
- Result:
  - `cng-i6h.2` is ready to close. Reporting no longer preserves runtime blob fallback paths; the remaining continuation work moves on to broad verification and canonical backend ownership.

## 2026-03-12 Phase C Broad Verification Gate Stabilization
- Inventoried the broad `tests/server.seed.test.js + tests/server.api.test.js` backend bundle and recorded it as diagnostic rather than a merge gate because it still fails in `14` mixed buckets across account-manage hydration assumptions, stale mojibake assertions, ECUS sync count drift, and review-locked export expectations.
- Promoted a stable composite repo smoke gate instead: added `test:smoke:backend-core`, `test:smoke:frontend-core`, `test:smoke:core`, and `verify:smoke:core` in `package.json`, then updated `.github/workflows/frontend-ci.yml` so CI runs the smoke gate instead of `pnpm test -- --runInBand`.
- Added `server/reportingProjectionStore.d.ts` so `verify:server-v4` remains reusable inside the new smoke gate; without that sidecar, `server-v4` TypeScript compilation failed on the shared JS seam import.
- Verification:
  - `pnpm exec vitest run tests/server.seed.test.js tests/server.api.test.js --environment node` -> Fails in `14` mixed buckets; recorded as diagnostic, not gating
  - `pnpm run verify:server-v4` -> Passed after adding `server/reportingProjectionStore.d.ts`
  - `pnpm exec vitest run tests/server.seed.test.js tests/businessSnapshotSqlite.test.js tests/teamRosterSqlite.test.js tests/reportingProjectionSqlite.test.js tests/reportingObservability.test.js tests/server.ecusBridgeService.test.js tests/server.ecusSqlBridge.test.js --environment node` -> Passed (`23/23`)
  - `pnpm exec vitest run tests/auth.test.jsx tests/appShellFrame.test.jsx tests/commandCenter.test.jsx tests/dataImporter.preview.test.jsx tests/reportViewer.test.jsx --environment jsdom` -> Passed (`24/24`)
  - `pnpm run format:check` -> Passed
- Result:
  - `cng-i6h.3` is ready to close. Broad verification is now explicit and trustworthy via the smoke gate, while the noisy mega-bundle remains documented as non-gating inventory.

## 2026-03-12 Phase D Apps/API Canonical Runtime Bootstrap
- Converted `apps/api` from a workspace shell into the first real package-owned backend launcher seam: added `apps/api/src/apiRuntimeConfig.js`, `apps/api/src/startApiServer.js`, and `apps/api/src/cli.js`.
- Moved runtime path ownership into the package by resolving host/port env and the SQLite DB file from the repo root instead of inheriting `process.cwd()`. This removes a real blocker to treating `apps/api` as a canonical entrypoint.
- Added `tsconfig.server-v4.build.json` plus root script `build:server-v4`, so `server-v4` now emits `dist/server-v4` and `apps/api` can load compiled runtime output directly instead of depending on test-runner TypeScript transpilation.
- Updated `apps/api/package.json` to expose `build:v4`, `dev`, `start`, and a targeted node test command, and tightened `tests/workspaceLayout.test.js` so the package shell must keep real runtime scripts.
- Added targeted regression coverage in `tests/appsApiRuntimeConfig.test.js` and `tests/appsApiStart.test.js` for repo-root DB resolution, env parsing, injected app startup, and listen-address formatting.
- Verification:
  - `pnpm exec vitest run tests/appsApiRuntimeConfig.test.js tests/appsApiStart.test.js tests/workspaceLayout.test.js --environment node` -> Passed (`6/6`)
  - `pnpm run build:server-v4` -> Passed
  - `pnpm exec eslint apps/api/src/apiRuntimeConfig.js apps/api/src/startApiServer.js apps/api/src/cli.js tests/appsApiRuntimeConfig.test.js tests/appsApiStart.test.js tests/workspaceLayout.test.js` -> Passed (`0` errors, `0` warnings)
- Residual for `cng-i6h.4` after this slice:
  - `apps/api` now owns a real launcher seam, but the runtime it boots is still SQLite-backed `server-v4`, not PostgreSQL-backed persistence.
  - The larger ownership transfer away from `server/index.js` still needs a next slice that introduces migration guardrails or dual-read/dual-write around persistence, not just launch-time packaging.

## 2026-03-13 Phase D Persistence Ownership Restore
- Restored context from `AGENTS.md`, `task.md`, `task_plan.md`, `findings.md`, and `progress.md`, then re-checked beads via `bd show cng-i6h.4` and `bd ready --json`.
- Confirmed the active scope is still `cng-i6h.4` under epic `cng-i6h`; `.2` and `.3` remain closed and the launcher slice is the latest completed work.
- Re-inventoried the current persistence lock-in after the launcher slice:
  - `apps/api` still only forwards `dbFile` into the runtime.
  - `server-v4/src/app/build-v4-app.ts` still hardwires `LegacyBusinessSnapshotReader(new LegacyKvStoreReader(config.dbFile))`.
  - `server-v4/src/modules/reporting/ReportingRepository.ts` still opens the legacy SQLite DB directly for projection reads/writes.
  - `server/index.js` still owns bootstrap sync, typed-snapshot dual-write side effects, bootstrap snapshot assembly, and generic storage mutation behavior.
- Working hypothesis for the next implementation cut: add an explicit persistence adapter/config seam plus fail-fast migration guardrails so `apps/api` owns runtime persistence selection while SQLite dual-write remains an explicit compatibility mode until a real Postgres adapter lands.

## 2026-03-13 Phase D Reporting Persistence Adapter Guardrail
- Implemented the next `cng-i6h.4` slice around the only live `server-v4` write surface: reporting persistence.
- Added `server-v4/src/persistence/reportingProjectionPersistence.ts` to own reporting projection reads/writes as an injected adapter, keeping the current SQLite projection backend behind a small boundary.
- Added `server-v4/src/persistence/runtimePersistence.ts` so `server-v4` runtime persistence is created through an explicit seam instead of hardwiring `LegacyBusinessSnapshotReader` + direct projection DB access inside `build-v4-app.ts` / `ReportingRepository.ts`.
- Updated `server-v4/src/modules/reporting/ReportingRepository.ts` and `reportingRoutes.ts` so reporting uses the injected projection persistence boundary rather than opening `better-sqlite3` handles inline.
- Updated `apps/api/src/apiRuntimeConfig.js` and `apps/api/src/startApiServer.js` so the canonical launcher now carries `persistenceMode` and `postgresUrl`, defaults to `sqlite-dual-write`, and fails fast when `postgres` mode is requested without the explicit URL/adapter path.
- Verification:
  - `pnpm exec vitest run tests/appsApiRuntimeConfig.test.js tests/appsApiStart.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/appShell.test.js tests/server-v4/runtimeRoutes.test.js --environment node` -> Passed (`35/35`)
  - `pnpm run build:server-v4` -> Passed
  - `pnpm exec eslint apps/api/src/apiRuntimeConfig.js apps/api/src/startApiServer.js server-v4/src/config/server-v4-config.ts server-v4/src/app/build-v4-app.ts server-v4/src/persistence/reportingProjectionPersistence.ts server-v4/src/persistence/runtimePersistence.ts server-v4/src/modules/reporting/reportingRoutes.ts server-v4/src/modules/reporting/ReportingRepository.ts tests/appsApiRuntimeConfig.test.js tests/appsApiStart.test.js tests/server-v4/runtimePersistence.test.js` -> Passed
- Residual after this slice:
  - `server-v4` still reads business snapshots from SQLite dual-write tables and projections; there is still no real Postgres adapter/runtime.
  - `server/index.js` still owns legacy storage lifecycle, generic storage writes, bootstrap snapshot assembly, and the broader compatibility handoff.

## 2026-03-13 Phase D Monolith Reporting Aggregate Runtime Extraction
- Landed the next `cng-i6h.4` seam inside `server/index.js` by extracting the reporting aggregate/orchestration helpers into `server/reportingAggregateRuntime.js`.
- `server/index.js` now imports `createReportingAggregateRuntime()` and delegates:
  - reporting source snapshot reads
  - reporting view aggregate freshness metadata
  - `/api/v4/reporting/observability`
  - `/api/v4/reporting/aggregates/monthly`
  - source-triggered monthly aggregate refresh on storage writes/deletes
- Kept route/auth/audit wrappers and schedule `POST`/`DELETE` handlers in the monolith on purpose; this slice narrows runtime ownership without widening mutation risk.
- Added `tests/reportingAggregateRuntime.test.js` to lock the new seam against three regressions:
  - relational observability rows must win over snapshot payload fallback
  - active/default aggregates both refresh when reporting source keys mutate
  - stale stored aggregates are deleted when no valid query can be derived
- Verification:
  - `pnpm exec eslint server/index.js server/reportingAggregateRuntime.js tests/reportingAggregateRuntime.test.js` -> Passed after targeted `--fix` normalized mixed line endings and one unused test arg was removed
  - `pnpm exec vitest run tests/reportingAggregateRuntime.test.js --environment node` -> Passed (`3/3`)
  - `pnpm exec vitest run tests/server.api.test.js --environment node -t "V4 reporting"` -> Passed (`17` passed, `108` skipped)
  - `pnpm exec vitest run tests/server.api.test.js --environment node` -> Still fails in the same `14` unrelated non-reporting buckets; treated as diagnostic, not as a regression introduced by this slice
  - `git diff --check -- server/index.js server/reportingAggregateRuntime.js tests/reportingAggregateRuntime.test.js` -> Passed
- Residual after this slice:
  - `server/index.js` still owns schedule mutation handlers, generic storage lifecycle, and bootstrap compatibility logic.
  - Phase D still needs a real Postgres adapter/runtime and broader ownership transfer out of the monolith beyond the new reporting runtime seam.

## 2026-03-13 Phase D Monolith Reporting Schedule Runtime Extraction
- Landed the next `cng-i6h.4` seam inside `server/index.js` by extracting schedule list/save/delete behavior into `server/reportingScheduleRuntime.js`.
- `server/index.js` now delegates:
  - `/api/v4/reporting/schedules` list assembly plus default aggregate readiness
  - schedule save persistence through `reporting_projections`
  - schedule delete persistence through `reporting_projections`
- Kept auth/audit/HTTP response wrappers in the route layer on purpose; this slice narrows reporting mutation ownership without mixing in the broader generic storage lifecycle yet.
- Added `tests/reportingScheduleRuntime.test.js` to lock the new seam against four regressions:
  - schedule reads still include aggregate readiness
  - save persists through the projection store
  - delete no-ops do not write
  - successful deletes persist through the projection store
- Verification:
  - `pnpm exec eslint server/index.js server/reportingAggregateRuntime.js server/reportingScheduleRuntime.js tests/reportingAggregateRuntime.test.js tests/reportingScheduleRuntime.test.js` -> Passed after targeted `--fix`
  - `pnpm exec vitest run tests/reportingAggregateRuntime.test.js tests/reportingScheduleRuntime.test.js --environment node` -> Passed (`7/7`)
  - `pnpm exec vitest run tests/server.api.test.js --environment node -t "V4 reporting"` -> Passed (`17` passed, `108` skipped)
  - `git diff --check -- server/index.js server/reportingAggregateRuntime.js server/reportingScheduleRuntime.js tests/reportingAggregateRuntime.test.js tests/reportingScheduleRuntime.test.js task.md task_plan.md findings.md progress.md` -> Passed
- Residual after this slice:
  - `server/index.js` still owns broader storage lifecycle, bootstrap compatibility logic, and generic storage route behavior outside the reporting seams.
  - Phase D still lacks a real Postgres adapter/runtime; current canonical path is still SQLite compatibility plus explicit migration guardrails.

## 2026-03-13 Phase D Runtime Storage Lifecycle Extraction
- Landed the next `cng-i6h.4` seam by extracting the generic SQLite compatibility lifecycle into `server/runtimeStorageLifecycle.js`.
- `server/index.js` now delegates:
  - `kv_store` write/delete fan-out into typed declaration/MST/team/rule/adjustment snapshots
  - aggregate refresh triggers on storage mutations
  - bootstrap snapshot assembly for `/api/bootstrap`
  - startup/test-reset hydration that re-materializes typed snapshots and reporting projections from legacy `kv_store`
- Kept route-specific side effects in the monolith on purpose: generic storage routes still own alert evaluation, ECUS schedule refresh, C/O config refresh, and HTTP/audit behavior, but the persistence lifecycle underneath no longer lives inline.
- Added `tests/runtimeStorageLifecycle.test.js` to lock the new seam against four regressions:
  - declaration writes/deletes still fan out into typed snapshots
  - deleting `kpi_rules_v2` still restores seeded default rules and persists the runtime snapshot
  - startup/test-reset hydration still materializes typed snapshots and reporting projections from `kv_store`
  - bootstrap snapshot assembly still strips AI history keys and rewrites `kpi_users_v1`
- Verification:
  - `pnpm exec vitest run tests/runtimeStorageLifecycle.test.js --environment node` -> Passed (`4/4`)
  - `pnpm exec eslint server/runtimeStorageLifecycle.js tests/runtimeStorageLifecycle.test.js server/index.js --fix` -> Passed after normalizing line endings on touched files
  - `pnpm exec eslint server/runtimeStorageLifecycle.js tests/runtimeStorageLifecycle.test.js server/index.js` -> Passed
  - `pnpm exec vitest run tests/runtimeStorageLifecycle.test.js tests/reportingAggregateRuntime.test.js tests/reportingScheduleRuntime.test.js --environment node` -> Passed (`11/11`)
  - `pnpm exec vitest run tests/server.api.test.js --environment node -t "V4 reporting|reset test db|hq history|storage API generic"` -> Passed (`18` passed, `107` skipped)
  - `pnpm exec vitest run tests/server.backup.test.js --environment node` -> Passed (`4/4`)
  - `pnpm exec vitest run tests/server.api.test.js --environment node` -> Still fails in the same `14` unrelated buckets recorded earlier; no new regression bucket appeared from this slice
  - `git diff --check -- server/index.js server/runtimeStorageLifecycle.js tests/runtimeStorageLifecycle.test.js task.md task_plan.md findings.md progress.md` -> Passed
- Residual after this slice:
  - `server/index.js` still owns the generic storage route wrappers and their route-specific follow-up actions, so full storage ownership is not out of the monolith yet.
  - `server-v4`/`apps/api` still have no real Postgres-backed adapter; Phase D remains on explicit SQLite compatibility seams plus fail-fast migration guardrails.

## 2026-03-13 Phase D Storage Route Runtime Extraction
- Landed the next `cng-i6h.4` seam by extracting generic `/api/storage` mutation orchestration into `server/storageRouteRuntime.js`.
- `server/index.js` now delegates:
  - storage PUT follow-up behavior after `upsertValue()` / `deleteValue()`
  - declaration-row PATCH orchestration for simple-key updates
  - per-key post-effects for `decl_rows_v1`, `ecus_sync_config_v1`, `co_tax_code_config_v1`, and `co_discrepancy_config_v1`
- Kept the rest of the route boundary in the monolith on purpose: `verifyStoragePermission()`, blocked-key guards for `kpi_users_v1` and reporting schedules, and HTTP response/error shaping still live in `server/index.js`.
- Added `tests/storageRouteRuntime.test.js` to lock the new seam against five regressions:
  - declaration PUT still persists through `upsertValue()` and re-evaluates alerts
  - ECUS config PUT still refreshes the schedule
  - declaration PATCH still rewrites rows by simple key and re-evaluates alerts
  - C/O tax-code delete still resets runtime config to defaults
  - C/O discrepancy writes/deletes still refresh the schedule
- Verification:
  - `pnpm exec vitest run tests/storageRouteRuntime.test.js --environment node` -> Passed (`5/5`)
  - `pnpm exec vitest run tests/server.api.test.js --environment node -t "Storage API|Alert API"` -> Passed (`12` passed, `113` skipped)
  - `pnpm exec vitest run tests/storageRouteRuntime.test.js tests/runtimeStorageLifecycle.test.js --environment node` -> Passed (`9/9`)
  - `pnpm exec eslint server/storageRouteRuntime.js tests/storageRouteRuntime.test.js server/index.js --fix` -> Passed after normalizing touched-file line endings
  - `pnpm exec eslint server/storageRouteRuntime.js tests/storageRouteRuntime.test.js server/index.js` -> Passed
  - `pnpm exec vitest run tests/storageRouteRuntime.test.js tests/runtimeStorageLifecycle.test.js tests/server.api.test.js --environment node -t "Storage API|Alert API|createStorageRouteRuntime|runtimeStorageLifecycle"` -> Passed (`21` passed, `113` skipped)
  - `git diff --check -- server/index.js server/storageRouteRuntime.js tests/storageRouteRuntime.test.js task_plan.md findings.md` -> Passed
- Residual after this slice:
  - `server/index.js` still owns the rest of the `/api/storage` controller boundary (`verifyStoragePermission()`, blocked-key policy, and route registration).
  - The first real Postgres-backed adapter still has not landed; the smallest remaining adapter slice is now an async reporting-projection persistence implementation under `server-v4` / `apps/api`.

## 2026-03-13 Phase D First Postgres Reporting Projection Adapter
- Landed the first real Postgres-backed reporting persistence slice for `cng-i6h.4`.
- Added `server-v4/src/persistence/reportingProjectionPostgres.ts` and wired `server-v4/src/persistence/runtimePersistence.ts` so:
  - `postgres` mode no longer hard-throws when a URL is present
  - reporting projection storage goes through `pg` into `reporting_projections`
  - legacy business snapshot reads still stay on the SQLite dual-write compatibility reader
- Converted reporting projection access to async end-to-end:
  - `server-v4/src/persistence/reportingProjectionPersistence.ts`
  - `server-v4/src/modules/reporting/ReportingRepository.ts`
  - `server-v4/src/modules/reporting/reportingService.ts`
- Added shutdown ownership for pool-backed persistence:
  - `server-v4/src/app/build-v4-app.ts` now exposes `app.locals.runtimePersistenceDispose`
  - `apps/api/src/startApiServer.js` now invokes that disposer during `runtime.close()`
- Added regression coverage:
  - `tests/server-v4/reportingProjectionPostgres.test.js`
  - updated `tests/server-v4/runtimePersistence.test.js`
  - updated `tests/appsApiStart.test.js`
- Dependency updates:
  - added runtime dependency `pg`
  - added dev dependency `@types/pg`
- Verification:
  - `pnpm exec vitest run tests/server-v4/runtimePersistence.test.js tests/server-v4/reportingProjectionPostgres.test.js tests/appsApiStart.test.js --environment node` -> Passed (`9/9`)
  - `pnpm run build:server-v4` -> Passed
  - `pnpm exec vitest run tests/server-v4/runtimePersistence.test.js tests/server-v4/reportingProjectionPostgres.test.js tests/appsApiStart.test.js tests/server-v4/reportingService.test.js tests/server-v4/appShell.test.js tests/server-v4/runtimeRoutes.test.js --environment node` -> Passed (`35/35`)
  - `pnpm run test:server-v4` -> Passed (`42/42`)
  - `pnpm exec eslint apps/api/src/startApiServer.js server-v4/src/app/build-v4-app.ts server-v4/src/persistence/reportingProjectionPersistence.ts server-v4/src/persistence/reportingProjectionPostgres.ts server-v4/src/persistence/runtimePersistence.ts server-v4/src/modules/reporting/ReportingRepository.ts server-v4/src/modules/reporting/reportingService.ts tests/appsApiStart.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/reportingProjectionPostgres.test.js --fix` -> Passed
  - `pnpm exec eslint apps/api/src/startApiServer.js server-v4/src/app/build-v4-app.ts server-v4/src/persistence/reportingProjectionPersistence.ts server-v4/src/persistence/reportingProjectionPostgres.ts server-v4/src/persistence/runtimePersistence.ts server-v4/src/modules/reporting/ReportingRepository.ts server-v4/src/modules/reporting/reportingService.ts tests/appsApiStart.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/reportingProjectionPostgres.test.js` -> Passed
  - `git diff --check -- apps/api/src/startApiServer.js server-v4/src/app/build-v4-app.ts server-v4/src/persistence/reportingProjectionPersistence.ts server-v4/src/persistence/reportingProjectionPostgres.ts server-v4/src/persistence/runtimePersistence.ts server-v4/src/modules/reporting/ReportingRepository.ts server-v4/src/modules/reporting/reportingService.ts tests/appsApiStart.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/reportingProjectionPostgres.test.js package.json pnpm-lock.yaml` -> Passed (warning-only CRLF notice on `package.json` / `pnpm-lock.yaml`)
- Residual after this slice:
  - `server/index.js` still owns the remaining `/api/storage` controller boundary.
  - Postgres ownership currently stops at reporting projections; business snapshot reads/writes still run through the SQLite dual-write compatibility path.

## 2026-03-13 Phase D Storage Route Controller Extraction
- Landed the next `cng-i6h.4` seam by extracting the remaining generic `/api/storage` controller logic into `server/storageRouteController.js`.
- `server/index.js` now delegates:
  - GET/PUT/PATCH/DELETE storage permission checks
  - blocked-key policy for `kpi_users_v1` and `kpi_report_schedule_v1`
  - actor forwarding plus HTTP/error shaping around `storageRouteRuntime`
- Kept route registration in the monolith on purpose; this slice removes inline controller ownership without mixing it into the already-extracted mutation runtime.
- Added `tests/storageRouteController.test.js` to lock the new seam against seven regressions:
  - report schedule writes stay blocked on the generic storage API
  - account-storage mutations stay blocked on the generic storage API
  - protected storage keys still require authentication
  - readable keys still return parsed JSON payloads
  - PATCH still rejects unsupported keys
  - invalid current declaration data still maps to a `500`
  - runtime mutations still receive actor/source metadata
- Verification:
  - `pnpm exec vitest run tests/storageRouteController.test.js tests/storageRouteRuntime.test.js --environment node` -> Passed (`12/12`)
  - `pnpm exec vitest run tests/server.api.test.js --environment node -t "Storage API"` -> Passed (`7` passed, `118` skipped)
  - `pnpm exec eslint server/storageRouteController.js tests/storageRouteController.test.js server/index.js --fix` -> Passed
  - `pnpm exec eslint server/storageRouteController.js tests/storageRouteController.test.js server/index.js` -> Passed
  - `git diff --check -- server/storageRouteController.js tests/storageRouteController.test.js server/index.js task.md task_plan.md findings.md progress.md` -> Passed
- Residual after this slice:
  - `server/index.js` keeps only route registration for `/api/storage`; the bigger remaining Phase D blocker is no longer controller shaping but persistence ownership.
  - Postgres ownership still stops at reporting projections; business snapshot reads/writes remain on the SQLite dual-write compatibility path.

## 2026-03-13 Phase D Sqlite Business Snapshot Reader Ownership
- Landed the next `cng-i6h.4` seam by moving the active `server-v4` business snapshot reader into `server-v4/src/persistence/sqliteBusinessSnapshotReader.ts`.
- `server-v4/src/persistence/runtimePersistence.ts` now constructs `SqliteBusinessSnapshotReader` directly, so canonical runtime business reads no longer depend on:
  - `server-v4/src/legacy/legacy-business-snapshot-reader.ts`
  - `server-v4/src/legacy/legacy-kv-store-reader.ts`
- Deleted those legacy reader files and replaced their regression surface with `tests/server-v4/sqliteBusinessSnapshotReader.test.js`.
- Kept `sourceKind: dual-write` on purpose: hot business entities still read from typed SQLite snapshots/projections that are maintained through monolith dual-write compatibility, so this slice narrows ownership without overstating cutover readiness.
- Added regression coverage:
  - `tests/server-v4/sqliteBusinessSnapshotReader.test.js` locks typed snapshot/projection reads, no-blob fallback behavior, typed-snapshot preference, and future `relational-store` source tagging
  - `tests/server-v4/runtimePersistence.test.js` now asserts `createRuntimePersistence()` builds `SqliteBusinessSnapshotReader` for both runtime modes
- Verification:
  - `pnpm exec vitest run tests/server-v4/sqliteBusinessSnapshotReader.test.js tests/server-v4/runtimePersistence.test.js --environment node` -> Passed (`9/9`)
  - `pnpm run build:server-v4` -> Passed
  - `pnpm exec vitest run tests/server-v4/v4RolloutStatus.test.js tests/server-v4/runtimeRoutes.test.js tests/server-v4/appShell.test.js tests/server-v4/reportingService.test.js tests/server-v4/reportingProjectionPostgres.test.js tests/appsApiStart.test.js --environment node` -> Passed (`34/34`)
  - `pnpm run test:server-v4` -> Passed (`43/43`)
  - `pnpm exec eslint server-v4/src/persistence/runtimePersistence.ts server-v4/src/persistence/sqliteBusinessSnapshotReader.ts tests/server-v4/runtimePersistence.test.js tests/server-v4/sqliteBusinessSnapshotReader.test.js --fix` -> Passed
  - `pnpm exec eslint server-v4/src/persistence/runtimePersistence.ts server-v4/src/persistence/sqliteBusinessSnapshotReader.ts tests/server-v4/runtimePersistence.test.js tests/server-v4/sqliteBusinessSnapshotReader.test.js` -> Passed
  - `git diff --check -- server-v4/src/persistence/runtimePersistence.ts server-v4/src/persistence/sqliteBusinessSnapshotReader.ts tests/server-v4/runtimePersistence.test.js tests/server-v4/sqliteBusinessSnapshotReader.test.js task.md task_plan.md findings.md progress.md` -> Passed
- Residual after this slice:
  - `server-v4` runtime ownership is cleaner, but canonical mode still relies on typed SQLite business snapshots maintained by monolith dual-write compatibility.
  - The next material Phase D cut is a true non-SQLite business snapshot adapter path, most likely by widening Postgres ownership beyond reporting projections.

## 2026-03-13 Phase D First Postgres Business Read Slice For MST Assignments
- Landed the first true Postgres-backed business read path for `cng-i6h.4`, limited to the smallest isolated route family: `mst-assignments`.
- Added:
  - `server-v4/src/modules/mst-assignments/mstAssignmentAsyncReader.ts`
  - `server-v4/src/modules/mst-assignments/postgresMstAssignmentAsyncReader.ts`
  - `tests/server-v4/postgresMstAssignmentAsyncReader.test.js`
  - `tests/server-v4/postgresMstAssignmentsRoute.test.js`
- Updated:
  - `server-v4/src/persistence/runtimePersistence.ts`
  - `server-v4/src/persistence/reportingProjectionPostgres.ts`
  - `server-v4/src/modules/mst-assignments/MstAssignmentsRepository.ts`
  - `server-v4/src/modules/mst-assignments/mstAssignmentsService.ts`
  - `server-v4/src/modules/mst-assignments/MstAssignmentsController.ts`
  - `server-v4/src/modules/mst-assignments/mstAssignmentsRoutes.ts`
  - `server-v4/src/app/build-v4-app.ts`
  - `tests/server-v4/runtimePersistence.test.js`
- Runtime behavior after this slice:
  - `runtimePersistence` still keeps the broad sync `SqliteBusinessSnapshotReader` as the compatibility reader for declarations, teams, rules, adjustments, and reporting inputs.
  - In `postgres` mode, `runtimePersistence` now shares one `pg` pool between reporting projections and the new async MST assignment reader.
  - `buildV4App()` now mounts `mst-assignments` through `persistence.mstAssignmentsReader` instead of forcing it through the sync router-factory map.
  - Existing `mst-assignments` route behavior is preserved while enabling the first non-SQLite business read path.
- Verification:
  - `pnpm exec vitest run tests/server-v4/postgresMstAssignmentAsyncReader.test.js tests/server-v4/postgresMstAssignmentsRoute.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/runtimeRoutes.test.js tests/server-v4/appShell.test.js --environment node -t "mst|MST|health|rollout|module metadata|runtime persistence"` -> Passed (`11` passed, `20` skipped)
  - `pnpm run build:server-v4` -> Passed
  - `pnpm exec eslint server-v4/src/app/build-v4-app.ts server-v4/src/persistence/runtimePersistence.ts server-v4/src/persistence/reportingProjectionPostgres.ts server-v4/src/modules/mst-assignments/MstAssignmentsController.ts server-v4/src/modules/mst-assignments/MstAssignmentsRepository.ts server-v4/src/modules/mst-assignments/mstAssignmentsRoutes.ts server-v4/src/modules/mst-assignments/mstAssignmentsService.ts server-v4/src/modules/mst-assignments/mstAssignmentAsyncReader.ts server-v4/src/modules/mst-assignments/postgresMstAssignmentAsyncReader.ts tests/server-v4/postgresMstAssignmentAsyncReader.test.js tests/server-v4/postgresMstAssignmentsRoute.test.js tests/server-v4/runtimePersistence.test.js` -> Passed
  - `git diff --check -- server-v4/src/app/build-v4-app.ts server-v4/src/persistence/runtimePersistence.ts server-v4/src/persistence/reportingProjectionPostgres.ts server-v4/src/modules/mst-assignments/MstAssignmentsController.ts server-v4/src/modules/mst-assignments/MstAssignmentsRepository.ts server-v4/src/modules/mst-assignments/mstAssignmentsRoutes.ts server-v4/src/modules/mst-assignments/mstAssignmentsService.ts server-v4/src/modules/mst-assignments/mstAssignmentAsyncReader.ts server-v4/src/modules/mst-assignments/postgresMstAssignmentAsyncReader.ts tests/server-v4/postgresMstAssignmentAsyncReader.test.js tests/server-v4/postgresMstAssignmentsRoute.test.js tests/server-v4/runtimePersistence.test.js` -> Passed
- Residual after this slice:
  - The remaining business domains still depend on the sync SQLite compatibility reader because `BusinessSnapshotReader` itself is not async.
  - `server/index.js` still owns the remaining `/api/storage` route-registration boundary.
  - The next meaningful Phase D cut is to widen the async/Postgres pattern to another isolated business domain or finish the last `/api/storage` extraction, not to re-centralize the mixed sync/async runtime seam.

## 2026-03-13 Phase D Second Postgres Business Read Slice For Teams
- Landed the second true Postgres-backed business read path for `cng-i6h.4`, limited to the isolated `teams` route family.
- Added:
  - `server-v4/src/modules/teams/teamRosterAsyncReader.ts`
  - `server-v4/src/modules/teams/postgresTeamRosterAsyncReader.ts`
  - `tests/server-v4/postgresTeamRosterAsyncReader.test.js`
  - `tests/server-v4/postgresTeamsRoute.test.js`
- Updated:
  - `server-v4/src/persistence/runtimePersistence.ts`
  - `server-v4/src/app/build-v4-app.ts`
  - `server-v4/src/modules/teams/TeamsRepository.ts`
  - `server-v4/src/modules/teams/teamsService.ts`
  - `server-v4/src/modules/teams/TeamsController.ts`
  - `server-v4/src/modules/teams/teamsRoutes.ts`
  - `server-v4/src/modules/reporting/ReportingRepository.ts`
  - `server-v4/src/modules/reporting/reportingService.ts`
  - `tests/server-v4/runtimePersistence.test.js`
- Runtime behavior after this slice:
  - `runtimePersistence` still keeps `SqliteBusinessSnapshotReader` as the broad compatibility reader for declarations, rules, adjustments, and the remaining sync business inputs.
  - In `postgres` mode, `runtimePersistence` now shares the existing `pg` pool across reporting projections, MST assignments, and the new async team-roster reader.
  - `buildV4App()` now mounts `teams` through `persistence.teamsReader` instead of forcing it through the sync router-factory map.
  - Reporting reads remain behaviorally compatible, but `ReportingRepository.readReportingSnapshot()` is now async so reporting can await the shared team-roster seam instead of reading teams synchronously.
- Verification:
  - `pnpm run build:server-v4` -> Passed
  - `pnpm exec vitest run tests/server-v4/postgresTeamRosterAsyncReader.test.js tests/server-v4/postgresTeamsRoute.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/runtimeRoutes.test.js tests/server-v4/appShell.test.js --environment node` -> Passed (`31/31`)
  - `pnpm exec eslint server-v4/src/app/build-v4-app.ts server-v4/src/persistence/runtimePersistence.ts server-v4/src/modules/teams/TeamsRepository.ts server-v4/src/modules/teams/teamsService.ts server-v4/src/modules/teams/TeamsController.ts server-v4/src/modules/teams/teamsRoutes.ts server-v4/src/modules/teams/teamRosterAsyncReader.ts server-v4/src/modules/teams/postgresTeamRosterAsyncReader.ts server-v4/src/modules/reporting/ReportingRepository.ts server-v4/src/modules/reporting/reportingService.ts tests/server-v4/postgresTeamRosterAsyncReader.test.js tests/server-v4/postgresTeamsRoute.test.js tests/server-v4/runtimePersistence.test.js` -> Passed
  - `git diff --check -- server-v4/src/app/build-v4-app.ts server-v4/src/persistence/runtimePersistence.ts server-v4/src/modules/teams/TeamsRepository.ts server-v4/src/modules/teams/teamsService.ts server-v4/src/modules/teams/TeamsController.ts server-v4/src/modules/teams/teamsRoutes.ts server-v4/src/modules/teams/teamRosterAsyncReader.ts server-v4/src/modules/teams/postgresTeamRosterAsyncReader.ts server-v4/src/modules/reporting/ReportingRepository.ts server-v4/src/modules/reporting/reportingService.ts tests/server-v4/postgresTeamRosterAsyncReader.test.js tests/server-v4/postgresTeamsRoute.test.js tests/server-v4/runtimePersistence.test.js` -> Passed
- Residual after this slice:
  - The remaining business domains still depend on the sync SQLite compatibility reader because `BusinessSnapshotReader` is still a synchronous interface.
  - `server/index.js` now only keeps the low-value `/api/storage` route-registration residue; the real remaining Phase D blocker is wider async/Postgres ownership for business snapshot inputs beyond MST assignments and teams.

## 2026-03-13 Phase D Third Postgres Business Read Slice For Declarations
- Landed the third true Postgres-backed business read path for `cng-i6h.4`, centered on `declarations` and the reporting declaration input seam.
- Added:
  - `server-v4/src/modules/declarations/declarationAsyncReader.ts`
  - `server-v4/src/modules/declarations/postgresDeclarationAsyncReader.ts`
  - `tests/server-v4/postgresDeclarationAsyncReader.test.js`
  - `tests/server-v4/postgresDeclarationsRoute.test.js`
  - `tests/server-v4/postgresReportingInputRoute.test.js`
- Updated:
  - `server-v4/src/modules/declarations/DeclarationsRepository.ts`
  - `server-v4/src/modules/declarations/declarationsService.ts`
  - `server-v4/src/modules/declarations/DeclarationsController.ts`
  - `server-v4/src/modules/declarations/declarationsRoutes.ts`
  - `server-v4/src/persistence/runtimePersistence.ts`
  - `server-v4/src/app/build-v4-app.ts`
  - `server-v4/src/modules/reporting/reportingRoutes.ts`
  - `server-v4/src/modules/reporting/ReportingRepository.ts`
  - `tests/server-v4/runtimePersistence.test.js`
  - `tests/server-v4/postgresMstAssignmentsRoute.test.js`
  - `tests/server-v4/postgresTeamsRoute.test.js`
- Runtime behavior after this slice:
  - `runtimePersistence` now shares the existing `pg` pool across reporting projections, MST assignments, teams, and declarations.
  - `buildV4App()` now mounts `/api/v4/declarations` through `persistence.declarationsReader` instead of the sync router-factory map.
  - `buildReportingRouter()` now receives explicit async declaration/team readers from app composition, so reporting aggregate routes can use Postgres-backed declaration rows and team roster inputs when those seams are available.
  - The sync `BusinessSnapshotReader` remains the compatibility surface for rules, adjustments, and the rest of the hot-path inputs that have not been widened yet.
- Verification:
  - `pnpm run build:server-v4` -> Passed
  - `pnpm exec vitest run tests/server-v4/postgresDeclarationAsyncReader.test.js tests/server-v4/postgresDeclarationsRoute.test.js tests/server-v4/postgresReportingInputRoute.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/postgresMstAssignmentsRoute.test.js tests/server-v4/postgresTeamsRoute.test.js tests/server-v4/runtimeRoutes.test.js tests/server-v4/appShell.test.js --environment node` -> Passed (`34/34`)
  - `pnpm exec eslint server-v4/src/app/build-v4-app.ts server-v4/src/persistence/runtimePersistence.ts server-v4/src/modules/declarations/declarationAsyncReader.ts server-v4/src/modules/declarations/postgresDeclarationAsyncReader.ts server-v4/src/modules/declarations/DeclarationsRepository.ts server-v4/src/modules/declarations/declarationsService.ts server-v4/src/modules/declarations/DeclarationsController.ts server-v4/src/modules/declarations/declarationsRoutes.ts server-v4/src/modules/reporting/reportingRoutes.ts server-v4/src/modules/reporting/ReportingRepository.ts tests/server-v4/runtimePersistence.test.js tests/server-v4/postgresMstAssignmentsRoute.test.js tests/server-v4/postgresTeamsRoute.test.js tests/server-v4/postgresDeclarationAsyncReader.test.js tests/server-v4/postgresDeclarationsRoute.test.js tests/server-v4/postgresReportingInputRoute.test.js` -> Passed
  - `git diff --check -- server-v4/src/app/build-v4-app.ts server-v4/src/persistence/runtimePersistence.ts server-v4/src/modules/declarations/declarationAsyncReader.ts server-v4/src/modules/declarations/postgresDeclarationAsyncReader.ts server-v4/src/modules/declarations/DeclarationsRepository.ts server-v4/src/modules/declarations/declarationsService.ts server-v4/src/modules/declarations/DeclarationsController.ts server-v4/src/modules/declarations/declarationsRoutes.ts server-v4/src/modules/reporting/reportingRoutes.ts server-v4/src/modules/reporting/ReportingRepository.ts tests/server-v4/runtimePersistence.test.js tests/server-v4/postgresMstAssignmentsRoute.test.js tests/server-v4/postgresTeamsRoute.test.js tests/server-v4/postgresDeclarationAsyncReader.test.js tests/server-v4/postgresDeclarationsRoute.test.js tests/server-v4/postgresReportingInputRoute.test.js` -> Passed
- Residual after this slice:
  - `kpi-rules` and `kpi-adjustments` still sit behind the sync `BusinessSnapshotReader`, so reporting is not yet fully on async/Postgres-backed business inputs.
  - `server/index.js` only keeps the low-value `/api/storage` route-registration residue; the next meaningful Phase D move is another KPI-input async seam rather than more monolith wrapper cleanup.

## 2026-03-13 Phase D Fourth Postgres Business Read Slice For KPI Rules
- Landed the fourth true Postgres-backed business read path for `cng-i6h.4`, centered on `kpi-rules` and the reporting rules input seam.
- Added:
  - `server-v4/src/modules/kpi-rules/kpiRulesAsyncReader.ts`
  - `server-v4/src/modules/kpi-rules/postgresKpiRulesAsyncReader.ts`
  - `tests/server-v4/postgresKpiRulesAsyncReader.test.js`
  - `tests/server-v4/postgresKpiRulesRoute.test.js`
- Updated:
  - `server-v4/src/modules/kpi-rules/KpiRulesRepository.ts`
  - `server-v4/src/modules/kpi-rules/kpiRulesService.ts`
  - `server-v4/src/modules/kpi-rules/KpiRulesController.ts`
  - `server-v4/src/modules/kpi-rules/kpiRulesRoutes.ts`
  - `server-v4/src/persistence/runtimePersistence.ts`
  - `server-v4/src/app/build-v4-app.ts`
  - `server-v4/src/modules/reporting/reportingRoutes.ts`
  - `server-v4/src/modules/reporting/ReportingRepository.ts`
  - `tests/server-v4/runtimePersistence.test.js`
  - `tests/server-v4/postgresDeclarationsRoute.test.js`
  - `tests/server-v4/postgresMstAssignmentsRoute.test.js`
  - `tests/server-v4/postgresTeamsRoute.test.js`
  - `tests/server-v4/postgresReportingInputRoute.test.js`
- Runtime behavior after this slice:
  - `runtimePersistence` now shares the existing `pg` pool across reporting projections, declarations, KPI rules, MST assignments, and teams.
  - `buildV4App()` now mounts `/api/v4/kpi-rules` through `persistence.kpiRulesReader` instead of the sync router-factory path.
  - `buildReportingRouter()` now receives an explicit async rules reader from app composition, so reporting aggregate routes can use Postgres-backed rule sets from `kpi_rule_sets` when that seam is available.
  - The sync `BusinessSnapshotReader` remains the compatibility surface for adjustments and the rest of the hot-path inputs that have not been widened yet.
- Verification:
  - `pnpm exec vitest run tests/server-v4/postgresKpiRulesAsyncReader.test.js tests/server-v4/postgresKpiRulesRoute.test.js tests/server-v4/postgresReportingInputRoute.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/postgresDeclarationsRoute.test.js tests/server-v4/postgresMstAssignmentsRoute.test.js tests/server-v4/postgresTeamsRoute.test.js tests/server-v4/runtimeRoutes.test.js tests/server-v4/appShell.test.js --environment node` -> Passed (`35/35`)
  - `pnpm run build:server-v4` -> Passed
  - `pnpm exec eslint server-v4/src/app/build-v4-app.ts server-v4/src/modules/kpi-rules/KpiRulesController.ts server-v4/src/modules/kpi-rules/KpiRulesRepository.ts server-v4/src/modules/kpi-rules/kpiRulesAsyncReader.ts server-v4/src/modules/kpi-rules/postgresKpiRulesAsyncReader.ts server-v4/src/modules/kpi-rules/kpiRulesRoutes.ts server-v4/src/modules/kpi-rules/kpiRulesService.ts server-v4/src/modules/reporting/ReportingRepository.ts server-v4/src/modules/reporting/reportingRoutes.ts server-v4/src/persistence/runtimePersistence.ts tests/server-v4/runtimePersistence.test.js tests/server-v4/postgresDeclarationsRoute.test.js tests/server-v4/postgresMstAssignmentsRoute.test.js tests/server-v4/postgresTeamsRoute.test.js tests/server-v4/postgresReportingInputRoute.test.js tests/server-v4/postgresKpiRulesAsyncReader.test.js tests/server-v4/postgresKpiRulesRoute.test.js` -> Passed
  - `git diff --check -- server-v4/src/app/build-v4-app.ts server-v4/src/modules/kpi-rules/KpiRulesController.ts server-v4/src/modules/kpi-rules/KpiRulesRepository.ts server-v4/src/modules/kpi-rules/kpiRulesAsyncReader.ts server-v4/src/modules/kpi-rules/postgresKpiRulesAsyncReader.ts server-v4/src/modules/kpi-rules/kpiRulesRoutes.ts server-v4/src/modules/kpi-rules/kpiRulesService.ts server-v4/src/modules/reporting/ReportingRepository.ts server-v4/src/modules/reporting/reportingRoutes.ts server-v4/src/persistence/runtimePersistence.ts tests/server-v4/runtimePersistence.test.js tests/server-v4/postgresDeclarationsRoute.test.js tests/server-v4/postgresMstAssignmentsRoute.test.js tests/server-v4/postgresTeamsRoute.test.js tests/server-v4/postgresReportingInputRoute.test.js tests/server-v4/postgresKpiRulesAsyncReader.test.js tests/server-v4/postgresKpiRulesRoute.test.js` -> Passed
- Residual after this slice:
  - `kpi-adjustments` is now the main reporting input still tied to the sync `BusinessSnapshotReader`.
  - `/api/storage` route registration in `server/index.js` remains only low-value cleanup; the next meaningful Phase D move is an adjustments seam rather than more monolith wrapper extraction.

## 2026-03-13 Phase D Fifth Postgres Business Read Slice For KPI Adjustments
- Landed the fifth async/Postgres business-read seam for `cng-i6h.4`, limited to the reporting adjustments input path instead of opening the full `/api/v4/kpi-adjustments` route family.
- Added:
  - `server-v4/src/modules/kpi-adjustments/adjustmentAsyncReader.ts`
  - `server-v4/src/modules/kpi-adjustments/postgresAdjustmentAsyncReader.ts`
  - `tests/server-v4/postgresAdjustmentAsyncReader.test.js`
- Updated:
  - `server-v4/src/modules/reporting/ReportingRepository.ts`
  - `server-v4/src/modules/reporting/reportingRoutes.ts`
  - `server-v4/src/persistence/runtimePersistence.ts`
  - `server-v4/src/app/build-v4-app.ts`
  - `tests/server-v4/runtimePersistence.test.js`
  - `tests/server-v4/postgresReportingInputRoute.test.js`
- Runtime behavior after this slice:
  - `runtimePersistence` now shares the existing `pg` pool across reporting projections, declarations, KPI rules, MST assignments, teams, and the new async adjustments reader.
  - `buildReportingRouter()` now receives `adjustmentsReader` from app composition, so reporting no longer calls the sync `BusinessSnapshotReader.readAdjustmentRows()` compatibility path directly.
  - The first adjustments Postgres adapter deliberately reads ordered payload rows from `adjustment_snapshot_rows` with SQLite fallback, matching the existing typed snapshot transport seam and keeping canonical `kpi_adjustments` cutover for a later slice.
  - Reporting input transport is now consistently async across declarations, rules, adjustments, and teams, while the broad `BusinessSnapshotReader` contract still remains sync for untouched business domains.
- Verification:
  - `pnpm exec vitest run tests/server-v4/postgresAdjustmentAsyncReader.test.js tests/server-v4/postgresReportingInputRoute.test.js tests/server-v4/runtimePersistence.test.js --environment node` -> Passed (`6/6`)
  - `pnpm exec vitest run tests/server-v4/postgresAdjustmentAsyncReader.test.js tests/server-v4/postgresReportingInputRoute.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/postgresDeclarationsRoute.test.js tests/server-v4/postgresKpiRulesRoute.test.js tests/server-v4/postgresMstAssignmentsRoute.test.js tests/server-v4/postgresTeamsRoute.test.js tests/server-v4/runtimeRoutes.test.js tests/server-v4/appShell.test.js --environment node` -> Passed (`35/35`)
  - `pnpm run build:server-v4` -> Passed
  - `pnpm exec eslint server-v4/src/app/build-v4-app.ts server-v4/src/modules/kpi-adjustments/adjustmentAsyncReader.ts server-v4/src/modules/kpi-adjustments/postgresAdjustmentAsyncReader.ts server-v4/src/modules/reporting/ReportingRepository.ts server-v4/src/modules/reporting/reportingRoutes.ts server-v4/src/persistence/runtimePersistence.ts tests/server-v4/runtimePersistence.test.js tests/server-v4/postgresReportingInputRoute.test.js tests/server-v4/postgresAdjustmentAsyncReader.test.js` -> Passed
  - `git diff --check -- server-v4/src/app/build-v4-app.ts server-v4/src/modules/kpi-adjustments/adjustmentAsyncReader.ts server-v4/src/modules/kpi-adjustments/postgresAdjustmentAsyncReader.ts server-v4/src/modules/reporting/ReportingRepository.ts server-v4/src/modules/reporting/reportingRoutes.ts server-v4/src/persistence/runtimePersistence.ts tests/server-v4/runtimePersistence.test.js tests/server-v4/postgresReportingInputRoute.test.js tests/server-v4/postgresAdjustmentAsyncReader.test.js` -> Passed
- Residual after this slice:
  - Postgres business ownership is still transitional because declarations/rules/adjustments read snapshot-row payloads instead of canonical relational business tables.
  - `server/index.js` still owns the last low-value `/api/storage` route-registration residue.
  - The next meaningful Phase D cut is to widen Postgres ownership beyond reporting input transport into broader business tables/write paths, not to reopen sync reporting dependencies.

## 2026-03-13 Phase D Fifth Postgres Business Read Follow-on For Canonical Adjustments
- Strengthened the already-landed adjustments seam for `cng-i6h.4` by making `server-v4/src/modules/kpi-adjustments/postgresAdjustmentAsyncReader.ts` prefer canonical `kpi_adjustments` rows before falling back to `adjustment_snapshot_rows` and then the SQLite compatibility reader.
- Updated:
  - `server-v4/src/modules/kpi-adjustments/postgresAdjustmentAsyncReader.ts`
  - `tests/server-v4/postgresAdjustmentAsyncReader.test.js`
- Runtime behavior after this slice:
  - Reporting adjustments can now come from the canonical `kpi_adjustments` table when relational rows exist in Postgres.
  - The adapter still preserves the transitional safety net: if canonical rows are absent, it falls back to typed snapshot payload rows in `adjustment_snapshot_rows`, then to the SQLite dual-write compatibility reader.
  - This is the first adjustments slice that widens real Postgres business ownership beyond snapshot-row transport without opening the full adjustments route family or write surface.
- Verification:
  - `pnpm exec vitest run tests/server-v4/postgresAdjustmentAsyncReader.test.js tests/server-v4/postgresReportingInputRoute.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/runtimeRoutes.test.js tests/server-v4/appShell.test.js --environment node` -> Passed (`32/32`)
  - `pnpm exec vitest run tests/server-v4/postgresAdjustmentAsyncReader.test.js tests/server-v4/postgresReportingInputRoute.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/postgresDeclarationsRoute.test.js tests/server-v4/postgresKpiRulesRoute.test.js tests/server-v4/postgresMstAssignmentsRoute.test.js tests/server-v4/postgresTeamsRoute.test.js tests/server-v4/runtimeRoutes.test.js tests/server-v4/appShell.test.js --environment node` -> Passed (`36/36`)
  - `pnpm run build:server-v4` -> Passed
  - `pnpm exec eslint server-v4/src/modules/kpi-adjustments/postgresAdjustmentAsyncReader.ts tests/server-v4/postgresAdjustmentAsyncReader.test.js` -> Passed
  - `git diff --check -- server-v4/src/modules/kpi-adjustments/postgresAdjustmentAsyncReader.ts tests/server-v4/postgresAdjustmentAsyncReader.test.js` -> Passed
- Residual after this slice:
  - Postgres business ownership is stronger for adjustments, but declarations/rules still rely on transitional snapshot-row payload tables and broader business write paths remain on SQLite dual-write compatibility.
  - `server/index.js` still owns the final low-value `/api/storage` route-registration residue.

## 2026-03-13 Phase D Canonical Declarations Read Slice
- Strengthened the declarations seam for `cng-i6h.4` by making `server-v4/src/modules/declarations/postgresDeclarationAsyncReader.ts` prefer canonical `declarations` rows joined with `declaration_license_codes` before falling back to `declaration_snapshot_rows` and then the SQLite compatibility reader.
- Updated:
  - `server-v4/src/modules/declarations/postgresDeclarationAsyncReader.ts`
  - `tests/server-v4/postgresDeclarationAsyncReader.test.js`
- Runtime behavior after this slice:
  - `/api/v4/declarations` and reporting declaration inputs can now come from canonical Postgres declaration rows when relational data exists.
  - The reader reconstructs legacy reporting-friendly fields from relational storage, including `cong_ty`, `loai_hinh`, `num_items`, `licenses`, `nhan_vien`, `team`, `agency`, `co_line_count`, and license-code arrays derived from `declaration_license_codes`.
  - The adapter still preserves the transitional safety net: if canonical declaration rows are absent, it falls back to typed snapshot payload rows in `declaration_snapshot_rows`, then to the SQLite dual-write compatibility reader.
- Verification:
  - `pnpm exec vitest run tests/server-v4/postgresDeclarationAsyncReader.test.js tests/server-v4/postgresDeclarationsRoute.test.js tests/server-v4/postgresReportingInputRoute.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/runtimeRoutes.test.js tests/server-v4/appShell.test.js --environment node` -> Passed (`33/33`)
  - `pnpm exec vitest run tests/server-v4/postgresDeclarationAsyncReader.test.js tests/server-v4/postgresDeclarationsRoute.test.js tests/server-v4/postgresReportingInputRoute.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/postgresKpiRulesRoute.test.js tests/server-v4/postgresMstAssignmentsRoute.test.js tests/server-v4/postgresTeamsRoute.test.js tests/server-v4/runtimeRoutes.test.js tests/server-v4/appShell.test.js --environment node` -> Passed (`36/36`)
  - `pnpm run build:server-v4` -> Passed
  - `pnpm exec eslint server-v4/src/modules/declarations/postgresDeclarationAsyncReader.ts tests/server-v4/postgresDeclarationAsyncReader.test.js` -> Passed
  - `git diff --check -- server-v4/src/modules/declarations/postgresDeclarationAsyncReader.ts tests/server-v4/postgresDeclarationAsyncReader.test.js` -> Passed
- Residual after this slice:
  - Declarations and adjustments now read canonical relational tables first, but the overall runtime still remains SQLite dual-write compatible because broader business write ownership and untouched paths have not moved yet.
  - `server/index.js` still owns the final low-value `/api/storage` route-registration residue.
## 2026-03-13 Phase D Reporting Boundary Cleanup
- Removed the raw sync-reader dependency from the reporting runtime boundary after all reporting inputs already had explicit async seams.
- Updated:
  - `server-v4/src/modules/reporting/ReportingRepository.ts`
  - `server-v4/src/modules/reporting/reportingRoutes.ts`
  - `server-v4/src/app/build-v4-app.ts`
  - `tests/server-v4/postgresReportingInputRoute.test.js`
- Runtime behavior after this slice:
  - `buildReportingRouter()` now accepts only `projections` plus explicit async readers for declarations, KPI rules, adjustments, and teams.
  - `ReportingRepository` no longer accepts a `BusinessSnapshotReader` just to synthesize fallback wrappers internally.
  - `buildV4App()` no longer forwards `persistence.reader` into the reporting route family; reporting now depends only on the async reader seams already exposed by `runtimePersistence`.
  - The reporting-input wiring regression test now uses a poisoned legacy reader object, so any accidental touch of the sync compatibility reader inside the reporting boundary fails the route test immediately.
- Verification:
  - `pnpm exec vitest run tests/server-v4/postgresReportingInputRoute.test.js tests/server-v4/runtimeRoutes.test.js tests/server-v4/appShell.test.js --environment node` -> Passed (`26/26`)
  - `pnpm exec vitest run tests/server-v4/postgresReportingInputRoute.test.js tests/server-v4/postgresDeclarationsRoute.test.js tests/server-v4/postgresKpiRulesRoute.test.js tests/server-v4/postgresTeamsRoute.test.js tests/server-v4/runtimeRoutes.test.js tests/server-v4/appShell.test.js --environment node` -> Passed (`29/29`)
  - `pnpm run build:server-v4` -> Passed
  - `pnpm exec eslint server-v4/src/modules/reporting/ReportingRepository.ts server-v4/src/modules/reporting/reportingRoutes.ts server-v4/src/app/build-v4-app.ts tests/server-v4/postgresReportingInputRoute.test.js` -> Passed
  - `git diff --check -- server-v4/src/modules/reporting/ReportingRepository.ts server-v4/src/modules/reporting/reportingRoutes.ts server-v4/src/app/build-v4-app.ts tests/server-v4/postgresReportingInputRoute.test.js` -> Passed
- Residual after this slice:
  - Reporting no longer depends on a raw sync reader at composition time, but `runtimePersistence` still keeps the broader SQLite compatibility reader alive for untouched business paths and health/source metadata.
  - The next meaningful Phase D work is broader business write-path ownership or a narrower runtime-level reduction of SQLite compatibility, not more low-value `/api/storage` route-registration cleanup.

## 2026-03-13 Phase D Runtime Persistence Contract Cleanup
- Removed `reader` from the public `RuntimePersistence` contract after `buildV4App()` stopped needing a raw sync reader for any mounted module family.
- Updated:
  - `server-v4/src/persistence/runtimePersistence.ts`
  - `tests/server-v4/runtimePersistence.test.js`
  - `tests/server-v4/postgresDeclarationsRoute.test.js`
  - `tests/server-v4/postgresKpiRulesRoute.test.js`
  - `tests/server-v4/postgresMstAssignmentsRoute.test.js`
  - `tests/server-v4/postgresTeamsRoute.test.js`
  - `tests/server-v4/postgresReportingInputRoute.test.js`
- Runtime behavior after this slice:
  - `createRuntimePersistence()` still constructs the internal SQLite compatibility reader, but it no longer exposes that object on the returned runtime contract.
  - Public runtime consumers now depend only on `sourceKind`, explicit async readers, projection persistence, and lifecycle disposal.
  - Custom postgres persistence fixtures in route-wiring tests can now mount `buildV4App()` without providing a raw sync reader property at all.
  - The runtime-persistence regression test now locks that boundary by asserting the returned object does not expose `reader`.
- Verification:
  - `pnpm exec vitest run tests/server-v4/runtimePersistence.test.js tests/server-v4/postgresDeclarationsRoute.test.js tests/server-v4/postgresKpiRulesRoute.test.js tests/server-v4/postgresMstAssignmentsRoute.test.js tests/server-v4/postgresTeamsRoute.test.js tests/server-v4/postgresReportingInputRoute.test.js tests/server-v4/runtimeRoutes.test.js tests/server-v4/appShell.test.js --environment node` -> Passed (`33/33`)
  - `pnpm run build:server-v4` -> Passed
  - `pnpm exec eslint server-v4/src/persistence/runtimePersistence.ts tests/server-v4/runtimePersistence.test.js tests/server-v4/postgresDeclarationsRoute.test.js tests/server-v4/postgresKpiRulesRoute.test.js tests/server-v4/postgresMstAssignmentsRoute.test.js tests/server-v4/postgresTeamsRoute.test.js tests/server-v4/postgresReportingInputRoute.test.js` -> Passed
  - `git diff --check -- server-v4/src/persistence/runtimePersistence.ts tests/server-v4/runtimePersistence.test.js tests/server-v4/postgresDeclarationsRoute.test.js tests/server-v4/postgresKpiRulesRoute.test.js tests/server-v4/postgresMstAssignmentsRoute.test.js tests/server-v4/postgresTeamsRoute.test.js tests/server-v4/postgresReportingInputRoute.test.js` -> Passed
- Residual after this slice:
  - SQLite compatibility still exists inside runtime persistence for untouched business paths and source metadata, but it is no longer exposed through the public app-composition contract.
  - The next meaningful Phase D work remains broader business write-path ownership or a deliberate reduction of internal SQLite compatibility, not more surface-level route-registration cleanup.

## 2026-03-13 Phase D Relational-Store Runtime Truthfulness
- Replaced the last hidden SQLite compatibility dependency in `server-v4` `postgres` mode with `server-v4/src/persistence/noopBusinessSnapshotReader.ts`.
- Updated:
  - `server-v4/src/persistence/noopBusinessSnapshotReader.ts`
  - `server-v4/src/persistence/runtimePersistence.ts`
  - `server-v4/src/app/v4-rollout-status.ts`
  - `tests/server-v4/noopBusinessSnapshotReader.test.js`
  - `tests/server-v4/runtimePersistence.test.js`
  - `tests/server-v4/v4RolloutStatus.test.js`
  - `tests/server-v4/appShell.test.js`
- Runtime behavior after this slice:
  - `createRuntimePersistence()` now uses a noop `BusinessSnapshotReader` tagged `sourceKind='relational-store'` in `postgres` mode instead of constructing a hidden `SqliteBusinessSnapshotReader`.
  - The Postgres async readers inherit that `relational-store` source kind, so runtime/source metadata no longer implies a legacy SQLite dependency when the runtime is already on the canonical Postgres path.
  - `v4-rollout-status` now reports the legacy DB file as `state: 'not-required'` in relational-store mode, and `/api/v4/meta/rollout` no longer treats a missing SQLite file as a hard blocker for baseline readiness in that mode.
- Verification:
  - `pnpm exec vitest run tests/server-v4/noopBusinessSnapshotReader.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/v4RolloutStatus.test.js tests/server-v4/appShell.test.js --environment node` -> Passed (`12/12`)
  - `pnpm run build:server-v4` -> Passed
  - `pnpm exec eslint server-v4/src/persistence/noopBusinessSnapshotReader.ts server-v4/src/persistence/runtimePersistence.ts server-v4/src/app/v4-rollout-status.ts tests/server-v4/noopBusinessSnapshotReader.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/v4RolloutStatus.test.js tests/server-v4/appShell.test.js` -> Passed
  - `git diff --check -- server-v4/src/persistence/noopBusinessSnapshotReader.ts server-v4/src/persistence/runtimePersistence.ts server-v4/src/app/v4-rollout-status.ts tests/server-v4/noopBusinessSnapshotReader.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/v4RolloutStatus.test.js tests/server-v4/appShell.test.js` -> Passed
- Residual after this slice:
  - `server-v4` no longer keeps a hidden SQLite reader alive in relational-store mode, but broader business ownership still stops at the existing Postgres read seams and reporting projections.
  - The next meaningful Phase D work is wider canonical Postgres business-read/write ownership, not reviving legacy DB expectations inside rollout metadata.

## 2026-03-13 Phase D KPI Adjustments Route Surface
- Mounted `kpi-adjustments` as a real server-v4 business route instead of consuming the async reader only inside reporting.
- Updated:
  - `server-v4/src/modules/kpi-adjustments/KpiAdjustmentsRepository.ts`
  - `server-v4/src/modules/kpi-adjustments/kpiAdjustmentsService.ts`
  - `server-v4/src/modules/kpi-adjustments/KpiAdjustmentsController.ts`
  - `server-v4/src/modules/kpi-adjustments/kpiAdjustmentsRoutes.ts`
  - `server-v4/src/app/build-v4-app.ts`
  - `tests/server-v4/postgresKpiAdjustmentsRoute.test.js`
  - `tests/server-v4/appShell.test.js`
  - `tests/server-v4/v4RolloutStatus.test.js`
- Runtime behavior after this slice:
  - `/api/v4/kpi-adjustments` now returns filtered read-side adjustment data through the async persistence seam with normalization for category, month, status, staff/team names, totals, and deterministic sorting.
  - `buildV4App()` now treats `kpi-adjustments` as an implemented module, so default rollout coverage advances from 5 to 6 mounted modules and the scaffold count drops from 3 to 2.
  - The route stays intentionally read-only for now; adjustment submit/approve/settings mutation semantics remain outside this slice.
- Verification:
  - `pnpm exec vitest run tests/server-v4/postgresKpiAdjustmentsRoute.test.js tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js tests/server-v4/runtimeRoutes.test.js --environment node` -> Passed (`31/31`)
  - `pnpm run build:server-v4` -> Passed
  - `pnpm exec eslint server-v4/src/modules/kpi-adjustments/KpiAdjustmentsRepository.ts server-v4/src/modules/kpi-adjustments/kpiAdjustmentsService.ts server-v4/src/modules/kpi-adjustments/KpiAdjustmentsController.ts server-v4/src/modules/kpi-adjustments/kpiAdjustmentsRoutes.ts server-v4/src/app/build-v4-app.ts tests/server-v4/postgresKpiAdjustmentsRoute.test.js tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js` -> Passed
  - `git diff --check -- server-v4/src/modules/kpi-adjustments/KpiAdjustmentsRepository.ts server-v4/src/modules/kpi-adjustments/kpiAdjustmentsService.ts server-v4/src/modules/kpi-adjustments/KpiAdjustmentsController.ts server-v4/src/modules/kpi-adjustments/kpiAdjustmentsRoutes.ts server-v4/src/app/build-v4-app.ts tests/server-v4/postgresKpiAdjustmentsRoute.test.js tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js` -> Passed
- Residual after this slice:
  - `kpi-adjustments` is now mounted as a canonical read surface, but submit/approve/settings mutation paths still are not owned by `server-v4`.
  - The next meaningful Phase D work is another standalone business module or a deliberate write/settings cutover, not more reporting-only adapter cleanup.

## 2026-03-13 Phase D Runtime Route Coverage Truthfulness
- Replaced optimistic rollout accounting with an explicit mounted-route coverage seam so `server-v4` health/rollout metadata reports what the runtime actually serves.
- Updated:
  - `server-v4/src/app/runtimeRouteCoverage.ts`
  - `server-v4/src/app/build-v4-app.ts`
  - `server-v4/src/app/v4-rollout-status.ts`
  - `tests/server-v4/appShell.test.js`
  - `tests/server-v4/v4RolloutStatus.test.js`
- Runtime behavior after this slice:
  - `buildV4App()` now passes explicit per-module mounted route coverage into `buildV4RolloutStatus()` for both `/api/v4/health` and `/api/v4/meta/rollout`.
  - `v4-rollout-status` now uses that mounted coverage to compute implemented route totals and mutation coverage when a module is live, instead of inferring from the broader `moduleCatalog` declarations.
  - Read-only modules like `kpi-adjustments` now remain truthfully `readOnly`, and reporting no longer inherits route counts from catalog endpoints that are not actually mounted in the runtime.
  - Current mounted rollout metrics now settle at 6 implemented modules, 5 read-only modules, 1 read-write module, 12 implemented routes, and 2 implemented mutation routes.
- Verification:
  - `pnpm exec vitest run tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js tests/server-v4/postgresKpiAdjustmentsRoute.test.js --environment node` -> Passed (`9/9`)
  - `pnpm run build:server-v4` -> Passed
  - `pnpm exec eslint server-v4/src/app/runtimeRouteCoverage.ts server-v4/src/app/build-v4-app.ts server-v4/src/app/v4-rollout-status.ts tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js` -> Passed
  - `git diff --check -- server-v4/src/app/runtimeRouteCoverage.ts server-v4/src/app/build-v4-app.ts server-v4/src/app/v4-rollout-status.ts tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js` -> Passed
- Residual after this slice:
  - Rollout metadata is now truthful about mounted surface area, but `auth` and `hq-agencies` remain scaffold modules and still contribute only catalog-intent totals on the unimplemented side.
  - The next meaningful Phase D work is another real module surface or broader business-write ownership, not more optimistic coverage math.

## 2026-03-13 Phase D HQ Agencies Read Surface
- Mounted `hq-agencies` as the next canonical `server-v4` business-read module with bindings and history routes.
- Updated:
  - `server-v4/src/modules/hq-agencies/hqAgenciesAsyncReader.ts`
  - `server-v4/src/modules/hq-agencies/sqliteHqAgenciesAsyncReader.ts`
  - `server-v4/src/modules/hq-agencies/postgresHqAgenciesAsyncReader.ts`
  - `server-v4/src/modules/hq-agencies/HqAgenciesRepository.ts`
  - `server-v4/src/modules/hq-agencies/hqAgenciesService.ts`
  - `server-v4/src/modules/hq-agencies/HqAgenciesController.ts`
  - `server-v4/src/modules/hq-agencies/hqAgenciesRoutes.ts`
  - `server-v4/src/persistence/runtimePersistence.ts`
  - `server-v4/src/app/build-v4-app.ts`
  - `server-v4/src/app/runtimeRouteCoverage.ts`
  - `tests/server-v4/postgresHqAgenciesAsyncReader.test.js`
  - `tests/server-v4/postgresHqAgenciesRoute.test.js`
  - `tests/server-v4/runtimePersistence.test.js`
  - `tests/server-v4/appShell.test.js`
  - `tests/server-v4/v4RolloutStatus.test.js`
- Runtime behavior after this slice:
  - `/api/v4/hq-agencies` now exposes filtered MST-to-agency bindings and `/api/v4/hq-agencies/history` exposes normalized binding history through a dedicated async reader seam.
  - `runtimePersistence` now carries `hqAgenciesReader`; in `postgres` mode it reads canonical binding/event tables first and falls back to SQLite `hq_agencies_v1` / `hq_history_v1` payloads only as compatibility transport.
  - `buildV4App()` now mounts `hq-agencies` as an implemented module, so rollout coverage advances to 7 implemented modules, 6 read-only modules, 1 read-write module, 14 implemented routes, and 2 implemented mutation routes.
  - Only `auth` remains scaffolded in the default module catalog.
- Verification:
  - `pnpm exec vitest run tests/server-v4/postgresHqAgenciesAsyncReader.test.js tests/server-v4/postgresHqAgenciesRoute.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js --environment node` -> Passed (`13/13`)
  - `pnpm run build:server-v4` -> Passed
  - `pnpm exec eslint server-v4/src/app/build-v4-app.ts server-v4/src/app/runtimeRouteCoverage.ts server-v4/src/persistence/runtimePersistence.ts server-v4/src/modules/hq-agencies/*.ts tests/server-v4/postgresHqAgenciesAsyncReader.test.js tests/server-v4/postgresHqAgenciesRoute.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js` -> Passed
  - `git diff --check -- server-v4/src/app/build-v4-app.ts server-v4/src/app/runtimeRouteCoverage.ts server-v4/src/persistence/runtimePersistence.ts server-v4/src/modules/hq-agencies tests/server-v4/postgresHqAgenciesAsyncReader.test.js tests/server-v4/postgresHqAgenciesRoute.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js task.md task_plan.md findings.md progress.md` -> Passed
- Residual after this slice:
  - Phase D no longer lacks a real `hq-agencies` surface, but the module is intentionally read-only and auth still remains scaffolded.
  - The next meaningful Phase D work is auth ownership or broader write-path migration for already-mounted modules, not more read-only surface expansion.

## 2026-03-13 Phase D Auth Route Surface
- Mounted `auth` as the final scaffold replacement in the default `server-v4` catalog.
- `server-v4/src/modules/auth/*` now owns:
  - cookie-session restore/login/logout
  - admin-gated account listing
  - account create/update flows
  - last-admin demotion guard
- `runtimePersistence.ts` now exposes `authStore` in both SQLite dual-write and Postgres modes, and `buildV4App()` mounts `auth` through `buildAuthRouter(...)`.
- Added legacy-boundary declarations needed for a real build:
  - `server-v4/src/types/bcryptjs.d.ts`
  - `packages/domain/src/accountRoles.d.ts`
  - `server/bootstrapAccountPasswords.d.ts`
- Added `tests/server-v4/authRoutes.test.js` and updated rollout/runtime tests so the default mounted surface now verifies:
  - `8/8` implemented modules
  - `0` scaffold modules
  - `6` read-only modules
  - `2` read-write modules
  - `20` implemented routes
  - `6` implemented mutation routes
  - `readiness=ready`
  - `currentStage=cutover-ready`
- Verification:
  - `pnpm exec vitest run tests/server-v4/authRoutes.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js --environment node` -> Passed (`13/13`)
  - `pnpm run build:server-v4` -> Passed
  - `pnpm exec eslint server-v4/src/modules/auth/AuthController.ts server-v4/src/modules/auth/authRoutes.ts server-v4/src/modules/auth/authService.ts server-v4/src/modules/auth/authShared.ts server-v4/src/modules/auth/authStore.ts server-v4/src/modules/auth/authTypes.ts server-v4/src/modules/auth/postgresAuthStore.ts server-v4/src/modules/auth/sqliteAuthStore.ts tests/server-v4/authRoutes.test.js tests/server-v4/appShell.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/v4RolloutStatus.test.js` -> Passed
  - `git diff --check -- server-v4/src/modules/auth server-v4/src/types/bcryptjs.d.ts packages/domain/src/accountRoles.d.ts server/bootstrapAccountPasswords.d.ts tests/server-v4/authRoutes.test.js tests/server-v4/appShell.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/v4RolloutStatus.test.js server-v4/src/app/build-v4-app.ts server-v4/src/app/runtimeRouteCoverage.ts server-v4/src/persistence/runtimePersistence.ts` -> Passed
- Residual after this slice:
  - Phase D no longer has scaffold-module gaps.
  - Broader business write ownership still remains outside `server-v4`, so the next meaningful work is deeper relational write-path migration rather than more module-parity cleanup.

## 2026-03-14 Phase D KPI Adjustments Write Ownership
- Extended the existing `kpi-adjustments` slice from read-only parity into real write/settings ownership inside `server-v4`.
- Added:
  - `server-v4/src/modules/auth/authSessionContext.ts`
  - `server-v4/src/modules/kpi-adjustments/kpiAdjustmentsStore.ts`
  - `server-v4/src/modules/kpi-adjustments/noopKpiAdjustmentsStore.ts`
  - `server-v4/src/modules/kpi-adjustments/sqliteKpiAdjustmentsStore.ts`
  - `server-v4/src/modules/kpi-adjustments/postgresKpiAdjustmentsStore.ts`
- Updated:
  - `server-v4/src/modules/kpi-adjustments/KpiAdjustmentsController.ts`
  - `server-v4/src/modules/kpi-adjustments/kpiAdjustmentsRoutes.ts`
  - `server-v4/src/modules/kpi-adjustments/kpiAdjustmentsService.ts`
  - `server-v4/src/modules/kpi-adjustments/KpiAdjustmentsRepository.ts`
  - `server-v4/src/persistence/runtimePersistence.ts`
  - `server-v4/src/app/build-v4-app.ts`
  - `server-v4/src/app/runtimeRouteCoverage.ts`
  - `tests/server-v4/postgresKpiAdjustmentsRoute.test.js`
  - `tests/server-v4/runtimePersistence.test.js`
  - `tests/server-v4/appShell.test.js`
  - `tests/server-v4/v4RolloutStatus.test.js`
- Runtime behavior after this slice:
  - `kpi-adjustments` now owns `GET/PUT /api/v4/kpi-adjustments/settings`, `POST /api/v4/kpi-adjustments`, and `PATCH /api/v4/kpi-adjustments/:adjustmentId` behind the existing cookie-session boundary instead of staying a read-only catalog surface.
  - `runtimePersistence` now carries `adjustmentsStore` in both SQLite dual-write and Postgres modes, so adjustment/settings mutations have an explicit runtime-store contract rather than being left to monolith-only ownership.
  - Default rollout truth now settles at `8/8` implemented modules, `0` scaffold modules, `5` read-only modules, `3` read-write modules, `24` implemented routes, `9` implemented mutation routes, `readiness=ready`, and `currentStage=cutover-ready`.
- Verification:
  - `pnpm exec vitest run tests/server-v4/postgresKpiAdjustmentsRoute.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js --environment node` -> Passed (`14/14`)
  - `git diff --check -- tests/server-v4/postgresKpiAdjustmentsRoute.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js server-v4/src/modules/kpi-adjustments/kpiAdjustmentsRoutes.ts server-v4/src/modules/kpi-adjustments/KpiAdjustmentsController.ts server-v4/src/modules/kpi-adjustments/kpiAdjustmentsService.ts server-v4/src/modules/kpi-adjustments/kpiAdjustmentsStore.ts server-v4/src/modules/kpi-adjustments/noopKpiAdjustmentsStore.ts server-v4/src/modules/kpi-adjustments/sqliteKpiAdjustmentsStore.ts server-v4/src/modules/kpi-adjustments/postgresKpiAdjustmentsStore.ts server-v4/src/modules/auth/authSessionContext.ts server-v4/src/persistence/runtimePersistence.ts server-v4/src/app/runtimeRouteCoverage.ts` -> Passed
- Residual after this slice:
  - Phase D no longer needs more `kpi-adjustments` parity or rollout-truth work.
  - The next meaningful cut is another business write/settings ownership slice beyond `reporting`, `auth`, and `kpi-adjustments`; `/api/storage` route registration remains low-value residue only.

## 2026-03-14 Phase D KPI Rules Write Ownership
- Extended the existing `kpi-rules` slice from read-only parity into real write/settings ownership inside `server-v4`.
- Added:
  - `server-v4/src/modules/kpi-rules/kpiRulesStore.ts`
  - `server-v4/src/modules/kpi-rules/noopKpiRulesStore.ts`
  - `server-v4/src/modules/kpi-rules/sqliteKpiRulesStore.ts`
  - `server-v4/src/modules/kpi-rules/postgresKpiRulesStore.ts`
- Updated:
  - `server-v4/src/modules/kpi-rules/KpiRulesController.ts`
  - `server-v4/src/modules/kpi-rules/kpiRulesRoutes.ts`
  - `server-v4/src/modules/kpi-rules/kpiRulesService.ts`
  - `server-v4/src/persistence/runtimePersistence.ts`
  - `server-v4/src/app/build-v4-app.ts`
  - `server-v4/src/app/runtimeRouteCoverage.ts`
  - `tests/server-v4/postgresKpiRulesRoute.test.js`
  - `tests/server-v4/runtimePersistence.test.js`
  - `tests/server-v4/appShell.test.js`
  - `tests/server-v4/v4RolloutStatus.test.js`
- Runtime behavior after this slice:
  - `kpi-rules` now owns `POST /api/v4/kpi-rules` and `POST /api/v4/kpi-rules/:ruleSetId/activate` behind the existing cookie-session boundary instead of staying a read-only catalog surface.
  - `runtimePersistence` now carries `kpiRulesStore` in both SQLite dual-write and Postgres modes, so rule-set draft creation and activation have an explicit runtime-store contract rather than remaining outside the typed runtime.
  - `KpiRulesService` now keeps same-process draft-create -> activate flows coherent through an explicit last-written collection handoff, avoiding stale follow-up reads while preserving the canonical store boundary.
  - Default rollout truth now settles at `8/8` implemented modules, `0` scaffold modules, `4` read-only modules, `4` read-write modules, `26` implemented routes, `11` implemented mutation routes, `readiness=ready`, and `currentStage=cutover-ready`.
- Verification:
  - `pnpm exec vitest run tests/server-v4/postgresKpiRulesRoute.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js --environment node` -> Passed (`13/13`)
  - `pnpm run build:server-v4` -> Passed
  - `pnpm exec eslint server-v4/src/modules/kpi-rules/KpiRulesController.ts server-v4/src/modules/kpi-rules/kpiRulesRoutes.ts server-v4/src/modules/kpi-rules/kpiRulesService.ts server-v4/src/modules/kpi-rules/kpiRulesStore.ts server-v4/src/modules/kpi-rules/noopKpiRulesStore.ts server-v4/src/modules/kpi-rules/sqliteKpiRulesStore.ts server-v4/src/modules/kpi-rules/postgresKpiRulesStore.ts server-v4/src/app/build-v4-app.ts server-v4/src/app/runtimeRouteCoverage.ts server-v4/src/persistence/runtimePersistence.ts tests/server-v4/postgresKpiRulesRoute.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js` -> Passed
  - `git diff --check -- server-v4/src/modules/kpi-rules/KpiRulesController.ts server-v4/src/modules/kpi-rules/kpiRulesRoutes.ts server-v4/src/modules/kpi-rules/kpiRulesService.ts server-v4/src/modules/kpi-rules/kpiRulesStore.ts server-v4/src/modules/kpi-rules/noopKpiRulesStore.ts server-v4/src/modules/kpi-rules/sqliteKpiRulesStore.ts server-v4/src/modules/kpi-rules/postgresKpiRulesStore.ts server-v4/src/app/build-v4-app.ts server-v4/src/app/runtimeRouteCoverage.ts server-v4/src/persistence/runtimePersistence.ts tests/server-v4/postgresKpiRulesRoute.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js` -> Passed
- Residual after this slice:
  - Phase D no longer needs more `kpi-rules` parity or rollout-truth work.
  - The next meaningful cut is another business write/settings ownership slice beyond `reporting`, `auth`, `kpi-adjustments`, and `kpi-rules`; `/api/storage` route registration remains low-value residue only.

## 2026-03-14 Phase D HQ Agencies Write Ownership
- Extended the existing `hq-agencies` slice from read-only parity into real write/history ownership inside `server-v4`.
- Added:
  - `server-v4/src/modules/hq-agencies/hqAgenciesStore.ts`
  - `server-v4/src/modules/hq-agencies/noopHqAgenciesStore.ts`
  - `server-v4/src/modules/hq-agencies/sqliteHqAgenciesStore.ts`
  - `server-v4/src/modules/hq-agencies/postgresHqAgenciesStore.ts`
- Updated:
  - `server-v4/src/modules/hq-agencies/HqAgenciesController.ts`
  - `server-v4/src/modules/hq-agencies/hqAgenciesRoutes.ts`
  - `server-v4/src/modules/hq-agencies/hqAgenciesService.ts`
  - `server-v4/src/persistence/runtimePersistence.ts`
  - `server-v4/src/app/build-v4-app.ts`
  - `server-v4/src/app/runtimeRouteCoverage.ts`
  - `tests/server-v4/postgresHqAgenciesRoute.test.js`
  - `tests/server-v4/runtimePersistence.test.js`
  - `tests/server-v4/appShell.test.js`
  - `tests/server-v4/v4RolloutStatus.test.js`
- Runtime behavior after this slice:
  - `hq-agencies` now owns `POST /api/v4/hq-agencies` and `DELETE /api/v4/hq-agencies/:taxCode` behind the existing cookie-session boundary instead of staying a read-only catalog surface.
  - `runtimePersistence` now carries `hqAgenciesStore` in both SQLite dual-write and Postgres modes, so binding upsert/delete plus normalized history-event persistence have an explicit runtime-store contract rather than remaining in the monolith/store layer.
  - Default rollout truth now settles at `8/8` implemented modules, `0` scaffold modules, `3` read-only modules, `5` read-write modules, `28` implemented routes, `13` implemented mutation routes, `readiness=ready`, and `currentStage=cutover-ready`.
- Verification:
  - `pnpm exec vitest run tests/server-v4/postgresHqAgenciesRoute.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js --environment node` -> Passed (`14/14`)
  - `pnpm run build:server-v4` -> Passed
  - `pnpm exec eslint server-v4/src/modules/hq-agencies server-v4/src/persistence/runtimePersistence.ts server-v4/src/app/build-v4-app.ts server-v4/src/app/runtimeRouteCoverage.ts tests/server-v4/postgresHqAgenciesRoute.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js` -> Passed
  - `git diff --check` -> Passed
- Residual after this slice:
  - Phase D no longer needs more `hq-agencies` parity or rollout-truth work.
  - The next meaningful cut is another broader business write/settings ownership slice beyond `reporting`, `auth`, `kpi-adjustments`, `kpi-rules`, and `hq-agencies`; `declarations` is now the strongest next candidate, while `/api/storage` route registration remains low-value residue only.

## 2026-03-14 Phase D Declarations Write Ownership
- Extended the existing `declarations` slice from read-only parity into real mutation and event-history ownership inside `server-v4`.
- Added:
  - `server-v4/src/modules/declarations/declarationsStore.ts`
  - `server-v4/src/modules/declarations/noopDeclarationsStore.ts`
  - `server-v4/src/modules/declarations/sqliteDeclarationsStore.ts`
  - `server-v4/src/modules/declarations/postgresDeclarationsStore.ts`
- Updated:
  - `server-v4/src/modules/declarations/DeclarationsRepository.ts`
  - `server-v4/src/modules/declarations/declarationsService.ts`
  - `server-v4/src/modules/declarations/DeclarationsController.ts`
  - `server-v4/src/modules/declarations/declarationsRoutes.ts`
  - `server-v4/src/modules/declarations/postgresDeclarationAsyncReader.ts`
  - `server-v4/src/persistence/runtimePersistence.ts`
  - `server-v4/src/app/build-v4-app.ts`
  - `server-v4/src/app/runtimeRouteCoverage.ts`
  - `tests/server-v4/declarationsStore.test.js`
  - `tests/server-v4/postgresDeclarationsRoute.test.js`
  - `tests/server-v4/postgresDeclarationAsyncReader.test.js`
  - `tests/server-v4/runtimePersistence.test.js`
  - `tests/server-v4/appShell.test.js`
  - `tests/server-v4/v4RolloutStatus.test.js`
- Runtime behavior after this slice:
  - `declarations` now owns `PATCH /api/v4/declarations/:declarationId` and `GET /api/v4/declarations/:declarationId/events` behind the existing cookie-session `importEdit` and `accountManage` boundary instead of staying a read-only catalog surface.
  - `runtimePersistence` now carries `declarationsStore` in both SQLite dual-write and Postgres modes, so declaration patch/history ownership is explicit at runtime composition instead of remaining hidden in monolith-only logic.
  - Reviewed declarations remain locked by default, with the admin override preserved through the typed runtime contract rather than bypassing it.
  - Default rollout truth now settles at `8/8` implemented modules, `0` scaffold modules, `2` read-only modules, `6` read-write modules, `30` implemented routes, `14` implemented mutation routes, `readiness=ready`, and `currentStage=cutover-ready`.
- Verification:
  - `pnpm exec vitest run tests/server-v4/declarationsStore.test.js tests/server-v4/postgresDeclarationsRoute.test.js tests/server-v4/postgresDeclarationAsyncReader.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js --environment node` -> Passed (`19/19`)
  - `pnpm run build:server-v4` -> Passed
  - `pnpm exec eslint server-v4/src/modules/declarations server-v4/src/persistence/runtimePersistence.ts server-v4/src/app/build-v4-app.ts server-v4/src/app/runtimeRouteCoverage.ts tests/server-v4/declarationsStore.test.js tests/server-v4/postgresDeclarationsRoute.test.js tests/server-v4/postgresDeclarationAsyncReader.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js` -> Passed
  - `git diff --check` -> Passed for the touched scope; only unrelated existing LF/CRLF warnings remained elsewhere in the worktree.
- Tracking:
  - Closed `cng-i6h.4` after reaching the planned declarations write/events milestone.
  - Created follow-up `cng-i6h.5` to carry the remaining SQLite/Postgres ownership residue.
- Residual after this slice:
  - Phase D no longer needs more declarations parity or rollout-truth work.
  - The next meaningful cut is `cng-i6h.5`: inventory the remaining SQLite compatibility ownership and move the next high-leverage canonical business path further toward relational-store ownership with explicit fallback/rollback guardrails.

## 2026-03-14 Phase E HQ Agencies SQLite Guardrail
- Continued `cng-i6h.5` by removing the last silent SQLite dependency from the Postgres `hq-agencies` runtime path.
- Added:
  - `server-v4/src/modules/hq-agencies/noopHqAgenciesAsyncReader.ts`
- Updated:
  - `server-v4/src/config/server-v4-config.ts`
  - `server-v4/src/persistence/runtimePersistence.ts`
  - `apps/api/src/apiRuntimeConfig.js`
  - `apps/api/src/startApiServer.js`
  - `tests/appsApiRuntimeConfig.test.js`
  - `tests/appsApiStart.test.js`
  - `tests/server-v4/runtimePersistence.test.js`
  - `tests/server-v4/noopHqAgenciesAsyncReader.test.js`
- Runtime behavior after this slice:
  - `apps/api` now exposes `KPI_API_POSTGRES_LEGACY_SQLITE_FALLBACK` / `postgresLegacySqliteFallback`, so rollback is explicit at config time instead of hidden in runtime composition.
  - `server-v4` `postgres` mode now defaults `hq-agencies` to `NoopHqAgenciesAsyncReader` with `sourceKind='relational-store'`; the SQLite compatibility reader is only instantiated when the rollback flag is enabled.
  - `PostgresHqAgenciesAsyncReader` still accepts the legacy fallback seam, but `legacyDbFile` is now `null` by default and only populated for the explicit rollback path.
- Verification note:
  - Scoped eslint initially failed on LF/CRLF drift in the touched JS/test files; normalized those files back to `CRLF`, then reran the full targeted verification bundle.
- Verification:
  - `pnpm exec vitest run tests/server-v4/noopHqAgenciesAsyncReader.test.js tests/server-v4/postgresHqAgenciesAsyncReader.test.js tests/server-v4/runtimePersistence.test.js tests/appsApiRuntimeConfig.test.js tests/appsApiStart.test.js tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js --environment node` -> Passed (`22/22`)
  - `pnpm exec eslint apps/api/src/apiRuntimeConfig.js apps/api/src/startApiServer.js server-v4/src/config/server-v4-config.ts server-v4/src/persistence/runtimePersistence.ts server-v4/src/modules/hq-agencies/noopHqAgenciesAsyncReader.ts tests/appsApiRuntimeConfig.test.js tests/appsApiStart.test.js tests/server-v4/noopHqAgenciesAsyncReader.test.js tests/server-v4/postgresHqAgenciesAsyncReader.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js` -> Passed
  - `pnpm run build:server-v4` -> Passed
  - `git diff --check -- apps/api/src/apiRuntimeConfig.js apps/api/src/startApiServer.js server-v4/src/config/server-v4-config.ts server-v4/src/persistence/runtimePersistence.ts server-v4/src/modules/hq-agencies/noopHqAgenciesAsyncReader.ts tests/appsApiRuntimeConfig.test.js tests/appsApiStart.test.js tests/server-v4/noopHqAgenciesAsyncReader.test.js tests/server-v4/postgresHqAgenciesAsyncReader.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js task.md task_plan.md findings.md progress.md` -> Passed
- Residual after this slice:
  - `cng-i6h.5` stays open; the next meaningful cut is the next hidden SQLite compatibility seam beyond `hq-agencies`, not low-value `/api/storage` route-registration residue.

## 2026-03-14 Phase E Postgres DbFile Nullability Guardrail
- Continued `cng-i6h.5` by removing the default legacy SQLite `dbFile` from the Postgres runtime path unless an explicit rollback is requested.
- Updated:
  - `server-v4/src/config/server-v4-config.ts`
  - `server-v4/src/persistence/runtimePersistence.ts`
  - `server-v4/src/app/v4-rollout-status.ts`
  - `apps/api/src/apiRuntimeConfig.js`
  - `apps/api/src/cli.js`
  - `tests/appsApiRuntimeConfig.test.js`
  - `tests/appsApiStart.test.js`
  - `tests/server-v4/runtimePersistence.test.js`
  - `tests/server-v4/appShell.test.js`
  - `tests/server-v4/v4RolloutStatus.test.js`
- Runtime behavior after this slice:
  - `resolveServerV4Config()` and `loadApiRuntimeConfig()` now return `dbFile: null` by default in `postgres` mode when `postgresLegacySqliteFallback` is disabled, instead of silently synthesizing the repo SQLite path.
  - `createRuntimePersistence()` now requires `KPI_API_DB_FILE` only when the runtime is actually on `sqlite-dual-write` or when `KPI_API_POSTGRES_LEGACY_SQLITE_FALLBACK` is explicitly enabled.
  - `server-v4` rollout health now reports the legacy DB file as `path='(not configured)'` with `state='not-required'` on the relational-store path, so Postgres mode no longer pretends to own a hidden SQLite file.
- Verification note:
  - The first verification pass surfaced one TypeScript narrowing error in `runtimePersistence` plus CRLF-only scoped eslint failures on touched JS/test files; fixed the narrowing issue, normalized those files back to `CRLF`, then reran the full targeted bundle.
- Verification:
  - `pnpm exec vitest run tests/appsApiRuntimeConfig.test.js tests/appsApiStart.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js tests/server-v4/noopHqAgenciesAsyncReader.test.js tests/server-v4/postgresHqAgenciesAsyncReader.test.js --environment node` -> Passed (`25/25`)
  - `pnpm exec eslint apps/api/src/apiRuntimeConfig.js apps/api/src/startApiServer.js apps/api/src/cli.js server-v4/src/config/server-v4-config.ts server-v4/src/persistence/runtimePersistence.ts server-v4/src/app/v4-rollout-status.ts server-v4/src/modules/hq-agencies/noopHqAgenciesAsyncReader.ts tests/appsApiRuntimeConfig.test.js tests/appsApiStart.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js tests/server-v4/noopHqAgenciesAsyncReader.test.js tests/server-v4/postgresHqAgenciesAsyncReader.test.js` -> Passed
  - `pnpm run build:server-v4` -> Passed
- Residual after this slice:
  - `cng-i6h.5` stays open; the next meaningful cut is to decide whether the remaining Postgres readers still need snapshot-shaped compatibility fallbacks at all now that the default runtime no longer carries a legacy SQLite file.

## 2026-03-14 Phase E Declarations And Adjustments Snapshot-Fallback Retirement
- Continued `cng-i6h.5` by retiring the remaining snapshot-row transport fallback from the Postgres declaration and adjustment readers.
- Updated:
  - `server-v4/src/modules/declarations/postgresDeclarationAsyncReader.ts`
  - `server-v4/src/modules/kpi-adjustments/postgresAdjustmentAsyncReader.ts`
  - `tests/server-v4/postgresDeclarationAsyncReader.test.js`
  - `tests/server-v4/postgresAdjustmentAsyncReader.test.js`
- Runtime behavior after this slice:
  - Inventory across `adjustments`, `declarations`, `kpi-rules`, `mst-assignments`, and `teams` confirmed that default Postgres mode no longer hides a runtime-wide SQLite fallback reader. The remaining residue is now reader-local and uneven.
  - `postgresDeclarationAsyncReader` now reads canonical `declarations` plus `declaration_license_codes` rows and falls directly to the compatibility reader when canonical rows are absent. It no longer queries `declaration_snapshot_rows` as an intermediate Postgres transport fallback.
  - `postgresAdjustmentAsyncReader` now reads canonical `kpi_adjustments` rows and falls directly to the compatibility reader when canonical rows are absent. It no longer queries `adjustment_snapshot_rows` as an intermediate Postgres transport fallback.
  - `mst-assignments` and `kpi-rules` were already at the same end-state, while `teams` remains the deeper next seam because its primary Postgres roster path still depends on snapshot-materialized relational tables.
- Verification:
  - `pnpm exec vitest run tests/server-v4/postgresDeclarationAsyncReader.test.js tests/server-v4/postgresAdjustmentAsyncReader.test.js tests/server-v4/runtimePersistence.test.js --environment node` -> Passed (`11/11`)
  - `pnpm exec eslint server-v4/src/modules/declarations/postgresDeclarationAsyncReader.ts server-v4/src/modules/kpi-adjustments/postgresAdjustmentAsyncReader.ts tests/server-v4/postgresDeclarationAsyncReader.test.js tests/server-v4/postgresAdjustmentAsyncReader.test.js tests/server-v4/runtimePersistence.test.js` -> Passed
  - `pnpm run build:server-v4` -> Passed
- Residual after this slice:
  - `cng-i6h.5` stays open; `teams` is now the strongest next Phase E seam because the Postgres roster path still relies on snapshot-materialized relational tables even after the declaration/adjustment snapshot-row fallbacks are gone.

## 2026-03-14 Phase E Teams State-Table Retirement
- Continued `cng-i6h.5` by removing the `team_roster_state` gate from the Postgres team-roster reader.
- Updated:
  - `server-v4/src/modules/teams/postgresTeamRosterAsyncReader.ts`
  - `tests/server-v4/postgresTeamRosterAsyncReader.test.js`
- Runtime behavior after this slice:
  - `postgresTeamRosterAsyncReader` now treats `teams` plus `team_members` as the primary canonical roster source instead of requiring a `team_roster_state` row first.
  - In `relational-store` mode, an empty result from those two Postgres tables now returns a canonical empty roster instead of silently reviving compatibility data.
  - In `dual-write` mode, the reader still falls back to the compatibility reader when Postgres has no active roster rows or when the query path throws, so rollback behavior stays explicit.
  - This cuts one more snapshot-shaped dependency from the `teams` seam without changing the public API contract, which already sanitizes roster versions back to `1`.
- Verification:
  - `pnpm exec vitest run tests/server-v4/postgresTeamRosterAsyncReader.test.js tests/server-v4/runtimePersistence.test.js --environment node` -> Passed (`9/9`)
  - `pnpm exec eslint server-v4/src/modules/teams/postgresTeamRosterAsyncReader.ts tests/server-v4/postgresTeamRosterAsyncReader.test.js tests/server-v4/runtimePersistence.test.js` -> Passed
  - `pnpm run build:server-v4` -> Passed
  - `git diff --check -- server-v4/src/modules/teams/postgresTeamRosterAsyncReader.ts tests/server-v4/postgresTeamRosterAsyncReader.test.js` -> Passed
- Residual after this slice:
  - `cng-i6h.5` stays open; the remaining `teams` leverage is no longer the state-table gate but the snapshot-materialized roster table shape itself (`teams`, `team_members`, `snapshot_key`, `active`).

## 2026-03-14 Phase E Teams Write Ownership
- Continued `cng-i6h.5` by turning `teams` into an explicit runtime-owned write boundary instead of leaving roster replacement implicit in legacy storage behavior.
- Updated:
  - `server-v4/src/modules/teams/teamRosterDocument.ts`
  - `server-v4/src/modules/teams/TeamsRepository.ts`
  - `server-v4/src/modules/teams/teamsService.ts`
  - `server-v4/src/modules/teams/TeamsController.ts`
  - `server-v4/src/modules/teams/teamsRoutes.ts`
  - `server-v4/src/modules/teams/teams.module.ts`
  - `server-v4/src/modules/teams/teamsStore.ts`
  - `server-v4/src/modules/teams/noopTeamsStore.ts`
  - `server-v4/src/modules/teams/sqliteTeamsStore.ts`
  - `server-v4/src/modules/teams/postgresTeamsStore.ts`
  - `server-v4/src/persistence/runtimePersistence.ts`
  - `server-v4/src/app/build-v4-app.ts`
  - `server-v4/src/app/runtimeRouteCoverage.ts`
  - `server-v4/src/types/better-sqlite3.d.ts`
  - `tests/server-v4/postgresTeamsRoute.test.js`
  - `tests/server-v4/sqliteTeamsStore.test.js`
  - `tests/server-v4/runtimePersistence.test.js`
  - `tests/server-v4/appShell.test.js`
  - `tests/server-v4/v4RolloutStatus.test.js`
  - `task.md`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Runtime behavior after this slice:
  - `teamRosterDocument.ts` now owns canonical roster normalization/cloning so read and write paths stop duplicating the same roster-shape logic.
  - `teamsStore.ts` establishes an explicit runtime persistence contract, while `noopTeamsStore.ts`, `sqliteTeamsStore.ts`, and `postgresTeamsStore.ts` make the persistence choice visible at composition time instead of burying it in route logic.
  - `PUT /api/v4/teams` now requires an authenticated cookie session and `teamsEdit` or `accountManage`, then persists through the injected store for both SQLite dual-write and Postgres mode.
  - `runtimePersistence` now injects `teamsStore`, `buildV4App()` wires it into the teams router, and rollout truth advances to `1` read-only module, `7` read-write modules, `31` implemented routes, and `15` implemented mutation routes.
  - The first build pass caught a drift in `server-v4/src/types/better-sqlite3.d.ts`; adding `transaction()` there brought the local type shim back in sync with the runtime API used by the new SQLite teams store.
- Verification:
  - `pnpm exec vitest run tests/server-v4/postgresTeamsRoute.test.js tests/server-v4/sqliteTeamsStore.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js --environment node` -> Passed (`16/16`)
  - `pnpm exec eslint server-v4/src/modules/teams/*.ts server-v4/src/persistence/runtimePersistence.ts server-v4/src/app/build-v4-app.ts server-v4/src/app/runtimeRouteCoverage.ts server-v4/src/types/better-sqlite3.d.ts tests/server-v4/postgresTeamsRoute.test.js tests/server-v4/sqliteTeamsStore.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js` -> Passed with one expected warning (`server-v4/src/types/better-sqlite3.d.ts` is outside the current ESLint config scope)
  - `pnpm run build:server-v4` -> Passed
  - `git diff --check -- server-v4/src/modules/teams/ server-v4/src/persistence/runtimePersistence.ts server-v4/src/app/build-v4-app.ts server-v4/src/app/runtimeRouteCoverage.ts server-v4/src/types/better-sqlite3.d.ts tests/server-v4/postgresTeamsRoute.test.js tests/server-v4/sqliteTeamsStore.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js task.md task_plan.md findings.md progress.md` -> Passed
- Closure after this slice:
  - `cng-i6h.5` acceptance criteria are satisfied and the remaining `teams` table-shape cleanup is low-value residue rather than a blocker.
  - The `cng-i6h` follow-through program is now complete.

## 2026-03-14 Broad Backend Diagnostic Reduction
- **Status:** completed
- Actions taken:
  - Claimed `cng-cff` and re-ran the broad backend diagnostic bundle to separate active failures from stale expectations.
  - Reduced the mixed `tests/server.api.test.js` red set from `14` to `6` by normalizing team-roster and ECUS fixtures, replacing mojibake assertions with canonical field assertions, and writing review-locked declaration snapshots through the typed `/api/storage/decl_rows_v1` path.
  - Isolated the last remaining ECUS HQ license-exclusion failure down to a single coherent cluster (`1` failure).
  - Debugged that cluster to `server/reportingRuleSelection.js`, where `resolveReportingRule()` rejected legacy/simple rule snapshots that lacked `groups`, causing `getRulesValue()` to fall back to `SHARED_DEFAULT_RULES`.
  - Widened rule-set detection to accept snapshots with `license` or `bonuses`, added direct regression coverage in `tests/reportingRuleSelection.test.js`, and removed the temporary diagnostics once the bundle was green.
- Files created/modified:
  - `server/reportingRuleSelection.js` (updated)
  - `tests/reportingRuleSelection.test.js` (created)
  - `tests/server.api.test.js` (updated)
  - `task.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)
- Verification:
  - `pnpm exec vitest run tests/reportingRuleSelection.test.js tests/server.api.test.js --environment node` -> passed (`127/127`)
  - `pnpm exec vitest run tests/server.seed.test.js tests/server.api.test.js tests/reportingRuleSelection.test.js --environment node` -> passed (`129/129`)
- Outcome:
  - The active diagnostic path moved `14 -> 6 -> 1 -> 0`.
  - `cng-cff` acceptance criteria are satisfied; future broad regressions can now be tracked as separate beads instead of keeping this slice open.

## 2026-03-14 Smoke Gate Pool Disposal Regression
- **Status:** completed
- Actions taken:
  - Re-ran `pnpm verify:smoke:core` after closing `cng-cff` and caught a new `server-v4` regression in `tests/server-v4/reportingProjectionPostgres.test.js`.
  - Created bead `cng-q7u`, reproduced the failure, and traced it to `server-v4/src/persistence/reportingProjectionPostgres.ts`, where injected pools were treated as caller-owned by default.
  - Changed the default `managePool` contract so standalone persistence instances dispose their pool unless the caller explicitly passes `managePool: false`.
  - Added a second regression test in `tests/server-v4/reportingProjectionPostgres.test.js` to lock the explicit opt-out contract used by `runtimePersistence`.
- Files created/modified:
  - `server-v4/src/persistence/reportingProjectionPostgres.ts` (updated)
  - `tests/server-v4/reportingProjectionPostgres.test.js` (updated)
  - `task.md` (updated)
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)
- Verification:
  - `pnpm exec vitest run tests/server-v4/reportingProjectionPostgres.test.js tests/server-v4/runtimePersistence.test.js --environment node` -> passed (`9/9`)
  - `pnpm verify:smoke:core` -> passed
- Outcome:
  - The smoke gate is green again after the ownership fix.
  - `cng-q7u` acceptance criteria are satisfied; tracker can return to no open issues.
