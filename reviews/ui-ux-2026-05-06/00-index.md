# Frontend UI/UX Review & Improvement Plan — 2026-05-06

> **Author**: Cascade (Windsurf agent)
> **Scope**: Toàn bộ frontend KPI Command (`src/`, `packages/ui/`, `apps/web/`)
> **Mục tiêu**: Cung cấp tài liệu **chi tiết và hành động được** để 1 agent khác triển khai cải thiện UI/UX. Dựa trên: 7 ảnh người dùng cung cấp + scan toàn bộ source code thực tế.

---

## TL;DR (5 dòng)

- **Trạng thái**: TS migration ✅ xong (Phase 0–4), token system `--ds-*` đã chuẩn hoá, primitives `SectionSurface/Header/Toolbar/DataTable` đã có. Phase A (Dashboard KPI) đã thực hiện. **Chưa làm**: Phase B/C/D (quick wins, page restructure, shared components).
- **Vấn đề chính**: (1) Page header/hero quá to (200–300px) đẩy nội dung xuống dưới. (2) Mọi trang đều dài, không có **tabs trong page**, scroll 3000–4000px. (3) Nhiều khu vực `bg-white`, `bg-slate-*` hardcode lẫn với token. (4) `AppShellWorkflowGuide` còn `bg-slate-950 text-white`. (5) Empty state pie chart vẫn render full ngay cả khi 0 dữ liệu (image 7). (6) Filter/control bar đa phong cách (3+ implementations). (7) Permission alerts xếp chồng (image 6 — Import Data). (8) Trang `Đại Lý HQ` viewer-mode hiển thị **trắng** vì không có quyền đọc data nhưng UI không có empty state.
- **Đề xuất cốt lõi**: Áp dụng triết lý **Toss-style (mobile-first cleanliness, progressive disclosure)** trên desktop: mỗi trang **1 hành động chính + 1 review pane**, mọi mô tả chuyển sang **info icon tooltip**, hero header rút còn **48–64px**, các pages dài chia thành **tabs trong page** (`Tabs from @/components/ui/tabs`), permissions show **1 banner duy nhất** + skeleton/empty state chuẩn.
- **Thời lượng**: ~6–10 ngày dev cho 1 agent đơn lẻ, chia thành 8 slice (đính kèm).
- **Risk lớn nhất**: 410 test files, nhiều test khẳng định cấu trúc DOM/text cũ. Mọi slice phải kèm test update theo nguyên tắc TDD.

---

## Bộ tài liệu này gồm các phần

| # | File | Nội dung |
|---|------|----------|
| 00 | [00-index.md](./00-index.md) | TL;DR + bản đồ tài liệu (file này) |
| 01 | [01-current-state.md](./01-current-state.md) | Snapshot kiến trúc, tokens, primitives, IA hiện tại + những gì ĐÃ làm |
| 02 | [02-problems-from-images.md](./02-problems-from-images.md) | Phân tích 7 ảnh người dùng cung cấp, gắn với code |
| 03 | [03-problems-from-code.md](./03-problems-from-code.md) | Vấn đề phát hiện khi đọc code thực tế (ngoài ảnh) |
| 04 | [04-design-direction.md](./04-design-direction.md) | Triết lý thiết kế đề xuất + ngôn ngữ visual + tokens cần bổ sung |
| 05 | [05-component-library.md](./05-component-library.md) | Spec các component mới: PageHeader, FilterBar, ExportDropdown, EmptyState, BulkActionBar, PermissionBanner |
| 06 | [06-page-specs.md](./06-page-specs.md) | Wireframe + spec từng trang (13 tabs + 4 trang admin) |
| 07 | [07-implementation-plan.md](./07-implementation-plan.md) | **Plan chính cho agent**: 8 slices, mỗi slice đầy đủ files, success criteria, verify commands |
| 08 | [08-test-and-typescript-fixes.md](./08-test-and-typescript-fixes.md) | Fix test fail hiện có + TypeScript errors + cách viết test mới |
| 09 | [09-tracking-and-handoff.md](./09-tracking-and-handoff.md) | Cách tạo bead, cập nhật task.md, commit message convention, handoff giữa các phiên |
| 10 | [10-legacy-class-inventory.md](./10-legacy-class-inventory.md) | **Grep results thực tế**: ~1,979 legacy class occurrences trong ~105 files, top 20 hot files, replacement table chi tiết |
| 11 | [11-component-templates.md](./11-component-templates.md) | **Sample TSX code starter** cho 6 component mới (PageHeader, InfoTooltip, EmptyState, PermissionBanner, ExportDropdown, BulkActionBar, FilterBar compound) — agent copy-paste vào file chỉ định |

---

## Quy ước đọc

- 🔴 **Critical** = phải làm trước, blocking UX cho user
- 🟠 **High** = ảnh hưởng lớn nhưng không blocking
- 🟡 **Medium** = polish/consistency
- 🟢 **Low** = nice-to-have

Mỗi vấn đề có:
- **Evidence**: file path + line range + screenshot reference
- **Root cause**: tại sao vấn đề tồn tại
- **Fix**: hành động cụ thể, không nói chung chung
- **Verify**: cách kiểm tra fix hoạt động (test command, visual check)

---

## Cảnh báo (đọc trước khi code)

1. **TUYỆT ĐỐI không xoá test files** — chỉ update assertions theo cấu trúc DOM mới
2. **Không refactor code không nằm trong scope của slice** — Karpathy Principle #3 (Surgical Changes)
3. **Trước mỗi edit hàm/class**: chạy `gitnexus_impact({target: "<symbol>", direction: "upstream"})` và copy bảng blast radius vào commit message
4. **Theo dõi RTK compliance**: 100% command shell phải prefix `rtk`
5. **Module ≤ 800 LOC**: tách sub-components ngay khi vượt
6. **Mọi component mới**: phải có file test đi kèm
7. **i18n**: mọi text mới phải vào `src/lib/i18n.js` (vi-VN), không hardcode tiếng Việt vào JSX

---

> Ngày tạo: 2026-05-06 8:56 (UTC+07)  
> Liên hệ: cập nhật `task.md` mục "Active Slice" trước khi bắt đầu mỗi slice.
