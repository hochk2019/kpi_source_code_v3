# UX improvement backlog

This backlog liệt kê các hạng mục cải thiện trải nghiệm người dùng. Mỗi nhiệm vụ được đánh dấu bằng checkbox để Codex Cloud có thể cập nhật tiến độ. Khi hoàn thành nhiệm vụ, hãy thay `[ ]` bằng `[x]` và ghi chú ngắn gọn (ví dụ: `[x] ... (done in PR #123)`).

## 1. KPI Adjustments

- [x] Persist filter states (month, status, mine-only, staff) per user using local storage hoặc `UI_LAYOUT_KEY` trong store. (đã lưu cấu hình bộ lọc vào UI_LAYOUT_KEY)
- [x] Tách danh sách điều chỉnh sang virtual list / pagination để cải thiện hiệu năng với dataset lớn. (đã thêm phân trang linh hoạt 25/50/100/150 dòng và lưu trang hiện tại)
- [x] Bổ sung thao tác duyệt hàng loạt (bulk approve/reject) dựa trên quyền `adjustApprove`. (đã hỗ trợ chọn nhiều dòng và xử lý duyệt/từ chối đồng thời)
- [x] Thêm liên kết nhanh tới tờ khai hoặc MST liên quan để người duyệt tra cứu ngay tại chỗ. (đã thêm nút mở nhanh tab Import và tab Gán MST theo tham chiếu)
- [x] Cho phép quản lý cấu hình điểm mặc định trực tiếp trong UI và phản ánh vào `KPI_ADJUSTMENT_CATEGORY_CONFIG`. (đã bổ sung hộp thoại cấu hình và lưu vào store chia sẻ)

## 2. ECUS declaration sync

- [x] Hiển thị tiến trình đồng bộ theo từng bước (đọc ECUS, tính toán diff, ghi vào store) với trạng thái rõ ràng khi gọi `refreshDeclRowsFromServer`. (đã thêm `declSyncProgress` trong store và thẻ tiến trình ở DataImporter)
- [x] Thêm hàng đợi đồng bộ nền để xử lý file lớn, hỗ trợ resume khi mất kết nối hoặc đóng trình duyệt. (đã triển khai `declSyncQueue` + worker, UI hàng đợi và resume trong DataImporter)
- [x] Cảnh báo xung đột (vd. tờ khai đã bị chỉnh sửa tại chỗ khác) và cung cấp giao diện so sánh trước khi ghi đè. (đã thêm cảnh báo xung đột, bảng so sánh và lịch sử chỉnh sửa trong DataImporter)
- [x] Thực hiện pre-check (kiểm tra kết nối DB, quyền truy cập ECUS, dung lượng đĩa) và hiển thị check-list trước khi chạy đồng bộ. (đã triển khai API precheck và checklist hiển thị trong DataImporter)
- [x] Bổ sung cơ chế retry tự động với backoff và log thân thiện khi `sendWrite` trả về lỗi. (đã thêm retry nhiều lần với thông điệp hướng dẫn người dùng)
- [x] Lưu lịch sử đồng bộ (ai chạy, thời gian, số bản ghi cập nhật) để hiện trong Notification Center và trang tổng quan. (đã bổ sung lưu trữ trên server, hiển thị ở Notification Center và Data Health Dashboard)

## 3. Data Importer

- [x] Chuyển việc đọc/ghi XLSX sang Web Worker để tránh khóa UI trong khi `XLSX.read` chạy. (đã chuyển parse/xuất sang worker chuyên trách)
- [x] Tách DataImporter thành các module nhỏ (picker, preview, filters, sync) và lazy-load khi cần. (đã tạo các section lazy cho picker/preview/filters/sync)
- [x] Lưu/gửi preset bộ lọc và cấu hình cột, cho phép chia sẻ giữa các thành viên trong cùng tổ. (đã hợp nhất UI lựa chọn phạm vi, API lưu cấu hình tổ và hoàn thiện xử lý quyền)
  - [x] Đồng bộ backend & API filter preset để hỗ trợ chế độ chia sẻ theo tổ (team visibility, metadata chủ sở hữu). (đã chuẩn hoá metadata chủ sở hữu/tổ, cho phép chuyển đổi phạm vi và cập nhật quyền lỗi TEAM_REQUIRED/FORBIDDEN)
  - [x] Cập nhật DataImporter hiển thị/quản lý preset tổ: chọn phạm vi lưu (cá nhân/tổ), hiển thị quyền chỉnh sửa, tự đồng bộ. (đã thêm lựa chọn phạm vi lưu, nhãn quyền chỉnh sửa và đồng bộ trạng thái chia sẻ trực tiếp trong UI)
  - [x] Lưu cấu hình cột import theo tổ với quyền chia sẻ, cho phép chọn dùng cấu hình tổ hoặc cá nhân và hiển thị nguồn cấu hình. (đã bổ sung API quản lý cấu hình tổ, lựa chọn phạm vi trong UI và thẻ thông tin cập nhật)
- [x] Thiết kế wizard nhiều bước giúp người dùng theo dõi tiến trình import, tránh quá tải thông tin. (đã thêm wizard 3 bước tại DataImporter.jsx)
  - [x] Thiết kế và hiển thị stepper ba bước (Chuẩn bị, Xem trước, Đồng bộ) trên DataImporter. (đã render stepper hướng dẫn ở đầu giao diện)
  - [x] Gói các khu vực Picker/Preview/Bộ lọc & bảng vào từng bước riêng, chỉ hiển thị bước đang hoạt động. (đã bao điều kiện theo `wizardStep`)
  - [x] Bổ sung điều hướng Next/Back và tự động chuyển sang bước Xem trước sau khi tải file. (đã thêm điều hướng và auto step khi có dữ liệu preview)
- [x] Cải thiện feedback khi đồng bộ thất bại: gợi ý hành động cụ thể (thử lại, kiểm tra VPN, báo CNTT). (đã hiển thị danh sách gợi ý hành động ngay trong DataImporter)
  - [x] Ánh xạ thông báo lỗi đồng bộ và kết quả pre-check sang thông điệp thân thiện kèm hướng xử lý chi tiết.
  - [x] Hiển thị danh sách gợi ý (thử lại, kiểm tra VPN, báo CNTT) ngay dưới thông báo lỗi để người dùng biết bước tiếp theo.
  - [x] Bổ sung gợi ý tương tự cho lỗi từ tiến trình/hàng đợi đồng bộ nhằm hướng dẫn cách xử lý và thời điểm thử lại.

## 4. MST assignment & staffing

- [x] Tự động phát hiện MST được gán trùng và đề xuất cách xử lý (giữ, chuyển, tách vai trò). (đã thêm panel cảnh báo kèm hành động trực tiếp trong giao diện)
  - [x] Thu thập và đánh dấu các MST bị gán trùng theo khoảng ngày hiệu lực. (đã gom nhóm chồng lấn bằng `useMemo` trong `MSTAssignment.jsx`)
  - [x] Hiển thị cảnh báo đề xuất xử lý ngay trong tab Gán MST. (đã bổ sung thẻ cảnh báo đầu trang với danh sách chi tiết từng MST)
  - [x] Bổ sung thao tác nhanh (giữ dòng ưu tiên, chuyển nhân viên, tách vai trò) để giải quyết chồng lấn. (đã thêm các nút thao tác nhanh để cập nhật dòng ưu tiên và đồng bộ nhân viên)
- [x] Thêm timeline lịch sử thay đổi MST với bộ lọc theo hành động (create/update/delete). (đã thêm preview + modal timeline áp dụng bộ lọc lịch sử)
  - [x] Gom nhóm bản ghi lịch sử theo ngày/MST để dựng preview và modal chi tiết. (timeline lấy từ `getMSTHistoryEntries`)
  - [x] Hiển thị danh sách dọc với badge theo thao tác (create/update/delete) và chi tiết giá trị trước/sau. (sử dụng HistoryTimelineGroups)
  - [x] Kết nối nút tải lại, giới hạn preview và mở dialog xem toàn bộ khi cần. (áp dụng chung bộ lọc ngày + thao tác hiện có)
- [x] Cung cấp chế độ xem rút gọn cho trưởng nhóm với quick filters (assigned/pending, theo nhóm). (đã thêm toggle chế độ trưởng nhóm với quick filters và tóm tắt trạng thái)
  - [x] Bổ sung toggle "Chế độ trưởng nhóm" kèm mô tả và thống kê nhanh. (đã render thẻ cảnh báo rút gọn ở đầu trang MSTAssignment)
  - [x] Hiển thị bộ lọc nhanh trạng thái Assigned/Pending và danh sách tổ đội để chọn nhanh. (đã thêm các nút trạng thái và select tổ dựa trên roster)
  - [x] Áp dụng bộ lọc vào danh sách chính, thu gọn cột hiển thị cho chế độ này. (đã kết hợp bộ lọc và ẩn cột ngày khi chế độ bật)
- [x] Cảnh báo ngay khi nhập tên công ty vượt ngưỡng dài, sai định dạng hoặc chứa ký tự không hợp lệ. (đã thêm kiểm tra chia sẻ và cảnh báo trực tiếp trong form/bảng)
  - [x] Chuẩn hóa hàm kiểm tra tên công ty (độ dài, ký tự hợp lệ, ký tự chữ) để tái sử dụng. (đã thêm `getCompanyNameValidation` trong `MSTAssignment.jsx`)
  - [x] Hiển thị cảnh báo real-time cho trường tên công ty ở form thêm mới. (đã đổi input dùng cảnh báo và border nhấn mạnh)
  - [x] Cảnh báo ngay trong ô chỉnh sửa tên công ty của bảng gán MST. (đã bọc `CompanyNameCell` hiển thị thông báo và trạng thái `aria-invalid`)
- [x] Cho phép export báo cáo phân bổ MST ra CSV/XLSX với metadata (người gán, ngày hiệu lực). (đã thêm menu export đa định dạng và ghi kèm metadata vào file)
  - [x] Bổ sung menu export cho phép chọn phạm vi lọc/tất cả và định dạng CSV hoặc Excel. (đã dùng popover hiển thị các lựa chọn theo trạng thái bộ lọc hiện tại)
  - [x] Thu thập metadata (người gán liên quan, khoảng ngày hiệu lực, bộ lọc) và đưa vào file xuất. (đã tổng hợp vào sheet "Thong tin" và header CSV)
  - [x] Tạo helper xuất file áp dụng metadata và tên file theo phạm vi/định dạng. (đã dùng XLSX cho Excel và Blob cho CSV)

## 5. Navigation & notifications

- [x] Đồng bộ danh sách Command Center pin lên backend (dùng API mới lưu vào `UI_LAYOUT_KEY`) để giữ cấu hình giữa các thiết bị. (đã chuyển sang dùng store chung và ghi log audit)
  - [x] Thêm helper đọc/ghi danh sách ghim Command Center qua `UI_LAYOUT_KEY` và chuẩn hoá dữ liệu lưu trữ.
  - [x] Lắng nghe thay đổi từ kho chia sẻ để cập nhật danh sách ghim realtime giữa các tab/thiết bị.
  - [x] Đồng bộ thao tác ghim/bỏ ghim với backend và ghi lại nhật ký audit kèm thông tin người thực hiện.
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
