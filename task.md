# Task Tracker

## Canonical Open Backlog

- Source of truth cho tat ca viec chua xong hien tai la `docs/open-backlog.md`.
- Da reconcile ngay 2026-03-31 voi `PLAN.md` big-bang, `docs/api-contract-v4-migration-plan.md`, `docs/server-v4-rollout-plan-2026-03-25.md`, va bead database.
- Open epics hien tai:
  - `cng-mbu` (Big-bang FE+BE redesign 6-8 week execution).
- Highest-priority ready items hien tai:
  - `cng-mbu.3` (in_progress): W3-5 Frontend Redesign Canonical Client.

## Active Slice

-- Title: W3-5 Frontend Redesign Canonical Client
-- Bead: cng-mbu.3
-- Status: in_progress
-- Last updated: 2026-03-31

- Scope da lam trong slice hien tai:
  - da dong `cng-mbu.2` voi day du lane backend modularization W2-3 (data-health, duplicate-policy, filter-presets, feedback-training, rules-history, reports-export, notifications parity)
  - da cap nhat canonical metadata routing/runtime bridge cho `rules-history` + `reports-export` trong `server-v4` va `server/index.js`
  - da bo sung regression `tests/server-v4/kpiRulesHistoryRoutes.test.js` va `tests/server-v4/reportingExportRoutes.test.js`
  - da chuyen active bead sang `cng-mbu.3` de tiep tuc week 3-5 frontend redesign
  - da ship slice dau frontend canonicalization cho lanes `data-health`, `duplicate-policy`, `filter-presets`, `feedback-training`: caller o `DataHealthDashboard`, `useFilterPresets`, `feedbackClient` da chuyen sang `/api/v4/*` route constants
  - da cap nhat demo routing fallback cho canonical feedback/data-health/policy route trong `src/demo/demoMode.js`
  - da cap nhat regression `tests/apiRoutes.test.js`, `tests/dataHealthDashboard.test.jsx`, `tests/dataImporter.preview.test.jsx`

## Handoff

- Done: dat "control tower" cho plan big-bang de khong mat context khi doi tai khoan/phien (bead `cng-mbu.8` da close).
- Verify:
  - `bd ready --json` (mo lai `cng-mbu` + child beads)
  - `bd dep add ...` (dependency graph lane tuan)
  - `pnpm run api:contract:report` (baseline canonical=27, legacy=22)
  - `pnpm bd:check` (nhat quan task.md/open-backlog/BD)
- Risk: neu khong duy tri 3 nguon truth (`bd`, `task.md`, `docs/big-bang-execution-status.md`) thi se lap lai tinh trang "epic dong som" du plan chua xong.
- Decision: tu gio theo doi tien do big-bang bang epic `cng-mbu` va board `docs/big-bang-execution-status.md`; moi lane tuan bat buoc co bead + gate + evidence.
- Decision tiep theo (owner request): giam tan suat commit, gom theo lane/slice lon (khong commit moi thay doi nho).
- Next: tiep tuc slice ke tiep cua `cng-mbu.3` cho `rules-history` + `reports-export/audit` frontend clients sang route canonical `/api/v4/reporting/*` va `/api/v4/rules/history`.
## Recent Completed Slices

- `cng-7z0.30` da hoan tat storage sync error hardening:
  - them `src/lib/storageSyncErrors.js` de chuan hoa sync error (`code`, `message`, `hint`, `retryable`) cho network/offline/auth/http status
  - `src/lib/storageClient.js` bo sung sync error state (`lastErrorCode`, `lastErrorHint`, `lastErrorRetryable`, `lastRollback`) va rollback logic giu pending value moi nhat neu fail xay ra khi write cu dang in-flight
  - `scheduleRetry` nay chi retry khi loi retryable; loi non-retryable (vd `payload_too_large`, auth denied) khong lap retry timer
  - bo sung `tests/storageSyncErrors.test.js` va mo rong `tests/storageClient.test.js` de khoa cac contract moi
  - targeted verify da pass:
    - `pnpm exec eslint src/lib/storageClient.js src/lib/storageSyncErrors.js tests/storageClient.test.js tests/storageSyncErrors.test.js`
    - `pnpm exec vitest run tests/storageClient.test.js tests/storageSyncErrors.test.js`
    - `pnpm exec vitest run tests/store.test.js tests/useDataImporterSyncStatusToast.test.jsx tests/commandCenter.pinStorage.test.js`
- `cng-2k4.6` da hoan tat o muc tach alerts + notifications backend:
  - them `server-v4/src/modules/alerts/alertsLegacyDomain.js` de gom alert config/state persistence, review/unreview mutate flow, evaluate declaration alerts, va payload formatter/builders qua dependency injection
  - `server/index.js` nay chi con wiring domain (`createLegacyAlertsDomain`) va route registration (`registerLegacyNotificationRoutes`, `registerLegacyImportAlertRoutes`) thay vi giu khoi alert functions lon
  - bo sung regression `tests/server.alertLegacyDomain.test.js` va giu xanh `tests/server.alertLegacyRoutes.test.js`
  - targeted verify da pass:
    - `pnpm exec eslint server/index.js server-v4/src/modules/alerts/alertsLegacyDomain.js tests/server.alertLegacyDomain.test.js tests/server.alertLegacyRoutes.test.js tests/server.api.test.js`
    - `pnpm exec vitest run tests/server.alertLegacyDomain.test.js tests/server.alertLegacyRoutes.test.js --environment node`
    - `pnpm exec vitest run tests/server.api.test.js tests/server-v4/runtimeRoutes.test.js tests/server-v4/alertsRoutes.test.js --environment node`
- `cng-2k4.5` da xong o muc tach AI assistant backend module:
  - them `server-v4/src/modules/ai/ai.constants.js`, `server-v4/src/modules/ai/aiChatHistoryStore.js`, va `server-v4/src/modules/ai/aiLegacyRoutes.js` de gom constants + chat history + legacy `/api/ai/*` handlers
  - `server/index.js` nay chi con wiring dependency va `registerAiRoutes(app, deps)` thay vi giu mot khoi route lon, dong thoi giu nguyen route khong lien quan (`/api/rules/history`)
  - bo sung regression `tests/server.aiModules.test.js` (chat history store + route wiring) va cap nhat `tests/server.api.test.js` cho case tao tai khoan khong co quyen `aiAssistUse`
  - targeted verify da pass:
    - `pnpm exec eslint server/index.js server-v4/src/modules/ai/*.js tests/server.aiModules.test.js tests/server.api.test.js`
    - `pnpm exec vitest run tests/server.aiModules.test.js --environment node`
    - `pnpm exec vitest run tests/server.api.test.js --environment node -t "AI assistant API"`
- `cng-7z0.7` da xong o muc backend-detached ECUS sync queue:
  - them `server-v4/src/modules/declarations/declarationsImportJobService.ts` de tao/poll async ECUS commit jobs (`queued/running/completed/failed`) va gioi han memory retention cho job history trong runtime
  - `DeclarationsController` + `declarationsRoutes` them flow `POST /api/v4/declarations/imports/ecus-commit` voi payload `async: true` va endpoint poll `GET /api/v4/declarations/imports/ecus-jobs/:jobId`
  - `useDataImporterSync.js` + `dataImporterSyncQueue.js` luu `backendJobId/backendJobStatus`, poll job backend khi run/resume, va chi re-submit commit khi job cu khong con ton tai tren server
  - bo sung/refresh regression trong `tests/server-v4/postgresDeclarationsRoute.test.js` va `tests/useDataImporterSync.test.jsx`; cap nhat `server-v4/src/app/legacyCompatRoutes.ts` de inject day du `DeclarationsImportJobService` cho legacy importer aliases
  - targeted verify da pass:
    - `pnpm exec vitest run tests/useDataImporterSync.test.jsx tests/server-v4/postgresDeclarationsRoute.test.js`
    - `pnpm exec eslint server-v4/src/modules/declarations/DeclarationsController.ts server-v4/src/modules/declarations/declarationsRoutes.ts server-v4/src/modules/declarations/declarations.module.ts server-v4/src/modules/declarations/declarationsImportJobService.ts server-v4/src/app/legacyCompatRoutes.ts src/components/dataImporter/dataImporterSyncQueue.js src/components/dataImporter/useDataImporterSync.js tests/server-v4/postgresDeclarationsRoute.test.js tests/useDataImporterSync.test.jsx`
- `cng-7z0.23` da hoan tat permission-aware global search lane:
  - `src/components/CommandCenter.jsx` nay them shortcut report workflow (`scope`, `dashboard`, `export`) va goi y `Người dùng: ...` khi tai khoan co quyen `accountManage`
  - module search tiep tuc dua tren `getVisibleAppTabs(currentUser)` nen khong can sua app-shell navigation definitions co blast radius MEDIUM
  - regression `tests/commandCenter.test.jsx` da khoa hai contract moi: report-focus navigation va user suggestion theo quyen
  - targeted verify da pass:
    - `pnpm exec vitest run tests/commandCenter.test.jsx tests/commandCenter.pinStorage.test.js tests/storageClient.test.js --environment jsdom`
    - `pnpm exec eslint src/components/CommandCenter.jsx tests/commandCenter.test.jsx tests/commandCenter.pinStorage.test.js tests/storageClient.test.js`
- `cng-7z0.25` da hoan tat contextual quick-help lane:
  - them `src/components/support/supportContextCatalog.js` va `src/components/support/SupportContextPanel.jsx` de map tab hien tai sang FAQ, tai lieu `docs/`, va tai nguyen dao tao de xuat
  - `src/components/SupportCenter.jsx` nay nhan `currentTabId`, ho tro `open:support` payload override context, va hien CTA sao chep duong dan tai lieu noi bo thay vi tao runtime link chet cho `docs/`
  - `src/App.jsx` truyen `activeTab` vao `SupportCenter`, bo sung regression `tests/supportCenter.context.test.jsx`, `tests/supportContextCatalog.test.js`, va giu xanh `tests/accessibility.test.jsx`
  - targeted verify da pass:
    - `pnpm exec vitest run tests/accessibility.test.jsx tests/supportCenter.context.test.jsx tests/supportContextCatalog.test.js --environment jsdom`
    - `pnpm exec eslint src/components/SupportCenter.jsx src/components/support/SupportContextPanel.jsx src/components/support/supportContextCatalog.js src/App.jsx tests/accessibility.test.jsx tests/supportCenter.context.test.jsx tests/supportContextCatalog.test.js`
- `cng-2k4.22` da hoan tat text/lint hygiene lane:
  - them `* text=auto` vao `.gitattributes` de git xu ly line endings thay vi de lint/noise can thiep
  - full `pnpm lint` hien xanh sau cac backlog refactors, khong con can giu bead hygiene mo chi de theo doi warning cu
- `cng-7z0.22` da hoan tat backend-synced Command Center pin lane:
  - `server-v4/src/app/legacy-compat/legacyCompatShared.ts` + `legacyCompatStorageRoutes.ts` nay doc/ghi `kpi_command_center_pins_v1` qua `persistence.projections`, giu response shape tuong thich voi compat storage API
  - `src/lib/storageClient.js`, `src/components/command-center/pinStorage.js`, va `src/components/CommandCenter.jsx` nay hydrate/subscribe/write pin state qua shared storage va fallback local storage
  - bo sung regression `tests/server-v4/legacyCompatRoutes.test.js`, `tests/commandCenter.pinStorage.test.js`, `tests/commandCenter.test.jsx`, va `tests/storageClient.test.js`
  - targeted verify da pass:
    - `pnpm exec vitest run tests/server-v4/legacyCompatRoutes.test.js --environment node`
    - `pnpm exec vitest run tests/commandCenter.pinStorage.test.js tests/commandCenter.test.jsx tests/storageClient.test.js --environment jsdom`
    - `pnpm exec eslint server-v4/src/app/legacy-compat/legacyCompatShared.ts server-v4/src/app/legacy-compat/legacyCompatStorageRoutes.ts src/components/CommandCenter.jsx src/components/command-center/pinStorage.js src/lib/storageClient.js tests/server-v4/legacyCompatRoutes.test.js tests/commandCenter.pinStorage.test.js tests/commandCenter.test.jsx tests/storageClient.test.js`
- `cng-7z0.24` da hoan tat unread notification lane:
  - `src/components/NotificationCenter.jsx` khong con auto-clear unread khi mo panel; unread badge chi ve 0 khi operator chu dong bam `Đánh dấu tất cả đã đọc`
  - them CTA bulk clear trong header panel va badge `Mới` tren event chua doc de phan biet ro muc vua den truoc khi triage
  - targeted verify da pass:
    - `pnpm exec eslint src/components/NotificationCenter.jsx tests/notificationCenter.test.jsx`
    - `pnpm exec vitest run tests/notificationCenter.test.jsx --environment jsdom`
- `cng-7z0.17` da hoan tat duplicate-detection lane cho MST assignment:
  - `src/components/mst-assignment/model/displaySelectors.js` nay sinh `conflictSummary` cho moi MST co nhieu giai doan dang cung hieu luc, gom active-stage count, assignee/team divergence, va goi y xu ly `giu / chuyen / tach vai tro`
  - `src/components/mst-assignment/table/MstAssignmentDataTablePanel.jsx` surfacing badge `Trung gan` tren bang, canh bao inline cho tung dong, va danh sach goi y xu ly nhanh tren group row de truong nhom chot thao tac ngay
  - targeted verify da pass:
    - `pnpm exec vitest run tests/mstAssignment.displaySelectors.test.js tests/mstAssignmentDataTablePanel.test.jsx tests/useMSTAssignmentHistoryWorkspace.test.jsx tests/mstAssignmentHistoryFilterPanel.test.jsx --environment jsdom`
    - `pnpm exec eslint src/components/mst-assignment/model/displaySelectors.js src/components/mst-assignment/table/MstAssignmentDataTablePanel.jsx src/components/mst-assignment/hooks/useMSTAssignmentHistoryWorkspace.js src/components/mst-assignment/filters/MstAssignmentHistoryFilterPanel.jsx tests/mstAssignment.displaySelectors.test.js tests/mstAssignmentDataTablePanel.test.jsx tests/useMSTAssignmentHistoryWorkspace.test.jsx tests/mstAssignmentHistoryFilterPanel.test.jsx`
- `cng-7z0.18` da hoan tat filtered-history lane cho MST assignment:
  - `useMSTAssignmentHistoryWorkspace.js` nay loc `filteredHistoryEntries` theo su kien lich su thuc te cho create/update/delete va mốc chuyen trang thai `status:assigned/pending`, dong thoi `historyFilteredRowKeys` cung ap dung cho cac filter nay thay vi chi co action thuần
  - `MstAssignmentHistoryFilterPanel.jsx` doi copy thanh `Thao tac / Chuyen trang thai` de khop voi nghia moi cua timeline filter va quick favorite messaging cho status transition
  - cac lane current-state va export bao cao cho truong nhom sau do da duoc ship tiep trong `cng-7z0.19`, `cng-7z0.20`, va `cng-7z0.21`
- `cng-7z0.19` da hoan tat compact lead-view lane cho MST assignment:
  - them `src/components/mst-assignment/hooks/useMSTAssignmentLeadViewWorkspace.js` de quan ly preset xem rut gon cho truong nhom, giu state `enabled/status/team` rieng voi history filter va reset page moi khi doi nhanh bo loc
  - `src/components/mst-assignment/filters/MstAssignmentStaffFilterPanel.jsx` nay co khu `Lead-view rút gọn` voi toggle, quick filters `Tất cả / Đã gán đủ / Chờ gán`, va combobox team; `src/components/MSTAssignment.jsx` tu dong khoa `Gom theo MST` khi lead-view bat
  - `src/components/mst-assignment/hooks/useMSTAssignmentDerivedRowsWorkspace.js` nay ap current-state filter theo assigned/pending + team ma khong dung chung `historyFilteredRowKeys`
  - targeted verify da pass:
    - `pnpm exec eslint src/components/MSTAssignment.jsx src/components/mst-assignment/hooks/useMSTAssignmentLeadViewWorkspace.js src/components/mst-assignment/hooks/useMSTAssignmentDerivedRowsWorkspace.js src/components/mst-assignment/filters/MstAssignmentStaffFilterPanel.jsx tests/mstAssignmentStaffFilterPanel.test.jsx tests/useMSTAssignmentLeadViewWorkspace.test.jsx tests/useMSTAssignmentDerivedRowsWorkspace.test.jsx`
    - `pnpm exec vitest run tests/mstAssignment.displaySelectors.test.js tests/mstAssignmentDataTablePanel.test.jsx tests/mstAssignmentHistoryFilterPanel.test.jsx tests/mstAssignmentStaffFilterPanel.test.jsx tests/useMSTAssignmentDerivedRowsWorkspace.test.jsx tests/useMSTAssignmentHistoryWorkspace.test.jsx tests/useMSTAssignmentStaffFilterWorkspace.test.jsx tests/useMSTAssignmentLeadViewWorkspace.test.jsx --environment jsdom`
- `cng-7z0.20` da hoan tat company-name validation lane cho MST assignment:
  - `src/components/mst-assignment/model/companyName.js` bo sung warning builder cho ten cong ty qua dai va ky tu nghi ngo; `src/components/mst-assignment/table/CompanyNameCell.jsx` surfacing warning inline ngay ben duoi textarea va giu nguyen sanitize + auto-resize behavior
  - `tests/mstAssignment.company-name.test.jsx` nay khoa them contract warning model/UI de tranh hoi quy khi tiep tuc tach MST assignment ra cac module nho hon
  - targeted verify da pass:
    - `pnpm exec eslint src/components/mst-assignment/model/companyName.js src/components/mst-assignment/table/CompanyNameCell.jsx tests/mstAssignment.company-name.test.jsx`
    - `pnpm exec vitest run tests/mstAssignment.company-name.test.jsx --environment jsdom`
- `cng-7z0.21` da hoan tat export metadata lane cho MST assignment:
  - them `src/components/mst-assignment/model/exportDataset.js` de dung chung export dataset tu `rows + historyEntries`, suy ra `Người gán gần nhất` va `Cập nhật gần nhất` theo `rowKey` stage thay vi chi dua vao row hien tai
  - `useMSTAssignmentExportWorkspace.js` nay ho tro ca `xlsx` va `csv` tren cung mot pipeline lazy-load `xlsx`; `MSTAssignment.jsx` surfacing day du 4 quick actions `XLSX/CSV (lọc|tất cả)` de truong nhom export ngay tu working set hien tai
  - targeted verify da pass:
    - `pnpm exec eslint src/components/MSTAssignment.jsx src/components/mst-assignment/hooks/useMSTAssignmentExportWorkspace.js src/components/mst-assignment/model/exportDataset.js tests/useMSTAssignmentExportWorkspace.test.jsx tests/mstAssignment.exportDataset.test.js`
    - `pnpm exec vitest run tests/useMSTAssignmentExportWorkspace.test.jsx tests/mstAssignment.exportDataset.test.js tests/useMSTAssignmentHistoryWorkspace.test.jsx --environment jsdom`
    - `pnpm exec vitest run tests/mstAssignmentDataTablePanel.test.jsx tests/mstAssignmentHistoryFilterPanel.test.jsx tests/mstAssignmentStaffFilterPanel.test.jsx tests/useMSTAssignmentDerivedRowsWorkspace.test.jsx tests/useMSTAssignmentExportWorkspace.test.jsx tests/useMSTAssignmentHistoryWorkspace.test.jsx tests/useMSTAssignmentLeadViewWorkspace.test.jsx tests/mstAssignment.exportDataset.test.js --environment jsdom`
- `cng-7z0.6` da xong o muc surfacing tien trinh dong bo ECUS theo tung buoc:
  - them `syncProgressSteps` trong `useDataImporterSync.js` de track 4 phase thuc te: commit ECUS, refresh config/status/alerts, refresh declaration rows, va reload danh sach hien thi
  - day state moi qua `dataImporterSyncPanelProps.js` va `DataImporterSyncConfigPanel.jsx` de UI shell khong can tu tinh lai progress
  - cap nhat `DataImporterSyncPreviewPanel.jsx` thanh stepper co badge `dang chay` / `hoan tat` / `gap loi`, giu operator thay ro buoc nao dang active va chi tiet tung buoc
  - bo sung regression `tests/useDataImporterSync.test.jsx`, `tests/dataImporterSyncPreviewPanel.test.jsx`, `tests/dataImporterSyncPanelProps.test.js`, va re-verify seam `tests/useDataImporterContainerProps.test.jsx`
- `cng-7z0.9` va `cng-7z0.10` da xong o muc checklist + retry lane cho dong bo ECUS:
  - preflight checklist hien trang thai backend, SQL Server, thong tin ket noi, va khoang ngay truoc khi cho phep chay sync/resume
  - commit phase co retry/backoff tu dong, thong bao countdown than thien, va activity log de operator thay duoc lan thu/ly do thu lai
  - persisted job snapshot giu duoc tham so actor/range/include-exclude MST va cho phep resume tren lan mo lai tiep theo
  - bo sung `tests/dataImporterSyncQueue.test.js`, cap nhat `tests/useDataImporterSync.test.jsx`, `tests/dataImporterSyncPreviewPanel.test.jsx`, `tests/dataImporterSyncPanelProps.test.js`, `tests/useDataImporterWorkflowSession.test.jsx`, va `tests/useDataImporterContainerProps.test.jsx`
- `cng-7z0.8` da xong o muc canh bao conflict truoc overwrite:
  - `useDataImporterSync.js` gio tong hop preview conflict summary tu payload preview co san va chi bat confirm overwrite khi preview hien tai cho thay co declaration `existing` voi `changedFields`
  - `DataImporterSyncPreviewPanel.jsx` hien banner canh bao overwrite/locked/unchanged de operator thay ro tac dong truoc khi bam `Dong bo ngay`
  - cap nhat `dataImporterSyncPanelProps.js`, `useDataImporterWorkflowSession.js`, `useDataImporterSessionController.js`, `useDataImporterContainerProps.js`, `tests/useDataImporterSync.test.jsx`, `tests/dataImporterSyncPreviewPanel.test.jsx`, va `tests/dataImporterSyncPanelProps.test.js`
- `cng-7z0.11` da xong o muc lich su dong bo:
  - `dataImporterSyncQueue.js` gio luu `jobHistory` co gioi han cho cac job `completed/failed` va normalize `resultSummary` de ghi ro actor, thoi diem, khoang ngay, va so ban ghi bi tac dong
  - `useDataImporterSync.js` giu lich su nay xuyen session, cap nhat ngay sau moi lan sync xong, va expose `syncHistory` qua workflow/controller/container seam
  - `DataImporterSyncPreviewPanel.jsx` them block `Lich su dong bo gan day` de operator thay ngay lan chay, status, range, MST notice, va ket qua `imported/updated/skipped/locked`
  - bo sung regression `tests/dataImporterSyncQueue.test.js`, cap nhat `tests/useDataImporterSync.test.jsx`, `tests/useDataImporterWorkflowSession.test.jsx`, `tests/dataImporterSyncPanelProps.test.js`, va `tests/dataImporterSyncPreviewPanel.test.jsx`
- `cng-7z0.12` da xong o muc worker-backed XLSX parsing:
  - `dataImporterWorkbookParser.js` dung `dataImporterWorkbook.worker.js` de day `XLSX.read` sang worker module va chi fallback ve sync parser khi worker khong kha dung
  - `useDataImporterImportFlow.js` tiep tuc goi parser chung nen UI import flow nhan worker offload ma khong can doi contract caller
  - bo sung regression `tests/dataImporterWorkbookParser.test.js` cho worker-success, worker-error, va no-worker fallback
- `cng-7z0.13` da xong o muc lazy-load shell-level DataImporter:
  - `DataImporterShell.jsx` lazy-load cac dialog/panel nang cho `sync`, `preview`, `filters`, `results`, va `monitoring` theo tung workflow stage
  - shell workflow guide, summary cards, va banner van render ngay de giu nhan thuc ngu canh trong luc chunk con dang tai
  - cap nhat regression `tests/dataImporterShell.test.jsx` de khoa stage contract trong lazy boundary
- `cng-7z0.15` da duoc reconcile closed o muc wizard da ship san:
  - `DataImporterWorkflowGuide` da huong dan theo trang thai va goi y action theo tung buoc import/sync/save
  - `DataImporterShell.jsx` da chia workflow thanh 3 stage co heading, status badge, va target anchor rieng cho nguoi dung theo doi
  - bang chung regression nam o `tests/dataImporterWorkflowGuideState.test.js` va `tests/dataImporterShell.test.jsx`
- `cng-7z0.28` da xong o muc delivery channel + delivery status tracking:
  - them chon kenh giao (`email`, `report_center`, `download_bundle`) trong `ReportingSchedulePanel` va preview payload ngay trong form
  - hien delivery status chip, `lastDeliveryAt`, va `lastDeliveryError` tren schedule cards de nguoi van hanh thay nhanh lan giao gan nhat
  - dong bo contract luu/doc qua `packages/api-client/src/reportingClient.js`, `server-v4/src/modules/reporting/reportingScheduleNormalizer.ts`, `server-v4/src/modules/reporting/ReportingController.ts`, `server-v4/src/modules/reporting/reportingService.ts`, `server/reportingReadModels.js`, va `server/reportingScheduleMutations.js`
  - bo sung regression `tests/reportingPanels.test.jsx`, `tests/useReportViewerActions.test.jsx`, `tests/reportingClient.test.js`, `tests/server-v4/runtimeRoutes.test.js`, va `tests/server.api.test.js`
- `cng-7z0.29` da xong o muc local report templates:
  - them `ReportingTemplateControls.jsx` + `useReportViewerTemplates.js` de luu/ap dung/ghi de/xoa template report trong local storage trinh duyet
  - mo rong `useReportViewerPreferences.js` de sanitize/build/apply snapshot template cho report viewer state
  - cap nhat `ReportViewer.jsx` + `ReportingPanels.jsx` de template control song song voi bo loc/rule chon report
  - bo sung regression `tests/useReportViewerTemplates.test.jsx`, cap nhat `tests/useReportViewerPreferences.test.jsx`, `tests/reportingPanels.test.jsx`, va verify `tests/reportViewer.test.jsx`
- `cng-7z0.1` da xong o muc persist filter states cho KPI Adjustments:
  - them local-storage persistence theo user scope trong `useKpiAdjustmentFilters.js` cho `month`, `status`, `mine-only`, va `staff`
  - sanitize lai state restore de khong giu bo loc staff/mine-only sai khi auth scope thay doi
  - bo sung regression `tests/kpiAdjustments.hooks.test.jsx` va `tests/kpiAdjustments.test.jsx` de khoa remount restore flow
- `cng-7z0.2` da xong o muc paginate KPI Adjustments list:
  - them `useKpiAdjustmentPageSize.js` de persist `pageSize` rieng cho lane dieu chinh KPI
  - noi `usePagination` + `PageSizeControl` vao `KPIAdjustments.jsx` va `KpiAdjustmentListPanel.jsx` de hien page summary, prev/next controls, va hydrate page size sau remount
  - bo sung regression `tests/useKpiAdjustmentPageSize.test.jsx`, `tests/kpiAdjustmentListPanel.test.jsx`, va cap nhat `tests/kpiAdjustments.test.jsx`
- `cng-7z0.3` da xong o muc bulk approve/reject cho KPI Adjustments:
  - them `useKpiAdjustmentSelection.js` de quan ly selection state theo trang va select-all behavior
  - mo rong `KpiAdjustmentListPanel.jsx` voi checkbox cot dau, toolbar bulk action, va selection summary cho approver
  - cap nhat `KPIAdjustments.jsx` de bulk-loop `updateKpiAdjustmentStatus`, confirm/prompt note, va clear selection sau khi apply
  - bo sung regression `tests/useKpiAdjustmentSelection.test.jsx`, cap nhat `tests/kpiAdjustmentListPanel.test.jsx`, va them integration tests bulk approve/reject trong `tests/kpiAdjustments.test.jsx`
- `cng-7z0.4` da xong o muc quick link tra cuu lien quan trong KPI Adjustments:
  - them `Mở MST` ngay trong list/detail dialog va link theo tung tham chieu to khai de approver jump sang workspace dich nhanh hon
  - tan dung `emitCommand("navigate:tab")` de nhay den `mst/review` hoac `import/review` thay vi mo them prop drilling moi
  - copy lookup value (MST/so to khai) vao clipboard theo best-effort de nguoi dung paste ngay o workspace dich khi can
  - khoa regression command bus trong `tests/kpiAdjustmentListPanel.test.jsx` va `tests/kpiAdjustmentDialogs.test.jsx`
- `cng-7z0.5` da xong o muc quan ly cau hinh diem mac dinh truc tiep trong UI:
  - them summary `Cấu hình đang áp dụng` vao `KpiAdjustmentFormPanel.jsx` de approver thay ngay default unit/mode/license points cua hạng mục dang chon
  - them quick action `Chỉnh cấu hình hạng mục này` de mo `KpiAdjustmentSettingsDialog` theo dung category dang thao tac, kem focus banner va reorder card
  - cap nhat `useKpiAdjustmentForm.js` + `KPIAdjustments.jsx` de giu context `settingsFocusCategory` va khoa regression trong `tests/kpiAdjustmentDialogs.test.jsx` / `tests/kpiAdjustments.test.jsx`
- `cng-7z0.27` da xong o muc executive dashboard snapshot:
  - them `ReportingExecutiveSummaryPanel.jsx` + `reportingExecutiveSummaryModel.js` de tong hop KPI/decl, top staff, team concentration, pending adjustments, va deviation signals
  - cap nhat `ReportingDashboardOverview.jsx` de surfacing executive summary truoc summary cards/trend/top staff widgets
  - bo sung regression `tests/reportingExecutiveSummaryPanel.test.jsx` va cap nhat `tests/reportingDashboardOverview.test.jsx`
- `cng-7z0.26` da xong o muc schedule preview:
  - them preview next-run / outputs / recipients / data-source vao `ReportingSchedulePanel`
  - cap nhat `tests/reportingPanels.test.jsx` va `tests/playwright/report-viewer.spec.js` de khoa jsdom + browser runtime
- `cng-2k4.22 / slice I` da xong o muc report shell focus va loading fallback regression coverage:
  - mo rong `tests/playwright/lazy-tab-shell.spec.js` de khoa fallback focus khi workflow guide nhay sang `Báo cáo KPI` trong luc `ReportCenterPanel` chunk con dang treo
  - mo rong `tests/playwright/report-viewer.spec.js` de khoa handoff focus tu action `Tới khu export`
  - them `tests/kpiCalculator.navigation.test.jsx` de khoa loading status + fallback focus o jsdom contract level
- `cng-2k4.22 / slice F` da xong o muc pagination hook hygiene:
  - memoize `safeItems` trong `src/hooks/usePagination.js` de on dinh dependency cua `currentPageItems`
  - verify lai `tests/mstAssignment.pagination.test.jsx` vi day la harness call truc tiep theo GitNexus impact
- `cng-2k4.22 / slice E` da xong o muc design-system hook hygiene:
  - on dinh dependency cua `useChartPalette` trong `src/designSystem/hooks.js`
  - verify lai `tests/reportViewer.test.jsx` vi day la caller truc tiep theo GitNexus impact
- `cng-2k4.22 / slice D` da xong o muc config lint hygiene:
  - bo bien `isWindows` khong duoc dung trong `eslint.config.js`
  - giu nguyen lint contract, chi cat warning level config
- `cng-2k4.22 / slice C` da xong o muc runtime lint hygiene cho filter preset hook:
  - bo binding `err` khong duoc dung trong `parseJsonSafely` cua `src/hooks/useFilterPresets.js`
  - verify lai caller-side test `tests/useDataImporterSessionController.test.jsx` de khoa contract preset session
- `cng-2k4.22 / slice B` da xong o muc lint hygiene cho test-only files:
  - bo 4 warning unused-var ro rang trong `tests/auditLog.test.jsx`, `tests/reportViewer.test.jsx`, `tests/server.api.test.js`, va `tests/store.test.js`
  - giu nguyen hanh vi test, chi cleanup binding/tham so du thua
- `cng-2k4.22 / slice A` da xong o muc runtime text hygiene:
  - doi nhan fallback `Runtime error` thanh `Lỗi runtime` trong `RuntimeErrorBoundary`
  - cap nhat unit/browser regression de khoa visible copy moi tren shell error states
  - bead lon `cng-2k4.22` van con mo cho nhung phan lint hygiene va text cleanup khac
- `cng-7z0.34` da xong o muc artifact QA cuoi sprint cho giao dien:
  - them `docs/operations/ui-sprint-qa-checklist.md` de chot command matrix, manual smoke checks va cach ghi nhat ky verify
  - cap nhat `docs/operations/ui-verification-log.md` thanh log theo phien va noi truc tiep den checklist nay
  - cap nhat `docs/ux-improvement-backlog.md` + `docs/open-backlog.md` de dong slice tai lieu nay
- `cng-2k4.21` da xong voi browser runtime regression coverage cho lazy shell tabs:
  - them `tests/playwright/lazy-tab-shell.spec.js` de khoa flow `Mở audit trail` khi `AuditLog` chunk dang delay va khi chunk fail
  - bo duplicate `app-tab-root-reports` trong `src/components/workflows/ReportCenterPanel.jsx` de giu root target unique va helper E2E on dinh
  - harden `src/components/ExportAuditReport.jsx` cho payload summary/total thieu field so, tranh runtime error trong audit workspace
- `cng-2k4.20` da xong o muc accessibility/loading polish sau lazy admin tab split:
  - doi `TabPanel` trong `src/components/KPICalculator.jsx` thanh root wrapper focusable co `id` on dinh cho moi tab, khong con phu thuoc vao inner workflow panel moi co focus target
  - bo sung loading fallback semantics voi `role="status"` + `aria-live="polite"` de lazy tab loading duoc announce dung cho screen reader
  - them fallback focus tu workflow-step target ve `getAppTabRootId(tab)` khi lazy child anchor chua mount, giu handoff on dinh cho `navigationIntent`
  - mo rong `tests/kpiCalculator.lazyTabs.test.jsx` de khoa contract loading status + focus target trong luc tab `adjustments` con dang lazy resolve
- `cng-2k4.19` da xong o muc code splitting cho heavy admin tabs:
  - doi `DataImporter`, `HQAgencyManager`, `MSTWorkflowPanel`, `KPIAdjustmentsWorkflowPanel`, va `ReportCenterPanel` trong `src/components/KPICalculator.jsx` sang `React.lazy(...)`
  - them `loadedTabs` state de chi mount tab content sau lan truy cap dau tien, tranh keo cac module nang vao route bootstrap cua shell
  - bo sung regression test `tests/kpiCalculator.lazyTabs.test.jsx` va cap nhat `tests/kpiCalculator.errorBoundary.test.jsx` de dong bo voi lazy import timing
  - targeted verify da pass: eslint batch `KPICalculator + errorBoundary test + lazyTabs test`, vitest batch `auth + errorBoundary + lazyTabs`
- `cng-2k4.16` da xong o muc giam kich thuoc `HQAgencyManager.jsx`:
  - tach header/history/filter/import toolbar thanh `src/components/hq-agency-manager/HQAgencyManagerControls.jsx`
  - giu shell `HQAgencyManager.jsx` cho orchestration state/save/import va dua file goc xuong 674 dong, dat duoi target kich thuoc module
  - bo sung regression test `tests/hqAgencyManagerControls.test.jsx` va verify lai `tests/hqAgencyManager.test.jsx`
- `cng-2k4.17` da xong o muc giam kich thuoc `TeamManager.jsx`:
  - tach toolbar, member workspace, va company table thanh 3 panel rieng duoi `src/components/team-manager/`
  - giu shell `TeamManager.jsx` cho orchestration state/save flow va dua file goc xuong 790 dong, vuot target kich thuoc module
  - bo sung regression tests cho tung panel moi va verify lai cung `TeamManagerHistoryPanel`
- `cng-2k4.18` da xong o muc lazy-load `xlsx` cho cac luong Excel tren client:
  - them `src/lib/loadXlsx.js` de memoize dynamic import `xlsx` va cat static dependency khoi cac shell UI/hook
  - refactor `TeamManager`, `HQAgencyManager`, `dataImporter/*`, `useMSTAssignmentExportWorkspace`, va `useMSTAssignmentImportSaveWorkspace` sang runtime lazy-load / injected loader
  - bo static `xlsx` khoi `src/components/mst-assignment/model/importSheet.js` bang local Excel serial date parser, tranh model file nay tiep tuc keo `xlsx` vao main bundle
  - targeted verify da pass: vitest jsdom batch cho `mst-assignment + dataImporter + HQAgencyManager` va eslint batch tren toan bo file da doi
- `cng-2k4.6` da xong o muc alerts + notifications module extraction cho server-v4:
  - them module `server-v4/src/modules/alerts/*` de expose canonical alert surface duoi `/api/v4/alerts`
  - `buildV4App`/`moduleCatalog`/`server-v4` public exports da mount runtime moi va dua `alerts` vao rollout health metrics
  - `server/index.js` da adapter legacy alert helpers sang runtime v4, giu `server/index.js` la source of truth cho config/evaluation/notification stream trong giai doan parity
  - `server/v4RolloutMount.js` va `tests/v4RolloutMount.test.js` da dua `alerts` vao wave-2 legacy selector, phu hop voi thuc te modules dang mount
  - targeted verify da pass: eslint batch alerts/build wiring, `pnpm run typecheck:server-v4`, va vitest batch `alertsRoutes + appShell + v4RolloutMount`
- `cng-2k4.4` da xong o muc backup module extraction cho server-v4:
  - them `server-v4/src/modules/backup/backup.module.ts`, `backupRoutes.ts`, `backupRuntime.ts` de mount `GET /summary`, `GET /files`, `POST /run`, va `POST /schedule` duoi `/api/v4/backups`
  - `server-v4/src/app/build-v4-app.ts` va `server-v4/src/app/module-catalog.ts` da mount module moi; `server-v4/src/index.ts` export runtime adapter de legacy server co the reuse
  - `server/index.js` da truyen `backupDomain`/`saveBackupConfig`/audit helpers vao runtime v4, giu persisted backup config state khi mount qua legacy app
  - bo sung `tests/server-v4/backupRoutes.test.js`, cap nhat `tests/server-v4/appShell.test.js`; targeted eslint + vitest da pass
  - follow-up `restore` da duoc hoan tat ngay 2026-03-28:
    `POST /api/v4/backups/restore`, reset cached SQLite auth handle truoc khi thay file DB, va targeted typecheck/eslint/vitest deu da pass
- `cng-2k4.7` da xong o muc numbered SQLite schema migrations:
  - them `server/sqliteMigrations.js` de quan ly `schema_migrations` va chay migration co danh so cho kv/auth/export-audit/reporting/business-snapshot/team-roster
  - `server/index.js`, `server/reportingProjectionSqlite.js`, `server/businessSnapshotSqlite.js`, `server/teamRosterSqlite.js`, va cac `Sqlite*Store` ben `server-v4` da delegate sang migration runner thay vi tu bootstrap bang `CREATE TABLE IF NOT EXISTS`
  - bo sung regression `tests/sqliteMigrations.test.js` va cap nhat `tests/reportingProjectionSqlite.test.js`, `tests/server.seed.test.js` de khoa migration history + legacy backfill path
  - bead `cng-2k4.7` da duoc close ngay 2026-03-31 sau khi re-verify eslint + vitest cua lane migration
  - targeted verify da pass:
    - `pnpm exec eslint server/sqliteMigrations.js server/index.js server/businessSnapshotSqlite.js server/reportingProjectionSqlite.js server/teamRosterSqlite.js server-v4/src/modules/auth/sqliteAuthStore.ts server-v4/src/modules/declarations/sqliteDeclarationsStore.ts server-v4/src/modules/hq-agencies/sqliteHqAgenciesStore.ts server-v4/src/modules/kpi-adjustments/sqliteKpiAdjustmentsStore.ts server-v4/src/modules/kpi-rules/sqliteKpiRulesStore.ts server-v4/src/modules/teams/sqliteTeamsStore.ts tests/sqliteMigrations.test.js tests/server.seed.test.js tests/reportingProjectionSqlite.test.js`
    - `pnpm exec vitest run tests/sqliteMigrations.test.js tests/server.seed.test.js tests/reportingProjectionSqlite.test.js --environment node`
- `cng-2k4.1` da hoan tat canonical auth v4 cutover cho client account flows:
  - doi `src/auth/localAuth.js` sang `/api/v4/auth/*` cho login/session/logout + account/password mutations
  - cap nhat auth/account test assertions va Playwright login helper sang canonical route
  - chuan hoa `tests/helpers/mockApiState.js` theo v4 route, dong thoi giu `src/demo/demoMode.js` va `tests/helpers/mockApi.js` nhan ca legacy route de bao toan compat ngoai scope
  - targeted verify da pass: eslint batch auth files, `vitest.frontend` cho `tests/auth.test.jsx` + `tests/accountManager.staff.test.jsx`, `pnpm build`, va `pnpm exec playwright test tests/playwright/account-management.spec.js --config=playwright.config.mjs --workers=1`
- `cng-7z0.33` da hoan tat regression coverage cho filter va sync runtime:
  - mo rong `tests/playwright/sync-flow.spec.js` de cover payload propagation cua `from/to/includeTaxCodes/excludeTaxCodes` giua `Xem trước dữ liệu` va `Đồng bộ ngay`
  - them runtime assertion cho o `Tìm nhanh danh sách tờ khai` de bao ve filter behavior tren du lieu preview sau khi sync preview duoc promote sang bang review
  - targeted verify da pass: `pnpm exec eslint tests/playwright/sync-flow.spec.js` va `pnpm exec playwright test tests/playwright/sync-flow.spec.js --config=playwright.config.mjs --workers=1`
- `cng-2k4.13` da hoan tat pass xac minh runtime + refresh `Checklist.md`:
  - them `tests/playwright/import-monitoring.spec.js` de cover thao tac `Chạy kiểm tra` trong panel `Đối soát C/O` va assert khong con `HTTP 500`/`Lỗi đối soát` tren preview app
  - cap nhat `Checklist.md` de nang hang muc `Lỗi đối soát C/O` len `[x]` va bo sung references runtime cho `Export Excel` o `Import Data` cung shell `Điểm KPI +/- Thêm`
  - targeted verify da pass: `pnpm exec eslint tests/playwright/import-monitoring.spec.js` va `pnpm exec playwright test tests/playwright/import-monitoring.spec.js --config=playwright.config.mjs --workers=1`
- `cng-2k4.21` da hoan tat Playwright smoke coverage cho admin adjustments + health:
  - them `tests/playwright/adjustments-health.spec.js` de verify admin mo duoc workflow `Điểm KPI +/- Thêm` voi du 3 chang van hanh va health tab `Sức khỏe dữ liệu` voi heading/overview triage chinh
  - fix selector nut refresh trong health tab bang cach scope vao match dau tien, tranh strict-mode failure khi UI render hai nut `Đang tải…`
  - targeted verify da pass: `pnpm exec eslint tests/playwright/adjustments-health.spec.js` va `pnpm exec playwright test tests/playwright/adjustments-health.spec.js --config=playwright.config.mjs --workers=1`
- `cng-2k4.12` da hoan tat process-level logging + legacy compat error envelope:
  - `apps/api/src/startApiServer.js` dang ky logging hooks cho `unhandledRejection` va `uncaughtExceptionMonitor`, cleanup listener khi `runtime.close()` de tranh ro listener khi test/start lai runtime
  - `server-v4/src/app/legacy-compat/legacyCompatShared.ts` chuan hoa `handleLegacyAuthError(...)` ve nested error envelope cung format voi `BaseController`
  - `server-v4/src/app/legacy-compat/legacyCompatStorageRoutes.ts` chuan hoa 404 `unknown storage key` theo nested error envelope
  - bo sung regression `tests/appsApiStart.test.js` cho process hook lifecycle, cap nhat `tests/server-v4/legacyCompatRoutes.test.js` cho 401/404 legacy compat errors; targeted eslint + vitest da pass
- `cng-2k4.11` da hoan tat thay `bcrypt.hashSync` o auth request paths:
  - them `hashPassword` async trong `server-v4/src/modules/auth/authShared.ts`
  - doi `server-v4/src/modules/auth/authService.ts` sang async hashing cho create/reset/change password
  - don gian hoa `server-v4/src/app/legacy-compat/legacyCompatShared.ts` bang cach delegate password mutations ve `AuthService`, giu dong bo session invalidation giua canonical va legacy compat auth routes
  - bo sung regression `tests/server-v4/legacyCompatRoutes.test.js` cho legacy password reset + self-change flow; targeted eslint + vitest da pass
- `cng-2k4.10` da hoan tat CSRF protection cho mutation routes:
  - them `server-v4/src/app/csrfProtection.ts` de enforce CSRF cho cookie-authenticated `POST`/`PUT`/`PATCH`/`DELETE` o build path trung tam `buildV4App`, dong thoi hydrate `kpi_csrf` cookie khi session da ton tai
  - cap nhat `server-v4/src/modules/auth/authShared.ts` de session helper set/clear dong bo `kpi_session` va `kpi_csrf`
  - cap nhat `src/auth/localAuth.js` de frontend tu doc `kpi_csrf` cookie va gan `X-CSRF-Token` cho unsafe requests, giu thay doi toi thieu tren `fetchWithAuth`
  - bo sung `tests/server-v4/csrfProtection.test.js`, cap nhat `tests/server-v4/authRoutes.test.js`, `tests/server-v4/legacyCompatRoutes.test.js`, va `tests/auth.test.jsx`; targeted eslint + vitest da pass
- `HQAgencyManager.jsx` da giam tu 1065 dong xuong 804 dong sau khi tach bang du lieu/history panel ra module rieng, giu shell tap trung vao orchestration/state.
- Da them `src/components/hq-agency-manager/HQAgencyTable.jsx` de rut toan bo bang agency, history details, datalist, va row actions khoi shell.
- Da tiep tuc dung `src/components/hq-agency-manager/hqAgencyManagerModel.js` cho cac pure helper/view-model de tranh de presentation module moi phai lap lai formatting logic.
- Bo sung regression test moi:
  - `tests/hqAgencyManagerModel.test.js`
  - `tests/hqAgencyTable.test.jsx`
- Cap nhat `tests/hqAgencyManager.test.jsx` de giu regression coverage khop voi wiring moi cua shell.
- Targeted verify da pass:
  - `pnpm exec eslint src/components/HQAgencyManager.jsx src/components/hq-agency-manager/HQAgencyTable.jsx src/components/hq-agency-manager/hqAgencyManagerModel.js tests/hqAgencyManager.test.jsx tests/hqAgencyManagerModel.test.js tests/hqAgencyTable.test.jsx`
  - `pnpm exec vitest run tests/hqAgencyManager.test.jsx tests/hqAgencyManagerModel.test.js tests/hqAgencyTable.test.jsx --environment jsdom`
- `AccountManager.jsx` da giam tu 1142 dong xuong 786 dong, dat duoi nguong module muc tieu cho slice nay.
- Da them `src/components/account-manager/accountManagerPermissions.js` de tach metadata quyen, permission grouping helpers, va shared class tokens khoi shell.
- Da them `src/components/account-manager/accountManagerFormState.js` de gom draft state mac dinh cho create-account flow, tranh lap object literal trong shell.
- Da them `src/components/account-manager/AccountCreateFormPanel.jsx` de rut toan bo phan tao tai khoan + permission create section khoi shell.
- Da them `src/components/account-manager/AccountPermissionsDialog.jsx` de rut toan bo presentation cua permission dialog khoi shell, trong khi `AccountManager` giu lai scroll state + auth callbacks.
- Bo sung regression test moi:
  - `tests/accountManagerPermissions.test.js`
  - `tests/accountManagerFormState.test.js`
  - `tests/accountCreateFormPanel.test.jsx`
  - `tests/accountPermissionsDialog.test.jsx`
- Targeted verify da pass:
  - `pnpm exec eslint src/components/AccountManager.jsx src/components/account-manager/accountManagerPermissions.js src/components/account-manager/accountManagerFormState.js src/components/account-manager/AccountCreateFormPanel.jsx src/components/account-manager/AccountPermissionsDialog.jsx tests/accountManager.staff.test.jsx tests/accountManagerPermissions.test.js tests/accountManagerFormState.test.js tests/accountCreateFormPanel.test.jsx tests/accountPermissionsDialog.test.jsx`
  - `pnpm exec vitest run tests/accountManager.staff.test.jsx tests/accountManagerPermissions.test.js tests/accountManagerFormState.test.js tests/accountCreateFormPanel.test.jsx tests/accountPermissionsDialog.test.jsx --environment jsdom`
- `DataHealthDashboard.jsx` da giam tu 1060 dong xuong 742 dong, dat duoi nguong module muc tieu cho slice nay.
- Da them `src/components/data-health-dashboard/DataHealthPolicyConfigSection.jsx` de tach toan bo section policy form/header/action bar khoi shell.
- Da them `src/components/data-health-dashboard/dataHealthDashboardViewModels.js` de gom phan build card/panel props thuần ra khoi shell, giu JSX chinh gon va de test hon.
- Da bo sung regression test moi:
  - `tests/dataHealthPolicyConfigSection.test.jsx`
  - `tests/dataHealthDashboardViewModels.test.js`
- Targeted verify da pass:
  - `pnpm exec eslint src/components/DataHealthDashboard.jsx src/components/data-health-dashboard/DataHealthPolicyConfigSection.jsx src/components/data-health-dashboard/dataHealthDashboardViewModels.js tests/dataHealthPolicyConfigSection.test.jsx tests/dataHealthDashboardViewModels.test.js`
  - `pnpm exec vitest run tests/dataHealthPolicySourcesPanel.test.jsx tests/dataHealthPolicyConfigSection.test.jsx tests/dataHealthDashboardViewModels.test.js tests/dataHealthActivityFeedsPanel.test.jsx tests/dataHealthInfrastructureStatusPanel.test.jsx tests/dataHealthMetricsAlertsPanel.test.jsx tests/dataHealthStorageOverviewPanel.test.jsx`
- `cng-svm` da hoan tat tach `buildStatusViewModel` khoi `MSTAssignment` sang `src/components/mst-assignment/model/statusViewModel.js`; shell hien import lai helper moi cho luong table/history status chip va giu nguyen contract cua cac panel/workspace da tach truoc do.
- `cng-hfy` da hoan tat tach `formatHistoryTime` va `HISTORY_FIELD_LABELS` khoi `MSTAssignment` sang `src/components/mst-assignment/model/historyFormatting.js`; shell hien import lai helper moi cho luong history/timeline formatting va giu nguyen contract cua cac workspace da tach truoc do.
- `cng-kun` da hoan tat tach `tidyMST` va `makeRowKey` khoi `MSTAssignment` sang `src/components/mst-assignment/model/rowIdentity.js`; shell hien import lai helper moi cho luong row identity va giu nguyen contract cua cac workspace da tach truoc do.
- `cng-w2c` da hoan tat tach `findCell`, `toISO`, va `headerAliases` khoi `MSTAssignment` sang `src/components/mst-assignment/model/importSheet.js`; shell hien import lai helper moi cho luong import Excel, con regression test parsing da duoc tach rieng.
- `cng-d5g` da hoan tat tach `formatISODate`, `normalizeStatusLabel`, `computeStoredStatus`, va `computeStatusDisplay` khoi `MSTAssignment` sang `src/components/mst-assignment/model/statusDate.js`; shell hien import lai helper moi va giu nguyen contract truyen vao add-form/import-save/row-mutations/export/table panel.
- `cng-jix` da hoan tat hop nhat `goToFirstPage` wiring khoi `MSTAssignment` sang `src/components/mst-assignment/hooks/useMSTAssignmentPageResetWorkspace.js`; shell hien dung mot callback reset-page on dinh de feed cho add-form/history/import/staff/view workspace thay vi lap lai 5 lambda `setPageRef.current(1)`.
- `cng-tai` da hoan tat tach company-name helpers khoi `MSTAssignment` sang `src/components/mst-assignment/model/companyName.js`; entry file hien chi giu `CompanyNameCell` component va import helper moi, con regression test company-name da tro helper import sang module rieng.
- `cng-eg4` da hoan tat tach derived-data workspace khoi `MSTAssignment` sang `src/components/mst-assignment/hooks/useMSTAssignmentDerivedRowsWorkspace.js`; shell hien chi giu wiring `filtered`, `groupedStages`, `displayList`, con hook moi gom pipeline loc/uu tien row moi import va bridge sang grouped/aggregated selectors.
- `cng-6d3` da hoan tat tach search/view controls workspace khoi `MSTAssignment` sang `src/components/mst-assignment/hooks/useMSTAssignmentViewControlsWorkspace.js`; shell hien chi giu wiring cho `search`, `applyFrom`, `groupByMST`, va header actions, con hook moi gom state dieu khien header + search reset page flow.
- `cng-7db` da hoan tat tach staff-filter workspace khoi `MSTAssignment` sang `src/components/mst-assignment/hooks/useMSTAssignmentStaffFilterWorkspace.js`; shell hien chi giu wiring `staffFilter` + panel props, con hook moi gom state filter nhan vien, page-reset flow, va quick-favorite alerts.
- `cng-xkg` da hoan tat tach bootstrap workspace khoi `MSTAssignment` sang `src/components/mst-assignment/hooks/useMSTAssignmentBootstrapWorkspace.js`; shell hien chi giu wiring `rosterTeams`, con hook moi gom roster subscription, initial `getMSTMap` hydrate, va bridge setRows/setOriginalRows.
- `cng-5dp` da hoan tat tach export workspace khoi `MSTAssignment` sang `src/components/mst-assignment/hooks/useMSTAssignmentExportWorkspace.js`; shell hien chi giu wiring `exportRowsToExcel(scope)`, con hook moi gom `filtered/all` scope selection, workbook build, timestamped filename, va empty-state alert.
- `cng-5r6` da hoan tat tach timeline dialog workspace khoi `MSTAssignment` sang `src/components/mst-assignment/hooks/useMSTAssignmentTimelineWorkspace.js`; shell hien chi giu wiring cho `timelineDialogState`, `handleOpenTimelineGroup`, `handleOpenAllTimelines`, va `handleTimelineDialogOpenChange`.
- `cng-cxh` da hoan tat tach history workspace khoi `MSTAssignment` sang `src/components/mst-assignment/hooks/useMSTAssignmentHistoryWorkspace.js`; shell hien chi giu wiring cho `refreshHistory`, history filter state, derived counters, quick favorites, va filtered row-key mapping.
- `cng-bxf` da hoan tat tach row commit workflow khoi `MSTAssignment` sang `src/components/mst-assignment/hooks/useMSTAssignmentRowCommitWorkspace.js`; shell hien chi giu wiring props cho bang, con hook moi gom `originalMap`, row diff detection, `rowHasChanges`, va `commitRow` save side effects.
- `cng-7j8` da hoan tat tach add-form workflow/state khoi `MSTAssignment` sang `src/components/mst-assignment/hooks/useMSTAssignmentAddFormWorkspace.js`; shell hien chi giu wiring props cho button/panel/table, con hook moi gom `showAddForm`, `draft`, `addError`, open/close flow, prefill tu stage hien tai, draft field handlers, va submit orchestration.
- `cng-czt` da hoan tat tach row-mutation orchestration khoi `MSTAssignment` sang `src/components/mst-assignment/hooks/useMSTAssignmentRowMutations.js`; shell hien chi giu wiring props cho panel, con hook moi gom `updateRow`, assignee select handlers, va `removeRow`.
- `cng-elr` da hoan tat tach file-input/import/save orchestration khoi `MSTAssignment` sang `src/components/mst-assignment/hooks/useMSTAssignmentImportSaveWorkspace.js`; shell hien chi giu wiring props, con hook moi gom `fileRef`, `selectedFileName`, `handleFileChange`, `onImportXLSX`, `onSave`, va `markRecentlyImported`.
- `cng-a4y` da hoan tat tach pure helper `sortMSTRows`, grouped stages, aggregated-by-MST rows, display list, va timeline map sang `src/components/mst-assignment/model/displaySelectors.js`; `src/components/MSTAssignment.jsx` da bo duplicate `groupedStages2`/`groupedStages` va giam con 2969 dong sau khi verify bang test moi `tests/mstAssignment.displaySelectors.test.js`.

- `cng-oe3` da duoc dong nhu bead trung lap voi `cng-4zp`; task tach `KpiAdjustmentFormPanel` da hoan tat o slice truoc.
- `cng-pvx` da hoan tat tach block bang du lieu/paging khoi `src/components/MSTAssignment.jsx` thanh `src/components/mst-assignment/table/MstAssignmentDataTablePanel.jsx`, giu nguyen orchestration callback tren shell va bo sung regression test panel moi.
- `cng-sz6` da hoan tat tach form them MST khoi `src/components/MSTAssignment.jsx`; file goc gio chi giu orchestration/callback, con UI form da duoc rut thanh panel rieng va bo sung regression test moi.
- `cng-u40` da dong bead sau khi tach xong `MstAssignmentHistoryFilterPanel`; block bo loc lich su thay doi da duoc rut thanh panel rieng va verify bang regression test moi.
- `cng-c6v` da dong bead sau khi tach xong `MstAssignmentStaffFilterPanel`; `src/components/MSTAssignment.jsx` da rut duoc block bo loc nhan vien phu trach + quick favorites thanh panel rieng va khoa bang regression test moi.
- `cng-ejo` da dong bead sau khi tach xong `KpiAdjustmentOverviewPanel`; `src/components/KPIAdjustments.jsx` hien con 564 dong.
- `cng-b9t` da dong bead sau khi tach xong `MstAssignmentTimelinePanel`; `src/components/MSTAssignment.jsx` tiep tuc giam shell orchestration quanh timeline.
- `cng-xyq.9` da duoc verify lai bang targeted lint + vitest va dong bead de dong bo tracker.
- `cng-e4b` da tach xong 3 dialog (`detail`, `guidance`, `settings`) khoi `src/components/KPIAdjustments.jsx`, bo sung regression test rieng cho panel moi, va dong bead sau khi verify xanh.
- `cng-4hs` da tach xong card danh sach + bo loc thanh `KpiAdjustmentListPanel`, bo sung regression test panel, va giam `src/components/KPIAdjustments.jsx` xuong 1343 dong.

## Completed This Session

- `cng-2k4.8` da hoan tat integration test cho `buildV4App` va route matrix:
  - mo rong `tests/server-v4/appShell.test.js` de verify moi module trong `moduleCatalog` deu mount `__meta` route dung catalog contract
  - bo sung scenario subset mount (`auth` + `teams`) de khoa `/api/v4/meta/modules`, `/api/v4/health`, `/api/v4/meta/rollout`, va `404` cho route nam ngoai matrix da mount
  - targeted verify da pass:
    - `pnpm exec vitest run tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js --environment node`
    - `pnpm exec eslint tests/server-v4/appShell.test.js tests/server-v4/v4RolloutStatus.test.js`

- `cng-2k4.9` da hoan tat rollout metadata dashboard cho operator:
  - them `src/components/data-health-dashboard/DataHealthRolloutStatusPanel.jsx` de render rollout stage, persistence source, declaration write path, va canh bao/doc readiness tu `/api/v4/meta/rollout`
  - cap nhat `src/components/DataHealthDashboard.jsx` de nap rollout metadata voi callback on dinh, tranh request loop khi mount dashboard
  - fix `src/hooks/useAsyncRequest.js` de khong reset `mountedRef` tren moi lan dependency change, dong thoi on dinh hoa `initialArgs`, `onSuccess`, va `onError` qua refs de async state settle dung cho `DataHealthDashboard` va `ExportAuditReport`
  - cap nhat `src/components/ExportAuditReport.jsx` de request task/onError dung `useCallback`, loai bo render loop khi effect phu thuoc `execute`
  - bo sung regression tests `tests/useAsyncRequest.test.jsx`, `tests/dataHealthRolloutStatusPanel.test.jsx`, va cap nhat `tests/dataHealthDashboard.test.jsx`, `tests/ExportAuditReport.test.jsx`
  - targeted verify da pass:
    - `pnpm exec vitest run tests/useAsyncRequest.test.jsx tests/dataHealthRolloutStatusPanel.test.jsx tests/dataHealthDashboard.test.jsx tests/ExportAuditReport.test.jsx --environment jsdom`
    - `pnpm exec eslint src/hooks/useAsyncRequest.js src/components/DataHealthDashboard.jsx src/components/ExportAuditReport.jsx src/components/data-health-dashboard/DataHealthRolloutStatusPanel.jsx tests/useAsyncRequest.test.jsx tests/dataHealthDashboard.test.jsx tests/dataHealthRolloutStatusPanel.test.jsx tests/ExportAuditReport.test.jsx`

- `cng-dps` da hoan tat tach DataHealthDashboard policy sources panel:
  - them `src/components/data-health-dashboard/DataHealthPolicySourcesPanel.jsx` de gom summary `policyStatusCounts` cung 2 card `Nguồn dữ liệu` va `Nguồn đang khóa`
  - `src/components/DataHealthDashboard.jsx` hien chi build props/view-model da format san cho source breakdown, action tone, locked metadata, va callback lock/unlock thay vi giu block JSX presentation dai
  - bo sung `tests/dataHealthPolicySourcesPanel.test.jsx` de khoa branch co du lieu day du, lock/unlock callback, va fallback branch khi khong co source / lock data

- `cng-daf` da hoan tat tach DataHealthDashboard activity feeds panel:
  - them `src/components/data-health-dashboard/DataHealthActivityFeedsPanel.jsx` de gom 2 card `Sự kiện SQL Server gần đây` va `Thông báo real-time`
  - `src/components/DataHealthDashboard.jsx` hien chi build props/view-model da format san cho SQL timeout events va notification entries thay vi giu inline block JSX + tone wiring
  - bo sung `tests/dataHealthActivityFeedsPanel.test.jsx` de khoa branch co du lieu day du va fallback branch khi khong co timeout / thong bao moi

- `cng-dsb` da hoan tat tach DataHealthDashboard infrastructure status panel:
  - them `src/components/data-health-dashboard/DataHealthInfrastructureStatusPanel.jsx` de gom grid `infrastructureAlerts` va banner `Trạng thái kết nối ECUS`
  - `src/components/DataHealthDashboard.jsx` hien chi build props/view-model cho alert severity tone, sync overview, va operator label thay vi giu JSX presentation o shell
  - bo sung `tests/dataHealthInfrastructureStatusPanel.test.jsx` de khoa branch co canh bao day du va fallback branch khi khong co alert ha tang / khong co nguoi truc

- `cng-dma` da hoan tat tach DataHealthDashboard metrics va alert summary panel:
  - them `src/components/data-health-dashboard/DataHealthMetricsAlertsPanel.jsx` de gom metrics grid cung 2 card `Nhóm trùng 11 số cần xử lý` va `Cảnh báo cần xử lý`
  - `src/components/DataHealthDashboard.jsx` hien chi build props/view-model da format san cho metrics, duplicate groups, va alert entries thay vi giu tiep block JSX presentation dai
  - bo sung `tests/dataHealthMetricsAlertsPanel.test.jsx` de khoa branch co du lieu day du va fallback branch khi khong co duplicate group / alert ton dong

- `cng-dsv` da hoan tat tach DataHealthDashboard storage overview panel:
  - them `src/components/data-health-dashboard/DataHealthStorageOverviewPanel.jsx` de gom 3 card `Trạng thái sao lưu CSDL`, `Dung lượng hệ thống`, va `Trạng thái SQL Server`
  - `src/components/DataHealthDashboard.jsx` hien chi build props/view-model cho cum storage overview thay vi giu nguyen block JSX presentation dai trong shell
  - bo sung `tests/dataHealthStorageOverviewPanel.test.jsx` de khoa branch co du lieu day du va fallback branch khi chua co nhat ky sao luu / SQLite stats

- `cng-aqp` da hoan tat tach AccountManager permission groups panel:
  - them `src/components/account-manager/AccountPermissionGroupsPanel.jsx` de gom permission checkbox rendering + per-group collapse logic dung chung cho create-form va dialog quan ly quyen
  - `src/components/AccountManager.jsx` hien chi import panel moi thay vi giu 2 block JSX permission list gan nhu trung nhau
  - bo sung `tests/accountPermissionGroupsPanel.test.jsx` de khoa count label, collapse/expand behavior, disabled predicate, va permission change callback

- `cng-dhd` da hoan tat tach KPI category options:
  - them `src/components/kpi-adjustments/model/categoryOptions.js` de gom `resolveCategoryOptions` va `CATEGORY_OPTIONS`
  - `src/components/KPIAdjustments.jsx` hien import constant moi thay vi giu mapping config inline trong shell
  - bo sung `tests/kpiAdjustments.categoryOptions.test.js` de khoa mapping category config -> option shape

- `cng-0jn` da hoan tat tach KPI staff option builder:
  - them `src/components/kpi-adjustments/model/staffOptions.js` de gom `buildStaffOptions`
  - `src/components/KPIAdjustments.jsx` hien chi import helper moi thay vi giu roster flatten logic inline trong shell
  - bo sung `tests/kpiAdjustments.staffOptions.test.js` de khoa flatten roster + trim member names

- `cng-u7h` da hoan tat tach KPI reference parsing helper:
  - them `src/components/kpi-adjustments/model/referenceParsing.js` de gom `parseReferences`
  - `src/components/KPIAdjustments.jsx` hien chi import helper moi thay vi giu parse logic inline trong shell
  - bo sung `tests/kpiAdjustments.referenceParsing.test.js` de khoa behavior split/normalize/dedupe

- `cng-pnz` da hoan tat tach KPI field-id helpers:
  - them `src/components/kpi-adjustments/model/fieldIds.js` de gom `normalizeFieldSegment`, `buildSettingsFieldId`, va `buildLicenseFieldId`
  - `src/components/KPIAdjustments.jsx` hien chi import helper moi thay vi giu sanitize/id builder inline trong component shell
  - bo sung `tests/kpiAdjustments.fieldIds.test.js` de khoa contract normalize segment va settings/license field-id generation

- `cng-lch` da hoan tat tach KPI formatting helpers:
  - them `src/components/kpi-adjustments/model/formatting.js` de gom `formatDateOnly`, `formatInt`, va `formatDecimal`
  - `src/components/KPIAdjustments.jsx` hien chi import helper moi thay vi giu formatter inline trong component shell
  - bo sung `tests/kpiAdjustments.formatting.test.js` de khoa defensive date parsing va `vi-VN` numeric formatting

- `cng-y03` da hoan tat tach assignee cell khoi `MSTAssignment`:
  - them `src/components/mst-assignment/table/AssigneeCell.jsx` de gom display clamp, team hint, `HistoryDetails`, va che do edit thong qua `MstAssignmentStaffCombobox`
  - `src/components/MSTAssignment.jsx` hien chi import/re-export module moi thay vi giu block presentation inline trong entry file
  - cap nhat `tests/mstAssignment.person-columns.test.jsx` de import truc tiep component moi va tiep tuc khoa read-only + edit state

- `cng-gpl` da hoan tat tach staff combobox wrapper khoi `MSTAssignment`:
  - them `src/components/mst-assignment/shared/MstAssignmentStaffCombobox.jsx` de gom preset `allowCustom`, `preserveTeamOnCustom`, va `preserveTeamOnClear` cho MST assignment flow
  - `src/components/MSTAssignment.jsx` hien import wrapper moi thay vi giu anonymous inline component; `AssigneeCell` va `MstAssignmentAddFormPanel` tiep tuc dung chung mot contract
  - bo sung `tests/mstAssignmentStaffCombobox.test.jsx` de khoa preset props cua wrapper moi ma khong phu thuoc vao hanh vi chi tiet cua shared combobox goc

- `cng-s7x` da hoan tat tach company-name cell khoi `MSTAssignment`:
  - them `src/components/mst-assignment/table/CompanyNameCell.jsx` de gom render/view-edit behavior cho cot cong ty
  - `src/components/MSTAssignment.jsx` hien chi import component moi thay vi giu sanitize/wrap/textarea sizing logic inline trong entry file
  - cap nhat `tests/mstAssignment.company-name.test.jsx` de import truc tiep module moi va tiep tuc khoa wrap threshold, sanitize, va auto-resize behavior
  - targeted verify da pass:
    - `pnpm exec vitest run tests/mstAssignment.company-name.test.jsx tests/mstAssignmentDataTablePanel.test.jsx --environment jsdom`
    - `pnpm exec eslint src/components/MSTAssignment.jsx src/components/mst-assignment/table/CompanyNameCell.jsx tests/mstAssignment.company-name.test.jsx tests/mstAssignmentDataTablePanel.test.jsx`
  - slice nay chi rut company cell presentation/editing logic sang table module rieng, khong doi contract render cua data-table panel

- `cng-y9o` da hoan tat tach person-column header khoi `MSTAssignment`:
  - them `src/components/mst-assignment/table/PersonColumnHeader.jsx` de gom presentation config + icon wiring cho `person_import` / `person_export`
  - `src/components/MSTAssignment.jsx` hien chi import header moi thay vi giu config + UI metadata inline trong entry file
  - cap nhat `tests/mstAssignment.person-columns.test.jsx` de import truc tiep module moi va tiep tuc khoa label 2 dong + tooltip behavior
  - targeted verify da pass:
    - `pnpm exec vitest run tests/mstAssignment.person-columns.test.jsx tests/mstAssignmentDataTablePanel.test.jsx --environment jsdom`
    - `pnpm exec eslint src/components/MSTAssignment.jsx src/components/mst-assignment/table/PersonColumnHeader.jsx tests/mstAssignment.person-columns.test.jsx tests/mstAssignmentDataTablePanel.test.jsx`
  - slice nay chi rut header presentation metadata sang table module rieng, khong doi contract render cua data-table panel

- `cng-8j3` da hoan tat tach page-size control khoi `MSTAssignment`:
  - them `src/components/mst-assignment/table/PageSizeControl.jsx` de gom toan bo UI/behavior cho predefined options + custom page-size
  - `src/components/MSTAssignment.jsx` hien chi import control moi thay vi giu block pagination control inline trong entry file
  - cap nhat `tests/mstAssignment.pagination.test.jsx` de import truc tiep module moi va tiep tuc khoa hanh vi dropdown/custom input
  - targeted verify da pass:
    - `pnpm exec vitest run tests/mstAssignment.pagination.test.jsx tests/mstAssignmentDataTablePanel.test.jsx --environment jsdom`
    - `pnpm exec eslint src/components/MSTAssignment.jsx src/components/mst-assignment/table/PageSizeControl.jsx tests/mstAssignment.pagination.test.jsx tests/mstAssignmentDataTablePanel.test.jsx`
  - slice nay chi rut UI pagination control sang table module rieng, khong doi contract footer pagination cua data-table panel

- `cng-crs` da hoan tat tach create-row-state helper khoi `MSTAssignment`:
  - them `src/components/mst-assignment/model/createRowState.js` de gom `createRowState`
  - `src/components/MSTAssignment.jsx` hien chi import helper moi thay vi giu block normalize row state/meta trong entry file
  - bo sung `tests/mstAssignment.create-row-state.test.js` de khoa normalization MST, trim field strings, auto-compute status, va meta behavior cua `__originalKey` / `__isNew`
  - targeted verify da pass:
    - `pnpm exec vitest run tests/mstAssignment.create-row-state.test.js tests/useMSTAssignmentAddFormWorkspace.test.jsx tests/useMSTAssignmentBootstrapWorkspace.test.jsx tests/useMSTAssignmentImportSaveWorkspace.test.jsx tests/useMSTAssignmentRowCommitWorkspace.test.jsx --environment jsdom`
    - `pnpm exec eslint src/components/MSTAssignment.jsx src/components/mst-assignment/model/createRowState.js tests/mstAssignment.create-row-state.test.js tests/useMSTAssignmentAddFormWorkspace.test.jsx tests/useMSTAssignmentBootstrapWorkspace.test.jsx tests/useMSTAssignmentImportSaveWorkspace.test.jsx tests/useMSTAssignmentRowCommitWorkspace.test.jsx`
  - slice nay chi rut helper pure cho bootstrap/import/add-form/row-commit row normalization, khong doi contract cua cac workspace consumer

- `cng-svm` da hoan tat tach status view-model helper khoi `MSTAssignment`:
  - them `src/components/mst-assignment/model/statusViewModel.js` de gom `buildStatusViewModel`
  - `src/components/MSTAssignment.jsx` hien chi import helper moi thay vi giu block status-chip view model trong entry file
  - bo sung `tests/mstAssignment.status-view-model.test.js` de khoa 3 nhanh chinh: assigned, pending, va warning branches
  - targeted verify da pass:
    - `pnpm exec vitest run tests/mstAssignment.status-view-model.test.js tests/mstAssignmentDataTablePanel.test.jsx tests/useMSTAssignmentHistoryWorkspace.test.jsx tests/useMSTAssignmentTimelineWorkspace.test.jsx tests/useMSTAssignmentRowMutations.test.jsx --environment jsdom`
    - `pnpm exec eslint src/components/MSTAssignment.jsx src/components/mst-assignment/model/statusViewModel.js tests/mstAssignment.status-view-model.test.js tests/mstAssignmentDataTablePanel.test.jsx tests/useMSTAssignmentHistoryWorkspace.test.jsx tests/useMSTAssignmentTimelineWorkspace.test.jsx tests/useMSTAssignmentRowMutations.test.jsx`
  - slice nay chi rut helper pure cho status-chip/status-badge projection, khong doi contract cua data-table/history/timeline/row-mutations consumer

- `cng-hfy` da hoan tat tach history formatting helpers khoi `MSTAssignment`:
  - them `src/components/mst-assignment/model/historyFormatting.js` de gom `formatHistoryTime` va `HISTORY_FIELD_LABELS`
  - `src/components/MSTAssignment.jsx` hien chi import helper moi thay vi giu block history label/time formatter trong entry file
  - bo sung `tests/mstAssignment.history-formatting.test.js` de khoa mapping history labels, format timestamp hop le, hanh vi `Invalid Date`, va catch path khi `Date` constructor nem loi
  - targeted verify da pass:
    - `pnpm exec vitest run tests/mstAssignment.history-formatting.test.js tests/useMSTAssignmentHistoryWorkspace.test.jsx tests/useMSTAssignmentTimelineWorkspace.test.jsx tests/useMSTAssignmentAddFormWorkspace.test.jsx tests/useMSTAssignmentRowMutations.test.jsx --environment jsdom`
    - `pnpm exec eslint src/components/MSTAssignment.jsx src/components/mst-assignment/model/historyFormatting.js tests/mstAssignment.history-formatting.test.js tests/useMSTAssignmentHistoryWorkspace.test.jsx tests/useMSTAssignmentTimelineWorkspace.test.jsx tests/useMSTAssignmentAddFormWorkspace.test.jsx tests/useMSTAssignmentRowMutations.test.jsx`
  - slice nay chi rut helper pure cho history/timeline formatting, khong doi contract cua history/timeline/add-form/row-mutations workspace

- `cng-kun` da hoan tat tach row-identity helpers khoi `MSTAssignment`:
  - them `src/components/mst-assignment/model/rowIdentity.js` de gom `tidyMST` va `makeRowKey`
  - `src/components/MSTAssignment.jsx` hien chi import helper moi thay vi giu block normalize MST/key builder trong entry file
  - bo sung `tests/mstAssignment.row-identity.test.js` de khoa normalize MST digits-only, fallback rong, va row-key builder cho ca row day du lẫn row thieu field
  - targeted verify da pass:
    - `pnpm exec vitest run tests/mstAssignment.row-identity.test.js tests/useMSTAssignmentAddFormWorkspace.test.jsx tests/useMSTAssignmentBootstrapWorkspace.test.jsx tests/useMSTAssignmentDerivedRowsWorkspace.test.jsx tests/useMSTAssignmentImportSaveWorkspace.test.jsx tests/useMSTAssignmentRowCommitWorkspace.test.jsx tests/useMSTAssignmentRowMutations.test.jsx --environment jsdom`
    - `pnpm exec eslint src/components/MSTAssignment.jsx src/components/mst-assignment/model/rowIdentity.js tests/mstAssignment.row-identity.test.js tests/useMSTAssignmentAddFormWorkspace.test.jsx tests/useMSTAssignmentBootstrapWorkspace.test.jsx tests/useMSTAssignmentDerivedRowsWorkspace.test.jsx tests/useMSTAssignmentImportSaveWorkspace.test.jsx tests/useMSTAssignmentRowCommitWorkspace.test.jsx tests/useMSTAssignmentRowMutations.test.jsx`
  - slice nay chi rut helper pure cho identity/lookup key, khong doi contract cua add-form/bootstrap/derived/import-save/row-commit/row-mutations workspace

- `cng-w2c` da hoan tat tach import-sheet parsing helpers khoi `MSTAssignment`:
  - them `src/components/mst-assignment/model/importSheet.js` de gom `headerAliases`, `findCell`, va `toISO`
  - `src/components/MSTAssignment.jsx` hien chi import helper parsing moi thay vi giu block alias/date parsing trong entry file; `XLSX` cung da duoc bo khoi shell vi khong con dung truc tiep
  - bo sung `tests/mstAssignment.import-sheet.test.js` de khoa alias tieng Viet/khong dau, parsing `Date`, serial Excel, va string date
  - targeted verify da pass:
    - `pnpm exec vitest run tests/mstAssignment.import-sheet.test.js tests/useMSTAssignmentImportSaveWorkspace.test.jsx --environment jsdom`
    - `pnpm exec eslint src/components/MSTAssignment.jsx src/components/mst-assignment/model/importSheet.js tests/mstAssignment.import-sheet.test.js tests/useMSTAssignmentImportSaveWorkspace.test.jsx`
  - slice nay chi rut helper pure cho luong import, khong doi contract `useMSTAssignmentImportSaveWorkspace`

- `cng-d5g` da hoan tat tach status/date helpers khoi `MSTAssignment`:
  - them `src/components/mst-assignment/model/statusDate.js` de gom `formatISODate`, `normalizeStatusLabel`, `computeStoredStatus`, va `computeStatusDisplay`
  - `src/components/MSTAssignment.jsx` hien chi import helper moi thay vi giu 4 pure helper trong entry file, con `normalize`/`findCell` local van giu nguyen de tranh mo rong slice sang import parsing
  - bo sung `tests/mstAssignment.status-date.test.js` de khoa format date, canonical status label, stored status, va display status branches
  - targeted verify da pass:
    - `pnpm exec vitest run tests/mstAssignment.status-date.test.js tests/useMSTAssignmentAddFormWorkspace.test.jsx tests/useMSTAssignmentRowMutations.test.jsx tests/useMSTAssignmentExportWorkspace.test.jsx tests/useMSTAssignmentImportSaveWorkspace.test.jsx --environment jsdom`
    - `pnpm exec eslint src/components/MSTAssignment.jsx src/components/mst-assignment/model/statusDate.js tests/mstAssignment.status-date.test.js tests/useMSTAssignmentAddFormWorkspace.test.jsx tests/useMSTAssignmentRowMutations.test.jsx tests/useMSTAssignmentExportWorkspace.test.jsx tests/useMSTAssignmentImportSaveWorkspace.test.jsx`
  - slice nay giu nguyen wiring workspace hien co; chi rut 4 helper pure ra model rieng de don shell va co regression test rieng

- `cng-jix` da hoan tat hop nhat `goToFirstPage` wiring khoi `MSTAssignment`:
  - them `src/components/mst-assignment/hooks/useMSTAssignmentPageResetWorkspace.js` de gom `bindPageSetter` va `goToFirstPage`
  - `src/components/MSTAssignment.jsx` hien bind `setPage` vao workspace moi sau `usePagination`, roi truyen chung mot `goToFirstPage` cho add-form/history/import-save/staff-filter/view-controls workspace
  - bo sung `tests/useMSTAssignmentPageResetWorkspace.test.jsx` de khoa 2 nhanh chinh: dispatch den current page setter va no-op an toan truoc khi bind
  - targeted verify da pass:
    - `pnpm exec vitest run tests/useMSTAssignmentPageResetWorkspace.test.jsx tests/useMSTAssignmentAddFormWorkspace.test.jsx tests/useMSTAssignmentHistoryWorkspace.test.jsx tests/useMSTAssignmentImportSaveWorkspace.test.jsx tests/useMSTAssignmentStaffFilterWorkspace.test.jsx tests/useMSTAssignmentViewControlsWorkspace.test.jsx --environment jsdom`
    - `pnpm exec eslint src/components/MSTAssignment.jsx src/components/mst-assignment/hooks/useMSTAssignmentPageResetWorkspace.js tests/useMSTAssignmentPageResetWorkspace.test.jsx tests/useMSTAssignmentAddFormWorkspace.test.jsx tests/useMSTAssignmentHistoryWorkspace.test.jsx tests/useMSTAssignmentImportSaveWorkspace.test.jsx tests/useMSTAssignmentStaffFilterWorkspace.test.jsx tests/useMSTAssignmentViewControlsWorkspace.test.jsx`
  - slice nay chi giam lap wiring pagination callback, khong doi contract cac workspace con lai

- `cng-tai` da hoan tat tach company-name helpers khoi `MSTAssignment`:
  - them `src/components/mst-assignment/model/companyName.js` de gom `COMPANY_NAME_WRAP_THRESHOLD`, `shouldWrapCompanyName`, va `sanitizeCompanyNameInput`
  - `src/components/MSTAssignment.jsx` hien chi con giu `CompanyNameCell` component va import helper moi thay vi export non-component helpers trong cung entry file
  - cap nhat `tests/mstAssignment.company-name.test.jsx` de giu `CompanyNameCell` import tu `MSTAssignment.jsx`, con helper assertions chuyen sang module moi
  - targeted verify da pass:
    - `pnpm exec vitest run tests/mstAssignment.company-name.test.jsx --environment jsdom`
    - `pnpm exec eslint src/components/MSTAssignment.jsx src/components/mst-assignment/model/companyName.js tests/mstAssignment.company-name.test.jsx`
  - muc tieu cua slice nay la don 2 warning Fast Refresh con lai o `src/components/MSTAssignment.jsx`

- `cng-eg4` da hoan tat tach derived-data workspace khoi `MSTAssignment`:
  - them `src/components/mst-assignment/hooks/useMSTAssignmentDerivedRowsWorkspace.js` de gom `filterAndPrioritizeRows`, `filtered`, `groupedStages`, `aggregatedByMST`, va `displayList`
  - `src/components/MSTAssignment.jsx` hien khong con giu inline `useMemo` block cho filtering/sorting/grouping; shell chi con wiring outputs cua hook moi sang export, pagination, timeline, va table
  - bo sung `tests/useMSTAssignmentDerivedRowsWorkspace.test.jsx` de khoa 3 nhanh chinh: history/status/staff/search filtering + imported priority, grouped/aggregated display path, va raw display path khi tat `groupByMST`
  - targeted verify da pass:
    - `pnpm exec vitest run tests/useMSTAssignmentDerivedRowsWorkspace.test.jsx tests/useMSTAssignmentViewControlsWorkspace.test.jsx tests/useMSTAssignmentStaffFilterWorkspace.test.jsx tests/useMSTAssignmentBootstrapWorkspace.test.jsx tests/useMSTAssignmentExportWorkspace.test.jsx tests/useMSTAssignmentHistoryWorkspace.test.jsx tests/useMSTAssignmentTimelineWorkspace.test.jsx tests/mstAssignment.displaySelectors.test.js tests/mstAssignmentDataTablePanel.test.jsx --environment jsdom`
    - `pnpm exec eslint src/components/MSTAssignment.jsx src/components/mst-assignment/hooks/useMSTAssignmentDerivedRowsWorkspace.js src/components/mst-assignment/hooks/useMSTAssignmentViewControlsWorkspace.js src/components/mst-assignment/hooks/useMSTAssignmentStaffFilterWorkspace.js src/components/mst-assignment/hooks/useMSTAssignmentBootstrapWorkspace.js src/components/mst-assignment/hooks/useMSTAssignmentExportWorkspace.js src/components/mst-assignment/hooks/useMSTAssignmentHistoryWorkspace.js src/components/mst-assignment/hooks/useMSTAssignmentTimelineWorkspace.js src/components/mst-assignment/model/displaySelectors.js tests/useMSTAssignmentDerivedRowsWorkspace.test.jsx tests/useMSTAssignmentViewControlsWorkspace.test.jsx tests/useMSTAssignmentStaffFilterWorkspace.test.jsx tests/useMSTAssignmentBootstrapWorkspace.test.jsx tests/useMSTAssignmentExportWorkspace.test.jsx tests/useMSTAssignmentHistoryWorkspace.test.jsx tests/useMSTAssignmentTimelineWorkspace.test.jsx tests/mstAssignment.displaySelectors.test.js tests/mstAssignmentDataTablePanel.test.jsx`
  - `eslint` chi con 2 warning Fast Refresh cu o `src/components/MSTAssignment.jsx`

- `cng-6d3` da hoan tat tach search/view controls workspace khoi `MSTAssignment`:
  - them `src/components/mst-assignment/hooks/useMSTAssignmentViewControlsWorkspace.js` de gom `search`, `groupByMST`, `applyFrom`, va cac handler `handleSearchChange`, `handleClearSearch`, `handleGroupByMSTChange`, `handleApplyFromChange`
  - `src/components/MSTAssignment.jsx` hien khong con giu inline state header cho search/date/group toggle; shell chi con wiring gia tri/handler vao `SearchField`, checkbox gom MST, va input ngay ap dung
  - bo sung `tests/useMSTAssignmentViewControlsWorkspace.test.jsx` de khoa 3 nhanh chinh: search change + clear deu reset page, group toggle reset page, va apply-from change khong tu y reset page
  - targeted verify da pass:
    - `pnpm exec vitest run tests/useMSTAssignmentViewControlsWorkspace.test.jsx tests/useMSTAssignmentStaffFilterWorkspace.test.jsx tests/useMSTAssignmentBootstrapWorkspace.test.jsx tests/useMSTAssignmentExportWorkspace.test.jsx tests/useMSTAssignmentHistoryWorkspace.test.jsx tests/useMSTAssignmentTimelineWorkspace.test.jsx tests/mstAssignmentDataTablePanel.test.jsx --environment jsdom`
    - `pnpm exec eslint src/components/MSTAssignment.jsx src/components/mst-assignment/hooks/useMSTAssignmentViewControlsWorkspace.js src/components/mst-assignment/hooks/useMSTAssignmentStaffFilterWorkspace.js src/components/mst-assignment/hooks/useMSTAssignmentBootstrapWorkspace.js src/components/mst-assignment/hooks/useMSTAssignmentExportWorkspace.js src/components/mst-assignment/hooks/useMSTAssignmentHistoryWorkspace.js src/components/mst-assignment/hooks/useMSTAssignmentTimelineWorkspace.js tests/useMSTAssignmentViewControlsWorkspace.test.jsx tests/useMSTAssignmentStaffFilterWorkspace.test.jsx tests/useMSTAssignmentBootstrapWorkspace.test.jsx tests/useMSTAssignmentExportWorkspace.test.jsx tests/useMSTAssignmentHistoryWorkspace.test.jsx tests/useMSTAssignmentTimelineWorkspace.test.jsx tests/mstAssignmentDataTablePanel.test.jsx`
  - `eslint` chi con 2 warning Fast Refresh cu o `src/components/MSTAssignment.jsx`

- `cng-7db` da hoan tat tach staff-filter workspace khoi `MSTAssignment`:
  - them `src/components/mst-assignment/hooks/useMSTAssignmentStaffFilterWorkspace.js` de gom `staffFilter` state, `handleStaffFilterSelect`, `clearStaffFilter`, `applyStaffFavorite`, va `handleSaveStaffFavorite`
  - `src/components/MSTAssignment.jsx` hien khong con giu inline staff-filter state/callback; shell chi con wiring voi `MstAssignmentStaffFilterPanel` va doc `staffFilter` cho pipeline filter hien co
  - bo sung `tests/useMSTAssignmentStaffFilterWorkspace.test.jsx` de khoa 3 nhanh chinh: select/clear/favorite deu reset page, empty-save alert, va duplicate/success messaging khi luu favorite
  - targeted verify da pass:
    - `pnpm exec vitest run tests/useMSTAssignmentStaffFilterWorkspace.test.jsx tests/useMSTAssignmentBootstrapWorkspace.test.jsx tests/useMSTAssignmentExportWorkspace.test.jsx tests/useMSTAssignmentHistoryWorkspace.test.jsx tests/useMSTAssignmentTimelineWorkspace.test.jsx tests/mstAssignmentDataTablePanel.test.jsx --environment jsdom`
    - `pnpm exec eslint src/components/MSTAssignment.jsx src/components/mst-assignment/hooks/useMSTAssignmentStaffFilterWorkspace.js src/components/mst-assignment/hooks/useMSTAssignmentBootstrapWorkspace.js src/components/mst-assignment/hooks/useMSTAssignmentExportWorkspace.js src/components/mst-assignment/hooks/useMSTAssignmentHistoryWorkspace.js src/components/mst-assignment/hooks/useMSTAssignmentTimelineWorkspace.js tests/useMSTAssignmentStaffFilterWorkspace.test.jsx tests/useMSTAssignmentBootstrapWorkspace.test.jsx tests/useMSTAssignmentExportWorkspace.test.jsx tests/useMSTAssignmentHistoryWorkspace.test.jsx tests/useMSTAssignmentTimelineWorkspace.test.jsx tests/mstAssignmentDataTablePanel.test.jsx`
  - `eslint` chi con 2 warning Fast Refresh cu o `src/components/MSTAssignment.jsx`

- `cng-xkg` da hoan tat tach bootstrap workspace khoi `MSTAssignment`:
  - them `src/components/mst-assignment/hooks/useMSTAssignmentBootstrapWorkspace.js` de gom `subscribeTeamRoster`, derive `rosterTeams`, initial `getMSTMap` hydrate, va error logging path
  - `src/components/MSTAssignment.jsx` hien khong con giu inline roster subscription hay initial hydrate effect; shell chi con wiring cho `rosterTeams` va cac hook phu thuoc vao rows/originalRows
  - bo sung `tests/useMSTAssignmentBootstrapWorkspace.test.jsx` de khoa 3 nhanh chinh: hydrate rows/originalRows, roster subscription + cleanup, va hydrate failure logging
  - targeted verify da pass:
    - `pnpm exec vitest run tests/useMSTAssignmentBootstrapWorkspace.test.jsx tests/useMSTAssignmentExportWorkspace.test.jsx tests/useMSTAssignmentHistoryWorkspace.test.jsx tests/useMSTAssignmentTimelineWorkspace.test.jsx tests/mstAssignmentDataTablePanel.test.jsx --environment jsdom`
    - `pnpm exec eslint src/components/MSTAssignment.jsx src/components/mst-assignment/hooks/useMSTAssignmentBootstrapWorkspace.js src/components/mst-assignment/hooks/useMSTAssignmentExportWorkspace.js src/components/mst-assignment/hooks/useMSTAssignmentHistoryWorkspace.js src/components/mst-assignment/hooks/useMSTAssignmentTimelineWorkspace.js tests/useMSTAssignmentBootstrapWorkspace.test.jsx tests/useMSTAssignmentExportWorkspace.test.jsx tests/useMSTAssignmentHistoryWorkspace.test.jsx tests/useMSTAssignmentTimelineWorkspace.test.jsx tests/mstAssignmentDataTablePanel.test.jsx`
  - `eslint` chi con 2 warning Fast Refresh cu o `src/components/MSTAssignment.jsx`

- `cng-5dp` da hoan tat tach export workspace khoi `MSTAssignment`:
  - them `src/components/mst-assignment/hooks/useMSTAssignmentExportWorkspace.js` de gom `filtered/all` scope selection, export row mapping, workbook build, timestamp formatting, va `writeFile`
  - `src/components/MSTAssignment.jsx` hien dung hook moi thay vi giu inline block `exportRowsToExcel`; shell giu nguyen contract cho 2 nut `Export (lọc)` va `Export (tất cả)`
  - bo sung `tests/useMSTAssignmentExportWorkspace.test.jsx` de khoa 3 nhanh chinh: `empty-state alert`, export filtered rows mac dinh, va export full rows cho scope `all`
  - targeted verify da pass:
    - `pnpm exec vitest run tests/useMSTAssignmentExportWorkspace.test.jsx tests/useMSTAssignmentHistoryWorkspace.test.jsx tests/useMSTAssignmentTimelineWorkspace.test.jsx tests/mstAssignmentDataTablePanel.test.jsx --environment jsdom`
    - `pnpm exec eslint src/components/MSTAssignment.jsx src/components/mst-assignment/hooks/useMSTAssignmentExportWorkspace.js src/components/mst-assignment/hooks/useMSTAssignmentHistoryWorkspace.js src/components/mst-assignment/hooks/useMSTAssignmentTimelineWorkspace.js tests/useMSTAssignmentExportWorkspace.test.jsx tests/useMSTAssignmentHistoryWorkspace.test.jsx tests/useMSTAssignmentTimelineWorkspace.test.jsx tests/mstAssignmentDataTablePanel.test.jsx`
  - `eslint` chi con 2 warning Fast Refresh cu o `src/components/MSTAssignment.jsx`

- `cng-5r6` da hoan tat tach timeline dialog workspace khoi `MSTAssignment`:
  - them `src/components/mst-assignment/hooks/useMSTAssignmentTimelineWorkspace.js` de gom `timelineDialogState`, `handleOpenTimelineGroup`, `handleOpenAllTimelines`, va `handleTimelineDialogOpenChange`
  - `src/components/MSTAssignment.jsx` hien dung hook moi thay vi giu inline timeline dialog state/open handlers, nen file goc tiep tuc giam orchestration quanh timeline aggregate/detail flow
  - bo sung `tests/useMSTAssignmentTimelineWorkspace.test.jsx` de khoa 3 nhanh chinh: mo group dialog, mo/close aggregate dialog, va bo qua empty/null payload
  - targeted verify da pass:
    - `pnpm exec vitest run tests/useMSTAssignmentHistoryWorkspace.test.jsx tests/useMSTAssignmentTimelineWorkspace.test.jsx tests/mstAssignmentHistoryFilterPanel.test.jsx tests/mstAssignmentTimelinePanel.test.jsx tests/mstAssignmentDataTablePanel.test.jsx tests/useMSTAssignmentRowCommitWorkspace.test.jsx --environment jsdom`
    - `pnpm exec eslint src/components/MSTAssignment.jsx src/components/mst-assignment/hooks/useMSTAssignmentHistoryWorkspace.js src/components/mst-assignment/hooks/useMSTAssignmentTimelineWorkspace.js tests/useMSTAssignmentHistoryWorkspace.test.jsx tests/useMSTAssignmentTimelineWorkspace.test.jsx tests/mstAssignmentHistoryFilterPanel.test.jsx tests/mstAssignmentTimelinePanel.test.jsx tests/mstAssignmentDataTablePanel.test.jsx tests/useMSTAssignmentRowCommitWorkspace.test.jsx`
  - `eslint` chi con 2 warning Fast Refresh cu o `src/components/MSTAssignment.jsx`

- `cng-cxh` da hoan tat tach history workspace khoi `MSTAssignment`:
  - them `src/components/mst-assignment/hooks/useMSTAssignmentHistoryWorkspace.js` de gom history load, filter state, derived counters, filtered row-key mapping, va quick favorite handlers
  - `src/components/MSTAssignment.jsx` hien dung hook moi thay vi giu inline history state/effect/selector block; shell chi con wiring va render panel
  - bo sung `tests/useMSTAssignmentHistoryWorkspace.test.jsx` de khoa 3 nhanh chinh: initial load/filter counts, quick favorite save/reset flow, va refresh/status-filter mapping
  - targeted verify da pass:
    - `pnpm exec vitest run tests/useMSTAssignmentHistoryWorkspace.test.jsx tests/useMSTAssignmentTimelineWorkspace.test.jsx tests/mstAssignmentHistoryFilterPanel.test.jsx tests/mstAssignmentTimelinePanel.test.jsx tests/mstAssignmentDataTablePanel.test.jsx tests/useMSTAssignmentRowCommitWorkspace.test.jsx --environment jsdom`
    - `pnpm exec eslint src/components/MSTAssignment.jsx src/components/mst-assignment/hooks/useMSTAssignmentHistoryWorkspace.js src/components/mst-assignment/hooks/useMSTAssignmentTimelineWorkspace.js tests/useMSTAssignmentHistoryWorkspace.test.jsx tests/useMSTAssignmentTimelineWorkspace.test.jsx tests/mstAssignmentHistoryFilterPanel.test.jsx tests/mstAssignmentTimelinePanel.test.jsx tests/mstAssignmentDataTablePanel.test.jsx tests/useMSTAssignmentRowCommitWorkspace.test.jsx`
  - `eslint` chi con 2 warning Fast Refresh cu o `src/components/MSTAssignment.jsx`

- `cng-bxf` da hoan tat tach row commit workflow khoi `MSTAssignment`:
  - them `src/components/mst-assignment/hooks/useMSTAssignmentRowCommitWorkspace.js` de gom `originalMap`, `getRowDiff`, `rowHasChanges`, va `commitRow` save side effects khoi shell
  - `src/components/MSTAssignment.jsx` hien dung hook moi thay vi giu inline diff/save block, nen file goc tiep tuc giam orchestration quanh bang du lieu
  - bo sung `tests/useMSTAssignmentRowCommitWorkspace.test.jsx` de khoa 3 nhanh chinh: `no-change`, save thanh cong, va `conflict`
  - targeted verify da pass:
    - `pnpm exec vitest run tests/useMSTAssignmentRowCommitWorkspace.test.jsx tests/mstAssignmentDataTablePanel.test.jsx tests/useMSTAssignmentAddFormWorkspace.test.jsx tests/useMSTAssignmentRowMutations.test.jsx tests/useMSTAssignmentImportSaveWorkspace.test.jsx --environment jsdom`
    - `pnpm exec eslint src/components/MSTAssignment.jsx src/components/mst-assignment/hooks/useMSTAssignmentRowCommitWorkspace.js tests/useMSTAssignmentRowCommitWorkspace.test.jsx tests/mstAssignmentDataTablePanel.test.jsx`
  - `eslint` chi con 2 warning Fast Refresh cu o `src/components/MSTAssignment.jsx`

- `cng-7j8` da hoan tat tach add-form workflow/state khoi `MSTAssignment`:
  - them `src/components/mst-assignment/hooks/useMSTAssignmentAddFormWorkspace.js` de gom `showAddForm`, `draft`, `addError`, `toggleAddForm`, `startNewStageFromRow`, draft assignee handlers, close flow, va submit orchestration
  - `src/components/MSTAssignment.jsx` hien dung hook moi thay vi giu inline block add-form state/handlers; `useTooltipTitles` da duoc doi xuong sau workspace setup de tranh TDZ runtime regression
  - bo sung `tests/useMSTAssignmentAddFormWorkspace.test.jsx` de khoa open/submit flow, stage prefill flow, va invalid date validation
  - targeted verify da pass:
    - `pnpm exec vitest run tests/useMSTAssignmentAddFormWorkspace.test.jsx tests/mstAssignmentAddFormPanel.test.jsx tests/e2e.admin-flows.test.jsx tests/useMSTAssignmentImportSaveWorkspace.test.jsx tests/useMSTAssignmentRowMutations.test.jsx --environment jsdom`
    - `pnpm exec eslint src/components/MSTAssignment.jsx src/components/mst-assignment/hooks/useMSTAssignmentAddFormWorkspace.js tests/useMSTAssignmentAddFormWorkspace.test.jsx tests/mstAssignmentAddFormPanel.test.jsx`
  - `eslint` chi con 2 warning Fast Refresh cu o `src/components/MSTAssignment.jsx`
  - local checkpoint cho hai slice truoc da duoc commit thanh `25cdeca` (`ref(frontend): Extract MST assignment import workspaces`)

- `cng-czt` da hoan tat tach row-mutation handlers khoi `MSTAssignment`:
  - them `src/components/mst-assignment/hooks/useMSTAssignmentRowMutations.js` de gom `updateRow`, assignee patch builder, imported-key migration, va `removeRow`
  - `src/components/MSTAssignment.jsx` hien dung hook moi thay vi giu inline block `updateRow` + assignee select handlers + remove-row confirm flow
  - bo sung `tests/useMSTAssignmentRowMutations.test.jsx` de khoa row update normalization/status, imported-key migration, assignee patching, va delete flow
  - targeted verify da pass:
    - `pnpm exec vitest run tests/useMSTAssignmentRowMutations.test.jsx tests/useMSTAssignmentImportSaveWorkspace.test.jsx tests/mstAssignmentDataTablePanel.test.jsx tests/mstAssignmentTimelinePanel.test.jsx tests/mstAssignment.displaySelectors.test.js --environment jsdom`
    - `pnpm exec eslint src/components/MSTAssignment.jsx src/components/mst-assignment/hooks/useMSTAssignmentImportSaveWorkspace.js src/components/mst-assignment/hooks/useMSTAssignmentRowMutations.js tests/useMSTAssignmentImportSaveWorkspace.test.jsx tests/useMSTAssignmentRowMutations.test.jsx`
  - `eslint` chi con 2 warning Fast Refresh cu o `src/components/MSTAssignment.jsx`
  - `detect_changes(scope: "all")` van bao `risk_level: high` vi GitNexus map diff theo file `MSTAssignment.jsx`, nhung impact truoc khi sua cho `handleRowImportSelect` la `LOW` va scope thuc te chi quanh row-mutation extraction

- `cng-elr` da hoan tat tach import/save orchestration khoi `MSTAssignment`:
  - them `src/components/mst-assignment/hooks/useMSTAssignmentImportSaveWorkspace.js` de gom file-input state, import workbook mapping/merge, save orchestration, va helper add imported keys
  - `src/components/MSTAssignment.jsx` hien dung hook moi thay vi giu inline block `onImportXLSX` + `onSave` + `selectedFileName`/`fileRef`
  - bo sung `tests/useMSTAssignmentImportSaveWorkspace.test.jsx` de khoa import flow local va save/reset imported highlights
  - targeted verify da pass:
    - `pnpm exec vitest run tests/useMSTAssignmentImportSaveWorkspace.test.jsx tests/mstAssignment.displaySelectors.test.js tests/mstAssignmentDataTablePanel.test.jsx tests/mstAssignmentTimelinePanel.test.jsx --environment jsdom`
    - `pnpm exec eslint src/components/MSTAssignment.jsx src/components/mst-assignment/hooks/useMSTAssignmentImportSaveWorkspace.js tests/useMSTAssignmentImportSaveWorkspace.test.jsx`
  - `eslint` chi con 2 warning Fast Refresh cu o `src/components/MSTAssignment.jsx`
  - `detect_changes(scope: "all")` van bao `risk_level: high` vi GitNexus map diff theo entry-point `MSTAssignment.jsx`; impact truoc khi sua cho symbol `MSTAssignment` van la `LOW` va scope thuc te cua slice chi quanh import/save extraction

- `cng-a4y` da hoan tat tach selector/grouping helper khoi `MSTAssignment`:
  - them `src/components/mst-assignment/model/displaySelectors.js` de gom `sortMSTRows`, `buildGroupedStages`, `buildAggregatedRowsByMST`, `buildDisplayList`, va `buildTimelineGroupsByMST`
  - `src/components/MSTAssignment.jsx` hien dung mot `groupedStages` selector duy nhat, khong con duplicate `groupedStages2`, va timeline/display list deu dung helper module moi
  - bo sung `tests/mstAssignment.displaySelectors.test.js` de khoa sorting, grouped stages, aggregated-by-MST rows, display-list switch, va timeline map
  - targeted verify da pass:
    - `pnpm exec vitest run tests/mstAssignment.displaySelectors.test.js tests/mstAssignmentDataTablePanel.test.jsx tests/mstAssignmentTimelinePanel.test.jsx --environment jsdom`
    - `pnpm exec eslint src/components/MSTAssignment.jsx src/components/mst-assignment/model/displaySelectors.js tests/mstAssignment.displaySelectors.test.js tests/mstAssignmentDataTablePanel.test.jsx tests/mstAssignmentTimelinePanel.test.jsx`
  - `eslint` chi con 2 warning Fast Refresh cu o `src/components/MSTAssignment.jsx`

- `cng-pvx` da hoan tat tach bang du lieu/paging khoi `MSTAssignment`:
  - them `src/components/mst-assignment/table/MstAssignmentDataTablePanel.jsx` de gom summary bar, column visibility popover, data table, row action, va pagination shell
  - `src/components/MSTAssignment.jsx` hien chi giu orchestration callback/state va render panel moi + timeline panel nhu child thay vi block JSX inline >1000 dong
  - bo sung `tests/mstAssignmentDataTablePanel.test.jsx` de khoa column controls, badge row moi import, row actions, va paging/page-size callback
  - targeted verify da pass:
    - `pnpm exec eslint src/components/MSTAssignment.jsx src/components/mst-assignment/table/MstAssignmentDataTablePanel.jsx tests/mstAssignmentDataTablePanel.test.jsx tests/mstAssignment.person-columns.test.jsx tests/mstAssignment.timeline.test.jsx tests/mstAssignment.pagination.test.jsx`
    - `pnpm exec vitest run tests/mstAssignmentDataTablePanel.test.jsx tests/mstAssignment.person-columns.test.jsx tests/mstAssignment.timeline.test.jsx tests/mstAssignment.pagination.test.jsx --environment jsdom`
  - `detect_changes(scope: "all")` van bao `risk_level: high` vi GitNexus gom diff theo file entry-point `MSTAssignment.jsx`, nhung impact truoc khi sua cho symbol `MSTAssignment` la `LOW` va scope thuc te chi tap trung quanh table-panel extraction

- `cng-sz6` da hoan tat tach form them MST khoi `MSTAssignment`:
  - them `src/components/mst-assignment/forms/MstAssignmentAddFormPanel.jsx` de rut block form them MST thanh panel presentational rieng
  - bo sung `tests/mstAssignmentAddFormPanel.test.jsx` de khoa wiring callback, assignee combobox labels, submit/cancel action, va error display
  - `src/components/MSTAssignment.jsx` hien chi giu callback orchestration (`handleDraftImportSelect`, `handleDraftExportSelect`, `handleCloseAddForm`) va render panel moi thay vi block JSX inline
  - targeted verify da pass:
    - `pnpm exec eslint src/components/MSTAssignment.jsx src/components/mst-assignment/forms/MstAssignmentAddFormPanel.jsx tests/mstAssignmentAddFormPanel.test.jsx tests/mstAssignment.person-columns.test.jsx tests/mstAssignment.timeline.test.jsx`
    - `pnpm exec vitest run tests/mstAssignmentAddFormPanel.test.jsx tests/mstAssignment.person-columns.test.jsx tests/mstAssignment.timeline.test.jsx --environment jsdom`
  - `detect_changes(scope: "all")` van bao `risk_level: high` vi GitNexus map diff theo file `MSTAssignment.jsx`, nhung scope thuc te chi la add-form extraction va regression tests lien quan da xanh

- `cng-u40` da hoan tat tach bo loc lich su thay doi khoi `MSTAssignment`:
  - them `src/components/mst-assignment/filters/MstAssignmentHistoryFilterPanel.jsx` de rut section history filter thanh panel presentational rieng
  - bo sung `tests/mstAssignmentHistoryFilterPanel.test.jsx` de khoa history summary, update filter callbacks, toolbar actions, va quick favorite action filter
  - `src/components/MSTAssignment.jsx` hien dung panel moi thay vi giu inline block UI cho history filter
  - targeted verify da pass:
    - `pnpm exec eslint src/components/MSTAssignment.jsx src/components/mst-assignment/filters/MstAssignmentHistoryFilterPanel.jsx tests/mstAssignmentHistoryFilterPanel.test.jsx tests/mstAssignment.timeline.test.jsx`
    - `pnpm exec vitest run tests/mstAssignmentHistoryFilterPanel.test.jsx tests/mstAssignment.timeline.test.jsx --environment jsdom`
  - `detect_changes(scope: "all")` van bao `risk_level: critical` vi worktree dang gom ca refactor chua commit cua `KPIAdjustments` va nhieu slice `MSTAssignment`

- `cng-c6v` da hoan tat tach bo loc nhan vien khoi `MSTAssignment`:
  - them `src/components/mst-assignment/filters/MstAssignmentStaffFilterPanel.jsx` de rut section bo loc nhan vien phu trach + quick favorites khoi entry-point
  - bo sung `tests/mstAssignmentStaffFilterPanel.test.jsx` de khoa nut save filter, quick favorite apply/remove, va wiring callback
  - `src/components/MSTAssignment.jsx` hien dung panel moi thay vi giu inline block UI cho staff filter
  - targeted verify da pass:
    - `pnpm exec eslint src/components/MSTAssignment.jsx src/components/mst-assignment/filters/MstAssignmentStaffFilterPanel.jsx tests/mstAssignmentStaffFilterPanel.test.jsx tests/mstAssignment.timeline.test.jsx`
    - `pnpm exec vitest run tests/mstAssignmentStaffFilterPanel.test.jsx tests/mstAssignment.timeline.test.jsx --environment jsdom`
  - `detect_changes(scope: "all")` van bao `risk_level: critical` vi worktree dang gom ca refactor chua commit cua `KPIAdjustments` va `MSTAssignment`

- `cng-b9t` da hoan tat timeline shell extraction cho `MSTAssignment`:
  - them `src/components/mst-assignment/timeline/MstAssignmentTimelinePanel.jsx` de tach khung tong hop timeline va dialog shell khoi entry-point
  - bo sung `tests/mstAssignmentTimelinePanel.test.jsx` de khoa trang thai nut tong hop, dialog render, va grouping display co ban
  - `src/components/MSTAssignment.jsx` giam con 2537 dong sau khi rut summary/dialog shell cua timeline
  - targeted verify da pass:
    - `pnpm exec eslint src/components/MSTAssignment.jsx src/components/mst-assignment/timeline/MstAssignmentTimelinePanel.jsx tests/mstAssignmentTimelinePanel.test.jsx tests/mstAssignment.timeline.test.jsx`
    - `pnpm exec vitest run tests/mstAssignmentTimelinePanel.test.jsx tests/mstAssignment.timeline.test.jsx --environment jsdom`

- `cng-ejo` da hoan tat shell decomposition cuoi cho `KPIAdjustments`:
  - them `src/components/kpi-adjustments/panels/KpiAdjustmentOverviewPanel.jsx` de tach card tong quan KPI +/- khoi file goc
  - bo sung `tests/kpiAdjustmentOverviewPanel.test.jsx` de khoa 4 metric tong hop va formatter wiring
  - `src/components/KPIAdjustments.jsx` giam con 564 dong sau khi rut xong overview panel
  - targeted verify da pass:
    - `pnpm exec eslint src/components/KPIAdjustments.jsx src/components/kpi-adjustments/panels/KpiAdjustmentOverviewPanel.jsx tests/kpiAdjustmentOverviewPanel.test.jsx tests/kpiAdjustments.test.jsx`
    - `pnpm exec vitest run tests/kpiAdjustmentOverviewPanel.test.jsx tests/kpiAdjustments.test.jsx --environment jsdom`
  - `detect_changes(scope: "all")` giam xuong `risk_level: medium`, pham vi van tap trung quanh `KPIAdjustments`

- `cng-cpg` da hoan tat form workspace extraction cho `KPIAdjustments`:
  - them `src/components/kpi-adjustments/hooks/useKpiAdjustmentFormWorkspace.js` de gom declaration search/reference workspace, business lookup MST/cong ty, team-filtered staff options, guidance groups, va derived total/license state khoi file chinh
  - bo sung `tests/useKpiAdjustmentFormWorkspace.test.jsx` de khoa lookup append-reference va computed totals/team filtering
  - `src/components/KPIAdjustments.jsx` giam xuong 1021 dong sau khi rut block orchestration lon nhat cua form
  - targeted verify da pass:
    - `pnpm exec eslint src/components/KPIAdjustments.jsx src/components/kpi-adjustments/hooks/useKpiAdjustmentFormWorkspace.js tests/useKpiAdjustmentFormWorkspace.test.jsx tests/kpiAdjustmentFormPanel.test.jsx tests/kpiAdjustments.test.jsx`
    - `pnpm exec vitest run tests/useKpiAdjustmentFormWorkspace.test.jsx tests/kpiAdjustmentFormPanel.test.jsx tests/kpiAdjustments.test.jsx --environment jsdom`
  - `detect_changes(scope: "all")` van bao `risk_level: high` vi tiep tuc cham entry-point `KPIAdjustments`, nhung affected process van chi xoay quanh flow cua chinh component nay

1. `cng-4zp` da hoan tat form/declaration panel decomposition cho `KPIAdjustments`:
   - them `src/components/kpi-adjustments/panels/KpiAdjustmentFormPanel.jsx` de rut card "Them diem KPI +/-", declaration workspace UI, va khu vuc tong hop diem khoi file chinh
   - bo sung `tests/kpiAdjustmentFormPanel.test.jsx` de khoa header actions, declaration workspace callback, edit summary, va history/reset flow
   - targeted verify da pass:
     - `pnpm exec eslint src/components/KPIAdjustments.jsx src/components/kpi-adjustments/panels/KpiAdjustmentFormPanel.jsx tests/kpiAdjustmentFormPanel.test.jsx tests/kpiAdjustments.test.jsx`
     - `pnpm exec vitest run tests/kpiAdjustmentFormPanel.test.jsx tests/kpiAdjustments.test.jsx --environment jsdom`
   - `detect_changes(scope: "all")` bao `risk_level: high` vi van cham entry-point `KPIAdjustments`, nhung pham vi thay doi khop muc tieu panel extraction cua slice nay

2. `cng-e4b` da hoan tat dialog decomposition cho `KPIAdjustments`:
   - them `src/components/kpi-adjustments/panels/KpiAdjustmentDetailDialog.jsx`, `KpiAdjustmentGuidanceDialog.jsx`, va `KpiAdjustmentSettingsDialog.jsx`
   - `src/components/KPIAdjustments.jsx` giam con 1536 dong sau khi rut 3 dialog lon ra panel rieng
   - bo sung `tests/kpiAdjustmentDialogs.test.jsx` de khoa detail reject actions, guidance accordion/actions, va settings submit/reset flow
   - targeted verify da pass:
     - `pnpm exec eslint src/components/KPIAdjustments.jsx src/components/kpi-adjustments/panels/KpiAdjustmentDetailDialog.jsx src/components/kpi-adjustments/panels/KpiAdjustmentGuidanceDialog.jsx src/components/kpi-adjustments/panels/KpiAdjustmentSettingsDialog.jsx tests/kpiAdjustmentDialogs.test.jsx tests/kpiAdjustments.test.jsx`
     - `pnpm exec vitest run tests/kpiAdjustmentDialogs.test.jsx tests/kpiAdjustments.test.jsx tests/kpiAdjustments.hooks.test.jsx tests/kpiAdjustments.model.test.js --environment jsdom`
   - `detect_changes(scope: "all")` bao `risk_level: high` vi cham entry-point `KPIAdjustments`, nhung changed scope van dung ky vong cho slice nay (`KPIAdjustments.jsx` + `task.md`)

3. `cng-4hs` da hoan tat list/filter decomposition cho `KPIAdjustments`:
   - them `src/components/kpi-adjustments/panels/KpiAdjustmentListPanel.jsx` de rut card "Danh sách điểm KPI +/-", bo loc, bang danh sach, va action buttons khoi file chinh
   - bo sung `tests/kpiAdjustmentListPanel.test.jsx` de khoa filter interactions va row action callbacks
   - targeted verify da pass:
     - `pnpm exec eslint src/components/KPIAdjustments.jsx src/components/kpi-adjustments/panels/KpiAdjustmentListPanel.jsx tests/kpiAdjustmentListPanel.test.jsx tests/kpiAdjustments.test.jsx`
     - `pnpm exec vitest run tests/kpiAdjustmentListPanel.test.jsx tests/kpiAdjustments.test.jsx --environment jsdom`
   - `detect_changes(scope: "all")` van bao `risk_level: high` vi chinh entry-point `KPIAdjustments`, nhung pham vi van khop muc tieu refactor UI shell

4. `cng-oo6` da duoc implementation o muc snapshot/insight orchestration extraction cho `AiAssistant`:
   - them `src/components/ai-assistant/hooks/useAiAssistantInsightWorkspace.js` de gom snapshot fetch/cache, KPI summary generation, insight refresh/run/feedback, notify toggle, va snapshot history/detail loading khoi `src/components/AiAssistant.jsx`
   - `src/components/AiAssistant.jsx` giam tu 832 dong xuong 310 dong, hien chu yeu con constants + composition/wiring voi `useAiAssistantConfig`, `useAiConversation`, va hook moi
   - bo sung `tests/useAiAssistantInsightWorkspace.test.jsx` de khoa 3 flow chinh: hydrate insights/settings/history, summary tu cached snapshot, va feedback/notify/history-entry orchestration
   - targeted verify da pass:
     - `pnpm exec eslint src/components/AiAssistant.jsx src/components/ai-assistant/hooks/useAiAssistantInsightWorkspace.js tests/useAiAssistantInsightWorkspace.test.jsx tests/aiAssistant.config.test.jsx tests/aiAssistant.panels.test.jsx tests/useAiAssistantConfig.test.jsx`
     - `pnpm exec vitest run tests/useAiAssistantInsightWorkspace.test.jsx tests/aiAssistant.config.test.jsx tests/aiAssistant.panels.test.jsx tests/useAiAssistantConfig.test.jsx --environment jsdom`
   - `detect_changes(scope: "all")` hien tra ve `risk_level: medium` vi cham entry-point `AiAssistant`, nhung scope dung ky vong cua slice nay

5. `cng-0pm` da duoc implementation o muc hoan tat shell decomposition cho `RulesEditor`:
   - them `src/components/rules-editor/RulesGeneralInfoPanel.jsx` de tach khoi chon bo quy tac, metadata version, va form `name/description` khoi file goc
   - them `src/components/rules-editor/RulesApplyActionsPanel.jsx` de tach khu vuc `applyFrom/applyNow`, save/reset, import/export, va delete action khoi `RulesEditor`
   - import JSON hien dung `ref` ngay trong panel moi, khong con DOM lookup `document.getElementById(...)`
   - bo sung regression tests `tests/rulesGeneralInfoPanel.test.jsx` va `tests/rulesApplyActionsPanel.test.jsx`
   - targeted verify da pass:
     - `pnpm exec eslint src/components/RulesEditor.jsx src/components/rules-editor/RulesGeneralInfoPanel.jsx src/components/rules-editor/RulesApplyActionsPanel.jsx tests/rulesGeneralInfoPanel.test.jsx tests/rulesApplyActionsPanel.test.jsx tests/rulesEditor.test.jsx`
     - `pnpm exec vitest run tests/rulesGeneralInfoPanel.test.jsx tests/rulesApplyActionsPanel.test.jsx tests/rulesEditor.test.jsx tests/rulesEditor.controls.test.jsx tests/useRulesEditorWorkflow.test.jsx tests/rulesEditorHistoryPanel.test.jsx tests/rulesEditorSimulationPanel.test.jsx tests/useRulesTestWorkspace.test.jsx tests/rulesTestWorkspacePanel.test.jsx --environment jsdom`

5. `cng-42t` da duoc implementation o muc test-workspace extraction cho `RulesEditor`:
   - them `src/components/rules-editor/hooks/useRulesTestWorkspace.js` de tach declaration search/pick state, manual KPI scenario state, va derived KPI preview khoi file goc
   - them `src/components/rules-editor/RulesTestWorkspacePanel.jsx` de render hai khu vuc "Test nhanh 1 tờ khai đã import" va "Test nhập tay" thanh panel rieng
   - `src/components/RulesEditor.jsx` hien chi wiring `useRulesTestWorkspace` + `RulesTestWorkspacePanel`, giam them local state va JSX trung lap trong file goc
   - them `tests/useRulesTestWorkspace.test.jsx` va `tests/rulesTestWorkspacePanel.test.jsx` de khoa ca hook state lẫn panel interaction
   - targeted verify da pass:
     - `pnpm exec eslint src/components/RulesEditor.jsx src/components/rules-editor/RulesTestWorkspacePanel.jsx src/components/rules-editor/hooks/useRulesTestWorkspace.js tests/useRulesTestWorkspace.test.jsx tests/rulesTestWorkspacePanel.test.jsx tests/rulesEditor.test.jsx`
     - `pnpm exec vitest run tests/useRulesTestWorkspace.test.jsx tests/rulesTestWorkspacePanel.test.jsx tests/rulesEditor.test.jsx tests/useRulesEditorWorkflow.test.jsx tests/rulesEditorHistoryPanel.test.jsx tests/rulesEditorSimulationPanel.test.jsx --environment jsdom`

6. `cng-lte` da duoc implementation o muc workflow/orchestration extraction cho `RulesEditor`:
   - them `src/components/rules-editor/hooks/useRulesEditorWorkflow.js` de tach save/reset/default/delete/import-export, history refresh/restore, va simulation khoi `src/components/RulesEditor.jsx`
   - `src/components/RulesEditor.jsx` hien giu vai tro compose UI + wiring voi `useRulesConfigState` va `useRulesEditorWorkflow`, khong con giu block handler workflow trung lap
   - them `tests/useRulesEditorWorkflow.test.jsx` de khoa truc tiep 2 flow quan trong: simulation summary va history refresh/restore
   - targeted verify da pass:
     - `pnpm exec eslint src/components/RulesEditor.jsx src/components/rules-editor/hooks/useRulesEditorWorkflow.js tests/useRulesEditorWorkflow.test.jsx tests/rulesEditor.test.jsx`
     - `pnpm exec vitest run tests/useRulesEditorWorkflow.test.jsx tests/rulesEditor.test.jsx tests/rulesEditorHistoryPanel.test.jsx tests/rulesEditorSimulationPanel.test.jsx --environment jsdom`

5. Fact-check review da duoc ghi lai tai:
   - `docs/gemini-review-v1-factcheck-2026-03-25.md`
6. Backlog bead da duoc seed:
   - `cng-xyq` epic
   - `cng-xyq.6` security hardening baseline
   - `cng-xyq.3` React Error Boundary app/tab level
   - `cng-xyq.2` shared StaffCombobox extraction
   - `cng-xyq.1` checklist verification + `Checklist.md`
   - `cng-xyq.5` server-v4 rollout planning beyond reporting
   - `cng-xyq.4` wave-1 frontend decomposition planning
7. `Checklist.md` da duoc cap nhat voi trang thai xac minh hien tai:
   - da danh dau cac muc co bang chung code/test
   - da ghi ro cac muc chua thay, chua khop day du, hoac can E2E/runtime verification
   - cac diem can theo doi them: C/O runtime 500, cot AMA, cleanup toan repo, muc "di lam muon", va mapping tai khoan mac dinh dung theo danh sach nghiep vu
8. Draft rollout plan cho `server-v4` beyond reporting da duoc ghi lai tai:
   - `docs/server-v4-rollout-plan-2026-03-25.md`
   - bao gom:
     - inventory route `legacy` va `v4` can doi chieu
     - cac parity gap hien tai, dac biet quanh `auth` va `declarations`
     - thu tu rollout theo wave thay vi mount dong loat 8 module
     - verify gate va test suite nen chay cho moi wave
9. `cng-xyq.7` dang implementation wave-1 mount:
   - them `server/v4RolloutMount.js` de co dinh danh sach module wave-1 va helper chon module tu compiled `moduleCatalog`
   - doi legacy mount tu `reporting` don le sang `reporting + teams + mst-assignments + hq-agencies`
   - them `tests/v4RolloutMount.test.js` de khoa logic selection va missing-module warning path
10. `cng-wh8` da duoc mo cho wave-2 mount:
   - muc tieu tiep theo la mount `kpi-rules` va `kpi-adjustments` qua legacy server sau khi wave-1 da on dinh
   - can chay impact analysis truoc khi cham vao startup mount helper va verify lai toan bo matrix `reporting + wave-1 + wave-2`
11. `cng-wh8` da duoc implementation o muc code/test:
   - mo rong `server/v4RolloutMount.js` bang `WAVE2_V4_MODULE_IDS`, `LEGACY_V4_MODULE_IDS`, `selectV4Modules`, va `selectLegacyV4Modules`
   - legacy server startup mount hien chon tong hop `reporting + teams + mst-assignments + hq-agencies + kpi-rules + kpi-adjustments`
   - bo sung regression tests cho selector legacy-v4 tong hop va missing-module path cua wave-2
12. `cng-d0a` da duoc mo cho auth parity:
   - muc tieu tiep theo la dua cac endpoint auth con thieu ve `server-v4` truoc khi xu ly declarations shadow/cutover
   - can doi chieu lai 3 parity gap da note trong rollout plan va verify lai auth route matrix
13. `cng-d0a` da duoc implementation o muc code/test:
   - canonical `/api/v4/auth` da bo sung `POST /accounts/:username/password`, `DELETE /accounts/:username`, va `POST /password/change`
   - `AuthService` va `AuthController` da co canonical home cho 3 flow con thieu, thay vi chi ton tai o compat layer
   - auth regression tests da cover password reset, self-change password, delete account, boundary permission, va last-admin guard
14. `cng-0fs` da duoc mo cho declarations shadow:
   - day la domain blast radius cao nhat, can shadow parity + compat telemetry truoc write cutover
   - verify gate se tap trung vao ECUS preview/commit, alerts config/review, C/O discrepancy, va declaration history/edit
15. `cng-0fs` da duoc implementation o muc rollout status + test gate:
   - them `server-v4/src/app/declarationsShadowRollout.ts` de tong hop 4 declaration shadow groups: ECUS preview/commit, alerts config/review, C/O discrepancy, va declaration history/edit parity
   - `/api/v4/meta/rollout` hien bo sung `compatibility.declarationShadow` va them declaration-specific migration checks, de operator biet ro nhom nao dang xanh, nhom nao van con legacy compat hits
   - rollout tests da khoa pass-path khi khong co legacy hits va warn-path khi route migrated van bi goi qua compat layer
   - app-shell/legacy-compat fixtures da duoc lam ben vung hon, khong con phu thuoc vao file sqlite mac dinh ton tai trong worktree
16. `cng-2wn` da duoc implementation o muc declarations cutover policy:
   - them `server-v4/src/app/declarationsWriteCutover.ts` de tong hop readiness rieng cho declarations write cutover, tach biet shadow parity voi cutover readiness thuc su
   - `/api/v4/meta/rollout` hien bo sung `compatibility.declarationCutover` va migration check `declarations-write-cutover-policy`, dua tren guard mode, migrated compat hits, va declaration shadow gate health
   - readiness/stage `cutover-ready` khong con len xanh chi vi runtime da relational-store; declarations phai co `block-migrated` + zero migrated compat hits + shadow gate xanh moi duoc xem la ready
   - them regression test moi `tests/server-v4/declarationsWriteCutover.test.js` va cap nhat `v4RolloutStatus`/`appShell` expectations cho hold/ready/blocked transitions
17. `cng-7wv` da duoc implementation o muc runtime config wiring:
   - `server-v4/src/config/server-v4-config.ts` hien co field chinh thuc `importerCompatGuardMode` va validate hai mode `off` / `block-migrated`
   - `buildV4App` fallback sang runtime config khi caller khong truyen `options.importerCompat.guardMode`, nen block mode co the bat qua config thay vi patch tracker thu cong
   - `apps/api/src/startApiServer.js` forward top-level `importerCompatGuardMode` xuong compiled `server-v4`, dong bo voi env `KPI_API_IMPORTER_COMPAT_GUARD_MODE`
   - regression tests da khoa ca config env/apps-api path va route behavior path cho `off` vs `block-migrated`
18. `cng-xyq.4` da duoc implementation o muc decomposition planning:
   - them artifact goc `frontend-wave1-decomposition.md` tai project root de chot wave-1 backlog cho `MSTAssignment`, `KPIAdjustments`, `AiAssistant`, va `RulesEditor`
   - chot thu tu tach nho an toan theo huong `pure/presentational truoc, hooks/panel stateful sau`
   - xac dinh ro gap test hien tai: `RulesEditor` chua co test truc tiep, can dat baseline test truoc khi rut component
   - seed them 4 bead follow-up de backlog khong dung o muc tai lieu:
     - `cng-xyq.8` MSTAssignment helper + layout decomposition
     - `cng-xyq.9` KPIAdjustments pure calculation + form hook decomposition
     - `cng-xyq.10` AiAssistant snapshot/provider/history helper decomposition
     - `cng-xyq.11` RulesEditor baseline test + panel decomposition
19. `cng-xyq.8` da duoc implementation o muc helper extraction:
   - tach `HistoryDetails`, `StageTimelinePreview`, `StageTimelineGroups`, va `ColumnResizeHandle` ra khoi `src/components/MSTAssignment.jsx` thanh module rieng duoi `src/components/mst-assignment/`
   - `MSTAssignment.jsx` giam tu moc backlog 3170 dong xuong 2973 dong sau helper extraction
   - targeted verify da pass:
     - `pnpm exec vitest run tests/mstAssignment.timeline.test.jsx tests/mstAssignment.column-widths.test.jsx tests/mstAssignment.column-visibility.test.jsx tests/mstAssignment.pagination.test.jsx --environment jsdom`
     - `pnpm exec eslint src/components/MSTAssignment.jsx src/components/mst-assignment/timeline/HistoryDetails.jsx src/components/mst-assignment/timeline/StageTimelinePreview.jsx src/components/mst-assignment/timeline/StageTimelineGroups.jsx src/components/mst-assignment/table/ColumnResizeHandle.jsx`
   - tach them bead `cng-xyq.12` de xu ly phan con lai cua MSTAssignment state/layout hook ma khong lam bead helper extraction bi qua to
20. `cng-xyq.12` da duoc implementation o muc state/layout hook extraction:
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

- Title: Add skip-to-content keyboard navigation affordance
- Bead: none
- Status: done
- Follow-up backlog:
  - khong co follow-up mo trong bead tracker sau khi dong `cng-2k4.24` va epic `cng-2k4`

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
21. `cng-jyz` da xong o muc tach config tab/orchestration khoi `RulesEditor`:
   - them `src/components/rules-editor/RulesConfigTabsPanel.jsx` de gom JSX cho 3 tab `groups/license/bonus`
   - them `src/components/rules-editor/hooks/useRulesConfigState.js` de tach derived state + handler `groups/license/agencies` khoi file chinh
   - `src/components/RulesEditor.jsx` hien chi wiring panel/hook moi, khong con giu inline block config tab va handler update lien quan
   - bo sung regression tests `tests/rulesEditorConfigTabsPanel.test.jsx` va `tests/useRulesConfigState.test.jsx`
   - targeted verify da pass:
     - `pnpm exec vitest run tests/useRulesConfigState.test.jsx tests/rulesEditorConfigTabsPanel.test.jsx tests/rulesEditor.test.jsx --environment jsdom`
     - `pnpm exec eslint src/components/RulesEditor.jsx src/components/rules-editor/RulesConfigTabsPanel.jsx src/components/rules-editor/hooks/useRulesConfigState.js tests/rulesEditorConfigTabsPanel.test.jsx tests/useRulesConfigState.test.jsx`

## Notes

- GitNexus impact/context dang bi lock file `.gitnexus/lbug` do session `gitnexus serve`; tam thoi da fallback sang caller grep de scope edit an toan.
- Working tree hien co thay doi chua commit cho `cng-xyq.7`; `cng-xyq.5` da duoc commit thanh rollout-plan artifact rieng.
- `package.json` da co script `gitnexus:serve` tu thay doi truoc do; phien nay bo sung them dependency `helmet` va `express-rate-limit`.
- `cng-9dx` chi dong bo tai lieu/notebook, khong thay doi runtime code.
- `cng-xyq.3` khong doi logic nghiep vu; chi tang guardrail de app shell va tung module co fallback ro rang khi render/runtime error xay ra.
- `cng-xyq.2` co working tree chua commit. Shared component moi da co test rieng; lint con 2 warning `react-refresh/only-export-components` do file export helper thuần.
- GitNexus `detect_changes(scope: "all" | "unstaged")` trong worktree nay dang tra `No changes detected` du `git status` van co diff local; can xem ket qua nay la khong du tin cay cho slice `cng-jyz`.
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
- `cng-jyz` da duoc mo va claim cho wave-2 `RulesEditor`; slice config tabs da xong truoc do, va `cng-lte` vua hoan tat phan workflow save/restore/simulation orchestration tiep theo.
- `gitnexus_detect_changes(scope: "all")` van tra `No changes detected` ngay ca sau helper extraction, nen tiep tuc coi day la van de worktree-awareness cua GitNexus; gate thuc te van dua tren `git status`, lint, va test muc tieu.
- `tests/server.monitor.test.js` van in stderr khi `dist/server-v4/index.js` khong co trong vitest runtime, nhung suite van pass vi startup path fallback dung nhu hien trang.
- GitNexus `detect_changes` da hoat dong dung tro lai trong worktree nay sau khi xoa index cu trung ten cua repo goc `E:\GPT\kpi_source_code_v4`; root cause la registry co 2 entry cung ten `kpi_source_code_v4`.
- `cng-7z0.32` da hoan tat audit accessibility cho `Import Data`, `Gán MST`, va `Điểm KPI +/- Thêm`:
  - them smoke audit `tests/playwright/accessibility-admin.spec.js` dung `axe-core` de quet 3 tab admin runtime
  - fix accessible name cho date/select controls trong `DataImporter*`, bo sung keyboard focus cho vung bang cuon ngang cua `DataImporter` va `MSTAssignment`, va tang contrast cho toolbar/badge/button text trong workflow import
  - targeted verify da pass:
    - `pnpm exec eslint src/components/dataImporter/DataImporterMonitoringPanel.jsx src/components/dataImporter/DataImporterQueryFilterControls.jsx src/components/dataImporter/DataImporterTableResults.jsx src/components/dataImporter/DataImporterSyncPreviewPanel.jsx src/components/dataImporter/DataImporterCoCodeConfigPanel.jsx src/components/dataImporter/DataImporterGridToolbarControls.jsx src/components/dataImporter/DataImporterListControlsPanel.jsx src/components/mst-assignment/table/MstAssignmentDataTablePanel.jsx tests/playwright/accessibility-admin.spec.js`
    - `pnpm run build`
    - `pnpm exec playwright test tests/playwright/accessibility-admin.spec.js --config=playwright.config.mjs --workers=1`
- `cng-7z0.33` da hoan tat:
  - `tests/playwright/sync-flow.spec.js` gio co them regression runtime cho bo loc MST + khoang ngay va quick-search tren bang preview sau sync preview
  - targeted verify da pass:
    - `pnpm exec eslint tests/playwright/sync-flow.spec.js`
    - `pnpm exec playwright test tests/playwright/sync-flow.spec.js --config=playwright.config.mjs --workers=1`
- `cng-2k4.22 / slice G` da xong o muc cleanup production export hygiene:
  - xoa 4 helper adjustment summary da chet trong `server/reportExport.js` va bo import `createAdjustmentTotals` khong con dung den
  - GitNexus impact truoc khi sua cho 4 helper deu `LOW`, `impactedCount: 0`; `detect_changes` van over-report `critical` do file-level process mapping, nhung diff tay xac nhan chi cham dead-code cleanup + `task.md`
  - targeted verify da pass:
    - `pnpm exec eslint server/reportExport.js`
    - `pnpm exec vitest run tests/server.reportWatermark.test.js tests/reportExportPayloads.test.js --environment node`
- `cng-2k4.22 / slice H` da xong o muc react-refresh hygiene:
  - tach helper schedule draft sang `src/components/reporting/reportingScheduleDraft.js` va helper staff roster sang `src/components/shared/staffComboboxOptions.js`
  - cap nhat caller `useReportViewerActions`, `AccountManager`, `useMSTAssignmentBootstrapWorkspace`, va test imports de giu nguyen contract
  - targeted verify da pass:
    - `pnpm exec eslint src/components/reporting/ReportingPanels.jsx src/components/reporting/reportingScheduleDraft.js src/components/reporting/useReportViewerActions.js src/components/shared/StaffCombobox.jsx src/components/shared/staffComboboxOptions.js src/components/AccountManager.jsx src/components/mst-assignment/hooks/useMSTAssignmentBootstrapWorkspace.js tests/reportingPanels.test.jsx tests/reportingScheduleDraft.test.js tests/staffCombobox.test.jsx tests/staffComboboxOptions.test.js tests/accountManager.staff.test.jsx tests/useMSTAssignmentBootstrapWorkspace.test.jsx`
    - `pnpm exec vitest run tests/reportingPanels.test.jsx tests/reportingScheduleDraft.test.js tests/staffCombobox.test.jsx tests/staffComboboxOptions.test.js tests/accountManager.staff.test.jsx tests/useMSTAssignmentBootstrapWorkspace.test.jsx --environment jsdom`
- `cng-2k4.22 / slice I` da xong o muc report shell regression hardening:
  - them browser regression trong `tests/playwright/lazy-tab-shell.spec.js` de khoa fallback focus khi workflow guide mo `Báo cáo KPI` luc `ReportCenterPanel` chunk con dang treo
  - them browser regression trong `tests/playwright/report-viewer.spec.js` de khoa handoff focus tu action `Tới khu export`
  - them `tests/kpiCalculator.navigation.test.jsx` de khoa loading status va fallback focus cua `KPICalculator` o jsdom contract level
  - targeted verify da pass:
    - `pnpm exec eslint tests/playwright/lazy-tab-shell.spec.js tests/playwright/report-viewer.spec.js`
    - `pnpm exec playwright test tests/playwright/lazy-tab-shell.spec.js tests/playwright/report-viewer.spec.js --config=playwright.config.mjs --workers=1`
    - `pnpm exec eslint tests/kpiCalculator.navigation.test.jsx tests/kpiCalculator.errorBoundary.test.jsx`
    - `pnpm exec vitest run tests/kpiCalculator.navigation.test.jsx tests/kpiCalculator.errorBoundary.test.jsx --environment jsdom`

## Previous Completed Slice

- `cng-4fo` — Fact-check Gemini review V1 va seed backlog follow-up
- `cng-bik` — Bo sung test cho canh bao disk error trong healthcheck
