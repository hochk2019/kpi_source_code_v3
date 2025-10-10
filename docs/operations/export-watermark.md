# Quy trình watermark & chữ ký số cho file Excel KPI

## 1. Biến môi trường bắt buộc

- `KPI_EXPORT_SIGNATURE_SECRET`: Chuỗi bí mật dùng để tạo chữ ký SHA-256 cho watermark. Nên đặt tối thiểu 32 ký tự và lưu trữ trong Windows Credential Manager hoặc biến môi trường hệ thống.
- Nếu biến trên không được cấu hình, hệ thống sẽ tự động fallback sang `KPI_SESSION_SECRET`. Chỉ sử dụng cơ chế fallback trong môi trường phát triển.

## 2. Cách tạo watermark

1. Khi người dùng xuất báo cáo (`POST /api/reports/export`), backend sẽ:
   - Tính chữ ký SHA-256 dựa trên tài khoản, loại báo cáo, thời điểm, request ID và bộ lọc.
   - Gắn header/footer “SỬ DỤNG NỘI BỘ – KPI”, hiển thị tên người xuất, thời gian và mã xác thực 16 ký tự.
   - Thêm sheet ẩn `ChungThuc` chứa đầy đủ metadata (tài khoản, IP, bộ lọc, request ID, chữ ký 64 ký tự).

2. Response đính kèm các header:
   - `X-KPI-Export-Signature`: Chuỗi chữ ký 64 ký tự.
   - `X-KPI-Export-Code`: Mã rút gọn 16 ký tự.
   - `X-KPI-Export-Issued-At`: Thời gian cấp watermark (theo múi giờ Việt Nam).
   - `X-KPI-Export-Request`: Request ID phục vụ truy vết.

## 3. Nhật ký tải báo cáo

- Mỗi lần xuất, backend ghi log vào audit trail với action `reports.export` cùng metadata: người xuất, loại báo cáo, chữ ký, IP, bộ lọc.
- Nhật ký được lưu tối đa 200 bản ghi gần nhất (`audit_logs_v1`). Khi cần mở rộng lưu trữ, có thể đồng bộ thêm sang bảng `export_audit` trong SQL Server nội bộ.

## 4. Quy trình kiểm tra rò rỉ

1. Mở file Excel nghi vấn, vào `View` → `Unhide…` để xem sheet `ChungThuc` (nếu cần). Nếu sheet ở trạng thái “Very Hidden”, dùng Excel VBA với quyền admin để bật lại.
2. Đối chiếu mã xác thực (16 hoặc 64 ký tự) với header của file và audit log.
3. Từ mã xác thực, tìm kiếm trong audit log (theo `signature` hoặc `shortSignature`) để xác định tài khoản đã tải file.
4. Nếu cần, sử dụng `Request ID` trong header/nhật ký để truy dấu HTTP log (IIS/Reverse proxy) nhằm xác thực địa chỉ IP thực tế.

## 5. Lưu ý vận hành trên Windows 11 Pro

- Task Scheduler hoặc script tự động tải báo cáo nên đặt biến `KPI_EXPORT_SIGNATURE_SECRET` trong scope `System` để tất cả dịch vụ đều truy cập được.
- Khi sao lưu/khôi phục hệ thống, nhớ ghi nhận giá trị bí mật này. Nếu thay đổi secret, chữ ký cũ sẽ không khớp – cần ghi chú thời điểm thay đổi để tra cứu chính xác.
- Báo cáo xuất tự động cần ghi nhận thêm metadata riêng (ví dụ `automation=true`) trong payload để dễ lọc log khi điều tra sự cố.

