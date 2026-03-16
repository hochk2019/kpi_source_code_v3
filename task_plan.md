# Task Plan: Residual End-State Convergence After V4 Refactor

## Goal

Close the remaining incomplete or only-partially-complete end-state work after the main refactor phases: finish the reporting projection/persistence story, converge dashboard/export on one reporting read model, and continue shrinking the last large UI/reporting verification residues.

## Current Phase

Mapped `cng-z7u` child slices plus the immediate follow-up beads `cng-f2z`, `cng-vlt`, `cng-tuw`, and `cng-2ch` are complete, and the notebook-only declarations/import follow-through now covers the full legacy declarations `/api/import/*` route surface: ECUS config/status/preview/run, alerts*, search, co-codes, co-discrepancy*, and deleted-declarations. The active notebook-only follow-up remains `server-v4 declarations frontend cutover validation`: keep validating the existing `DataImporter` UI/runtime behavior against those bridged compat routes before choosing deeper persistence cleanup. The latest tracked micro-slice `cng-62v` is closed, the hidden `/api/import/deleted-declarations` compat gap is now closed too, and there is still no ready residual bead active right now.

## Active Declarations Follow-Up Options

1. `frontend cutover validation`
   - Validate the current `DataImporter` network/runtime contract against the already-bridged `server-v4` compat routes.
   - Highest leverage for the smallest change because it can reveal the next real blocker without inventing more route aliases.
2. `canonical search ownership`
   - Move importer search consumption toward a canonical `server-v4` declarations path instead of only the legacy `/api/import/search` alias.
   - Useful, but lower immediate product leverage than proving the current frontend cutover works.
3. `declarations-store cleanup / SQLite compatibility reduction`
   - Reduce remaining SQLite-era residue inside the typed declarations persistence seam.
   - Valuable, but broader and riskier before the real frontend/runtime path has been validated.

### Chosen Slice

- [x] Validate `DataImporter` frontend/runtime behavior against bridged `server-v4` declarations/import routes
- [x] Add focused regression coverage for the first concrete contract mismatch found
- [x] Fix the mismatch inside the smallest appropriate frontend or `server-v4` seam
- [x] Run targeted verification and update the notebook with the result

### Completed Result

- Closed validation mismatch `#1`: importer search paging contract is now consistent across `server-v4` route coverage, hook-level frontend regression coverage, and the local UI integration mock used by `tests/dataImporter.preview.test.jsx`.
- Evidence:
  - `pnpm vitest run tests/server-v4/postgresDeclarationsRoute.test.js --environment node`
  - `pnpm vitest run tests/useDataImporterResultRows.test.jsx tests/dataImporter.preview.test.jsx --environment jsdom`
  - `pnpm exec eslint tests/useDataImporterResultRows.test.jsx tests/dataImporter.preview.test.jsx tests/server-v4/postgresDeclarationsRoute.test.js`
- Closed validation mismatch `#2`: sync preview summary ownership is now aligned with `server-v4` row semantics instead of local saved-row diff recomputation.
- Evidence:
  - `pnpm exec vitest run tests/useDataImporterImportPreview.test.jsx tests/useDataImporterWorkflowSession.test.jsx --environment jsdom`
  - `pnpm exec vitest run tests/useDataImporterImportPreview.test.jsx tests/useDataImporterWorkflowSession.test.jsx tests/useDataImporterSessionController.test.jsx tests/useDataImporterContainerProps.test.jsx tests/useDataImporterImportFlow.test.jsx tests/useDataImporterSavedSession.test.jsx tests/dataImporter.preview.test.jsx --environment jsdom`
  - `pnpm exec eslint src/components/dataImporter/useDataImporterContainerProps.js src/components/dataImporter/useDataImporterImportFlow.js src/components/dataImporter/useDataImporterImportPreview.js src/components/dataImporter/useDataImporterSavedSession.js src/components/dataImporter/useDataImporterSessionController.js src/components/dataImporter/useDataImporterWorkflowSession.js tests/useDataImporterImportPreview.test.jsx tests/useDataImporterWorkflowSession.test.jsx`
  - `git diff --check -- src/components/dataImporter/useDataImporterContainerProps.js src/components/dataImporter/useDataImporterImportFlow.js src/components/dataImporter/useDataImporterImportPreview.js src/components/dataImporter/useDataImporterSavedSession.js src/components/dataImporter/useDataImporterSessionController.js src/components/dataImporter/useDataImporterWorkflowSession.js tests/useDataImporterImportPreview.test.jsx tests/useDataImporterWorkflowSession.test.jsx`
- Closed validation mismatch `#3`: the ECUS success toast now mirrors the `server-v4` commit payload instead of silently dropping `result.updated`.
- Evidence:
  - `pnpm exec vitest run tests/useDataImporterSync.test.jsx --environment jsdom`
  - `pnpm exec eslint src/components/dataImporter/useDataImporterSync.js tests/useDataImporterSync.test.jsx`
  - `git diff --check -- src/components/dataImporter/useDataImporterSync.js tests/useDataImporterSync.test.jsx`
- Closed validation mismatch `#4`: C/O monitoring status text and manual-run messaging are now aligned with the `server-v4` discrepancy payload instead of exposing raw `status` values or dropping `mismatchCount|totalChecked|limited` details.
- Evidence:
  - `pnpm exec vitest run tests/useDataImporterCoMonitoring.test.jsx tests/dataImporterMonitoringPanel.test.jsx --environment jsdom`
  - `pnpm exec eslint src/components/dataImporter/useDataImporterCoMonitoring.js tests/useDataImporterCoMonitoring.test.jsx`
  - `git diff --check -- src/components/dataImporter/useDataImporterCoMonitoring.js tests/useDataImporterCoMonitoring.test.jsx`
- Closed validation mismatch `#5`: the importer monitoring alerts panel now consumes the full `server-v4` alerts list instead of the overview-only `outstandingAlerts.slice(0, 5)` preview, so the operator-facing table is no longer silently truncated.
- Evidence:
  - `pnpm exec vitest run tests/useDataImporterSessionController.test.jsx tests/useDataImporterContainerProps.test.jsx tests/dataImporterMonitoringPanel.test.jsx --environment jsdom`
  - `pnpm exec eslint src/components/dataImporter/useDataImporterSessionController.js src/components/dataImporter/useDataImporterContainerProps.js tests/useDataImporterSessionController.test.jsx tests/useDataImporterContainerProps.test.jsx`
  - `git diff --check -- src/components/dataImporter/useDataImporterSessionController.js src/components/dataImporter/useDataImporterContainerProps.js tests/useDataImporterSessionController.test.jsx tests/useDataImporterContainerProps.test.jsx`
- Closed validation mismatch `#6`: ECUS preview fetched totals now survive the sync hook seam instead of silently falling back to preview row count when the preview payload is limited/truncated.
- Evidence:
  - `pnpm exec vitest run tests/useDataImporterSync.test.jsx tests/useDataImporterWorkflowSession.test.jsx tests/useDataImporterImportPreview.test.jsx --environment jsdom`
  - `pnpm exec eslint src/components/dataImporter/useDataImporterSync.js tests/useDataImporterSync.test.jsx`
  - `git diff --check -- src/components/dataImporter/useDataImporterSync.js tests/useDataImporterSync.test.jsx`
- Closed validation mismatch `#7`: deleted-declarations parity is now restored across the frontend hook, the typed declarations store seam, and the `server-v4` legacy compat layer instead of leaving `/api/import/deleted-declarations` as a hidden monolith-only gap.
- Evidence:
  - `pnpm exec vitest run tests/server-v4/legacyCompatRoutes.test.js --environment node`
  - `pnpm exec vitest run tests/useDataImporterDeletedRows.test.jsx --environment jsdom`
  - `pnpm exec eslint server-v4/src/app/legacyCompatRoutes.ts server-v4/src/modules/declarations/declarationsStore.ts server-v4/src/modules/declarations/sqliteDeclarationsStore.ts server-v4/src/modules/declarations/postgresDeclarationsStore.ts server-v4/src/modules/declarations/noopDeclarationsStore.ts tests/server-v4/legacyCompatRoutes.test.js`
  - `git diff --check -- server-v4/src/app/legacyCompatRoutes.ts server-v4/src/modules/declarations/declarationsStore.ts server-v4/src/modules/declarations/sqliteDeclarationsStore.ts server-v4/src/modules/declarations/postgresDeclarationsStore.ts server-v4/src/modules/declarations/noopDeclarationsStore.ts tests/server-v4/legacyCompatRoutes.test.js`
- Next smallest declarations follow-up remains in the same broad bucket (`frontend cutover validation`), but the next candidate should now move beyond search paging, ECUS success messaging, C/O monitoring, alert-list ownership, preview-fetched propagation, and deleted-declarations parity into another concrete UI/runtime interpretation seam before broader declarations-store cleanup is justified.

## F1-F8 Practical Status Matrix

| Finding                                          | Practical completion | Status          | Residual reality                                                                                                                                                                           |
| ------------------------------------------------ | -------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `F1` bootstrap auth boundary                     | `~95%`               | mostly complete | keep protected bootstrap and regression coverage intact; not an active redesign slice                                                                                                      |
| `F2` account-route authorization                 | `~95%`               | mostly complete | maintain current guards as auth routes evolve; no active blocker remains                                                                                                                   |
| `F3` hardcoded credentials                       | `100%`               | complete        | env-backed bootstrap contract is now the intended steady state                                                                                                                             |
| `F4` public operational routes / actor spoofing  | `~90%`               | mostly complete | continue guarding new operational routes, but the original blocker is closed                                                                                                               |
| `F5` blob-backed SQLite / weak persistence model | `~90%`               | mostly complete | reporting aggregate + schedule projections plus the shared dashboard/export read-model contract are landed; residual work is now mostly thinner reporting UI ownership and harness cleanup |
| `F6` contradictory auth model                    | `~90%`               | mostly complete | cookie-session ownership is now canonical; residual work is mostly guardrail maintenance                                                                                                   |
| `F7` oversized module boundaries                 | `~90%`               | mostly complete | `DataImporter.jsx` is now a thin wrapper, `ReportViewer.jsx` is now below the soft cap, and the remaining residue is smaller repo-wide seam cleanup rather than one blocking hotspot        |
| `F8` unreliable baseline / tooling               | `~95%`               | mostly complete | smoke gate is green and the reporting chart-noise harness is fixed; remaining baseline work is general repo hygiene, not this specific jsdom warning class                                 |

## Residual Convergence Phases (`cng-z7u`)

### Phase A: Build Projection-Backed Reporting Aggregate Pipeline (`cng-z7u.1`)

- [x] Replace request-time monthly aggregate rebuilds with an explicit projection pipeline for active/default reporting ranges
- [x] Record freshness, invalidation, and rule-version ownership in projection state
- [x] Add targeted projection refresh/stale-detection regression coverage
- **Status:** complete

### Phase B: Move Reporting Schedules To A Typed Projection-Backed Store (`cng-z7u.2`)

- [x] Retire `kpi_report_schedule_v1` as the primary schedule source of truth
- [x] Persist schedule state through a typed reporting store/service boundary
- [x] Keep schedule API and persistence regression coverage green
- **Dependencies:** satisfied by `cng-z7u.1`
- **Status:** complete

### Phase C: Converge Dashboard And Export On Projection-First Reporting Read Models (`cng-z7u.3`)

- [x] Make `/api/v4/reporting/view` and compact export resolve through the same projection-first read-model path
- [x] Retire or thin compatibility `summary|staff|teams` adapters to that same contract
- [x] Keep dashboard/export regression coverage green without browser-side request fan-out
- **Dependencies:** unblocked (`cng-z7u.1`, `cng-z7u.2` complete)
- **Status:** complete

### Phase D: Finish ReportViewer Convergence And Split Residual Reporting UI Logic (`cng-z7u.4`)

- [x] Remove remaining `ReportViewer` request/state orchestration
- [x] Split the remaining staff/team section composition out of `ReportViewer`
- [x] Split the reporting UI into smaller modules around the unified client contract
- [x] Keep `ReportViewer` and `reportingClient` tests green
- Completed slice: `src/components/reporting/StaffDetailCard.jsx`, `src/components/reporting/TeamDetailCard.jsx`, and `src/components/reporting/reportingDetailUtils.js` now own the detail-card/detail-page-size seam, with focused coverage in `tests/reportingDetailCards.test.jsx`.
- Completed slice: `src/components/reporting/useReportViewerReadModel.js` now owns report fetch/baseline comparison, schedule subscription/fetch, and reload/version handling, with focused coverage in `tests/useReportViewerReadModel.test.jsx`.
- Completed slice: `src/components/reporting/ReportingStaffSection.jsx` and `src/components/reporting/ReportingTeamSection.jsx` now own the remaining staff/team section composition seam, with focused coverage in `tests/reportingScopeSections.test.jsx`.
- Completed follow-up slice: `src/components/reporting/ReportingAdjustmentsPanel.jsx` now owns the remaining adjustments/applied-points seam, with focused coverage in `tests/reportingAdjustmentsPanel.test.jsx`.
- Completed follow-up slice: `src/components/reporting/ReportingScopeExplorerPanel.jsx` now owns the scope explorer card and staff/team branch handoff, with focused coverage in `tests/reportingScopeExplorerPanel.test.jsx`.
- Completed slice: `ReportViewer.jsx` is down to `1405` lines from `2585`; the remaining reporting residue is now concentrated in the inline dashboard overview composition immediately before `ReportingScopeExplorerPanel`.
- **Dependencies:** unblocked (`cng-z7u.3` complete)
- **Status:** complete

### Phase E: Continue DataImporter Decomposition Toward Maintainable Module Boundaries (`cng-z7u.5`)

- [x] Extract another meaningful importer behavior/presentation seam out of `DataImporter.jsx`
- [x] Add/update focused tests for the extracted seam
- [x] Move touched importer modules closer to the sub-`800`-line target where feasible
- **Dependencies:** none
- Completed slice: `src/components/DataImporter.jsx` now delegates to `src/components/dataImporter/useDataImporterContainerProps.js`, so the parent is only a thin shell wrapper instead of carrying the whole importer orchestration layer inline.
- Completed slice: `tests/useDataImporterContainerProps.test.jsx` now locks the session/duplicate/results/prop-builder orchestration contract directly, and the extracted hook sits at `748` lines while `DataImporter.jsx` is down to `7`.
- **Status:** complete

### Phase F: Silence Reporting Chart Warning Noise And Harden The Jsdom Harness (`cng-z7u.6`)

- [x] Remove or isolate the known `Recharts` width/height-zero warning flood
- [x] Keep reporting behavior assertions as strong as they are today
- [x] Make targeted reporting test output materially cleaner
- **Dependencies:** unblocked (`cng-z7u.4` complete)
- Completed slice: `vitest.setup.js` now provides an explicit jsdom `ResponsiveContainer` harness for `recharts`, so `ReportViewer` and reporting widget tests no longer emit the known zero-size chart flood.
- Completed slice: `tests/reportingOverviewWidgets.test.jsx` now exercises populated chart branches and asserts the old width/height-zero warning pattern does not reappear, so the harness cleanup is locked by direct regression coverage instead of only by cleaner stdout/stderr.
- **Status:** complete

## Fresh Follow-Up Slice (`cng-f2z`)

### Phase G: Extract ReportViewer Adjustments Panel Into A Dedicated Reporting Module (`cng-f2z`)

- [x] Move the inline KPI adjustments/applied-points panel out of `src/components/ReportViewer.jsx`
- [x] Keep adjustment page-size persistence in the parent while moving panel-specific paging/derivation/render logic into the new module
- [x] Add focused regression coverage for applied/pending/rejected adjustment rendering and pagination behavior
- **Dependencies:** follows the closed `cng-z7u.4` `ReportViewer` breakup work
- Verification:
  - `pnpm exec vitest run tests/reportingAdjustmentsPanel.test.jsx tests/reportViewer.test.jsx tests/reportingOverviewWidgets.test.jsx tests/reportingDetailCards.test.jsx tests/useReportViewerReadModel.test.jsx --environment jsdom` -> passed
  - `pnpm exec eslint src/components/ReportViewer.jsx src/components/reporting/ReportingAdjustmentsPanel.jsx tests/reportingAdjustmentsPanel.test.jsx tests/reportViewer.test.jsx` -> passed
- **Status:** complete

## Fresh Follow-Up Slice (`cng-vlt`)

### Phase H: Extract ReportViewer Scope Explorer Card Into A Dedicated Reporting Module (`cng-vlt`)

- [x] Move the inline scope selector / column-visibility / branch-handoff card out of `src/components/ReportViewer.jsx`
- [x] Keep parent-owned filter/export/detail state intact while moving the presentation shell into the new reporting module
- [x] Add focused regression coverage for scope switching, selector forwarding, and column-toggle wiring
- **Dependencies:** follows the closed `cng-f2z` adjustments-panel extraction
- Verification:
  - `pnpm exec vitest run tests/reportingScopeExplorerPanel.test.jsx tests/reportingScopeSections.test.jsx tests/reportingAdjustmentsPanel.test.jsx tests/reportViewer.test.jsx tests/reportingOverviewWidgets.test.jsx tests/reportingDetailCards.test.jsx tests/useReportViewerReadModel.test.jsx --environment jsdom` -> passed (`21/21`)
  - `pnpm exec eslint src/components/ReportViewer.jsx src/components/reporting/ReportingScopeExplorerPanel.jsx tests/reportingScopeExplorerPanel.test.jsx tests/reportingScopeSections.test.jsx tests/reportingAdjustmentsPanel.test.jsx tests/reportViewer.test.jsx` -> passed
- `git diff --check -- src/components/ReportViewer.jsx src/components/reporting/ReportingScopeExplorerPanel.jsx tests/reportingScopeExplorerPanel.test.jsx task.md task_plan.md findings.md progress.md` -> passed
- **Status:** complete

## Fresh Follow-Up Slice (`cng-tuw`)

### Phase I: Extract ReportViewer Dashboard Overview Composition (`cng-tuw`)

- [x] Move the inline dashboard overview block out of `src/components/ReportViewer.jsx`
- [x] Keep parent-owned state for top-staff metric/count and adjustments paging/page-size sanitization
- [x] Add focused regression coverage for the extracted dashboard composition seam
- **Dependencies:** follows the closed `cng-vlt` scope-explorer extraction
- Completed slice:
  - `src/components/reporting/ReportingDashboardOverview.jsx` now owns the overview composition seam between the schedule shell and `ReportingScopeExplorerPanel`.
  - `tests/reportingDashboardOverview.test.jsx` now locks summary rendering plus top-staff/adjusments callback forwarding on the extracted seam.
  - `ReportViewer.jsx` is down to `958` lines from `1405`, leaving the preference/action controller layer as the next clean residual seam.
- Verification:
  - `pnpm exec vitest run tests/reportingDashboardOverview.test.jsx tests/reportingOverviewWidgets.test.jsx tests/reportingAdjustmentsPanel.test.jsx tests/reportViewer.test.jsx --environment jsdom` -> passed (`10/10`)
  - `pnpm exec eslint src/components/ReportViewer.jsx src/components/reporting/ReportingDashboardOverview.jsx tests/reportingDashboardOverview.test.jsx tests/reportingOverviewWidgets.test.jsx tests/reportingAdjustmentsPanel.test.jsx tests/reportViewer.test.jsx` -> passed
  - `git diff --check -- src/components/ReportViewer.jsx src/components/reporting/ReportingDashboardOverview.jsx tests/reportingDashboardOverview.test.jsx task.md task_plan.md findings.md progress.md` -> passed
- **Status:** complete

## Fresh Follow-Up Slice (`cng-2ch`)

### Phase J: Extract ReportViewer Preference And Action Controller Seams (`cng-2ch`)

- [x] Move the remaining report-viewer preference/localStorage/controller helpers out of `src/components/ReportViewer.jsx`
- [x] Move schedule/export controller actions behind a dedicated reporting hook without changing behavior
- [x] Add focused regression coverage and bring `ReportViewer.jsx` below the project soft `800`-line target
- **Dependencies:** follows the closed `cng-tuw` dashboard-overview extraction
- Completed slice:
  - `src/components/reporting/useReportViewerPreferences.js` now owns report-viewer localStorage persistence, sanitize helpers, quick-range/filter initialization, column visibility, detail page sizes, and adjustment page-size sanitization.
  - `src/components/reporting/useReportViewerActions.js` now owns schedule draft/edit/reset/toggle/save/delete behavior plus export permission validation and dispatch.
  - `ReportViewer.jsx` is down to `735` lines from `958`, so the parent is below the soft cap and no longer owns the preference/action controller layer inline.
- Verification:
  - `pnpm exec vitest run tests/useReportViewerPreferences.test.jsx tests/useReportViewerActions.test.jsx tests/reportViewer.test.jsx --environment jsdom` -> passed (`9/9`)
  - `pnpm exec eslint src/components/ReportViewer.jsx src/components/reporting/useReportViewerPreferences.js src/components/reporting/useReportViewerActions.js tests/useReportViewerPreferences.test.jsx tests/useReportViewerActions.test.jsx tests/reportViewer.test.jsx` -> passed
- **Status:** complete

## Archived Immediate Follow-Through

### Smoke Gate Regression Follow-Up Complete (`cng-q7u`)

- [x] Reproduce the new `verify:smoke:core` failure and isolate it to one ownership contract
- [x] Fix pool disposal behavior without breaking shared runtime pool ownership
- [x] Re-run the affected unit tests and the full smoke gate
- Root cause: `createPostgresReportingProjectionPersistence()` defaulted `managePool` to `!options.pool`, so any injected pool was treated as caller-owned unless the caller opted back in explicitly.
- Landed fix: default `managePool` to `true`, keep `runtimePersistence` explicit with `managePool: false`, and add regression coverage for both default disposal and explicit opt-out.
- Verification:
  - `pnpm exec vitest run tests/server-v4/reportingProjectionPostgres.test.js tests/server-v4/runtimePersistence.test.js --environment node` -> passed (`9/9`)
  - `pnpm verify:smoke:core` -> passed

## Previous Diagnostic Slice (`cng-cff`)

- [x] Re-run the broad backend diagnostic bundle and group the active failures into coherent clusters
- [x] Fix at least one cluster end-to-end and confirm the bundle failure count drops
- [x] Update `task.md`, `task_plan.md`, `findings.md`, and `progress.md` with the new active slice and verification evidence
- Outcome: the active diagnostic path moved `14 -> 6 -> 1 -> 0` across the broad backend bundle while keeping the rest of the repo worktree untouched.
- Root cause: `resolveReportingRule()` treated only rule sets with `groups` as valid, so legacy/simple snapshots with `license` but no `groups` were discarded and silently replaced by `SHARED_DEFAULT_RULES`.
- Landed fix: widen rule-set detection in `server/reportingRuleSelection.js` to accept snapshots with `license` or `bonuses`, then lock that contract with `tests/reportingRuleSelection.test.js`.
- Supporting cleanup: `tests/server.api.test.js` now uses canonical ASCII roster/ECUS fixtures and the typed `/api/storage/decl_rows_v1` write path instead of stale raw `kv_store` shortcuts.
- Verification:
  - `pnpm exec vitest run tests/reportingRuleSelection.test.js tests/server.api.test.js --environment node` -> passed (`127/127`)
  - `pnpm exec vitest run tests/server.seed.test.js tests/server.api.test.js tests/reportingRuleSelection.test.js --environment node` -> passed (`129/129`)

## Follow-Through Phases (`cng-i6h`)

### Phase A: Remove Hardcoded Default Credentials (`cng-i6h.1`)

- [x] Remove plaintext password literals from backend bootstrap/default seed logic
- [x] Replace public credential docs and checked-in runtime snapshot data with explicit bootstrap-secret guidance
- [x] Keep auth/bootstrap tests deterministic through explicit env-based test helpers
- [x] Require an explicit admin bootstrap secret when the DB is empty or missing an admin account
- [x] Keep targeted bootstrap verification green after the contract change
- In-progress slice: `server/bootstrapAccountPasswords.js` now owns the env-key contract, `server/index.js` only bootstraps accounts from env-backed passwords, checked-in docs/data no longer advertise credentials, and auth/bootstrap tests install deterministic env secrets instead of relying on shipped defaults.
- **Status:** completed

### Phase B: Retire Remaining Compatibility Fallbacks (`cng-i6h.2`)

- [x] Inventory monolith, `server-v4`, package, and shared fallback paths that still exist only for transitional compatibility
- [x] Retire or narrow the lowest-risk fallback seam first without breaking current API/runtime contracts
- [x] Keep fallback retirement isolated from unrelated redesign work
- Completed slice: removed the monolith ECUS SQL/credential shim files, switched `server/index.js` runtime imports from `src/shared/*` to `packages/domain/src/*` for core shared contracts, retired the thin `src/lib/reportingClient.js` shim, and moved the last direct reporting client consumers to `packages/api-client/src/reportingClient.js`.
- Completed slice: retired the remaining low-risk `src/shared/*` wrappers (`accountRoles`, `backupMessages`, `defaultRules`, `sampleDeclarations`, `co`, `declSearch`, `format`) after moving live consumers to `packages/domain/src/*`; targeted importer/session/reporting coverage stayed green and the old package-compatibility wrapper layer under `src/shared` is gone.
- Completed slice: `server-v4/src/legacy/legacy-business-snapshot-reader.ts` now treats declarations, MST assignments, teams, KPI rules, adjustments, reporting schedules, and monthly aggregate/default aggregate snapshots as typed-runtime reads only; monolith/test seed helpers materialize `reporting_projections` directly, closing the last runtime fallback seam in this phase.
- **Status:** completed

### Phase C: Stabilize Broad Verification Gates (`cng-i6h.3`)

- [x] Inventory the broad suites and smoke flows that still fail or remain too flaky to gate merges
- [x] Split true regressions from pre-existing noise and record trustworthy closure criteria
- [x] Promote at least one broader verification path from ad hoc evidence to stable gate
- Completed slice: inventoried the broad `tests/server.seed.test.js + tests/server.api.test.js` bundle and recorded it as diagnostic rather than a merge gate because the remaining `14` failures span mixed stale assertions and broader behavioral drift.
- Completed slice: promoted a stable repo smoke gate via `test:smoke:backend-core`, `test:smoke:frontend-core`, `test:smoke:core`, and `verify:smoke:core`, then wired CI to run that smoke path instead of `pnpm test -- --runInBand`.
- Completed slice: added `server/reportingProjectionStore.d.ts` so `verify:server-v4` remains a reusable component inside the smoke gate instead of failing on the shared JS seam import.
- **Status:** completed

### Phase D: Advance Canonical Apps-Api And Postgres Cutover (`cng-i6h.4`)

- [x] Inventory what still keeps `server/index.js` and SQLite sidecars as the canonical runtime
- [x] Pick the next small cut that moves ownership toward `apps/api` and PostgreSQL-backed persistence
- [x] Keep migration risk explicit with dual-read/dual-write or fallback guardrails where needed
- In-progress slice: `apps/api` and `server-v4` now expose an explicit persistence-mode seam for the reporting write surface. `apps/api` owns persistence-mode + Postgres URL config, `server-v4` builds runtime persistence through an adapter boundary instead of hardwiring reporting projection access inside `ReportingRepository`, and `postgres` mode now fails fast until a real adapter lands.
- In-progress slice: the next ownership cut is now also landed inside the monolith. `server/reportingAggregateRuntime.js` owns reporting aggregate/observability/runtime orchestration, while `server/index.js` keeps route/auth/audit wrappers but delegates materialization, freshness, and source-triggered refresh through that seam. The next Phase D cut should move remaining schedule mutation/storage lifecycle ownership rather than reopening these read-side helpers inline.
- In-progress slice: that schedule residual is now narrowed too. `server/reportingScheduleRuntime.js` owns schedule listing, default-aggregate readiness, save, and delete behavior, while `server/index.js` still only wraps auth/audit/HTTP response shaping. The next Phase D cut should move broader storage lifecycle or a real Postgres adapter seam, not rebuild reporting route internals inline again.
- In-progress slice: the broader `kv_store` lifecycle seam is now also landed. `server/runtimeStorageLifecycle.js` owns storage write/delete fan-out, bootstrap snapshot assembly, and relational/projection hydration for startup plus test resets, while `server/index.js` keeps API wrappers and higher-level route-specific side effects. The next Phase D cut should either move the generic storage route wrappers themselves or add the first real Postgres-backed adapter beyond these SQLite compatibility seams.
- In-progress slice: the next chosen follow-on is the generic storage route runtime, not the first `pg` adapter yet. The safe ownership win is to move `/api/storage` mutation behavior plus per-key side effects (`decl_rows_v1`, `ecus_sync_config_v1`, `co_tax_code_config_v1`, `co_discrepancy_config_v1`) behind a small runtime seam while `server/index.js` keeps permission checks, protected-key guards, and HTTP response shaping.
- In-progress slice: that storage-route runtime seam is now landed too. `server/storageRouteRuntime.js` owns PUT/PATCH/DELETE mutation orchestration plus the remaining per-key follow-up actions, while `server/index.js` still keeps `verifyStoragePermission()`, blocked-key guards (`kpi_users_v1`, reporting schedules), and route registration/HTTP error shaping. The next Phase D cut should either pull the rest of the `/api/storage` controller boundary out of `server/index.js` or start the first real async Postgres reporting-projection adapter in `server-v4`/`apps/api`.
- In-progress slice: the first real async Postgres reporting-projection adapter is now landed. `server-v4/src/persistence/reportingProjectionPostgres.ts` persists `reporting_projections` through `pg`, `server-v4/src/persistence/runtimePersistence.ts` no longer hard-throws in `postgres` mode, reporting projection reads/writes are async from persistence through `ReportingRepository` and `reportingService`, and `buildV4App` plus `apps/api/src/startApiServer.js` now thread a runtime `dispose()` hook through shutdown so pool-backed persistence does not leak. This slice intentionally keeps reporting observability detail reads derived from stored JSON payloads rather than introducing a full Postgres materialization schema yet.
- In-progress slice: the next Phase D cut should now either finish pulling the remaining `/api/storage` controller boundary (`verifyStoragePermission`, blocked-key policy, route registration) out of `server/index.js`, or extend Postgres ownership past reporting projections into broader business snapshot/write paths.
- In-progress slice: the first true Postgres-backed business read path is now landed, but only for the smallest isolated route family. `server-v4/src/modules/mst-assignments/mstAssignmentAsyncReader.ts` plus `postgresMstAssignmentAsyncReader.ts` let `runtimePersistence` share the `pg` pool and route `readMstAssignmentRows()` through Postgres while keeping the sync `BusinessSnapshotReader` contract intact for every other module.
- In-progress slice: `buildV4App()` now treats `mst-assignments` as an explicit async route seam instead of forcing it through the sync router-factory map. The next safe Phase D cut should widen the same pattern to another isolated business domain or complete the remaining `/api/storage` route-registration extraction, not reintroduce generic sync assumptions into the canonical runtime.
- In-progress slice: `kpi-adjustments` is now the fifth async business-read seam on the Postgres cutover path. `server-v4/src/modules/kpi-adjustments/adjustmentAsyncReader.ts` plus `postgresAdjustmentAsyncReader.ts` let `runtimePersistence` share the same `pg` pool for typed adjustment snapshot reads, and `buildReportingRouter()` now passes that seam into `ReportingRepository` so reporting no longer depends on the sync `readAdjustmentRows()` compatibility path.
- In-progress slice: reporting input transport is now consistently async across declarations, rules, adjustments, and teams. The next safe Phase D cut should widen Postgres ownership beyond reporting input snapshot readers into broader business tables/write paths, or finish the remaining low-value `/api/storage` route-registration cleanup, rather than reopening sync reporting dependencies again.
- In-progress slice: `server-v4` `postgres` mode now reduces internal SQLite compatibility further instead of only hiding it from app composition. `server-v4/src/persistence/noopBusinessSnapshotReader.ts` replaces the internal `SqliteBusinessSnapshotReader` in relational-store mode, Postgres async readers now report `sourceKind='relational-store'`, and `server-v4/src/app/v4-rollout-status.ts` no longer blocks readiness on a missing legacy DB file when that file is not actually required. The next meaningful Phase D cut is broader relational business-write ownership or more canonical Postgres readers, not reintroducing hidden SQLite dependencies for rollout metadata.
- In-progress slice: `server-v4` now mounts `kpi-adjustments` as a real business read route instead of using that Postgres seam only inside reporting. `server-v4/src/modules/kpi-adjustments/kpiAdjustmentsRoutes.ts` exposes filtered adjustment reads at `/api/v4/kpi-adjustments`, `buildV4App()` now marks the module as implemented, and default rollout coverage rises from 5 to 6 mounted modules. The next meaningful Phase D cut is another standalone business module or a real write-path/canonical settings surface, not stopping at reporting-only consumption of async readers.
- In-progress slice: rollout accounting is now truthfully tied to the mounted runtime surface instead of the broader module catalog declarations. `server-v4/src/app/runtimeRouteCoverage.ts` overrides catalog route totals inside `server-v4/src/app/v4-rollout-status.ts`, so read-only slices no longer inflate mutation/write coverage before those routes actually exist. The next meaningful Phase D cut is another real module surface such as `hq-agencies`, not more optimistic metadata.
- In-progress slice: `hq-agencies` is now mounted as the next real Phase D business-read surface. `server-v4/src/modules/hq-agencies/*` adds an async reader seam, a Postgres adapter over `tax_code_agency_bindings` plus `tax_code_agency_binding_events`, and read-only routes for bindings/history, while `runtimePersistence` keeps SQLite `kv_store` fallback only as compatibility transport. With that slice landed, only `auth` remains scaffolded; the next meaningful Phase D cut is auth ownership or a deliberate write-path migration, not more read-only coverage bookkeeping.
- In-progress slice: `kpi-adjustments` now also owns a real session-backed write/settings surface in `server-v4`. `server-v4/src/modules/kpi-adjustments/*` now serves `GET/PUT /settings`, `POST /`, and `PATCH /:adjustmentId` through `persistence.adjustmentsStore` plus cookie-session auth resolution, with SQLite and Postgres stores backing canonical adjustment/settings mutations instead of leaving that ownership in the monolith/store layer. The next meaningful Phase D cut is another business write-path handoff beyond `reporting`, `auth`, and `kpi-adjustments`, not the low-value `/api/storage` route-registration residue.
- In-progress slice: `kpi-rules` now also owns a real session-backed write/settings surface in `server-v4`. `server-v4/src/modules/kpi-rules/*` now serves draft creation and activation through `persistence.kpiRulesStore` plus cookie-session auth resolution, with SQLite and Postgres stores backing canonical rule-set mutations instead of leaving activation/draft ownership outside the typed runtime. The next meaningful Phase D cut is another business write/settings handoff beyond `reporting`, `auth`, `kpi-adjustments`, and `kpi-rules`, not the low-value `/api/storage` route-registration residue.
- In-progress slice: `hq-agencies` now also owns a real session-backed write/history surface in `server-v4`. `server-v4/src/modules/hq-agencies/*` now serves binding upsert/delete through `persistence.hqAgenciesStore` plus cookie-session auth resolution, with SQLite and Postgres stores persisting both canonical bindings and normalized history events instead of leaving those mutations in the monolith/store layer. The next meaningful Phase D cut is another broader business write/settings handoff beyond `reporting`, `auth`, `kpi-adjustments`, `kpi-rules`, and `hq-agencies`; `declarations` is now the strongest next candidate, while `/api/storage` route registration remains low-value residue.
- Completed slice: `declarations` now also owns a real session-backed mutation and event-history surface in `server-v4`. `server-v4/src/modules/declarations/*` now serves `PATCH /api/v4/declarations/:declarationId` and `GET /api/v4/declarations/:declarationId/events` through `persistence.declarationsStore` plus cookie-session `importEdit`/`accountManage` enforcement, while preserving reviewed-declaration admin override behavior through the typed runtime boundary.
- Completed slice: default rollout truth now settles at `8/8` implemented modules, `0` scaffold modules, `2` read-only modules, `6` read-write modules, `30` implemented routes, `14` implemented mutation routes, `readiness=ready`, and `currentStage=cutover-ready`. `cng-i6h.4` is closed, and the remaining SQLite/Postgres ownership residue is split into follow-up `cng-i6h.5`.
- **Status:** completed

### Phase E: Retire Residual SQLite Compatibility And Deepen Canonical Postgres Ownership (`cng-i6h.5`)

- [x] Inventory the remaining SQLite compatibility ownership after the declarations write slice and rank the next cut by leverage and migration risk
- [x] Move at least one remaining canonical business path further toward relational-store ownership with explicit runtime seams and rollback/fallback guardrails
- [x] Keep notebook/bead state and targeted verification green for the chosen slice
- [x] Choose the next residual compatibility seam after the `hq-agencies` rollback-flag slice and apply the same Postgres-first retirement pattern
- In-progress slice: `cng-i6h.5` starts from the new declarations write/events boundary, not from route-parity work. The next meaningful leverage is broader Postgres-first business ownership and retirement of leftover SQLite compatibility seams that still shadow canonical runtime behavior.
- Completed slice: `hq-agencies` was the strongest remaining hidden SQLite compatibility seam after the declarations handoff because `runtimePersistence` still instantiated `SqliteHqAgenciesAsyncReader` in `postgres` mode even while the runtime advertised `sourceKind='relational-store'`.
- Completed slice: `apps/api/src/apiRuntimeConfig.js` and `apps/api/src/startApiServer.js` now expose `postgresLegacySqliteFallback`, `server-v4/src/modules/hq-agencies/noopHqAgenciesAsyncReader.ts` keeps the default fallback surface relational/no-op, and `server-v4/src/persistence/runtimePersistence.ts` only constructs the SQLite `hq-agencies` reader when that rollback flag is explicitly enabled.
- Completed slice: targeted verification for this guardrail cut is green: `pnpm exec vitest run ... --environment node` (`22/22`), scoped `pnpm exec eslint ...`, `pnpm run build:server-v4`, and scoped `git diff --check`.
- Completed slice: the next hidden compatibility seam after `hq-agencies` was config/runtime truth, not another route family. `apps/api/src/apiRuntimeConfig.js`, `server-v4/src/config/server-v4-config.ts`, and `server-v4/src/persistence/runtimePersistence.ts` now let `postgres` mode carry `dbFile: null` by default, only require `KPI_API_DB_FILE` for `sqlite-dual-write` or explicit rollback, and keep `server-v4/src/app/v4-rollout-status.ts` honest by reporting the legacy DB file as `not-required` on the relational-store path.
- Completed slice: targeted verification for the `dbFile: null` cut is green: `pnpm exec vitest run tests/appsApiRuntimeConfig.test.js tests/appsApiStart.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js tests/server-v4/noopHqAgenciesAsyncReader.test.js tests/server-v4/postgresHqAgenciesAsyncReader.test.js --environment node` (`25/25`), scoped `pnpm exec eslint ...`, and `pnpm run build:server-v4`.
- Completed slice: inventory after the `dbFile: null` cut confirmed the residual compatibility no longer sits in `runtimePersistence`; it sits inside specific Postgres readers. `mst-assignments` and `kpi-rules` already stop at canonical rows plus the final compatibility reader, while `declarations` and `adjustments` were still chaining through snapshot-row payload tables. `teams` remains the deeper seam because its primary Postgres read path still depends on snapshot-materialized roster tables.
- Completed slice: `server-v4/src/modules/declarations/postgresDeclarationAsyncReader.ts` and `server-v4/src/modules/kpi-adjustments/postgresAdjustmentAsyncReader.ts` now remove the intermediate `declaration_snapshot_rows` / `adjustment_snapshot_rows` fallback queries. Both readers now prefer canonical relational rows and fall directly to the compatibility reader only when canonical rows are absent.
- Completed slice: targeted verification for the declarations/adjustments fallback-retirement cut is green: `pnpm exec vitest run tests/server-v4/postgresDeclarationAsyncReader.test.js tests/server-v4/postgresAdjustmentAsyncReader.test.js tests/server-v4/runtimePersistence.test.js --environment node` (`11/11`), scoped `pnpm exec eslint ...`, and `pnpm run build:server-v4`.
- Completed slice: `server-v4/src/modules/teams/postgresTeamRosterAsyncReader.ts` no longer requires `team_roster_state` just to unlock the canonical Postgres roster path. The reader now uses `teams` + `team_members` as the primary source of truth, returns a canonical empty roster in `relational-store` mode when those tables are empty, and only falls back to compatibility data in `dual-write` mode or on query failure.
- Completed slice: targeted verification for the `teams` state-table retirement cut is green: `pnpm exec vitest run tests/server-v4/postgresTeamRosterAsyncReader.test.js tests/server-v4/runtimePersistence.test.js --environment node` (`9/9`), scoped `pnpm exec eslint ...`, and `pnpm run build:server-v4`.
- Completed slice: `server-v4/src/modules/teams/teamRosterDocument.ts`, `teamsStore.ts`, `sqliteTeamsStore.ts`, and `postgresTeamsStore.ts` now give the roster path an explicit runtime-owned write seam instead of leaving teams mutations implicit in legacy storage helpers. `PUT /api/v4/teams` is mounted through `teamsRoutes`, `teamsService` enforces `teamsEdit`/`accountManage`, and `runtimePersistence` now injects a real `teamsStore` for both SQLite dual-write and Postgres mode.
- Completed slice: `server-v4/src/types/better-sqlite3.d.ts` now declares `transaction()`, matching the runtime API the new SQLite teams store already uses. That keeps the local SQLite adapter seam type-safe instead of letting the build silently drift behind runtime behavior.
- Completed slice: default rollout truth now settles at `8/8` implemented modules, `0` scaffold modules, `1` read-only modules, `7` read-write modules, `31` implemented routes, `15` implemented mutation routes, `readiness=ready`, and `currentStage=cutover-ready`.
- Completed slice: targeted verification for the teams write/ownership cut is green: `pnpm exec vitest run tests/server-v4/postgresTeamsRoute.test.js tests/server-v4/sqliteTeamsStore.test.js tests/server-v4/runtimePersistence.test.js tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js --environment node` (`16/16`), scoped `pnpm exec eslint ...`, `pnpm run build:server-v4`, and scoped `git diff --check`.
- Completed slice: `server-v4/src/modules/declarations/declarationCoMonitoring.ts`, `declarationsCoMonitoringService.ts`, the declarations stores, and `DeclarationsController` now own the C/O monitoring config/state contract through the typed runtime boundary instead of leaving it only on the legacy storage path. `server-v4` now serves `GET/PUT /api/v4/declarations/imports/co-codes`, `GET /api/v4/declarations/imports/co-discrepancy`, and `PUT /api/v4/declarations/imports/co-discrepancy/config`, while `server-v4/src/app/legacyCompatRoutes.ts` exposes matching legacy aliases at `/api/import/co-codes` and `/api/import/co-discrepancy*`.
- Completed slice: declarations import parity now also covers `POST /api/v4/declarations/imports/co-discrepancy/run` plus the legacy alias `POST /api/import/co-discrepancy/run`. `server-v4/src/modules/declarations/ecusCoDiscrepancyRunner.ts` now owns a reusable/injectable ECUS fetch seam, and `DeclarationsCoMonitoringService` owns the compare/state persistence path instead of leaving it in the monolith-only `runCoDiscrepancyCheck()` flow.
- Completed hardening: the default discrepancy runner now initializes lazily, so unrelated `server-v4` app builds and tests that do not inject a declarations reader no longer fail during `buildLegacyCompatRouter(...)` construction.
- Verification: `pnpm vitest run tests/server-v4/postgresDeclarationsRoute.test.js --environment node` passed (`11/11`), and `pnpm run verify:server-v4` passed (`28` files, `105` tests; includes lint + typecheck + full `tests/server-v4`).
- Residual after this slice: the previously-open `co-discrepancy/run` parity gap is closed; the next declarations/import follow-up should be chosen from the remaining legacy `/api/import/*` surface instead of assumed in advance.
- **Status:** completed

## Archived Hardening Phases (`cng-4or`)

### Phase A: Server-v4 ESLint And CI Hardening (`cng-4or.1`)

- [x] Add TypeScript ESLint parser/plugin support at the workspace root
- [x] Lint a real `server-v4` TypeScript slice from the root flat config
- [x] Add a repeatable `pnpm run lint:server-v4` command
- [x] Keep targeted lint/typecheck verification green for the hardened scope
- Completed slice: the root flat config now covers `server-v4` app/bootstrap/http/legacy/persistence/reporting files through `@typescript-eslint`, `eslint.config.js` has a file-specific linebreak override to avoid Windows-only config noise, and `pnpm run lint:server-v4` plus `pnpm run typecheck:server-v4` are trusted gates for this first hardening seam.
- **Status:** completed

### Phase B: Broaden Server-v4 ESLint Coverage (`cng-4or.2`)

- [x] Extend the lint boundary to the remaining `server-v4` domain modules
- [x] Decide scope-specific rule posture for any newly surfaced warning/error buckets
- [x] Keep the expanded scope green without reintroducing monolith-wide warning debt
- Completed slice: `eslint.config.js` now targets all `server-v4/src/**/*.ts` (excluding declaration sidecars), the expanded scope stays green under `pnpm run lint:server-v4`, and the rule posture remains intentionally narrow (`linebreak-style` off, `no-undef` off, `@typescript-eslint/no-unused-vars` warn-only) instead of reopening monolith-wide warning debt.
- **Status:** completed

### Phase C: Wire Hardening Gates Into CI (`cng-4or.3`)

- [x] Add repeatable CI / pre-merge execution for the new `server-v4` lint gate
- [x] Pair lint coverage with the right typecheck / targeted test gates
- [x] Document the gate in the notebook and repo scripts/workflows
- Completed slice: `package.json` now exposes `verify:server-v4`, `test:server-v4` uses the Windows-safe `vitest run tests/server-v4 --environment node` invocation, the stale missing-doc entry was removed from `format:*`, and `.github/workflows/frontend-ci.yml` now runs server-v4 lint, typecheck, and targeted tests as part of the existing CI path.
- **Status:** completed

## Archived Full-Cutover Phases (`cng-3or`)

### Phase A: PostgreSQL Runtime Persistence And Dual-Write Cutover (`cng-3or.1`)

- [x] Inventory remaining hot-path `kv_store` and blob-backed runtime reads/writes
- [x] Introduce a typed `server-v4` business snapshot seam so future adapter swaps do not require per-repository `readJsonValue('...')` rewiring
- [x] Pick the first low-risk relational-backed domain cutover behind current APIs
- [x] Define dual-write/backfill and rollback guardrails for that seam
- [x] Add parity tests around the first cutover slice
- [x] Extend the typed runtime seam across declarations, MST assignments, KPI rules, and KPI adjustments
- [x] Keep report schedules/default aggregates on the relational projection path and block generic storage mutations there
- [x] Add regression coverage for storage delete-path cleanup and declaration typed-read idempotence
- Completed slice: all six original hot-path keys now sit behind typed relational runtime seams or reporting projections, with monolith backfill/dual-write/reset behavior and `server-v4` typed-read preference verified.
- **Status:** completed

### Phase B: Delivery-Shape Split Into Apps And Shared Packages (`cng-3or.3`)

- [x] Define the first safe extraction from the mixed root layout into target app/package boundaries
- [x] Move shared contracts/utilities without breaking current entrypoints
- [x] Keep module size and test coverage constraints intact during the split
- Completed slice: the repo now has a real `pnpm` workspace shell (`apps/*`, `packages/*`), package-owned implementation for shared domain helpers/reporting math, the reporting API client, and shell/data-table UI primitives, while existing entrypoints stay stable through compatibility shims.
- **Status:** completed

### Phase C: Standalone Windows ECUS Bridge Service (`cng-3or.2`)

- [x] Land the first standalone bridge runtime primitives (`apps/ecus-bridge` API client/runtime plus a core ECUS mutation seam)
- [x] Wire token-protected core API contracts for ECUS config/preview/commit through the extracted bridge mutation seam
- [x] Add a standalone bridge host controller with health/status/busy contracts around the extracted runtime
- [x] Add package-local HTTP server and composition bootstrap around the standalone bridge host
- [x] Promote the extracted ECUS seam into a true service/worker boundary
- [x] Isolate DPAPI credentials and SQL Server connectivity away from the core API
- [x] Define durable batching/retry/health contracts between bridge and API
- **Status:** completed

### Phase D: Operator Shell End-State And Heavy-Workflow Redesign (`cng-3or.4`)

- [x] Finish the domain sidebar/top bar shell target
- [x] Move MST/import/report/report-center flows toward the final guided/operator workflow
- [x] Keep accessibility and regression coverage aligned while reshaping the shell
- Completed slice: `src/lib/appShellNavigation.js` now exposes grouped domain navigation sections, and `src/components/appShell/AppShellFrame.jsx` gives `KPICalculator` a real sidebar plus workflow summary shell while preserving the existing tab content/render contracts for a low-risk first Phase D step.
- Completed slice: `src/components/appShell/appShellWorkflowState.js` and `src/components/appShell/AppShellWorkflowGuide.jsx` now define a shell-level workflow contract, `src/components/workflows/MSTWorkflowPanel.jsx`, `src/components/workflows/KPIAdjustmentsWorkflowPanel.jsx`, and `src/components/workflows/ReportCenterPanel.jsx` separate the operator-heavy surfaces into explicit stage wrappers, and `src/components/CommandCenter.jsx` can now be opened as a first-class primitive through the command bus.
- Completed slice: `src/App.jsx` now preserves `{ tab, focus }` navigation intent from shell/Command Center actions, while `src/components/KPICalculator.jsx` resolves that intent to stable workflow anchors so reports/export, MST queue review, and KPI adjustment stages no longer rely on operators remembering the right tab/body manually.
- **Status:** completed

### Phase E: Reporting Analytics And Observability End-State (`cng-3or.5`)

- [x] Expand precomputed relational KPI/reporting stats beyond the initial projection tables
- [x] Broaden server-side search/pagination and freshness metrics
- [x] Add durable reporting/job observability for the end-state runtime
- **Status:** completed

## Archived Program Phases (`cng-7c8`)

### Phase 0A: Security Boundary Hardening (`cng-7c8.1`)

- [x] Lock down `/api/bootstrap`
- [x] Lock down `/api/auth/accounts*`
- [x] Lock down `/api/import/alerts*` and other weakly-protected operational routes
- [x] Remove trust in client-supplied `actor` for sensitive flows
- [x] Add backend authz regression tests
- **Status:** completed

### Phase 0B: Baseline Recovery And Toolchain Stabilization (`cng-7c8.2`)

- [x] Restore dependency integrity in the repo copy
- [x] Make install/healthcheck behavior trustworthy again
- [x] Triage lint and targeted test failures into actionable buckets
- [x] Define the verification command set for later phases
- **Status:** completed

### Phase 1A: Auth And Session Model Cleanup (`cng-7c8.3`)

- [x] Unify frontend/backend auth model on the client path
- [x] Remove contradictory bearer-token storage if cookie sessions remain canonical
- [x] Define clean RBAC enforcement points
- **Status:** completed

### Phase 1B: PostgreSQL Target Schema And Migration Map (`cng-7c8.4`)

- [x] Design normalized Postgres tables and indexes
- [x] Define aggregate tables for KPI/reporting workloads
- [x] Map current blob keys to migration targets
- [x] Define cutover and rollback strategy
- **Status:** completed

### Phase 1C: Backend Modular Monolith Scaffold In TypeScript (`cng-7c8.5`)

- [x] Create target app/package structure
- [x] Define route/service/repository boundaries
- [x] Add schema validation and shared contracts
- [x] Add test scaffolding for new modules
- **Status:** completed

### Phase 2A: Declarations, MST, Teams, And Rules Migration (`cng-7c8.6`)

- [x] Stand up read-only typed runtime adapters for `teams` and `mst-assignments`
- [x] Migrate `declarations` and `kpi-rules` behind the same boundary style
- [x] Migrate adjacent reporting inputs behind the same boundary style
- [x] Preserve auditability and business parity
- [x] Add staged API cutover paths
- **Status:** completed

### Phase 2B: Reporting And KPI Aggregation Redesign (`cng-7c8.7`)

- [x] Introduce the first monthly aggregate read model and snapshot materialization path
- [x] Add cache-aware monthly aggregate reuse, invalidation, and schedule status surfacing
- [x] Refresh the stored working-set monthly aggregate snapshot when reporting source keys change
- [x] Introduce a canonical default monthly aggregate preset for schedules and no-query reads
- [x] Tighten export boundary with a compact `reporting-v4` contract resolved server-side
- [x] Retire compatibility reporting slices and materialize projection entry tables
- **Status:** completed

### Phase 2C: UI Shell And Design System V4 (`cng-7c8.8`)

- [x] Centralize shell/navigation metadata into a shared registry used by the shell and Command Center
- [x] Expand Command Center coverage to all visible shell tabs
- [x] Remove invalid nested-button markup from the Command Center command list
- [x] Create the first shared section/search primitives for data-heavy shell surfaces
- [x] Improve Command Center and account-list accessibility/data density without changing business behavior
- [x] Roll the shared shell primitives into larger MST/import/reporting surfaces
- **Status:** completed

### Phase 2D: Import Workflow And Data-Heavy UI Optimization (`cng-7c8.9`)

- [x] Extract low-risk behavioral seams out of `DataImporter.jsx` with dedicated regression coverage
- [x] Break up `DataImporter.jsx`
- [x] Move heavy parsing off the main thread where useful
- [x] Rebuild import/sync UX as a guided workflow
- **Status:** completed
- Implemented slices:
  - `src/components/dataImporter/DataImporterSelectionActions.jsx`
  - `src/components/dataImporter/DataImporterSyncPreviewPanel.jsx`
  - `src/components/dataImporter/DataImporterDeletedRowsDialog.jsx`
  - `src/components/dataImporter/DataImporterImportPreviewSummary.jsx`
  - `src/components/dataImporter/DataImporterColumnConfigDialog.jsx`
  - `src/components/dataImporter/DataImporterDuplicateDiffDialog.jsx`
  - `src/components/dataImporter/DataImporterDuplicateReviewDialog.jsx`
  - `src/components/dataImporter/DataImporterGridToolbarControls.jsx`
  - `src/components/dataImporter/DataImporterCardResults.jsx`
  - `src/components/dataImporter/DataImporterTableBody.jsx`
  - `src/components/dataImporter/DataImporterTableHeader.jsx`
  - `src/components/dataImporter/DataImporterTableResults.jsx`
  - `src/components/dataImporter/DataImporterResultsPanel.jsx`
  - `src/components/dataImporter/DataImporterMonitoringPanel.jsx`
  - `src/components/dataImporter/DataImporterCoCodeConfigPanel.jsx`
  - `src/components/dataImporter/DataImporterFileActions.jsx`
  - `src/components/dataImporter/DataImporterFilterPresetControls.jsx`
  - `src/components/dataImporter/DataImporterQueryFilterControls.jsx`
  - `src/components/dataImporter/DataImporterDuplicateWorkflowControls.jsx`
  - `src/components/dataImporter/DataImporterSyncConfigPanel.jsx`
  - `src/components/dataImporter/DataImporterListControlsPanel.jsx`
  - `src/components/dataImporter/DataImporterAssignmentComboboxes.jsx`
  - `src/components/dataImporter/DataImporterDeclarationStatus.jsx`
  - `src/components/dataImporter/dataImporterDeclarationStatus.js`
  - `src/components/dataImporter/dataImporterRowUtils.js`
  - `src/components/dataImporter/dataImporterDuplicateDiffUtils.js`
  - `src/components/dataImporter/dataImporterDuplicateReviewUtils.js`
  - `src/components/dataImporter/dataImporterLicenseUtils.js`
  - `src/components/dataImporter/dataImporterConfig.js`

### Phase 3A: ECUS Bridge Extraction (`cng-7c8.10`)

- [x] Separate Windows/DPAPI/SQL Server concerns into a bridge service
- [x] Define the bridge contract with the core app
- [x] Reduce core-platform coupling to legacy ECUS constraints
- **Status:** completed
- Implemented slices:
  - `server/ecus/bridgeService.js`
  - `tests/server.ecusBridgeService.test.js`
  - `server/index.js` delegation through `createEcusBridgeService(...)`

### Phase 3B: Observability, QA Matrix, And Staged Rollout (`cng-7c8.11`)

- [x] Add metrics, health, and migration verification
- [x] Define staged rollout and fallback checks
- [x] Build QA matrix for parity and regression coverage
- **Status:** completed
- Implemented slices:
  - `server-v4/src/app/v4-rollout-status.ts`
  - `server-v4/src/app/build-v4-app.ts`
  - `docs/operations/v4-qa-matrix.md`
  - `docs/operations/v4-rollout-plan.md`
- Program state:
  - All planned phases under `cng-7c8` are complete and ready for epic closure.

## Key Questions

1. Which route hardening changes can land immediately without breaking operator workflows?
2. Which tests need to change because they currently encode insecure behavior?
3. What is the minimum safe path from blob persistence to relational persistence?
4. Which UI flows deserve full redesign first because they dominate daily operator time?
5. Which remaining runtime reads are still blocked on `kv_store`/SQLite enough to prevent a credible PostgreSQL cutover story?
6. How much of the app/package split can happen without destabilizing the current monolith and `server-v4` dual-runtime arrangement?

## Decisions Made

| Decision                                                                      | Rationale                                                                                                          |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Keep the review artifact and create a separate execution program              | Review and implementation need distinct tracking states                                                            |
| Start with `cng-7c8.1` before toolchain cleanup                               | Security boundary failures are the highest risk and easiest to justify immediately                                 |
| Treat this repo copy as a safe place for aggressive restructuring experiments | The user explicitly said this is a copy of the production project                                                  |
| Keep all implementation tracked in both notebook files and beads              | Required by `AGENTS.md` and useful for long-running work                                                           |
| Create a new epic `cng-3or` instead of reopening `cng-7c8`                    | The first execution program is complete; remaining blueprint work needs a clean second program with its own phases |
| Start the continuation program with runtime persistence (`cng-3or.1`)         | Postgres cutover remains the biggest blocker for the later app/package split and end-state reporting architecture  |

## Errors Encountered

| Error                                                                                                                                                                                 | Attempt | Resolution                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm healthcheck` fails because `node_modules/express/index.js` is missing                                                                                                           | 1       | Resolved in Phase 0B by restoring dependency integrity with `pnpm install --force`                                                            |
| `bd` daemon startup is slow and falls back to direct mode                                                                                                                             | 1       | Continue in direct mode for local tracking; not a blocker to planning                                                                         |
| `pnpm vitest tests/server.api.test.js --run` fails because `node_modules/vitest/vitest.mjs` is missing                                                                                | 1       | Resolved in Phase 0B after reinstalling dependencies                                                                                          |
| `pnpm lint` reports repo-wide line-ending and legacy lint debt                                                                                                                        | 1       | Fixed line endings and new local errors; remaining output is warnings-only legacy debt                                                        |
| `tests/server-v4/runtimeRoutes.test.js` initially failed because `buildV4App()` still treated runtime config like a module array                                                      | 1       | Added `BuildV4AppOptions`, runtime config resolution, and typed router wiring for migrated domains                                            |
| `eslint` currently ignores `server-v4/**/*.ts` because the repo lint config has no matching rule set for that subtree                                                                 | 1       | Accept temporarily for this slice and rely on `tsc` + tests; add proper lint coverage for `server-v4` in a later infrastructure pass          |
| A combined regression run forced `--environment node` onto `tests/reportViewer.test.jsx`, which broke `window` access before any reporting assertion ran                              | 1       | Re-ran browser/UI suites without the node override and kept the node env only for `tests/reportingClient.test.js`                             |
| `tests/commandCenter.test.jsx` initially failed before collection because `vi.mock()` hoisted above spy initialization, and the component also emitted invalid nested-button warnings | 1       | Switched the test spies to `vi.hoisted()` and changed command rows from nested `button` markup to a keyboardable `div[role="button"]` surface |
| `tests/accountManager.staff.test.jsx` still encoded legacy `actor` payload expectations and leaked DOM across cases once the list shell grew a second search field                    | 1       | Updated the regression to the current actor-free auth contract and added explicit RTL `cleanup()` in `afterEach`                              |
| `tests/dataImporterSelectionActions.test.jsx` produced duplicate button matches after the second render                                                                               | 1       | Added explicit RTL `cleanup()` in `afterEach` because this suite does not get automatic DOM cleanup between those cases                       |

## Notes

- Prioritize real risk reduction over cosmetic cleanup.
- Do not spread new work into oversized modules; split as we go.
- Any new behavior change must bring its own test coverage.
- `/api/bootstrap` now implies an authenticated bootstrap lifecycle; the frontend must re-bootstrap after login, not only before render.
- Verified baseline for the next phases:
  - `pnpm healthcheck` passes with backup/cron warnings only.
  - `pnpm lint` passes with warnings only.
  - `pnpm exec vitest run tests/server.api.test.js` passes (`98/98`).
- Phase 1A slice status:
  - `src/auth/localAuth.js` no longer persists or injects bearer tokens and proactively clears the legacy `kpi_session_token`.
  - Frontend/demo test helpers now model cookie-session auth instead of local token reuse.
  - Backend auth endpoints no longer echo session `token` values in login/password-change responses.
  - Leftover client-side `actor` plumbing was removed from `AccountManager`, so account-management callers no longer pretend to supply an authoritative actor identity.
  - Clean RBAC enforcement points for the current system:
    - `requireAuthenticated()` for session presence
    - `requireAccountManage()` for account lifecycle
    - `verifyStoragePermission()` for `kv_store` API keys
    - Route-specific guards for sync, alerts, audit, AI, rules, and notifications at the backend entrypoint
- Phase 2A slice status:
  - `server-v4` now mounts real read-only routers for `/api/v4/teams` and `/api/v4/mst-assignments`.
  - Both domains read the legacy SQLite `kv_store` directly through a small `LegacyKvStoreReader` instead of reaching back into `server/index.js`.
  - `mst-assignments` already exposes effective-date resolution via `/api/v4/mst-assignments/resolve`, matching current monolith behavior closely enough for migration work.
  - `server-v4` now also mounts `/api/v4/declarations` with normalized declaration IDs plus `mst`/`soTk`/`branch` filters, and `/api/v4/kpi-rules` with a versioned collection response wrapped around legacy single-rule snapshots.
  - The declaration adapter keeps monolith-compatible normalization for declaration numbers and branch aliases, while relaxing MST lookup to match branch-suffixed tax IDs during the migration bridge.
  - `server-v4` now also mounts `/api/v4/reporting/summary`, `/api/v4/reporting/staff`, `/api/v4/reporting/teams`, and `/api/v4/reporting/schedules`.
  - The reporting bridge now reuses `shared/reportingLegacyMath.js` instead of cloning KPI math into `server-v4`, which keeps parity risk low while the shared math still reflects legacy KPI behavior.
  - Report schedules use a backend-side normalizer with `asOf` support so tests can assert deterministic next-run behavior without pulling the whole legacy `store.js` into the new backend.
  - The current monolith now exposes the same reporting contract at `/api/v4/reporting/*`, backed by `server/reportingReadModels.js`; this is the staged cutover path for frontend migration before the aggregate redesign lands.
- The monthly aggregate slice now reuses stored snapshots when the query matches, refreshes the stored working-set snapshot when reporting source keys change, materializes a separate default preset snapshot for schedules/no-query reads, and exposes aggregate freshness metadata on `/api/v4/reporting/schedules`.
- The export boundary now accepts compact `reporting-v4` payloads and resolves the real report payload on the server, which removes trust in client-posted report blobs without forcing the whole `ReportViewer` read path to migrate in one step.
- The current reporting UI migration also depends on `rules.js` read paths staying side-effect free; regressions here can create self-triggered storage subscription loops in `ReportViewer`, so keep regression coverage around read-only rule access until the UI is fully off legacy storage subscriptions.
- Reporting read models now also carry precomputed company summary slices for summary/staff/team views, so `ReportViewer` should stay on payload consumption and not reintroduce `aggregateByCompany()` browser-side during later dashboard/export cleanup.
- The client reporting view model should stay as a thin normalizer around server payloads; avoid reintroducing synthetic top-level snapshots like `report.rows` unless a concrete consumer needs them.
- The client reporting view model should also avoid mirroring server metadata like collection `keysHash` unless an actual browser consumer needs it; keep the client contract centered on data access helpers (`list`, `byKey`) rather than passive transport details.
- Apply the same rule to trend payloads: if the browser only renders `series` and `comparison`, keep `teamSeries` / `topTeams` upstream until needed but do not mirror them into the normalized client view model by default.
- Apply the same rule to staff/team items: avoid `...source` in reporting client normalizers so server-only payload fields do not silently leak into browser state without an explicit UI need.
- Apply the same rule to top-level summary blobs: browser state should only retain metrics the dashboard renders (`decls`, `import`, `export`, `kpi`, license/CO/company counts, summary text), not arbitrary server-side summary metadata.
- Apply the same rule to rule references: keep only `id`, `name`, `applyFrom`, optional `version`, and `license.exclude.codes` in the client model unless a future UI consumer proves a need for more.
- Push alias/fallback handling into the reporting client normalizer as well: component code should consume canonical `adjustments.totalsByCategory` instead of reimplementing `totals` fallback and numeric coercion in the render path.
- Continue that pattern for approved adjustment rows: move field extraction (`label`, `quantity`, `unitPoints`, references text, note, actor/team labels) into the client normalizer so the render path just formats values.
- Keep collapsing viewer-side passthrough wrappers after each normalization step lands: once a reporting branch is canonical in `reportingClient`, `ReportViewer` should read it directly instead of rebuilding local `*Report` aliases or carrying dead derived locals.
- Apply the same rule inside entity cards: derived display fields like `licenseSummary` and `adjustmentTotals` belong in the reporting client normalizer when they are reused across both staff and team detail cards.
- Apply that same rule to reusable adjustment aggregates: counts/breakdowns derived from `rows` should be normalized once in `reportingClient` and then formatted in `ReportViewer`, instead of each detail card scanning raw rows separately.
- Apply the same rule at report scope too: once `adjustments.totalsByCategory` is canonical in the client normalizer, derive the render-order `totalsList` there as well so the top-level reporting UI does not keep calling shared helper transforms in-browser.
- Apply the same rule to license-code labels anywhere they repeat: if a table path only renders a comma-joined license-code string, normalize `licenseSummary` once in the reporting client model and render that string directly instead of joining arrays in the component.
- Extend that rule down to detail rows: keep raw arrays if needed for audit/export, but also expose normalized `licenseSummary` / `licenseExcludedSummary` so detail tables do not repeat array-to-string shaping logic.
- Apply the same rule to rule metadata too: if the reporting UI only displays the excluded license-code list as text, normalize `licenseExcludedSummary` in the rule reference model and render that field directly.
- Apply the same rule to report schedules: `/api/v4/reporting/schedules` should be the canonical source for schedule summaries and default-aggregate readiness, while any remaining browser-local `getReportSchedules()` state only overlays optimistic edits by `id`.
- Keep schedule display shaping in the reporting client model as well: normalize `formatsSummary`, `recipientsSummary`, and `aggregateStatus` there so `ReportViewer` does not keep joining raw arrays or rebuilding schedule readiness text inline.
- Keep schedule writes behind the reporting boundary too: the monolith shim now owns explicit `POST`/`DELETE /api/v4/reporting/schedules*` mutations and generic storage writes for `kpi_report_schedule_v1` are blocked, so future work should extend that same contract into shared services instead of reopening `/api/storage`.
- Mutation parity now exists in `server-v4` / shared reporting services for schedules, and `ReportViewer` consumes shared schedule-cache updates instead of component-local refetch bumps. The next reporting-boundary cleanup is wider consumer reuse plus replacing the remaining legacy `kv_store` / default-snapshot persistence with typed projections.
- The dashboard read path now also goes through a single `/api/v4/reporting/view` boundary in both runtimes, so future reporting work should extend that shared bundle instead of reintroducing browser-side `summary`/`staff`/`teams` fan-out requests.
- Compact export materialization now also routes through `buildReportingReadModels()` in `server/reportExportPayloads.js`, so compact `staff`/`team`/`all` exports share the same reporting read-model bundle as the dashboard while still carrying the full selected rule object for export subtitles and audit.
- The monolith now also mediates schedule/default-aggregate `kv_store` access through `server/reportingProjectionStore.js`; the storage backend is still legacy, but the projection boundary is now isolated enough to swap underneath later without re-editing reporting routes again.
- That projection swap is now landed: schedule plus active/default monthly aggregate snapshots persist in `reporting_projections` in both runtimes, with legacy `kv_store` reads kept only as compatibility fallback for pre-cutover rows.
- The last `ReportViewer` baseline-summary consumer now also goes through `fetchReportingViewModel()` / `/api/v4/reporting/view`, so the dashboard path no longer needs a separate browser-side `summary` request when comparing against the active rule set.
- Compatibility `/api/v4/reporting/summary|staff|teams` endpoints are now retired in both runtimes; repo search found no in-repo runtime consumer, and the monolith now returns JSON `404` for unmatched `/api/*` requests so those retired paths cannot fall through to the SPA shell.
- Backend reporting math now lives in `shared/reportingLegacyMath.js`, with thin re-export seams in `shared/reportingDateRanges.js`, `shared/reportingCompanyAggregation.js`, `server/legacyReportingBridge.js`, and `src/lib/reports.js`. The backend no longer imports the frontend `src/lib/reports.js` file directly.
- The remaining legacy helper dependency is now gone too: `shared/reportingLegacySupport.js` and `shared/reportingKpiComputation.js` hold the pure normalization/roster/KPI math that reporting needs, so `shared/reportingLegacyMath.js` no longer imports `src/lib/store.js` or `src/lib/rules.js`.
- `reporting_projections` rows now also persist typed metadata columns (`scope_key`, `range_from`, `range_to`, `query_key`, `entry_count`) next to the JSON payload, and the last remaining JSON-blob-only child state is now materialized into dedicated relational tables too: `reporting_schedule_projection_entries` and `reporting_monthly_aggregate_projection_entries`.
- `cng-7c8.7` no longer has an open phase-level residual. Future reporting work can start from the unified `/api/v4/reporting/view` boundary plus the materialized projection tables instead of revisiting wrapper cleanup or blob-only persistence first.
- `cng-7c8.8` has started with a low-risk shell slice: `src/lib/appShellNavigation.js` is now the shared registry for tab labels, tooltips, visibility, and Command Center navigation metadata.
- `KPICalculator` now renders its tab strip from that shared registry, which removes duplicate shell metadata and gives later UI-shell redesign work a single seam for tab order/visibility changes.
- `CommandCenter` now derives navigation commands from the same registry, so global shell navigation covers every visible tab instead of a hand-maintained subset, and the `health` sync shortcut is no longer offered to users who cannot open the health tab.
- `CommandCenter` command rows no longer nest a secondary pin `button` inside a primary `button`; the surface now uses a keyboardable `div[role="button"]`, which resolves the invalid markup warning exposed by the new regression test.
- `cng-7c8.8` now also has a first reusable shell primitive layer in `src/components/designSystem/shellPrimitives.jsx` for section headers, filter/action toolbars, and labelled search fields.
- `AccountManager` uses that shell layer for the create/list sections, and its account table now carries an explicit accessible label/caption plus a denser sticky-header layout for longer operator sessions.
- `CommandCenter` now reuses the shared search field and exposes real dialog semantics (`role="dialog"`, labelled searchbox, `aria-haspopup`/`aria-controls` trigger metadata), which tightens keyboard/screen-reader behavior without changing command behavior.
- `cng-7c8.9` has now extracted the ECUS sync and C/O monitoring state machines into `useDataImporterSync.js` and `useDataImporterCoMonitoring.js`; the next importer seam should target the remaining workflow/session container in `DataImporter.jsx` around saved-row loading, source-mode transitions, duplicate-review orchestration, and save/edit ownership.
- With `useDataImporterSavedSession.js` now extracted too, the next `cng-7c8.9` seam is narrower: preview/source transitions (`handleFileChange()` / `handleImport()`), then the save-edit/duplicate-review workflow container that still owns most of the remaining mutation-heavy callbacks in `DataImporter.jsx`.
- With `useDataImporterImportFlow.js` now extracted as well, the next `cng-7c8.9` seams are the remaining save/edit ownership and duplicate-review orchestration callbacks, followed by any workflow container state that still couples saved-mode editing with reconciliation UI in `DataImporter.jsx`.
- With `useDataImporterSavedEdits.js` now extracted too, the remaining `cng-7c8.9` work is concentrated in destructive row mutations, review/reconciliation workflows, and the broader workflow container state that still binds saved-mode editing to duplicate handling in `DataImporter.jsx`.
- With `useDataImporterRowMutations.js` now extracted too, the remaining `cng-7c8.9` work is concentrated in review/reconciliation workflows and the broader container state that still binds saved-mode editing to duplicate handling in `DataImporter.jsx`.
- With `useDataImporterReviewActions.js` now extracted too, the remaining `cng-7c8.9` work is concentrated in duplicate-review/reconciliation orchestration and the broader workflow container state that still binds saved-mode editing to duplicate handling in `DataImporter.jsx`.
- With `useDataImporterDuplicateDiff.js` now extracted too, the remaining `cng-7c8.9` work is concentrated in duplicate-review confirm/reconcile orchestration and the broader workflow container state that still binds saved-mode editing to duplicate handling in `DataImporter.jsx`.
- With `useDataImporterFilterPresets.js` now extracted too, the remaining `cng-7c8.9` work is concentrated in the broader workflow/session container state that still binds quick-search/date/query controls, selection/assignment actions, and the remaining saved-mode orchestration together in `DataImporter.jsx`; the next clean seam is the query/search controller cluster rather than more preset or reconciliation mutations.
- With `useDataImporterQueryFilters.js` now extracted too, the remaining `cng-7c8.9` work is concentrated in selection/assignment orchestration plus the broader workflow/session container state that still binds saved-mode editing, duplicate handling, and source-mode transitions together in `DataImporter.jsx`; the next clean seam is no longer the search controller, but the selection-assignment workflow around shared row actions and combobox ownership.
- With `useDataImporterAssignments.js` now extracted too, the remaining `cng-7c8.9` work is concentrated in the selection controller and broader workflow/session container state that still binds selected-row actions, filtered selection, export, and saved-mode orchestration together in `DataImporter.jsx`; the next clean seam is the selection/shared-row-action controller rather than combobox assignment shaping.
- With `useDataImporterSelectionActions.js` now extracted too, the remaining `cng-7c8.9` work is concentrated in selected-row export/bulk-action orchestration plus the broader workflow/session container state that still binds saved-mode editing, duplicate handling, and mode transitions together in `DataImporter.jsx`; the next clean seam is no longer selection state, but either export-selected handling or the remaining workflow/session controller.
- With `useDataImporterSelectionBulkActions.js` now extracted too, the remaining `cng-7c8.9` work is concentrated in the broader workflow/session container state that still binds saved-mode editing, duplicate handling, source-mode transitions, and the remaining bulk flows together in `DataImporter.jsx`; the next clean seam is the saved-mode/session container rather than another isolated selection/export helper.
- With `useDataImporterListPreferences.js` now extracted too, the remaining `cng-7c8.9` work is concentrated even more tightly in the broader saved-mode/session container around deleted-row fetching, history refresh, baseline snapshot refresh, and the duplicate/review/source-mode orchestration that still lives in `DataImporter.jsx`.
- With `useDataImporterDeletedRows.js` and `useDataImporterRowHistory.js` now extracted too, the remaining `cng-7c8.9` work is concentrated primarily in baseline snapshot ownership plus the broader saved-mode/session orchestration that still binds saved data refresh, diff calculation, and remaining mode transitions together in `DataImporter.jsx`.
- With `useDataImporterBaselineSnapshot.js` now extracted too, the remaining `cng-7c8.9` work is concentrated primarily in the broader saved-mode/session orchestration that still binds saved data refresh, duplicate/reconcile flows, and remaining mode transitions together in `DataImporter.jsx`; the next clean seam is no longer baseline diff ownership, but the residual session container around saved-mode refresh/reset behavior.
- With `useDataImporterRowEditing.js` now extracted too, the remaining `cng-7c8.9` work is concentrated primarily in the residual saved-mode/session container around refresh/reset behavior, plus any remaining duplicate/reconcile and mode-transition orchestration still wired directly inside `DataImporter.jsx`; the next clean seam is no longer row-edit mutation ownership, but the broader session controller that still coordinates those extracted hooks together.
- With `useDataImporterResultRows.js` now extracted too, the remaining `cng-7c8.9` work is concentrated more narrowly in the residual saved-mode/session container around refresh/reset behavior, duplicate/reconcile orchestration, and mode transitions; search fetch/paging/reset/selection-prune behavior no longer needs to be carried inline in `DataImporter.jsx`.
- With `useDataImporterRowPresentation.js` now extracted too, the remaining `cng-7c8.9` work is no longer in shared table/card row-state shaping, but in the broader workflow/session container and any remaining reconciliation flows still owned directly by `DataImporter.jsx`.
- With `useDataImporterSavedHighlights.js` now extracted too, the remaining `cng-7c8.9` work is no longer in saved-mode highlight/banner derivation or its selection shortcuts, but in the broader workflow/session container and the remaining reconciliation flows still owned directly by `DataImporter.jsx`.
- With `dataImporterDuplicateSummary.js` now extracted too, the remaining `cng-7c8.9` work is no longer in duplicate-group aggregation/keeper selection metadata, but in the broader workflow/session container and the remaining frozen-column/layout orchestration still owned directly by `DataImporter.jsx`.
- With `useDataImporterColumnConfig.jsx` now extracted too, the remaining `cng-7c8.9` work is no longer in persisted column-config or resize-handle orchestration, but in the broader workflow/session container that still coordinates saved-mode refresh/reset, duplicate/reconcile flows, and residual layout/session ownership inside `DataImporter.jsx`.
- With `useDataImporterEditAccess.js` now extracted too, the remaining `cng-7c8.9` work is no longer in role/team edit gating or staff team-change sanitization, but in the broader workflow/session container and any residual saved-mode ownership still embedded in `DataImporter.jsx`.
- With `dataImporterDeletedEntries.js` now extracted too, the remaining `cng-7c8.9` work is no longer in deleted-row summary/range shaping or duplicated agency-option derivation, but in the broader workflow/session container and the residual saved-mode orchestration still embedded in `DataImporter.jsx`, which is now down to `1999` lines.
- With `dataImporterDuplicateDiffPreparation.js` now extracted too, the remaining `cng-7c8.9` work is no longer in duplicate-diff row normalization for license/C/O/timestamp/agency fields, but in the broader workflow/session container and the residual saved-mode orchestration still embedded in `DataImporter.jsx`, which is now down to `1973` lines.
- With `useDataImporterOverview.js` now extracted too, the remaining `cng-7c8.9` work is no longer in saved-mode summary/alert/sync label derivation, but in the broader workflow/session container and the residual mode-transition orchestration still embedded in `DataImporter.jsx`.
- With `useDataImporterDeletedRows.js` expanded to own deleted-entry filtering/counts/range labels too, the remaining `cng-7c8.9` work is no longer in deleted-dialog data shaping, but in the broader workflow/session container and the residual preview/saved-mode orchestration still embedded in `DataImporter.jsx`.
- After the overview-hook extraction plus deleted-hook expansion, `DataImporter.jsx` is down to `1914` lines; the next `cng-7c8.9` seam should target the remaining workflow/session container rather than another pure derivation helper.
- With `useDataImporterDisplayPreferences.js` now extracted too, the remaining `cng-7c8.9` work is no longer in page-size/view-mode/frozen-column/card-grid hydration or persistence, but in the remaining workflow/session container around sync-status toast handling, layout observation, and residual mode-transition orchestration still embedded in `DataImporter.jsx`.
- After the display-preferences hook extraction, `DataImporter.jsx` is down to `1839` lines; the next `cng-7c8.9` seam should target sync/layout session wiring or another true container seam, not more preference storage.
- With `useDataImporterSyncStatusToast.js` and `useDataImporterContainerWidth.js` now extracted too, the remaining `cng-7c8.9` work is no longer in sync toast dedupe or root-width observer wiring, but in the broader workflow/session container around overwrite guards, unsaved-diff synchronization, and the remaining saved-mode orchestration still embedded in `DataImporter.jsx`.
- After the sync-toast plus container-width extraction, `DataImporter.jsx` is down to `1792` lines; the next clean seam should target the residual workflow/session effects or a larger saved-mode controller rather than more UI wiring.
- With `useDataImporterActionGuards.js` now extracted too, the remaining `cng-7c8.9` work is no longer in editable/hard-delete gating or their alert messaging, but in the broader workflow/session container that still coordinates saved-mode refresh/reset and overwrite behavior inside `DataImporter.jsx`.
- With `useDataImporterLicenseSummary.js` now extracted too, the remaining `cng-7c8.9` work is no longer in rule-derived license exclusion sets or row-level license snapshot summarization, but in the residual workflow/session orchestration and any remaining cross-hook coordination still embedded in `DataImporter.jsx`.
- After the action-guard plus license-summary extractions, `DataImporter.jsx` is down to `1616` lines; the next clean seam should target the remaining saved-mode/session controller rather than more isolated memo helpers.
- With `useDataImporterImportPreview.js` now extracted too, the remaining `cng-7c8.9` work is no longer in preview-row shaping or overwrite capability/reset coordination, but in the broader saved-mode/session container that still coordinates refresh/reset behavior, duplicate/reconcile flows, and remaining mode transitions inside `DataImporter.jsx`.
- After the import-preview extraction, `DataImporter.jsx` is down to `1593` lines; the next clean seam should stay on the saved-mode/session controller rather than another isolated preview or rules helper.
- With `DataImporterSummaryCards.jsx`, `DataImporterLastSyncSummaryCard.jsx`, and `DataImporterUpdatedRowsBanner.jsx` now extracted too, the remaining `cng-7c8.9` work is no longer in saved-mode overview/highlight rendering, but in the broader saved-mode/session container and cross-hook orchestration that still lives in `DataImporter.jsx`.
- After the saved-mode display extraction, `DataImporter.jsx` is down to `1546` lines; the next clean seam should target controller/orchestration ownership rather than more presentational JSX.
- With `dataImporterSyncPanelProps.js` now extracted too, the remaining `cng-7c8.9` work is no longer in sync/admin panel tone mapping or monitoring/config prop shaping, but in the broader saved-mode/session controller and mode-transition ownership still embedded in `DataImporter.jsx`.
- With `dataImporterShellProps.js` now extracted too, the remaining `cng-7c8.9` work is no longer in file/list/grid toolbar prop assembly, but in the broader workflow/session controller that still owns hook composition and mode transitions in `DataImporter.jsx`.
- With `dataImporterResultsProps.js` now extracted too, the remaining `cng-7c8.9` work is no longer in shared/table/card result prop assembly, but in the broader controller/container ownership that still lives directly in `DataImporter.jsx`.
- After the sync/list/results prop-helper extractions, `DataImporter.jsx` sits at `1484` lines; the next clean seam should be a true controller/container extraction or render-surface split rather than another small prop bundle.
- With `useDataImporterDuplicateWorkflow.js` now extracted too, the remaining `cng-7c8.9` work is no longer in duplicate summary/highlight/diff/review cross-hook composition, but in the broader saved-mode/session controller and import/sync workflow ownership that still live directly in `DataImporter.jsx`.
- With `DataImporterShell.jsx` now extracted too, the remaining `cng-7c8.9` work is no longer in top-level dialog/panel/banner render branching, but in the broader controller/container ownership across hook composition, mode transitions, and session workflow still embedded in `DataImporter.jsx`.
- After the duplicate-workflow hook plus shell render-split, `DataImporter.jsx` sits at `1420` lines; the next clean seam should target a larger session/controller cluster (saved-mode refresh/import/sync composition or results-surface controller ownership) rather than another presentational extraction.
- With `useDataImporterResultsController.js` now extracted too, the remaining `cng-7c8.9` work is no longer in row edit/select/delete/layout/results wiring, but in the broader workflow/session container and residual shell prop ownership still embedded in `DataImporter.jsx`.
- With `useDataImporterWorkflowSession.js` now extracted too, the remaining `cng-7c8.9` work is no longer in saved-row load/sync/import/review/overview composition, but in the residual filter/result/session ownership and final container split still embedded in `DataImporter.jsx`.
- After the results-controller plus workflow-session extractions, `DataImporter.jsx` sits at `1223` lines; the next clean seam should target the remaining filter/result/session container or split the parent into a thinner assembly component rather than extracting more low-level helpers.
- With `useDataImporterResultsSurface.jsx` now extracted too, the remaining `cng-7c8.9` work is no longer in result-row fetch/save/license-exclusion/results-controller composition or last-sync card wiring, and `DataImporter.jsx` is now down to `768` lines while `useDataImporterSessionController.js` is at `799`.
- The next clean seam after the results-surface extraction is no longer line-count reduction in the parent, but either shrinking `useDataImporterSessionController.js` by true responsibility boundaries or moving on to the still-open phase goals: workerizing heavy XLSX parsing and redesigning the import/sync flow as a guided workflow.
- With `dataImporterWorkbookParser.js` plus `dataImporterWorkbook.worker.js` now extracted too, workbook `xlsx.read()` / `sheet_to_json()` work no longer blocks the main thread when `Worker` is available, while sync fallback keeps unsupported runtimes and tests stable.
- After the workbook workerization slice, the dominant residual inside `cng-7c8.9` is no longer parent line count or main-thread XLSX parsing, but the still-open guided workflow redesign for import/sync UX.
- The first guided-workflow shell slice is now in place via `src/components/dataImporter/DataImporterWorkflowGuide.jsx`, wired through `dataImporterShellProps.js` and `dataImporterContainerProps.js`; import/review/save progress is now explicit in the shell, but the phase checkbox stays open until sync/import actions themselves are reorganized into a more prescriptive end-to-end flow.
- The next low-risk guided-workflow follow-on slice is now also landed: the workflow guide no longer stops at passive status, but threads existing shell callbacks for `Chọn file XLSX`, `Import XLSX`, and `Lưu dữ liệu` into a “Bước kế tiếp đề xuất” action rail. The broader phase still stays open because source-mode and sync flows are not yet restructured into a truly guided end-to-end session.
- The guided-workflow shell now also has a shared state seam in `dataImporterWorkflowGuideState.js`, which keeps current-step/status semantics aligned between the stepper and the shell-stage regions instead of duplicating that mapping in multiple components.
- The next guided-workflow slice after the CTA rail is now also landed: `DataImporterShell.jsx` groups the importer surface into explicit source/review/save stage sections, but the phase stays open because those stages still reuse the existing session logic rather than driving a stricter end-to-end mode machine.
- With the step cards now linking to stable stage ids from `dataImporterWorkflowGuideState.js`, the guided-workflow shell no longer stops at visual grouping; the top stepper and the shell-stage regions now share explicit navigation semantics too.
- With ECUS preview/run actions now threaded into `workflowGuideProps`, the remaining `cng-7c8.9` gap is no longer “the sync branch is absent from the workflow guide”; the deeper residual is that ECUS preview data still renders inside the source panel rather than moving through the same review/save stage flow as file preview/import.
- With `previewSource="sync"` now threaded through the importer session, sync preview rows promote into the same review/save stage flow as file imports instead of staying trapped inside the source panel; the phase-level guided-workflow residual is now closed.
- `useDataImporterSessionController.js` has also been trimmed back under the project soft cap at `797` lines, while `DataImporter.jsx` remains at `784`, so Phase 2D no longer leaves an oversized primary importer container behind.
- Phase D follow-on slice landed: `server/storageRouteController.js` now owns generic `/api/storage` permission checks, blocked-key policy, actor forwarding, and HTTP/error shaping, while `server/index.js` only wires the four routes to that controller.
- Phase D residual is now narrower and more meaningful:
  - storage route registration still lives in `server/index.js`, but the bigger migration blocker has shifted back to persistence ownership
  - the next material slice should widen Postgres ownership beyond reporting projections, or keep shrinking SQLite dual-write compatibility surfaces around business snapshots/bootstrap
- Phase D follow-on slice landed: `server-v4/src/persistence/sqliteBusinessSnapshotReader.ts` now owns typed SQLite business snapshot reads inside the persistence namespace, and `runtimePersistence.ts` no longer constructs `LegacyBusinessSnapshotReader(new LegacyKvStoreReader(...))`.
- Phase D residual after this reader move:
  - the runtime still reports `sourceKind: dual-write` because hot business entities are backed by typed SQLite snapshots maintained through monolith dual-write compatibility
  - the next material slice should add a real non-SQLite business snapshot adapter path for canonical mode, most likely widening Postgres ownership beyond reporting projections
- Phase D follow-on slice landed: `teams` now mounts outside the sync `BusinessSnapshotReader` router-factory map via `persistence.teamsReader`, matching the async/Postgres pattern already proven for `mst-assignments`.
- Phase D residual after the `teams` slice:
  - reporting still enters through the sync declarations/rules/adjustments reader surface; only the team-roster subpath is now async-compatible through `createTeamRosterAsyncReader()`
  - the remaining high-value persistence cuts are other isolated business domains like declarations or KPI inputs, while `/api/storage` route registration in `server/index.js` is now only low-value cleanup
- Phase D follow-on slice landed: `declarations` now mounts through `persistence.declarationsReader`, and reporting receives explicit async declaration/team readers from app composition instead of wrapping the sync compatibility reader internally.
- Phase D residual after the `declarations` slice:
  - reporting still depends on sync rule and adjustment readers, so the remaining persistence bottleneck is no longer rows/roster plumbing but KPI input seams
  - the next high-value cut is `kpi-rules` or `kpi-adjustments` async/Postgres ownership, not the low-value `/api/storage` route-registration residue in `server/index.js`
- Phase D follow-on slice landed: `kpi-rules` now mounts through `persistence.kpiRulesReader`, and reporting receives an explicit async rules reader from app composition instead of reading rule collections through the sync compatibility reader.
- Phase D residual after the `kpi-rules` slice:
  - `kpi-adjustments` is now the main reporting input still tied to sync `BusinessSnapshotReader`; the remaining persistence bottleneck is approved-adjustment input, not declarations/team/rule wiring
  - the next high-value cut is a `kpi-adjustments` async/Postgres seam or a broader reporting-input bundle, while `/api/storage` route registration in `server/index.js` stays low-value cleanup
- Phase D follow-on slice landed: `server-v4/src/modules/kpi-adjustments/postgresAdjustmentAsyncReader.ts` now widens `kpi-adjustments` beyond Postgres snapshot-row transport by preferring canonical `kpi_adjustments` rows, then falling back to `adjustment_snapshot_rows`, then SQLite compatibility.
- Phase D residual after the canonical adjustments read slice:
  - Postgres business ownership is now stronger for adjustments, but declarations and rules still read transitional snapshot-row payload tables instead of canonical relational business tables
  - wider business write paths and the last low-value `/api/storage` route-registration residue still sit outside the new Postgres-first seams
- Phase D follow-on slice landed: `server-v4/src/modules/declarations/postgresDeclarationAsyncReader.ts` now widens declarations beyond Postgres snapshot-row transport by preferring canonical `declarations` + `declaration_license_codes` rows, then falling back to `declaration_snapshot_rows`, then SQLite compatibility.
- Phase D residual after the canonical declarations read slice:
  - declarations and adjustments now have canonical-table-first readers, while the broader runtime still remains dual-write because write ownership and untouched business paths have not moved off SQLite compatibility
  - the remaining meaningful Phase D work is broader business write-path ownership and the last low-value `/api/storage` route-registration residue, not more reader-only transport cleanup for already-canonical domains
- Phase D residual after the `kpi-adjustments` write-ownership slice:
  - `server-v4` now owns real business writes for `reporting`, `auth`, and `kpi-adjustments`, but broader business mutations/settings still remain outside the canonical runtime and Postgres cutover story.
  - the next material slice should move another domain's write/settings ownership into `server-v4` with the same explicit runtime-store contract, while `/api/storage` route registration in `server/index.js` stays low-value cleanup only.

## 2026-03-13 Reporting Boundary Cleanup

- Landed a small Phase D follow-on slice that removes the raw sync `BusinessSnapshotReader` dependency from the reporting boundary now that declarations, rules, adjustments, and teams already have explicit async seams.
- `server-v4/src/modules/reporting/ReportingRepository.ts` now consumes a required async-reader bundle instead of constructing fallback wrappers from a sync reader.
- `server-v4/src/modules/reporting/reportingRoutes.ts` and `server-v4/src/app/build-v4-app.ts` now wire reporting from `persistence.{declarationsReader,kpiRulesReader,adjustmentsReader,teamsReader}` plus `persistence.projections`, without forwarding `persistence.reader`.
- Residual stays centered on broader SQLite-compatibility reduction and business write-path ownership; `/api/storage` route registration in `server/index.js` remains low-value cleanup only.

## 2026-03-13 Runtime Persistence Contract Cleanup

- Landed a direct follow-on slice that removes `reader` from the public `RuntimePersistence` contract now that app composition no longer needs it.
- `server-v4/src/persistence/runtimePersistence.ts` still keeps the SQLite compatibility reader internally, but only to construct async seams and derive source metadata.
- `tests/server-v4/runtimePersistence.test.js` and the postgres route-wiring tests now verify that custom persistence fixtures can mount `buildV4App()` without providing a raw sync reader at all.
- Residual stays unchanged at the architectural level: SQLite compatibility still exists internally for untouched business paths, but it is no longer part of the public app-composition contract.

## 2026-03-13 Auth Module Cutover

- Mounted `auth` as the last scaffold replacement in the default `server-v4` catalog by wiring `buildAuthRouter(...)` through `persistence.authStore`.
- Added explicit runtime auth persistence ownership for both compatibility and canonical modes:
  - `server-v4/src/modules/auth/sqliteAuthStore.ts`
  - `server-v4/src/modules/auth/postgresAuthStore.ts`
  - `server-v4/src/persistence/runtimePersistence.ts`
- Verified cookie-session login/logout/session restore plus account-management routes through `tests/server-v4/authRoutes.test.js`.
- Rollout impact:
  - `8/8` implemented modules
  - `0` scaffold modules
  - `6` read-only modules
  - `2` read-write modules
  - `20` implemented routes
  - `6` implemented mutation routes
  - `readiness=ready`
  - `currentStage=cutover-ready`
- Residual after this slice:
  - Phase D no longer needs more scaffold/module-parity work.
  - The next meaningful work is broader business write-path ownership beyond `reporting` plus `auth`, while `/api/storage` route registration in `server/index.js` remains low-value cleanup only.
