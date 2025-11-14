# Hướng dẫn điều chỉnh KPI

Tài liệu này mô tả quy trình làm việc với tab **Điều chỉnh KPI** trong ứng dụng, từ lúc tạo yêu cầu điều chỉnh cho đến khi duyệt và đối chiếu lịch sử.

## 1. Tổng quan

- Mỗi điều chỉnh (adjustment) gắn với một tờ khai cụ thể và có các trường: `Loại`, `Điểm`, `Người đề xuất`, `Người duyệt`, `Ghi chú nội bộ`.
- Quyền `adjustApprove` cho phép duyệt/từ chối điều chỉnh, trong khi quyền `adjustEdit` cho phép tạo và chỉnh sửa bản nháp.
- Tất cả thao tác được ghi vào bảng `kpi_adjustments_log` và xuất hiện trong tab **Nhật ký hệ thống**.

## 2. Tạo mới điều chỉnh

1. Chọn tờ khai trong bảng KPI và nhấn **"Thêm điều chỉnh"** ở cột hành động.
2. Điền các trường bắt buộc: loại điều chỉnh (ví dụ `Điểm thưởng`, `Điểm trừ`), số điểm cộng/trừ và lý do cụ thể.
3. (Tuỳ chọn) Đính kèm mô tả chi tiết vào trường **Ghi chú nội bộ** để nhóm duyệt dễ đối chiếu.
4. Nhấn **Lưu**. Điều chỉnh sẽ ở trạng thái `draft` cho đến khi được duyệt.

> 💡 *Tips*: Có thể tạo nhiều điều chỉnh liên tiếp bằng nút **"Thêm điều chỉnh khác"** – giao diện tự động giữ nguyên thông tin tờ khai đang thao tác.

## 3. Rà soát và lọc

- Bộ lọc bên trái cho phép lọc theo trạng thái (`draft`, `pending`, `approved`, `rejected`), người đề xuất hoặc người duyệt.
- Sử dụng ô **Tìm nhanh** để tìm theo số tờ khai hoặc tên nhân viên trong lịch sử điều chỉnh.
- Khi chọn một điều chỉnh, panel bên phải hiển thị đầy đủ nội dung và lịch sử trao đổi.

## 4. <a name="duyet-hang-loat"></a>Duyệt/Từ chối hàng loạt

1. Đánh dấu các bản ghi muốn duyệt trong danh sách bằng checkbox đầu dòng.
2. Chọn **Duyệt** hoặc **Từ chối** trên thanh tác vụ nổi.
3. Nhập ghi chú duyệt (bắt buộc khi từ chối) để đảm bảo minh bạch.
4. Nhấn **Xác nhận**. Trạng thái và lịch sử audit cập nhật ngay lập tức.

> ⚠️ *Lưu ý*: Nếu một bản ghi đã được người khác xử lý trước đó, giao diện hiển thị cảnh báo và bỏ qua bản ghi đó khi xử lý hàng loạt.

## 5. <a name="lich-su-va-audit"></a>Lịch sử và audit

- Mỗi lần tạo, cập nhật hoặc duyệt điều chỉnh đều sinh log `adjustment.create`, `adjustment.update`, `adjustment.approve`, `adjustment.reject`.
- Panel **Lịch sử** cho biết ai đã sửa, thời điểm và nội dung thay đổi; có thể xuất ra CSV để lưu trữ nội bộ.
- Tab **Nhật ký hệ thống** cũng hiển thị đầy đủ thông tin để đối chiếu chéo giữa các bộ phận.

## 6. Tips vận hành

- Thiết lập bộ lọc mặc định theo tổ đội bằng nút **Lưu bộ lọc** giúp trưởng nhóm chỉ thấy điều chỉnh của team mình.
- Sử dụng trường **Ghi chú nội bộ** để ghi lại cuộc trao đổi ngắn, tránh thất lạc khi chuyển ca làm việc.
- Định kỳ (cuối tuần/tháng), chạy báo cáo KPI sau khi duyệt điều chỉnh để đảm bảo điểm số phản ánh chính xác.

---

Nếu cần tích hợp thêm quy trình duyệt hoặc thông báo tự động, liên hệ nhóm phát triển để cập nhật workflow phù hợp.

