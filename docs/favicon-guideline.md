# Hướng dẫn cập nhật favicon/tab logo

Để tránh thông báo "Tệp nhị phân không được hỗ trợ" khi tạo Pull Request, favicon được nhúng trực tiếp dưới dạng chuỗi Base64 trong `index.html`.

## Cập nhật favicon mới
1. Chuẩn bị file SVG logo mới (ưu tiên kích thước 200x200).
2. Chạy lệnh sau trên PowerShell 7 để chuyển sang Base64:
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes('logo.svg')) | Set-Content -Path logo.b64
   ```
3. Mở `logo.b64`, sao chép toàn bộ chuỗi và thay thế giá trị thuộc tính `href` trong thẻ `<link rel="icon" ...>` của `index.html`.
4. Kiểm tra lại bằng `pnpm lint` để đảm bảo file HTML không lỗi định dạng.

## Kiểm thử nhanh
- Chạy `pnpm dev` và mở trình duyệt để xác nhận favicon mới hiển thị.
- Nếu favicon không cập nhật, hãy xóa cache trình duyệt hoặc đổi tên query string `?v=<timestamp>` cho thẻ `<link>`.

> **Lưu ý:** Không commit trực tiếp file `.ico` hoặc `.png` vào repo. Nếu bắt buộc dùng dạng nhị phân, hãy đưa vào Git LFS và cập nhật tài liệu này.
