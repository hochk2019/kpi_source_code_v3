# Thiết lập giám sát đồng bộ ECUS trên Windows 11 Pro

Tài liệu này hướng dẫn triển khai cron kiểm tra trạng thái đồng bộ ECUS theo đề xuất tại `docs/system-improvement-proposals.md`.

## 1. Chuẩn bị

1. **Cập nhật biến môi trường** trên máy chủ Node.js:
   - Thêm `MONITOR_ACCESS_TOKEN` với giá trị ngẫu nhiên khó đoán (ví dụ: GUID).
   - Khởi động lại dịch vụ backend để áp dụng cấu hình.
2. **Kiểm tra endpoint giám sát** mới (`/api/internal/monitor/ecus-sync`) bằng cách chạy:
   ```powershell
   curl.exe -H "x-monitor-token: $env:MONITOR_ACCESS_TOKEN" http://localhost:3000/api/internal/monitor/ecus-sync
   ```
   Endpoint trả về trạng thái tổng hợp bao gồm độ trễ đồng bộ, kết quả lần chạy gần nhất và tình trạng kết nối SQL Server 2008 R2.

## 2. Cấu hình script PowerShell

Repo đã bổ sung script `scripts/monitor-ecus-sync.ps1` tương thích PowerShell 7, tự động:

- Gọi API giám sát với header `x-monitor-token`.
- Phân tích mức độ cảnh báo dựa trên độ trễ đồng bộ (cảnh báo sau 90 phút, báo lỗi sau 180 phút) và kết quả lần chạy gần nhất.
- Ghi log vào **Event Viewer (Application)**. Nếu không thể ghi, script sẽ chuyển sang file `scripts/monitor-ecus-sync.log`.

Chạy thử thủ công:

```powershell
pwsh.exe -File "C:\path\to\repo\scripts\monitor-ecus-sync.ps1" -Endpoint "http://localhost:3000/api/internal/monitor/ecus-sync"
```

## 3. Tạo lịch với Task Scheduler

1. Mở **Task Scheduler** → _Create Task_.
2. Tab **General**:
   - Đặt tên ví dụ: `KPI - Kiểm tra đồng bộ ECUS`.
   - Chọn _Run whether user is logged on or not_ và tick _Run with highest privileges_.
3. Tab **Triggers**:
   - _New…_ → _Begin the task: On a schedule_ → _Daily_ → _Repeat task every: 15 minutes_ → _for a duration of: Indefinitely_.
4. Tab **Actions**:
   - _New…_ → _Action: Start a program_.
   - _Program/script_: `pwsh.exe`.
   - _Add arguments_: `-File "C:\path\to\repo\scripts\monitor-ecus-sync.ps1" -Endpoint "http://localhost:3000/api/internal/monitor/ecus-sync"`.
5. Tab **Conditions** và **Settings**: bỏ chọn _Stop the task if it runs longer than_ để tránh bị hủy giữa chừng.
6. Lưu và nhập tài khoản dịch vụ có quyền ghi Event Viewer.

## 4. Theo dõi và xử lý sự cố

- Kiểm tra Event Viewer → _Windows Logs_ → _Application_, tìm nguồn `KPI.ECUS.Monitor`.
- Thay đổi ngưỡng cảnh báo bằng cách thêm tham số `-TimeoutSeconds`, `-SkipEventLog` hoặc cập nhật script nếu cần.
- Khi nhận cảnh báo _Error_, xem chi tiết `issues` trong Event Viewer hoặc file log để xử lý: kiểm tra kết nối SQL Server, xem lại trạng thái đồng bộ trong DataHealth Dashboard hoặc chạy lại ECUS sync thủ công.

## 5. Ghi chú bảo mật

- Bảo vệ giá trị `MONITOR_ACCESS_TOKEN`, không commit vào repo.
- Giới hạn truy cập endpoint `/api/internal/monitor/ecus-sync` ở mạng nội bộ; cân nhắc thêm firewall rule chỉ cho phép máy chủ Windows chạy Task Scheduler truy cập.
- Định kỳ rà soát Event Viewer để phát hiện bất thường, kết hợp cùng cảnh báo email/Teams khi triển khai các bước tiếp theo trong lộ trình.
