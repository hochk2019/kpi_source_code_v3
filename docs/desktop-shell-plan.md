# Desktop Control App Blueprint – Cập nhật 2025-02 (phục vụ Windows 11 + ECUS5VNACCS)

## 1. Mục tiêu & phạm vi
- [ ] Cung cấp desktop app tiếng Việt giúp vận hành nhanh các lệnh `pnpm server`, `pnpm build`, `pnpm lint`, `pnpm test`, `pnpm db:init` và script đồng bộ ECUS mà không mở terminal.
- [ ] Đảm bảo tương thích Windows 11 Pro, PowerShell 7, Unicode và kết nối SQL Server 2008 R2 (ECUS5VNACCS).
- [ ] Giữ nguyên kiến trúc backend/frontend hiện có; app chỉ là lớp điều khiển/giám sát, không thay đổi logic nghiệp vụ.
- [ ] Khi hoàn thành nhiệm vụ nào hãy đổi `[ ]` thành `[x]` để theo dõi tiến độ.

## 2. Điều kiện tiên quyết
- [ ] Xác nhận Node.js LTS + pnpm đã cài đặt (kế thừa logic kiểm tra từ `scripts/kpi-control-gui.ps1`).
- [ ] Kiểm tra PowerShell 7, .NET Desktop Runtime và quyền cài đặt Electron trên máy vận hành.
- [ ] Kiểm tra biến môi trường kết nối `mssql` (máy chủ, database, user, collation) cho SQL Server 2008 R2.
- [ ] Chuẩn bị chứng chỉ/ký số nếu cần phát hành nội bộ (SmartScreen).

## 3. Kiến trúc tổng thể
- Main process Electron quản lý tiến trình con, lưu cấu hình người dùng (đường dẫn repo, thông tin kết nối SQL, cổng backend).
- Renderer React/Tailwind hiển thị dashboard tiếng Việt: trạng thái server, đồng bộ ECUS, nhật ký, cảnh báo.
- IPC channels:
  - `env.validate`, `script.run`, `script.stop`, `script.status`.
  - `sql.ping` để kiểm tra kết nối ECUS và hiển thị lỗi Unicode nếu xảy ra.
- Tầng dịch vụ Windows: minimize-to-tray, auto-start, bắt lỗi crash và lưu log rolling file.

## 4. Lộ trình theo giai đoạn
### Giai đoạn 0 – Chuẩn bị & phân tích (tuần 1)
- [ ] Rà soát `scripts/kpi-control-gui.ps1` để thống nhất thông điệp lỗi, quy trình autostart, ghi log.
- [ ] Chuẩn hóa danh sách lệnh PNPM, tham số, biến môi trường (PORT, DB_*, AI_*) cần map vào app.
- [ ] Thiết kế API IPC chi tiết + sơ đồ trạng thái (Idle → Running → Success/Fail).

### Giai đoạn 1 – Khởi tạo dự án Electron (tuần 2)
- [ ] Tạo thư mục `desktop-shell/` với Electron Forge (template Vite + React) và cấu hình pnpm workspace.
- [ ] Thiết lập ESLint/Prettier đồng bộ với repo, bật kiểm tra Unicode (UTF-8).
- [ ] Thêm script `pnpm desktop:dev`, `pnpm desktop:pack` để dễ chạy.

### Giai đoạn 2 – Tích hợp điều khiển tiến trình (tuần 3)
- [ ] Viết service `ProcessRunner` tái sử dụng `child_process.spawn`, lưu PID, log stdout/stderr theo thời gian thực.
- [ ] Map các lệnh: `server`, `server:rebuild`, `dev`, `build`, `lint`, `test`, `db:init`, `ecus:mock`, `ecus:inspect`.
- [ ] Cho phép truyền tham số cổng, đường dẫn repo và kiểm tra trạng thái trước khi chạy (không chạy song song).
- [ ] Lưu log ra file `logs/yyyy-mm-dd.log`, ghi chú encoding UTF-8-BOM khi cần chia sẻ.

### Giai đoạn 3 – Giao diện & trải nghiệm người dùng (tuần 4-5)
- [ ] Trang tổng quan: thẻ trạng thái backend, tiến trình đang chạy, cảnh báo lỗi gần nhất.
- [ ] Panel nhật ký cuộn tự động, lọc theo loại lệnh, nút copy log, tùy chọn lưu 100/500 dòng.
- [ ] Nút thao tác dạng card (Start server, Stop server, Build, Lint, Test, Đồng bộ ECUS) với trạng thái vô hiệu hóa hợp lý.
- [ ] Cửa sổ cấu hình: chọn repo, cấu hình SQL (server/instance, DB, user, mật khẩu, chế độ Unicode), test kết nối.
- [ ] Hỗ trợ dark mode + font hỗ trợ tiếng Việt; kiểm thử hiển thị dấu.

### Giai đoạn 4 – Tính năng Windows nâng cao (tuần 6)
- [ ] Minimize to tray, menu chuột phải (Khởi động server, Dừng, Xem log, Thoát).
- [ ] Tích hợp auto-start (Task Scheduler hoặc registry) với tùy chọn bật/tắt.
- [ ] Tự kiểm tra bản cập nhật (khung hiển thị version, hướng dẫn tải bản mới từ file share nội bộ).

### Giai đoạn 5 – Kiểm thử & đảm bảo chất lượng (tuần 7-8)
- [ ] Unit test cho `ProcessRunner`, IPC handler (Vitest).
- [ ] Playwright/Electron test: mô phỏng bấm nút Start/Stop, xem log, đổi cấu hình.
- [ ] Kiểm thử thủ công trên Windows 11 Pro + PowerShell 7, xác nhận xử lý Unicode và SQL 2008 R2.
- [ ] Viết tài liệu hướng dẫn QA: checklist chạy thử, cách thu thập log khi lỗi.

### Giai đoạn 6 – Đóng gói & triển khai (tuần 9)
- [ ] Cấu hình electron-builder tạo gói `.exe` portable và `.msi`.
- [ ] Kịch bản phát hành: kiểm tra chữ ký, tạo hash, hướng dẫn IT triển khai, rollback.
- [ ] Cập nhật README + User Guide về cách sử dụng app desktop song song với script PowerShell.
- [ ] Thu thập phản hồi người vận hành, lập backlog nâng cấp (dashboard cảnh báo, biểu đồ hoạt động…).

## 5. Theo dõi & cải tiến
- [ ] Thiết lập bảng Kanban (To do / In progress / Done) tương ứng từng giai đoạn trên.
- [ ] Ghi nhận phản hồi người dùng sau mỗi milestone và cập nhật tài liệu.
