# Kế hoạch triển khai chi tiết: phân quyền, Windows 11 và đồng bộ dữ liệu

## 1. Mục tiêu
- Bảo đảm môi trường vận hành nội bộ trên Windows 11 ổn định, dễ bảo trì.
- Chuẩn hóa cơ chế phân quyền (admin/guest và vai trò mở rộng) trước khi triển khai để tránh thay đổi ngoài ý muốn khi import JSON hoặc đặt mặc định quy tắc.
- Loại bỏ phụ thuộc `localStorage`, chuyển hẳn sang kho dữ liệu SQLite/backend nhằm tránh sai lệch giữa các máy trạm.
- Cải thiện khả năng giám sát (health check, audit) để phát hiện cấu hình thiếu sớm.

## 2. Kiến trúc tổng thể đề xuất
1. **Tầng dữ liệu trung tâm**
   - SQLite làm nguồn dữ liệu chính, chia sẻ qua backend Express (đã tương thích Windows 11).
   - Sử dụng module `storageClient` ở chế độ remote-only, vô hiệu hóa cache cục bộ khi backend khả dụng.
2. **Tầng API bảo mật**
   - Route `/api/auth/*` xử lý phiên đăng nhập, lưu token trong SQLite (bảng `auth_sessions`).
   - Thêm middleware kiểm tra quyền theo ma trận (xem mục 3) trước các thao tác nhạy cảm (`/api/rules/*`, `/api/import/*`, `/api/hq/*`).
3. **Tầng giao diện**
   - Các màn hình import, Quy tắc KPI, Đại lý HQ chỉ hiển thị nút thao tác nếu người dùng có quyền tương ứng (đồng bộ với backend để tránh “ẩn nút nhưng vẫn gọi API”).
4. **Hạ tầng Windows 11/LAN**
   - Script Node (`pnpm dev`, `pnpm start`) chạy thuần Node, không phụ thuộc Bash/PowerShell.
   - Cho phép cấu hình `KPI_LISTEN_HOST`, `PORT`, `VITE_API_BASE` thông qua file `.env.local` để cố định IP nội bộ (ví dụ `192.168.1.114`).

## 3. Ma trận phân quyền chi tiết
| Quyền | Admin | Quản lý | Trưởng nhóm | Nhân viên | Guest |
|-------|:-----:|:------:|:-----------:|:---------:|:-----:|
| Import JSON / đồng bộ ECUS | ✅ | ✅ | ✅ | ❌ | ❌ |
| Quản lý MST & Đại lý HQ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Chỉnh sửa Quy tắc KPI | ✅ | ✅ | ❌ | ❌ | ❌ |
| Đặt mặc định quy tắc | ✅ | ✅ | ❌ | ❌ | ❌ |
| Đồng bộ ECUS nâng cao | ✅ | ✅ | ❌ | ❌ | ❌ |
| Quản lý tổ đội | ✅ | ✅ | ✅ | ❌ | ❌ |
| Quản lý cảnh báo thiếu thông tin | ✅ | ✅ | ✅ | ❌ | ❌ |
| Xem & xuất báo cáo | ✅ | ✅ | ✅ | ✅ | ❌ |
| Xem nhật ký (audit) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Quản lý tài khoản | ✅ | ❌ | ❌ | ❌ | ❌ |

> Các vai trò "Quản lý" và "Trưởng nhóm" đã được tạo sẵn trong seed dữ liệu cùng mật khẩu tạm thời để bàn giao cho đội vận hành. Nên yêu cầu người dùng đổi mật khẩu ngay sau lần đăng nhập đầu tiên.

> Khi cần thêm vai trò mới (ví dụ “Kiểm soát chất lượng”), mở rộng bảng `kpi_users_v1` với các cờ quyền mới và cập nhật middleware tương ứng.

## 4. Lộ trình triển khai (4 tuần)
1. **Tuần 1 – Phân tích & chuẩn bị**
   - Rà soát toàn bộ API, xác định route nào cần bảo vệ bổ sung.
   - Thiết kế schema quyền chi tiết và cập nhật tài khoản mẫu.
   - Viết test backend kiểm tra quyền truy cập bị chặn đúng (Vitest + supertest).
2. **Tuần 2 – Hiện thực backend**
   - Triển khai middleware `requirePermission(role)`.
   - Bổ sung route quản lý tài khoản để admin gán quyền.
   - Cập nhật `storageClient`/frontend để ẩn nút theo quyền thực tế.
3. **Tuần 3 – Loại bỏ localStorage & tối ưu Windows**
   - Đảm bảo mọi module frontend chỉ đọc/ghi qua API.
   - Thêm health check bắt buộc trước `build/start` (đã có `scripts/healthcheck.mjs`, mở rộng thêm kiểm tra quyền file trên Windows, trạng thái SQL Server nếu cấu hình).
   - Tài liệu hóa cấu hình `.env.local` mẫu cho LAN/Windows.
4. **Tuần 4 – Kiểm thử & triển khai**
   - Chạy kiểm thử hồi quy: unit + integration + smoke test thực tế trên 2 máy Windows 11.
   - Viết checklist bàn giao (cách sao lưu SQLite, cách reset mật khẩu, quy trình khởi động dịch vụ).
   - Thu thập phản hồi và tối ưu trước khi roll-out toàn bộ đội ngũ.

## 5. Kịch bản kiểm thử hồi quy bắt buộc
- **Backend**: `pnpm lint`, `pnpm test --run`, `pnpm healthcheck` trên Windows 11.
- **Tích hợp**: Import JSON 2 lần liên tiếp với quyền khác nhau để đảm bảo audit ghi nhận đầy đủ, Đại lý HQ cập nhật đồng bộ MST/tờ khai, đăng nhập/đăng xuất nhiều tài khoản.
- **Giao diện**: Kiểm tra các vai trò chỉ thấy chức năng hợp lệ, không thể thao tác trái phép bằng cách gọi API thủ công.
- **Mạng LAN**: Truy cập từ máy trạm khác qua `http://192.168.1.114:<port>` bảo đảm cookie đăng nhập hoạt động và websocket (nếu có) không bị chặn.

## 6. Ghi chú triển khai Windows 11
- Cài đặt Visual C++ Build Tools trước khi `pnpm install` để biên dịch `better-sqlite3`.
- Thiết lập script PowerShell tùy chọn để khởi động dịch vụ: `Start-Process node -ArgumentList 'scripts/start-backend.mjs --prod'`.
- Khuyến nghị tạo Task Scheduler chạy `pnpm healthcheck` mỗi sáng, gửi email/Teams nếu phát hiện thiếu SQL Server hoặc file SQLite bị khóa.
- Sử dụng Windows Defender Firewall để mở port cụ thể (5000/5173) cho nội bộ LAN, tránh truy cập ngoài.

## 7. Kế hoạch loại bỏ localStorage
1. Kiểm tra mọi nơi còn dùng `window.localStorage` (đã loại bỏ trong mã hiện tại, nhưng cần thêm test e2e xác nhận).
2. Bật chế độ “remote bắt buộc” trong `storageClient` khi phát hiện backend khả dụng; nếu backend không phản hồi, hiển thị cảnh báo và chặn import.
3. Viết test UI đảm bảo không còn thao tác khi backend offline (Vitest + Testing Library).

## 8. Theo dõi và cải tiến tiếp theo
- Mở rộng health check để thử kết nối SQL Server thực (nếu cấu hình) và báo cáo thời gian phản hồi.
- Tự động sao lưu `storage.sqlite` mỗi đêm lên thư mục mạng dùng `robocopy` hoặc script PowerShell.
- Tích hợp hệ thống cảnh báo (email/Zalo/Teams) khi phát hiện đăng nhập thất bại quá nhiều hoặc quyền bị thay đổi bất thường.

Tài liệu này là nền tảng để triển khai đồng bộ toàn hệ thống mà không làm gián đoạn hoạt động hiện tại.
