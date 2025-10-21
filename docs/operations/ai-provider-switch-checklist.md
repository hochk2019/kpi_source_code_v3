# Checklist chuyển đổi / mở rộng nhà cung cấp AI

Tài liệu này hỗ trợ đội vận hành khi cần chuyển Trợ lý AI từ Ollama nội bộ sang nhà cung cấp khác (Azure OpenAI, OpenAI, Anthropic, Google Gemini, v.v.) hoặc bật song song nhiều provider. Thực hiện đầy đủ các bước để tránh gián đoạn dịch vụ và đảm bảo dữ liệu ECUS/KPI luôn an toàn.

## 1. Đánh giá nhu cầu

- [ ] Xác định lý do chuyển đổi (hiệu suất, chi phí, tính năng, yêu cầu mô hình).  
- [ ] Đánh giá loại dữ liệu sẽ gửi tới provider mới và kiểm tra ràng buộc bảo mật của khách hàng.
- [ ] Thống nhất phạm vi thử nghiệm (QA, Staging, Production) và thời gian cắt chuyển.

## 2. Chuẩn bị thông tin xác thực

- [ ] Tạo hoặc yêu cầu API key/credential từ nhà cung cấp mới.  
- [ ] Ghi nhận endpoint, vùng (region), tên mô hình, giới hạn token, chi phí.
- [ ] Lưu credential vào kho bí mật an toàn (Vault, Password Manager) và chia sẻ cho tối thiểu 2 quản trị viên.

## 3. Cập nhật cấu hình backend

1. Mở `.env` hoặc biến môi trường hệ thống KPI và thêm các thông số:
   - `AI_DEFAULT_PROVIDER=<tên-provider>` nếu muốn chuyển mặc định.
   - Biến riêng của từng provider (ví dụ `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`).
2. Kiểm tra `server/aiProviders/<provider>.js` để biết các biến bắt buộc/tuỳ chọn. Nếu thiếu, bổ sung trước khi khởi động.
3. Đảm bảo `AI_PROVIDER_FALLBACKS` vẫn bao gồm `ollama-local` để chủ động rollback khi cần.
4. Khởi động lại backend (`pnpm server`) và theo dõi log:
   ```bash
   pnpm server
   # hoặc theo dõi file logs/ai-provider.log nếu đã cấu hình
   ```

## 4. Kiểm tra sức khỏe provider mới

- [ ] Gửi request thử qua API `/api/ai/providers/test` bằng `provider=<tên-provider>`.
- [ ] Đảm bảo phản hồi `ok: true` và thời gian phản hồi nằm trong ngưỡng dự kiến.
- [ ] Kiểm tra log máy chủ để xác nhận provider mới được gọi.

## 5. Cập nhật UI và phân quyền

- [ ] Vào tab **Cấu hình Trợ lý AI** và bật provider mới (toggle “Hoạt động”).
- [ ] Nếu chuyển mặc định, cập nhật nhãn mô tả (ví dụ “Dữ liệu gửi qua Azure OpenAI – kiểm tra hạn mức định kỳ”).
- [ ] Đảm bảo người dùng có quyền `aiAssistManage` nhận thông báo về thay đổi để điều chỉnh prompt phù hợp.

## 6. Kiểm thử chức năng

- [ ] Chạy `pnpm exec vitest run tests/server.api.test.js --testNamePattern="AI provider"` (hoặc kịch bản liên quan).  
- [ ] Thực hiện ít nhất 3 câu hỏi trong giao diện Trợ lý AI: chat thường, tóm tắt KPI, chạy insight.
- [ ] Kiểm tra trường hợp lỗi (ví dụ cố tình dùng model không tồn tại) và xác nhận UI hiển thị thông báo đúng tiếng Việt.

## 7. Chuyển đổi chính thức

- [ ] Thông báo thời gian chuyển cho người dùng nội bộ.
- [ ] Thực hiện chuyển cấu hình trong khung thời gian đã hẹn.  
- [ ] Giám sát log 15–30 phút sau khi chuyển để phát hiện lỗi sớm.

## 8. Sau chuyển đổi

- [ ] Cập nhật `docs/USER_GUIDE.md` và tài liệu vận hành nếu provider mặc định thay đổi.
- [ ] Lưu lại nhật ký chuyển đổi (ngày, giờ, người thực hiện, cấu hình mới) vào `docs/operations/` hoặc hệ thống quản lý thay đổi.
- [ ] Đánh giá chi phí sau 1–2 tuần và quyết định có tiếp tục hay quay lại provider cũ.

## 9. Khôi phục (Rollback)

- [ ] Giữ sẵn cấu hình Ollama nội bộ và đảm bảo dịch vụ vẫn hoạt động.
- [ ] Khi gặp sự cố nghiêm trọng, đổi `AI_DEFAULT_PROVIDER=ollama-local` và khởi động lại backend.
- [ ] Xác nhận trạng thái UI: badge “Nội bộ” xuất hiện và chat hoạt động bình thường.

Hoàn tất checklist trên giúp việc chuyển đổi hoặc mở rộng nhà cung cấp AI diễn ra an toàn, có thể truy vết và không gián đoạn hoạt động của Trợ lý AI trong hệ thống KPI.
