# UX improvement backlog

This backlog liệt kê các hạng mục cải thiện trải nghiệm người dùng. Mỗi nhiệm vụ được đánh dấu bằng checkbox để Codex Cloud có thể cập nhật tiến độ. Khi hoàn thành nhiệm vụ, hãy thay `[ ]` bằng `[x]` và ghi chú ngắn gọn (ví dụ: `[x] ... (done in PR #123)`).

Reconciliation note 2026-03-27:
- Tat ca checkbox chua xong ben duoi da duoc map thanh bead mo duoi epic `cng-7z0`.
- Mapping canonically duoc theo doi tai `docs/open-backlog.md`.
- Neu phat sinh muc moi trong file nay, can tao bead va cap nhat `docs/open-backlog.md` ngay trong cung session.

## 1. KPI Adjustments

- [x] Persist filter states (month, status, mine-only, staff) per user using local storage hoặc `UI_LAYOUT_KEY` trong store.
- [x] Tách danh sách điều chỉnh sang virtual list / pagination để cải thiện hiệu năng với dataset lớn. (done 2026-03-28, them pagination + persisted page size cho KPI Adjustments list va khoa regression panel/remount flow)
- [x] Bổ sung thao tác duyệt hàng loạt (bulk approve/reject) dựa trên quyền `adjustApprove`. (done 2026-03-28, them checkbox + bulk toolbar cho approver, loop `updateKpiAdjustmentStatus` theo selection hien tai, va khoa regression hook/panel/UI)
- [x] Thêm liên kết nhanh tới tờ khai hoặc MST liên quan để người duyệt tra cứu ngay tại chỗ. (done 2026-03-28, them quick link tu list/detail dialog sang workspace import/MST qua app-shell command bus va copy lookup value vao clipboard khi ho tro)
- [x] Cho phép quản lý cấu hình điểm mặc định trực tiếp trong UI và phản ánh vào `KPI_ADJUSTMENT_CATEGORY_CONFIG`. (done 2026-03-28, them summary "cau hinh dang ap dung" ngay trong form KPI Adjustments + quick action mo thang category hien tai trong settings dialog)

## 2. ECUS declaration sync

- [x] Hiển thị tiến trình đồng bộ theo từng bước (đọc ECUS, tính toán diff, ghi vào store) với trạng thái rõ ràng khi gọi `refreshDeclRowsFromServer`. (done 2026-03-31, bead `cng-7z0.6`, them step-level sync progress state + preview stepper UI trong DataImporter sync panel)
- [x] Thêm hàng đợi đồng bộ nền để xử lý file lớn, hỗ trợ resume khi mất kết nối hoặc đóng trình duyệt. (done 2026-03-31, bead `cng-7z0.7`, backend-detached async ECUS commit jobs + resume polling qua `declarationsImportJobService`)
- [x] Cảnh báo xung đột (vd. tờ khai đã bị chỉnh sửa tại chỗ khác) và cung cấp giao diện so sánh trước khi ghi đè. (done 2026-03-29, bead `cng-7z0.8`, surfacing conflict summary/banner truoc khi cho overwrite)
- [x] Thực hiện pre-check (kiểm tra kết nối DB, quyền truy cập ECUS, dung lượng đĩa) và hiển thị check-list trước khi chạy đồng bộ. (done 2026-03-29, bead `cng-7z0.9`, bo sung preflight checklist trong luong sync)
- [x] Bổ sung cơ chế retry tự động với backoff và log thân thiện khi `sendWrite` trả về lỗi. (done 2026-03-29, bead `cng-7z0.10`, auto retry/backoff + countdown + activity log cho sync failures)
- [x] Lưu lịch sử đồng bộ (ai chạy, thời gian, số bản ghi cập nhật) để hiện trong Notification Center và trang tổng quan. (done 2026-03-29, persist bounded sync history trong queue local state, luu actor/range/resultSummary cho moi lan sync, va surfacing ngay trong ECUS sync panel de lam nguon cho notification/dashboard slices sau)

## 3. Data Importer

- [x] Chuyển việc đọc/ghi XLSX sang Web Worker để tránh khóa UI trong khi `XLSX.read` chạy. (done 2026-03-29, `dataImporterWorkbookParser.js` uu tien worker-module parser, co fallback ve sync parser khi worker khong kha dung, va regression `tests/dataImporterWorkbookParser.test.js` khoa ca worker + fallback lane)
- [x] Tách DataImporter thành các module nhỏ (picker, preview, filters, sync) và lazy-load khi cần. (done 2026-03-29, `DataImporterShell.jsx` lazy-load cac panel/dialog nang theo tung stage de giam initial bundle trong khi giu nguyen shell workflow contract)
- [x] Lưu/gửi preset bộ lọc và cấu hình cột, cho phép chia sẻ giữa các thành viên trong cùng tổ. (done 2026-03-29, `useDataImporterFilterPresets.js` luu kem `filters.columns` snapshot da sanitize va apply lai qua store khi preset duoc chon, dong thoi khoa regression `tests/useDataImporterFilterPresets.test.jsx` cho save/apply/share lane)
- [x] Thiết kế wizard nhiều bước giúp người dùng theo dõi tiến trình import, tránh quá tải thông tin. (done 2026-03-29, `DataImporterWorkflowGuide` + `DataImporterShell.jsx` da chia ro 3 buoc `Nap nguon` / `Ra soat` / `Luu va theo doi`, co action theo trang thai va regression `tests/dataImporterWorkflowGuideState.test.js` + `tests/dataImporterShell.test.jsx`)
- [x] Cải thiện feedback khi đồng bộ thất bại: gợi ý hành động cụ thể (thử lại, kiểm tra VPN, báo CNTT). (done 2026-03-29, `dataImporterSyncPanelProps.js` suy ra recovery hints tu checklist loi + sync/preview error, `DataImporterSyncConfigPanel.jsx` forward day du conflict/history/hint props vao luong that, va `DataImporterSyncPreviewPanel.jsx` hien thi khung `Goi y khac phuc` cho operator truoc khi retry/escalate)

## 4. MST assignment & staffing

- [x] Tự động phát hiện MST được gán trùng và đề xuất cách xử lý (giữ, chuyển, tách vai trò). (done 2026-03-29, `buildGroupedStages()` nay sinh `conflictSummary` cho MST co nhieu giai doan dang cung hieu luc, `MstAssignmentDataTablePanel.jsx` surfacing canh bao `Trung gan` va goi y xu ly nhanh ngay tren bang/timeline)
- [x] Thêm timeline lịch sử thay đổi MST với bộ lọc theo hành động (create/update/delete). (done 2026-03-29, `useMSTAssignmentHistoryWorkspace.js` nay loc su kien lich su that su theo create/update/delete va mốc chuyen trang thai, `MstAssignmentHistoryFilterPanel.jsx` doi nhan de ro nghia `Chuyen trang thai`, va row-key filter khop voi timeline detail)
- [x] Cung cấp chế độ xem rút gọn cho trưởng nhóm với quick filters (assigned/pending, theo nhóm). (done 2026-03-30, them `useMSTAssignmentLeadViewWorkspace.js` + UI `Lead-view rút gọn` trong `MstAssignmentStaffFilterPanel.jsx`, tu dong gom theo MST hien hanh, loc nhanh `Đã gán đủ/Chờ gán`, va loc theo team ma khong tron voi history filter panel)
- [x] Cảnh báo ngay khi nhập tên công ty vượt ngưỡng dài, sai định dạng hoặc chứa ký tự không hợp lệ. (done 2026-03-30, `companyName.js` nay tra warning cho ten qua dai/ky tu nghi ngo, va `CompanyNameCell.jsx` surfacing canh bao inline ngay trong o sua de operator soat loi som hon truoc khi luu)
- [x] Cho phép export báo cáo phân bổ MST ra CSV/XLSX với metadata (người gán, ngày hiệu lực). (done 2026-03-30, `useMSTAssignmentExportWorkspace.js` nay dung chung export dataset co `Người gán gần nhất` + `Cập nhật gần nhất` suy ra tu MST history theo tung stage, va `MSTAssignment.jsx` mo them nut `CSV/XLSX` cho ca pham vi loc/toan bo)

## 5. Navigation & notifications

- [x] Đồng bộ danh sách Command Center pin lên backend (done 2026-03-30, them compat API doc/ghi `kpi_command_center_pins_v1` tren server-v4, dong bo `storageClient` + `CommandCenter` qua shared storage, va khoa regression backend/jsdom cho read-write-hydrate flow).
- [x] Thêm ô tìm kiếm toàn cục gợi ý nhanh theo quyền truy cập (done 2026-03-30, mo rong `CommandCenter` voi shortcut theo workflow report center va goi y nguoi dung khi co quyen `accountManage`, giu module search dua tren tab visibility hien co va khoa regression jsdom cho report/user search).
- [x] Hiển thị badge số lượng thông báo chưa đọc và thao tác đánh dấu đã đọc hàng loạt. (done 2026-03-30, giu unread badge cho den khi nguoi dung chu dong bam `Danh dau tat ca da doc`, them CTA bulk clear ngay trong `NotificationCenter.jsx`, va khoa regression `tests/notificationCenter.test.jsx`)
- [x] Cung cấp hub hướng dẫn nhanh/FAQ theo ngữ cảnh mỗi trang, liên kết tới tài liệu trong thư mục `docs/`. (done 2026-03-30, `SupportCenter` nay nhan `currentTabId` tu `App`, surfacing FAQ theo tab, doc references trong `docs/` voi copy-path CTA, va goi y training resources theo tags/keywords cua tung man hinh)

## 6. Reporting & automation

- [x] Xem trước nội dung báo cáo và lịch chạy kế tiếp ngay trong màn hình lập lịch (`getReportSchedules`). (done 2026-03-28, them preview next-run/output/recipients/data-source ngay trong `ReportingSchedulePanel` va khoa bang jsdom + Playwright)
- [x] Tạo dashboard KPI tổng quan với xu hướng tháng, top nhân sự, cảnh báo lệch chuẩn. (done 2026-03-28, them `ReportingExecutiveSummaryPanel` de surfacing executive snapshot + deviation signals tren report center)
- [x] Mở rộng kênh gửi báo cáo (email, chat nội bộ) và theo dõi trạng thái giao thành công/thất bại. (done 2026-03-28, them `deliveryChannels` + delivery status card metadata tren reporting schedules va dong bo contract client/server)
- [x] Cho phép người dùng tự tạo template báo cáo tùy biến, lưu trữ vào `KPI_ADJUSTMENT_SETTINGS_KEY` hoặc kho riêng. (done 2026-03-28, thêm local report template store + control CRUD/apply trực tiếp trong `ReportingControlsPanel` và regression cho hook/template state)

## 7. Reliability, QA & accessibility

- [x] Chuẩn hóa xử lý lỗi mạng trong `storageClient.js` (retry queue, rollback, thông báo rõ nghĩa). (done 2026-03-31, bead `cng-7z0.30`, them `storageSyncErrors` + rollback/retryability metadata + regression tests)
- [x] Bổ sung đo lường hiệu năng (Web Vitals, log render) và dashboard theo dõi để phát hiện màn hình chậm. (done 2026-03-31, bead `cng-7z0.31`, them telemetry module + Data Health frontend performance panel)
- [x] Thực hiện audit accessibility (focus trap, aria-label, contrast) trên các component trọng yếu (`KPIAdjustments`, `DataImporter`, `MSTAssignment`). (done 2026-03-29, bead `cng-7z0.32`, accessibility audit da chay va fixes da duoc merge)
- [x] Viết thêm test tự động cho các luồng filter và đồng bộ, đảm bảo không regress khi refactor. (done 2026-03-29, bead `cng-7z0.33`, bo sung regression coverage cho filter/sync flows)
- [x] Xây dựng checklist QA cuối sprint, liên kết vào `docs/operations/ui-verification-log.md`. (done 2026-03-28, thêm `docs/operations/ui-sprint-qa-checklist.md`)

## Cách sử dụng

1. Clone nhánh `ux-improvement-plan`.
2. Mỗi khi hoàn thành nhiệm vụ, cập nhật checkbox trong file này và thêm ghi chú.
3. Tạo PR riêng cho từng cụm nhiệm vụ để dễ review; Codex Cloud sẽ đánh dấu hoàn thành tại đây.
4. Sau khi toàn bộ nhiệm vụ được đánh dấu, chạy regression test và hợp nhất về `main`.
