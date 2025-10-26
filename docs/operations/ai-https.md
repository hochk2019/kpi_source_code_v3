# Bật HTTPS nội bộ cho endpoint AI

Tài liệu này mô tả cách tạo chứng chỉ tự ký và cấu hình backend KPI phục vụ các endpoint `/api/ai/*` thông qua HTTPS nội bộ. Hạ tầng hiện hành chạy trên Windows 11 Pro, kết nối SQL Server 2008 R2 nên các bước dưới đây tương thích với PowerShell 7 và không yêu cầu cài đặt thêm OpenSSL.

## 1. Tạo chứng chỉ tự ký

1. Mở **PowerShell 7** với quyền quản trị trên máy chủ chạy backend KPI.
2. Chạy script tạo chứng chỉ:

   ```powershell
   pwsh -File .\scripts\create-ai-https-cert.ps1 -DnsName 'kpi-internal.local' -OutDir '.\config'
   ```

   Tham số:

   - `-DnsName`: tên máy chủ nội bộ sẽ truy cập (ví dụ `localhost`, `kpi-internal.local` hoặc IP tĩnh).
   - `-OutDir`: thư mục lưu private key/certificate. Mặc định script ghi vào `config/` cùng source code.
   - `-ValidDays`: số ngày hiệu lực (mặc định 730 ngày).
   - `-Password`: mật khẩu bảo vệ file `.pfx` dự phòng.

3. Script sẽ tạo bốn file:

   - `config/ai-https.key`: private key định dạng PEM.
   - `config/ai-https.crt`: chứng chỉ máy chủ.
   - `config/ai-https.ca.pem`: file CA (cùng nội dung với `.crt` vì là self-signed) để import vào các máy trạm.
   - `config/ai-https.pfx`: bản sao dự phòng cho trường hợp cần import lại chứng chỉ vào Windows.

4. Cài đặt chứng chỉ CA cho các máy trạm nội bộ:

   - Mở file `ai-https.ca.pem`, chọn **Install Certificate**.
   - Import vào **Trusted Root Certification Authorities** ở scope **Local Machine**.

## 2. Cấu hình biến môi trường

Backend tự động bật kênh HTTPS khi tìm thấy file `ai-https.key` và `ai-https.crt` trong thư mục `config/`. Có thể tinh chỉnh thêm bằng các biến môi trường:

| Biến | Ý nghĩa | Giá trị mẫu |
| --- | --- | --- |
| `KPI_AI_HTTPS_ENABLED` | Ép bật/tắt HTTPS nội bộ (mặc định tự bật nếu có đủ file) | `1` |
| `KPI_AI_HTTPS_PORT` | Cổng HTTPS nội bộ (mặc định `5443`) | `5443` |
| `KPI_AI_HTTPS_HOST` | Địa chỉ bind (mặc định `127.0.0.1`) | `0.0.0.0` |
| `KPI_AI_HTTPS_KEY_PATH` | Đường dẫn private key | `C:\KPI\config\ai-https.key` |
| `KPI_AI_HTTPS_CERT_PATH` | Đường dẫn certificate | `C:\KPI\config\ai-https.crt` |
| `KPI_AI_HTTPS_CA_PATH` | (Tùy chọn) CA bundle để xác thực client | `C:\KPI\config\ai-https.ca.pem` |

> **Lưu ý:** Khi bật cờ `KPI_AI_HTTPS_ENABLED=1` nhưng thiếu file key/cert, backend sẽ ghi log cảnh báo và giữ nguyên chế độ HTTP.

## 3. Kiểm tra hoạt động

1. Khởi động lại dịch vụ backend (`pnpm start` hoặc dịch vụ Windows tương ứng).
2. Kiểm tra log:

   ```text
   [AI HTTPS] Đang phục vụ endpoint AI qua https://localhost:5443
   [AI HTTPS] Sử dụng chứng chỉ: C:\KPI\config\ai-https.crt
   ```

3. Gửi yêu cầu thử nghiệm:

   ```powershell
   Invoke-RestMethod -Method Post -Uri 'https://localhost:5443/api/ai/chat' -SkipCertificateCheck -Body (@{ prompt = 'Ping' } | ConvertTo-Json) -ContentType 'application/json'
   ```

   Sau khi máy trạm đã trust CA, có thể bỏ `-SkipCertificateCheck`.

## 4. Ứng dụng thực tế

- Đặt reverse proxy nội bộ (IIS/NGINX) trỏ tới `https://localhost:5443` khi cần gửi prompt nhạy cảm tới AI.
- Giữ nguyên cổng HTTP 5000 để phục vụ giao diện web, trong khi các dịch vụ nội bộ bắt buộc dùng HTTPS.
- Khi thay đổi chứng chỉ, chỉ cần chạy lại script và khởi động lại dịch vụ.

## 5. Khắc phục sự cố

| Vấn đề | Cách xử lý |
| --- | --- |
| Log cảnh báo `Thiếu file key/cert` | Kiểm tra `config/ai-https.key` và `.crt` có tồn tại, quyền đọc đúng. |
| Không thể bind cổng 5443 | Đổi `KPI_AI_HTTPS_PORT`, kiểm tra firewall Windows. |
| Trình duyệt cảnh báo chứng chỉ không tin cậy | Đảm bảo đã import `ai-https.ca.pem` vào Trusted Root trên máy trạm. |
| Script tạo chứng chỉ lỗi `GetRSAPrivateKey` | Chạy PowerShell 7 với quyền admin, đảm bảo không có group policy chặn xuất private key. |

