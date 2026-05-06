# 01 — Trạng thái hiện tại (Snapshot Kiến trúc)

> Mục đích: Cho agent bức tranh ngắn gọn nhưng đầy đủ về **những gì đang có**, **những gì đã làm**, **những gì chưa**. Không lặp lại những việc TS migration plan trước đã hoàn thành.

---

## 1. Repo layout (relevant cho frontend)

```
e:\GPT\kpi_source_code_v4\
├── apps/
│   ├── api/         # Express server (server-v4)
│   ├── ecus-bridge/ # ECUS sync bridge
│   └── web/         # Vite + React 19 frontend (entry point của UI)
├── packages/
│   ├── api-client/  # fetch wrappers (reportingClient, declarationClient, ...)
│   ├── domain/      # business logic + accountRoles
│   ├── backend-shared/ # shared types/constants
│   └── ui/          # ⭐ Shared UI primitives (shellPrimitives, primitives)
├── src/
│   ├── App.tsx                  # Root: header + skip-link + KPICalculator
│   ├── App.css                  # 1592 dòng — design tokens + ds-* utilities
│   ├── components/
│   │   ├── appShell/            # Shell (Sidebar + Hero + WorkflowGuide)
│   │   ├── ui/                  # 47 shadcn components (.tsx)
│   │   ├── shared/              # EmptyState, StaffCombobox
│   │   ├── designSystem/        # re-exports từ packages/ui
│   │   ├── reporting/           # 23 files: Report Center + widgets
│   │   ├── mst-assignment/      # 38 files: MST page + sub-panels
│   │   ├── dataImporter/        # 97 files: Import Data (lớn nhất)
│   │   ├── kpi-adjustments/     # 20 files
│   │   ├── rules-editor/        # 16 files
│   │   ├── account-manager/     # 9 files
│   │   ├── data-health-dashboard/ # 9 files
│   │   ├── ai-assistant/        # 10 files
│   │   ├── command-center/      # 8 files
│   │   ├── auditLog/            # 6 files
│   │   ├── team-manager/        # 5 files
│   │   ├── hq-agency-manager/   # 3 files
│   │   ├── support/             # 2 files
│   │   ├── workflows/           # 3 files
│   │   ├── errorBoundaries/     # 1 file
│   │   └── (page roots .tsx, ~17 files)
│   ├── designSystem/            # ThemeProvider, brandTokens, themeTokens
│   ├── lib/                     # store, i18n, commandBus, appShellNavigation, ...
│   ├── hooks/                   # useDashboardKpiOverview, useAppDialog, useTooltipTitles, ...
│   ├── tokens/                  # TS tokens (mirror of CSS vars)
│   └── types/                   # Shared TS types
└── tests/                       # 410 test files (vitest + jsdom)
```

---

## 2. Design Token System — đã chuẩn hoá

**File**: `@/App.css:69-219`

Mọi trang phải dùng **`--ds-*` tokens**. Không hardcode `bg-slate-*`, `text-stone-*`, `bg-amber-50`, etc.

### Surface tokens
| Token | Light | Dark |
|-------|-------|------|
| `--ds-surface-base` | oklch(0.985 0.01 250) | oklch(0.16 0.008 250) |
| `--ds-surface-muted` | oklch(0.965 0.014 250) | oklch(0.20 0.01 250) |
| `--ds-surface-card` | oklch(1 0 0) | oklch(0.23 0.008 250) |
| `--ds-surface-raised` | oklch(0.99 0.008 250) | oklch(0.28 0.008 250) |
| `--ds-surface-overlay` | oklch(1 0 0) | oklch(0.23 0.008 250) |

### Text tokens
| Token | Mục đích |
|-------|----------|
| `--ds-text-primary` | Tiêu đề, label chính |
| `--ds-text-secondary` | Caption, metadata |
| `--ds-text-muted` | Description, helper text |
| `--ds-text-muted-soft` | Footer, ghi chú nhỏ |
| `--ds-text-inverse` | Trên nền dark/accent |

### Accent (cobalt blue) + Brand (gold)
- `--ds-accent`: oklch(0.64 0.18 257) — **xanh cobalt** (main interactive)
- `--ds-accent-strong`: hover/active state
- `--ds-accent-soft`: tab active background
- `--brand-500`: #f59e0b — **vàng gold** cho highlight, CTA phụ
- `--brand-gradient`: linear-gradient(...amber)

### Semantic
- `--ds-success`: #059669 / #34d399
- `--ds-warning`: #d97706 / #fbbf24
- `--ds-info`: #2563eb / #60a5fa
- `--ds-destructive`: oklch(0.577 0.245 27.325)

### Radius / Shadow
- `--ds-radius-xs` 0.5rem (8px)
- `--ds-radius-sm` 0.75rem (12px) — **default cho card**
- `--ds-radius-md` 1rem (16px)
- `--ds-radius-lg` 1.25rem (20px)
- `--ds-radius-pill` 999px
- `--ds-shadow-soft` `--ds-shadow-strong`

### ⚠️ Vấn đề tokens hiện tại
1. **`--ds-radius-xs`/`sm`/`md`/`lg` đều to** (8/12/16/20px). Toss/Linear/Notion thường dùng 4/6/8/12px → cảm giác hiện tại **mềm và quá rounded**, không "lean".
2. **`--ds-shadow-soft` quá đậm** (`0 20px 60px rgba(15,23,42,0.08)`) → nhiều card lơ lửng không cần thiết.
3. **Accent là cobalt blue** nhưng ảnh shows **gold/amber** chiếm lớn (sidebar item active, badge "viewer", "Đăng nhập quản trị"). Có sự pha trộn 2 hue → kém nhất quán.

---

## 3. Component Primitives — đã có

**File**: `@/packages/ui/src/shellPrimitives.tsx`

| Component | Mục đích | Status |
|-----------|----------|--------|
| `SectionSurface` | Wrapper card cho mọi section (`ds-card ds-section`) | ✅ |
| `SectionHeader` | Title + description + meta + actions | ✅ |
| `SectionToolbar` | Filter bar layout (`ds-toolbar`) | ✅ |
| `SearchField` | Input search có icon + clear | ✅ |

**File**: `@/packages/ui/src/primitives.tsx`

| Component | Mục đích | Status |
|-----------|----------|--------|
| `DataTable<T>` | Bảng generic với column config | ✅ |
| `StatusBadge` | 5 tone (neutral/info/success/warning/danger) | ✅ |
| `FilterSelect` | Wrapper Radix Select | ✅ |
| `AppDialog*` | Wrappers Radix Dialog (3 sizes) | ✅ |

### Vấn đề primitives hiện tại
- ❌ `StatusBadge` vẫn hardcode `bg-slate-100`, `bg-sky-100`, `bg-emerald-100` (line 210-221 của primitives.tsx) — **không dùng tokens**. Sai hệ thống dark/high-contrast.
- ❌ Không có **PageHeader** chuẩn (mỗi trang tự viết).
- ❌ Không có **FilterBar** chuẩn cho multiple filters.
- ❌ Không có **ExportDropdown** (MST hiện có 4 buttons, HQ có 0).
- ❌ Không có **EmptyState** chuẩn (`@/components/shared/EmptyState.tsx` có nhưng dùng không đồng nhất).
- ❌ Không có **BulkActionBar** (sticky bottom khi chọn nhiều).
- ❌ Không có **PermissionBanner** (image 1, image 6 hiển thị 2 alerts xếp chồng).

---

## 4. Application Shell

**File**: `@/src/App.tsx` + `@/src/components/appShell/AppShellFrame.tsx`

```
┌─────────── App.tsx (header) ─────────────┐
│  Golden Logistics | Ops shell    [search][bell][θ]
│  Greeting / "Đang xem..." | Login        │
└──────────────────────────────────────────┘
┌─────────── KPICalculator ────────────────┐
│  ┌── AppShellFrame ──────────────────┐  │
│  │ ┌─Sidebar──┐ ┌─ Main ──────────┐ │  │
│  │ │ KPI Cmd  │ │ Hero (eyebrow + │ │  │
│  │ │ ─────────│ │  title + role + │ │  │
│  │ │ TỔNG QUAN│ │  search button) │ │  │
│  │ │ • KPI    │ │ ───────────────│ │  │
│  │ │ VẬN HÀNH │ │ WorkflowGuide  │ │  │
│  │ │ • MST    │ │  (banner ~250px)│ │  │
│  │ │ • Import │ │ ───────────────│ │  │
│  │ │ • HQ     │ │ Page content   │ │  │
│  │ │ ...      │ │                │ │  │
│  │ └──────────┘ └────────────────┘ │  │
│  └──────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### Đặc điểm
- **Sidebar** (`@/src/components/appShell/AppShellFrame.tsx:136-214`): brand + compact-status + 5 collapsible nav groups
- **Hero** (`@/src/components/appShell/AppShellFrame.tsx:217-247`): eyebrow + title + role pill + info button + user pill + search command
- **WorkflowGuide** (`@/src/components/appShell/AppShellWorkflowGuide.jsx`): banner 250px, có thu gọn được, **vẫn hardcode `bg-slate-950 text-white`** ở action button
- Tabs API: dùng `Tabs` của Radix (`@/src/components/ui/tabs.jsx`) ở root level cho cả page navigation

### Vấn đề shell
1. 🔴 **Hero header chiếm ~120-140px** — eyebrow + title to + role pill + info icon + user pill + Ctrl+K search → quá nhiều thông tin redundant với sidebar.
2. 🔴 **WorkflowGuide banner ~200-250px** trên mỗi page (configurable) — UX audit đã yêu cầu xoá toàn bộ nhưng **chưa thực hiện**. File `AppShellWorkflowGuide.jsx` vẫn còn.
3. 🟠 **Sidebar quá nhiều text**: mỗi nav item có `label` + `caption` (tooltip dài 1-2 dòng). Khi sidebar mở, tổng text ~600 dòng. Cần ẩn caption mặc định, chỉ show tooltip on hover.
4. 🟠 **Compact status panel** trong sidebar (`ds-app-shell__compact-status`, line 150-157) lặp lại tiêu đề tab → redundant.
5. 🟡 Brand "Golden Logistics" + "Ops shell" pills trên header chiếm slot quan trọng nhưng không actionable.

---

## 5. Information Architecture hiện tại

**File**: `@/src/lib/appShellNavigation.ts:44-195`

```
TỔNG QUAN (overview)
└── Tổng quan KPI (dashboard)
VẬN HÀNH (operations)
├── Gán MST (mst)
├── Import Data (import)
└── Đại Lý HQ (hq)
HIỆU SUẤT (performance)
├── Quản lý Tổ đội (teams)
├── Quy tắc KPI (rules)
├── Điểm KPI +/- Thêm (adjustments)
└── Báo cáo KPI (reports)
GIÁM SÁT (observability)
├── Sức khỏe dữ liệu (health) [permission gated]
└── Trợ lý AI (ai) [permission gated]
QUẢN TRỊ (governance)
├── Tài khoản (accounts) [admin only]
├── Nhật ký (audit) [audit role]
└── Lịch sử export (export-audit) [audit role]
```

### Vấn đề IA
| # | Vấn đề | Đánh giá |
|---|--------|----------|
| IA-1 | "Đại Lý HQ" và "Gán MST" tách rời, cùng ngữ cảnh đối tác | 🟠 nên gộp |
| IA-2 | "Điểm KPI +/- Thêm" nằm cùng "Báo cáo KPI" (chỉ đọc) — sai mental model | 🟠 |
| IA-3 | Section "Giám sát" chỉ 2 tab — quá ít | 🟡 |
| IA-4 | Tooltip mỗi tab dài 1-2 dòng, hiển thị hết trong sidebar khi mở | 🟠 |
| IA-5 | Section descriptions ("Điểm vào mặc định để nắm sức khỏe...") chiếm 2-3 dòng trong sidebar | 🟠 |

### IA đề xuất (final, cho slice 7)

```
TỔNG QUAN
└── Dashboard
VẬN HÀNH
├── Import Data
├── Gán MST & Đại lý HQ   ← gộp 2 tab cũ thành tabs trong page
└── Sức khỏe dữ liệu       ← di chuyển từ Giám sát
CẤU HÌNH
├── Tổ đội
├── Quy tắc KPI
└── Điều chỉnh KPI +/-     ← tách khỏi Báo cáo
BÁO CÁO
├── Report Center           (chi tiết only)
└── Lịch sử export
QUẢN TRỊ
├── Tài khoản
├── Nhật ký
└── Trợ lý AI
```

---

## 6. Đã làm (TS-UI-REDESIGN-PLAN.md)

| Phase | Trạng thái | Ghi chú |
|-------|-----------|---------|
| Phase 0 — Foundation | ✅ | tsconfig + tokens merge |
| Phase 1 — Design system | ✅ | shellPrimitives, primitives, 45 shadcn components → .tsx |
| Phase 2 — Core shell | ✅ | AppShellFrame, KPICalculator, App, ThemeProvider, ThemeToggle, NotificationCenter, CommandCenter |
| Phase 3 — Pages | ✅ | 17 page components → .tsx |
| Phase 4 — Cleanup | ✅ | Build pass, 299/390 test files pass |
| **Phase A** (UX audit) | ✅ | Dashboard KPI overview hook + widgets đã có (`useDashboardKpiOverview`, `ReportingExecutiveSummaryPanel`, `SummaryCard`, `TrendLineChart`, `TeamPieWidget`) |
| **Phase B** (Quick wins) | ❌ | Workflow guide chưa xoá, primary buttons chưa chuẩn hoá, date format chưa đồng nhất |
| **Phase C** (Page restructure) | ❌ | Trang nào cũng scroll dài, chưa có tabs trong page |
| **Phase D** (Shared components) | ❌ | PageHeader, FilterBar, ExportDropdown, EmptyState chuẩn chưa có |

→ **Plan này tập trung làm Phase B + C + D + thêm các điểm phát hiện mới**.

---

## 7. Test infrastructure

- **Frontend tests**: `tests/*.jsx` (410 files) chạy bằng vitest + jsdom + AppDialogProvider wrapper
- **Backend tests**: `tests/server*.test.js` chạy environment node
- **Playwright runtime tests**: `tests/playwright/*.spec.js` cho smoke flow
- **Setup**: `vitest.setup.js` (4.2KB) mock window/storage

### Tình trạng test gần nhất (test-output.txt)
- `tests/ConflictResolutionDialog.test.jsx` 5 tests fail vì `getByRole("dialog")` trả về multiple elements (test query syntax cũ)
- 6 infrastructure failures (resolved trong i18n changes)
- ~24 i18n-related test assertion updates needed

→ **Plan slice 8** sẽ refactor các test này theo cấu trúc DOM mới + thêm test cho component mới.

---

## 8. RTK / GitNexus / Beads — đã sẵn sàng

- **RTK** (`C:\Users\PC\.local\bin\rtk.exe`): luôn prefix mọi shell command. Tiết kiệm 60-90% token.
- **GitNexus** index: `kpi_source_code_v4` — 5590 symbols, 18025 relationships, 300 execution flows. **Bắt buộc** chạy `gitnexus_impact` trước khi sửa hàm/class.
- **Beads** (`bd`) prefix `cng`: mọi task mới phải tạo bead. Sau khi xong, đánh dấu close + sync.
- **task.md** (215KB): "sổ tay" trí nhớ, mỗi slice update `Active Slice` + `Handoff` + `Discipline Log`.

---

## 9. Build & verify commands

```powershell
# Typecheck (đã pass)
rtk pnpm run typecheck:frontend

# Test frontend  
rtk pnpm run test:frontend

# Build (sản xuất)
rtk pnpm build

# Smoke (core)
rtk pnpm run test:smoke:frontend-core

# GitNexus impact
# (qua MCP tool — không phải shell command)
gitnexus_impact({target: "<symbol>", direction: "upstream"})
```

→ Mỗi slice phải verify pass trước khi đóng.
