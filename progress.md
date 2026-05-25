# Progress Log

## Session: 2026-03-17

### Slice: `cng-mtn` remediation backlog for app shell and report UX audit

- Tái nạp context từ audit `cng-cki` và gom lại các điểm bất thường cần khắc phục.
- Đọc các hotspot chính liên quan tới shell/report:
  - `src/components/appShell/AppShellFrame.jsx`
  - `src/components/appShell/AppShellWorkflowGuide.jsx`
  - `src/components/appShell/appShellWorkflowState.js`
  - `src/components/KPICalculator.jsx`
  - `src/App.css`
  - `src/components/workflows/ReportCenterPanel.jsx`
  - `src/components/ReportViewer.jsx`
  - `src/components/reporting/ReportingDashboardOverview.jsx`
- Dùng guideline từ `ui-ux-designer` và `ui-ux-pro-max` để chốt ba hướng chính:
  - mobile-first thay vì desktop co nhỏ
  - focus order và navigation clarity phải giữ vững khi sửa shell
  - report là data-dense dashboard nhưng cần hierarchy mạnh hơn và progressive disclosure trên mobile
- Tạo epic `cng-mtn` và các bead con `cng-mtn.1` tới `cng-mtn.6`.
- Giữ backend/database ở chế độ điều tra có điều kiện thay vì khẳng định sớm là lỗi server-side.

## Status

- Backlog remediation đã được tạo.
- Epic `cng-mtn` đang là điểm neo cho các lượt triển khai tiếp theo.

### Slice: `cng-mtn.1` shell foundation

- Claim bead `cng-mtn.1` và tập trung vào hiện tượng sidebar tabs chồng lớp ở App Shell.
- Xác định nguyên nhân gốc nằm ở tab primitives:
  - shell muốn tab dạng stacked card với `padding` lớn và caption 2 dòng
  - nhưng `TabsTrigger`/`TabsList` mặc định vẫn inject utility classes kiểu compact tab, kéo chiều cao thực xuống ~29px trong bundle cũ
- Sửa `src/components/ui/tabs.jsx` để hỗ trợ prop `unstyled` cho `TabsList` và `TabsTrigger`.
- Sửa `src/components/appShell/AppShellFrame.jsx` để shell navigation opt out khỏi default tab styling và chỉ dùng class shell chuyên biệt.
- Thêm regression test:
  - `tests/tabs.test.jsx` khóa behavior `unstyled` vs default styling
  - `tests/playwright/ui-shell-sidebar.spec.js` xác nhận sidebar tabs không overlap ở desktop/mobile
- Ghi nhận một điểm verify quan trọng:
  - Playwright config dùng `vite preview`, nên khi đọc kết quả UI phải rebuild `dist` trước; nếu không có thể chẩn đoán nhầm trên bundle cũ.
- Verify pass:
  - `pnpm exec vitest run tests/appShellFrame.test.jsx tests/tabs.test.jsx --environment jsdom`
  - `pnpm exec playwright test tests/playwright/ui-shell-sidebar.spec.js --config=playwright.config.mjs --workers=1`

## Next

- Bước hợp lý tiếp theo là `cng-mtn.3`: điều tra bug chuyển tuần tự sang `Báo cáo KPI` sau chuỗi navigation dài.

### Slice: `cng-mtn.2` responsive shell + compact mode

- Claim bead `cng-mtn.2` và khôi phục context từ notebook + bead state trước khi sửa App Shell.
- Đọc lại `AppShellFrame`, `AppShellWorkflowGuide`, `KPICalculator`, `App.css`, và regression tests để xác nhận phạm vi thay đổi chỉ nằm ở shell/workflow chrome.
- Dùng guideline từ `ui-ux-designer` và `ui-ux-pro-max` để chốt hướng sửa:
  - compact navigation phải là behavior thật, không chỉ giảm font/padding của layout desktop
  - mobile cần giảm copy phụ và height của chrome trước khi chạm tới panel thao tác chính
  - touch target/action button giữ tối thiểu ~44px
- Sửa `src/components/appShell/AppShellFrame.jsx`:
  - thêm compact layout detection theo viewport
  - thêm compact summary cho shell mobile
  - đổi navigation groups sang dạng mở/đóng trên mobile, đồng bộ section đang mở theo tab hiện tại
  - giữ desktop sidebar đầy đủ và không đụng lại fix `unstyled` của `cng-mtn.1`
- Sửa `src/App.css`:
  - ẩn brand copy dài trên mobile
  - nén hero/meta spacing
  - giảm height của nav cards nhưng vẫn giữ touch target rõ ràng
  - chỉ hiện tab caption cho active item ở mobile để giảm vertical noise
- Sửa `src/components/appShell/AppShellWorkflowGuide.jsx`:
  - giảm padding tổng thể
  - tăng min-height cho action buttons và step cards để giữ thao tác cảm ứng ổn định
- Cập nhật regression tests:
  - `tests/appShellFrame.test.jsx` thêm case compact mode với nav groups collapse/expand
  - `tests/playwright/ui-shell-sidebar.spec.js` đổi mobile assertion sang compact navigation thật thay vì giả định mọi tab luôn mở
- Ghi nhận một điểm verify quan trọng:
  - Playwright trong repo này vẫn chạy `vite preview`, nên phải `pnpm build` trước khi đọc kết quả UI; nếu không test browser sẽ dùng `dist` cũ.
- Verify pass:
  - `pnpm exec vitest run tests/appShellFrame.test.jsx tests/appShellWorkflowGuide.test.jsx tests/appShellNavigation.test.js tests/tabs.test.jsx --environment jsdom`
  - `pnpm build`
  - `pnpm exec playwright test tests/playwright/ui-shell-sidebar.spec.js --config=playwright.config.mjs --workers=1`

### Slice: `cng-mtn.3` sequential navigation into reports

- Claim bead `cng-mtn.3` và bắt đầu bằng root-cause investigation thay vì sửa thẳng theo giả thuyết `pendingFocusTarget`.
- Đọc lại các hotspot:
  - `src/components/KPICalculator.jsx`
  - `src/components/workflows/ReportCenterPanel.jsx`
  - `src/components/appShell/appShellWorkflowState.js`
  - `src/components/appShell/AppShellFrame.jsx`
  - `src/components/ui/tabs.jsx`
  - `tests/playwright/utils.js`
  - `tests/playwright/report-viewer.spec.js`
- Viết regression Playwright mới cho desktop:
  - chuỗi `Import -> Accounts -> Teams -> HQ -> Reports`
  - xác nhận `#app-tab-root-reports` và region `Điều khiển báo cáo KPI` vẫn hiện
- Lần chạy RED đầu tiên fail sớm ở `Tài khoản`, không phải ở report panel:
  - locator tab governance nằm ngoài viewport
  - từ đó loại bỏ giả thuyết ban đầu rằng report shell hoặc `pendingFocusTarget` là nguyên nhân chính
- Điều tra CSS shell cho thấy desktop sidebar đang `position: sticky` nhưng không có `max-height/overflow`, nên các tab governance có thể bị clip khỏi viewport trong shell dài.
- Sửa `src/App.css`:
  - thêm `max-height: calc(100vh - 2rem)`
  - thêm `overflow-y: auto`
  - thêm `overscroll-behavior: contain`
- Rerun desktop regression: pass.
- Viết regression Playwright mới cho mobile compact shell với cùng chuỗi điều hướng.
- Lần chạy RED cho mobile fail tại `Import Data`:
  - helper cũ chờ tab visible ngay lập tức
  - nhưng compact shell chỉ render tab của nav group đang mở
- Sửa `tests/playwright/utils.js`:
  - thêm helper `revealTab`
  - tự mở đúng `.ds-app-shell__group-toggle` khi tab đang nằm trong group collapsed
  - scroll tab vào view trước khi click
  - giữ fallback Command Center cho import flow
- Rerun mobile regression: pass.
- Kết luận điều tra:
  - không có bằng chứng rằng `ReportCenterPanel`, `ReportViewer`, `pendingFocusTarget`, hay lifecycle report là gốc lỗi bead này
  - lỗi thực tế nằm ở shell reachability + Playwright navigation helper chưa theo kịp compact navigation
- Verify pass:
  - `pnpm build`
  - `pnpm exec playwright test tests/playwright/report-viewer.spec.js --config=playwright.config.mjs --workers=1 --grep "điều hướng tuần tự vẫn mở được báo cáo KPI sau khi đi qua nhiều tab"`
  - `pnpm exec playwright test tests/playwright/report-viewer.spec.js --config=playwright.config.mjs --workers=1 --grep "mobile compact shell vẫn mở được báo cáo KPI sau chuỗi điều hướng tuần tự"`
  - `pnpm exec playwright test tests/playwright/ui-shell-sidebar.spec.js tests/playwright/report-viewer.spec.js tests/playwright/account-management.spec.js tests/playwright/team-management.spec.js tests/playwright/hq-agency.spec.js tests/playwright/import-flow.spec.js tests/playwright/export-flow.spec.js tests/playwright/sync-flow.spec.js --config=playwright.config.mjs --workers=1`

## Next

- Bước hợp lý tiếp theo là `cng-mtn.4`: tái cấu trúc information architecture của `Báo cáo KPI` để giảm density và tăng readability trên desktop/mobile.

### Slice: `cng-mtn.4` report information architecture + mobile readability

- Claim bead `cng-mtn.4` và bắt đầu bằng cách đọc lại `ReportCenterPanel`, `ReportViewer`, `ReportingDashboardOverview`, `ReportingScopeExplorerPanel`, `ReportingPanels`, `appShellWorkflowState`, cùng các test liên quan.
- Xác định hotspot thật không nằm ở outer workflow shell nữa mà nằm trong `ReportViewer`:
  - controls
  - schedule form
  - dashboard overview
  - scope explorer
  - notes
  đang bị xếp nối tiếp như một cột dài, làm mobile phải lướt qua form/lịch gửi quá sớm trước khi đọc insight.
- Giữ macro workflow 3 bước của `ReportCenterPanel`, nhưng tái cấu trúc workspace bên trong report:
  - `ReportingWorkspaceGuidePanel` mới với quick-jump anchors
  - section ids rõ ràng cho `insights`, `explorer`, `schedule`, `notes`
  - thứ tự đọc mới: controls -> guide -> insights -> drill-down -> schedule -> notes
- Sửa `src/components/reporting/ReportingPanels.jsx`:
  - thêm `ReportingWorkspaceGuidePanel`
  - tăng khả năng co giãn mobile cho các filter controls đầu trang
  - giữ metadata/action layout nhất quán với shell primitives
- Sửa `src/components/ReportViewer.jsx`:
  - bọc dashboard, explorer và notes bằng `SectionSurface`
  - thêm `SectionHeader` cho từng cụm
  - dời schedule xuống sau phần drill-down để giảm cognitive load trên mobile
- Sửa `src/components/reporting/ReportingScopeExplorerPanel.jsx`:
  - bỏ outer `ds-card` lồng thừa
  - cho header/select/footnote stack tốt hơn trên mobile
- Cập nhật copy định hướng ở:
  - `src/components/workflows/ReportCenterPanel.jsx`
  - `src/components/appShell/appShellWorkflowState.js`
  để phản ánh đúng mental model mới: scope -> insight/drill-down -> publish/audit.
- Cập nhật verify:
  - `tests/reportViewer.test.jsx` thêm case kiểm tra hierarchy mới và DOM order giữa các section chính
  - `tests/playwright/report-viewer.spec.js` thêm case mobile quick-jump từ sơ đồ report center tới lịch gửi
- Rerun Playwright đầu tiên fail nhưng snapshot cho thấy bundle đang cũ; đây không phải regression của source mới mà là do repo verify UI qua `vite preview`.
- Rebuild `dist` bằng `pnpm build`, sau đó rerun Playwright trên artifact mới thì toàn bộ report-viewer suite pass.
- Verify pass:
  - `pnpm exec vitest run tests/reportViewer.test.jsx tests/operatorWorkflowPanels.test.jsx`
  - `pnpm build`
  - `pnpm exec playwright test tests/playwright/report-viewer.spec.js --config=playwright.config.mjs --workers=1`

## Next

- Bước hợp lý tiếp theo là `cng-mtn.5`: profile read-model/report pipeline trước khi quyết định có cần mở rộng fix sang backend/database hay không.

### Slice: `cng-mtn.5` conditional report pipeline profiling

- Claim bead `cng-mtn.5` và đọc lại đường đi thật của report pipeline:
  - `useReportViewerReadModel` gọi `fetchReportingViewModel`
  - `packages/api-client/src/reportingClient.js` gọi `/api/v4/reporting/view`
  - route server hiện build `buildReportingReadModels(snapshot.rows, ...)` on demand cho mỗi query
  - projection store hiện chủ yếu phục vụ monthly aggregates/observability, chưa thay thế trực tiếp read model của view route
- Đo trực tiếp trên `server/data/storage.sqlite` thay vì suy luận từ code:
  - đọc active declaration snapshot, rule collection, adjustment snapshot
  - benchmark `buildReportingReadModels` và `buildMonthlyReportingAggregates` bằng Node trên 200 iterations
- Kết quả profiling trên snapshot active hiện tại:
  - declaration rows: `3`
  - adjustment rows: `0`
  - `buildReportingReadModels`: ~0.28ms avg, ~0.47ms p95
  - `buildMonthlyReportingAggregates`: ~0.23ms avg, ~0.44ms p95
  - projection rows hiện có:
    - `reporting_projections`: 1
    - `reporting_monthly_aggregate_projection_entries`: 2
    - `reporting_job_run_entries`: 0
    - `reporting_schedule_projection_entries`: 0
- Kết luận:
  - route report vẫn còn compute read model on demand
  - nhưng với dữ liệu active hiện tại, chi phí cực nhỏ và chưa có bất kỳ bằng chứng nào cho thấy bottleneck nằm ở backend/query/read-model
  - vì vậy bead này không mở rộng thành patch backend; quyết định đúng là giữ kết luận profiling trong notebook và chuyển sang guardrails
- Verify/evidence commands:
  - Node benchmark đọc trực tiếp `storage.sqlite` + `businessSnapshotSqlite` + `reportingReadModels`
  - benchmark cho 200 iterations của read model và monthly aggregates

## Next

- Bước hợp lý tiếp theo là `cng-mtn.6`: gom guardrails E2E/regression cho shell/report UX sau các bead đã hoàn tất.

### Slice: `cng-mtn.6` shell/report E2E guardrails

- Claim bead `cng-mtn.6` sau khi đóng `cng-mtn.5` và rà lại coverage hiện có trong:
  - `tests/playwright/report-viewer.spec.js`
  - `tests/playwright/ui-shell-sidebar.spec.js`
  - `tests/playwright/utils.js`
- Xác nhận acceptance của bead đã được map đúng vào suite hiện tại:
  - desktop sequential navigation sang `Báo cáo KPI`
  - mobile compact shell vẫn mở được `Báo cáo KPI` sau chuỗi điều hướng tuần tự
  - compact mobile shell giữ target đủ lớn và nav group mở/đóng đúng
  - mobile report center quick-jump đi được tới `Lịch gửi & phát hành`
- Lần chạy Playwright đầu tiên fail hàng loạt nhưng nguyên nhân là môi trường:
  - thiếu `chromium_headless_shell`
  - repo này verify UI qua `vite preview`, nên vẫn phải rebuild `dist` trước khi đọc kết quả browser
- Chạy lại đúng quy trình:
  - `pnpm build`
  - `pnpm exec playwright install chromium`
  - `pnpm exec playwright test tests/playwright/report-viewer.spec.js tests/playwright/ui-shell-sidebar.spec.js --config=playwright.config.mjs --workers=1`
- Kết quả cuối:
  - `6 passed (15.0s)`
  - guardrails cho shell/report UX đã ổn định trên artifact mới

## Next

- Epic `cng-mtn` đã hoàn tất về notebook + verification; bước tiếp theo là chọn một track/bead mới ngoài backlog remediation này.

### Slice: `cng-ldq` report/audit code-splitting

- Tạo bead `cng-ldq` từ warning build còn sót lại sau epic `cng-mtn`.
- Xác định root cause bằng cách đọc import graph:
  - `KPICalculator` lazy import `ExportAuditReport`
  - `ReportViewer` được prefetch bằng dynamic import
  - nhưng `ReportCenterPanel` lại static import cả `ReportViewer` và `ExportAuditReport`
- Sửa `src/components/workflows/ReportCenterPanel.jsx`:
  - bỏ static imports
  - chuyển sang `React.lazy` + `Suspense`
  - thêm fallback card ngắn để report center không bị trắng vùng khi chunk đang tải
- Cập nhật `tests/operatorWorkflowPanels.test.jsx` để chờ lazy surface render bằng `findByText`.
- Verify pass:
  - `pnpm exec vitest run tests/operatorWorkflowPanels.test.jsx tests/ExportAuditReport.test.jsx`
  - `pnpm build`
  - `pnpm exec playwright test tests/playwright/report-viewer.spec.js --config=playwright.config.mjs --workers=1`
- Kết quả:
  - warning dynamic+static import biến mất khỏi build
  - chunk `ReportViewer` và `ExportAuditReport` được tách riêng trở lại
  - `report-viewer.spec.js` pass 4/4 trên `vite preview`

## Next

- Bước hợp lý tiếp theo là mở một bead riêng cho cảnh báo healthcheck/storage backup, vì đây là tín hiệu vận hành quan trọng còn lặp lại ở mỗi lần build.

### Slice: `cng-m2m` healthcheck backup/storage warnings

- Tạo bead `cng-m2m` để điều tra cảnh báo backup/storage lặp lại trong `pnpm build`.
- Đọc `scripts/healthcheck.mjs`, `server/index.js`, `packages/domain/src/backupMessages.js` và xác định nguyên nhân gốc:
  - healthcheck local luôn ép `KPI_DISABLE_CRON=1`
  - scheduler backup vì vậy luôn trả `cron_disabled_env`
  - snapshot health sau đó sinh thêm `schedule_inactive` và `schedule_reason_cron_disabled_env`
- Chạy trực tiếp `node scripts/healthcheck.mjs` để xác nhận output thực tế:
  - vẫn có `backup_missing`
  - kèm thêm hai warning cron-disabled nói trên
- Chọn hướng sửa hẹp:
  - không đụng vào runtime scheduler thật
  - thêm option `ignoreIssueCodes` vào `evaluateBackupHealth` / `getDataHealthSnapshot`
  - để riêng `healthcheck.mjs` dùng option này
- Sửa `tests/server.backup.test.js`:
  - snapshot mặc định vẫn có `schedule_inactive` và `schedule_reason_cron_disabled_env`
  - snapshot filtered chỉ còn `backup_missing`
  - summary schedule vẫn giữ `active: false` và `reasons: ['cron_disabled_env']`
- Verify pass:
  - `pnpm exec vitest run tests/server.backup.test.js`
  - `node scripts/healthcheck.mjs`
  - `pnpm build`
- Kết quả:
  - healthcheck local giờ in note thông tin rằng cron warning bị bỏ qua vì `KPI_DISABLE_CRON=1`
  - hai warning cron-disabled biến mất khỏi output build
  - `backup_missing` vẫn còn, cho thấy local audit log hiện chưa có bản sao lưu thành công

## Next

- Bước hợp lý tiếp theo là mở bead riêng để điều tra vì sao audit log local chưa có `db.backup` thành công, rồi quyết định có cần seed một manual backup baseline hay cải thiện onboarding vận hành backup hay không.

### Slice: `cng-ejz` local backup bootstrap CLI

- Tạo bead `cng-ejz` để giải quyết tình trạng local không có backup baseline.
- Kiểm tra trạng thái local thật:
  - `server/data/backups` chỉ có `.gitkeep`
  - `audit_logs_v1` hiện có `0` bản ghi, nên `db.backup` success chưa từng xảy ra
- Đọc lại:
  - `performDatabaseBackup()` trong `server/index.js`
  - config backup và route `/api/admin/backups/run`
  - `package.json`
- Kết luận:
  - engine backup đã sẵn sàng
  - route admin đã có
  - thiếu đúng một lệnh CLI cho local bootstrap
- Thêm:
  - `scripts/run-backup-core.mjs`
  - `scripts/run-backup.mjs`
  - script `pnpm backup:run`
- Healthcheck được cập nhật để nếu còn `backup_missing` thì gợi ý chạy `pnpm backup:run`.
- `.gitignore` được cập nhật để bỏ qua `server/data/backups/*.sqlite*`, tránh backup local làm bẩn worktree.
- Thêm test `tests/runBackupCore.test.js`:
  - parse args cho CLI
  - flow backup thực sự tạo file backup + audit log `db.backup`
- Verify pass:
  - `pnpm exec vitest run tests/runBackupCore.test.js tests/server.backup.test.js`
  - `pnpm backup:run -- --note "bootstrap local baseline"`
  - `node scripts/healthcheck.mjs`
  - `pnpm build`
- Kết quả:
  - local DB đã có backup baseline thành công
  - healthcheck/build không còn `backup_missing`
  - `Sao lưu gần nhất` hiện báo success trong healthcheck

## Next

- Bước hợp lý tiếp theo là mở bead nhỏ để tăng test coverage cho `scripts/healthcheck.mjs`, vì giờ script này đã mang logic điều hướng vận hành quan trọng hơn trước: suppression local, remediation hint, và đọc storage summary sau bootstrap.

### Slice: `cng-9qb` healthcheck local test coverage

- Tạo bead `cng-9qb` để tăng regression coverage cho healthcheck local.
- Đọc lại `scripts/healthcheck.mjs` và xác nhận problem thực:
  - script chứa toàn bộ hành vi quan sát được ở top-level
  - không thuận tiện để test các nhánh output quan trọng bằng fake data
- Refactor tối thiểu:
  - thêm `scripts/healthcheck-core.mjs`
  - chuyển toàn bộ runner sang `runHealthcheck()`
  - giữ `scripts/healthcheck.mjs` thành wrapper mỏng gọi `runHealthcheck()` và `process.exit`
- Thêm `tests/healthcheckCore.test.js` cover:
  - case còn `backup_missing` thì in storage warning + remediation hint `pnpm backup:run`
  - case storage healthy thì in `✅ Dung lượng lưu trữ ổn định.` và latest backup success
- Verify pass:
  - `pnpm exec vitest run tests/healthcheckCore.test.js tests/runBackupCore.test.js tests/server.backup.test.js`
  - `node scripts/healthcheck.mjs`
  - `pnpm build`
- Kết quả:
  - healthcheck có regression coverage trực tiếp
  - prebuild path vẫn ổn
  - output runtime không đổi sau refactor

## Next

- Bước hợp lý tiếp theo là mở bead để bổ sung test coverage cho nhánh lỗi của healthcheck CLI, đặc biệt các case `không lấy được kết nối SQLite`, `không thể tải backend`, và `getDataHealthSnapshot` ném lỗi, vì đây là các tình huống vận hành còn chưa bị khóa bằng test.

### Slice: `cng-qgx` healthcheck error branches

- Tạo bead `cng-qgx` để khóa các nhánh lỗi chính của `healthcheck-core`.
- Không cần sửa thêm runtime code; `runHealthcheck()` đã đủ điểm inject cho fake logger/module.
- Mở rộng `tests/healthcheckCore.test.js` với 3 case mới:
  - không lấy được kết nối SQLite thì trả `1` và log lỗi rõ ràng
  - loader backend ném lỗi thì trả `1` và log `Không thể tải backend để kiểm tra`
  - `getDataHealthSnapshot()` ném lỗi thì chỉ warning, vẫn hoàn tất run và trả `0`
- Verify pass:
  - `pnpm exec vitest run tests/healthcheckCore.test.js tests/runBackupCore.test.js tests/server.backup.test.js`
  - `node scripts/healthcheck.mjs`
- Kết quả:
  - coverage `healthcheckCore` tăng từ 2 lên 5 test
  - các nhánh lỗi vận hành quan trọng đã có regression lock
  - runtime local healthcheck vẫn cho output healthy sau backup bootstrap

## Next

- Bước hợp lý tiếp theo là mở bead nhỏ để thêm test cho nhánh SQL Server warning của `healthcheck-core`, nhằm khóa 2 trạng thái còn lại: `not_configured` và `error` khi kiểm tra SQL Server.

### Slice: `cng-uep` healthcheck SQL Server warning branches

- Tạo bead `cng-uep` để khóa nốt các nhánh cảnh báo SQL Server còn thiếu trong `healthcheck-core`.
- Đọc lại `scripts/healthcheck-core.mjs` và xác nhận 3 hành vi riêng biệt cần test:
  - `sqlStatus.state === 'not_configured'`
  - `sqlStatus.ok === false` với message lỗi
  - `checkSqlServerHealth()` ném exception
- Mở rộng helper `createServerModule()` trong `tests/healthcheckCore.test.js`:
  - hỗ trợ `sqlStatus`
  - hỗ trợ `sqlError`
  - vẫn giữ default cũ để các test hiện có không bị ảnh hưởng
- Thêm 3 regression test mới:
  - log `ℹ️ SQL Server chưa cấu hình — bỏ qua kiểm tra này.`
  - log `⚠️ Không thể kết nối SQL Server: ...`
  - log `⚠️ Không thể kiểm tra SQL Server: ...`
- Verify pass:
  - `pnpm exec vitest run tests/healthcheckCore.test.js tests/runBackupCore.test.js tests/server.backup.test.js`
  - `node scripts/healthcheck.mjs`
- Kết quả:
  - coverage `healthcheckCore` tăng từ 5 lên 8 test
  - ba nhánh SQL Server warning đã có regression lock
  - healthcheck local trên DB thật vẫn cho output healthy, không có thay đổi runtime ngoài mong muốn

## Next

- Bước hợp lý tiếp theo là mở bead nhỏ để test nhánh `snapshot.sqlServer.health.ok === false` trong phần storage snapshot, vì đây là một nguồn warning SQL Server thứ hai hiện vẫn chưa bị khóa riêng bằng test.

### Slice: `cng-5bs` snapshot SQL Server warning branch

- Tạo bead `cng-5bs` để khóa nốt nhánh cảnh báo SQL Server ở tầng `health snapshot`.
- Đọc lại `scripts/healthcheck-core.mjs` và xác nhận warning này không đi qua `checkSqlServerHealth()` mà nằm ở cuối khối `getDataHealthSnapshot()`.
- Thêm 1 regression test mới vào `tests/healthcheckCore.test.js`:
  - tạo snapshot healthy cho storage
  - thêm `snapshot.sqlServer.health = { ok: false, state: 'timeout', message: 'SQL Server timeout' }`
  - xác nhận healthcheck vẫn trả `0`
  - xác nhận warning `⚠️ SQL Server cảnh báo:` được in đúng message
- Verify pass:
  - `pnpm exec vitest run tests/healthcheckCore.test.js tests/runBackupCore.test.js tests/server.backup.test.js`
  - `node scripts/healthcheck.mjs`
- Kết quả:
  - coverage `healthcheckCore` tăng từ 8 lên 9 test
  - nguồn warning SQL Server thứ hai đã có regression lock riêng
  - healthcheck local trên DB thật vẫn giữ output healthy như trước

## Next

- Bước hợp lý tiếp theo là mở bead nhỏ để gom dữ liệu fixture/helper dùng chung trong [healthcheckCore.test.js](E:/GPT/kpi_source_code_v4/tests/healthcheckCore.test.js), vì file test này đang bắt đầu lặp snapshot healthy ở nhiều case và nên được làm gọn trước khi tăng coverage thêm.

### Slice: `cng-50t` healthcheck test fixture cleanup

- Tạo bead `cng-50t` để dọn nền cho `tests/healthcheckCore.test.js` sau chuỗi bead tăng coverage liên tục.
- Xác định hai điểm lặp chính:
  - snapshot healthy cho storage
  - boilerplate chạy `runHealthcheck()` với `logger`, `env`, `serverModule`, `startAt`
- Thêm helper ngay trong file test:
  - `DEFAULT_ENV`
  - `createHealthySnapshot()`
  - `runWithServerModule()`
- Refactor các test hiện có để chỉ giữ phần dữ liệu/behavior khác biệt.
- Trong lúc refactor, bắt và sửa ngay một bug tiềm ẩn:
  - `createHealthySnapshot()` ban đầu có nguy cơ bị `...overrides` đè lại toàn bộ `storage`
  - đã đổi sang tách `storageOverrides` và `snapshotOverrides` để merge an toàn
- Verify pass:
  - `pnpm exec vitest run tests/healthcheckCore.test.js tests/runBackupCore.test.js tests/server.backup.test.js`
  - `node scripts/healthcheck.mjs`
- Kết quả:
  - coverage giữ nguyên `9` case cho `healthcheckCore`
  - full cụm regression vẫn `16/16`
  - file test gọn hơn và an toàn hơn cho các bead coverage tiếp theo

## Next

- Bước hợp lý tiếp theo là mở bead nhỏ để thêm test cho nhánh `getDatabaseInitState()` trong `scripts/healthcheck-core.mjs`, vì hai nhánh `seeded` và `missingInserted` hiện vẫn chưa có regression lock riêng.

### Slice: `cng-1g7` getDatabaseInitState branches

- Tạo bead `cng-1g7` để khóa hai nhánh log vận hành nằm ngay sau bước kiểm tra SQLite sẵn sàng.
- Đọc lại `scripts/healthcheck-core.mjs` và xác nhận flow:
  - `db.prepare('SELECT 1').get()` pass
  - nếu có `getDatabaseInitState()` thì đọc `initInfo`
  - `seeded` -> warning mạnh
  - `missingInserted` -> info log
- Mở rộng fake server module trong `tests/healthcheckCore.test.js`:
  - thêm `dbInitState`
  - thêm `getDatabaseInitState()` trả về state giả theo từng test
- Thêm 2 regression test mới:
  - warning `SQLite vừa được seed lại với X khóa mặc định`
  - info `SQLite đã bổ sung X khóa mặc định còn thiếu`
- Verify pass:
  - `pnpm exec vitest run tests/healthcheckCore.test.js tests/runBackupCore.test.js tests/server.backup.test.js`
  - `node scripts/healthcheck.mjs`
- Kết quả:
  - coverage `healthcheckCore` tăng từ `9` lên `11` test
  - full cụm regression tăng lên `18/18`
  - các tín hiệu vận hành của DB init state giờ đã có regression lock riêng

## Next

- Bước hợp lý tiếp theo là mở bead nhỏ để thêm test cho nhánh lỗi `db.prepare('SELECT 1').get()` trong `healthcheck-core`, vì hiện suite mới khóa trường hợp không có DB handle chứ chưa khóa trường hợp có handle nhưng truy vấn SQLite thất bại.

### Slice: `cng-p0o` SQLite query failure branch

- Tạo bead `cng-p0o` để khóa nhánh lỗi truy vấn SQLite còn thiếu trong `healthcheck-core`.
- Đọc lại flow runtime và xác nhận đây là nhánh riêng:
  - có DB handle
  - `db.prepare('SELECT 1').get()` ném lỗi
  - runner phải trả `1` và log `❌ Không thể truy vấn SQLite: ...`
- Mở rộng fake server module trong `tests/healthcheckCore.test.js`:
  - thêm `dbQueryError`
  - nếu có `dbQueryError` thì `get()` ném lỗi thay vì trả `1`
- Thêm 1 regression test mới:
  - mô phỏng `database locked`
  - assert exit code `1`
  - assert log lỗi truy vấn SQLite đúng message
- Verify pass:
  - `pnpm exec vitest run tests/healthcheckCore.test.js tests/runBackupCore.test.js tests/server.backup.test.js`
  - `node scripts/healthcheck.mjs`
- Kết quả:
  - coverage `healthcheckCore` tăng từ `11` lên `12` test
  - full cụm regression tăng lên `19/19`
  - nhánh lỗi truy vấn SQLite giờ đã có regression lock riêng, tách biệt khỏi case thiếu DB handle

## Next

- Bước hợp lý tiếp theo là mở bead nhỏ để thêm test cho nhánh disk error formatting trong `healthcheck-core`, vì đây là một warning output hữu ích nhưng hiện chưa có test riêng.

### Slice: `cng-bik` disk error warning branch

- Tạo bead `cng-bik` để khóa warning output khi health snapshot không thể thống kê đầy đủ dung lượng ổ đĩa.
- Đọc lại `scripts/healthcheck-core.mjs` và xác nhận flow:
  - storage vẫn có thể healthy
  - disk summary line vẫn được in
  - nếu `disk.error` có giá trị thì in thêm warning line riêng
- Thêm 1 regression test mới vào `tests/healthcheckCore.test.js`:
  - dùng `createHealthySnapshot()`
  - override `storage.disk.error = 'statfs failed'`
  - assert exit code `0`
  - assert disk summary `2 GB / 10 GB (20.0% đã dùng)`
  - assert warning `Không thể thống kê đầy đủ dung lượng ổ đĩa: statfs failed`
- Verify pass:
  - `pnpm exec vitest run tests/healthcheckCore.test.js tests/runBackupCore.test.js tests/server.backup.test.js`
  - `node scripts/healthcheck.mjs`
- Kết quả:
  - coverage `healthcheckCore` tăng từ `12` lên `13` test
  - full cụm regression tăng lên `20/20`
  - nhánh warning disk error giờ đã có regression lock riêng

## Next

- Bước hợp lý tiếp theo là mở bead nhỏ để gom helper cho case `serverModuleLoader` failure trong `healthcheckCore.test.js`, vì đó là case còn đang dùng đường gọi thẳng `runHealthcheck()` thay vì helper chung, làm file test chưa đồng nhất hoàn toàn.
