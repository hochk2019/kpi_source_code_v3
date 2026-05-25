### **Danh sách kiểm tra (Checklist) Nâng cấp Hệ thống KPI Hải quan v3.0**

Quy ước xác minh:

- `[x]` Có bằng chứng rõ từ code/tests hiện có trong repo.
- `[ ]` Chưa tìm thấy, chưa khớp đầy đủ yêu cầu, hoặc mới dừng ở mức xác minh tĩnh chứ chưa đủ khẳng định runtime.

Bạn hãy xác nhận xem các hạng mục dưới đây đã được hoàn thành hay chưa?

#### **Phần 1: Sửa lỗi tính năng**
- [x] **Lỗi loại trừ giấy phép:** Các tờ khai có mã giấy phép trong danh sách loại trừ (ví dụ: ZN02, HDGC) đã được lọc bỏ một cách chính xác khi đồng bộ từ ECUS.
  Bằng chứng: có luồng loại trừ và test tại `src/components/dataImporter/useDataImporterLicenseExclusions.js`, `packages/domain/src/defaultRules.js`, `tests/useDataImporterLicenseExclusions.test.jsx`, `tests/dataImporter.test.js`, `tests/reportingClient.test.js`.

- [x] **Lỗi đối soát C/O:** Chức năng "Chạy kiểm tra" trong khu vực "Đối soát C/O" ở tab **Import Data** không còn báo lỗi `HTTP 500`.
  Bằng chứng: code panel/hook và test manual run/range tại `src/components/dataImporter/DataImporterMonitoringPanel.jsx`, `src/components/dataImporter/useDataImporterCoMonitoring.js`, `tests/useDataImporterCoMonitoring.test.jsx`; thêm runtime smoke `tests/playwright/import-monitoring.spec.js` xác nhận nút `Chạy kiểm tra` hoàn tất trong preview app, hiện thông điệp `Đã chạy đối soát C/O:` và không render `HTTP 500`/`Lỗi đối soát`.

- [ ] **Tối ưu mã nguồn:** Mã nguồn đã được rà soát để loại bỏ các đoạn code không sử dụng (code thừa).
  Ghi chú: chưa có bằng chứng cho một pass cleanup toàn repo. Repo vẫn còn nhiều component lớn và backlog decomposition vẫn còn mở.

---

#### **Phần 2: Nâng cấp Giao diện và Tính năng mới**

##### **1. Tab "Import Data"**
- [x] **Giao diện gọn gàng:** Các khu vực "Đồng bộ tự động", "Cấu hình mã ưu đãi C/O", và "Đối soát C/O" đã có thể thu gọn hoặc ẩn/hiện.
  Bằng chứng: `DataImporterSyncConfigPanel.jsx`, `DataImporterCoCodeConfigPanel.jsx`, `DataImporterMonitoringPanel.jsx` đều bọc bằng `CollapsibleCard`.

- [ ] **Chuẩn bị cho Tờ khai AMA:** Đã thêm cột **"Số TK AMA"** vào bảng danh sách tờ khai.
  Ghi chú: không tìm thấy dấu vết `AMA` hoặc `Số TK AMA` trong `src/`, `tests/`, `server/`, `packages/`.

- [x] **Nâng cấp khu vực tìm kiếm:** Đã bổ sung các tính năng sau:
  Bằng chứng tổng quát: `DataImporterQueryFilterControls.jsx`, `useDataImporterQueryFilters.js`, `useDataImporterFilterPresets.js`, `DataImporterSelectionActions.jsx`, `tests/dataImporterSelectionActions.test.jsx`.

- [x] Tìm kiếm theo khoảng thời gian được chọn.
  Bằng chứng: `DataImporterQueryFilterControls.jsx` có `Từ ngày` / `Đến ngày`; `useDataImporterResultRows.js` truyền `from` / `to` xuống query.

- [x] Nút "Chọn tất cả" các tờ khai trong kết quả tìm kiếm.
  Bằng chứng: `DataImporterSelectionActions.jsx` dòng chứa `Chọn tất cả kết quả lọc`; được test trong `tests/dataImporterSelectionActions.test.jsx`.

- [x] Nút "Đối chiếu và loại bỏ" để áp dụng lại quy tắc loại trừ giấy phép cho các tờ khai đã chọn.
  Ghi chú: label hiện tại trong UI là `Đối chiếu giấy phép`, nhưng tooltip và luồng xử lý cho thấy mục đích đúng với yêu cầu "đối chiếu lại giấy phép và loại bỏ mã bị loại trừ".

- [x] **Export Excel:** Đã có nút để xuất danh sách tờ khai đã được chọn ra file Excel.
  Bằng chứng: `DataImporterSelectionActions.jsx` có nút `Export Excel`; được test trong `tests/dataImporterSelectionActions.test.jsx` và runtime smoke `tests/playwright/export-flow.spec.js`.

##### **2. Tab "Gán MST"**
- [x] **Thêm thủ công:** Đã có nút **"Thêm mới"** để nhập tay thông tin gán MST cho khách hàng.
  Bằng chứng: `MSTAssignment.jsx` có nút `Thêm mới`, form `create`, và tooltip liên quan.

- [x] **Lịch sử chỉnh sửa:** Hệ thống đã hiển thị được lịch sử thay đổi người phụ trách và ngày áp dụng cho mỗi dòng MST.
  Bằng chứng: `MSTAssignment.jsx` có `HistoryDetails`, `getMSTHistoryEntries`, bộ lọc lịch sử, tooltip lịch sử; test `tests/mstAssignment.timeline.test.jsx` kiểm tra accordion timeline và modal chi tiết.

- [x] **Export Excel:** Đã có nút để xuất danh sách MST ra file Excel.
  Bằng chứng: `MSTAssignment.jsx` có tooltip cho `Xuất ra Excel các dòng đang hiển thị` và `Xuất ra Excel toàn bộ danh sách đang quản lý`.

##### **3. Tab "Đại Lý HQ"**
- [x] **Hỗ trợ nhiều đại lý & Lịch sử:** Một mã số thuế đã có thể được gán cho nhiều đại lý hải quan và có thể xem được lịch sử chỉnh sửa trên từng dòng.
  Bằng chứng: `HQAgencyManager.jsx` ghi rõ nhập nhiều đại lý bằng dấu phẩy, có `getHQHistoryEntries`, `refreshHQHistoryCache`, nút `Lịch sử`, và panel lịch sử theo từng MST.

##### **4. Tab "Quản Lý Tổ Đội"**
- [x] **Lịch sử thay đổi:** Có thể xem được lịch sử các thay đổi liên quan đến thành viên hoặc các mã số thuế được phân công cho tổ/đội.
  Bằng chứng: `TeamManager.jsx` có `teamHistory`, `mstHistory`, bộ chuyển tab lịch sử, tooltip và nút `Lịch sử cập nhật`.

##### **5. Tab "Quy tắc KPI"**
- [x] **Lưu trữ quy tắc an toàn:** Các quy tắc KPI đã được lưu vào cơ sở dữ liệu để đảm bảo không bị mất sau khi build lại dự án.
  Bằng chứng: `src/lib/store.js` dùng key `kpi_rules_v2`; `src/lib/storageClient.js` đồng bộ `kpi_rules_v2` qua `/api/storage/...`; backend có `storageRouteController.js` và `server/index.js` seed/persist vào `kv_store` SQLite.

- [x] **Cải thiện nhập liệu:** Ô nhập danh sách mã loại trừ đã được thay thế bằng trình chọn đa lựa chọn (multi-select) có gợi ý tự động để tránh sai chính tả.
  Bằng chứng: `RulesEditor.jsx` có `CodeMultiSelect`; các test trong `tests/rules.test.js` cũng bao phủ luồng lưu/khôi phục rule set.

##### **6. Tab mới "Điểm KPI +/- Thêm"**
- [x] **Tạo tab mới:** Giao diện đã có tab mới tên là **"Điểm KPI +/- Thêm"**.
  Bằng chứng: `src/lib/appShellNavigation.js` khai báo tab `adjustments` với label `Điểm KPI +/- Thêm`; runtime smoke `tests/playwright/adjustments-health.spec.js` xác nhận admin mở được workflow tab trong app shell thật.

- [ ] **Đầy đủ chức năng:** Tab này đã có các mục để cộng/trừ điểm KPI thủ công cho nhân viên theo tháng.
  Ghi chú: phần lớn nhóm chức năng đã có va runtime shell da duoc smoke-test qua `tests/playwright/adjustments-health.spec.js`, nhưng chưa thấy hạng mục đi làm muộn.

- [x] Hỗ trợ thông quan.
  Bằng chứng: `packages/domain/src/kpiAdjustments.js` có `support_fixed`, `support_dynamic`.

- [x] Hủy / Sửa tờ khai (phân biệt lỗi nhân viên/khách hàng).
  Bằng chứng: `cancel_staff`, `cancel_customer`, `correction_staff`, `correction_customer`, `co_correction`.

- [x] Hoàn thuế (phân biệt lỗi nhân viên/khách hàng).
  Bằng chứng: `tax_refund_staff`, `tax_refund_customer`.

- [x] Đánh giá định tính: Tinh thần nhóm, Thái độ đồng nghiệp, Thái độ khách hàng.
  Bằng chứng: `teamwork`, `colleague_attitude`, `customer_attitude`.

- [ ] Ghi nhận vi phạm: Đi làm muộn.
  Ghi chú: chưa tìm thấy category hoặc UI tương ứng trong `packages/domain/src/kpiAdjustments.js` và `KPIAdjustments.jsx`.

##### **7. Tab "Báo Cáo KPI"**
- [x] **Tái cấu trúc báo cáo:** Báo cáo KPI đã được cập nhật để tính toán và hiển thị tổng điểm cuối cùng, bao gồm cả các điểm cộng/trừ từ tab "Điểm KPI +/- Thêm".
  Bằng chứng: `ReportViewer.jsx` subscribe `KPI_ADJUSTMENTS_KEY`; `ReportingDashboardOverview.jsx` hiển thị `adjustmentsReport`; test `tests/reportingClient.test.js` và `tests/reportingAdjustmentsPanel.test.jsx` bao phủ adjustment totals.

- [x] **Bổ sung thông tin:** Báo cáo chi tiết đã hiển thị thêm các thông tin mới như tổng số lượng C/O và danh sách mã giấy phép bị loại trừ trong kỳ báo cáo.
  Bằng chứng: `ReportingDashboardOverview.jsx`, `StaffDetailCard.jsx`, `TeamDetailCard.jsx`, `ReportViewer.jsx`, `tests/reportingClient.test.js` đều có trường `co`, `coLines`, `licenseExcludedSummary`.

##### **8. Tab "Tài Khoản"**
- [ ] **Tạo tài khoản mặc định:** Các tài khoản cho nhân viên, trưởng nhóm (Học, Phương, Tuấn), và cấp quản lý (Hòa, Hà, Nam) với các cấp phân quyền tương ứng đã được tạo sẵn trong hệ thống.
  Ghi chú: backend hiện có seed mặc định `lead.hoc`, `lead.phuong`, `lead.tuan`, `manager.hoangkimhoa`, `manager.thuyha`, `manager.hoainam`, cùng `admin` và `nhanvien`. Tuy nhiên tên hiển thị không khớp hoàn toàn checklist gốc, và chưa đủ bằng chứng để xác nhận mapping người dùng thực tế đã hoàn tất.

##### **9. Nâng cấp chung**
- [x] **Hướng dẫn sử dụng (Tooltip):** Khi di chuột qua các nút bấm chính, có hiển thị chú thích ngắn gọn về chức năng của nút đó.
  Bằng chứng: nhiều `data-tooltip`/`title` trong `MSTAssignment.jsx`, `AccountManager.jsx`, `DataImporterSelectionActions.jsx`, `TeamManager.jsx`.

- [x] **Tích hợp AI:** Đã có kế hoạch và phát triển tích hợp AI trong xử lý dữ liệu và chatbot.
  Ghi chú: repo đã có `AiAssistant.jsx`, backend config/cache/history AI trong `server/index.js`, và route lưu lịch sử/chat state. Phần "tiết kiệm token" có dấu hiệu thiết kế cache/history, nhưng pass này chưa benchmark chi phí token thực tế.
