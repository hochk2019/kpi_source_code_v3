# Nhật ký nhiệm vụ tab "Báo cáo KPI"

Tài liệu này tổng hợp các đầu việc sẽ lần lượt thực hiện cho tab **Báo cáo KPI**. Mỗi nhiệm vụ được chia nhỏ thành checklist, giúp dễ dàng đánh dấu khi hoàn thành.

## 1. Phân tích & lập kế hoạch triển khai
- [x] Thu thập đủ yêu cầu nghiệp vụ và ràng buộc hiện có (layout, quyền hiển thị, API liên quan). _Tổng hợp yêu cầu từ khách hàng: tách bộ chọn thời gian khỏi cụm Template/Rule/Info, cung cấp nút thu gọn mặc định đóng cho ba khu vực đó và chỉ hiển thị với admin; gom các widget "Diễn biến hiệu suất", "Chỉ số tổng hợp", "Cơ cấu tổ đội" vào một vùng Tổng quan mới đồng thời loại bỏ "Top nhân sự nổi bật"; bỏ giới hạn top 10 công ty và cho phép người dùng chọn số lượng mong muốn; bổ sung khả năng thu gọn/ghi nhớ trạng thái cho "Điểm KPI +/-". Các API hiện có (store `getDeclRows`, `getReportTemplates`, `getKpiAdjustments`,...) tiếp tục được tận dụng, tránh thay đổi hợp đồng dữ liệu._
- [x] Kiểm tra cấu trúc mã nguồn hiện hành của tab "Báo cáo KPI" (component chính, store, route) để xác định phạm vi ảnh hưởng. _`src/components/ReportViewer.jsx` là entry chính render toàn bộ dashboard, sử dụng `ReportFilterBar`, `ReportContextToolbar`, `ReportEntityTable`, `KpiAdjustmentPanel` cùng nhiều helper từ `lib/reports.js` và `lib/store.js`. Giao diện hiện tại chia thành filter bar (khoảng thời gian + template), toolbar (thao tác ngữ cảnh), các bảng/tabs hiển thị dữ liệu, và panel điều chỉnh KPI. Những khu vực cần chỉnh chủ yếu nằm trong `ReportViewer.jsx` và thư mục `src/components/report-viewer/`._
- [x] Vẽ sơ đồ phân khu giao diện mới (khoảng thời gian, template, bộ quy tắc, thông tin báo cáo, tổng quan KPI, top công ty, điểm KPI +/-). _Phân khu đề xuất:
  1. **Thanh chọn thời gian**: nằm độc lập phía trên, gồm quick range + custom range.
  2. **Nhóm Template/Rule/Info (chỉ admin)**: đặt cạnh nhau trong `Accordion`/`Collapsible` với trạng thái mặc định thu gọn, có badge cảnh báo khi thiếu dữ liệu.
  3. **Khu Tổng quan KPI**: container dạng grid gồm ba card (Diễn biến hiệu suất, Chỉ số tổng hợp, Cơ cấu tổ đội) dùng chung dữ liệu đã gom.
  4. **Bảng/biểu đồ Top công ty**: card riêng có tùy chọn số lượng hiển thị.
  5. **Điểm KPI +/- bổ sung**: panel có khả năng thu gọn, nhớ trạng thái.
  6. **Bảng chi tiết đội/người**: vẫn nằm dưới cùng như hiện tại._
- [x] Lên timeline thực thi theo từng cụm chức năng (chia tối thiểu 3 giai đoạn) và xác định trách nhiệm review. _**Giai đoạn 1 (1.5 ngày)**: Tái cấu trúc layout ReportViewer để tách time selector, thêm Collapsible admin block + quyền kiểm tra (review: Frontend lead). **Giai đoạn 2 (2 ngày)**: Refactor khu Tổng quan KPI và bỏ "Top nhân sự nổi bật", cập nhật logic dữ liệu (review: Data viz engineer). **Giai đoạn 3 (1.5 ngày)**: Mở rộng Top công ty với cấu hình động, hoàn thiện KpiAdjustmentPanel và regression test (review: QA lead)._
- [x] Xác định KPI kỹ thuật: số lượng component cần chỉnh sửa/tạo mới, thời gian ước lượng, yêu cầu QA (desktop/mobile, quyền admin). _Ước tính chạm vào 6 component chính (`ReportViewer`, `ReportFilterBar`, `ReportContextToolbar`, `ReportEntityTable`, `KpiAdjustmentPanel`, `CollapsibleCard`) cùng 2 file helper (`lib/reports.js`, `tests/...`). Thời gian tổng ~5 ngày công bao gồm review. QA cần test desktop 1280px+, viewport 1024px, kiểm tra vai trò Admin vs Viewer và xác nhận localStorage giữ trạng thái thu gọn._

## 2. Tách khu vực chọn khoảng thời gian khỏi TEMPLATE/BỘ QUY TẮC/THÔNG TIN
- [x] Kiểm tra component đang render khu vực thời gian và cụm TEMPLATE/BỘ QUY TẮC/THÔNG TIN. _Rà soát `ReportViewer.jsx` để xác định `ReportFilterBar`, `ReportContextToolbar` và khối thông tin báo cáo đang nằm chung trong thẻ `ds-card`, từ đó lên kế hoạch tách._
- [x] Tạo wrapper layout mới tách rời selector khoảng thời gian khỏi cụm template/rules/info. _`ReportFilterBar` hiện được render độc lập trong thẻ `ds-card` riêng (print hidden), còn cụm quản trị chuyển thành block riêng hiển thị phía dưới._
- [x] Bổ sung nút **Thu gọn / Mở rộng** cho từng khu vực (TEMPLATE BÁO CÁO, BỘ QUY TẮC KPI, THÔNG TIN BÁO CÁO) với trạng thái mặc định **thu gọn**. _Tái cấu trúc `ReportContextToolbar.jsx` sử dụng `CollapsibleCard` (lưu trạng thái bằng `localStorage`) cho 3 panel với `defaultOpen={false}`._
- [x] Giới hạn quyền hiển thị các khu vực này chỉ với người dùng admin, đảm bảo kiểm tra quyền trước khi render. _Trong `ReportViewer.jsx` chỉ render `ReportContextToolbar` khi `isAdminRole(currentUser?.role)` trả về `true`; người xem thường chỉ còn bộ lọc thời gian và dashboard._
- [x] Đảm bảo UI khi thu gọn vẫn giữ lại tiêu đề + nút mở rộng để tránh chiếm chỗ. _`CollapsibleCard` hiển thị tiêu đề, mô tả và badge trạng thái ngay cả khi nội dung đóng; hành động "Áp dụng từ…" vẫn ghim trên header thông tin._
- [x] Viết unit test/UI snapshot nếu cần cho hành vi thu gọn/mở rộng. _Bổ sung `tests/reportContextToolbar.test.jsx` xác nhận panel mặc định đóng và mở ra khi nhấn nút, đồng thời cập nhật `tests/reportViewer.test.jsx` để kiểm tra quyền admin/nhân viên._

## 3. Tái cấu trúc khu vực "Tổng quan KPI"
- [ ] Gom ba phần "DIỄN BIẾN HIỆU SUẤT", "CHỈ SỐ TỔNG HỢP" và biểu đồ "CƠ CẤU TỔ ĐỘI" vào cùng một container.
- [ ] Loại bỏ hoàn toàn block "Top nhân sự nổi bật" (đã có bảng xếp hạng nổi bật ở nơi khác).
- [ ] Rà soát và loại bỏ thống kê trùng lặp (so sánh với bảng xếp hạng, widget khác).
- [ ] Thiết kế lại giao diện với phong cách hiện đại (Grid responsive, card tối giản, màu sắc nhất quán với design system hiện hành).
- [ ] Cập nhật logic tính toán/tải dữ liệu nếu hợp nhất các nguồn dữ liệu khác nhau.
- [ ] Viết hướng dẫn QA: các trạng thái dữ liệu (đủ, thiếu, lỗi tải) cần kiểm thử.

## 4. Linh hoạt số lượng công ty trong "Top 10 công ty theo tờ khai"
- [ ] Rà soát component hiện tại đang giới hạn top 10 (filter/slice/limit) và gỡ bỏ ràng buộc cứng.
- [ ] Thêm tùy chọn cấu hình (ví dụ select hoặc input) để người dùng chọn số công ty muốn xem.
- [ ] Đảm bảo layout tự co giãn nếu danh sách dài nhưng vẫn giới hạn chiều cao hợp lý (scroll hoặc pagination).
- [ ] Cập nhật mô tả/tooltip giải thích rằng danh sách hiển thị nhiều hơn 10 nếu còn chỗ.
- [ ] Viết test logic để đảm bảo giá trị giới hạn người dùng chọn được áp dụng khi truy vấn dữ liệu.

## 5. Khu vực "Điểm KPI +/- bổ sung" có nút thu gọn
- [x] Thêm nút **Thu gọn / Mở rộng** mặc định trạng thái **mở**. _(Bổ sung nút `Button` ở phần header `KpiAdjustmentPanel.jsx` để đóng/mở toàn bộ nội dung.)_
- [x] Lưu lại lựa chọn người dùng (local storage hoặc store người dùng) để lần mở lại giữ trạng thái. _(Lưu trạng thái vào khóa `kpi-report.adjustment-panel.expanded` trong `localStorage` ngay khi người dùng bấm thu gọn/mở rộng.)_
- [x] Đảm bảo animation/transition mượt, không ảnh hưởng tới layout tổng thể. _(Bọc panel bằng `Collapsible` của Radix, bật `forceMount` và thêm animation `collapsible-up/down` trong `src/index.css` để nội dung ẩn/hiện với transition chiều cao + opacity mà không làm nhảy layout.)_
- [x] Kiểm tra quyền hiển thị và sự tương tác khi người dùng chỉ đọc. _(Xác định quyền từ `currentUser.permissions` trong `ReportViewer.jsx`; khi cả `adjustSubmit` và `adjustApprove` đều tắt thì truyền `readOnly` để vô hiệu hóa nút thu gọn và giữ nguyên trạng thái mở mặc định cho tài khoản chỉ xem.)_
- [x] Bổ sung kiểm thử UI/logic cho hành vi nhớ trạng thái. _(Thêm `tests/kpiAdjustmentPanel.test.jsx` dùng Testing Library kiểm tra việc ghi `localStorage` khi thu gọn/mở rộng và xác nhận nút bị khóa khi `readOnly`.)_

## 6. Kiểm thử & triển khai
- [ ] Cập nhật checklist QA/SIT bao phủ các thay đổi trên.
- [ ] Thực hiện kiểm thử cross-browser (Chrome, Edge) và kích thước màn hình chính.
- [ ] Chuẩn bị release note mô tả thay đổi tab "Báo cáo KPI".
- [ ] Theo dõi phản hồi người dùng sau khi triển khai và ghi nhận hạng mục cải tiến tiếp theo.
