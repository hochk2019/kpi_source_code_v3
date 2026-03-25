# Task Tracker

## Active Slice

- Title: Mount wave-2 server-v4 KPI modules through legacy server
- Bead: `cng-wh8`
- Status: in_progress
- Last updated: 2026-03-25

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

## Next Suggested Slice

- Title: Thuc hien wave-2 mount `kpi-rules` + `kpi-adjustments`
- Bead: `cng-wh8`
- Status: in_progress
3. `cng-xyq.6` da duoc implementation va dong bead:
   - them `helmet` + `express-rate-limit`
   - them `server/securityHardening.js`
   - them shared `packages/domain/src/passwordPolicy.js`
   - nang password minimum length len `8`
   - dong bo `server/index.js`, `src/auth/localAuth.js`, UI auth/account, va test/mock lien quan
4. `cng-9dx` da dong bo tai lieu sau `cng-xyq.6`:
   - cap nhat `docs/gemini-review-v1-factcheck-2026-03-25.md` de loai bo cac nhan dinh da stale ve `helmet`, login rate limit va password policy
   - bo sung `docs/USER_GUIDE.md` voi quy dinh mat khau toi thieu `8` ky tu cho bootstrap, tao tai khoan, dat lai va doi mat khau
5. `cng-xyq.3` da duoc implementation:
   - them reusable `RuntimeErrorBoundary`
   - them `AppRoot` de boundary boc cap ung dung tu entrypoint `src/main.jsx`
   - boc tung `TabPanel` trong `KPICalculator` bang boundary cap module/tab de tranh white-screen khi mot panel loi
   - them regression tests cho app-level fallback va tab-level fallback
6. `cng-xyq.2` da duoc implementation:
   - them shared `src/components/shared/StaffCombobox.jsx` va helper normalize roster/member cho ca assignment mode va member mode
   - thay local duplicate implementation tai `MSTAssignment`, `AccountManager` va data importer bang shared component/wrapper gon nhe
   - giu contract importer assignment payload on dinh, dong thoi bo sung test moi `tests/staffCombobox.test.jsx`
   - cap nhat regression tests lien quan cho `AccountManager` sau khi chuyen trigger sang role `combobox`

## Verification

- Node tests:
  - `pnpm exec vitest run tests/passwordPolicy.test.js tests/securityHardening.test.js --environment node`
  - `pnpm exec vitest run tests/v4RolloutMount.test.js tests/server.monitor.test.js tests/server-v4/appShell.test.js tests/server-v4/legacyCompatRoutes.test.js tests/server-v4/postgresTeamsRoute.test.js tests/server-v4/postgresMstAssignmentsRoute.test.js tests/server-v4/postgresHqAgenciesRoute.test.js --environment node`
- Frontend/jsdom tests:
  - `pnpm exec vitest run tests/auth.test.jsx tests/accountManager.staff.test.jsx tests/automation.flows.test.js tests/e2e.admin-flows.test.jsx --environment jsdom`
  - `pnpm exec vitest run tests/runtimeErrorBoundary.test.jsx tests/appRoot.errorBoundary.test.jsx tests/kpiCalculator.errorBoundary.test.jsx tests/appShellFrame.test.jsx --environment jsdom`
  - `pnpm exec vitest run tests/staffCombobox.test.jsx tests/dataImporterAssignmentComboboxes.test.jsx tests/accountManager.staff.test.jsx tests/mstAssignment.person-columns.test.jsx`
- Targeted lint:
  - `pnpm exec eslint server/index.js server/v4RolloutMount.js tests/v4RolloutMount.test.js`
  - `pnpm exec eslint server/index.js server/securityHardening.js packages/domain/src/passwordPolicy.js src/auth/localAuth.js src/components/ChangePasswordDialog.jsx src/components/AccountManager.jsx tests/passwordPolicy.test.js tests/securityHardening.test.js tests/helpers/mockApi.js tests/helpers/mockApiState.js tests/automation.flows.test.js tests/e2e.admin-flows.test.jsx tests/playwright/account-management.spec.js`
  - `pnpm exec eslint src/main.jsx src/AppRoot.jsx src/components/errorBoundaries/RuntimeErrorBoundary.jsx src/components/KPICalculator.jsx tests/runtimeErrorBoundary.test.jsx tests/appRoot.errorBoundary.test.jsx tests/kpiCalculator.errorBoundary.test.jsx`
  - `pnpm exec eslint src/components/shared/StaffCombobox.jsx src/components/dataImporter/DataImporterAssignmentComboboxes.jsx src/components/AccountManager.jsx tests/accountManager.staff.test.jsx tests/staffCombobox.test.jsx`
- GitNexus scope check:
  - `detect_changes(scope: "all")` -> `risk_level: low`
  - `detect_changes(scope: "all")` sau `cng-xyq.2` -> `risk_level: high` do diff cham 2 file lon (`AccountManager.jsx`, `MSTAssignment.jsx`), nhung 4 test muc tieu cua shared combobox/account/importer/mst deu pass

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
- `tests/server.monitor.test.js` van in stderr khi `dist/server-v4/index.js` khong co trong vitest runtime, nhung suite van pass vi startup path fallback dung nhu hien trang.

## Previous Completed Slice

- `cng-4fo` — Fact-check Gemini review V1 va seed backlog follow-up
- `cng-bik` — Bo sung test cho canh bao disk error trong healthcheck
