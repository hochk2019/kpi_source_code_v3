# Đối chiếu Checklist Nâng cấp KPI Hải quan 3.0

Nguồn tham chiếu: Checklist nghiệp vụ cung cấp ("Danh sách kiểm tra Nâng cấp Hệ thống KPI Hải quan 3.0") được đối chiếu trực tiếp với mã nguồn hiện tại. Bảng dưới ghi nhận trạng thái, chứng cứ kỹ thuật và ghi chú nếu còn việc cần làm.

## Phần 1 · Sửa lỗi tính năng
- [x] **Lỗi loại trừ giấy phép** – Hàm `applyLicenseExclusionForKeys` trong `DataImporter` chuẩn hóa tập mã giấy phép, loại bỏ các mã nằm trong danh sách loại trừ theo quy tắc và cập nhật lại điểm KPI trước khi lưu【F:src/components/DataImporter.jsx†L1704-L1851】.
- [x] **Lỗi đối soát C/O** – Sự kiện `handleRunCoDiscrepancy` gọi API `/api/import/co-discrepancy/run`, xử lý thông báo lỗi và đồng bộ lại trạng thái để tránh HTTP 500【F:src/components/DataImporter.jsx†L841-L869】.
- [x] **Tối ưu mã nguồn** – Đã xoá trọn bộ module sidebar thử nghiệm (`src/components/ui/sidebar.jsx`, `src/hooks/use-mobile.js`) vì không được import, thu gọn 700 dòng UI thừa và chạy lại `pnpm lint`, `pnpm test`, `pnpm build` để xác nhận hệ thống ổn định.【F:docs/todo-checklist-gaps.md†L4-L15】

## Phần 2 · Nâng cấp giao diện và tính năng mới
### Tab "Import Data"
- [x] **Giao diện thu gọn** – Các vùng cấu hình (Đồng bộ ECUS, Cấu hình mã ưu đãi, Đối soát C/O) dùng `CollapsibleCard` cho phép thu gọn, nhớ trạng thái qua localStorage【F:src/components/DataImporter.jsx†L1989-L2046】【F:src/components/CollapsibleCard.jsx†L16-L57】.
- [x] **Chuẩn bị cho Tờ khai AMA** – Bảng danh sách hiển thị cột "Số TK AMA" và xuất Excel kèm trường này để sẵn sàng cho nâng cấp AMA【F:src/components/DataImporter.jsx†L2840-L2895】【F:src/components/DataImporter.jsx†L1853-L1865】.
- [x] **Nâng cấp tìm kiếm**
  - [x] Bộ lọc thời gian sử dụng `DATE_RANGE_PRESETS` với các mốc ngày/tháng/quý giúp lọc theo khoảng tùy chọn【F:src/components/DataImporter.jsx†L55-L134】.
  - [x] Nút "Chọn tất cả kết quả lọc" đặt toàn bộ kết quả hiện tại vào danh sách chọn để thao tác hàng loạt【F:src/components/DataImporter.jsx†L1704-L1715】【F:src/components/DataImporter.jsx†L2764-L2779】.
  - [x] Nút "Đối chiếu giấy phép" áp dụng lại quy tắc loại trừ cho các tờ khai đã chọn, cảnh báo khi không có thay đổi【F:src/components/DataImporter.jsx†L1704-L1851】【F:src/components/DataImporter.jsx†L2802-L2813】.
- [x] **Export Excel** – `handleExportSelected` chuyển các tờ khai đã chọn thành file Excel kèm thông tin giấy phép và mã loại trừ【F:src/components/DataImporter.jsx†L1853-L1865】【F:src/components/DataImporter.jsx†L2815-L2826】.

### Tab "Gán MST"
- [x] **Thêm thủ công** – Nút "Thêm mới" mở form nhập tay MST/nhân sự với hỗ trợ chuẩn hóa dữ liệu đầu vào【F:src/components/MSTAssignment.jsx†L528-L707】.
- [x] **Lịch sử chỉnh sửa** – `HistoryDetails` hiển thị lịch sử thay đổi người phụ trách và ngày áp dụng cho từng MST【F:src/components/MSTAssignment.jsx†L820-L891】.
- [x] **Export Excel** – Hai nút `Export (lọc)` và `Export (tất cả)` gọi `exportRowsToExcel` để xuất danh sách theo bộ lọc hoặc toàn bộ dữ liệu【F:src/components/MSTAssignment.jsx†L600-L616】.

### Tab "Đại Lý HQ"
- [x] **Hỗ trợ nhiều đại lý & lịch sử** – Ô nhập cho phép nhiều đại lý cách nhau bởi dấu phẩy, đồng thời nút "Lịch sử" hiển thị nhật ký chỉnh sửa cho từng MST【F:src/lib/store.js†L862-L907】【F:src/components/HQAgencyManager.jsx†L485-L568】.

### Tab "Quản Lý Tổ Đội"
- [x] **Lịch sử thay đổi** – Nút "Lịch sử cập nhật" mở bảng hiển thị log thao tác tổ đội và lịch sử gán MST chi tiết theo từng trường【F:src/components/TeamManager.jsx†L520-L686】.

### Tab "Quy tắc KPI"
- [x] **Lưu trữ quy tắc an toàn** – Khi lưu quy tắc, hệ thống gọi `persistRulesSnapshot` để ghi JSON vào thư mục `server/data`, duy trì qua các lần build/deploy【F:src/lib/rules.js†L242-L300】【F:server/rulesPersistence.js†L64-L109】.
- [x] **Trình chọn đa lựa chọn mã loại trừ** – Thành phần `CodeMultiSelect` cung cấp tìm kiếm, chọn nhiều và badge hiển thị cho danh sách mã loại trừ trong từng nhóm quy tắc【F:src/components/RulesEditor.jsx†L119-L220】【F:src/components/RulesEditor.jsx†L903-L940】.

### Tab "Điểm KPI +/- Thêm"
- [x] **Tab mới và chức năng** – Tab "Điểm KPI +/- Thêm" hiển thị `KPIAdjustments`, cho phép tạo, duyệt và thống kê các hạng mục cộng/trừ điểm (hỗ trợ thông quan, huỷ/sửa, hoàn thuế, đánh giá định tính, vi phạm…) dựa trên cấu hình `KPI_ADJUSTMENT_CATEGORY_CONFIG`【F:src/components/KPICalculator.jsx†L40-L120】【F:src/components/KPIAdjustments.jsx†L1-L200】【F:src/lib/store.js†L1273-L1306】.

### Tab "Báo Cáo KPI"
- [x] **Tái cấu trúc báo cáo** – Báo cáo dùng `buildReportData` gộp điểm KPI cơ bản với điều chỉnh bổ sung, hiển thị thẻ tóm tắt điểm cộng/trừ và bảng chi tiết các khoản đã duyệt【F:src/components/ReportViewer.jsx†L885-L1045】【F:src/components/ReportViewer.jsx†L1589-L1664】【F:src/lib/reports.js†L400-L520】【F:src/lib/reports.js†L770-L796】.
- [x] **Bổ sung thông tin** – Summary card bổ sung thống kê C/O, số mã giấy phép đã loại trừ và tooltip mô tả danh sách mã áp dụng trong kỳ【F:src/components/ReportViewer.jsx†L1590-L1626】【F:src/lib/reports.js†L770-L776】【F:src/components/ReportViewer.jsx†L369-L701】.

### Tab "Tài Khoản"
- [x] **Tạo tài khoản mặc định** – Backend seed sẵn tài khoản nhân viên, trưởng nhóm (Học/Phương/Tuấn) và quản lý (Hòa/Hà/Nam) với quyền tương ứng ngay khi khởi tạo cơ sở dữ liệu【F:server/index.js†L488-L534】.

### Nâng cấp chung
- [x] **Tooltip hướng dẫn** – Hook `useTooltipTitles` đồng bộ `data-tooltip`/`aria-label` thành tooltip chuẩn trên toàn giao diện, áp dụng tại Import Data và các module khác【F:src/components/DataImporter.jsx†L1504-L1514】【F:src/hooks/useTooltipTitles.js†L1-L39】.
- [x] **Tích hợp AI** – Tab "Trợ lý AI" dùng `AiAssistant` để cấu hình provider, gọi API chat nội bộ và quản lý nhật ký tương tác【F:src/components/KPICalculator.jsx†L64-L134】【F:src/components/AiAssistant.jsx†L1-L120】.

## Kết luận
- Toàn bộ hạng mục Checklist 3.0 đã có mặt trong mã nguồn và đã được chạy lại kiểm thử sau đợt tối ưu mã nguồn.
- Duy trì lịch rà soát định kỳ để phát hiện mã thừa mới phát sinh trong các lần nâng cấp tiếp theo.
- Việc gỡ bỏ `sidebar.jsx` và `use-mobile.js` không ảnh hưởng tới khả năng truy cập trên thiết bị di động: phần đầu trang sử dụng bố cục `flex-col`/`sm:flex-row`, cụm tab tự động xuống dòng (`flex-wrap`) và bảng dữ liệu hỗ trợ cuộn ngang khi màn hình hẹp, nên giao diện vẫn vận hành đầy đủ qua điện thoại trong mạng LAN.【F:src/App.jsx†L74-L134】【F:src/components/KPICalculator.jsx†L39-L140】【F:src/components/DataImporter.jsx†L2820-L2885】
