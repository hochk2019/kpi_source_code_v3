# Insight AI cho KPI ECUS

Tài liệu này mô tả kiến trúc Giai đoạn 3 – Insight & Tóm tắt tự động, giúp trợ lý AI phân tích dữ liệu ECUS/KPI và trả về khuyến nghị tự động.

## Luồng xử lý tổng quát

1. **Lấy snapshot KPI**: `runAiInsightGeneration()` gọi lại service `buildAiKpiSnapshot()` để thu thập dữ liệu theo khoảng ngày hiện tại và khoảng liền kề trước đó. Các bộ lọc MST ở cấu hình đồng bộ ECUS vẫn được áp dụng.
2. **Chuẩn hóa prompt**: hàm `buildAiInsightPromptData()` tóm tắt số liệu chính (tờ khai, KPI, giấy phép, top nhân viên/tổ đội, danh sách MST mới/giảm) và sinh hướng dẫn tiếng Việt cho mô hình.
3. **Chọn provider**: `selectAiProvider()` ưu tiên nhà cung cấp được bật (mặc định `ollama-local`). Các tham số `temperature` và `maxTokens` bị giới hạn để tránh phản hồi dài vượt kiểm soát.
4. **Gọi mô hình**: `dispatchAiChat()` gửi prompt tới provider. Nếu snapshot không đổi (signature trùng), hệ thống bỏ qua bước gọi mô hình và trả về insight cache.
5. **Lưu trữ & audit**:
   - Insight mới (id `ins-...`) được lưu vào `ai_insights_v1` cùng metadata (`range`, `metrics`, `mstTop`, `snapshotCacheKey`).
   - Nhật ký `ai.insight.generate` ghi nhận range, chữ ký dữ liệu và highlights chính.
   - Trạng thái lần chạy gần nhất (`success`, `cached`, `skipped:no_data`, `error`) được cập nhật trong `state` để hiển thị trên UI.
6. **Feedback**: khi người dùng bấm **Hữu ích/Chưa hữu ích**, API `/api/ai/insights/feedback` lưu phản hồi vào `feedback.items[username]`, cập nhật tổng và audit `ai.insight.feedback`.

## API liên quan

| Endpoint | Phương thức | Quyền | Ghi chú |
| --- | --- | --- | --- |
| `/api/ai/insights` | GET | `aiAssistUse` | Trả về danh sách insight mới nhất kèm meta `state`/`schedule`. Tham số `limit` (mặc định 30) giúp giới hạn bản ghi. |
| `/api/ai/insights/run` | POST | `aiAssistManage` | Chạy job insight thủ công. Body tùy chọn `{ range: { from, to } }`. Trả về `{ insight, cached, skipped }` để UI hiển thị toast tương ứng. |
| `/api/ai/insights/feedback` | POST | `aiAssistUse` | Body `{ insightId, helpful, comment? }`. Cập nhật tổng lượt hữu ích/chưa hữu ích và phản hồi của chính người dùng. |

## Kiểm thử

- Vitest: `pnpm exec vitest run tests/server.api.test.js --testNamePattern="insight"` sẽ mô phỏng SQL Server và provider Ollama để xác nhận các API hoạt động.
- UI: `pnpm exec vitest run tests/aiAssistant.config.test.jsx` kiểm tra hiển thị insight và cập nhật trạng thái sau khi gửi phản hồi.

## Lưu ý vận hành

- Insight phụ thuộc SQL Server ECUS5VNACCS (SQL Server 2008 R2). Nếu timeout, job sẽ ghi trạng thái `error` và nhật ký `ai.insight.generate` chứa thông báo cụ thể.
- Nếu muốn chạy định kỳ, kích hoạt cron ở **Giai đoạn 4** sẽ gọi lại `runAiInsightGeneration()`; hiện tại (Giai đoạn 3) chỉ mới hỗ trợ chạy tay trên UI hoặc REST API.
- Bộ nhớ tạm insight giữ tối đa 30 bản ghi. Khi cần lưu trữ dài hạn, xuất dữ liệu từ `ai_insights_v1` bằng công cụ SQLite hoặc viết script đọc API.
