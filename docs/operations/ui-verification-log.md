# Nhật ký kiểm tra giao diện gần nhất

Ngày kiểm tra: 2025-10-10

Trong phiên kiểm tra này, chúng tôi đã đăng nhập bằng tài khoản quản trị (`admin/admin123`), duyệt qua các màn hình chính và ghi nhận ảnh chụp để minh họa các thay đổi đã triển khai trong lộ trình cải tiến.

## Danh sách màn hình đã chụp

1. **Bảng điều khiển sức khỏe dữ liệu** – hiển thị thẻ trạng thái kết nối ECUS, đồng hồ thời gian đồng bộ, cảnh báo màu sắc và bảng thống kê đồng bộ gần nhất.
2. **Trình nhập dữ liệu** – thể hiện bộ lọc lưu sẵn, hộp thoại so sánh bản ghi trùng (diff viewer) và toast thông báo chuẩn hóa Unicode.
3. **Lịch sử export** – trình bày bảng tra soát `export_audit` với bộ lọc thời gian, chi tiết watermark và chữ ký SHA-256.

> *Ảnh chụp chi tiết được đính kèm trong báo cáo tự động của bot (không lưu trực tiếp vào repository để tránh tăng dung lượng không cần thiết).* 

## Hành động bổ sung

- Đã xác minh lại theme thương hiệu (Golden/Ocean/Forest) và đảm bảo các biến `--brand-*` áp dụng đồng nhất trên header và các nút hành động.
- Đăng xuất và đăng nhập lại để chắc chắn session lưu thông qua `localStorage` hoạt động ổn định sau khi thay đổi cấu hình bảo mật.

## Checklist QA cuối sprint

- Checklist chi tiết: xem `docs/operations/qa-sprint-checklist.md` để đánh dấu từng hạng mục trước khi chốt sprint.
- Sau mỗi phiên QA, ghi lại trạng thái tổng quan và ảnh chụp màn hình bổ sung vào mục "Danh sách màn hình đã chụp" phía trên.

## Bổ sung ngày 2025-11-13

- Đã chụp lại giao diện tab **Báo cáo KPI** sau đợt tái cấu trúc. Ảnh được lưu ngay trong repo tại `docs/images/kpi-report-tab.png` để tiện tham chiếu nội bộ.
- Môi trường: `pnpm dev` (backend mock + Vite dev server), trạng thái người dùng khách (guest) với dữ liệu mẫu mặc định.
- Quan sát nhanh: bố cục mới giữ riêng bộ lọc thời gian, khu vực Tổng quan KPI gộp biểu đồ xu hướng, chỉ số tổng hợp và "Cơ cấu tổ đội", panel "Điểm KPI +/-" mặc định mở kèm nút thu gọn.
  
## Ghi chú

Nếu cần so sánh lại trong tương lai, chạy `pnpm dev -- --host 0.0.0.0 --port 4173` rồi đăng nhập với tài khoản quản trị để tái tạo ảnh chụp tương tự. Khi cần chứng cứ trực quan nhanh, có thể tái sử dụng file `docs/images/kpi-report-tab.png` hoặc cập nhật ảnh mới hơn bằng quy trình trong `docs/operations/qa-sprint-checklist.md`.
