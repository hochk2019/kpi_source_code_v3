# Kế hoạch tích hợp AI cho KPI Source Code v3

## 1. Mục tiêu
- Hỗ trợ phân tích dữ liệu KPI và trả lời câu hỏi của nhân viên/ban quản lý bằng chatbot nội bộ.
- Tận dụng lại dữ liệu sẵn có (tờ khai ECUS, điểm KPI, nhật ký) mà không vi phạm chính sách bảo mật của khách hàng.
- Tối ưu chi phí token bằng cơ chế cache, ràng buộc giới hạn nội dung và ưu tiên mô hình giá rẻ.
- Giữ khả năng triển khai trên Windows 11 Pro, backend Node.js hiện tại, SQL Server 2008 R2 và môi trường không có GPU.

## 2. Kiến trúc tổng quan đề xuất
1. **API `/api/ai/chat`** nhận yêu cầu từ frontend, kiểm tra phân quyền `aiAssistUse`, xác thực nội dung đầu vào và tự động rút gọn ngữ cảnh trước khi gửi đi.
2. **Proxy server-side** chuyển tiếp yêu cầu đến nhà cung cấp AI được cấu hình (Azure OpenAI, Ollama nội bộ, hoặc mô hình khác), đồng thời chuẩn hóa response về định dạng thống nhất.
3. **Cache tiết kiệm token** được lưu tại `kv_store` trong SQLite (khóa `ai_usage_cache_v1`) với TTL có thể cấu hình. Khi người dùng đặt câu hỏi giống nhau, hệ thống trả lời ngay từ cache thay vì gọi API ngoài.
4. **Cấu hình động** lưu tại `ai_provider_config_v1` để admin có thể chuyển đổi nhà cung cấp, điều chỉnh prompt hệ thống, giới hạn token, nhiệt độ, timeout… mà không cần build lại.
5. **Tích hợp nhật ký**: mọi lần gọi AI (hoặc cập nhật cấu hình) đều ghi audit log để truy vết.

Sơ đồ luồng tóm tắt:
```
Frontend → /api/ai/chat → Server proxy → Nhà cung cấp AI
                    ↑             ↓
                  Cache ← Lưu kết quả + audit log
```

## 3. Nhà cung cấp hỗ trợ & cách kết nối
| ID | Loại | Cách cấu hình | Ghi chú tiết kiệm token |
| --- | --- | --- | --- |
| `azure-openai` | Azure OpenAI (GPT-4o mini / GPT-4o) | Đặt biến môi trường `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_KEY`, `AZURE_OPENAI_API_VERSION`. Server sẽ build URL theo chuẩn Azure. | Ưu tiên mô hình GPT-4o mini; tự động cắt ngắn prompt còn tối đa 4096 ký tự, bật cache với TTL 3 ngày. |
| `google-ai-studio` | Google AI Studio (Gemini 1.5 Flash) | Tạo API key trong Google Cloud, đặt biến `GOOGLE_AI_STUDIO_API_KEY` (có thể tùy chọn `GOOGLE_AI_STUDIO_ENDPOINT`, `GOOGLE_AI_STUDIO_MODEL`). | Chi phí linh hoạt theo usage của Gemini; response mặc định dạng text/plain và trả về usageMetadata để tính token. |
| `ollama-local` | Ollama self-host (ví dụ `llama3.1:8b`) | Cài đặt Ollama trên máy Windows/WSL và expose REST API (`http://localhost:11434`). Điền `endpoint` vào config. | Chi phí ~0, thích hợp xử lý yêu cầu dài nhưng trả lời chậm hơn. Cache giúp tránh lặp. |
| `custom` | REST API khác | Có thể khai báo endpoint và header tùy chỉnh trong `providers` của config. | Tùy ý; nên bật `truncate` và `cache`. |

## 4. Chiến lược tiết kiệm token
- **Giới hạn ngữ cảnh**: server rút gọn prompt xuống tối đa 4000 ký tự và loại bỏ thông tin trùng lặp trước khi gọi AI.
- **Cache có TTL**: kết quả được lưu theo hash `provider + prompt + scope`. TTL mặc định 72 giờ, giới hạn 50 bản ghi gần nhất.
- **Ưu tiên mô hình rẻ**: cấu hình mặc định sử dụng GPT-4o mini (hoặc Ollama) và chỉ fallback lên mô hình cao cấp khi được phép.
- **Timeout hợp lý**: mặc định 25 giây để tránh request treo; nếu hết hạn, người dùng có thể thử lại mà không mất nhiều token.
- **Chế độ "tóm tắt kết quả"**: response trả về cả phần `usage` (prompt_tokens, completion_tokens) để admin theo dõi. Với Ollama, trường này sẽ ước lượng dựa trên độ dài.

## 5. Phân quyền
- Quyền mới `aiAssistUse`: cho phép người dùng gửi câu hỏi tới chatbot.
- Quyền `aiAssistManage`: chỉ định cho Admin/Quản lý cấu hình nhà cung cấp, xoá cache, bật/tắt tính năng.
- Mọi thao tác đều ghi lại trong `audit_logs_v1` (ví dụ `ai.chat`, `ai.config.update`).

## 6. Quy trình triển khai trên Windows 11 + SQL Server 2008 R2
1. Cập nhật `.env` với các biến Azure OpenAI, Google AI Studio hoặc endpoint Ollama theo nhu cầu.
2. Chạy `pnpm db:init` (hoặc `pnpm db:migrate`) để đảm bảo bảng `kv_store` đã có khóa config/cache.
3. Khởi động backend bằng `pnpm start` (script tương thích PowerShell 7).
4. Đăng nhập tài khoản admin, truy cập trang cấu hình AI (sẽ phát triển ở sprint kế tiếp) để kiểm tra trạng thái kết nối.
5. Test API trực tiếp: `curl -X POST http://localhost:5000/api/ai/chat -H "Content-Type: application/json" --cookie "kpi_session=..." -d '{"prompt":"Tóm tắt điểm KPI tháng 8"}'`.

## 7. Bước tiếp theo
- Xây dựng UI cấu hình và trang chatbot cho người dùng cuối.
- Kết hợp dữ liệu KPI thực tế (thông qua SQL Server và store hiện tại) để tạo prompt giàu ngữ cảnh nhưng vẫn bảo mật.
- Bổ sung kiểm thử tự động (Vitest) mô phỏng gọi API, đảm bảo cache hoạt động và không lộ thông tin nhạy cảm.
- Theo dõi usage để điều chỉnh mô hình phù hợp, cảnh báo khi vượt ngưỡng ngân sách token.

