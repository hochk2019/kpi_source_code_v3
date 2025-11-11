# Checklist QA cuối sprint

Sử dụng checklist này để rà soát nhanh các luồng quan trọng trước khi chốt sprint. Đánh dấu vào từng hạng mục và ghi chú bất kỳ sai lệch nào trong nhật ký UI (`docs/operations/ui-verification-log.md`).

## 1. Chuẩn bị môi trường
- [ ] Cập nhật mã mới nhất từ nhánh release/sprint và chạy `pnpm install` nếu có thay đổi dependency.
- [ ] Chạy `pnpm lint` và bộ test trọng yếu (`pnpm exec vitest run --config vitest.frontend.config.mjs tests/dataImporter.preview.test.jsx tests/store.declSync.queue.test.js`). Xử lý toàn bộ lỗi đỏ trước khi QA.
- [ ] Khởi động ứng dụng (`pnpm dev -- --host 0.0.0.0 --port 4173`) và xác thực đăng nhập bằng tài khoản quản trị.

## 2. Data Importer
- [ ] Upload file ECUS mẫu, xác nhận wizard chuyển qua từng bước với thông báo aria-live hoạt động.
- [ ] Thay đổi bộ lọc (phạm vi ngày, agency, preset tổ) và đảm bảo bảng preview phản hồi đúng.
- [ ] Xếp lịch đồng bộ ECUS, kiểm tra hàng đợi hiển thị job mới, thông báo tiến trình và trạng thái retry nếu mô phỏng lỗi.
- [ ] Sau khi đồng bộ thành công, mở bảng diff/xung đột để chắc chắn dữ liệu cập nhật đúng và có hướng dẫn xử lý.

## 3. KPI Adjustments
- [ ] Kiểm tra bộ lọc tháng/trạng thái/mine-only và đảm bảo lựa chọn được lưu khi tải lại trang.
- [ ] Mở các hộp thoại (chi tiết, hướng dẫn, cấu hình điểm) và xác nhận hook `useRestoreFocus` đưa con trỏ về nút kích hoạt khi đóng.
- [ ] Thực hiện duyệt/từ chối hàng loạt và đảm bảo thông báo kết quả cũng như cập nhật bảng ngay lập tức.

## 4. MST Assignment
- [ ] Dùng quick filter để chuyển đổi chế độ trưởng nhóm, xác minh aria-pressed và highlight trạng thái chính xác.
- [ ] Mở timeline lịch sử, đảm bảo focus vào nội dung đầu tiên và phím Esc đóng dialog đúng chuẩn.
- [ ] Thử nhập tên công ty không hợp lệ để chắc chắn cảnh báo real-time hiển thị.

## 5. Báo cáo KPI & automation
- [ ] Kiểm tra bảng xếp hạng top 10 doanh nghiệp và sự kiện hover hiển thị tỷ trọng chính xác.
- [ ] Thu gọn/mở rộng panel "Điểm KPI +/- bổ sung" để xác nhận trạng thái mặc định là thu gọn.
- [ ] Xem lại dashboard KPI tổng quan: biểu đồ xu hướng, top nhân sự và cảnh báo lệch chuẩn phải khớp dữ liệu mẫu.
- [ ] Kiểm tra lịch gửi báo cáo đa kênh (email/chat), thử bật/tắt từng kênh và xác minh validation người nhận.

## 6. Notification & Command Center
- [ ] Tạo thông báo mới (có thể giả lập qua API) và xác nhận badge chưa đọc cập nhật, nút "Đánh dấu đã đọc" hoạt động.
- [ ] Sử dụng Global Search để tìm module, dùng phím mũi tên/Enter đảm bảo điều hướng bàn phím mượt.
- [ ] Kiểm tra ContextHelpHub hiển thị FAQ đúng tab hiện tại.

## 7. Data Health & Performance
- [ ] Mở Performance Dashboard và xác nhận dữ liệu Web Vitals/long task hiển thị (dù ở mức 0 trong môi trường dev).
- [ ] Kiểm tra lịch sử đồng bộ ECUS gần nhất, đảm bảo có ghi chú runAt và kết quả import/skipped/locked.

## 8. Accessibility & Regression nhanh
- [ ] Duyệt các dialog chính với bàn phím (Tab/Shift+Tab) để đảm bảo không bị trap focus ngoài ý muốn.
- [ ] Kiểm tra tương phản màu cho các badge cảnh báo và trạng thái (sử dụng devtools/extension nếu cần).
- [ ] Chụp nhanh 3 màn hình trọng yếu (Data Importer, KPI Adjustments, Báo cáo KPI) và lưu liên kết vào nhật ký UI.

## 9. Kết thúc
- [ ] Tổng hợp ghi chú QA vào `docs/operations/ui-verification-log.md` (ngày kiểm tra, các issue phát hiện, ảnh chụp tham chiếu).
- [ ] Nếu phát hiện lỗi blocker, tạo ticket ngay và đánh dấu vào checklist này bằng ghi chú *(blocker)* cho mục liên quan.
