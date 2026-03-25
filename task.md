# Task Tracker

## Active Slice

- Title: Wave-1 frontend decomposition backlog complete
- Bead: `cng-xyq`
- Status: completed
- Last updated: 2026-03-26

## Completed This Session

1. Fact-check review da duoc ghi lai tai:
   - `docs/gemini-review-v1-factcheck-2026-03-25.md`
2. Backlog bead da duoc seed:
   - `cng-xyq` epic
   - `cng-xyq.6` security hardening baseline
   - `cng-xyq.3` React Error Boundary app/tab level
   - `cng-xyq.2` shared StaffCombobox extraction
   - `cng-xyq.1` checklist verification + `Checklist.md`
   - `cng-xyq.5` server-v4 rollout planning beyond reporting
   - `cng-xyq.4` wave-1 frontend decomposition planning
3. `Checklist.md` da duoc cap nhat voi trang thai xac minh hien tai:
   - da danh dau cac muc co bang chung code/test
   - da ghi ro cac muc chua thay, chua khop day du, hoac can E2E/runtime verification
   - cac diem can theo doi them: C/O runtime 500, cot AMA, cleanup toan repo, muc "di lam muon", va mapping tai khoan mac dinh dung theo danh sach nghiep vu
4. Draft rollout plan cho `server-v4` beyond reporting da duoc ghi lai tai:
   - `docs/server-v4-rollout-plan-2026-03-25.md`
   - bao gom:
     - inventory route `legacy` va `v4` can doi chieu
     - cac parity gap hien tai, dac biet quanh `auth` va `declarations`
     - thu tu rollout theo wave thay vi mount dong loat 8 module
     - verify gate va test suite nen chay cho moi wave
5. `cng-xyq.7` dang implementation wave-1 mount:
   - them `server/v4RolloutMount.js` de co dinh danh sach module wave-1 va helper chon module tu compiled `moduleCatalog`
   - doi legacy mount tu `reporting` don le sang `reporting + teams + mst-assignments + hq-agencies`
   - them `tests/v4RolloutMount.test.js` de khoa logic selection va missing-module warning path
6. `cng-wh8` da duoc mo cho wave-2 mount:
   - muc tieu tiep theo la mount `kpi-rules` va `kpi-adjustments` qua legacy server sau khi wave-1 da on dinh
   - can chay impact analysis truoc khi cham vao startup mount helper va verify lai toan bo matrix `reporting + wave-1 + wave-2`
7. `cng-wh8` da duoc implementation o muc code/test:
   - mo rong `server/v4RolloutMount.js` bang `WAVE2_V4_MODULE_IDS`, `LEGACY_V4_MODULE_IDS`, `selectV4Modules`, va `selectLegacyV4Modules`
   - legacy server startup mount hien chon tong hop `reporting + teams + mst-assignments + hq-agencies + kpi-rules + kpi-adjustments`
   - bo sung regression tests cho selector legacy-v4 tong hop va missing-module path cua wave-2
8. `cng-d0a` da duoc mo cho auth parity:
   - muc tieu tiep theo la dua cac endpoint auth con thieu ve `server-v4` truoc khi xu ly declarations shadow/cutover
   - can doi chieu lai 3 parity gap da note trong rollout plan va verify lai auth route matrix
9. `cng-d0a` da duoc implementation o muc code/test:
   - canonical `/api/v4/auth` da bo sung `POST /accounts/:username/password`, `DELETE /accounts/:username`, va `POST /password/change`
   - `AuthService` va `AuthController` da co canonical home cho 3 flow con thieu, thay vi chi ton tai o compat layer
   - auth regression tests da cover password reset, self-change password, delete account, boundary permission, va last-admin guard
10. `cng-0fs` da duoc mo cho declarations shadow:
   - day la domain blast radius cao nhat, can shadow parity + compat telemetry truoc write cutover
   - verify gate se tap trung vao ECUS preview/commit, alerts config/review, C/O discrepancy, va declaration history/edit
11. `cng-0fs` da duoc implementation o muc rollout status + test gate:
   - them `server-v4/src/app/declarationsShadowRollout.ts` de tong hop 4 declaration shadow groups: ECUS preview/commit, alerts config/review, C/O discrepancy, va declaration history/edit parity
   - `/api/v4/meta/rollout` hien bo sung `compatibility.declarationShadow` va them declaration-specific migration checks, de operator biet ro nhom nao dang xanh, nhom nao van con legacy compat hits
   - rollout tests da khoa pass-path khi khong co legacy hits va warn-path khi route migrated van bi goi qua compat layer
   - app-shell/legacy-compat fixtures da duoc lam ben vung hon, khong con phu thuoc vao file sqlite mac dinh ton tai trong worktree
12. `cng-2wn` da duoc implementation o muc declarations cutover policy:
   - them `server-v4/src/app/declarationsWriteCutover.ts` de tong hop readiness rieng cho declarations write cutover, tach biet shadow parity voi cutover readiness thuc su
   - `/api/v4/meta/rollout` hien bo sung `compatibility.declarationCutover` va migration check `declarations-write-cutover-policy`, dua tren guard mode, migrated compat hits, va declaration shadow gate health
   - readiness/stage `cutover-ready` khong con len xanh chi vi runtime da relational-store; declarations phai co `block-migrated` + zero migrated compat hits + shadow gate xanh moi duoc xem la ready
   - them regression test moi `tests/server-v4/declarationsWriteCutover.test.js` va cap nhat `v4RolloutStatus`/`appShell` expectations cho hold/ready/blocked transitions
13. `cng-7wv` da duoc implementation o muc runtime config wiring:
   - `server-v4/src/config/server-v4-config.ts` hien co field chinh thuc `importerCompatGuardMode` va validate hai mode `off` / `block-migrated`
   - `buildV4App` fallback sang runtime config khi caller khong truyen `options.importerCompat.guardMode`, nen block mode co the bat qua config thay vi patch tracker thu cong
   - `apps/api/src/startApiServer.js` forward top-level `importerCompatGuardMode` xuong compiled `server-v4`, dong bo voi env `KPI_API_IMPORTER_COMPAT_GUARD_MODE`
   - regression tests da khoa ca config env/apps-api path va route behavior path cho `off` vs `block-migrated`
14. `cng-xyq.4` da duoc implementation o muc decomposition planning:
   - them artifact goc `frontend-wave1-decomposition.md` tai project root de chot wave-1 backlog cho `MSTAssignment`, `KPIAdjustments`, `AiAssistant`, va `RulesEditor`
   - chot thu tu tach nho an toan theo huong `pure/presentational truoc, hooks/panel stateful sau`
   - xac dinh ro gap test hien tai: `RulesEditor` chua co test truc tiep, can dat baseline test truoc khi rut component
   - seed them 4 bead follow-up de backlog khong dung o muc tai lieu:
     - `cng-xyq.8` MSTAssignment helper + layout decomposition
     - `cng-xyq.9` KPIAdjustments pure calculation + form hook decomposition
     - `cng-xyq.10` AiAssistant snapshot/provider/history helper decomposition
     - `cng-xyq.11` RulesEditor baseline test + panel decomposition
15. `cng-xyq.8` da duoc implementation o muc helper extraction:
   - tach `HistoryDetails`, `StageTimelinePreview`, `StageTimelineGroups`, va `ColumnResizeHandle` ra khoi `src/components/MSTAssignment.jsx` thanh module rieng duoi `src/components/mst-assignment/`
   - `MSTAssignment.jsx` giam tu moc backlog 3170 dong xuong 2973 dong sau helper extraction
   - targeted verify da pass:
     - `pnpm exec vitest run tests/mstAssignment.timeline.test.jsx tests/mstAssignment.column-widths.test.jsx tests/mstAssignment.column-visibility.test.jsx tests/mstAssignment.pagination.test.jsx --environment jsdom`
     - `pnpm exec eslint src/components/MSTAssignment.jsx src/components/mst-assignment/timeline/HistoryDetails.jsx src/components/mst-assignment/timeline/StageTimelinePreview.jsx src/components/mst-assignment/timeline/StageTimelineGroups.jsx src/components/mst-assignment/table/ColumnResizeHandle.jsx`
   - tach them bead `cng-xyq.12` de xu ly phan con lai cua MSTAssignment state/layout hook ma khong lam bead helper extraction bi qua to
16. `cng-xyq.12` da duoc implementation o muc state/layout hook extraction:
   - them `src/components/mst-assignment/hooks/useMSTAssignmentColumnLayout.js` de gom `COLUMN_OPTIONS`, width persistence, visibility persistence, resize handlers, va `columnMenuOpen`
   - them `src/components/mst-assignment/hooks/useMSTAssignmentPageSize.js` de tach `pageSize` read/write helpers khoi `MSTAssignment.jsx`
   - `src/components/MSTAssignment.jsx` da chuyen sang dung 2 hook moi thay vi giu localStorage + resize state trong component chinh
   - bo sung `tests/mstAssignment.layout-hooks.test.jsx` de khoa hook moi, va doi test width/visibility/pagination sang import helper truc tiep tu module moi
   - add-form MST bo sung `ariaLabel`/`searchAriaLabel` cho 2 combobox nhap/xuat de giu gate `tests/e2e.admin-flows.test.jsx` xanh
   - targeted verify da pass:
     - `pnpm exec vitest run tests/mstAssignment.column-widths.test.jsx tests/mstAssignment.column-visibility.test.jsx tests/mstAssignment.pagination.test.jsx tests/mstAssignment.layout-hooks.test.jsx --environment jsdom`
     - `pnpm exec vitest run tests/mstAssignment.person-columns.test.jsx tests/e2e.admin-flows.test.jsx --environment jsdom`
     - `pnpm exec eslint src/components/MSTAssignment.jsx src/components/mst-assignment/hooks/useMSTAssignmentColumnLayout.js src/components/mst-assignment/hooks/useMSTAssignmentPageSize.js tests/mstAssignment.column-widths.test.jsx tests/mstAssignment.column-visibility.test.jsx tests/mstAssignment.pagination.test.jsx tests/mstAssignment.layout-hooks.test.jsx`

## Next Suggested Slice

- Title: Tach helper snapshot/provider/history khoi AiAssistant
- Bead: `cng-xyq.10`
- Status: ready
- Follow-up backlog seeded:
  - `cng-xyq.11` -> RulesEditor baseline tests + control/panel split
  - `cng-xyq.12` -> MSTAssignment state/layout hooks (closed)

## Verification

- Node tests:
  - `pnpm exec vitest run tests/passwordPolicy.test.js tests/securityHardening.test.js --environment node`
  - `pnpm exec vitest run tests/v4RolloutMount.test.js tests/server.monitor.test.js tests/server-v4/appShell.test.js tests/server-v4/legacyCompatRoutes.test.js tests/server-v4/postgresTeamsRoute.test.js tests/server-v4/postgresMstAssignmentsRoute.test.js tests/server-v4/postgresHqAgenciesRoute.test.js --environment node`
  - `pnpm exec vitest run tests/v4RolloutMount.test.js tests/server.monitor.test.js tests/server-v4/appShell.test.js tests/server-v4/legacyCompatRoutes.test.js tests/server-v4/postgresKpiRulesRoute.test.js tests/server-v4/postgresKpiAdjustmentsRoute.test.js --environment node`
  - `pnpm exec vitest run tests/server-v4/authRoutes.test.js tests/server-v4/legacyCompatRoutes.test.js tests/server-v4/appShell.test.js tests/server-v4/runtimeRoutes.test.js --environment node`
  - `pnpm exec vitest run tests/server-v4/v4RolloutStatus.test.js tests/server-v4/appShell.test.js tests/server-v4/legacyCompatRoutes.test.js tests/server-v4/postgresDeclarationsRoute.test.js --environment node`
  - `pnpm exec vitest run tests/server-v4/declarationsWriteCutover.test.js tests/server-v4/v4RolloutStatus.test.js tests/server-v4/appShell.test.js --environment node`
  - `pnpm exec vitest run tests/appsApiRuntimeConfig.test.js tests/apps/apiRuntimeConfig.test.js tests/appsApiStart.test.js tests/server-v4/appShell.test.js tests/server-v4/legacyCompatRoutes.test.js --environment node`
- Frontend/jsdom tests:
  - `pnpm exec vitest run tests/auth.test.jsx tests/accountManager.staff.test.jsx tests/automation.flows.test.js tests/e2e.admin-flows.test.jsx --environment jsdom`
  - `pnpm exec vitest run tests/runtimeErrorBoundary.test.jsx tests/appRoot.errorBoundary.test.jsx tests/kpiCalculator.errorBoundary.test.jsx tests/appShellFrame.test.jsx --environment jsdom`
  - `pnpm exec vitest run tests/staffCombobox.test.jsx tests/dataImporterAssignmentComboboxes.test.jsx tests/accountManager.staff.test.jsx tests/mstAssignment.person-columns.test.jsx`
- Targeted lint:
  - `pnpm exec eslint server/index.js server/v4RolloutMount.js tests/v4RolloutMount.test.js`
  - `pnpm exec eslint server/index.js server/securityHardening.js packages/domain/src/passwordPolicy.js src/auth/localAuth.js src/components/ChangePasswordDialog.jsx src/components/AccountManager.jsx tests/passwordPolicy.test.js tests/securityHardening.test.js tests/helpers/mockApi.js tests/helpers/mockApiState.js tests/automation.flows.test.js tests/e2e.admin-flows.test.jsx tests/playwright/account-management.spec.js`
  - `pnpm exec eslint src/main.jsx src/AppRoot.jsx src/components/errorBoundaries/RuntimeErrorBoundary.jsx src/components/KPICalculator.jsx tests/runtimeErrorBoundary.test.jsx tests/appRoot.errorBoundary.test.jsx tests/kpiCalculator.errorBoundary.test.jsx`
  - `pnpm exec eslint src/components/shared/StaffCombobox.jsx src/components/dataImporter/DataImporterAssignmentComboboxes.jsx src/components/AccountManager.jsx tests/accountManager.staff.test.jsx tests/staffCombobox.test.jsx`
  - `pnpm exec eslint server-v4/src/app/declarationsShadowRollout.ts server-v4/src/app/v4-rollout-status.ts tests/server-v4/v4RolloutStatus.test.js tests/server-v4/appShell.test.js tests/server-v4/legacyCompatRoutes.test.js`
  - `pnpm exec eslint server-v4/src/app/declarationsWriteCutover.ts server-v4/src/app/v4-rollout-status.ts tests/server-v4/declarationsWriteCutover.test.js tests/server-v4/v4RolloutStatus.test.js tests/server-v4/appShell.test.js`
  - `pnpm exec eslint apps/api/src/startApiServer.js server-v4/src/config/server-v4-config.ts server-v4/src/app/build-v4-app.ts tests/appsApiRuntimeConfig.test.js tests/appsApiStart.test.js tests/apps/apiRuntimeConfig.test.js tests/server-v4/appShell.test.js tests/server-v4/legacyCompatRoutes.test.js`
- GitNexus scope check:
  - `detect_changes(scope: "all")` -> `risk_level: low`
  - `detect_changes(scope: "all")` sau `cng-xyq.2` -> `risk_level: high` do diff cham 2 file lon (`AccountManager.jsx`, `MSTAssignment.jsx`), nhung 4 test muc tieu cua shared combobox/account/importer/mst deu pass
18. `cng-xyq.10` da xong o muc tach helper `AiAssistant`:
   - them `src/components/ai-assistant/snapshotCache.js`, `src/components/ai-assistant/providerConfig.js`, va `src/components/ai-assistant/historyStore.js`
   - `src/components/AiAssistant.jsx` gio chi con orchestration/state/render, khong con giu inline snapshot cache, provider draft/health helpers, va local history store
   - bo sung regression tests `tests/aiAssistant.snapshotCache.test.js`, `tests/aiAssistant.providerHelpers.test.js`, `tests/aiAssistant.historyStore.test.js`; `tests/aiAssistant.config.test.jsx` van pass nhu smoke test cho panel config
   - targeted verify da pass:
     - `pnpm exec vitest run tests/aiAssistant.config.test.jsx tests/aiAssistant.snapshotCache.test.js tests/aiAssistant.providerHelpers.test.js tests/aiAssistant.historyStore.test.js --environment jsdom`
     - `pnpm exec eslint src/components/AiAssistant.jsx src/components/ai-assistant/snapshotCache.js src/components/ai-assistant/providerConfig.js src/components/ai-assistant/historyStore.js tests/aiAssistant.config.test.jsx tests/aiAssistant.snapshotCache.test.js tests/aiAssistant.providerHelpers.test.js tests/aiAssistant.historyStore.test.js`
19. `cng-xyq.11` da xong o muc baseline test + tach panel `RulesEditor`:
   - them `src/components/rules-editor/RulesSimulationPanel.jsx` va `src/components/rules-editor/RulesHistoryPanel.jsx`, rut 2 block JSX lon khoi `src/components/RulesEditor.jsx`
   - bo sung regression tests `tests/rulesEditor.test.jsx`, `tests/rulesEditorSimulationPanel.test.jsx`, va `tests/rulesEditorHistoryPanel.test.jsx`
   - flow da duoc khoa bang test: mo phong KPI, refresh lich su, expand chi tiet, va khoi phuc phien ban lich su
   - targeted verify da pass:
     - `pnpm exec vitest run tests/rulesEditor.test.jsx tests/rulesEditorSimulationPanel.test.jsx tests/rulesEditorHistoryPanel.test.jsx --environment jsdom`
     - `pnpm exec eslint src/components/RulesEditor.jsx src/components/rules-editor/RulesSimulationPanel.jsx src/components/rules-editor/RulesHistoryPanel.jsx tests/rulesEditor.test.jsx tests/rulesEditorSimulationPanel.test.jsx tests/rulesEditorHistoryPanel.test.jsx`
20. `cng-xyq.13` da xong o muc tach control inline khoi `RulesEditor`:
   - them `src/components/rules-editor/controls/RuleNumberInput.jsx`, `TierEditor.jsx`, `CodeMultiSelect.jsx`, `LicenseCodeInput.jsx`, `AgencyInput.jsx`, `LicensePointTable.jsx`, va `AgencyExcludeEditor.jsx`
   - `src/components/RulesEditor.jsx` giam tiep tu 1625 dong xuong 1143 dong sau khi rut controls va input so dung chung
   - bo sung regression test moi `tests/rulesEditor.controls.test.jsx` de khoa chon/bo chon ma, uppercase code, them bac, them dong ma giay phep, va dai ly loai tru
   - targeted verify da pass:
     - `pnpm exec vitest run tests/rulesEditor.test.jsx tests/rulesEditorSimulationPanel.test.jsx tests/rulesEditorHistoryPanel.test.jsx tests/rulesEditor.controls.test.jsx --environment jsdom`
     - `pnpm exec eslint src/components/RulesEditor.jsx src/components/rules-editor/RulesSimulationPanel.jsx src/components/rules-editor/RulesHistoryPanel.jsx src/components/rules-editor/controls/RuleNumberInput.jsx src/components/rules-editor/controls/TierEditor.jsx src/components/rules-editor/controls/CodeMultiSelect.jsx src/components/rules-editor/controls/LicenseCodeInput.jsx src/components/rules-editor/controls/AgencyInput.jsx src/components/rules-editor/controls/LicensePointTable.jsx src/components/rules-editor/controls/AgencyExcludeEditor.jsx tests/rulesEditor.test.jsx tests/rulesEditorSimulationPanel.test.jsx tests/rulesEditorHistoryPanel.test.jsx tests/rulesEditor.controls.test.jsx`

## Notes

- GitNexus impact/context dang bi lock file `.gitnexus/lbug` do session `gitnexus serve`; tam thoi da fallback sang caller grep de scope edit an toan.
- Working tree hien co thay doi chua commit cho `cng-xyq.7`; `cng-xyq.5` da duoc commit thanh rollout-plan artifact rieng.
- `package.json` da co script `gitnexus:serve` tu thay doi truoc do; phien nay bo sung them dependency `helmet` va `express-rate-limit`.
- `cng-9dx` chi dong bo tai lieu/notebook, khong thay doi runtime code.
- `cng-xyq.3` khong doi logic nghiep vu; chi tang guardrail de app shell va tung module co fallback ro rang khi render/runtime error xay ra.
- `cng-xyq.2` co working tree chua commit. Shared component moi da co test rieng; lint con 2 warning `react-refresh/only-export-components` do file export helper thuần.
- `cng-xyq.5` draft plan hien de xuat thu tu rollout:
  - wave 0: rollout instrumentation
  - wave 1: `teams` + `mst-assignments` + `hq-agencies`
  - wave 2: `kpi-rules` + `kpi-adjustments`
  - wave 3: auth parity closure
  - wave 4-5: declarations shadow rollout va write cutover
- `cng-xyq.7` hien chi doi logic mount tren legacy server; khong doi `buildV4App` hay router internals ben trong `server-v4`.
- `cng-xyq.7` da hoan tat va dong bead; working tree hien chi chua commit thay doi wave-1 mount truoc khi bat dau wave-2.
- `cng-wh8` la bead tiep theo cho wave-2 mount `kpi-rules` + `kpi-adjustments`.
- `cng-wh8` da pass targeted lint + node verification cho startup mount helper, `server.monitor`, `appShell`, legacy compat, `postgresKpiRulesRoute`, va `postgresKpiAdjustmentsRoute`.
- `cng-wh8` da hoan tat va dong bead; wave-2 mount da duoc chot thanh commit rieng.
- `cng-d0a` la bead active tiep theo cho auth parity closure truoc declarations rollout.
- `cng-d0a` da hoan tat va dong bead; auth parity canonical da pass targeted lint + node verification.
- `cng-0fs` la bead tiep theo cho declarations shadow rollout va compat telemetry gate.
- `cng-0fs` da xong o muc code/test trong worktree hien tai va bead da duoc close qua WSL + `BEADS_DIR=/mnt/e/GPT/kpi_source_code_v4/.beads`.
- `compatibility.declarationShadow` hien group cac gate declarations theo 4 nhom nghiep vu; neu bat ky legacy compat route nao con co hit thi nhom lien quan se chuyen `warn`, giup operator triage truoc write cutover.
- `gitnexus_detect_changes(scope: "all")` tra ve `No changes detected` du `git status` van co diff; can kiem tra lai GitNexus/worktree awareness truoc luc dung no lam gate cho commit cua bead nay.
- Remaining write-cutover risk sau `cng-0fs`: legacy aliases declarations van con song va duoc mount trong compat layer; can co quyet dinh rieng cho block mode/cutover sequence truoc khi dong bead write-cutover.
- `cng-2wn` da xong o muc code/test va bead da duoc dong; rollout metadata gio tach rieng declaration shadow gate va declaration write-cutover policy, nen operator thay ro khi nao shadow xanh nhung cutover van phai hold vi guard mode/hit counter.
- `cng-7wv` da duoc hoan tat: env `KPI_API_IMPORTER_COMPAT_GUARD_MODE` trong `apps/api` gio di het duong xuong `server-v4` qua top-level runtime config, va `buildV4App` cung fallback ve config nay khi khong co override tracker rieng.
- bead ready tiep theo theo `bd ready` sau khi dong planning la `cng-xyq.8` cho MSTAssignment helper + layout decomposition; day la slice an toan nhat de mo dau wave-1 implementation.
- `frontend-wave1-decomposition.md` la artifact root-level chot danh sach module dich, thu tu tach nho, va test gate cho 4 frontend fat component lon nhat.
- `cng-xyq.4` da xong o muc planning/backlog; 4 child bead moi (`cng-xyq.8` -> `cng-xyq.11`) da duoc tao de chuyen ngay sang implementation slices nho.
- `cng-xyq.8` da xong o muc tach helper UI; phan state/layout hook cua MSTAssignment da duoc tach thanh bead rieng `cng-xyq.12` de giu moi bead gon va de verify.
- `cng-xyq.12` da xong o muc tach hook state/layout cho `MSTAssignment`.
- `cng-xyq.9` da xong o muc tach pure model + form/filter hooks cho `KPIAdjustments`: them `src/components/kpi-adjustments/model/*`, `src/components/kpi-adjustments/hooks/*`, rut logic trung lap khoi file chinh, va bo sung `tests/kpiAdjustments.model.test.js` + `tests/kpiAdjustments.hooks.test.jsx`.
- targeted verify cho `cng-xyq.9` da pass:
  - `pnpm exec vitest run tests/kpiAdjustments.test.jsx tests/kpiAdjustments.model.test.js tests/kpiAdjustments.hooks.test.jsx --environment jsdom`
  - `pnpm exec eslint src/components/KPIAdjustments.jsx src/components/kpi-adjustments/model/businessDirectory.js src/components/kpi-adjustments/model/calculationInfo.js src/components/kpi-adjustments/model/guidanceGroups.js src/components/kpi-adjustments/model/settingsDraft.js src/components/kpi-adjustments/hooks/useKpiAdjustmentForm.js src/components/kpi-adjustments/hooks/useKpiAdjustmentFilters.js tests/kpiAdjustments.test.jsx tests/kpiAdjustments.model.test.js tests/kpiAdjustments.hooks.test.jsx`
- `cng-xyq.10` la slice wave-1 hop ly nhat tiep theo de tach snapshot/provider/history helper khoi `AiAssistant`.
- `cng-xyq.10` da hoan tat o muc helper extraction cho `AiAssistant`; buoc tiep theo trong wave-1 la `cng-xyq.11` de dat baseline test va tach panel khoi `RulesEditor`.
- `cng-xyq.11` da hoan tat o muc panel decomposition cho `RulesEditor`; phan con lai hop ly nhat neu tiep tuc wave-1 la tach cac control/editor nho va co the seed them bead rieng cho RulesEditor slice tiep theo.
- `cng-xyq.13` da hoan tat; `RulesEditor` hien da tach xong panel + control co san, phan con lai neu muon giam them coupling se la config-tab/orchestration layer, nhung wave-1 backlog con bead pending hop ly hon la `AiAssistant` slice B.
- `cng-xyq.14` da hoan tat; `AiAssistant` hien da tach panel `config/history/chat`, `AiAssistantStatusSidebar`, va hook `useAiAssistantConfig` / `useAiConversation` ra khoi `src/components/AiAssistant.jsx`, trong khi file goc giu lai orchestration snapshot/insight/history flow.
- verify `cng-xyq.14`:
  - `pnpm exec vitest run tests/aiAssistant.config.test.jsx tests/aiAssistant.panels.test.jsx tests/useAiConversation.test.jsx tests/useAiAssistantConfig.test.jsx --environment jsdom`
  - `pnpm exec eslint src/components/AiAssistant.jsx src/components/ai-assistant/hooks/useAiConversation.js src/components/ai-assistant/hooks/useAiAssistantConfig.js src/components/ai-assistant/panels/AiAssistantChatPanel.jsx src/components/ai-assistant/panels/AiAssistantHistoryPanel.jsx src/components/ai-assistant/panels/AiAssistantStatusSidebar.jsx src/components/ai-assistant/panels/AiAssistantConfigPanel.jsx tests/aiAssistant.panels.test.jsx tests/useAiConversation.test.jsx tests/useAiAssistantConfig.test.jsx`
- epic `cng-xyq` da du dieu kien dong: tat ca child task rollout/server-v4, security hardening, checklist verification, va 4 slice refactor frontend wave-1 deu da closed.
- `gitnexus_detect_changes(scope: "all")` van tra `No changes detected` ngay ca sau helper extraction, nen tiep tuc coi day la van de worktree-awareness cua GitNexus; gate thuc te van dua tren `git status`, lint, va test muc tieu.
- `tests/server.monitor.test.js` van in stderr khi `dist/server-v4/index.js` khong co trong vitest runtime, nhung suite van pass vi startup path fallback dung nhu hien trang.

## Previous Completed Slice

- `cng-4fo` — Fact-check Gemini review V1 va seed backlog follow-up
- `cng-bik` — Bo sung test cho canh bao disk error trong healthcheck
