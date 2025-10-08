# TODO sau đối chiếu Checklist 3.0

1. [x] Lập và triển khai chiến dịch tối ưu mã nguồn: xoá module sidebar thử nghiệm không còn được import (`src/components/ui/sidebar.jsx`, `src/hooks/use-mobile.js`) để tránh kéo theo phụ thuộc Radix/Tailwind dư thừa.
2. [x] Ghi nhận số liệu sau cleanup: giảm 2 file, 700 dòng UI chưa sử dụng; kết quả build (`dist/`) giữ nguyên kích thước ~1.8 MB.
3. [x] Sau khi cleanup, đã chạy `pnpm lint`, `pnpm test`, `pnpm build` và cập nhật `docs/checklist-review.md` để xác nhận Checklist khớp thực tế.
