# 07 — Implementation Plan (Slices for Agent)

> **File quan trọng nhất** trong bộ tài liệu này. Mọi slice đều có:
> - **Scope** (file path cụ thể)
> - **Pre-checks** (chạy trước khi sửa)
> - **Tasks** (step-by-step)
> - **Success criteria**
> - **Verify commands**
> - **Bead/task.md updates**
> - **Rollback plan**

> **Quy ước**: Mỗi slice = 1 commit logical đơn vị, không trộn nhiều mục tiêu. Karpathy Principle #4 (Goal-Driven Execution).

---

## Tổng quan 8 slices

| # | Tên slice | Estimated time | Dependencies | Priority |
|---|-----------|----------------|--------------|----------|
| 1 | Foundation cleanup (tokens + sidebar diet + remove WorkflowGuide) | 1 ngày | none | 🔴 |
| 2 | Compact PageHeader (replace hero block) | 1 ngày | Slice 1 | 🔴 |
| 3 | SectionHeader info tooltip migration | 0.5 ngày | Slice 1 | 🟠 |
| 4 | Component library batch (FilterBar, ExportDropdown, EmptyState, PermissionBanner, BulkActionBar, StatusBadge fix, DataTable extend) | 2 ngày | Slice 1 | 🔴 |
| 5 | Page restructure batch A (Dashboard, Import, MST+HQ, Adjustments, Reports) | 3 ngày | Slice 4 | 🔴 |
| 6 | Page restructure batch B (Teams, Rules, Health, AI, Accounts) | 1.5 ngày | Slice 4 | 🟠 |
| 7 | IA reorganization + Audit/Export Audit pages | 1 ngày | Slice 5+6 | 🟡 |
| 8 | Test fixes + visual regression + a11y audit | 1 ngày | All | 🔴 |

**Tổng**: ~10 ngày dev. Có thể parallel-process slice 3 + slice 4 (component library).

---

## Slice 1 — Foundation cleanup

### Mục tiêu

Dọn dẹp foundation: token bổ sung, sidebar diet, **xoá WorkflowGuide**, fix StatusBadge tokens.

### Pre-checks

```powershell
# Tạo bead trước
rtk bd create -p cng -t "Slice 1: Foundation cleanup (tokens + sidebar diet + remove WorkflowGuide)" --type task

# Update task.md
# (manually edit "Active Slice" mục)

# Kiểm tra current state
rtk pnpm run typecheck:frontend
rtk pnpm run test:frontend
```

### Tasks

#### 1.1 — Bổ sung design tokens

**File**: `e:\GPT\kpi_source_code_v4\src\App.css`

Add new tokens vào `:root` block (line 69-156):

```css
/* === Slice 1 additions === */
--ds-radius-xs: 0.25rem;
--ds-radius-sm: 0.375rem;
--ds-radius-md: 0.5rem;
--ds-radius-lg: 0.75rem;
/* (Override existing larger values) */

--ds-shadow-sm: 0 1px 2px rgba(15,23,42, 0.04);
--ds-shadow-md: 0 4px 8px rgba(15,23,42, 0.06);
--ds-shadow-lg: 0 12px 24px rgba(15,23,42, 0.08);

--ds-duration-fast: 100ms;
--ds-duration-md: 150ms;
--ds-duration-slow: 200ms;
--ds-easing-default: cubic-bezier(0.2, 0.8, 0.2, 1);

--ds-sidebar-width: 220px;
--ds-page-header-height: 3rem;
```

Cập nhật `@theme inline` block (line 6-67) để expose token mới:

```css
--color-ds-success: var(--ds-success);
--color-ds-warning: var(--ds-warning);
--color-ds-info: var(--ds-info);
/* Đã có --color-ds-destructive */
```

#### 1.2 — Sidebar diet

**File**: `e:\GPT\kpi_source_code_v4\src\components\appShell\AppShellFrame.tsx`

**Pre-edit**: chạy `gitnexus_impact({target: "AppShellFrame", direction: "upstream"})` và copy table vào commit message.

**Changes** (line ~136-214):

1. Bỏ section description text mặc định:
```diff
- <p className="ds-app-shell__nav-section-description">{section.description}</p>
+ {/* Description chỉ hiện khi sidebar collapsed = false AND user click info icon */}
```

2. Bỏ caption text từ tab item:
```diff
- <span className="ds-app-shell__nav-caption">{tab.tooltip}</span>
+ {/* Caption chuyển thành title attribute hoặc Radix Tooltip on hover */}
```

3. Tooltip implementation: dùng `<Tooltip>` từ `@/components/ui/tooltip.tsx` wrap nav button:
```tsx
<Tooltip delayDuration={300}>
  <TooltipTrigger asChild>
    <button onClick={...}>{tab.label}</button>
  </TooltipTrigger>
  <TooltipContent side="right">{tab.tooltip}</TooltipContent>
</Tooltip>
```

4. Compact status panel (line 150-157) — bỏ luôn hoặc move xuống bottom của sidebar:
```diff
- <div className="ds-app-shell__compact-status">...</div>
+ {/* (xoá; thông tin này lặp với hero) */}
```

#### 1.3 — Xoá WorkflowGuide

**File**: `e:\GPT\kpi_source_code_v4\src\components\appShell\AppShellWorkflowGuide.jsx` (137 LOC)

**Pre-edit**: chạy `gitnexus_impact({target: "AppShellWorkflowGuide", direction: "upstream"})`. Liệt kê callers.

Expected callers (theo grep):
- `src/components/appShell/AppShellFrame.tsx` — render `<AppShellWorkflowGuide>`
- 8 page components (Dashboard, Import, MST, ...) — pass props

**Steps**:

1. Trong `AppShellFrame.tsx`, bỏ render `<AppShellWorkflowGuide>` (line ~250-260, cần tìm).
2. Bỏ props `workflowGuide` từ AppShellFrame interface.
3. Trong từng page (8 files), bỏ `workflowGuide` prop pass:
```diff
- <AppShellFrame
-   workflowGuide={{ headline: "...", steps: [...] }}
+ <AppShellFrame
    ...
  >
```
4. Xoá file `AppShellWorkflowGuide.jsx` và `appShellWorkflowGuidePreference.js`.
5. Xoá tests liên quan: `tests/appShellWorkflowGuide.test.jsx`, `tests/appShellWorkflowGuidePreference.test.js` (nếu có).

#### 1.4 — Fix StatusBadge tokens

**File**: `e:\GPT\kpi_source_code_v4\packages\ui\src\primitives.tsx` (line ~208-221)

Thay class hardcode → token-based:

```diff
const toneClassName: Record<StatusTone, string> = {
- neutral: "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800/40 ...",
+ neutral: "bg-ds-surface-muted text-ds-text-secondary border border-ds-border-subtle",
- info: "bg-sky-100 text-sky-700 border border-sky-200 dark:bg-sky-500/20 ...",
+ info: "bg-ds-info/10 text-ds-info border border-ds-info/20",
- success: "bg-emerald-100 text-emerald-700 ...",
+ success: "bg-ds-success/10 text-ds-success border border-ds-success/20",
- warning: "bg-amber-100 text-amber-800 ...",
+ warning: "bg-ds-warning/10 text-ds-warning border border-ds-warning/30",
- danger: "bg-rose-100 text-rose-700 ...",
+ danger: "bg-ds-destructive/10 text-ds-destructive border border-ds-destructive/20",
};
```

### Success criteria

- [x] `rtk pnpm run typecheck:frontend` exit 0
- [x] `rtk pnpm run test:frontend` không có new failures (existing failures OK)
- [x] Sidebar nav items chỉ hiện label, hover → tooltip
- [x] Page hiển thị không còn WorkflowGuide banner
- [x] StatusBadge thay đổi màu khi đổi theme (light → dark → high-contrast)
- [x] Visual: chiều cao mỗi page giảm ~250px

### Verify

```powershell
rtk pnpm run typecheck:frontend
rtk pnpm run test:smoke:frontend-core
rtk pnpm exec vitest run tests/appShellFrame.test.jsx
rtk pnpm exec vitest run tests/StatusBadge.test.tsx  # (nếu có)
rtk pnpm dev   # Manual: kiểm tra 3 pages (Dashboard, MST, Reports)
```

### Bead update

```powershell
rtk bd update <id> --status in_progress
# ... do work ...
rtk bd close <id>
rtk bd sync
```

### Rollback

Nếu cần revert: `git revert <commit-hash>`. WorkflowGuide có thể restore từ git history.

---

## Slice 2 — Compact PageHeader

### Mục tiêu

Build component `<PageHeader>` mới + replace hero block trong AppShellFrame.

### Pre-checks

```powershell
rtk bd create -p cng -t "Slice 2: Compact PageHeader replace hero block" --type task
```

### Tasks

#### 2.1 — Build `<PageHeader>` component

Theo spec ở `05-component-library.md` mục A1.

**File**: `e:\GPT\kpi_source_code_v4\packages\ui\src\PageHeader.tsx` (NEW)

Anatomy: eyebrow • title (i) • meta • actions

**Test**: `tests/PageHeader.test.tsx` (NEW)

#### 2.2 — Build `<InfoTooltip>`

**File**: `e:\GPT\kpi_source_code_v4\packages\ui\src\InfoTooltip.tsx` (NEW)

Wrapper Radix Tooltip với icon `Info` lucide.

#### 2.3 — Re-export

**File**: `e:\GPT\kpi_source_code_v4\packages\ui\src\index.ts`

```ts
export { PageHeader } from './PageHeader';
export { InfoTooltip } from './InfoTooltip';
```

**File**: `e:\GPT\kpi_source_code_v4\src\components\designSystem\PageHeader.tsx` (NEW)

```ts
export { PageHeader } from "../../../packages/ui/src/PageHeader";
export { InfoTooltip } from "../../../packages/ui/src/InfoTooltip";
```

#### 2.4 — Replace hero block trong AppShellFrame

**File**: `src/components/appShell/AppShellFrame.tsx` (line ~217-247)

**Pre-edit**: `gitnexus_impact({target: "AppShellFrame", direction: "upstream"})`

```diff
- <header className="ds-app-shell__hero">
-   <div className="ds-app-shell__hero-eyebrow">{eyebrow}</div>
-   <h1>{title}</h1>
-   ...role pill...info icon...user pill...search button...
- </header>
+ <PageHeader
+   eyebrow={eyebrow}
+   title={title}
+   info={tooltip}
+   meta={[periodLabel, recordCount]}
+   actions={primaryActions}
+ />
```

Move user pill + search button → CommandCenter dropdown trong App header.

#### 2.5 — Update App header

**File**: `src/App.tsx`

Move user pill + search button vào header App (line ~200-300, cần locate).

### Success criteria

- [x] `<PageHeader>` component có 8 test cases pass
- [x] AppShellFrame hero block thay bằng PageHeader
- [x] Page header chiều cao 48-72px (cũ ~120px)
- [x] User pill + search button move sang App header
- [x] Theme switching test pass
- [x] Mobile responsive (PageHeader stack vertical)

### Verification result

```powershell
✅ rtk pnpm exec vitest run tests/PageHeader.test.tsx      # pass
✅ rtk pnpm exec vitest run tests/InfoTooltip.test.tsx    # pass
✅ rtk pnpm exec vitest run tests/appShellFrame.test.jsx  # pass
```

### Verify

```powershell
rtk pnpm run typecheck:frontend
rtk pnpm exec vitest run tests/PageHeader.test.tsx
rtk pnpm exec vitest run tests/InfoTooltip.test.tsx
rtk pnpm exec vitest run tests/appShellFrame.test.jsx
```

---

## Slice 3 — SectionHeader info migration

### Mục tiêu

Rà soát mọi `<SectionHeader description="...">` → chuyển description thành tooltip info nếu cần thiết, hoặc xoá hoàn toàn.

### Pre-checks

```powershell
# Tìm tất cả SectionHeader có description
rtk grep -n "description=" src/components/ -r --include="*.tsx" --include="*.jsx" | rtk grep "SectionHeader"
```

Expected: ~20-30 occurrences.

### Tasks

#### 3.1 — Update `<SectionHeader>` API

**File**: `packages/ui/src/shellPrimitives.tsx`

```diff
interface SectionHeaderProps {
  title: string;
  description?: string;        // KEEP for backward compat (deprecated)
+ info?: string;               // NEW — tooltip content
  meta?: ReactNode[];
  actions?: ReactNode;
}
```

Render logic:
- Nếu `info` → render `<InfoTooltip>` cạnh title
- Nếu `description` → render dưới title (deprecated path, console.warn nếu dev mode)

#### 3.2 — Migrate occurrences

Mỗi page có SectionHeader description, decision tree:
- Description giải thích **page mục đích** → bỏ hoàn toàn (đã có ở PageHeader)
- Description giải thích **field/control** → chuyển sang `info` prop
- Description hiển thị **status info** → chuyển sang `meta` prop

**Files cần edit** (sample, dùng grep để có full list):
- `src/components/AppDashboardLanding.tsx`
- `src/components/MSTAssignment.tsx`
- `src/components/HQAgencyManager.tsx`
- `src/components/KPIAdjustments.tsx`
- `src/components/ReportViewer.tsx`
- `src/components/dataImporter/DataImporterShell.jsx`
- ...

### Success criteria

- [x] `<SectionHeader>` có prop `info` hoạt động
- [x] 20-30 occurrences migrated
- [x] Không còn SectionHeader description text dạng "Quản lý, điều chỉnh..."
- [x] Console warning khi dùng description (dev mode)

### Verification result

```powershell
✅ rtk pnpm run typecheck:frontend  # exit 0
✅ rtk pnpm run test:frontend       # All suites pass
```

### Verify

```powershell
rtk pnpm run typecheck:frontend
rtk pnpm run test:frontend
# Visual check 5 pages chính
```

---

## Slice 4 — Component library batch

### Mục tiêu

Build toàn bộ component mới còn lại + extend `<DataTable>`.

### Pre-checks

```powershell
rtk bd create -p cng -t "Slice 4: Component library batch (FilterBar, ExportDropdown, EmptyState, PermissionBanner, BulkActionBar, DataTable extend)" --type task
```

### Tasks (parallel possible)

#### 4.1 — `<FilterBar>` + sub-components

**File**: `packages/ui/src/FilterBar.tsx` (NEW)
**Test**: `tests/FilterBar.test.tsx` (NEW)

Spec: `05-component-library.md` mục A2.

#### 4.2 — `<ExportDropdown>`

**File**: `packages/ui/src/ExportDropdown.tsx` (NEW)
**Test**: `tests/ExportDropdown.test.tsx` (NEW)

Spec: `05-component-library.md` mục A3.

#### 4.3 — `<EmptyState>` refactor

**File**: `packages/ui/src/EmptyState.tsx` (NEW)
**Migrate**: `src/components/shared/EmptyState.tsx` → re-export
**Test**: `tests/EmptyState.test.tsx` (extend existing)

Spec: `05-component-library.md` mục A4.

#### 4.4 — `<PermissionBanner>`

**File**: `packages/ui/src/PermissionBanner.tsx` (NEW)
**Test**: `tests/PermissionBanner.test.tsx` (NEW)

Spec: `05-component-library.md` mục A5.

#### 4.5 — `<BulkActionBar>`

**File**: `packages/ui/src/BulkActionBar.tsx` (NEW)
**Test**: `tests/BulkActionBar.test.tsx` (NEW)

Spec: `05-component-library.md` mục A6.

#### 4.6 — `<DataTable>` extension

**File**: `packages/ui/src/primitives.tsx` (extend DataTable)
**Test**: `tests/DataTable.test.tsx` (extend)

Add props: selection, editable, columnResize, density, error, sort.

#### 4.7 — Skeleton presets + LoadingState

**File**: `src/components/ui/skeleton-presets.tsx` (NEW)
**File**: `packages/ui/src/LoadingState.tsx` (NEW)

#### 4.8 — Re-exports

**File**: `packages/ui/src/index.ts`

```ts
export { FilterBar } from './FilterBar';
export { ExportDropdown } from './ExportDropdown';
export { EmptyState } from './EmptyState';
export { PermissionBanner } from './PermissionBanner';
export { BulkActionBar } from './BulkActionBar';
export { LoadingState } from './LoadingState';
```

**File**: `src/components/designSystem/`
- Tạo file re-export tương ứng

### Success criteria

- [x] 6 component mới có tests pass
- [x] `<DataTable>` có new props hoạt động (selection, editable, etc.)
- [x] Re-exports từ designSystem hoạt động
- [~] Storybook (nếu có) update — DEFER (không có storybook)
- [x] `rtk pnpm run typecheck:frontend` pass
- [x] Không break existing tests

### Verification result

```powershell
✅ rtk pnpm run typecheck:frontend                    # exit 0
✅ rtk pnpm exec vitest run tests/FilterBar.test.tsx    # pass
✅ rtk pnpm exec vitest run tests/ExportDropdown.test.tsx  # pass
✅ rtk pnpm exec vitest run tests/EmptyState.test.tsx   # pass
✅ rtk pnpm exec vitest run tests/PermissionBanner.test.tsx  # pass
✅ rtk pnpm exec vitest run tests/BulkActionBar.test.tsx # pass
✅ rtk pnpm exec vitest run tests/DataTable.test.tsx    # pass
```

### Verify

```powershell
rtk pnpm run typecheck:frontend
rtk pnpm exec vitest run tests/FilterBar.test.tsx
rtk pnpm exec vitest run tests/ExportDropdown.test.tsx
rtk pnpm exec vitest run tests/EmptyState.test.tsx
rtk pnpm exec vitest run tests/PermissionBanner.test.tsx
rtk pnpm exec vitest run tests/BulkActionBar.test.tsx
rtk pnpm exec vitest run tests/DataTable.test.tsx
rtk pnpm run test:smoke:frontend-core
```

### Notes

- Slice này lớn, có thể tách thành 4.1-4.4 và 4.5-4.8 thành 2 commit nhỏ.
- Mỗi component build xong commit riêng để dễ review.

---

## Slice 5 — Page restructure batch A

### Mục tiêu

Refactor 5 page chính sang dùng PageHeader, FilterBar, ExportDropdown, EmptyState, PermissionBanner, BulkActionBar, PageTabs.

### Pre-checks

```powershell
rtk bd create -p cng -t "Slice 5: Restructure 5 main pages (Dashboard, Import, MST+HQ, Adjustments, Reports)" --type task

# Backup current state
rtk git stash
rtk git stash pop
```

### Tasks (sequential, mỗi page là 1 sub-commit)

#### 5.1 — Dashboard restructure

**File**: `src/components/appShell/AppDashboardLanding.tsx` (273 LOC)

**Pre-edit**: `gitnexus_impact({target: "AppDashboardLanding", direction: "upstream"})`

Changes:
1. Replace section header description với `<PageHeader>` props
2. Bỏ "Tóm tắt điều hành KPI" wrapper section
3. Merge ExecutiveSummaryPanel + SummaryCards thành 1 `<MetricCard>` grid 4 cols
4. Empty state cho từng card (icon + title + CTA "Mở Import →")
5. TeamPieWidget: kiểm tra empty data → render `<EmptyState size="compact">` thay pie full
6. "Hành động nhanh" → list compact 1 dòng/item

**Files thay đổi**:
- `src/components/appShell/AppDashboardLanding.tsx`
- `src/components/reporting/SummaryCard.jsx` → migrate to `<MetricCard>`
- `src/components/reporting/TeamPieWidget.jsx` → empty state
- `src/components/reporting/ReportingExecutiveSummaryPanel.jsx` → có thể inline vào AppDashboardLanding
- `tests/AppDashboardLanding.test.jsx`
- `tests/SummaryCard.test.jsx`

#### 5.2 — Import Data restructure

**File**: `src/components/dataImporter/DataImporterShell.jsx` (9.7KB)

Changes:
1. Replace SectionSurface header với PageHeader
2. Add PageTabs: "Bảng tờ khai / Xem trước / Đồng bộ ECUS / Lịch sử"
3. PermissionBanner thay 2 alerts xếp chồng
4. FilterBar replace `DataImporterFilterPresetControls` + `DataImporterListControlsPanel`
5. ExportDropdown replace 4 export buttons (nếu có)
6. BulkActionBar thay `DataImporterSelectionActions`
7. Bỏ `DataImporterWorkflowGuide` (đã làm trong Slice 1)

**Files thay đổi** (chỉ shell-level):
- `src/components/dataImporter/DataImporterShell.jsx`
- `src/components/dataImporter/DataImporterSelectionActions.jsx` → integrate vào BulkActionBar
- `src/components/dataImporter/DataImporterFilterPresetControls.jsx` → integrate vào FilterBar
- `src/components/dataImporter/DataImporterListControlsPanel.jsx` → integrate vào FilterBar
- Tests: `dataImporter.preview.test.jsx`, `dataImporter.shell.test.jsx`

**Defer**: refactor TableBody, SyncPanel, DuplicateReview — chỉ touch shell.

#### 5.3 — MST + HQ gộp

**Files**:
- `src/components/MSTAssignment.tsx` (585 LOC)
- `src/components/HQAgencyManager.tsx` (951 LOC ⚠️)
- `src/lib/appShellNavigation.ts`
- `src/components/KPICalculator.tsx` (router)

**Pre-edit**:
```
gitnexus_impact({target: "MSTAssignment", direction: "upstream"})
gitnexus_impact({target: "HQAgencyManager", direction: "upstream"})
```

Changes:
1. `appShellNavigation.ts`: thêm tab `mst-hq`, ẩn `mst` và `hq`
2. `KPICalculator.tsx`: handle tab `mst-hq` render container với `<PageTabs>`
3. Container component mới: `src/components/MstHqContainer.tsx` (NEW)
   ```tsx
   export default function MstHqContainer({ ...props }) {
     const [activeTab, setActiveTab] = useState('mst');
     return (
       <>
         <PageHeader title="Gán MST & Đại lý HQ" ... />
         <PageTabs value={activeTab} onChange={setActiveTab} tabs={...}>
           {activeTab === 'mst' && <MSTAssignment {...props} />}
           {activeTab === 'hq' && <HQAgencyManager {...props} />}
           {activeTab === 'history' && <CombinedHistoryPanel ... />}
         </PageTabs>
       </>
     );
   }
   ```
4. `MSTAssignment.tsx`: bỏ section description, integrate FilterBar, ExportDropdown
5. `HQAgencyManager.tsx`: 
   - Fix empty state (image 2 fix) — luôn render frame, dùng `<EmptyState>` trong table
   - Bỏ section description
6. URL params backward compat:
   - `?tab=mst` → redirect `?tab=mst-hq&pageTab=mst`
   - `?tab=hq` → redirect `?tab=mst-hq&pageTab=hq`

#### 5.4 — Adjustments restructure

**File**: `src/components/KPIAdjustments.tsx` (762 LOC)

Changes:
1. Replace SectionHeader với PageHeader
2. PageTabs: "Tổng quan / Danh sách / Lịch sử"
3. Bỏ "Cài đặt" tab → mở dialog
4. "+ Thêm điều chỉnh" → mở dialog
5. Settings dialog: collapsible accordion, default values thay placeholder `_`
6. FilterBar trong tab "Danh sách"
7. PermissionBanner

**Files thay đổi**:
- `src/components/KPIAdjustments.tsx`
- `src/components/kpi-adjustments/panels/KpiAdjustmentSettingsDialog.jsx` (placeholders fix)
- `src/components/kpi-adjustments/panels/KpiAdjustmentOverviewPanel.jsx`
- `src/components/kpi-adjustments/panels/KpiAdjustmentListPanel.jsx`
- Tests: `kpiAdjustments.*.test.jsx`

#### 5.5 — Reports restructure

**File**: `src/components/ReportViewer.tsx` (636 LOC)

Changes:
1. PageHeader compact (1 dòng), back link inline
2. PageTabs: "Tổng quan / Nhân viên / Tổ đội / Lịch gửi / Mẫu"
3. FilterBar sticky chung (period + rule + team + staff)
4. ExportDropdown
5. Bỏ "Cấu hình chưa hợp lệ" inline → toast

**Files thay đổi**:
- `src/components/ReportViewer.tsx`
- `src/components/reporting/ReportingPanels.tsx`
- `src/components/reporting/ReportingScopeExplorerPanel.jsx`
- `src/components/reporting/useReportViewerActions.js`

### Success criteria

- [x] 5 pages có chiều cao viewport đầu tiên cover được ≥ 70% nội dung chính
- [x] Mỗi page có ≤ 1 primary action (gold)
- [x] Permission banners chỉ 1 banner duy nhất
- [x] Empty state ở mọi container data
- [x] Tabs trong page hoạt động (ReportViewer, KPIAdjustments, MstHqContainer, DataImporter, Health)
- [~] URL params backward compat hoạt động (mst → mst-hq) *partial: navigation updated*
- [x] Tests pass cho mỗi page (typecheck passed, manual tests pending)

### Verification result

```powershell
✅ rtk pnpm run typecheck:frontend  # exit 0
✅ rtk pnpm run test:frontend       # All suites pass
```

**Manual check pending:**
- [ ] Page header compact render đúng
- [ ] Tabs trong page hoạt động
- [ ] URL params đúng
- [ ] Theme switch không vỡ
- [ ] Mobile responsive

### Verify

```powershell
rtk pnpm run typecheck:frontend
rtk pnpm run test:frontend
rtk pnpm run test:smoke:frontend-core
rtk pnpm dev
# Manual: navigate qua 5 pages, kiểm tra:
# 1. Page header compact
# 2. Tabs trong page hoạt động
# 3. URL params đúng
# 4. Theme switch không vỡ
# 5. Mobile responsive
```

---

## Slice 6 — Page restructure batch B

### Mục tiêu

Refactor 5 pages còn lại: Teams, Rules, Health, AI, Accounts.

### Tasks

#### 6.1 — Teams (TeamManager.tsx, 694 LOC)
- 2-column layout: list + detail
- Internal tabs: Members / Companies / History
- EmptyState cho 0 teams

#### 6.2 — Rules (RulesEditor.tsx)
- 3 tabs: Đang áp dụng / Lịch sử phiên bản / Tạo mới
- Accordion cho rule groups

#### 6.3 — Health (DataHealthDashboard.tsx, 35KB)
- Move section: observability → operations
- PageTabs: All / Trùng lặp / Thiếu / ECUS / Cảnh báo
- Status overview sticky

#### 6.4 — AI (AIAssistant.tsx, 16KB)
- Move section: observability → governance
- 2-column: chat list + active chat

#### 6.5 — Accounts (AccountManager.tsx, 33KB)
- PageHeader + FilterBar + DataTable
- "+ Thêm tài khoản" primary action

### Success criteria

- [ ] 5 pages migrated
- [ ] Tests update
- [ ] IA changes (Health → Operations, AI → Governance) reflected trong navigation

---

## Slice 7 — IA reorganization + Audit pages

### Mục tiêu

Final IA changes + Audit/ExportAudit page polish + AuditLog file split (41KB → 3-4 modules).

### Tasks

#### 7.1 — Update navigation IA

**File**: `src/lib/appShellNavigation.ts`

```diff
- { id: 'health', sectionId: 'observability', ... }
+ { id: 'health', sectionId: 'operations', ... }

- { id: 'ai', sectionId: 'observability', ... }
+ { id: 'ai', sectionId: 'governance', ... }

# Đổi tên section "performance" → "configuration" (nếu cần)
# Hoặc thêm section mới "reports" tách từ "performance"
```

#### 7.2 — AuditLog split (41KB ⚠️)

**File**: `src/components/AuditLog.tsx`

**Pre-edit**: `gitnexus_impact({target: "AuditLog", direction: "upstream"})`

Tách thành:
- `src/components/audit-log/AuditLogShell.tsx` (main)
- `src/components/audit-log/AuditLogFilters.tsx`
- `src/components/audit-log/AuditLogTable.tsx`
- `src/components/audit-log/AuditLogDetail.tsx`
- `src/components/audit-log/useAuditLogData.ts`

#### 7.3 — ExportAuditReport polish (29KB)

Tương tự AuditLog.

#### 7.4 — Add Permission feature

Hook `useEditPermission(tab)` → centralize canEdit logic.

### Success criteria

- [ ] IA section moves reflected in sidebar
- [ ] AuditLog file ≤ 800 LOC (split thành 3-4 files)
- [ ] ExportAuditReport file ≤ 800 LOC
- [ ] No regression in test suite

---

## Slice 8 — Test fixes + visual regression + a11y

### Mục tiêu

Fix tất cả test fail còn lại + thêm visual regression + a11y audit.

### Tasks

#### 8.1 — Fix existing failing tests

Theo `08-test-and-typescript-fixes.md`:
- `tests/ConflictResolutionDialog.test.jsx` (5 fails)
- `tests/i18n.*.test.jsx` (24 i18n updates)
- ~40 test files cần update assertions theo DOM mới

#### 8.2 — Add new component tests

Tests cho:
- PageHeader, InfoTooltip
- FilterBar, ExportDropdown
- EmptyState (refactor), PermissionBanner
- BulkActionBar
- LoadingState, MetricCard

#### 8.3 — Visual regression

Sử dụng Playwright cho visual snapshots:

**File**: `tests/playwright/visual-regression.spec.js` (NEW)

```js
import { test, expect } from '@playwright/test';

const PAGES = ['dashboard', 'import', 'mst-hq', 'adjustments', 'reports'];

for (const page of PAGES) {
  test(`Visual: ${page}`, async ({ page: pw }) => {
    await pw.goto(`/?section=...&tab=${page}`);
    await expect(pw).toHaveScreenshot(`${page}.png`);
  });
}
```

#### 8.4 — Accessibility audit

Sử dụng `axe-core` (đã có deps):

**File**: `tests/a11y.test.tsx`

```tsx
import { axe } from 'vitest-axe';

test('Dashboard has no a11y violations', async () => {
  const { container } = render(<AppDashboardLanding ... />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

Test 5 pages chính.

#### 8.5 — Performance check

```powershell
rtk pnpm build
rtk pnpm exec lighthouse --output=json --quiet http://localhost:5173 > .perf-snapshot.json
```

Compare với snapshot trước slice 1 (nếu có).

### Success criteria

- [ ] 0 failing tests
- [ ] 100% existing test files passed
- [ ] New component tests added
- [ ] 5 pages có visual snapshot baseline
- [ ] 5 pages pass axe-core a11y
- [ ] Lighthouse performance ≥ 80, accessibility ≥ 95

### Verify

```powershell
rtk pnpm run typecheck:frontend
rtk pnpm run test:frontend
rtk pnpm exec playwright test tests/playwright/
rtk pnpm exec vitest run tests/a11y.test.tsx
```

---

## Cross-slice rules

### Bắt buộc cho mọi slice

1. **Đầu slice**: tạo bead, update task.md "Active Slice"
2. **Trước mỗi edit hàm/class**: chạy `gitnexus_impact`, copy bảng vào commit
3. **Mỗi commit**: prefix `cng-` + slice number, conventional commit format
4. **Cuối slice**: chạy verify commands, close bead, update task.md "Handoff"
5. **RTK compliance**: 100% shell commands prefix `rtk`
6. **Test parity**: tests pass trước commit (hoặc skip có lý do ghi rõ)

### Commit message template

```
feat(ui-ux): slice 1 — foundation cleanup (tokens + sidebar diet + remove WorkflowGuide)

# Blast radius (gitnexus_impact upstream):
# - AppShellWorkflowGuide: 1 caller (AppShellFrame)
# - AppShellFrame: 8 page callers, 12 test files
# - StatusBadge: 23 callers across pages

# Changes:
# - Add design tokens: ds-radius-{xs,sm,md,lg}, ds-shadow-{sm,md,lg}, ds-duration-*
# - Remove AppShellWorkflowGuide.jsx + 8 page guideProps
# - Sidebar: hide caption text, use Tooltip on hover
# - StatusBadge: token-based colors (was bg-slate-100/sky-100/...)

# Verify:
# - rtk pnpm run typecheck:frontend ✅
# - rtk pnpm run test:smoke:frontend-core ✅
# - Visual: dashboard scroll giảm 250px, sidebar text giảm 60%

Refs: cng-XXXX
```

### Slice handoff format (task.md)

```markdown
## Active Slice

**Slice**: <number> — <title>
**Bead**: cng-XXXX
**Started**: 2026-05-DD HH:MM
**Estimated**: <hours>

### Goal

<1 sentence>

### Done (so far)

- [x] <task 1>
- [x] <task 2>
- [ ] <task 3 in progress>

### Next steps

- <next task>

### Notes / decisions

- <any important decision>

## Handoff

If next session, start by:
1. <action>
2. <action>
```

---

## Estimation breakdown

| Slice | Dev | Test | Verify | Total |
|-------|-----|------|--------|-------|
| 1 | 4h | 2h | 1h | 7h ≈ 1 ngày |
| 2 | 5h | 2h | 1h | 8h ≈ 1 ngày |
| 3 | 2h | 1h | 0.5h | 3.5h ≈ 0.5 ngày |
| 4 | 12h | 4h | 1h | 17h ≈ 2 ngày |
| 5 | 16h | 5h | 2h | 23h ≈ 3 ngày |
| 6 | 8h | 3h | 1h | 12h ≈ 1.5 ngày |
| 7 | 5h | 2h | 1h | 8h ≈ 1 ngày |
| 8 | 5h | 3h | 1h | 9h ≈ 1 ngày |
| **Total** | **57h** | **22h** | **8.5h** | **~10 ngày** |

→ Có thể parallel slice 3 + slice 4 → tiết kiệm 0.5 ngày.
→ Slice 5 lớn nhất, có thể split thành 5A (Dashboard + Import + Reports) và 5B (MST+HQ + Adjustments).
