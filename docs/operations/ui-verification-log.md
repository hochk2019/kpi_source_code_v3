# Nhật ký kiểm tra giao diện

Tài liệu này lưu bằng chứng các đợt kiểm tra UI gần nhất. Trước khi ghi log mới, chạy checklist chuẩn trong [ui-sprint-qa-checklist.md](/C:/Users/PC/.codex/worktrees/7720/kpi_source_code_v4/docs/operations/ui-sprint-qa-checklist.md).

## Phiên gần nhất

### 2026-03-28

- Phạm vi: shell runtime, lazy admin tabs, report-to-audit handoff, runtime fallback.
- Tài khoản: quản trị bootstrap trên môi trường kiểm thử cục bộ.
- Verify chính:
  - `pnpm build`
  - `npx playwright test tests/playwright/lazy-tab-shell.spec.js --reporter=line`
  - `pnpm exec vitest run tests/kpiCalculator.lazyTabs.test.jsx tests/kpiCalculator.errorBoundary.test.jsx --environment jsdom`
- Kết quả:
  - Audit tab giữ loading status ổn định khi lazy chunk đang tải.
  - Runtime fallback cho lazy import lỗi hiển thị được và còn retry path.
  - Handoff từ report workflow sang audit không còn đụng duplicate tab root id.
- Bằng chứng ngoài repo:
  - ảnh chụp hoặc video có thể lưu kèm ticket/slice tương ứng nếu cần review lại.

## Phiên trước đó

### 2025-10-10

Trong phiên kiểm tra này, nhóm đã đăng nhập bằng tài khoản quản trị bootstrap của môi trường kiểm thử, duyệt qua các màn hình chính và ghi nhận ảnh chụp để minh họa các thay đổi đã triển khai trong lộ trình cải tiến.

#### Danh sách màn hình đã chụp

1. **Bảng điều khiển sức khỏe dữ liệu** – hiển thị thẻ trạng thái kết nối ECUS, đồng hồ thời gian đồng bộ, cảnh báo màu sắc và bảng thống kê đồng bộ gần nhất.
2. **Trình nhập dữ liệu** – thể hiện bộ lọc lưu sẵn, hộp thoại so sánh bản ghi trùng (diff viewer) và toast thông báo chuẩn hóa Unicode.
3. **Lịch sử export** – trình bày bảng tra soát `export_audit` với bộ lọc thời gian, chi tiết watermark và chữ ký SHA-256.

> *Ảnh chụp chi tiết được đính kèm trong báo cáo tự động của bot, không lưu trực tiếp vào repository để tránh tăng dung lượng không cần thiết.*

#### Hành động bổ sung

- Đã xác minh lại theme thương hiệu (Golden/Ocean/Forest) và đảm bảo các biến `--brand-*` áp dụng đồng nhất trên header và các nút hành động.
- Đăng xuất và đăng nhập lại để chắc chắn session lưu thông qua `localStorage` hoạt động ổn định sau khi thay đổi cấu hình bảo mật.

## Ghi chú

- Khi log phiên mới, giữ nguyên cấu trúc: phạm vi, tài khoản, lệnh verify, kết quả, nơi lưu bằng chứng.
- Nếu cần tái tạo thủ công, chạy `pnpm dev -- --host 0.0.0.0 --port 4173` rồi đăng nhập với tài khoản quản trị.
