# KPI Hải quan – chế độ lưu trữ dùng chung

Ứng dụng tính điểm KPI cho nhân viên làm thủ tục hải quan. Phiên bản này bổ sung
Giải pháp được thiết kế cho Công ty TNHH Tiếp Vận Hoàng Kim (Golden Logistics Co., Ltd) để chuẩn hóa dữ liệu và chia sẻ báo cáo KPI minh bạch trong toàn bộ đội ngũ khai báo. 
máy chủ API cục bộ để nhiều máy trong cùng mạng LAN có thể cùng truy cập và
chia sẻ dữ liệu mà không cần sao chép thủ công giữa các máy.

## 1. Cài đặt

```bash
pnpm install
```

```bash
pnpm db:init
```

Lệnh `db:init` tạo sẵn file `server/data/storage.sqlite` cùng dữ liệu mặc
định để có thể chạy thử backend ngay cả khi chưa khởi động server lần đầu.

> Nếu trong quá trình cài đặt xuất hiện cảnh báo `Ignored build scripts:
> better-sqlite3`, hãy chạy `pnpm approve-builds` hoặc `pnpm rebuild
> better-sqlite3` để cho phép biên dịch native module của SQLite. Script
> khởi động backend (`pnpm server`) cũng sẽ tự động rebuild nếu phát hiện
> thiếu binding.

## 2. Khởi chạy cho môi trường phát triển

Chỉ cần một lệnh duy nhất:

```bash
pnpm dev
```

Script này sẽ tự động:

- đảm bảo native module `better-sqlite3` sẵn sàng (tương đương với `pnpm server:rebuild` khi cần);
- khởi chạy backend tại `http://localhost:5000` và Vite tại `http://localhost:5173` song song;
- dừng cả hai tiến trình ngay khi bạn nhấn `Ctrl+C`.

Script hoạt động thuần Node nên tương thích với Windows 11 và không phụ thuộc shell đặc thù.

Nhờ đó việc đăng nhập bằng lệnh `pnpm dev` không còn gặp lỗi HTTP 500 khi backend chưa được mở riêng như trước.

### Tuỳ chọn khác

- `pnpm server`: chỉ khởi động backend (thích hợp cho môi trường staging hoặc khi muốn ghép với reverse proxy khác).
- `pnpm dev:frontend`: chỉ chạy Vite để phát triển giao diện, vẫn sử dụng proxy `/api` trỏ về `VITE_API_BASE` (mặc định `http://localhost:5000`).

> Nếu vẫn gặp lỗi native module, bạn có thể chủ động chạy `pnpm server:rebuild` hoặc `pnpm rebuild better-sqlite3` trước khi `pnpm dev`.

### Kết nối qua mạng LAN

Từ máy khác trong cùng mạng hãy truy cập `http://<IP_MAY_CHU>:5173` (ví dụ `http://192.168.1.114:5173`). Backend lắng nghe trên mọi địa chỉ (`0.0.0.0`) theo mặc định, đồng thời cho phép ghi đè thông qua biến môi trường `KPI_LISTEN_HOST` nếu bạn chỉ muốn phục vụ trên một IP cố định.

> **Ví dụ:**
>
> ```bash
> KPI_LISTEN_HOST=192.168.1.114 pnpm start
> ```
>
> Khi thay đổi port của backend, đừng quên cập nhật `VITE_API_BASE` trước khi chạy `pnpm dev` hoặc `pnpm dev:frontend`.

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
   Lệnh `pnpm start` sử dụng script Node thuần nên tương thích Windows 11,
   tự đặt `NODE_ENV=production` và không còn phụ thuộc `cross-env`.
   Người dùng chỉ cần truy cập `http://<IP_MAY_CHU>:5000` (hoặc port bạn cấu
   hình). Có thể giới hạn địa chỉ lắng nghe bằng biến `KPI_LISTEN_HOST`, ví dụ
   `KPI_LISTEN_HOST=192.168.1.114 pnpm start`, và đổi port bằng `PORT=... pnpm start`.

> `pnpm build` sẽ tự động chạy `pnpm healthcheck` trước khi đóng gói nhằm đảm
> bảo SQLite (và tuỳ chọn SQL Server) đã sẵn sàng. Bạn có thể gọi thủ công
> `pnpm healthcheck` sau khi cài đặt trên Windows để kiểm tra nhanh tình trạng
> môi trường trước khi triển khai.

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
