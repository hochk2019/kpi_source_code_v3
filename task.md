# Task Tracker

## Active Slice

- Title: Tach DataHealthDashboard storage overview panel
- Bead: cng-dsv
- Status: completed
- Last updated: 2026-03-27

- `cng-dsv` da hoan tat tach cum 3 card storage overview khoi `DataHealthDashboard` sang `src/components/data-health-dashboard/DataHealthStorageOverviewPanel.jsx`; shell hien chi build view-model props cho backup / dung luong he thong / SQL Server, con regression test moi khoa ca branch co du lieu va fallback branch khi thieu nhat ky + SQLite stats.
- `cng-aqp` da hoan tat tach permission group list dung chung khoi `AccountManager` sang `src/components/account-manager/AccountPermissionGroupsPanel.jsx`; shell hien chi giu toolbar/orchestration cho create-form va permission dialog, con regression test moi khoa collapse state, count label, disabled rule, va permission toggle callback.
- `cng-dhd` da hoan tat tach `resolveCategoryOptions` va `CATEGORY_OPTIONS` khoi `KPIAdjustments` sang `src/components/kpi-adjustments/model/categoryOptions.js`; shell hien import lai constant moi cho form/list config, con unit test moi khoa mapping tu `KPI_ADJUSTMENT_CATEGORY_CONFIG`.
- `cng-0jn` da hoan tat tach `buildStaffOptions` khoi `KPIAdjustments` sang `src/components/kpi-adjustments/model/staffOptions.js`; shell hien import lai helper moi cho derived `staffOptions` ma khong doi shape `{ team, name }`, con unit test moi khoa flatten roster va trim member names.
- `cng-u7h` da hoan tat tach `parseReferences` khoi `KPIAdjustments` sang `src/components/kpi-adjustments/model/referenceParsing.js`; shell hien import lai helper moi cho 2 hook form/workspace ma khong doi contract prop, con unit test moi khoa behavior tach reference, normalize, va dedupe.
- `cng-pnz` da hoan tat tach `normalizeFieldSegment`, `buildSettingsFieldId`, va `buildLicenseFieldId` khoi `KPIAdjustments` sang `src/components/kpi-adjustments/model/fieldIds.js`; shell hien import lai helper moi cho settings dialog wiring, con unit test moi khoa contract sanitize segment va field-id generation.
- `cng-lch` da hoan tat tach `formatDateOnly`, `formatInt`, va `formatDecimal` khoi `KPIAdjustments` sang `src/components/kpi-adjustments/model/formatting.js`; shell hien import lai helper moi cho form/list/overview dialogs, con unit test moi khoa date/int/decimal formatting contract.
- `cng-y03` da hoan tat tach `AssigneeCell` khoi `MSTAssignment` sang `src/components/mst-assignment/table/AssigneeCell.jsx`; shell hien import lai component moi cho cot phu trach, con regression test person-columns da tro thang vao module moi de khoa display clamp, team hint, va che do edit.
- `cng-gpl` da hoan tat tach wrapper `MstAssignmentStaffCombobox` khoi `MSTAssignment` sang `src/components/mst-assignment/shared/MstAssignmentStaffCombobox.jsx`; shell hien import lai wrapper moi cho ca `AssigneeCell` va `MstAssignmentAddFormPanel`, con regression test moi khoa 3 preset `allowCustom`/`preserveTeamOnCustom`/`preserveTeamOnClear`.
- `cng-s7x` da hoan tat tach `CompanyNameCell` khoi `MSTAssignment` sang `src/components/mst-assignment/table/CompanyNameCell.jsx`; shell hien import lai component moi cho cot cong ty, con regression test company-name da tro thang vao module moi de khoa sanitize/wrap/textarea resize behavior.
- `cng-y9o` da hoan tat tach `PersonColumnHeader` khoi `MSTAssignment` sang `src/components/mst-assignment/table/PersonColumnHeader.jsx`; shell hien import lai header moi cho cac cot `person_import`/`person_export`, con regression test person-columns da tro thang vao module moi de khoa presentation metadata va tooltip behavior.
- `cng-8j3` da hoan tat tach `PageSizeControl` khoi `MSTAssignment` sang `src/components/mst-assignment/table/PageSizeControl.jsx`; shell hien import lai control moi cho footer pagination, con regression test pagination da tro thang vao module moi de khoa hanh vi select/custom page-size.
- `cng-crs` da hoan tat tach `createRowState` khoi `MSTAssignment` sang `src/components/mst-assignment/model/createRowState.js`; shell hien import lai helper moi cho luong bootstrap/add-form/import-save/row-commit va giu nguyen contract cua cac workspace da tach truoc do.
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

- Title: Ra soat DataHealthDashboard metrics + alert cards de chon panel extraction tiep theo
- Bead: `TBD`
- Status: san sang tao bead tiep theo
- Follow-up backlog:
  - `DataHealthDashboard.jsx` da giam mot cum presentation lon sau khi tach storage overview; buoc tiep theo hop ly la ra soat tiep cac the metrics/alert o nua tren thay vi quay lai helper extraction
  - uu tien mot panel/card extraction tiep tuc o muc presentation, tranh lan sang async fetch orchestration, notification stream subscription, va policy editor form neu chua can
  - truoc khi chon slice moi, tiep tuc chay GitNexus impact/context cho symbol dich de giu diff nho va co test regression ro rang

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

## Previous Completed Slice

- `cng-4fo` — Fact-check Gemini review V1 va seed backlog follow-up
- `cng-bik` — Bo sung test cho canh bao disk error trong healthcheck
