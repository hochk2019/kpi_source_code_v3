# Lộ trình tích hợp sâu Trợ lý AI vào dữ liệu ECUS/KPI

> Ghi chú: Ưu tiên hiện thực phía **backend** trước để đảm bảo luồng dữ liệu ổn định. Sau mỗi hạng mục hoàn thành hãy đánh dấu `- [x]` trực tiếp trong tệp này.

## Giai đoạn 1 – Củng cố hạ tầng AI nội bộ (ưu tiên Backend)

### Backend
- [x] Bật và cấu hình nhà cung cấp `ollama-local` làm mặc định hoặc fallback ưu tiên trong `AI_DEFAULT_CONFIG`; đảm bảo thông tin kết nối, timeout và giới hạn kích thước yêu cầu tương thích với hạ tầng nội bộ.
- [x] Bổ sung endpoint kiểm tra tình trạng dịch vụ (`/api/ai/providers/test`) hỗ trợ Ollama, bao gồm ghi nhận log lỗi chi tiết để dễ giám sát.
- [x] Thiết lập cơ chế cache và retry riêng cho Ollama nhằm phòng khi dịch vụ tạm thời không phản hồi.
- [x] Viết test tích hợp xác nhận `/api/ai/chat` gọi đúng provider Ollama khi được cấu hình.

### UI / Cấu hình
- [x] Cập nhật trang cấu hình AI cho phép chọn Ollama làm mặc định, hiển thị trạng thái health-check và cảnh báo nếu dịch vụ ngoại tuyến.
- [x] Điều chỉnh thông điệp trong giao diện Trợ lý AI để nhắc người dùng rằng dữ liệu sẽ được xử lý hoàn toàn nội bộ khi dùng Ollama.

### Vận hành & Tài liệu
- [x] Thu thập yêu cầu hạ tầng (port, tài nguyên RAM/VRAM, tài khoản dịch vụ) phục vụ triển khai Ollama trên máy chủ nội bộ. (Xem thêm `docs/operations/ollama-internal-requirements.md`)
- [x] Ghi chú tạm thời về việc sẽ bổ sung hướng dẫn cài đặt Ollama trên Windows 11 sau khi hoàn tất Giai đoạn 2 (backend + UI sẵn sàng).

## Giai đoạn 2 – API snapshot KPI dành cho AI (ưu tiên Backend)

### Backend
- [x] Xây dựng service `buildAiKpiSnapshot` tái sử dụng logic `buildReportData`, `fetchEcusDeclarations` và các bộ lọc MST, cho phép lấy dữ liệu theo khoảng ngày.
- [x] Tạo endpoint `GET /api/ai/data/snapshot` nhận tham số `from`/`to`, kiểm soát phân trang và chuẩn hóa chuỗi Unicode để tương thích SQL Server 2008 R2.
- [x] Tích hợp cơ chế cache (ví dụ TTL 15 phút theo cặp `from/to`) để giảm tải truy vấn.
- [x] Viết test tích hợp (mock SQL Server) xác nhận endpoint trả về đủ các phần: `summary`, `topStaff`, `topTeams`, `trend`, `rawDeclarations` tối thiểu.

### UI
- [x] Kết nối lại các nút “Lấy snapshot KPI” và “Tạo tóm tắt” để sử dụng endpoint mới; hiển thị trạng thái tải và thông báo lỗi thân thiện khi snapshot chưa sẵn sàng.
- [x] Lưu snapshot vào local cache của client để tránh gọi lặp lại trong cùng phiên làm việc. (Cache session 5 phút, tối đa 6 snapshot.)

### Vận hành & Tài liệu
- [x] Cập nhật tài liệu nội bộ mô tả cấu trúc dữ liệu snapshot và cách kiểm tra log khi gặp lỗi SQL.

## Giai đoạn 3 – Insight & Tóm tắt tự động

### Backend
- [x] Hiện thực endpoint `/api/ai/insights` sinh insight dựa trên snapshot (so sánh kỳ trước, phát hiện giảm KPI, MST bất thường).
- [x] Bổ sung `/api/ai/insights/run` để chạy thủ công và `/api/ai/insights/feedback` để ghi nhận đánh giá người dùng.
- [x] Ghi log/audit mỗi khi sinh insight, bao gồm dữ liệu snapshot gốc (ẩn thông tin nhạy cảm nếu cần) và kết quả trả về.
- [x] Viết test tích hợp đảm bảo các endpoint trên xử lý đúng dữ liệu mẫu và tôn trọng cấu hình lọc MST.

### UI
- [x] Hoàn thiện luồng “Tạo tóm tắt” sử dụng snapshot thật, hiển thị bản tóm tắt tiếng Việt và cho phép gửi feedback.
- [x] Bổ sung màn hình lịch sử insight hiển thị thời gian tạo, mô hình sử dụng, trạng thái phản hồi.

### Vận hành & Tài liệu
- [x] Cập nhật hướng dẫn người dùng về cách khai thác insight, bao gồm lưu ý quyền truy cập và giới hạn dữ liệu.

## Giai đoạn 4 – Tự động hóa & mở rộng (chạy sau khi Backend + UI giai đoạn 1-3 hoàn thành)

### Backend
- [x] Thiết lập job định kỳ (cron) chạy `runAiInsightJob` để tự động sinh insight mỗi ngày và lưu vào kho.
- [x] Đồng bộ lịch sử snapshot vào hệ thống lưu trữ lâu dài, kèm đánh dấu phiên bản quy tắc KPI tại thời điểm tạo.

### UI
- [x] Thêm trang tổng quan insight định kỳ, cho phép tải lại dữ liệu hoặc xem snapshot gốc.
- [x] Cung cấp tùy chọn bật/tắt thông báo khi có insight bất thường mới.

### Vận hành & Tài liệu
- [x] Sau khi backend và UI ổn định, viết hướng dẫn chi tiết cấu hình Ollama local trên Windows 11 (cài đặt dịch vụ, cấp quyền firewall, nạp model, giám sát).
- [x] Chuẩn bị checklist chuyển đổi hoặc mở rộng sang nhà cung cấp AI khác nếu cần (Azure, OpenAI, Anthropic…).

## Ghi chú kiểm thử chung
- [x] Sau mỗi giai đoạn, chạy lại toàn bộ bộ kiểm thử liên quan (`pnpm exec vitest run tests/server.api.test.js`, `pnpm exec vitest run tests/ai/*.test.js` khi bổ sung) và cập nhật tài liệu nếu có thay đổi.

