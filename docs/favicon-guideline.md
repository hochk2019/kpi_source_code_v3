# Hướng dẫn cập nhật favicon/tab logo

Để tránh thông báo "Tệp nhị phân không được hỗ trợ" khi tạo Pull Request, favicon được nhúng trực tiếp dưới dạng chuỗi Base64 trong `index.html`.

## Cập nhật favicon mới
1. Chuẩn bị file SVG logo mới (ưu tiên kích thước 200x200).
2. Chạy script tự động:
   ```bash
   pnpm favicon:update path/to/logo.svg
   ```
   Script sẽ đọc file SVG, mã hóa Base64 và cập nhật trực tiếp thuộc tính `href="data:image/svg+xml;base64,..."` trong `index.html`.
3. Commit thay đổi và chạy lại `pnpm lint` để đảm bảo file HTML không lỗi định dạng.

## Kiểm thử nhanh
- Chạy `pnpm dev` và mở trình duyệt để xác nhận favicon mới hiển thị.
- Nếu favicon không cập nhật, hãy xóa cache trình duyệt hoặc đổi tên query string `?v=<timestamp>` cho thẻ `<link>`.
- Sau khi build (`pnpm build`), chạy `pnpm test:screenshot` để Playwright khởi động chế độ preview, xác thực chuỗi Base64 và tạo ảnh chụp màn hình phục vụ báo cáo.

> **Lưu ý:** Không commit trực tiếp file `.ico` hoặc `.png` vào repo. Nếu bắt buộc dùng dạng nhị phân, hãy đưa vào Git LFS và cập nhật tài liệu này.
