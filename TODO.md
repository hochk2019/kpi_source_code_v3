# TODO

## Giai đoạn 1 – Hoàn thiện các lỗi tồn đọng và tính năng đã phát triển dở dang

- [x] Rà soát lại tất cả các form nhập ở tab **Import Data** và **Gán MST** để đảm bảo tooltip hiển thị thống nhất, không chồng chéo.
- [x] Cập nhật lại các bài test backend/frontend bị vô hiệu hóa để chạy thành công sau khi sửa cấu hình `package.json` hoặc thiết lập script thay thế.
- [x] Khắc phục cảnh báo "Cannot update a component (App) while rendering..." trong `tests/e2e.login-import.test.jsx` bằng cách di chuyển thao tác `setState` ra ngoài luồng render.
- [x] Giảm/ẩn log "Không thể đồng bộ dữ liệu..." trong `tests/storageClient.test.js` để giữ kết quả test sạch.
- [x] Hoàn thiện UI cho "Cấu hình mã ưu đãi C/O" và "Đối soát C/O" (đồng bộ với API mới, xử lý lỗi HTTP 500).

## Giai đoạn 2 – Các yêu cầu còn lại của phiên bản 3.0

### Import Data & Đồng bộ ECUS
- [x] Bổ sung cơ chế đồng bộ và hiển thị cột "Số TK AMA" sau khi có thuật toán xác định tờ khai sửa.
- [x] Thêm bộ lọc khoảng thời gian nâng cao (hỗ trợ preset và lưu bộ lọc) cùng nút đối chiếu loại trừ KPI tự động.
- [x] Cho phép export Excel danh sách tờ khai đã chọn với cấu trúc header mới (bao gồm giấy phép bị loại trừ).

### Tab "Gán MST"
- [x] Lưu lịch sử chỉnh sửa người phụ trách vào bảng riêng trong SQL Server và đồng bộ hai chiều khi restore dữ liệu.
- [x] Hoàn thiện giao diện lịch sử (filter theo ngày/thao tác, tooltip ngắn gọn khi hover).

### Tab "Đại Lý HQ"
- [x] Lưu lịch sử thêm/sửa/xóa đại lý vào hệ thống log, cung cấp API truy vấn lịch sử để client hiển thị.
- [x] Viết tài liệu hướng dẫn nhập nhiều đại lý, giải thích chuẩn format phân tách bằng dấu phẩy.

### Khu vực "Quản Lý Tổ Đội"
- [x] Thêm tooltip/nút ẩn hiện lịch sử thay đổi team và mã số thuế.
- [x] Đề xuất & xây dựng tính năng phân bổ KPI theo chỉ tiêu tháng/quý cho từng tổ đội (bao gồm biểu đồ tiến độ).

### "Quy tắc KPI"
- [x] Thiết kế cơ chế lưu trữ quy tắc bền vững (ví dụ: lưu trong SQL hoặc file cấu hình) để không bị mất khi `pnpm build`.
- [x] Thay input nhập tay danh sách mã bằng component chọn đa lựa chọn/auto-complete từ dữ liệu đồng bộ.

### Tab mới "Điểm KPI +/- Thêm"
- [x] Thiết kế schema cơ sở dữ liệu cho các hạng mục cộng/trừ KPI (hỗ trợ lịch sử, duyệt, phân quyền nhập liệu).
- [x] Xây dựng giao diện nhập liệu cho từng hạng mục (hỗ trợ chọn tờ khai từ hệ thống hoặc nhập thủ công).
- [x] Đồng bộ dữ liệu với tab "Báo Cáo KPI" để phản ánh điểm cộng/trừ theo tháng.

### Tab "Báo Cáo KPI"
- [x] Tái cấu trúc giao diện và file Excel export để hiển thị đầy đủ các hạng mục KPI mới.
- [x] Bổ sung số lượng C/O, cột/tooltip hiển thị danh sách mã giấy phép, và khả năng tùy chọn ẩn/hiện cột khi in báo cáo.
- [x] Áp dụng template mới (ảnh 1, ảnh 2, logo ảnh 3) cho file Excel export.

### Tab "Tài Khoản"
- [x] Tự động tạo tài khoản cho nhân viên (Học, Phương, Tuấn – quyền trưởng nhóm) và quản lý (Hoàng Kim Hòa, Thúy Hà, Hoài Nam) với phân quyền tương ứng.
- [x] Xây dựng quy trình sync quyền với SQL Server để đảm bảo khởi tạo tài khoản không ảnh hưởng dữ liệu hiện hữu.

### Cải tiến chung
- [ ] Hiển thị tooltip mô tả ngắn khi hover vào mọi nút thao tác trong toàn hệ thống.
- [ ] Nghiên cứu phương án tích hợp AI (API phân tích dữ liệu/chatbot) tiết kiệm token.
- [ ] Thay favicon/tab logo bằng logo mới do khách hàng cung cấp.
- [ ] Chuẩn hóa lại document hướng dẫn triển khai trên Windows 11 Pro + SQL Server 2008 R2 + PowerShell 7.

## Giai đoạn 3 – Kiểm thử và triển khai

- [ ] Viết test E2E cho các luồng chính đã nâng cấp (Import, Gán MST, Đại Lý HQ, Báo Cáo KPI, Tài Khoản).
- [ ] Chạy toàn bộ test (`pnpm test`, `pnpm lint`, build production) trên môi trường Windows 11 tương tự khách hàng.
- [ ] Chuẩn bị checklist triển khai, kế hoạch rollback, và hướng dẫn sử dụng tính năng mới cho người dùng cuối.

- [x] Dọn gọn repo (xóa file dist/, _tmp_get_config.mjs, .vs/ sau khi hoàn thành) để review gọn.


- [ ] D?n g?n repo (x?a file dist/, _tmp_get_config.mjs, .vs/ sau khi ho?n th?nh) d? review g?n.


