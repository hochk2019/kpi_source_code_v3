# Progress Log

## Session: 2026-03-17

### Slice: `cng-mtn` remediation backlog for app shell and report UX audit

- Tái nạp context từ audit `cng-cki` và gom lại các điểm bất thường cần khắc phục.
- Đọc các hotspot chính liên quan tới shell/report:
  - `src/components/appShell/AppShellFrame.jsx`
  - `src/components/appShell/AppShellWorkflowGuide.jsx`
  - `src/components/appShell/appShellWorkflowState.js`
  - `src/components/KPICalculator.jsx`
  - `src/App.css`
  - `src/components/workflows/ReportCenterPanel.jsx`
  - `src/components/ReportViewer.jsx`
  - `src/components/reporting/ReportingDashboardOverview.jsx`
- Dùng guideline từ `ui-ux-designer` và `ui-ux-pro-max` để chốt ba hướng chính:
  - mobile-first thay vì desktop co nhỏ
  - focus order và navigation clarity phải giữ vững khi sửa shell
  - report là data-dense dashboard nhưng cần hierarchy mạnh hơn và progressive disclosure trên mobile
- Tạo epic `cng-mtn` và các bead con `cng-mtn.1` tới `cng-mtn.6`.
- Giữ backend/database ở chế độ điều tra có điều kiện thay vì khẳng định sớm là lỗi server-side.

## Status

- Backlog remediation đã được tạo.
- Epic `cng-mtn` đang là điểm neo cho các lượt triển khai tiếp theo.

### Slice: `cng-mtn.1` shell foundation

- Claim bead `cng-mtn.1` và tập trung vào hiện tượng sidebar tabs chồng lớp ở App Shell.
- Xác định nguyên nhân gốc nằm ở tab primitives:
  - shell muốn tab dạng stacked card với `padding` lớn và caption 2 dòng
  - nhưng `TabsTrigger`/`TabsList` mặc định vẫn inject utility classes kiểu compact tab, kéo chiều cao thực xuống ~29px trong bundle cũ
- Sửa `src/components/ui/tabs.jsx` để hỗ trợ prop `unstyled` cho `TabsList` và `TabsTrigger`.
- Sửa `src/components/appShell/AppShellFrame.jsx` để shell navigation opt out khỏi default tab styling và chỉ dùng class shell chuyên biệt.
- Thêm regression test:
  - `tests/tabs.test.jsx` khóa behavior `unstyled` vs default styling
  - `tests/playwright/ui-shell-sidebar.spec.js` xác nhận sidebar tabs không overlap ở desktop/mobile
- Ghi nhận một điểm verify quan trọng:
  - Playwright config dùng `vite preview`, nên khi đọc kết quả UI phải rebuild `dist` trước; nếu không có thể chẩn đoán nhầm trên bundle cũ.
- Verify pass:
  - `pnpm exec vitest run tests/appShellFrame.test.jsx tests/tabs.test.jsx --environment jsdom`
  - `pnpm exec playwright test tests/playwright/ui-shell-sidebar.spec.js --config=playwright.config.mjs --workers=1`

## Next

- Bước hợp lý tiếp theo là `cng-mtn.2`: responsive shell + compact mode để giảm hero/workflow chrome và bỏ trải nghiệm desktop-thu-nho trên mobile.
