# Đánh giá tương thích Windows 11 & SQL Server 2008 R2

## Tóm tắt
- Xác thực lại cơ chế đọc cấu hình và kết nối SQL Server phục vụ đồng bộ ECUS, đảm bảo có thể chạy trên Windows 11 Pro với PowerShell 7 và SQL Server 2008 R2.
- Phát hiện và sửa lỗi không áp dụng được các bộ lọc boolean (`Chưa gán nhân viên`, `Chưa gán tổ đội`, `Trùng 11 số`) khi gọi API `/api/import/search` ở chế độ tìm kiếm máy chủ.
- Đề xuất một số cải tiến nhằm nâng cao độ tin cậy khi kết nối SQL Server 2008 R2 và tối ưu hiệu năng tìm kiếm/dong bộ.

## 1. Tương thích Windows 11 & SQL Server 2008 R2
- Mã nguồn backend sử dụng `better-sqlite3` làm kho cục bộ và đọc cấu hình ECUS thông qua DPAPI trên Windows. Việc giải mã file `ecus.credentials.enc` được thực hiện bằng PowerShell (`pwsh`) và chỉ chạy trên nền tảng Windows (`os.platform() === "win32"`). Điều này phù hợp với yêu cầu triển khai Windows 11 Pro/Powershell 7 miễn là dịch vụ chạy bằng tài khoản có quyền đọc file và cài sẵn PowerShell 7 trong `PATH`.【F:server/ecus/secureCredentials.js†L1-L64】
- Hàm `buildSqlConnectionConfig` gộp thông tin đăng nhập từ biến môi trường và file bảo mật, đồng thời bật `trustServerCertificate` và `enableArithAbort`. Đây là các tuỳ chọn tương thích với SQL Server 2008 R2; tuy nhiên `mssql`/`tedious` mặc định dùng TDS 7.4 – không phải lúc nào cũng được SQL Server 2008 R2 chấp nhận. Nên cho phép cấu hình `options.tdsVersion` ở file `.env` (ví dụ `7_3_A`) hoặc bổ sung cơ chế tự động fallback khi phát hiện lỗi bắt tay TDS.【F:server/index.js†L7246-L7273】
- Truy vấn mặc định cho ECUS chỉ dùng các câu lệnh (`OUTER APPLY`, `FOR XML PATH`, `DATEADD`, kiểu `date`) vốn đã có từ SQL Server 2008, vì vậy không yêu cầu nâng cấp phiên bản DB. Phần phát hiện khả năng phân trang (`resolveSqlPaginationCapabilities`) đã tự động bỏ qua OFFSET/FETCH khi `compatibility_level < 110`, đúng với SQL Server 2008 R2 (level 100) nên không có lỗi cú pháp.【F:server/index.js†L181-L253】【F:server/index.js†L7281-L7335】

## 2. Kiểm tra logic thành phần
- Phần lọc tờ khai tái sử dụng giữa client/server (`normalizeDeclSearchFilters` → `filterDeclRows`) trước đây chỉ chấp nhận boolean thuần (`true/false`). Khi chuyển sang tìm kiếm máy chủ, tham số query bị chuyển thành chuỗi (`duplicate=1`, `noStaff=1`, …) khiến API luôn bỏ qua các bộ lọc này. Đã bổ sung hàm `parseBooleanInput` để chuẩn hoá các giá trị kiểu chuỗi/số/mảng về boolean, đảm bảo giao diện và API cho kết quả đồng nhất.【F:src/shared/declSearch.js†L1-L138】
- Các bộ lọc khác (từ khoá, MST, công ty, trạng thái, khoảng ngày, bộ lọc CO) đều dùng chuỗi chuẩn `YYYY-MM-DD` và so sánh chữ cái, phù hợp với dữ liệu đã được chuẩn hoá ở backend (`normalizeDeclarationRow`, `normalizeDeclRows`). Không phát hiện xung đột logic khác trong quy trình hợp nhất tờ khai hoặc phân trang phía server sau khi sửa lỗi boolean.【F:server/index.js†L3827-L3934】【F:server/index.js†L4507-L4550】【F:server/index.js†L10920-L10990】

## 3. Đề xuất cải tiến
1. **Thiết lập/auto fallback TDS version**: Cho phép cấu hình `ECUS_SQL_TDS_VERSION` hoặc thử lại kết nối với `tdsVersion: '7_3_A'` khi gặp lỗi bắt tay, giúp đảm bảo kết nối tới SQL Server 2008 R2 ổn định hơn.【F:server/index.js†L7246-L7273】
2. **Phân trang tương thích SQL 2008**: Hiện tại khi `compatibility_level < 110` hệ thống tải toàn bộ dữ liệu rồi lọc trên Node.js, có thể chậm với dữ liệu lớn. Có thể thêm tuỳ chọn `ROW_NUMBER()` để mô phỏng phân trang cho SQL 2008 nhằm giảm tải mạng và bộ nhớ.【F:server/index.js†L7281-L7335】【F:server/index.js†L8667-L8742】
3. **Giám sát & cảnh báo kết nối**: Mặc dù đã ghi nhận timeout, có thể bổ sung health-check định kỳ cho cổng SQL (ví dụ script Powershell dùng `Test-NetConnection`) và ghi log rõ ràng để cảnh báo sớm khi dịch vụ SQL Server dừng hoặc thông tin đăng nhập hết hạn.【F:server/index.js†L7336-L7522】【F:server/index.js†L9061-L9081】

