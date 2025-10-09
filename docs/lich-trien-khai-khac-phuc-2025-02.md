# Lịch triển khai khắc phục sự cố Báo cáo KPI (02/2025)

| STT | Hạng mục | Mô tả chi tiết | Trạng thái | Ghi chú |
| --- | -------- | -------------- | ---------- | ------- |
| 1 | Lọc giấy phép hợp lệ | Hiệu chỉnh giao diện và xuất Excel chỉ hiển thị mã giấy phép được tính KPI | Đã hoàn thành | Đồng bộ importer/reports và test lại các case loại trừ. |
| 2 | Đồng bộ ẩn/hiện cột export | Gửi trạng thái cột tùy chọn từ giao diện sang máy chủ và loại bỏ cột tương ứng trong file Excel | Đã hoàn thành | Cả 4 mẫu báo cáo hỗ trợ cột động. |
| 3 | Tổng hợp điểm điều chỉnh KPI | Bổ sung số liệu điểm +/- (Huỷ, Sửa, Hoàn thuế, Hỗ trợ) vào mục "Báo cáo tổng quát" trong Excel | Đã hoàn thành | Thêm bảng tổng hợp hạng mục và hiển thị trong UI. |
| 4 | Làm mới template Excel | Tái thiết kế màu sắc, căn chỉnh đầu trang, loại bỏ hình khối lỗi và bổ sung chú giải KPI | Đã hoàn thành | Palette xanh thương hiệu, căn giữa tiêu đề, bỏ shape lỗi. |
| 5 | Chủ đề tối & tương phản cao | Chỉnh màu Import Data và Đại lý HQ dùng token theme mới | Đã hoàn thành | Bổ sung lớp phủ `.import-data-view` và `.hq-agency-view`. |
| 6 | Tích hợp Google AI Studio | Lưu khóa API từ UI, kiểm thử với khóa mẫu và bổ sung gợi ý cấu hình nhà cung cấp | Đã hoàn thành | Có preset Gemini, hỗ trợ nhập/xóa khóa trực tiếp. |
| 7 | Mở rộng nhà cung cấp AI | Cho phép thêm các preset API phổ biến (OpenAI, Anthropic, Google) kèm hướng dẫn | Đã hoàn thành | UI thêm/xóa nhà cung cấp và tip cấu hình. |
| 8 | Lịch sử Quy tắc KPI | Xây dựng API/ giao diện hiển thị lịch sử thay đổi điểm KPI | Đã hoàn thành | RulesEditor hiển thị bảng lịch sử và endpoint `/api/rules/history`. |
| 9 | Bộ lọc Điểm KPI +/- thêm | Ràng buộc chọn tổ đội & nhân viên theo roster | Đã hoàn thành | Lọc nhân sự theo tổ, tự điền tổ khi chọn nhân viên. |
| 10 | Quyền hạn Import Data | Bổ sung nhãn quyền, ẩn nút import/ghi đè cho Lead & Staff và khóa chỉnh sửa ngoài phạm vi | Đã hoàn thành | Kiểm tra quyền từng dòng, hiện badge “Chỉ xem”. |
| 11 | Sửa lỗi quyền hiển thị | Hoàn thiện nhãn checkbox và phân quyền trưởng nhóm/nhân viên theo yêu cầu | Đã hoàn thành | Checkbox bổ sung nhãn rõ ràng cho AI/KPI. |
| 12 | Kiểm thử & ảnh minh hoạ | Kích hoạt demo mode, chạy kiểm thử tự động và chụp màn hình minh họa | Đã hoàn thành | Vitest pass và bổ sung ảnh dashboard/Import Data/HQ. |
