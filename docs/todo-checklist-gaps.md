# TODO khắc phục chênh lệch Checklist 3.0

## 1. Chiến dịch tối ưu mã nguồn
- [x] Chạy `pnpm lint --fix` và `pnpm build` để đảm bảo không còn cảnh báo lint sau khi xoá module sidebar không sử dụng.
- [x] Lập danh sách và loại bỏ hai file dư thừa (`src/components/ui/sidebar.jsx`, `src/hooks/use-mobile.js`) – tổng cộng 700 dòng UI thử nghiệm chưa tích hợp.
- [x] Cập nhật nhật ký tối ưu trong `docs/checklist-review.md` và `docs/todo-checklist.md`, đồng thời xác nhận kích thước bundle không đổi (dist ≈ 1.8 MB).

## 2. Kiểm thử & xác nhận lại Checklist
- [x] Sau cleanup đã chạy `pnpm test`, `pnpm lint`, `pnpm build` trên môi trường container tương thích Node 20 (tương đương Windows 11 + SQL Server 2008 R2 khi triển khai server-side).
- [x] Đã cập nhật `docs/checklist-review.md` (đánh dấu hoàn thành mục “Tối ưu mã nguồn”) và lưu kết quả rà soát cùng lệnh kiểm thử ở tài liệu này.
