# Changelog

## [2.2.0] - 2026-05-04
### TypeScript Migration (Phase 3 + 4)
- Chuyển đổi 17 file JSX → TSX cho tất cả các page components:
  - AppDashboardLanding, TeamManager, RulesEditor, KPIAdjustments
  - DataImporter, MSTAssignment, ReportViewer, AuditLog, ExportAuditReport
  - DataHealthDashboard, AiAssistant, AccountManager, SupportCenter, HQAgencyManager
  - Login, ChangePasswordDialog, EmptyState, StaffCombobox
- Thêm TypeScript interfaces cho tất cả component props (17+ interfaces)
- Thay thế tất cả hardcoded colors bằng `--ds-*` design tokens
- Chuyển đổi 45 shadcn UI components từ .jsx → .tsx

### Design System
- Thống nhất token system: `--ds-*` là single source of truth
- Shadcn tokens (`--background`, `--foreground`, etc.) là aliases cho `--ds-*`
- Thêm semantic tokens: `--ds-success`, `--ds-warning`, `--ds-info`, `--ds-destructive`
- Override Tailwind color utilities (`bg-gray-50`, `text-gray-700`, etc.) → `--ds-*` tokens

### useAppDialog Hook
- Tạo `src/hooks/useAppDialog.tsx` — AlertDialog-based dialog system
- Thay thế 184 lệnh `alert()`/`confirm()` trong 28 files
- Memoize context value để tránh re-render cascade (30 consumers)

### i18n Mở rộng
- Thêm i18n cho 12 file components trước đó chưa có: Login, ChangePasswordDialog, CommandCenter, ThemeToggle, App, AccountManager, TeamManager, ExportAuditReport, MSTAssignment, AppDashboardLanding, AppShellFrame
- Thêm ~136 translation keys mới vào `src/lib/i18n.js`
- Tổng cộng: ~700 translation keys cho hệ thống

### Super Agents Code Review
- Triển khai hệ thống 5 analysis agents (Code Review, Security, UX, Test, Performance)
- Phát hiện và sửa 31 issues CRITICAL+P1:
  - 17 test files: sửa import path .jsx → .tsx
  - 10 test files: thêm AppDialogProvider wrapper
  - Sửa missing FORM_FIELD_IDS.decisionNote
  - Hoàn thiện AuthAccountView permissions default (17 keys)

### Cleanup
- Xóa `jsconfig.json` (thay thế bởi `tsconfig.json`)
- Cập nhật CHANGELOG.md

## [2.1.0] - 2026-05-03
### Internationalization (i18n)
- Triển khai hệ thống i18n toàn diện với 567 translation keys.
- Tất cả 13 module chính đã được chuyển đổi từ hardcoded tiếng Việt sang sử dụng `t()`:
  - Account Manager, Notification Center, Audit Log, Team Manager
  - KPI Adjustments, AI Assistant, Report Viewer, Data Health Dashboard
  - HQ Agency Manager, KPICalculator, Rules Editor, Support Center, Data Importer
- Các namespace: `common`, `account`, `permission`, `table`, `form`, `error`, `validation`,
  `staff`, `notification`, `audit`, `backup`, `team`, `mst`, `kpi`, `ai`, `report`,
  `health`, `hq`, `shell`, `rules`, `support`, `import`.
- Hỗ trợ parameter interpolation: `t('key', { param: value })`.
- Sẵn sàng mở rộng thêm ngôn ngữ (tiếng Anh, v.v.) qua `setLocale()`.

## [2.0.0] - 2025-10-05
### Backend
- Đồng bộ chuẩn hóa \so_tk\ 11 chữ số ở tầng API (\
ormalizeDeclarationNumber\) để tránh trùng key khi import ECUS.
- Bổ sung API cấu hình mã ưu đãi C/O, cảnh báo sai lệch C/O và đồng bộ trạng thái an toàn (không phát \setState\ trong render).
- Cập nhật các đầu ra auth/report: trả token trong \/api/auth/session\, kiểm tra ECUS sync trả về đầy đủ metadata.

### Frontend
- Cải tiến Import Data: hiển thị số tờ khai đầy đủ + suffix, banner cập nhật, UI quản lý mã ưu đãi, bảng lệch C/O và định dạng ngày bằng \ormatDisplayDate\.
- Đồng bộ ReportViewer với dữ liệu chuẩn hóa, bổ sung kiểm tra khi thiếu dữ liệu.
- Điều chỉnh e2e import/login theo định dạng số mới (padding 11 chữ số).

### Tests
- Cập nhật toàn bộ test store/server/e2e theo chuẩn 11 chữ số và API mới.
- Thêm kiểm thử cập nhật \co_line_count\ cho bản ghi tồn tại và xác nhận cấu hình ECUS trả về đủ thông tin.

