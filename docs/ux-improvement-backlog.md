# UX improvement backlog

This backlog liệt kê các hạng mục cải thiện trải nghiệm người dùng. Mỗi nhiệm vụ được đánh dấu bằng checkbox để Codex Cloud có thể cập nhật tiến độ. Khi hoàn thành nhiệm vụ, hãy thay `[ ]` bằng `[x]` và ghi chú ngắn gọn (ví dụ: `[x] ... (done in PR #123)`).

## 1. KPI Adjustments

- [x] Persist filter states (month, status, mine-only, staff) per user using local storage hoặc `UI_LAYOUT_KEY` trong store. (đã lưu cấu hình bộ lọc vào UI_LAYOUT_KEY)
- [x] Tách danh sách điều chỉnh sang virtual list / pagination để cải thiện hiệu năng với dataset lớn. (đã thêm phân trang linh hoạt 25/50/100/150 dòng và lưu trang hiện tại)
- [x] Bổ sung thao tác duyệt hàng loạt (bulk approve/reject) dựa trên quyền `adjustApprove`. (đã hỗ trợ chọn nhiều dòng và xử lý duyệt/từ chối đồng thời)
- [x] Thêm liên kết nhanh tới tờ khai hoặc MST liên quan để người duyệt tra cứu ngay tại chỗ. (đã thêm nút mở nhanh tab Import và tab Gán MST theo tham chiếu)
- [x] Cho phép quản lý cấu hình điểm mặc định trực tiếp trong UI và phản ánh vào `KPI_ADJUSTMENT_CATEGORY_CONFIG`. (đã bổ sung hộp thoại cấu hình và lưu vào store chia sẻ)

## 2. ECUS declaration sync

- [ ] Hiển thị tiến trình đồng bộ theo từng bước (đọc ECUS, tính toán diff, ghi vào store) với trạng thái rõ ràng khi gọi `refreshDeclRowsFromServer`.
- [ ] Thêm hàng đợi đồng bộ nền để xử lý file lớn, hỗ trợ resume khi mất kết nối hoặc đóng trình duyệt.
- [ ] Cảnh báo xung đột (vd. tờ khai đã bị chỉnh sửa tại chỗ khác) và cung cấp giao diện so sánh trước khi ghi đè.
- [ ] Thực hiện pre-check (kiểm tra kết nối DB, quyền truy cập ECUS, dung lượng đĩa) và hiển thị check-list trước khi chạy đồng bộ.
- [ ] Bổ sung cơ chế retry tự động với backoff và log thân thiện khi `sendWrite` trả về lỗi.
- [ ] Lưu lịch sử đồng bộ (ai chạy, thời gian, số bản ghi cập nhật) để hiện trong Notification Center và trang tổng quan.

## 3. Data Importer

- [ ] Chuyển việc đọc/ghi XLSX sang Web Worker để tránh khóa UI trong khi `XLSX.read` chạy.
- [ ] Tách DataImporter thành các module nhỏ (picker, preview, filters, sync) và lazy-load khi cần.
- [ ] Lưu/gửi preset bộ lọc và cấu hình cột, cho phép chia sẻ giữa các thành viên trong cùng tổ.
- [ ] Thiết kế wizard nhiều bước giúp người dùng theo dõi tiến trình import, tránh quá tải thông tin.
- [ ] Cải thiện feedback khi đồng bộ thất bại: gợi ý hành động cụ thể (thử lại, kiểm tra VPN, báo CNTT).

## 4. MST assignment & staffing

- [ ] Tự động phát hiện MST được gán trùng và đề xuất cách xử lý (giữ, chuyển, tách vai trò).
- [ ] Thêm timeline lịch sử thay đổi MST với bộ lọc theo hành động (create/update/delete).
- [ ] Cung cấp chế độ xem rút gọn cho trưởng nhóm với quick filters (assigned/pending, theo nhóm).
- [ ] Cảnh báo ngay khi nhập tên công ty vượt ngưỡng dài, sai định dạng hoặc chứa ký tự không hợp lệ.
- [ ] Cho phép export báo cáo phân bổ MST ra CSV/XLSX với metadata (người gán, ngày hiệu lực).

## 5. Navigation & notifications

- [ ] Đồng bộ danh sách Command Center pin lên backend (dùng API mới lưu vào `UI_LAYOUT_KEY`) để giữ cấu hình giữa các thiết bị.
- [ ] Thêm ô tìm kiếm toàn cục gợi ý nhanh theo quyền truy cập (module, báo cáo, người dùng).
- [ ] Hiển thị badge số lượng thông báo chưa đọc và thao tác đánh dấu đã đọc hàng loạt.
- [ ] Cung cấp hub hướng dẫn nhanh/FAQ theo ngữ cảnh mỗi trang, liên kết tới tài liệu trong thư mục `docs/`.

## 6. Reporting & automation

- [ ] Xem trước nội dung báo cáo và lịch chạy kế tiếp ngay trong màn hình lập lịch (`getReportSchedules`).
- [ ] Tạo dashboard KPI tổng quan với xu hướng tháng, top nhân sự, cảnh báo lệch chuẩn.
- [ ] Mở rộng kênh gửi báo cáo (email, chat nội bộ) và theo dõi trạng thái giao thành công/thất bại.
- [ ] Cho phép người dùng tự tạo template báo cáo tùy biến, lưu trữ vào `KPI_ADJUSTMENT_SETTINGS_KEY` hoặc kho riêng.

## 7. Reliability, QA & accessibility

- [ ] Chuẩn hóa xử lý lỗi mạng trong `storageClient.js` (retry queue, rollback, thông báo rõ nghĩa).
- [ ] Bổ sung đo lường hiệu năng (Web Vitals, log render) và dashboard theo dõi để phát hiện màn hình chậm.
- [ ] Thực hiện audit accessibility (focus trap, aria-label, contrast) trên các component trọng yếu (`KPIAdjustments`, `DataImporter`, `MSTAssignment`).
- [ ] Viết thêm test tự động cho các luồng filter và đồng bộ, đảm bảo không regress khi refactor.
- [ ] Xây dựng checklist QA cuối sprint, liên kết vào `docs/operations/ui-verification-log.md`.

## Cách sử dụng

1. Clone nhánh `ux-improvement-plan`.
2. Mỗi khi hoàn thành nhiệm vụ, cập nhật checkbox trong file này và thêm ghi chú.
3. Tạo PR riêng cho từng cụm nhiệm vụ để dễ review; Codex Cloud sẽ đánh dấu hoàn thành tại đây.
4. Sau khi toàn bộ nhiệm vụ được đánh dấu, chạy regression test và hợp nhất về `main`.
