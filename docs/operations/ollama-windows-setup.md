# Hướng dẫn cài đặt và vận hành Ollama nội bộ trên Windows 11

Tài liệu này mô tả quy trình từng bước để triển khai dịch vụ **Ollama** trên Windows 11 Pro, bảo đảm mô hình AI nội bộ vận hành ổn định và tương thích với hệ thống KPI. Các bước dưới đây giả định máy chủ đã cài **PowerShell 7** và có quyền quản trị viên.

## 1. Chuẩn bị môi trường

1. **Cập nhật Windows**: vào _Settings → Windows Update_ và cài toàn bộ bản vá mới nhất.
2. **Cài đặt PowerShell 7** (nếu chưa có): tải từ [https://aka.ms/powershell-release?tag=stable](https://aka.ms/powershell-release?tag=stable) và đánh dấu tùy chọn _Add to PATH_.
3. **Cài đặt Visual C++ Redistributable 2015–2022**: cần thiết cho thư viện CUDA/Metal. Tải tại <https://aka.ms/vs/17/release/vc_redist.x64.exe> và cài đặt.
4. **Chuẩn bị tài nguyên**:
   - RAM tối thiểu 16 GB.
   - GPU hỗ trợ CUDA (NVIDIA) hoặc dùng CPU nếu không có GPU (sẽ chậm hơn).
   - Dung lượng đĩa trống ≥ 25 GB cho mô hình `llama3.1:8b`.
5. **Tạo thư mục lưu model**: ví dụ `D:\ollama` và cấp quyền Full Control cho tài khoản dịch vụ (xem bước 3).

## 2. Cài đặt Ollama

1. Tải bản cài đặt chính thức từ <https://ollama.com/download/windows>.
2. Chạy installer với quyền admin, chọn thư mục cài đặt (khuyến nghị `C:\Program Files\Ollama`).
3. Hoàn tất cài đặt và khởi chạy một lần để xác nhận dịch vụ nền **Ollama Service** hoạt động.
4. Mở PowerShell 7 (Run as Administrator) và chạy lệnh kiểm tra:
   ```powershell
   ollama --version
   ollama list
   ```
   Nếu lệnh hiển thị phiên bản và danh sách model trống, hệ thống đã sẵn sàng tải model.

## 3. Tạo tài khoản dịch vụ chuyên biệt

1. Mở _Computer Management → Local Users and Groups → Users_.
2. Tạo người dùng mới, ví dụ `svcOllama`. Đặt mật khẩu mạnh, bỏ chọn “User must change password at next logon”.
3. Thêm tài khoản `svcOllama` vào nhóm **Users** (không cần quyền admin).
4. Gán quyền “Log on as a service” cho `svcOllama`:
   - Mở _Local Security Policy → Local Policies → User Rights Assignment_.
   - Chỉnh mục **Log on as a service** và thêm `svcOllama`.
5. Cấp quyền đọc/ghi thư mục `D:\ollama` (hoặc thư mục chứa model) cho `svcOllama`.

## 4. Chạy Ollama như dịch vụ Windows

1. Mở PowerShell 7 với quyền admin.
2. Dừng dịch vụ mặc định (nếu đang chạy):
   ```powershell
   Stop-Service -Name Ollama
   ```
3. Đăng ký lại dịch vụ dùng tài khoản `svcOllama` và cấu hình đường dẫn dữ liệu:

   ```powershell
   $svcAccount = 'MAYCHU\\svcOllama'
   $svcPassword = Read-Host 'Nhập mật khẩu svcOllama' -AsSecureString
   $ollamaArgs = '--host 0.0.0.0 --port 11434 --store "D:\\ollama"'

   sc.exe config Ollama obj= $svcAccount password= (ConvertFrom-SecureString $svcPassword -AsPlainText)
   sc.exe config Ollama binPath= '"C:\\Program Files\\Ollama\\ollama.exe" serve ' + $ollamaArgs
   ```

   > Lưu ý: thay `MAYCHU` bằng hostname thực tế.

4. Đặt dịch vụ tự khởi động cùng Windows và khởi chạy lại:
   ```powershell
   Set-Service -Name Ollama -StartupType Automatic
   Start-Service -Name Ollama
   ```
5. Kiểm tra trạng thái:
   ```powershell
   Get-Service -Name Ollama
   ```

## 5. Cấu hình firewall và mạng nội bộ

1. Mở port 11434 (TCP) cho mạng nội bộ:
   ```powershell
   New-NetFirewallRule -DisplayName 'Ollama 11434 TCP' -Direction Inbound -Protocol TCP -LocalPort 11434 -Action Allow
   ```
2. Nếu hệ thống có nhiều card mạng, đảm bảo `--host` chỉ bind vào mạng nội bộ (ví dụ `--host 192.168.1.10`).
3. Ghi chú địa chỉ `http://<IP>:11434` cho cấu hình backend (`OLLAMA_BASE_URL`).

## 6. Tải và quản lý model

1. Đăng nhập máy chủ bằng tài khoản quản trị.
2. Tải model mặc định hệ thống yêu cầu (`llama3.1:8b`):
   ```powershell
   ollama pull llama3.1:8b
   ```
3. Kiểm tra dung lượng và trạng thái:
   ```powershell
   ollama list
   ```
4. Để cập nhật model, chạy lại `ollama pull <model>` hoặc `ollama rm` để xóa model cũ.

## 7. Tích hợp với hệ thống KPI

1. Mở file `.env` của backend và đặt biến:
   ```dotenv
   AI_DEFAULT_PROVIDER=ollama-local
   OLLAMA_BASE_URL=http://<IP-May-Chu>:11434
   OLLAMA_MODEL=llama3.1:8b
   ```
2. Khởi động lại dịch vụ backend KPI (`pnpm server`).
3. Trên UI (tab **Trợ lý AI → Cấu hình**), kiểm tra health-check của Ollama:
   - Nút “Kiểm tra kết nối” phải báo thành công.
   - Badge trạng thái hiển thị **Nội bộ** màu xanh.
4. Thực hiện một câu hỏi thử (ví dụ “Tóm tắt KPI tuần này?”) để kiểm chứng.

## 8. Giám sát và xử lý sự cố

| Tình huống                     | Cách xử lý                                                                                               |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Không truy cập được port 11434 | Kiểm tra firewall, chắc chắn dịch vụ chạy và `--host` bind đúng IP.                                      |
| Dịch vụ tự dừng sau vài phút   | Kiểm tra `Event Viewer → Windows Logs → Application` để xem lỗi. Thường do thiếu RAM hoặc quyền thư mục. |
| Trả về lỗi `connection reset`  | Kiểm tra phiên bản Ollama, cập nhật bản mới nhất và giảm `OLLAMA_MAX_INPUT_TOKENS` trong backend.        |
| Model tải chậm                 | Đảm bảo có đủ băng thông, hoặc tải model sẵn và sao chép thủ công vào thư mục `store`.                   |

## 9. Sao lưu và cập nhật định kỳ

1. **Sao lưu thư mục model** (`D:\ollama`) hàng tuần.
2. Ghi nhận cấu hình dịch vụ (`sc qc Ollama > C:\backup\ollama-service.txt`).
3. Kiểm tra bản cập nhật Ollama mỗi tháng:
   ```powershell
   winget upgrade Ollama.Ollama
   ```
4. Sau khi cập nhật, chạy lại health-check từ hệ thống KPI để đảm bảo tương thích.

Hoàn tất các bước trên, dịch vụ Ollama nội bộ sẽ sẵn sàng phục vụ Trợ lý AI mà không phát sinh rủi ro rò rỉ dữ liệu ra ngoài doanh nghiệp.
