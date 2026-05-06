# 05 — Component Library Spec

> Mục đích: Liệt kê **các component mới cần xây dựng** trong các slices sau, kèm API spec, file path đề xuất, test plan. Mỗi component có: props, anatomy, edge cases, file location, test scenarios.

---

## A. Components mới (cần build)

| # | Component | File path | Slice | Priority |
|---|-----------|-----------|-------|----------|
| A1 | `<PageHeader>` | `packages/ui/src/PageHeader.tsx` | 3 | 🔴 |
| A2 | `<FilterBar>` + sub-components | `packages/ui/src/FilterBar.tsx` | 4 | 🔴 |
| A3 | `<ExportDropdown>` | `packages/ui/src/ExportDropdown.tsx` | 4 | 🔴 |
| A4 | `<EmptyState>` (refactor) | `packages/ui/src/EmptyState.tsx` | 4 | 🔴 |
| A5 | `<PermissionBanner>` | `packages/ui/src/PermissionBanner.tsx` | 4 | 🔴 |
| A6 | `<BulkActionBar>` | `packages/ui/src/BulkActionBar.tsx` | 4 | 🟠 |
| A7 | `<InfoTooltip>` | `packages/ui/src/InfoTooltip.tsx` | 3 | 🟠 |
| A8 | `<PageTabs>` (Page-level tabs wrapper) | `packages/ui/src/PageTabs.tsx` | 5 | 🟠 |
| A9 | `<DataTable>` (extend existing) | `packages/ui/src/primitives.tsx` | 4 | 🟠 |
| A10 | `<Skeleton>` presets | `src/components/ui/skeleton-presets.tsx` | 4 | 🟡 |
| A11 | `<LoadingState>` | `packages/ui/src/LoadingState.tsx` | 4 | 🟡 |
| A12 | `<KeyValueList>` | `packages/ui/src/KeyValueList.tsx` | 5 | 🟡 |
| A13 | `<MetricCard>` (refactor SummaryCard) | `packages/ui/src/MetricCard.tsx` | 5 | 🟡 |

---

## A1. `<PageHeader>` 🔴

**Mục đích**: Header chuẩn cho mọi page. Thay thế hero hiện tại trong `AppShellFrame` hero block.

### Props

```ts
interface PageHeaderProps {
  /** Bắt buộc — tên page */
  title: string;
  /** Tuỳ chọn — phụ đề ngắn (1 dòng, ≤ 80 ký tự) */
  subtitle?: string;
  /** Tuỳ chọn — eyebrow (text uppercase nhỏ trên title) */
  eyebrow?: string;
  /** Tuỳ chọn — info tooltip giải thích page */
  info?: string;
  /** Tuỳ chọn — back link */
  back?: { label: string; href?: string; onClick?: () => void };
  /** Tuỳ chọn — meta items (period, count, status) */
  meta?: ReactNode[];
  /** Tuỳ chọn — actions chính (max 2: 1 primary + 1 secondary/dropdown) */
  actions?: ReactNode;
  /** Tuỳ chọn — thấp hơn (sticky) */
  sticky?: boolean;
}
```

### Anatomy

```
┌─────────────────────────────────────────────────────┐
│ ← Back link (optional)                               │
├─────────────────────────────────────────────────────┤
│ EYEBROW · OPTIONAL                                   │
│ Title       (i)            [Meta1] [Meta2]  [Action]│
│ Subtitle (1 dòng nếu có)                              │
└─────────────────────────────────────────────────────┘
Height: ~48-72px (compact mode)
```

### Edge cases

- Không title → render nothing (warning)
- Title quá dài → truncate với title attr full
- Action overflow > 2 → gộp vào dropdown "..."
- Mobile (< 640px) → actions xuống dòng dưới

### Tokens

```tsx
className={cn(
  "flex flex-col gap-1.5",
  "px-4 py-3 sm:px-6 sm:py-4",
  "border-b border-ds-border-subtle",
  sticky && "sticky top-0 z-20 bg-ds-surface-base/80 backdrop-blur"
)}
```

### File path
- Component: `packages/ui/src/PageHeader.tsx`
- Re-export: `src/components/designSystem/PageHeader.tsx` (re-export)
- Test: `tests/PageHeader.test.tsx`

### Test scenarios
1. Render title only
2. Render title + eyebrow + subtitle
3. Render title + meta + actions
4. Click back link triggers callback
5. Info tooltip mở/đóng
6. Sticky behaviour (scroll page → vẫn dính)
7. Truncate title quá dài
8. Mobile responsive (gap, wrap)

---

## A2. `<FilterBar>` 🔴

**Mục đích**: Toolbar filter chuẩn cho table page. Thay thế `SectionToolbar` + custom filters scattered.

### Anatomy compound

```tsx
<FilterBar onReset={handleReset}>
  <FilterBar.Search value={search} onChange={setSearch} placeholder="Tìm MST..." />
  <FilterBar.Select label="Tổ đội" value={team} options={teamOptions} onChange={setTeam} />
  <FilterBar.Select label="Trạng thái" value={status} options={statusOptions} onChange={setStatus} />
  <FilterBar.DateRange from={from} to={to} onChange={({from,to}) => ...} />
  <FilterBar.Toggle label="Chỉ rows lỗi" value={onlyError} onChange={setOnlyError} />
  <FilterBar.Spacer />
  <FilterBar.Actions>
    <ExportDropdown ... />
  </FilterBar.Actions>
</FilterBar>
```

### Props

```ts
interface FilterBarProps {
  children: ReactNode;
  /** Tuỳ chọn — callback reset all filters */
  onReset?: () => void;
  /** Tuỳ chọn — số filter đang active (để hiển thị badge) */
  activeFilterCount?: number;
  /** Tuỳ chọn — sticky on scroll */
  sticky?: boolean;
  /** Tuỳ chọn — collapsible (advanced filters) */
  collapsible?: boolean;
  /** Tuỳ chọn — initially collapsed */
  defaultCollapsed?: boolean;
}
```

### Sub-components

- `<FilterBar.Search>` — input search có icon, clear button
- `<FilterBar.Select>` — Radix Select wrapper với label
- `<FilterBar.DateRange>` — 2 date inputs với "from/to" label
- `<FilterBar.Toggle>` — switch + label
- `<FilterBar.Actions>` — slot cho buttons phía phải
- `<FilterBar.Spacer>` — flex-grow để push actions sang phải
- `<FilterBar.Reset>` — link "Xoá filter" hiển thị khi `activeFilterCount > 0`

### Behavior

- Mobile: vertical stack, mỗi filter full width
- Desktop ≥ 768px: horizontal flex wrap
- Có `<FilterBar.Reset>` nếu `activeFilterCount > 0`
- Sticky mode: dính trên cùng content area khi scroll

### File path
- Component: `packages/ui/src/FilterBar.tsx`
- Test: `tests/FilterBar.test.tsx`

### Test scenarios
1. Render all sub-components
2. onReset triggered khi click Reset
3. activeFilterCount badge hiển thị đúng
4. Mobile responsive (vertical stack)
5. Collapsible mode hoạt động
6. Sticky behaviour
7. Search debounce (300ms) cho onChange

---

## A3. `<ExportDropdown>` 🔴

**Mục đích**: Thay thế 4 buttons "XLSX (lọc)/CSV (lọc)/XLSX (tất cả)/CSV (tất cả)" thành 1 dropdown.

### Props

```ts
interface ExportDropdownProps {
  /** Bắt buộc — danh sách option */
  items: ExportItem[];
  /** Bắt buộc — handler khi chọn */
  onExport: (item: ExportItem) => void | Promise<void>;
  /** Tuỳ chọn — text button trigger */
  triggerLabel?: string; // default: "Xuất báo cáo"
  /** Tuỳ chọn — disabled */
  disabled?: boolean;
  /** Tuỳ chọn — icon override */
  icon?: ReactNode;
}

interface ExportItem {
  /** Unique key */
  id: string;
  /** Label hiển thị (vd: "Excel — toàn bộ") */
  label: string;
  /** Description bổ sung (vd: "Tất cả 1234 dòng") */
  description?: string;
  /** Format: 'xlsx' | 'csv' | 'pdf' */
  format: string;
  /** Scope: 'filtered' | 'all' */
  scope?: 'filtered' | 'all';
  /** Disabled cá nhân */
  disabled?: boolean;
  /** Tooltip khi disabled */
  disabledReason?: string;
}
```

### Anatomy

```
[Xuất báo cáo ▾]
    │
    ↓ (click)
┌───────────────────────────┐
│ Excel — kết quả lọc       │
│ 234 dòng                  │
├───────────────────────────┤
│ CSV — kết quả lọc         │
│ 234 dòng                  │
├───────────────────────────┤
│ Excel — toàn bộ           │
│ 1234 dòng                 │
├───────────────────────────┤
│ CSV — toàn bộ             │
│ 1234 dòng                 │
└───────────────────────────┘
```

### Behavior

- Loading state khi `onExport` đang chạy → spinner trong dropdown trigger
- Disabled item: grey + tooltip lý do
- Keyboard navigation (arrows, enter)
- Auto-close sau khi click

### File path
- Component: `packages/ui/src/ExportDropdown.tsx`
- Test: `tests/ExportDropdown.test.tsx`

### Test scenarios
1. Render trigger + items
2. Open dropdown on click
3. onExport called với item đúng
4. Loading state khi async
5. Disabled item không clickable + tooltip
6. Keyboard navigation
7. Close after select

---

## A4. `<EmptyState>` (refactor) 🔴

**Mục đích**: 1 source of truth cho mọi empty state trong app.

### Current state
- `src/components/shared/EmptyState.tsx` đã có nhưng API hạn chế
- Inline `<div>...Không có dữ liệu</div>` rải rác

### Props (refactored)

```ts
interface EmptyStateProps {
  /** Bắt buộc — title chính */
  title: string;
  /** Tuỳ chọn — description 1-2 dòng */
  description?: string;
  /** Tuỳ chọn — icon (lucide component hoặc ReactNode) */
  icon?: ReactNode;
  /** Tuỳ chọn — action button(s) */
  actions?: Array<{
    label: string;
    variant?: 'primary' | 'secondary' | 'ghost';
    onClick?: () => void;
    href?: string;
    icon?: ReactNode;
  }>;
  /** Tuỳ chọn — size */
  size?: 'compact' | 'md' | 'lg'; // default 'md'
  /** Tuỳ chọn — image illustration thay icon */
  illustration?: ReactNode;
  /** Tuỳ chọn — variant tone */
  tone?: 'neutral' | 'info' | 'success' | 'warning'; // default 'neutral'
}
```

### Anatomy

```
┌─────────────────────────────────┐
│                                 │
│         [Icon 48px]             │
│                                 │
│      Title (text-base)          │
│  Description (text-sm muted)    │
│                                 │
│   [Primary action] [Secondary]  │
│                                 │
└─────────────────────────────────┘
Padding: p-8 (md), p-4 (compact), p-12 (lg)
```

### Sizes

- `compact` — for inline empty (table cell, sidebar): icon 24px, no description
- `md` — default for empty section/card: icon 40px, all content
- `lg` — full page empty: icon 64px, illustration option

### File path
- Component: `packages/ui/src/EmptyState.tsx`
- Migrate: `src/components/shared/EmptyState.tsx` → re-export
- Test: `tests/EmptyState.test.tsx`

### Test scenarios
1. Render với title only
2. Render với icon + title + description
3. Render với actions
4. Each size variant
5. Tone variants có màu đúng
6. Click action triggers callback

---

## A5. `<PermissionBanner>` 🔴

**Mục đích**: 1 banner duy nhất ở đầu page khi user không có quyền edit. Replace 2 alerts xếp chồng (image 6).

### Props

```ts
interface PermissionBannerProps {
  /** Bắt buộc — title ngắn */
  title: string;
  /** Bắt buộc — description giải thích */
  description: string;
  /** Tuỳ chọn — level */
  level?: 'info' | 'warning' | 'error'; // default 'warning'
  /** Tuỳ chọn — actions */
  actions?: Array<{
    label: string;
    variant?: 'primary' | 'secondary';
    onClick?: () => void;
  }>;
  /** Tuỳ chọn — dismissible */
  dismissible?: boolean;
  /** Tuỳ chọn — persistKey để remember dismissal */
  persistKey?: string;
}
```

### Anatomy

```
┌──────────────────────────────────────────────────┐
│ ⚠ Quyền hạn chế                              [×] │
│ Tài khoản hiện tại không có quyền chỉnh sửa     │
│ Import Data. Đăng nhập admin để có toàn quyền.  │
│                                                   │
│ [Đăng nhập admin]  [Liên hệ quản trị]            │
└──────────────────────────────────────────────────┘
```

### Tokens

- Level info: `bg-ds-info/8 border-ds-info/20 text-ds-info`
- Level warning: `bg-ds-warning/8 border-ds-warning/30 text-ds-warning-dark`
- Level error: `bg-ds-destructive/8 border-ds-destructive/20 text-ds-destructive`

### File path
- Component: `packages/ui/src/PermissionBanner.tsx`
- Test: `tests/PermissionBanner.test.tsx`

### Test scenarios
1. Render với title + description
2. 3 levels có màu đúng
3. Actions render và click hoạt động
4. Dismissible: click × → ẩn banner
5. persistKey: dismiss state lưu localStorage và restore
6. Accessibility: `role="alert"`, focus management

---

## A6. `<BulkActionBar>` 🟠

**Mục đích**: Sticky bottom bar khi user chọn nhiều rows trong table.

### Props

```ts
interface BulkActionBarProps {
  /** Bắt buộc — số items đang select */
  selectedCount: number;
  /** Bắt buộc — tổng items (để hiển thị "12/100") */
  totalCount?: number;
  /** Bắt buộc — actions */
  actions: Array<{
    id: string;
    label: string;
    icon?: ReactNode;
    variant?: 'primary' | 'secondary' | 'destructive';
    onClick?: () => void;
    disabled?: boolean;
    disabledReason?: string;
  }>;
  /** Tuỳ chọn — clear selection callback */
  onClear?: () => void;
  /** Tuỳ chọn — select all callback */
  onSelectAll?: () => void;
  /** Tuỳ chọn — chỉ visible khi selectedCount > 0 (default: true) */
  autoHide?: boolean;
}
```

### Anatomy

```
─────────────────────────────────
│ ✓ 12/100 selected   [Clear]       [Edit] [Delete] [Export]│
─────────────────────────────────
position: sticky bottom-0
height: 56px
```

### Behavior

- Animate slide-up khi `selectedCount > 0`
- ESC key → clear selection
- Disabled action: tooltip + grey

### File path
- Component: `packages/ui/src/BulkActionBar.tsx`
- Test: `tests/BulkActionBar.test.tsx`

---

## A7. `<InfoTooltip>` 🟠

**Mục đích**: Icon `(i)` chuẩn cho info hint. Replace inline `<button onClick={alert}>` hiện tại.

### Props

```ts
interface InfoTooltipProps {
  /** Bắt buộc — text/content */
  content: string | ReactNode;
  /** Tuỳ chọn — vị trí */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Tuỳ chọn — kích thước icon */
  size?: 'xs' | 'sm' | 'md'; // default 'sm'
  /** Tuỳ chọn — variant */
  variant?: 'default' | 'subtle';
  /** Tuỳ chọn — id cho aria-describedby */
  id?: string;
}
```

### Anatomy

```tsx
<button aria-label="Thông tin" className="...">
  <Info size={14} />
</button>
// Tooltip mở khi hover/focus
```

Sử dụng `@/components/ui/tooltip.tsx` (Radix) wrapped.

### File path
- Component: `packages/ui/src/InfoTooltip.tsx`
- Test: `tests/InfoTooltip.test.tsx`

---

## A8. `<PageTabs>` 🟠

**Mục đích**: Wrapper cho `Tabs` của Radix khi dùng làm page-level tabs (sub-views trong 1 page).

### Props

```ts
interface PageTabsProps {
  tabs: Array<{
    id: string;
    label: string;
    badge?: string | number;
    icon?: ReactNode;
    disabled?: boolean;
    disabledReason?: string;
  }>;
  /** Bắt buộc — id tab active */
  value: string;
  /** Bắt buộc — callback đổi tab */
  onChange: (id: string) => void;
  /** Tuỳ chọn — query param sync (URL params) */
  syncToUrl?: boolean;
  /** Tuỳ chọn — variant */
  variant?: 'underline' | 'pill'; // default 'underline'
  children: ReactNode;
}
```

### Anatomy

```
─────────────────────────────────
 Bảng MST  Bộ lọc  Lịch sử (12)
 ─────                            ← active underline
─────────────────────────────────
| (Tab content children)         |
─────────────────────────────────
```

### File path
- Component: `packages/ui/src/PageTabs.tsx`
- Test: `tests/PageTabs.test.tsx`

---

## A9. `<DataTable>` extension 🟠

**Mục đích**: Bổ sung tính năng cần cho 5 page table.

### New props (added to existing)

```ts
interface DataTableProps<T> {
  // ... existing
  
  /** NEW — Selection */
  selection?: {
    selectedKeys: Set<string>;
    onChange: (keys: Set<string>) => void;
    keyExtractor: (item: T) => string;
  };
  
  /** NEW — Inline editing */
  editable?: {
    editingKey: string | null;
    onEdit: (key: string | null) => void;
    onSave: (key: string, changes: Partial<T>) => Promise<void>;
  };
  
  /** NEW — Column resize */
  columnResize?: {
    widths: Record<string, number>;
    onChange: (widths: Record<string, number>) => void;
    persistKey?: string; // localStorage
  };
  
  /** NEW — Sticky header offset (px) */
  stickyHeaderOffset?: number;
  
  /** NEW — Density */
  density?: 'compact' | 'default' | 'relaxed';
  
  /** NEW — Empty state element */
  emptyState?: ReactNode;
  
  /** NEW — Loading state element */
  loadingState?: ReactNode;
  
  /** NEW — Error state */
  error?: { title: string; description?: string; onRetry?: () => void };
  
  /** NEW — Sort handler */
  sort?: {
    column: string | null;
    direction: 'asc' | 'desc';
    onChange: (column: string, direction: 'asc' | 'desc') => void;
  };
}
```

### File path
- Component: `packages/ui/src/primitives.tsx` (extend existing)
- Test: `tests/DataTable.test.tsx` (extend)

---

## A10-A11. Skeleton presets + LoadingState 🟡

```tsx
// src/components/ui/skeleton-presets.tsx
export const TableSkeleton = ({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) => (
  <div className="space-y-2 p-4">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-3">
        {Array.from({ length: cols }).map((__, j) => (
          <Skeleton key={j} className="h-10 flex-1" />
        ))}
      </div>
    ))}
  </div>
);

export const CardSkeleton = () => (
  <div className="space-y-3 p-4">
    <Skeleton className="h-5 w-1/3" />
    <Skeleton className="h-3 w-2/3" />
    <Skeleton className="h-24 w-full" />
  </div>
);

export const ChartSkeleton = ({ height = 240 }: { height?: number }) => (
  <Skeleton className="w-full" style={{ height }} />
);
```

```tsx
// packages/ui/src/LoadingState.tsx
interface LoadingStateProps {
  variant: 'page' | 'section' | 'inline';
  label?: string;
}

export const LoadingState = ({ variant, label }: LoadingStateProps) => {
  // Different layout per variant
};
```

---

## A12. `<KeyValueList>` 🟡

**Mục đích**: Display object/info as label-value list (replace inline `<dl>`).

```tsx
<KeyValueList>
  <KeyValueList.Item label="MST" value="0123456789" />
  <KeyValueList.Item label="Công ty" value="Cty A" copy />
  <KeyValueList.Item label="Ngày tạo" value={formatDate(d)} />
</KeyValueList>
```

---

## A13. `<MetricCard>` 🟡

**Mục đích**: Refactor `SummaryCard` thành chuẩn metric card cho dashboard.

### Props

```ts
interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: { value: number; direction: 'up' | 'down' | 'flat'; label?: string };
  trend?: number[]; // mini sparkline
  icon?: ReactNode;
  href?: string; // navigate
  onClick?: () => void;
  /** Empty state khi value=null/0/undefined */
  emptyMessage?: string;
}
```

### Anatomy

```
┌─────────────────────────┐
│ Label muted             │
│ 1,234.56 đơn            │
│ ↑ 12% so với kỳ trước   │
│ ▁▂▃▄▅▆▇ (sparkline)     │
└─────────────────────────┘
```

---

## B. Components hiện có cần CẢI THIỆN

| Component | File | Cải thiện | Slice |
|-----------|------|-----------|-------|
| `StatusBadge` | `packages/ui/src/primitives.tsx` | Thay hardcoded slate/sky/emerald → `--ds-*` tokens | 4 |
| `SectionHeader` | `packages/ui/src/shellPrimitives.tsx` | Thêm prop `info` (tooltip) thay vì description prop | 3 |
| `SectionToolbar` | `packages/ui/src/shellPrimitives.tsx` | Cho phép custom layout (justify, gap) | 4 |
| `AppDialog` | `packages/ui/src/primitives.tsx` | Thêm size `xl`, fullscreen mode mobile | 5 |
| `AppShellWorkflowGuide` | `src/components/appShell/AppShellWorkflowGuide.jsx` | XOÁ hoàn toàn (slice 1) | 1 |
| `AppShellFrame` | `src/components/appShell/AppShellFrame.tsx` | Bỏ hero block to, dùng `<PageHeader>` | 2 |

---

## C. Components hiện có giữ nguyên

- shadcn UI components (`src/components/ui/*.tsx`) — 47 files đã chuẩn
- `Tabs`, `Dialog`, `Select`, `Popover`, `Tooltip`, etc. (Radix wrappers)

---

## D. Test infrastructure cho components mới

Mọi component mới phải có:
1. **Unit test** (`tests/<Component>.test.tsx`):
   - Render correctly with all props
   - Event handlers triggered
   - Accessibility (axe-core)
   - Keyboard navigation
2. **Visual snapshot** (optional, dùng vitest snapshot):
   - Default state
   - All variants
3. **Integration test** (khi dùng trong page):
   - Wired up correctly trong page wrapper
   - State management hoạt động

---

## E. File structure đề xuất

```
packages/ui/src/
├── PageHeader.tsx              ← NEW
├── FilterBar.tsx               ← NEW
├── ExportDropdown.tsx          ← NEW
├── EmptyState.tsx              ← NEW (refactored)
├── PermissionBanner.tsx        ← NEW
├── BulkActionBar.tsx           ← NEW
├── InfoTooltip.tsx             ← NEW
├── PageTabs.tsx                ← NEW
├── LoadingState.tsx            ← NEW
├── KeyValueList.tsx            ← NEW
├── MetricCard.tsx              ← NEW
├── primitives.tsx              ← EXTEND (DataTable, StatusBadge fix)
├── shellPrimitives.tsx         ← EXTEND (SectionHeader info prop)
└── index.ts                    ← Update exports

src/components/designSystem/
├── shellPrimitives.tsx          ← Re-export
├── primitives.jsx               ← Re-export
├── PageHeader.tsx               ← Re-export NEW
├── FilterBar.tsx                ← Re-export NEW
└── ...                          ← Re-export all NEW components

src/components/ui/
├── skeleton-presets.tsx         ← NEW (TableSkeleton, CardSkeleton, ...)
└── ... (existing 47 components)
```

→ Tất cả components mới ở `packages/ui/src/` để có thể share với apps/admin nếu cần. Re-export trong `src/components/designSystem/` để giữ import paths cũ trong pages.

---

## F. Migration strategy

Mỗi component mới được áp dụng theo **2-step migration**:

1. **Step 1 (slice 4)**: Build component mới + test + parallel với code cũ. Code cũ vẫn hoạt động.
2. **Step 2 (slice 5+)**: Refactor từng page sang dùng component mới. Mỗi PR refactor 1-2 pages.

→ Tránh big-bang refactor. Pages bị ảnh hưởng test sẽ update cùng PR.
