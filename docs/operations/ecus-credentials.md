# Quy trình mã hoá thông tin đăng nhập ECUS (Windows 11 + PowerShell 7)

Hệ thống KPI lưu trữ dữ liệu vận hành bằng SQLite và chỉ kết nối đọc từ cơ sở dữ liệu **ECUS5VNACCS** trên SQL Server 2008 R2.
Để tránh lưu tài khoản/mật khẩu ECUS dạng plain text, chúng ta sử dụng DPAPI (Data Protection API) thông qua PowerShell 7.

## 1. Tạo file mã hoá `ecus.credentials.enc`

Chạy PowerShell 7 với quyền quản trị và thực thi script sau để nhập thông tin đăng nhập. Chuỗi sẽ được mã hoá theo người dùng hiện tại (`CurrentUser`).

```powershell
$target = "C:\\kpi-app\\config\\ecus.credentials.enc"
$server = "TEN_MAY_CHU_SQL"
$database = "ECUS5VNACCS"
$user = "tai_khoan_dong_bo"
$pwd = Read-Host "Nhập mật khẩu ECUS" -AsSecureString
$plainPwd = [Runtime.InteropServices.Marshal]::PtrToStringUni([Runtime.InteropServices.Marshal]::SecureStringToBSTR($pwd))

pwsh -File .\scripts\save-ecus-credentials.ps1 -Path $target -Server $server -Database $database -User $user -Password $plainPwd
```

> 📌 Script `save-ecus-credentials.ps1` tự tạo thư mục đích nếu chưa tồn tại và chỉ ghi file mã hoá (không lưu mật khẩu dạng plain text).

## 2. Cấu hình biến môi trường

Trên máy chủ Windows 11 Pro, đặt biến môi trường để backend tìm đúng file mã hoá:

```powershell
[System.Environment]::SetEnvironmentVariable('ECUS_SQL_SECURE_FILE', 'C:\\kpi-app\\config\\ecus.credentials.enc', 'Machine')
[System.Environment]::SetEnvironmentVariable('PWSH_PATH', 'C:\\Program Files\\PowerShell\\7\\pwsh.exe', 'Machine')
```

Biến `PWSH_PATH` là tuỳ chọn, giúp backend gọi đúng bản PowerShell 7 nếu không có trong `PATH`.

## 3. Cách backend giải mã tự động

Khi khởi động, backend gọi `server/ecus/secureCredentials.js` để đọc thông tin theo thứ tự ưu tiên:

1. **Biến môi trường** `ECUS_SQL_SERVER`, `ECUS_SQL_DATABASE`, `ECUS_SQL_USER`, `ECUS_SQL_PASSWORD` (chỉ dùng cho môi trường phát triển nhanh).
2. **File DPAPI** chỉ định qua `ECUS_SQL_SECURE_FILE`. Backend sẽ gọi script `scripts/read-ecus-credentials.ps1` bằng PowerShell 7 và hợp nhất với các biến môi trường đang có.

Nếu chạy trên Linux (CI), module tự động bỏ qua file DPAPI và chỉ sử dụng biến môi trường để tránh lỗi.

## 4. Kiểm tra hoạt động

Sau khi triển khai, chạy lệnh kiểm tra backend:

```powershell
pnpm server
```

Trong log khởi động sẽ xuất hiện thông báo kết nối ECUS thành công. Nếu có lỗi giải mã, backend sẽ ghi log `Không thể giải mã thông tin đăng nhập ECUS từ DPAPI` để người vận hành kiểm tra lại file hoặc quyền truy cập.

## 5. Quy trình thay đổi mật khẩu

1. Dừng dịch vụ đồng bộ KPI.
2. Chạy lại script `save-ecus-credentials.ps1` với mật khẩu mới (file mã hoá được ghi đè).
3. Khởi động lại dịch vụ backend KPI; module sẽ tự nạp mật khẩu mới ngay lần chạy đầu tiên.

Việc áp dụng DPAPI giúp đảm bảo thông tin nhạy cảm chỉ giải mã được trên máy chủ Windows cụ thể, giảm rủi ro rò rỉ khi sao chép file cấu hình.
