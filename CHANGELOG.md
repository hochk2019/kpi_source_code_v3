# Changelog

## [2.0.0] - 2025-10-05
### Backend
- Đồng bộ chuẩn hóa \so_tk\ 11 chữ số ở tầng API (\
ormalizeDeclarationNumber\) để tránh trùng key khi import ECUS.
- Bổ sung API cấu hình mã ưu đãi C/O, cảnh báo sai lệch C/O và đồng bộ trạng thái an toàn (không phát \setState\ trong render).
- Cập nhật các đầu ra auth/report: trả token trong \/api/auth/session\, kiểm tra ECUS sync trả về đầy đủ metadata.

### Frontend
- Cải tiến Import Data: hiển thị số tờ khai đầy đủ + suffix, banner cập nhật, UI quản lý mã ưu đãi, bảng lệch C/O và định dạng ngày bằng \ormatDisplayDate\.
- Đồng bộ ReportViewer với dữ liệu chuẩn hóa, bổ sung kiểm tra khi thiếu dữ liệu.
- Điều chỉnh e2e import/login theo định dạng số mới (padding 11 chữ số).

### Tests
- Cập nhật toàn bộ test store/server/e2e theo chuẩn 11 chữ số và API mới.
- Thêm kiểm thử cập nhật \co_line_count\ cho bản ghi tồn tại và xác nhận cấu hình ECUS trả về đủ thông tin.

