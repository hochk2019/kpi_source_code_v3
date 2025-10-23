# Đề nghị cải tiến chất lượng & vận hành hệ thống

Tài liệu này tổng hợp các nhiệm vụ cải tiến đã thống nhất để đảm bảo bộ KPI Dashboard chạy ổn định trên Windows 11 Pro, kết nối an toàn với SQL Server 2008 R2 (ECUS5VNACCS) và giữ chất lượng mã nguồn ở mức cao. Mỗi cụm nhiệm vụ đều có checklist để đánh dấu khi hoàn thành.

## 1. Chuẩn hóa lint, format và line ending
- [ ] Thêm file `.gitattributes` ở thư mục gốc với cấu hình `* text=auto` và quy định `*.{js,jsx,json,md} text eol=lf` nhằm đồng bộ line ending giữa Windows/Linux.
- [ ] Cập nhật `eslint.config.js` sử dụng quy tắc `linebreak-style` thống nhất (ưu tiên `"unix"`) thay vì phân nhánh theo hệ điều hành.
- [ ] Mở rộng `package.json` để các lệnh `format:check` và `format:write` bao phủ toàn bộ `src/**/*.js(x)` cùng thư mục cấu hình quan trọng.
- [ ] Chạy `pnpm format:write` và rà soát diff để đảm bảo chỉ có thay đổi định dạng/trailing space.
- [ ] Chạy `pnpm lint` xác nhận không còn cảnh báo về line ending hay format.

## 2. Ổn định bộ kiểm thử và Git hook
- [ ] Điều chỉnh `tests/reportViewer.test.jsx` (heading “Top 5 nhân viên…”) cho khớp dữ liệu Unicode thực tế.
- [ ] Cập nhật snapshot `tests/dataImporter.preview.test.jsx` sau khi xác nhận UI preview đúng mong đợi.
- [ ] Sửa `tests/server.monitor.test.js` sử dụng cổng ngẫu nhiên (ví dụ `get-port`) để tránh lỗi `EADDRINUSE`.
- [ ] Chạy `pnpm test -- --runInBand` bảo đảm toàn bộ kiểm thử xanh trước khi bật lại hook.
- [ ] Kích hoạt lại `pre-commit` hook mặc định (gồm `pnpm lint` + `pnpm test`) và ghi chú cách xử lý khi phát sinh lỗi.

## 3. Tách nhỏ và tối ưu DataImporter
- [ ] Tạo thư mục `src/components/dataImporter/` để chứa các module con.
- [ ] Di chuyển từng nhóm chức năng (hook xử lý preview, bảng mapping, bộ lọc, lịch sử) thành file riêng giữ nguyên API công khai.
- [ ] Trích xuất tiện ích dùng chung vào `src/components/dataImporter/utils.js` để giảm lặp lại.
- [ ] Viết unit test/Storybook cho từng module mới, chú ý test Unicode để tránh lỗi font tiếng Việt.
- [ ] Chạy `pnpm lint` và `pnpm test -- --runInBand` xác nhận refactor không làm thay đổi hành vi.

## 4. Các cải tiến bổ sung nên thực hiện
- [ ] Thiết lập workflow CI (GitHub Actions/Azure DevOps) chạy lint + test trên Windows runner nhằm phát hiện sớm lỗi đặc thù nền tảng.
- [ ] Bổ sung tài liệu “Hướng dẫn đồng bộ ECUS5VNACCS” mô tả quy trình backup, mapping cột và xử lý lỗi kết nối SQL Server 2008 R2.
- [ ] Hoàn thiện hướng dẫn vận hành Powershell 7 (script import, reset cache) và kiểm tra quyền truy cập trước khi triển khai diện rộng.
- [ ] Rà soát các màn hình chính để chuẩn hóa UI tiếng Việt (font, dấu câu, encoding) và đề xuất điều chỉnh theme cho trải nghiệm nhất quán.

> ✅ Khi hoàn tất một nhiệm vụ, cập nhật lại checklist (đổi `- [ ]` thành `- [x]`) để dễ dàng theo dõi tiến độ.
