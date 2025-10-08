# Checklist triển khai phiên bản 3.0

Tài liệu này tổng hợp các bước cần thực hiện trước, trong và sau khi triển khai hệ thống KPI hải quan phiên bản 3.0 trên môi trường Windows 11 Pro với SQL Server 2008 R2 và PowerShell 7.

## 1. Chuẩn bị trước triển khai
- [ ] Xác minh có đủ quyền quản trị trên máy chủ ứng dụng và cơ sở dữ liệu.
- [ ] Kiểm tra dung lượng trống tối thiểu 10 GB trên ổ cài đặt.
- [ ] Sao lưu cơ sở dữ liệu `ECUS5VNACCS` bằng SQL Server Management Studio (SSMS) và lưu file `.bak` ở vị trí an toàn.
- [ ] Đồng bộ mã nguồn từ nhánh release (`git pull origin release/v3.0`).
- [ ] Kiểm tra file `.env` chứa cấu hình kết nối SQL Server, thông tin SMTP và đường dẫn thư mục lưu báo cáo.
- [ ] Chuẩn bị tài khoản dịch vụ dùng để chạy tác vụ đồng bộ (thuộc nhóm Administrators).

## 2. Kiểm tra chức năng trước khi cập nhật
- [ ] Chạy `pnpm install --frozen-lockfile` để đảm bảo không thay đổi dependency.
- [ ] Chạy `pnpm lint`, `pnpm test`, `pnpm build` và ghi nhận kết quả.
- [ ] Chạy `pnpm test:screenshot` để kiểm tra favicon/logo và tạo ảnh chụp Playwright phục vụ báo cáo triển khai.
- [ ] Kiểm tra kết nối tới SQL Server 2008 R2 bằng PowerShell: `Test-NetConnection -ComputerName <db-host> -Port 1433`.
- [ ] Đảm bảo script đồng bộ KPI truy cập được thư mục chia sẻ chứa file XML từ ECUS.
- [ ] Xuất thử báo cáo Excel và xác minh logo/template mới hiển thị đúng.

## 3. Triển khai bản cập nhật
- [ ] Dừng các dịch vụ liên quan (`pm2`, `IIS Node`, hoặc service tùy chỉnh nếu có).
- [ ] Sao lưu thư mục `config/` và `server/.env` trước khi copy build mới.
- [ ] Thực hiện `pnpm build` và copy thư mục `dist/` lên máy chủ sản xuất.
- [ ] Cập nhật dịch vụ chạy backend (`pm2 restart kpi-api` hoặc `nssm restart kpi-api`).
- [ ] Kiểm tra log ứng dụng ngay sau khi khởi động (`Get-Content -Path logs\api.log -Tail 200 -Wait`).

## 4. Kiểm tra sau triển khai
- [ ] Đăng nhập bằng tài khoản quản trị và chạy thử các luồng chính: Import, Gán MST, Đại Lý HQ, Báo Cáo KPI, Tài Khoản.
- [ ] Kiểm tra chức năng đồng bộ dữ liệu với ECUS và xác minh dữ liệu mới xuất hiện trong báo cáo.
- [ ] Thực hiện export báo cáo KPI và kiểm tra chữ ký số, định dạng font Unicode.
- [ ] Gửi email thông báo hoàn tất triển khai tới trưởng phòng và ban lãnh đạo.
- [ ] Cập nhật wiki nội bộ với thời gian triển khai và các lưu ý phát sinh.

## 5. Kế hoạch rollback
- [ ] Giữ lại file build cũ (`dist/` và `server/`) trong thư mục `backup/<ngay-trien-khai>/`.
- [ ] Nếu phát sinh lỗi nghiêm trọng, dừng dịch vụ mới, khôi phục thư mục cũ và restore backup database từ file `.bak`.
- [ ] Xác minh người dùng đăng nhập được và dữ liệu KPI hiển thị đúng sau khi rollback.
- [ ] Ghi nhận nguyên nhân lỗi và cập nhật quy trình kiểm thử để tránh lặp lại.

## 6. Hướng dẫn người dùng cuối
- [ ] Cập nhật tài liệu hướng dẫn sử dụng với các tính năng mới (điểm KPI +/- thêm, quy tắc KPI, biểu đồ tiến độ tổ đội).
- [ ] Tạo video/ảnh chụp minh họa thao tác import, gán MST và xuất báo cáo mới.
- [ ] Tổ chức buổi đào tạo ngắn (online/offline) cho quản lý và nhân viên khai báo.
- [ ] Thu thập phản hồi sau 1 tuần để lên kế hoạch cải tiến tiếp theo.

> **Ghi chú:** Checklist cần được lưu trong hệ thống quản lý dự án và đánh dấu trạng thái từng mục sau mỗi đợt triển khai.
