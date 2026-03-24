# Findings & Decisions

## Final Findings

### 1. Lớp điều hướng bên trái đang hiển thị bất thường và gây nhiễu thị giác

- Từ bằng chứng trực quan, tôi quan sát thấy sidebar/domain navigation ở mé trái bị chồng lớp và nhìn như có một lớp chữ/tab "ma" đè lên card `KPI Control Center`.
- Hiện tượng này xuất hiện lặp lại ở cả desktop lẫn mobile, không phải lỗi đơn lẻ của một màn hình.
- Tác động: giảm độ rõ ràng của navigation, tạo cảm giác UI vỡ layout hoặc render hai lớp cùng lúc.

### 2. Trải nghiệm mobile chưa được co lại theo mobile-first

- Trên mobile, header và navigation vẫn giữ cấu trúc desktop thu nhỏ, thay vì chuyển sang drawer/toggle gọn.
- Kết quả là chữ rất nhỏ, nhiều khối thông tin bị nén dọc, và thao tác chọn tab khó quét nhanh.
- Tác động: app vẫn dùng được, nhưng mức đọc hiểu và điều hướng trên điện thoại kém rõ rệt.

### 3. Màn hình `Báo cáo KPI` có mật độ thông tin quá dày

- Ở desktop, màn hình report kéo rất dài, nhiều card/chart/filter xếp dày trong một cột dài.
- Ở mobile, bố cục vẫn mang tư duy desktop nên chart/filter/summary bị nén mạnh, độ đọc giảm rõ.
- Tác động: người dùng khó hình thành mental model nhanh, đặc biệt khi cần quét số liệu hoặc đối chiếu nhiều khối cùng lúc.

### 4. Điều hướng tuần tự sang `Báo cáo KPI` có dấu hiệu bất thường

- Audit tuần tự qua nhiều tab cho thấy cả desktop và mobile đều bị treo khi chuyển sang `Báo cáo KPI` sau chuỗi Import -> Accounts -> Teams -> HQ -> Reports.
- Trong khi đó, khi mở `Báo cáo KPI` trực tiếp từ trạng thái mới, màn hình vẫn render được bình thường.
- Tác động: có khả năng tồn tại vấn đề state transition, render accumulation, hoặc navigation shell bị kẹt sau nhiều lần chuyển module.

### 5. Workflow chrome đang lấn át vùng làm việc chính ở vài màn hình

- Ở Tài khoản, Tổ đội và Đại Lý HQ, phần `Operator workflow` và phần hero/context chiếm nhiều chiều cao trước khi người dùng chạm tới nội dung thao tác chính.
- Tác động: tăng scroll cost và làm hành động chính bị đẩy xuống dưới, nhất là trên mobile.

## Final Decisions

- Ưu tiên sửa lớp điều hướng bên trái và chiến lược responsive navigation trước, vì đây là vấn đề nhìn thấy ngay trên hầu hết màn hình.
- Điều tra riêng bug chuyển tab sang `Báo cáo KPI` sau chuỗi điều hướng dài; đây có thể là lỗi state shell hơn là lỗi của bản thân report screen.
- Nếu tiếp tục tối ưu UX, nên giảm chiều cao của hero/workflow chrome ở các module thao tác thường xuyên.

## Remediation Mapping

- Finding 1: sidebar ghosting / visual overlap
  - Bead: `cng-mtn.1`
- Finding 2: mobile shell still behaves like a shrunk desktop
  - Bead: `cng-mtn.2`
- Finding 3: report surface is too dense and hard to scan
  - Bead: `cng-mtn.4`
- Finding 4: sequential navigation into `Báo cáo KPI` hangs
  - Bead: `cng-mtn.3`
- Finding 5: workflow chrome pushes primary actions too far down
  - Bead: `cng-mtn.2`
- Cross-cutting investigation for possible data/read-model cost inside report rendering
  - Bead: `cng-mtn.5`
- Regression protection after fixes
  - Bead: `cng-mtn.6`

## Design Constraints For The Fixes

- Keep the shell mobile-first instead of shrinking the desktop layout.
- Preserve clear keyboard order and visible focus states while changing navigation.
- Reduce shell chrome before adding more visual polish; information access comes first.
- Treat the report surface as a data-dense dashboard, but use stronger hierarchy and progressive disclosure on narrow screens.

## Implementation Findings: `cng-mtn.1`

### Root Cause

- Sidebar ghosting không xuất phát từ một CSS override lẻ trong `App.css`.
- Gốc vấn đề là shell navigation đang reuse `TabsTrigger`/`TabsList` với bộ utility classes mặc định dành cho compact tabs.
- Khi shell lại áp thêm class `.ds-app-shell__nav-trigger` để biến tab thành stacked card nhiều dòng, hai mô hình styling này xung đột:
  - shell muốn `height: auto`, `padding` lớn, caption xuống dòng
  - primitive mặc định giữ `inline-flex`, `px-2`, `py-1`, `h-[calc(100%-1px)]`, `whitespace-nowrap`
- Kết quả là tab thực tế bị ép xuống khoảng 29px trong bundle cũ và các item chồng lên nhau.

### Fix Chosen

- Thêm escape hatch `unstyled` vào `TabsList` và `TabsTrigger`.
- `AppShellFrame` dùng `unstyled` cho sidebar navigation để shell chỉ render class chuyên biệt của chính nó.
- Cách này sạch hơn việc tăng specificity hoặc chồng thêm override ở `App.css`, vì nó giải quyết xung đột ngay tại primitive boundary.

### Verification Notes

- Khi verify bằng Playwright trong repo này, cần nhớ config đang chạy `vite preview`, tức là dùng `dist`.
- Nếu source đã đổi mà chưa `pnpm build`, kết quả UI có thể phản ánh bundle cũ và dẫn tới chẩn đoán sai.
- Sau khi rebuild, desktop và mobile sidebar đều không còn overlap.

## Implementation Findings: `cng-mtn.2`

### Root Cause

- Vấn đề mobile không còn nằm ở một class CSS riêng lẻ sau khi `cng-mtn.1` đã xử lý ghosting.
- Gốc của trải nghiệm "desktop thu nhỏ" là shell vẫn render đầy đủ:
  - brand copy dài
  - toàn bộ section descriptions
  - mọi nav group mở cùng lúc
  - hero/workflow chrome gần như giữ nguyên chiều cao desktop
- Vì vậy chỉ giảm font-size hoặc padding sẽ không đủ; phải đổi cả hành vi navigation ở mobile.

### Fix Chosen

- Thêm compact mode thật trong `AppShellFrame` thay vì tiếp tục ép layout bằng CSS thuần:
  - detect viewport nhỏ
  - render compact shell summary
  - đồng bộ nav group đang mở theo section hiện tại
  - collapse các group còn lại trên mobile để giảm scroll cost
- Giữ desktop sidebar đầy đủ để tránh regression với shell foundation vừa ổn định ở `cng-mtn.1`.
- Nén hero/meta spacing trong `App.css` và chỉ giữ tab caption cho active card ở mobile.
- Giảm workflow guide chrome và nâng min-height của action/step controls để giữ usability trên touch devices.

### Verification Notes

- Unit test cần mock `matchMedia` để xác nhận compact mode là behavior thực, không phải hiệu ứng CSS mơ hồ.
- Playwright mobile test phải bỏ giả định "mọi tab đều luôn mở" và thay bằng assertion cho compact navigation.
- Repo vẫn verify UI qua `vite preview`, nên phải rebuild `dist` trước khi tin vào kết quả Playwright cho bead này.

## Implementation Findings: `cng-mtn.3`

### Root Cause

- Giả thuyết ban đầu tập trung vào `pendingFocusTarget`, tab state hoặc lifecycle của `ReportCenterPanel`/`ReportViewer`.
- Regression RED cho desktop cho thấy lỗi xuất hiện sớm hơn nhiều: Playwright không click được `Tài khoản` vì tab governance nằm ngoài viewport.
- Đọc lại shell CSS xác nhận nguyên nhân thật ở desktop:
  - `.ds-app-shell__sidebar` dùng `position: sticky`
  - nhưng không có `max-height` và không có `overflow-y`
  - khi shell cao hơn viewport, các tab ở section cuối bị clip khỏi vùng nhìn thấy
- Regression RED cho mobile cho thấy nguyên nhân thật ở compact shell:
  - helper navigation chờ tab visible ngay lập tức
  - nhưng compact mode chỉ render tab của nav group đang mở
  - `Import Data` không visible vì group `Vận hành` chưa được mở
- Kết luận: bead này là vấn đề reachability của App Shell và test harness navigation, không phải lỗi render/lifecycle của report screen.

### Fix Chosen

- Ở desktop shell:
  - thêm `max-height: calc(100vh - 2rem)` cho sidebar sticky
  - thêm `overflow-y: auto` và `overscroll-behavior: contain`
  - mục tiêu là giữ governance tabs reachable mà không phá bố cục shell
- Ở Playwright helpers:
  - thêm `revealTab()` để mở đúng nav group trước khi tìm/click tab trong compact mode
  - scroll tab vào view trước khi click
  - giữ fallback Command Center cho import flow
- Ở regression coverage:
  - thêm test desktop cho chuỗi `Import -> Accounts -> Teams -> HQ -> Reports`
  - thêm test mobile compact cho cùng chuỗi

### Verification Notes

- Khi bead này pass, `#app-tab-root-reports` và region `Điều khiển báo cáo KPI` đều hiện ổn định ở cả desktop/mobile sau chuỗi điều hướng dài.
- Bộ Playwright liên quan tới toàn bộ helper navigation (`account`, `team`, `hq`, `import`, `report`, `sync`, `sidebar`) đều pass sau fix.
- Không có thêm bằng chứng phải mở rộng bead này sang backend/database; nghi ngờ report lifecycle ban đầu được loại bỏ.

## Implementation Findings: `cng-mtn.4`

### Root Cause

- Mật độ thông tin của `Báo cáo KPI` không còn là vấn đề "quá nhiều card" theo nghĩa thuần visual; gốc vấn đề nằm ở việc `ReportViewer` chưa có reading hierarchy đủ rõ.
- Sau phần controls, report đưa người dùng đi qua schedule form, dashboard, explorer và notes gần như trong cùng một nhịp đọc, nên mobile phải cuộn qua khối quản trị/phát hành trước khi đọc insight.
- `ReportingScopeExplorerPanel` còn bọc thêm một card lồng thừa và phần select/footnote chưa stack tốt trên viewport hẹp, làm cảm giác "desktop co nhỏ" nặng hơn.
- `ReportCenterPanel` và copy workflow shell cũng chưa phản ánh đúng mental model cần có sau audit: chốt phạm vi -> đọc insight/drill-down -> rồi mới phát hành/truy vết.

### Fix Chosen

- Giữ `ReportCenterPanel` như macro workflow 3 bước, nhưng tái cấu trúc workspace bên trong `ReportViewer` thay vì tiếp tục dời cả module sang layout mới.
- Thêm `ReportingWorkspaceGuidePanel` với quick-jump anchors để người dùng mobile có thể nhảy nhanh tới đúng phần cần đọc.
- Tách bề mặt report thành thứ tự rõ ràng:
  - controls
  - guide
  - insights
  - drill-down phạm vi
  - schedule
  - notes
- Dùng `SectionSurface` + `SectionHeader` cho các cụm chính để tăng scanability và giữ visual rhythm nhất quán với shell primitives.
- Giảm nested-card noise ở `ReportingScopeExplorerPanel` và cho controls/select labels co giãn tốt hơn trên mobile.
- Cập nhật copy ở `ReportCenterPanel` và `appShellWorkflowState` để mental model trong shell trùng với thứ tự đọc mới của report workspace.

### Verification Notes

- Unit test xác nhận hierarchy mới bằng section ids và DOM order thay vì chỉ check text rời rạc.
- Playwright thêm regression mobile cho quick-jump từ sơ đồ report center tới khu lịch gửi.
- Lần Playwright fail đầu tiên sau patch không phản ánh source mới vì config đang dùng `vite preview`; snapshot vẫn là bundle cũ. Sau `pnpm build`, toàn bộ report-viewer suite pass.

## Implementation Findings: `cng-mtn.5`

### Root Cause

- Nghi ngờ còn lại sau `cng-mtn.4` là report route có thể vẫn tốn thời gian vì `/api/v4/reporting/view` build read model on demand thay vì đọc trực tiếp từ projection cache.
- Tuy nhiên đây mới chỉ là nghi ngờ kiến trúc; chưa có số đo nào chứng minh chi phí hiện tại đủ lớn để mở backend optimization riêng.

### Fix Chosen

- Không tối ưu mù.
- Đọc trực tiếp active snapshot từ `server/data/storage.sqlite` và benchmark các hàm gốc:
  - `buildReportingReadModels`
  - `buildMonthlyReportingAggregates`
- Đồng thời kiểm tra row counts thực của active snapshot và projection tables để phân biệt bottleneck thật với giả định từ cấu trúc code.

### Verification Notes

- Active snapshot hiện tại chỉ có:
  - `3` declaration rows
  - `0` adjustment rows
- Benchmark 200 iterations cho thấy:
  - `buildReportingReadModels`: ~0.28ms average, ~0.47ms p95
  - `buildMonthlyReportingAggregates`: ~0.23ms average, ~0.44ms p95
- Kết luận hiện tại:
  - route `/api/v4/reporting/view` vẫn còn compute read model on demand
  - nhưng với dữ liệu active thực tế, chi phí quá nhỏ để biện minh cho patch backend/query/read-model
  - bead này nên đóng với kết luận "không cần can thiệp backend ở thời điểm hiện tại", thay vì mở thêm scope không có bằng chứng.

## Implementation Findings: `cng-mtn.6`

### Root Cause

- Sau `cng-mtn.1` tới `cng-mtn.5`, phần lớn guardrail cần cho shell/report UX thực ra đã được thêm dần vào suite.
- Rủi ro còn lại nằm ở khâu verify:
  - repo chạy browser regression trên `vite preview`, nên rất dễ đọc nhầm bundle cũ nếu quên rebuild
  - máy local có thể thiếu Playwright browser binaries, làm suite fail từ môi trường trước khi đụng tới app
- Vì vậy bead này không phải một bead sửa logic UI mới; nó là bead chốt coverage và xác minh ổn định của guardrails sau toàn bộ remediation.

### Fix Chosen

- Dùng lại đúng cụm Playwright liên quan tới shell/report UX thay vì mở thêm spec trùng lặp:
  - `tests/playwright/report-viewer.spec.js`
  - `tests/playwright/ui-shell-sidebar.spec.js`
- Chuẩn hóa verify sequence:
  - `pnpm build`
  - `pnpm exec playwright install chromium`
  - chạy lại hai spec guardrail trên `vite preview`
- Ghi rõ caveat môi trường vào notebook để session sau không chẩn đoán sai giữa lỗi app và lỗi verify.

### Verification Notes

- Suite guardrail cuối cùng pass đầy đủ:
  - desktop sequential navigation vào `Báo cáo KPI`
  - mobile compact shell sequential navigation
  - mobile quick-jump từ sơ đồ report center tới lịch gửi
  - desktop/mobile sidebar shell assertions
- Kết quả cuối:
  - `6 passed (15.0s)`
- Với kết quả này, bead `cng-mtn.6` có thể đóng mà không cần thêm patch UI mới.

## Implementation Findings: `cng-ldq`

### Root Cause

- Warning build còn lại sau epic `cng-mtn` không đến từ Vite config hay do chunk threshold.
- Gốc vấn đề là import graph mâu thuẫn:
  - `KPICalculator` đã lazy import `ExportAuditReport`
  - `ReportViewer` được prefetch bằng dynamic import
  - nhưng `ReportCenterPanel` lại static import chính hai module đó
- Khi một module vừa bị dynamic import vừa bị static import trong cùng graph, Vite không thể tách chunk như mong đợi và sẽ kéo module đó trở lại chunk chính.

### Fix Chosen

- Không đụng vào workflow shell đã ổn định.
- Chỉ sửa đúng import boundary ở `ReportCenterPanel`:
  - thay static import bằng `React.lazy`
  - bọc từng surface bằng `Suspense` với fallback card ngắn
- Cách này giữ nguyên semantics của report center nhưng trả lại code-splitting cho report/audit surface.

## Implementation Findings: `cng-m2m`

### Root Cause

- Cảnh báo backup/storage lặp lại ở mỗi lần build không đến từ việc cron runtime thật bị lỗi.
- Gốc vấn đề là `scripts/healthcheck.mjs` chủ động chạy với:
  - `KPI_SKIP_LISTEN=1`
  - `KPI_DISABLE_CRON=1`
- Vì vậy `refreshDatabaseBackupSchedule()` luôn trả scheduler inactive với reason `cron_disabled_env`.
- `evaluateBackupHealth()` sau đó sinh thêm hai warning:
  - `schedule_inactive`
  - `schedule_reason_cron_disabled_env`
- Hai warning này là đúng trong chế độ inspect local, nhưng lại bị in ra như tín hiệu vận hành xấu ở mọi lần build.
- Đồng thời `backup_missing` là tín hiệu dữ liệu thật: audit log local hiện chưa ghi nhận bản sao lưu `db.backup` thành công nào.

### Fix Chosen

- Không sửa logic scheduler thật và không bỏ qua toàn bộ backup health.
- Thêm option `ignoreIssueCodes` vào nhánh build snapshot backup để caller có thể lọc có chủ đích.
- `healthcheck.mjs` dùng option này để chỉ bỏ qua:
  - `schedule_inactive`
  - `schedule_reason_cron_disabled_env`
- Đồng thời healthcheck in một dòng info giải thích rằng local run đang bỏ qua warning cron-disabled do chính `KPI_DISABLE_CRON=1`.
- `backup_missing` được giữ nguyên để không che mất tình trạng audit log local chưa có backup thành công.

### Verification Notes

- Regression test mới trong `tests/server.backup.test.js` khóa cả hai mặt:
  - snapshot mặc định vẫn còn warning cron-disabled
  - snapshot filtered không còn hai warning đó nhưng vẫn giữ `backup_missing`
- `node scripts/healthcheck.mjs` sau fix chỉ còn:
  - note info về local suppression
  - cảnh báo `backup_missing`
- `pnpm build` pass và prebuild output không còn nhiễu bởi warning cron-disabled.

## Implementation Findings: `cng-ejz`

### Root Cause

- Sau khi `cng-m2m` làm sạch warning giả do cron-disabled, `backup_missing` vẫn còn hiện đều đặn.
- Kiểm tra local state cho thấy đây không phải lỗi engine backup:
  - `audit_logs_v1` local có `0` record
  - `server/data/backups` chỉ có `.gitkeep`
  - trong khi `performDatabaseBackup()` và route admin `/api/admin/backups/run` đã tồn tại
- Nghĩa là local environment đơn giản là chưa từng được bootstrap bằng một backup success đầu tiên.

### Fix Chosen

- Không auto-backup trong `healthcheck`, vì healthcheck nên giữ tính read-only.
- Thêm một đường CLI rõ ràng cho local operator:
  - `scripts/run-backup-core.mjs`
  - `scripts/run-backup.mjs`
  - `pnpm backup:run`
- CLI gọi thẳng `performDatabaseBackup()` với default reason `bootstrap-local`, đồng thời tự đặt `KPI_SKIP_LISTEN=1` và `KPI_DISABLE_CRON=1` để import server an toàn trong local shell.
- `healthcheck` được nâng cấp để:
  - vẫn hiển thị `backup_missing` khi chưa có baseline
  - đưa ra remediation command `pnpm backup:run`
- `.gitignore` được cập nhật để backup binaries trong `server/data/backups/` không xuất hiện như untracked noise.

### Verification Notes

- Test mới `tests/runBackupCore.test.js` xác nhận:
  - parse args hoạt động đúng
  - CLI thực sự tạo backup file và ghi audit log `db.backup`
- Chạy thật trên local:
  - `pnpm backup:run -- --note "bootstrap local baseline"`
- Sau bootstrap:
  - `node scripts/healthcheck.mjs` báo `✅ Dung lượng lưu trữ ổn định`
  - có `Sao lưu gần nhất: ... (success)`
  - `pnpm build` pass với prebuild healthcheck sạch `backup_missing`

## Implementation Findings: `cng-9qb`

### Root Cause

- Sau `cng-m2m` và `cng-ejz`, `healthcheck.mjs` không còn là script "in vài dòng rồi thoát".
- Nó đã mang nhiều logic vận hành có giá trị:
  - suppression cảnh báo cron-disabled cho local
  - remediation hint `pnpm backup:run`
  - format storage summary sau bootstrap
- Nhưng toàn bộ logic đó nằm ở top-level script body, khiến test regression gần như không thể viết gọn bằng fake module/data.

### Fix Chosen

- Tách toàn bộ runner sang `scripts/healthcheck-core.mjs` với hàm `runHealthcheck()`.
- Giữ `scripts/healthcheck.mjs` chỉ là wrapper mỏng:
  - re-export constants/core
  - chạy `process.exit(await runHealthcheck())` khi được gọi như CLI
- Cách này giữ nguyên output runtime nhưng cho phép test inject:
  - `logger`
  - `env`
  - `serverModule`

### Verification Notes

- `tests/healthcheckCore.test.js` khóa hai nhánh có giá trị vận hành cao nhất:
  - còn `backup_missing` thì phải in remediation hint
  - storage healthy thì phải in latest backup success và không in hint
- `node scripts/healthcheck.mjs` sau refactor vẫn cho output local đúng như trước.
- `pnpm build` pass qua `prebuild`, xác nhận wrapper mới không làm gãy luồng runtime thật.

## Implementation Findings: `cng-qgx`

### Root Cause

- Sau `cng-9qb`, healthcheck đã có coverage cho 2 happy-path quan trọng.
- Nhưng các nhánh lỗi vận hành còn lại vẫn chưa bị khóa:
  - không lấy được SQLite handle
  - loader backend ném lỗi
  - `getDataHealthSnapshot()` ném lỗi giữa chừng
- Đây là các trường hợp dễ bị regression âm thầm vì chúng không xuất hiện trong local healthy path hằng ngày.

### Fix Chosen

- Không refactor thêm runtime.
- Chỉ mở rộng `tests/healthcheckCore.test.js` vì `runHealthcheck()` đã đủ hook cho fake `serverModule` và fake `serverModuleLoader`.
- Chọn đúng 3 nhánh lỗi có tác động vận hành cao nhất:
  - lỗi nghiêm trọng phải trả `1`
  - lỗi snapshot phải warning nhưng vẫn hoàn tất run

### Verification Notes

- `tests/healthcheckCore.test.js` hiện cover:
  - `backup_missing`
  - storage healthy
  - missing SQLite handle
  - backend loader failure
  - snapshot failure
- `node scripts/healthcheck.mjs` sau khi tăng coverage vẫn chạy bình thường trên local DB thật.

## Implementation Findings: `cng-uep`

### Root Cause

- Sau `cng-qgx`, `healthcheck-core` đã có coverage cho lỗi DB/backend/snapshot nhưng vẫn thiếu nhánh SQL Server warning.
- `runHealthcheck()` hiện có ba hành vi độc lập quanh `checkSqlServerHealth()`:
  - `not_configured` thì warning mức info và bỏ qua
  - trạng thái non-ok thì warning lỗi kết nối
  - exception thì warning lỗi kiểm tra
- Ba nhánh này đều dễ regression vì local healthy path thường chỉ đi qua `sqlStatus.ok === true`.

### Fix Chosen

- Không sửa runtime code.
- Chỉ mở rộng `tests/healthcheckCore.test.js`:
  - thêm `sqlStatus` để fake return object linh hoạt hơn
  - thêm `sqlError` để fake throw path
- Thêm 3 case riêng cho:
  - `not_configured`
  - non-ok error
  - thrown error

### Verification Notes

- `tests/healthcheckCore.test.js` hiện có tổng cộng 8 case và bao phủ cả 3 nhánh SQL Server warning.
- Full cụm regression backup/healthcheck pass `15/15`.
- `node scripts/healthcheck.mjs` sau khi tăng coverage vẫn cho output local healthy với latest backup success.

## Implementation Findings: `cng-5bs`

### Root Cause

- Sau `cng-uep`, toàn bộ nhánh warning quanh `checkSqlServerHealth()` đã có test.
- Tuy nhiên `healthcheck-core` vẫn còn một nguồn cảnh báo SQL Server thứ hai:
  - `snapshot?.sqlServer?.health && snapshot.sqlServer.health.ok === false`
- Nhánh này xuất hiện sau khi đọc `getDataHealthSnapshot()` và độc lập với health probe trực tiếp, nên nếu không có test riêng thì rất dễ bị bỏ sót hoặc bị hiểu nhầm là đã được cover bởi `cng-uep`.

### Fix Chosen

- Không sửa runtime code.
- Chỉ thêm một test snapshot-level vào `tests/healthcheckCore.test.js` với storage healthy và `snapshot.sqlServer.health.ok === false`.
- Test xác nhận đồng thời hai điểm:
  - healthcheck vẫn hoàn tất và trả `0`
  - warning `SQL Server cảnh báo` dùng đúng message từ snapshot

### Verification Notes

- `tests/healthcheckCore.test.js` hiện có 9 case.
- Full cụm regression backup/healthcheck pass `16/16`.
- `node scripts/healthcheck.mjs` sau khi tăng coverage vẫn cho output local healthy, không có thay đổi runtime ngoài mong muốn.

## Implementation Findings: `cng-50t`

### Root Cause

- Sau nhiều bead coverage liên tiếp, `tests/healthcheckCore.test.js` bắt đầu có lặp đáng kể ở hai vùng:
  - snapshot healthy cho storage
  - boilerplate gọi `runHealthcheck()`
- Dạng lặp này chưa gây fail test ngay, nhưng làm mỗi test khó quét nhanh hơn và tăng rủi ro sửa fixture không đồng nhất ở các bead tiếp theo.

### Fix Chosen

- Không tách thêm file fixture riêng vì suite này vẫn còn nhỏ.
- Giữ refactor ở ngay trong `tests/healthcheckCore.test.js`:
  - `DEFAULT_ENV` cho local healthcheck
  - `createHealthySnapshot()` cho snapshot chuẩn
  - `runWithServerModule()` cho boilerplate runner
- Trong lúc refactor, sửa luôn lỗi merge tiềm ẩn trong helper snapshot để `storage` không bị override toàn phần bởi `...overrides`.

### Verification Notes

- Coverage không đổi: `tests/healthcheckCore.test.js` vẫn có 9 case.
- Full cụm regression backup/healthcheck vẫn pass `16/16`.
- `node scripts/healthcheck.mjs` tiếp tục cho output local healthy, xác nhận bead này chỉ dọn test chứ không ảnh hưởng runtime.

## Implementation Findings: `cng-1g7`

### Root Cause

- Sau `cng-50t`, suite `healthcheckCore` đã sạch hơn nhưng vẫn còn hai nhánh runtime chưa bị khóa:
  - `getDatabaseInitState().seeded`
  - `getDatabaseInitState().missingInserted`
- Đây không phải log trang trí; chúng là tín hiệu vận hành cho biết local SQLite vừa thay đổi dữ liệu mặc định trong lúc khởi động.

### Fix Chosen

- Không sửa runtime code.
- Chỉ mở rộng fake server module trong `tests/healthcheckCore.test.js` với `dbInitState`.
- Thêm 2 case riêng để xác nhận:
  - nhánh `seeded` in warning với `insertedEntries`
  - nhánh `missingInserted` in info log với số lượng khóa đã bổ sung

### Verification Notes

- `tests/healthcheckCore.test.js` hiện có `11` case.
- Full cụm regression backup/healthcheck pass `18/18`.
- `node scripts/healthcheck.mjs` sau khi tăng coverage vẫn cho output local healthy như trước.

## Implementation Findings: `cng-p0o`

### Root Cause

- Sau `cng-1g7`, suite `healthcheckCore` đã khóa:
  - thiếu DB handle
  - DB init state warnings
- Nhưng vẫn còn thiếu nhánh runtime khi DB handle tồn tại mà truy vấn SQLite thất bại.
- Đây là nhánh riêng vì `runHealthcheck()` xử lý nó bằng log `❌ Không thể truy vấn SQLite:` và return `1`, khác hẳn case `Không thể lấy kết nối SQLite.`

### Fix Chosen

- Không sửa runtime code.
- Chỉ mở rộng fake server module trong `tests/healthcheckCore.test.js` với `dbQueryError`.
- Thêm 1 case mô phỏng lỗi `database locked` để xác nhận:
  - exit code là `1`
  - log lỗi truy vấn SQLite đúng message

### Verification Notes

- `tests/healthcheckCore.test.js` hiện có `12` case.
- Full cụm regression backup/healthcheck pass `19/19`.
- `node scripts/healthcheck.mjs` sau khi tăng coverage vẫn cho output local healthy như trước.

## Implementation Findings: `cng-bik`

### Root Cause

- Sau `cng-p0o`, suite đã khóa tốt các nhánh lỗi/warning lớn của SQLite và SQL Server.
- Nhưng vẫn còn một warning output non-fatal ở phần storage summary chưa có test riêng:
  - `disk.error`
- Đây là loại regression dễ lọt vì runtime vẫn trả `0`; nếu format warning bị đổi hoặc mất đi, suite trước đó vẫn có thể xanh.

### Fix Chosen

- Không sửa runtime code.
- Chỉ thêm một snapshot-level test trong `tests/healthcheckCore.test.js` với `storage.disk.error = 'statfs failed'`.
- Test khóa cả hai điểm:
  - summary line của ổ đĩa vẫn được in
  - warning line cho lỗi thống kê dung lượng cũng được in đúng format

### Verification Notes

- `tests/healthcheckCore.test.js` hiện có `13` case.
- Full cụm regression backup/healthcheck pass `20/20`.
- `node scripts/healthcheck.mjs` sau khi tăng coverage vẫn cho output local healthy như trước.

### Verification Notes

- Unit tests liên quan tới workflow/report center vẫn pass sau khi chuyển sang lazy render.
- Build sạch warning dynamic+static import.
- Playwright `report-viewer.spec.js` vẫn pass 4/4, xác nhận desktop/mobile flow không bị regression bởi lazy surface mới.
