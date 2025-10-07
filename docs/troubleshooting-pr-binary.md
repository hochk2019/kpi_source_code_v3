# Khắc phục thông báo "Tệp nhị phân không được hỗ trợ" khi tạo Pull Request

Trong quá trình tạo PR trên GitLab/GitHub Enterprise nội bộ, giao diện sẽ hiển thị thông báo màu đỏ "Tệp nhị phân không được hỗ trợ" đối với những file `.png`, `.jpg`, `.xlsx`... thông điệp này **không phải lỗi build hay lỗi kiểm tra**. Đây chỉ là cảnh báo rằng hệ thống không thể render diff chi tiết cho tập tin nhị phân.

## Nguyên nhân ban đầu
- Các hình ảnh template (`public/report-template/header-1.png`, `header-2.png`, `logo.png`) từng được commit trực tiếp vào repository để phục vụ module export Excel (`server/reportExport.js`).
- Trình xem diff của GitLab/GitHub không thể hiển thị nội dung nhị phân nên đánh dấu mục đó bằng cảnh báo đỏ.

## Giải pháp đã áp dụng trong repo
- Bộ ảnh template đã được chuyển sang dạng Base64 lưu trong file `server/reportTemplateImages.js`. Hàm `getTemplateImages()` sẽ giải mã thành `Buffer` khi export Excel, vì vậy không còn file `.png` nào nằm trong PR.
- Khi tạo PR, giao diện sẽ không còn hiển thị cảnh báo "Tệp nhị phân không được hỗ trợ" cho bộ ảnh header/logo nữa.

## Cách xử lý và khắc phục
1. **Tiếp tục merge bình thường nếu đây là file hợp lệ**: chỉ cần xác nhận file đã đúng theo yêu cầu, thông báo đỏ có thể bỏ qua.
2. **Nếu gặp lại cảnh báo**:
   - Kiểm tra xem có phát sinh thêm tệp nhị phân mới (ví dụ `.zip`, `.exe`, `.png`) trong PR hay không. Cân nhắc chuyển sang dạng văn bản (Base64) hoặc đưa vào Git LFS nếu thật sự cần.
   - Với bộ ảnh template, chỉ cần cập nhật file `server/reportTemplateImages.js` theo hướng dẫn ở mục "Cập nhật bộ ảnh" bên dưới.
   - Hoặc đính kèm ảnh thông qua Git LFS (`git lfs track "public/report-template/*.png"`) nếu máy chủ đã bật Git LFS; khi đó giao diện sẽ hiển thị nhãn "Stored with LFS" và không báo lỗi đỏ.
3. **Ghi chú trong PR**: nêu rõ các file nhị phân được cập nhật để reviewer dễ đối chiếu.

## Khuyến nghị vận hành
- Khi cần cập nhật template, lưu ảnh gốc ở thư mục tạm thời (`design/` hoặc `tmp/`) ngoài repo rồi dùng script/base64 để cập nhật lại chuỗi trong `server/reportTemplateImages.js`.
- Thêm bước kiểm tra checksum (ví dụ `shasum -a 256 header-1.png`) trước khi chuyển đổi sang Base64 nhằm đảm bảo file chuẩn xác.
- Với môi trường Windows 11, có thể dùng PowerShell: `Get-FileHash .\header-1.png -Algorithm SHA256` để ghi nhận checksum phục vụ kiểm chứng.

## Cập nhật bộ ảnh template
1. Chuẩn bị ảnh mới (`header-1.png`, `header-2.png`, `logo.png`).
2. Chạy lệnh chuyển đổi sang Base64:
   - Trên Linux/macOS: `base64 -w 0 header-1.png > header-1.b64`
   - Trên Windows PowerShell 7: `[Convert]::ToBase64String([IO.File]::ReadAllBytes('header-1.png')) > header-1.b64`
3. Sao chép chuỗi Base64 vào thuộc tính `base64` tương ứng trong `server/reportTemplateImages.js`.
4. Chạy `pnpm lint` hoặc `pnpm test` để đảm bảo không có lỗi cú pháp, sau đó commit.

Thông tin này đã được bổ sung vào tài liệu dự án nhằm tránh nhầm lẫn khi tạo PR sau này.
