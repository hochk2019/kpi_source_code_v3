# Kế hoạch nâng cấp giao diện tab "Gán MST"

## Mục tiêu
- Đơn giản hóa và hiện đại hóa giao diện bảng "Gán MST" nhưng vẫn duy trì đầy đủ chức năng hiện có.
- Tối ưu trải nghiệm người dùng khi thao tác trên Windows 11 Pro, Powershell 7 và môi trường kết nối SQL Server 2008 R2 (ECUS5VNACCS).
- Đảm bảo hiển thị tiếng Việt chuẩn Unicode và ghi nhận tiến độ thực hiện qua checklist.

## Phạm vi
- Giao diện bảng danh sách công ty trong tab "Gán MST".
- Khu vực phân trang, cột thông tin phụ trách, và khối "Dòng thời gian giai đoạn (theo bộ lọc)".
- Tài liệu hóa và theo dõi quá trình triển khai các hạng mục giao diện.

## Nguyên tắc thiết kế
- Ưu tiên bố cục gọn gàng, cân bằng giữa thông tin và không gian hiển thị.
- Cho phép người dùng chủ động điều chỉnh (ví dụ: chiều rộng cột, số dòng mỗi trang) và ghi nhớ tùy chỉnh.
- Đảm bảo tương thích với chuỗi ký tự tiếng Việt có dấu, tránh lỗi tràn chữ hoặc cắt ký tự.

## Checklist triển khai

### 1. Kiểm soát hiển thị tên công ty dài
- [x] Bọc nội dung cột công ty bằng thành phần hỗ trợ xuống dòng (ví dụ: `span` với `break-words`, `whitespace-normal`). _(ChatGPT – 2025-10-23)_
- [x] Áp dụng logic kiểm tra độ dài ≥ 25 ký tự để chủ động xuống dòng, đảm bảo không kéo giãn chiều ngang bảng. _(ChatGPT – 2025-10-23)_
- [x] Kiểm thử hiển thị và chỉnh sửa tên công ty trên Windows 11, bảo đảm Unicode tiếng Việt hiển thị chính xác. _(ChatGPT – 2025-10-23)_

### 2. Thu gọn cột "Người phụ trách Nhập" và "Người phụ trách Xuất"
- [x] Điều chỉnh tiêu đề cột (viết tắt hoặc kết hợp icon + tooltip) nhằm giảm chiều ngang. _(ChatGPT – 2025-10-23)_
- [x] Cho phép nội dung tên nhân sự xuống dòng, dùng bố cục `flex` hoặc `grid` để hiển thị gọn gàng trong 2 dòng. _(ChatGPT – 2025-10-23)_
- [x] Xác nhận component chọn nhân sự (combobox) tương thích kích thước mới, popover không bị tràn. _(ChatGPT – 2025-10-23)_

### 3. Tùy chọn số dòng mỗi trang
- [x] Đặt mặc định 15 dòng/MST trong phân trang và thêm lựa chọn 30, 50, 100 dòng. _(ChatGPT – 2025-10-23)_
- [x] Bổ sung tùy chọn "Tùy chỉnh" cho phép nhập số dòng tối thiểu 10, lưu giá trị vào `localStorage`. _(ChatGPT – 2025-10-23)_
- [x] Viết (hoặc cập nhật) kiểm thử bảo đảm phân trang phản hồi đúng khi người dùng đổi số dòng. _(ChatGPT – 2025-10-23)_

### 4. Cho phép kéo giãn và lưu chiều rộng cột
- [ ] Khởi tạo trạng thái `columnWidths` đọc/ghi từ `localStorage` với giá trị mặc định hợp lý.
- [ ] Thêm tay cầm kéo ở mỗi tiêu đề cột, cập nhật chiều rộng động và đồng bộ xuống `localStorage` có debounce.
- [ ] Cung cấp nút "Đặt lại chiều rộng" để đưa cấu hình về mặc định; kiểm thử khôi phục sau khi tải lại trang.

### 5. Tái cấu trúc "Dòng thời gian giai đoạn"
- [ ] Gom dữ liệu timeline theo từng hàng công ty và hiển thị dạng accordion/popup ngay trong cột trạng thái hoặc hành động.
- [ ] Loại bỏ khối timeline dài phía dưới hoặc chuyển thành chế độ mở rộng khi người dùng yêu cầu.
- [ ] Đảm bảo tùy chọn xem chi tiết đầy đủ vẫn khả dụng (ví dụ: modal toàn màn hình) và cập nhật kiểm thử liên quan.

### 6. Theo dõi và cập nhật tài liệu
- [ ] Duy trì file kế hoạch này, đánh dấu `[x]` sau khi hoàn tất từng hạng mục và ghi chú người thực hiện + ngày.
- [ ] Liên kết kế hoạch vào các tài liệu vận hành liên quan (ví dụ `docs/USER_GUIDE.md`) nếu cần.
- [ ] Định kỳ rà soát để bổ sung đề xuất cải tiến UI/UX hoặc tối ưu kỹ thuật mới.

## Đề xuất cải tiến bổ sung
- Khảo sát thêm nhu cầu lọc nâng cao (theo trạng thái/tên phụ trách) để giảm thao tác tìm kiếm.
- Cân nhắc lưu bộ cấu hình giao diện (chiều rộng cột, số dòng, bộ lọc) theo tài khoản người dùng trên server để đồng bộ đa thiết bị.
- Tạo screenshot mẫu sau khi hoàn thành để phục vụ kiểm thử hồi quy giao diện.

---
*Ngày cập nhật: 2025-10-23*
