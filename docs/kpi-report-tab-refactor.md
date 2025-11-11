# Kế hoạch tái cấu trúc tab "Báo cáo KPI"

Tài liệu này kết hợp ba đề xuất cải tiến giao diện đã thống nhất và bổ sung các yêu cầu loại bỏ/di chuyển chức năng để đảm bảo khu vực tab "Báo cáo KPI" gọn gàng, hiện đại và dễ mở rộng. Mỗi nhiệm vụ được chia nhỏ dưới dạng checklist để đội ngũ có thể lần lượt đánh dấu khi hoàn thành.

## 1. Chuẩn hoá thanh điều khiển đầu trang

### Mục tiêu
- Tách riêng vùng lọc nhanh và cấu hình bối cảnh (template, bộ quy tắc) để người dùng tìm thấy điều khiển quan trọng ngay lập tức.
- Loại bỏ nút **Reload** khỏi giao diện; thay vào đó, dữ liệu được làm tươi tự động sau khi điều chỉnh bộ lọc hoặc qua các hành động khác.

### Nhiệm vụ
- [ ] Tách JSX trong `src/components/ReportViewer.jsx` (đoạn hiện xử lý thanh điều khiển) thành hai component độc lập: `ReportFilterBar` và `ReportContextToolbar`.
- [ ] Bố trí `ReportFilterBar` chỉ gồm bộ lọc thời gian, nút xuất/in (nếu vẫn cần) và trạng thái tổng quan; bỏ hẳn nút reload.
- [ ] Gom lựa chọn template và bộ quy tắc KPI vào `ReportContextToolbar`, bổ sung nhãn mô tả rõ ràng và gộp các hành động phụ (lưu/cập nhật/xoá) vào menu phụ.
- [ ] Hiển thị tình trạng “Đang áp dụng: Template A / Bộ quy tắc B” trong header để người dùng nắm bối cảnh.
- [ ] Chuẩn hoá style (flex row, spacing, typography) để tạo cảm giác hiện đại, đồng bộ với design system.

## 2. Tổ chức lại khu vực nội dung tổng quan

### Mục tiêu
- Gom các widget thống kê nhanh, biểu đồ và thành phần liên quan thành một nhóm tổng quan rõ ràng.
- Di chuyển/hoà nhập khu vực **Top 10 công ty theo tờ khai** vào vùng tổng quan phù hợp để tránh rải rác.
- Loại bỏ hoàn toàn khối **Lập lịch gửi báo cáo KPI** khỏi tab.
- Tái cấu trúc khu vực **Điểm KPI +/- bổ sung** thành hai tầng: **Tổng quan** (hiển thị mặc định) và **Chi tiết** (mở khi cần).

### Nhiệm vụ
- [ ] Tạo container `KpiOverviewSection` bao gồm các component số liệu: `SummaryCard`, `TeamPieWidget`, `TopCompanyLeaderboard`, `TopStaffWidget`, biểu đồ Top 10 công ty theo tờ khai và các widget tổng quan khác.
- [ ] Thiết lập layout 2 cột (ví dụ 8/4 hoặc grid responsive) để đảm bảo sự cân bằng giữa số liệu và biểu đồ.
- [ ] Xoá hoặc ngăn render hoàn toàn khối `ReportAutomationPanel` / `Lập lịch gửi báo cáo KPI` khỏi `ReportViewer`.
- [ ] Tách logic của khu vực **Điểm KPI +/- bổ sung** thành component riêng có hai chế độ: `overview` (cards gọn, KPI chính) và `detail` (bảng/phân tích chuyên sâu); đặt `overview` làm mặc định.
- [ ] Thiết kế lại `KpiOverviewSection` để gắn khối **Điểm KPI +/- bổ sung** ở dạng tab phụ (Overview/Detail) hoặc accordion, đảm bảo không chiếm quá nhiều chiều cao khi mới mở trang.
- [ ] Bổ sung tiêu đề phụ và mô tả ngắn cho từng nhóm trong `KpiOverviewSection` để người dùng hiểu nhanh nội dung.

## 3. Thiết kế lại khu vực báo cáo theo tổ đội & cá nhân dạng Tab

### Mục tiêu
- Chuyển phần chuyển đổi phạm vi `staff/team` hiện tại thành hệ thống tab hai tầng thân thiện.
- Giảm trùng lặp giữa logic bảng của nhân viên và tổ đội bằng cách tái sử dụng component chung.
- Gom các bộ lọc nâng cao, lựa chọn cột vào panel phụ để phần đầu tab gọn gàng.

### Nhiệm vụ
- [ ] Thay state toggle `scope` bằng tab cha “Nhân viên” / “Tổ đội”, sử dụng component tab của design system (hoặc tự xây dựng) bảo đảm accessibility.
- [ ] Bên trong mỗi tab cha, tạo hai tab con “Tổng quan” (bảng rút gọn + chỉ số chính) và “Chi tiết” (card theo cá nhân/tổ, biểu đồ chuyên sâu), hiển thị “Tổng quan” mặc định.
- [ ] Trích xuất phần bảng + phân trang chung từ `renderStaffSection`/`renderTeamSection` thành component `ReportEntityTable` tái sử dụng.
- [ ] Di chuyển phần cấu hình hiển thị cột (`COLUMN_VISIBILITY_OPTIONS`) vào popover hoặc slide-over bên phải, tránh chiếm không gian trong thanh tab.
- [ ] Đảm bảo các component chi tiết (ví dụ `StaffDetailCard`, `TeamDetailCard`) nhận dữ liệu từ nguồn chung và hỗ trợ lazy loading khi người dùng mở tab “Chi tiết”.
- [ ] Bổ sung breadcrumbs nhỏ hoặc nhãn tiêu đề trong từng tab để người dùng biết mình đang ở tầng nào.

## 4. Theo dõi tiến độ
- Cập nhật trạng thái checklist trên mỗi nhiệm vụ khi hoàn thành.
- Ghi chú thêm ngày/thành viên hoàn thành ngay bên cạnh hộp kiểm nếu cần.
- Khi toàn bộ checklist được đánh dấu, bổ sung mục **Tổng kết** tóm lược cải tiến và kết quả đo lường (nếu có).

