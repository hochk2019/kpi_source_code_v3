# Nhật ký nhiệm vụ tab "Báo cáo KPI"

Tài liệu này tổng hợp các đầu việc sẽ lần lượt thực hiện cho tab **Báo cáo KPI**. Mỗi nhiệm vụ được chia nhỏ thành checklist, giúp dễ dàng đánh dấu khi hoàn thành.

## 1. Phân tích & lập kế hoạch triển khai
- [ ] Thu thập đủ yêu cầu nghiệp vụ và ràng buộc hiện có (layout, quyền hiển thị, API liên quan).
- [ ] Kiểm tra cấu trúc mã nguồn hiện hành của tab "Báo cáo KPI" (component chính, store, route) để xác định phạm vi ảnh hưởng.
- [ ] Vẽ sơ đồ phân khu giao diện mới (khoảng thời gian, template, bộ quy tắc, thông tin báo cáo, tổng quan KPI, top công ty, điểm KPI +/-).
- [ ] Lên timeline thực thi theo từng cụm chức năng (chia tối thiểu 3 giai đoạn) và xác định trách nhiệm review.
- [ ] Xác định KPI kỹ thuật: số lượng component cần chỉnh sửa/tạo mới, thời gian ước lượng, yêu cầu QA (desktop/mobile, quyền admin).

## 2. Tách khu vực chọn khoảng thời gian khỏi TEMPLATE/BỘ QUY TẮC/THÔNG TIN
- [ ] Kiểm tra component đang render khu vực thời gian và cụm TEMPLATE/BỘ QUY TẮC/THÔNG TIN.
- [ ] Tạo wrapper layout mới tách rời selector khoảng thời gian khỏi cụm template/rules/info.
- [ ] Bổ sung nút **Thu gọn / Mở rộng** cho từng khu vực (TEMPLATE BÁO CÁO, BỘ QUY TẮC KPI, THÔNG TIN BÁO CÁO) với trạng thái mặc định **thu gọn**.
- [ ] Giới hạn quyền hiển thị các khu vực này chỉ với người dùng admin, đảm bảo kiểm tra quyền trước khi render.
- [ ] Đảm bảo UI khi thu gọn vẫn giữ lại tiêu đề + nút mở rộng để tránh chiếm chỗ.
- [ ] Viết unit test/UI snapshot nếu cần cho hành vi thu gọn/mở rộng.

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
- [ ] Đảm bảo animation/transition mượt, không ảnh hưởng tới layout tổng thể.
- [ ] Kiểm tra quyền hiển thị và sự tương tác khi người dùng chỉ đọc.
- [ ] Bổ sung kiểm thử UI/logic cho hành vi nhớ trạng thái.

## 6. Kiểm thử & triển khai
- [ ] Cập nhật checklist QA/SIT bao phủ các thay đổi trên.
- [ ] Thực hiện kiểm thử cross-browser (Chrome, Edge) và kích thước màn hình chính.
- [ ] Chuẩn bị release note mô tả thay đổi tab "Báo cáo KPI".
- [ ] Theo dõi phản hồi người dùng sau khi triển khai và ghi nhận hạng mục cải tiến tiếp theo.
