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
- [x] Khởi tạo trạng thái `columnWidths` đọc/ghi từ `localStorage` với giá trị mặc định hợp lý. _(ChatGPT – 2025-10-23)_
- [x] Thêm tay cầm kéo ở mỗi tiêu đề cột, cập nhật chiều rộng động và đồng bộ xuống `localStorage` có debounce. _(ChatGPT – 2025-10-23)_
- [x] Cung cấp nút "Đặt lại chiều rộng" để đưa cấu hình về mặc định; kiểm thử khôi phục sau khi tải lại trang. _(ChatGPT – 2025-10-23)_

### 5. Tái cấu trúc "Dòng thời gian giai đoạn"
- [x] Gom dữ liệu timeline theo từng hàng công ty và hiển thị dạng accordion/popup ngay trong cột trạng thái hoặc hành động. _(ChatGPT – 2025-10-24)_
- [x] Loại bỏ khối timeline dài phía dưới hoặc chuyển thành chế độ mở rộng khi người dùng yêu cầu. _(ChatGPT – 2025-10-24)_
- [x] Đảm bảo tùy chọn xem chi tiết đầy đủ vẫn khả dụng (ví dụ: modal toàn màn hình) và cập nhật kiểm thử liên quan. _(ChatGPT – 2025-10-24)_

### 6. Theo dõi và cập nhật tài liệu
- [x] Duy trì file kế hoạch này, đánh dấu `[x]` sau khi hoàn tất từng hạng mục và ghi chú người thực hiện + ngày. _(ChatGPT – 2025-10-24)_
- [x] Liên kết kế hoạch vào các tài liệu vận hành liên quan (ví dụ `docs/USER_GUIDE.md`) nếu cần. _(ChatGPT – 2025-10-24)_
- [x] Định kỳ rà soát để bổ sung đề xuất cải tiến UI/UX hoặc tối ưu kỹ thuật mới. _(ChatGPT – 2025-10-24)_

> **Ghi chú 6.1**: Đã thêm liên kết đến tài liệu này trong mục "Gán MST" của `docs/USER_GUIDE.md` để đội vận hành theo dõi dễ dàng.
>
> **Ghi chú 6.2**: Tiếp tục duy trì danh sách đề xuất cải tiến, ưu tiên nghiên cứu bộ lọc nhanh theo trạng thái giai đoạn và preset bộ lọc người phụ trách.

## Đề xuất cải tiến bổ sung
1. **Thiết kế bộ lọc nâng cao đa điều kiện**
   - Hỗ trợ kết hợp nhiều tiêu chí (trạng thái giai đoạn, người phụ trách, ngày cập nhật gần nhất).
   - Cung cấp giao diện cấu hình dạng "builder" với các toán tử phổ biến (=, chứa, khác) và đảm bảo xử lý Unicode ổn định trên Windows 11 Pro.
   - Ghi nhớ tổ hợp bộ lọc thường dùng bằng `localStorage` và đồng bộ với server qua API để sử dụng trên PowerShell 7.

2. **Đồng bộ cấu hình giao diện theo tài khoản người dùng**
   - Lưu chiều rộng cột, số dòng mặc định, preset lọc vào bảng cấu hình trên SQL Server 2008 R2 (schema `dbo.UserUiSettings`).
   - Sử dụng job đồng bộ định kỳ (5 phút) giữa web app và ứng dụng desktop ECUS5VNACCS để tránh mất tùy chỉnh khi đổi thiết bị.
   - Bổ sung migration và tài liệu hướng dẫn triển khai cho đội vận hành.

3. **Preset lọc nhanh gắn badge trạng thái**
   - Cung cấp tối thiểu 4 preset: "Chờ bổ sung", "Chờ phản hồi", "Đang xử lý", "Hoàn tất" với badge màu phù hợp (amber, blue, teal, green).
   - Cho phép quản trị viên cập nhật danh sách preset qua cấu hình JSON để không phải rebuild ứng dụng.
   - Gắn thông tin preset vào tooltip của từng badge để người dùng mới nắm rõ tiêu chí.

4. **Tích hợp đồng bộ giữa trình duyệt và PowerShell**
   - Xây dựng module PowerShell 7 đọc/ghi cấu hình chung thông qua REST API.
   - Bảo đảm serialization UTF-8 để giữ nguyên dấu tiếng Việt.
   - Viết bộ kiểm thử tự động xác nhận dữ liệu đồng bộ chính xác sau khi chuyển đổi môi trường.

5. **Bộ tư liệu kiểm thử và truyền thông nội bộ**
   - Tạo thư viện screenshot chuẩn (trước/sau) phục vụ regression test và đào tạo người dùng.
   - Viết checklist kiểm thử UI tập trung vào các màn hình có text dài, đảm bảo không bị cắt chữ.
   - Cập nhật wiki nội bộ với hướng dẫn áp dụng preset và khôi phục cấu hình mặc định.

_Trạng thái: ĐÃ HOÀN THÀNH – ChatGPT, 2025-10-24_

---
*Ngày cập nhật: 2025-10-24*
