# 03 — Vấn đề từ source code thực tế (ngoài ảnh)

> Phần này dựa trên việc đọc trực tiếp toàn bộ frontend code, không chỉ 7 ảnh user cung cấp. Bao phủ tất cả 13 tabs + admin pages.

---

## A. Token system & color usage

### A1. `StatusBadge` không dùng tokens 🔴

**File**: `@/packages/ui/src/primitives.tsx:208-221`

```tsx
const toneClassName: Record<StatusTone, string> = {
  neutral: "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800/40 ...",
  info: "bg-sky-100 text-sky-700 border border-sky-200 dark:bg-sky-500/20 ...",
  success: "bg-emerald-100 text-emerald-700 ...",
  warning: "bg-amber-100 text-amber-800 ...",
  danger: "bg-rose-100 text-rose-700 ...",
};
```

**Root cause**: Hardcoded Tailwind utility colors (slate/sky/emerald/amber/rose) thay vì `--ds-*` semantic tokens.

**Tác động**: Theme `high-contrast` không hoạt động đúng cho badges. Theme switching sẽ không đổi màu badge.

**Fix (slice 4)**:
```tsx
const toneClassName: Record<StatusTone, string> = {
  neutral: "bg-ds-surface-muted text-ds-text-secondary border-ds-border-subtle",
  info: "bg-ds-info/10 text-ds-info border-ds-info/20",
  success: "bg-ds-success/10 text-ds-success border-ds-success/20",
  warning: "bg-ds-warning/10 text-ds-warning border-ds-warning/20",
  danger: "bg-ds-destructive/10 text-ds-destructive border-ds-destructive/20",
};
```

Cần thêm `--ds-info`, `--ds-success`, `--ds-warning` vào @theme block (đã có ở `:root` nhưng chưa export ra Tailwind utility — kiểm tra `@/src/App.css:46-66`).

### A2. AppShellWorkflowGuide hardcode `bg-slate-950` 🟠

**File**: `@/src/components/appShell/AppShellWorkflowGuide.jsx:15-19`

```jsx
className={`min-h-11 rounded-full px-3.5 py-2 text-sm font-medium transition ${
  isPrimary
    ? "bg-slate-950 text-white hover:bg-slate-800 dark:bg-amber-300 dark:text-slate-950 dark:hover:bg-amber-200"
    : "border border-[color:var(--ds-border-subtle)] bg-white text-[color:var(--ds-text-secondary)] hover:bg-[color:var(--ds-surface-muted)] dark:bg-slate-950/50"
}`}
```

**Tác động**: Primary button của WorkflowGuide không phải `--ds-accent` mà là slate-950. Theme high-contrast không có quy luật riêng.

**Fix (slice 1)**: Sau khi xoá WorkflowGuide hoặc convert sang token-based.

### A3. `bg-white` literal trong nhiều page 🟠

**Files**: Cần grep:
```powershell
rtk grep "bg-white" src/components/ -l
rtk grep "bg-slate-" src/components/ -l
```

**Plan**: Slice 4 sẽ rà soát toàn bộ và thay bằng `bg-ds-surface-card` / `bg-ds-surface-muted`.

### A4. Hardcoded `text-stone-*`, `bg-amber-50` (legacy) 🟡

Khi user "đăng nhập quản trị" → button `bg-amber-50 text-amber-900` (image 6 top-right). Gold/amber và cobalt blue accent xung đột → cảm giác **brand thiếu nhất quán**.

**Quyết định** (slice 4): Đặt **1 brand chính**:
- **Option A** (current cobalt): primary = `--ds-accent` cobalt, gold chỉ dùng cho status warning
- **Option B** (brand gold): primary = `--brand-500` amber, cobalt giảm ưu tiên

→ **Đề xuất B** vì branding "Golden Logistics" đã chọn vàng. Cobalt giữ làm semantic info.

---

## B. Component duplications & inconsistencies

### B1. 3+ DataTable implementations 🔴

Mặc dù `<DataTable>` từ `@/packages/ui/src/primitives.tsx` đã có, các page lớn vẫn tự render table:

- `@/src/components/dataImporter/DataImporterTableBody.jsx` (19KB) — custom table với row editing inline
- `@/src/components/dataImporter/DataImporterTableHeader.jsx` (4.5KB)
- `@/src/components/mst-assignment/table/MstAssignmentDataTablePanel.jsx` — wrap `<DataTable>` nhưng có custom column resizing
- `@/src/components/hq-agency-manager/HQAgencyTable.jsx` — custom table với resize handlers
- `@/src/components/team-manager/TeamManagerCompaniesPanel.jsx` — `<table>` thuần

**Fix (slice 4)**: Bổ sung `<DataTable>` các tính năng:
- Inline editing cell (render prop)
- Column resize (controlled via prop)
- Row selection (multi-select bulk)
- Row click handler
- Sticky header (đã có)
- Sorting indicator
- Pagination control built-in

Sau đó refactor 5 page tables về dùng `<DataTable>` chung.

### B2. 3+ FilterBar implementations 🟠

- MST: `MstAssignmentStaffFilterPanel.jsx` + `MstAssignmentHistoryFilterPanel.jsx` (2 panels riêng)
- HQ: `HQAgencyManagerControls.jsx` (toolbar dạng `SectionToolbar`)
- DataImporter: `DataImporterFilterPresetControls.jsx` + `DataImporterQueryFilterControls.jsx` + `DataImporterListControlsPanel.jsx`
- Adjustments: `useKpiAdjustmentFilters.js` hook + render trong `KpiAdjustmentListPanel.jsx`
- Reports: `ReportingControlsPanel` từ `ReportingPanels.tsx`

**Fix (slice 4)**: Tạo `<FilterBar>` chuẩn:

```tsx
<FilterBar>
  <FilterBar.Search value={...} onChange={...} placeholder="..." />
  <FilterBar.Select label="Tổ đội" options={...} />
  <FilterBar.DateRange from={...} to={...} />
  <FilterBar.Toggle label="Chỉ rows lỗi" value={...} />
  <FilterBar.Reset onReset={...} />
</FilterBar>
```

### B3. EmptyState dùng không đồng nhất 🟡

**Files**:
- `@/src/components/shared/EmptyState.tsx` — primary, dùng cho 4-5 trang
- `@/src/components/appShell/AppShellAsyncStates.jsx` — `AppShellEmptyState`, `AppShellLoadingState`
- Inline empty `<div className="text-center text-ds-text-muted">Không có dữ liệu</div>` — rải rác

**Fix (slice 4)**: Thống nhất 1 `<EmptyState>` với props:
```tsx
<EmptyState
  icon={<Database />}
  title="Chưa có dữ liệu"
  description="Hãy import tờ khai từ ECUS để bắt đầu"
  action={{ label: "Mở Import Data", onClick: ... }}
  size="md" | "compact"
/>
```

### B4. 4+ Date format trong UI 🟡

- "30/04/2026" (dd/MM/yyyy) — Vietnamese standard
- "April 2026" — readable
- "2026-04-30" (ISO) — backend
- "Tháng trước" — relative
- "04/01/2026" (mm/dd/yyyy) — US format leak

**Fix (slice 4)**: 1 utility `@/src/lib/format.ts`:
```ts
export const formatDate = (d: Date | string, mode: 'date' | 'datetime' | 'relative' | 'period') => ...
```

Mọi date phải qua util này. Audit toàn bộ `<input type="date">` đảm bảo locale `vi-VN`.

---

## C. Permission UX

### C1. Permission alerts xếp chồng 🔴

**Image 6** cho thấy:
1. "Bạn chưa được cấp quyền tải file Import Data"
2. "Bạn đang ở chế độ chỉ xem. Đăng nhập bằng tài khoản được cấp quyền để import, chỉnh sửa và lưu dữ liệu khai"

→ **2 alert message gần giống nhau**, xếp chồng nhau.

**Files**: `@/src/components/dataImporter/DataImporterShell.jsx:1-9725` — cần check render permission alerts.

**Fix (slice 4 — `<PermissionBanner>`)**:
```tsx
<PermissionBanner
  level="warning"
  title="Quyền hạn chế"
  description="Tài khoản đang đăng nhập không có quyền chỉnh sửa Import Data."
  actions={[
    { label: "Đăng nhập admin", variant: "primary", onClick: openLogin },
    { label: "Liên hệ quản trị", variant: "ghost", onClick: openSupport },
  ]}
  dismissible
/>
```

→ 1 banner duy nhất đầu page, không lặp.

### C2. `viewer` role pill chiếm slot quan trọng 🟡

**File**: `@/src/components/appShell/AppShellFrame.tsx:222`

```tsx
<span className="ds-app-shell__role-pill ml-2">{role}</span>
```

→ Hiển thị "viewer" / "editor" / "admin" cạnh title page → user không quan tâm role mỗi giây.

**Fix (slice 2)**: Move role indicator vào CommandCenter dropdown user (chỉ hiện khi click avatar).

### C3. Toàn page disabled khi viewer (HQAgencyManager image 2) 🔴

Đã phân tích ở `02-problems-from-images.md` — fix với `<EmptyState>` chuẩn.

### C4. `canEdit` prop truyền qua 13 tabs nhưng logic phân tán 🟡

Mỗi component check `canEdit` riêng. Nên có hook `useEditPermission(tab)` tập trung.

**Defer**: không quan trọng UX, để slice cuối nếu còn budget.

---

## D. Loading & async states

### D1. `<Skeleton>` dùng không đồng nhất 🟡

`@/src/components/KPIAdjustments.tsx:92-100`:
```tsx
function TabLoadingSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-8 w-1/3" />
      ...
    </div>
  );
}
```

→ Skeleton inline trong page, không reusable.

**Fix (slice 4)**: Tạo `<TableSkeleton rows={5} cols={4} />`, `<CardSkeleton />`, `<ChartSkeleton />` trong `@/components/ui/skeleton-presets.tsx`.

### D2. Loading state mỗi trang khác 🟡

- Dashboard: `<AppShellLoadingState title="..." />`
- Adjustments: `<TabLoadingSkeleton />`
- Reports: text "Đang tải..."
- DataImporter: spinner inline

**Fix (slice 4)**: Chuẩn hoá 3 pattern:
- **Page level**: `<PageLoadingState title="Đang tải báo cáo KPI" />`
- **Section level**: `<SectionLoadingState />`
- **Inline**: `<Spinner size="sm" />`

### D3. Suspense fallback inconsistent 🟡

`@/src/App.tsx:464`:
```tsx
<Suspense fallback={<div className="text-sm text-gray-500 dark:text-gray-400">{t('app.loadingDashboard')}</div>}>
```

→ Plain text "đang tải dashboard" không matching với rest of UI.

**Fix (slice 4)**: Centralized `<LazyFallback />`:
```tsx
<Suspense fallback={<LazyFallback variant="page" label={t('app.loadingDashboard')} />}>
```

---

## E. Accessibility

### E1. Skip link chỉ ở `App.tsx` 🟡

`@/src/App.tsx:329-335` có skip-to-content. Tốt. Tuy nhiên focus management trong page tabs không có skip link nội bộ.

### E2. Form labels dùng `<label htmlFor>` không đồng nhất 🟡

Audit cần grep `htmlFor` vs `aria-labelledby` — defer.

### E3. Color contrast trên `text-ds-text-muted-soft` 🟡

`--ds-text-muted-soft` (oklch(0.68 0.012 250)) trên `--ds-surface-card` (oklch(1 0 0)) → contrast ~3.5:1, **không đạt WCAG AA cho text dưới 18pt**.

**Fix (slice 4)**: 
- `--ds-text-muted-soft` chỉ dùng cho text ≥ 14pt bold hoặc 18pt regular
- Audit + replace những chỗ dùng cho body text < 14pt

### E4. Tooltip chỉ trigger trên hover (không keyboard) 🟡

`useTooltipTitles` (`@/src/hooks/useTooltipTitles.js`) cần check có support `focus` không.

### E5. Dialog focus trap 🟡

`AppDialogContent` từ Radix — focus trap đã có. OK.

---

## F. State management & re-render

### F1. `useDashboardKpiOverview` re-render mỗi tick 🟡

`@/src/hooks/useDashboardKpiOverview.js` — cần check có memo hợp lý không.

**Defer**: performance issue, không phải UX issue. Slice riêng nếu profiling cho thấy chậm.

### F2. CommandCenter re-render khi auth thay đổi 🟡

`@/src/App.tsx:368-378` — props `currentUser` re-trigger CommandCenter useMemo. OK.

---

## G. Module size violations (>800 LOC rule)

| File | LOC | Status |
|------|-----|--------|
| `KPIAdjustments.tsx` | 762 | ⚠️ gần ngưỡng |
| `HQAgencyManager.tsx` | 951 | 🔴 vượt 18% |
| `MSTAssignment.tsx` | 585 | OK |
| `ReportViewer.tsx` | 636 | OK |
| `DataImporterShell.jsx` | 9725 / 9.7KB | (kích thước, không LOC) cần check |
| `AccountManager.tsx` | 33KB | có thể vượt |
| `DataHealthDashboard.tsx` | 35KB | có thể vượt |
| `ExportAuditReport.tsx` | 29KB | có thể vượt |
| `AuditLog.tsx` | 41KB | 🔴 cần tách |

**Fix (slice riêng — sau Phase B/C/D)**: tách các file lớn theo logical units. Dùng `gitnexus_impact` trước.

---

## H. i18n coverage

### H1. Một số i18n key chưa có 🟡

Khi đọc các page, vẫn còn vài text raw VI:
- `MSTAssignment.tsx:65-66` — exports re-export comments raw
- `HQAgencyManager.tsx:942-947` — note text inline raw VI
- Workflow guide error messages

**Fix (slice 7)**: i18n audit, thêm key, replace.

### H2. Tiếng Anh + tiếng Việt trộn lẫn 🟡

Sidebar: "Tổng quan KPI" (VI) và "Ops shell" (EN) — branding choice. OK.

---

## I. Tests

### I1. Test fail hiện có 🔴

- `tests/ConflictResolutionDialog.test.jsx` — 5 tests fail (`getByRole("dialog")` returns multiple elements). Cấu trúc dialog đã thay đổi nhưng test chưa update.

### I2. Tests dùng class name selectors 🟠

Nhiều tests query bằng class hoặc text → fragile khi UI thay đổi.

**Fix (slice 8)**: Migrate test queries sang `getByRole`, `getByLabelText`, `getByTestId` (test-driven semantic markup).

### I3. Snapshot tests stale 🟡

(Cần check `__snapshots__` directories) — defer.

---

## J. Build & performance

### J1. `App.css` 1592 dòng 🟡

Kích thước CSS lớn. Một phần vì legacy shadcn aliases. Có thể tách thành `tokens.css` + `components.css` + `utilities.css`.

**Defer**: không ảnh hưởng UX.

### J2. Lazy loading routes 🟢

`@/src/App.tsx` đã `React.lazy` SupportCenter, ChangePasswordDialog, Login. KPICalculator (chứa toàn bộ page logic) cũng `React.lazy`. OK.

### J3. Bundle size 🟢

Build pass trong 6.32s — không có flag size warning. Defer.

---

## K. Tổng hợp severity

| Mức | Số lượng | Ưu tiên |
|-----|----------|---------|
| 🔴 Critical | 6 | Slice 1-4 |
| 🟠 High | 12 | Slice 1-5 |
| 🟡 Medium | 14 | Slice 5-7 |
| 🟢 Low | 3 | Defer |

**Tổng**: 35 vấn đề ngoài 7 vấn đề từ ảnh = **42 issues** cần xử lý.
