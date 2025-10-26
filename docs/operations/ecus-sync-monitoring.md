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

## 5. Thiết lập cảnh báo email/Teams

Máy chủ Node.js đã tích hợp chức năng gửi cảnh báo tự động khi:

- Đồng bộ ECUS thất bại từ **3 lần liên tiếp** trở lên (có thể điều chỉnh qua biến môi trường).
- Độ trễ dữ liệu vượt **60 phút** so với lần đồng bộ gần nhất.

Khai báo các biến môi trường sau để kích hoạt cảnh báo:

| Nhóm | Biến môi trường | Ghi chú |
| --- | --- | --- |
| SMTP | `ECUS_ALERT_SMTP_HOST`, `ECUS_ALERT_SMTP_PORT`, `ECUS_ALERT_SMTP_USER`, `ECUS_ALERT_SMTP_PASSWORD`, `ECUS_ALERT_SMTP_SECURE` | Thông số máy chủ gửi mail (Port mặc định 587, đặt `SECURE=1` nếu dùng SSL 465). |
| Email | `ECUS_ALERT_EMAIL_FROM`, `ECUS_ALERT_EMAIL_TO` | Địa chỉ người gửi và danh sách người nhận (ngăn cách bởi dấu phẩy hoặc chấm phẩy). Có thể thêm `ECUS_ALERT_EMAIL_CC`, `ECUS_ALERT_EMAIL_BCC`. |
| Teams | `ECUS_ALERT_TEAMS_WEBHOOK_URL` | URL webhook incoming của Microsoft Teams. |
| Ngưỡng | `ECUS_ALERT_FAILURE_THRESHOLD`, `ECUS_ALERT_FAILURE_COOLDOWN_MINUTES`, `ECUS_ALERT_STALE_THRESHOLD_MINUTES`, `ECUS_ALERT_STALE_COOLDOWN_MINUTES` | Điều chỉnh số lần lỗi liên tiếp, khoảng thời gian nhắc lại và ngưỡng độ trễ (phút). |
| Liên kết dashboard | `ECUS_ALERT_DASHBOARD_URL` | Đường dẫn nhanh tới Data Health Dashboard (tùy chọn). |

> **Lưu ý:** Nếu biến môi trường không được đặt hoặc danh sách người nhận để trống thì hệ thống sẽ không gửi cảnh báo.

Trên Teams, thẻ thông báo sẽ hiển thị tóm tắt độ trễ, số lỗi liên tiếp và nút mở dashboard (nếu khai báo URL). Email được gửi bằng tiếng Việt và có tiêu đề theo mẫu `[KPI] Cảnh báo đồng bộ ECUS: ...`.

Sau mỗi lần script PowerShell chạy, log bổ sung sẽ cho biết số lỗi liên tiếp, thời điểm cảnh báo gần nhất và các trigger vừa gửi (nếu có).

## 6. Dashboard giám sát bằng Grafana/Power BI

### 6.1. Endpoint dữ liệu thời gian thực

- Backend bổ sung endpoint `GET /api/internal/monitor/ecus-sync/metrics` sử dụng cùng `MONITOR_ACCESS_TOKEN`.
- Tham số `limit` (mặc định 288 mẫu ≈ 3 ngày với chu kỳ 15 phút) để giới hạn số điểm dữ liệu trả về.
- Response bao gồm:
  - `metrics.series`: các chuỗi thời gian (độ trễ, trạng thái, số bản ghi chèn/cập nhật...).
  - `metrics.history.entries`: log thô (JSON) giúp Power BI/Grafana dựng biểu đồ dạng bảng hoặc heatmap.
  - `metrics.windows`: thống kê gộp theo 24h/7 ngày/30 ngày (số lần lỗi, cảnh báo, độ trễ trung bình, cực đại...).

Ví dụ kiểm tra thủ công:

```powershell
curl.exe -H "x-monitor-token: $env:MONITOR_ACCESS_TOKEN" "http://localhost:3000/api/internal/monitor/ecus-sync/metrics?limit=96" | jq
```

### 6.2. Ghi log JSON tuyến tính cho dashboard

- Script `monitor-ecus-sync.ps1` tạo thêm file `scripts/monitor-ecus-sync.jsonl` ở định dạng **JSON Lines**.
- Mỗi dòng thể hiện một lần gọi API với các trường: `timestamp`, `severity`, `status`, `staleMinutes`, `rowsInserted`, `alert.consecutiveErrors`, `database.state`...
- Grafana (với Loki/Filebeat) hoặc Power BI (Get Data → Text/CSV → định dạng JSON lines) có thể đọc trực tiếp file này mà không cần cấu hình thêm.
- Nếu sử dụng Event Viewer làm nguồn dữ liệu, giữ nguyên cấu hình hiện tại và trỏ Power BI tới Custom Connector để đọc log sự kiện.

### 6.3. Gợi ý cấu hình Grafana

1. Cài đặt **SimpleJson** data source trỏ tới endpoint metrics (phương thức GET, header `x-monitor-token`).
2. Tạo dashboard mẫu gồm:
   - Graph “Độ trễ đồng bộ (phút)” đọc từ series `ecus_sync_stale_minutes`, thiết lập threshold cảnh báo 60/120 phút.
   - Graph “Số lỗi liên tiếp” đọc từ series `ecus_sync_consecutive_errors` để giám sát chuỗi lỗi dài.
   - Bar chart “Rows inserted/updated” so sánh khối lượng dữ liệu theo thời gian.
3. Thêm panel dạng Stat hiển thị `metrics.windows['24h'].errorCount`, `staleBreaches` và `averageStaleMinutes`.

### 6.4. Gợi ý cấu hình Power BI

1. Get Data → Web → nhập URL endpoint metrics (kèm header token) hoặc Get Data → Text/CSV → chọn file `monitor-ecus-sync.jsonl`.
2. Trong Power Query, bung cột `history.entries` để tạo bảng thời gian, chuyển `capturedAt` sang kiểu DateTime.
3. Tạo measure tính tổng số lỗi (`COUNTROWS` với `severity = "critical"`), độ trễ trung bình (`AVERAGEX` trên `staleMinutes`).
4. Dựng slicer theo khoảng thời gian (`capturedAt`), card hiển thị số lần cảnh báo, biểu đồ đường độ trễ.

> **Mẹo:** Đồng bộ file `.jsonl` sang thư mục dùng chung (SharePoint/OneDrive) để Power BI Gateway tải tự động mà không cần truy cập trực tiếp máy chủ Windows.

## 7. Ghi chú bảo mật

- Bảo vệ giá trị `MONITOR_ACCESS_TOKEN`, không commit vào repo.
- Giới hạn truy cập endpoint `/api/internal/monitor/ecus-sync` ở mạng nội bộ; cân nhắc thêm firewall rule chỉ cho phép máy chủ Windows chạy Task Scheduler truy cập.
- Định kỳ rà soát Event Viewer để phát hiện bất thường, kết hợp cùng cảnh báo email/Teams khi triển khai các bước tiếp theo trong lộ trình.
