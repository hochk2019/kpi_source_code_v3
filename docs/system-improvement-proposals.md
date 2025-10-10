# Đề xuất cải tiến tổng thể hệ thống KPI

## 1. Kiến trúc & chất lượng mã nguồn

- ✅ Chuẩn hoá các hook và tiện ích dùng chung (đã thêm `useAsyncRequest`, `usePagination` và áp dụng cho DataHealthDashboard, MSTAssignment) để giảm lặp lại logic trong các trang báo cáo.
- ✅ Tách riêng cấu hình nhà cung cấp AI trong `server/index.js` thành các module nhỏ (`providers/deepseek.js`, `providers/qwen.js`...), giúp dễ dàng bảo trì và mở rộng.
- ✅ Bổ sung lớp mapping dữ liệu giữa SQL Server 2008 R2 và các mô-đun báo cáo để đảm bảo tương thích Unicode, tránh lỗi cắt chuỗi tiếng Việt.
- ✅ Áp dụng kiểm tra lint và định dạng tự động trên CI (ESLint + Prettier) kèm quy tắc dành riêng cho môi trường Windows (dấu xuống dòng CRLF) nhằm giảm xung đột khi triển khai nội bộ.
- ✅ Viết thêm bộ test E2E tối thiểu cho các luồng trọng yếu (nhập tờ khai, đồng bộ ECUS, xuất Excel) bằng Playwright ở chế độ headless để bắt sớm lỗi giao diện.

## 2. Giao diện & trải nghiệm người dùng

- ✅ Thiết lập thư viện theme hỗ trợ "chế độ tối" và các biến CSS cho thương hiệu (đã bổ sung preset Golden/Ocean/Forest, lưu lựa chọn người dùng và tự đồng bộ màu accent trên toàn giao diện) để thao tác nhanh hơn khi cần re-branding.
- ✅ Bổ sung chỉ báo trạng thái kết nối ECUS trực tiếp trên dashboard (màu sắc + thời gian cập nhật) để nhân viên nhận biết ngay khi đồng bộ bị gián đoạn.
- ✅ Gộp các bộ lọc thường dùng (khoảng ngày, C/O, đội xử lý) thành bộ preset có thể lưu theo người dùng, đồng bộ `localStorage` với API backend và hỗ trợ nhập lại bộ lọc cũ.
- ✅ Thêm chế độ so sánh hai bản ghi tờ khai khi phát hiện trùng (diff viewer) giúp trưởng nhóm xác nhận nhanh dữ liệu cần ghi đè.
- ✅ Hoàn thiện thông báo toast tiếng Việt chuẩn hoá dấu câu, nhấn mạnh kết quả thành công/thất bại để giảm hiểu nhầm khi thao tác nhanh.

## 3. Vận hành & giám sát

- ✅ Dựng cron Windows Task Scheduler chạy script PowerShell 7 kiểm tra dịch vụ đồng bộ mỗi 15 phút, ghi log vào Event Viewer để dễ truy vết.
- ✅ Tích hợp cảnh báo email/Teams khi đồng bộ ECUS thất bại trên 3 lần liên tiếp hoặc khi độ trễ dữ liệu > 60 phút.
- ✅ Xuất bản dashboard giám sát (Grafana hoặc Power BI) đọc trực tiếp từ log để theo dõi số lượng tờ khai, số lỗi import, thời gian phản hồi API AI.
- 📌 **Đang làm rõ**: Chuẩn hoá quy trình backup SQL Server 2008 R2 (full hằng ngày, diff mỗi 6h) và kiểm tra khôi phục định kỳ trên môi trường dự phòng. Hệ thống KPI lưu dữ liệu vận hành bằng SQLite, chỉ kết nối đọc/đồng bộ từ CSDL ECUS5VNACCS trên SQL Server 2008 R2; vì vậy hạng mục này tập trung vào việc phối hợp với đội vận hành ECUS để chuẩn hoá lịch backup và bài kiểm tra khôi phục cho máy chủ ECUS, đồng thời ghi nhận rõ phạm vi ảnh hưởng tới tiến trình đồng bộ của ứng dụng KPI.

## 4. Bảo mật & xuất Excel

- ✅ Mã hoá thông tin đăng nhập ECUS bằng DPAPI (PowerShell 7) với bộ script tạo/đọc `ecus.credentials.enc` và tự giải mã khi backend khởi động.
- Bổ sung chữ ký số hoặc watermark vào file Excel xuất khẩu để truy vết nguồn phát tán, đồng thời ghi log người tải.
- Giới hạn quyền export dữ liệu chỉ cho vai trò quản lý, và ghi nhận lịch sử tải qua bảng `export_audit` trong SQL Server.
- Thêm lớp kiểm tra đầu vào khi import Excel (kích thước file, số dòng, định dạng ngày) để ngăn chặn dữ liệu độc hại hoặc lỗi Unicode.
- Kích hoạt HTTPS nội bộ với chứng chỉ tự ký cho các endpoint AI để bảo vệ dữ liệu khi truyền giữa các dịch vụ.

## 5. Lộ trình triển khai

1. **Ngắn hạn (1-2 tuần)**: sửa lỗi hiện hữu, hoàn thiện preset lọc, bổ sung giám sát đồng bộ và audit export.
2. **Trung hạn (1-2 tháng)**: refactor module AI, viết thêm test, triển khai cảnh báo và dashboard giám sát.
3. **Dài hạn (3-6 tháng)**: hoàn thiện kiến trúc plugin AI, tự động hoá triển khai, mở rộng phân quyền chi tiết và bảo mật dữ liệu đầu cuối.

Các đề xuất trên hướng tới việc tăng độ ổn định, dễ bảo trì và đáp ứng yêu cầu vận hành trong môi trường Windows 11 Pro kết nối SQL Server 2008 R2.
