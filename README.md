# KPI Hải quan – chế độ lưu trữ dùng chung

Ứng dụng tính điểm KPI cho nhân viên làm thủ tục hải quan. Phiên bản này bổ sung
máy chủ API cục bộ để nhiều máy trong cùng mạng LAN có thể cùng truy cập và
chia sẻ dữ liệu mà không cần copy `localStorage` thủ công.

## 1. Cài đặt

```bash
pnpm install
```

> Nếu trong quá trình cài đặt xuất hiện cảnh báo `Ignored build scripts:
> better-sqlite3`, hãy chạy `pnpm approve-builds` hoặc `pnpm rebuild
> better-sqlite3` để cho phép biên dịch native module của SQLite.

## 2. Khởi chạy cho môi trường phát triển

Mở **hai** cửa sổ terminal:

1. Chạy máy chủ lưu trữ dùng chung (port mặc định: `4000`):

   ```bash
   pnpm server
   ```

   Máy chủ này lưu dữ liệu vào cơ sở dữ liệu SQLite tại
   `server/data/storage.sqlite` và cung cấp các API REST dưới đường dẫn
   `/api/...`. Nếu bạn nâng cấp từ phiên bản cũ còn sử dụng file
   `server/data/db.json`, máy chủ sẽ tự động nhập dữ liệu ban đầu từ file này
   (nếu tồn tại) trong lần chạy đầu tiên.

2. Chạy giao diện Vite (port mặc định: `5173`):

   ```bash
   pnpm dev
   ```

   Vite đã cấu hình proxy `/api` → `http://localhost:4000`, vì vậy giao diện và
   API có thể hoạt động song song. Từ máy khác trong LAN, truy cập
   `http://<IP_MAY_CHU>:5173` (ví dụ `http://192.168.1.114:5173`).

> **Lưu ý:** Nếu muốn đổi port của máy chủ, đặt biến môi trường `PORT` trước khi
> chạy `pnpm server`, đồng thời cấu hình `VITE_API_BASE` cho Vite, ví dụ:
>
> ```bash
> PORT=5000 pnpm server
> VITE_API_BASE=http://localhost:5000 pnpm dev
> ```

## 3. Triển khai cho môi trường vận hành nội bộ

1. Đóng gói giao diện:

   ```bash
   pnpm build
   ```

2. Khởi động máy chủ Express ở chế độ production:

   ```bash
   pnpm start
   ```

   Máy chủ sẽ phục vụ cả API `/api/...` lẫn nội dung tĩnh trong thư mục `dist/`.
   Người dùng chỉ cần truy cập `http://<IP_MAY_CHU>:4000` (hoặc port bạn cấu
   hình). Nếu muốn dùng port khác, đặt `PORT=... pnpm start`.

3. Tất cả dữ liệu (tờ khai, gán MST, quy tắc KPI, tài khoản, nhật ký…) được lưu
   trong `server/data/storage.sqlite`. Sao lưu file này định kỳ để tránh mất dữ
   liệu. Bạn có thể xóa `server/data/db.json` sau khi đã nâng cấp nếu không còn
   sử dụng bản lưu trữ cũ.

## 4. Tài khoản mặc định

- `admin / admin123` – toàn quyền.
- `nhanvien / 123456` – tài khoản mẫu với quyền hạn chế.

Bạn có thể tạo thêm tài khoản và phân quyền trong tab **Tài khoản** của giao
diện. Mọi thao tác chỉnh sửa đều ghi lại trong tab **Nhật ký**.

## 5. Kiểm thử

```bash
pnpm lint
pnpm test --run
```

Các bài test sử dụng Vitest (môi trường `jsdom`) và không phụ thuộc vào máy chủ
API, vì vậy có thể chạy độc lập.

### Kiểm thử API backend

Để kiểm tra các route đồng bộ ECUS và cảnh báo tờ khai, Vitest đã bổ sung
integration test dùng `supertest`. Các test này tự động tạo cơ sở dữ liệu
SQLite trong bộ nhớ (`:memory:`) và mô phỏng kết nối SQL Server, giúp phát hiện
lỗi kết nối hoặc mapping dữ liệu ngay trên CI.

## 6. Công cụ hỗ trợ dữ liệu ECUS

Các tác vụ CLI mới giúp kiểm thử/khảo sát dữ liệu ECUS khi chưa kết nối được
SQL Server thật:

- `pnpm ecus:mock [--count 50 --start 2025-08-01 --range 10 --output mock.json]`
  tạo danh sách tờ khai giả lập đúng định dạng API (mặc định in ra STDOUT).
- `pnpm ecus:inspect --file <đường-dẫn-tệp-xml>` phân tích file XML xuất từ
  ECUS5VNACCS, liệt kê đường dẫn nút tờ khai cùng các trường quan trọng
  (Số tờ khai, ngày đăng ký, MST, doanh nghiệp, loại hình, giấy phép...).

Bạn có thể dùng dữ liệu mock để chạy thử `/api/import/ecus/run` mà không cần
kết nối tới SQL Server, hoặc dùng lệnh `inspect` để xác định rõ tên cột trước
khi viết câu truy vấn đồng bộ.
