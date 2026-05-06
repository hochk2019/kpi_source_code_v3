# 10 — Legacy Class Inventory

> Grep results thực tế từ codebase. Sử dụng cho **Slice 4** (token migration) và slices con.
> Thống kê tại thời điểm: 2026-05-06.

---

## A. Tổng quan stats

Pattern grep trong `src/components/**/*.{tsx,jsx}` (không tính `src/components/ui/*` shadcn):

| Pattern | Matches | Files |
|---------|---------|-------|
| `bg-slate-*` | 123 | 37 |
| `bg-white` | 154 | 65 |
| `bg-amber-*` | 77 | 37 |
| `bg-(rose\|sky\|emerald\|red\|green\|blue\|yellow\|orange\|purple\|pink\|teal\|cyan\|indigo\|violet\|fuchsia\|zinc\|stone\|gray\|neutral)-*` | 324 | 78 |
| `text-(<all colors>)-*` | 1,032 | 105 |
| `border-(<all colors>)-*` | 269 | 71 |
| **TỔNG** | **~1,979 occurrences** | **~105 unique files** |

Pattern grep trong `packages/ui/src/`:

| File | Matches | Notes |
|------|---------|-------|
| `primitives.tsx` | 5 | StatusBadge tone classes (đã đề cập slice 1.4) |

→ packages/ui chỉ có 1 file vi phạm. **Tốt** — đa số legacy đã không leak ra primitives.

---

## B. Top 20 files vi phạm nhiều nhất

Tính tổng `text-* + bg-* + border-* + ...` legacy:

| Rank | File | Hits ước tính | Ưu tiên fix |
|------|------|---------------|-------------|
| 1 | `dataImporter/DataImporterSyncPreviewPanel.jsx` | ~87 | 🔴 |
| 2 | `data-health-dashboard/DataHealthRolloutStatusPanel.jsx` | ~60 | 🔴 |
| 3 | `dataImporter/DataImporterCardResults.jsx` | ~55 | 🔴 |
| 4 | `dataImporter/DataImporterTableBody.jsx` | ~49 | 🔴 |
| 5 | `data-health-dashboard/DataHealthFrontendPerformancePanel.jsx` | ~37 | 🟠 |
| 6 | `rules-editor/RulesConfigTabsPanel.jsx` | ~37 | 🟠 |
| 7 | `data-health-dashboard/DataHealthStorageOverviewPanel.jsx` | ~32 | 🟠 |
| 8 | `hq-agency-manager/HQAgencyManagerControls.jsx` | ~31 | 🟠 |
| 9 | `dataImporter/DataImporterMonitoringPanel.jsx` | ~25 | 🟠 |
| 10 | `hq-agency-manager/HQAgencyTable.jsx` | ~26 | 🟠 |
| 11 | `reporting/TeamDetailCard.jsx` | ~24 | 🟠 |
| 12 | `reporting/StaffDetailCard.jsx` | ~23 | 🟠 |
| 13 | `mst-assignment/table/MstAssignmentDataTablePanel.jsx` | ~19 | 🟠 |
| 14 | `ai-assistant/panels/AiAssistantStatusSidebar.jsx` | ~19 | 🟡 |
| 15 | `dataImporter/DataImporterSyncConfigPanel.jsx` | ~19 | 🟡 |
| 16 | `DataHealthDashboard.tsx` | ~18 | 🟡 |
| 17 | `dataImporter/DataImporterDuplicateReviewDialog.jsx` | ~18 | 🟡 |
| 18 | `ai-assistant/panels/AiAssistantConfigPanel.jsx` | ~17 | 🟡 |
| 19 | `dataImporter/DataImporterImportPreviewSummary.jsx` | ~17 | 🟡 |
| 20 | `dataImporter/DataImporterTableHeader.jsx` | ~17 | 🟡 |

→ Top 4 files = ~250 hits. Top 20 files = ~610 hits (~31% tổng).

---

## C. Categorization (KEEP / MIGRATE / REMOVE)

### C1. KEEP (legitimate — không cần đổi)

| Pattern | Lý do | Hành động |
|---------|-------|-----------|
| `bg-slate-950/50` (overlay tint) | Modal overlay đã có `--ds-shadow-lg` thay được | MIGRATE → `bg-ds-surface-overlay/80` |
| `dark:bg-amber-300` | Brand gold cho dark theme — keep | KEEP |
| `text-amber-900` (login button) | Brand gold | MIGRATE → `text-brand-on-500` token mới |
| `bg-emerald-50/100` cho status icons (success state) | Semantic | MIGRATE → `bg-ds-success/10` |
| `bg-rose-50/100` cho error chip | Semantic | MIGRATE → `bg-ds-destructive/10` |

### C2. MIGRATE (chuyển sang token)

| Legacy | Token thay thế | Slice |
|--------|----------------|-------|
| `bg-slate-50` | `bg-ds-surface-muted` | 4 |
| `bg-slate-100` | `bg-ds-surface-muted` | 4 |
| `bg-slate-200` | `bg-ds-border-subtle` (border) | 4 |
| `bg-slate-800` | `bg-ds-surface-card` (dark) | 4 |
| `bg-slate-900` | `bg-ds-surface-base` (dark) | 4 |
| `bg-slate-950` | `bg-ds-surface-base` (dark) | 4 |
| `bg-white` | `bg-ds-surface-card` | 4 |
| `text-slate-400` | `text-ds-text-muted` | 4 |
| `text-slate-500` | `text-ds-text-muted` | 4 |
| `text-slate-600` | `text-ds-text-secondary` | 4 |
| `text-slate-700` | `text-ds-text-secondary` | 4 |
| `text-slate-900` | `text-ds-text-primary` | 4 |
| `text-amber-700/800/900` | `text-ds-warning` | 4 |
| `text-emerald-600/700` | `text-ds-success` | 4 |
| `text-rose-500/600/700` | `text-ds-destructive` | 4 |
| `text-sky-500/600/700` | `text-ds-info` | 4 |
| `border-slate-200/300` | `border-ds-border-subtle` | 4 |
| `border-slate-700/800` | `border-ds-border-subtle` (dark) | 4 |
| `border-amber-200/300` | `border-ds-warning/30` | 4 |
| `border-emerald-200/300` | `border-ds-success/20` | 4 |
| `border-rose-200/300` | `border-ds-destructive/20` | 4 |

### C3. REMOVE (không cần thiết, gradient/decoration)

| Pattern | Lý do | Hành động |
|---------|-------|-----------|
| `bg-gradient-to-r from-amber-* to-orange-*` | Decoration không cần thiết | REMOVE — dùng `bg-ds-surface-card` |
| `text-yellow-* text-purple-* text-pink-*` | Test data có thể, không phải design intent | REMOVE — verify case-by-case |
| `bg-yellow-100 bg-purple-100` (decorative) | Same | REMOVE |

---

## D. Notable hardcoded patterns

### D1. `AppShellWorkflowGuide.jsx:17` 🔴 (slice 1.3 sẽ xoá file)

```jsx
className={`min-h-11 rounded-full px-3.5 py-2 text-sm font-medium transition ${
  isPrimary
    ? "bg-slate-950 text-white hover:bg-slate-800 dark:bg-amber-300 dark:text-slate-950 dark:hover:bg-amber-200"
    : "border border-[color:var(--ds-border-subtle)] bg-white text-[color:var(--ds-text-secondary)] hover:bg-[color:var(--ds-surface-muted)] dark:bg-slate-950/50"
}`}
```

→ File này sẽ xoá hoàn toàn ở slice 1.3, không cần migrate.

### D2. `packages/ui/src/primitives.tsx:208-221` 🔴 (slice 1.4)

```tsx
const toneClassName: Record<StatusTone, string> = {
  neutral: "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800/40 ...",
  info: "bg-sky-100 text-sky-700 border border-sky-200 dark:bg-sky-500/20 ...",
  success: "bg-emerald-100 text-emerald-700 ...",
  warning: "bg-amber-100 text-amber-800 ...",
  danger: "bg-rose-100 text-rose-700 ...",
};
```

→ Migrate trong slice 1.4 sang token-based.

### D3. Status indicator patterns lặp lại 🟠

Tìm thấy pattern lặp ~30+ lần:

```jsx
className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20"
```

→ **Đề xuất**: Tạo `<StatusPill tone="success">Đã duyệt</StatusPill>` shared component (slice 4 có thể bao gồm).

Files có pattern này:
- `dataImporter/DataImporterCardResults.jsx`
- `dataImporter/DataImporterTableBody.jsx`
- `mst-assignment/table/MstAssignmentDataTablePanel.jsx`
- `hq-agency-manager/HQAgencyTable.jsx`
- `reporting/TeamDetailCard.jsx`
- `reporting/StaffDetailCard.jsx`
- `auditLog/AuditLogTable.jsx`

### D4. Card pattern lặp lại 🟠

```jsx
className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
```

→ Đã có `<SectionSurface>` từ shellPrimitives nhưng không phải nơi nào cũng dùng. Slice 4 sẽ chuẩn hoá.

### D5. Form field pattern 🟡

```jsx
className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
```

→ Dùng `<input>` shadcn (`@/components/ui/input.tsx`) thay vì raw style.

---

## E. Migration strategy

### E1. Slice 4 strategy (recommended)

Vì có ~2000 occurrences trong ~105 files, **không thể fix tất cả trong 1 slice**. Đề xuất:

#### Phase 4.1 — Foundation (slice 4 hiện tại)
- Fix `primitives.tsx` StatusBadge (5 lines)
- Fix `AppShellWorkflowGuide.jsx` (loại bỏ trong slice 1.3)
- Build new components (FilterBar, ExportDropdown, ...) — **dùng tokens ngay từ đầu**
- Build `<StatusPill>` shared component
- Build `<DenseCard>` wrapper component (nếu cần)

#### Phase 4.2 — Top 20 hot files (slice riêng sau slice 5)
- Mỗi file 1 commit nhỏ
- Refactor 1 file/lần với gitnexus_impact trước
- 20 files × ~30 phút = ~10h work

#### Phase 4.3 — Long tail (slices 6+ tận dụng khi đã sửa page)
- Khi refactor page, thay luôn legacy classes trong page đó
- Slice 5 (5 pages) sẽ catch ~50% remaining
- Slice 6 (5 pages) sẽ catch ~30% remaining
- Slice 7+ residual

### E2. Automated migration tool (optional)

Có thể viết script migration:

**File**: `scripts/migrate-legacy-classes.mjs` (NEW, optional)

```js
// Pseudo-code
import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

const REPLACEMENTS = [
  { from: /\bbg-slate-50\b/g, to: 'bg-ds-surface-muted' },
  { from: /\bbg-slate-100\b/g, to: 'bg-ds-surface-muted' },
  { from: /\bbg-white\b/g, to: 'bg-ds-surface-card' },
  { from: /\btext-slate-500\b/g, to: 'text-ds-text-muted' },
  { from: /\btext-slate-700\b/g, to: 'text-ds-text-secondary' },
  // ... 30+ rules
];

const files = glob.sync('src/components/**/*.{tsx,jsx}');
for (const file of files) {
  let content = readFileSync(file, 'utf-8');
  for (const rule of REPLACEMENTS) {
    content = content.replace(rule.from, rule.to);
  }
  writeFileSync(file, content);
}
```

→ **Cảnh báo**: Migration tự động dễ sai vì:
- `bg-slate-100` có thể đúng cho 1 dark mode case
- `text-amber-700` có thể là brand color (không phải warning)
- Cần code review thủ công sau migration

→ **Khuyến nghị**: KHÔNG dùng tool tự động cho slice 4. Migrate thủ công, từng file, có gitnexus_impact + visual verify.

### E3. Tailwind config theme extension

**File**: `tailwind.config.ts` (cần check)

Đảm bảo expose tokens cho Tailwind:

```ts
theme: {
  extend: {
    colors: {
      'ds-surface-base': 'var(--ds-surface-base)',
      'ds-surface-card': 'var(--ds-surface-card)',
      'ds-surface-muted': 'var(--ds-surface-muted)',
      'ds-surface-raised': 'var(--ds-surface-raised)',
      'ds-surface-overlay': 'var(--ds-surface-overlay)',
      'ds-text-primary': 'var(--ds-text-primary)',
      'ds-text-secondary': 'var(--ds-text-secondary)',
      'ds-text-muted': 'var(--ds-text-muted)',
      'ds-text-muted-soft': 'var(--ds-text-muted-soft)',
      'ds-border-subtle': 'var(--ds-border-subtle)',
      'ds-border-strong': 'var(--ds-border-strong)',
      'ds-info': 'var(--ds-info)',
      'ds-success': 'var(--ds-success)',
      'ds-warning': 'var(--ds-warning)',
      'ds-destructive': 'var(--ds-destructive)',
      'ds-accent': 'var(--ds-accent)',
      'ds-accent-strong': 'var(--ds-accent-strong)',
      'ds-accent-soft': 'var(--ds-accent-soft)',
      'brand-50': 'var(--brand-50)',
      'brand-100': 'var(--brand-100)',
      'brand-500': 'var(--brand-500)',
      'brand-600': 'var(--brand-600)',
      'brand-700': 'var(--brand-700)',
    },
  },
},
```

→ Verify trong slice 1.1 (token foundation).

### E4. ESLint rule (defer)

Có thể thêm rule custom:

```js
// .eslintrc.js
rules: {
  'no-restricted-syntax': [
    'warn',
    {
      selector: "Literal[value=/\\b(bg|text|border)-(slate|amber|rose|sky|emerald)-/]",
      message: 'Use --ds-* tokens instead of hardcoded Tailwind colors',
    },
  ],
}
```

→ Defer until slice 8 hoặc later phase.

---

## F. Verification commands

### F1. Count legacy occurrences (baseline)

```powershell
# Tổng count
rtk grep -r "bg-(slate|amber|rose|sky|emerald|red|green|blue|yellow|orange|purple|pink|teal|cyan|indigo|violet|fuchsia|zinc|stone|gray|neutral)-" src/components/ --include="*.tsx" --include="*.jsx" | wc -l

# Per-file top 20
rtk grep -r "bg-slate-" src/components/ --include="*.tsx" --include="*.jsx" -c | sort -t: -k2 -nr | head -20
```

### F2. After slice 4 (target)

- `bg-slate-*` ≤ 50 (down from 123)
- `bg-white` ≤ 30 (down from 154)
- `text-(slate|amber|rose|...)-` ≤ 400 (down from 1,032)

### F3. After slice 7 (final)

- Total legacy ≤ 200 occurrences (down from 1,979)
- Remaining: only legitimate use cases (semantic colors, brand)

---

## G. Quick reference: replacement table

| Legacy class | Token replacement | Use case |
|-------------|-------------------|----------|
| `bg-white` | `bg-ds-surface-card` | Card background |
| `bg-slate-50/100` | `bg-ds-surface-muted` | Hover row, zebra |
| `bg-slate-200` | (often border) → `border-ds-border-subtle` | Divider |
| `bg-slate-800/900/950` | `bg-ds-surface-base` (dark) | Dark mode bg |
| `text-slate-400/500` | `text-ds-text-muted` | Helper text |
| `text-slate-600/700` | `text-ds-text-secondary` | Caption, label |
| `text-slate-800/900` | `text-ds-text-primary` | Body, heading |
| `text-amber-700/800/900` | `text-ds-warning` | Warning state |
| `text-emerald-600/700` | `text-ds-success` | Success state |
| `text-rose-500/600/700` | `text-ds-destructive` | Error state |
| `text-sky-500/600/700` | `text-ds-info` | Info state |
| `bg-emerald-50/100` | `bg-ds-success/10` | Success badge bg |
| `bg-amber-50/100` | `bg-ds-warning/10` | Warning badge bg |
| `bg-rose-50/100` | `bg-ds-destructive/10` | Error badge bg |
| `bg-sky-50/100` | `bg-ds-info/10` | Info badge bg |
| `border-slate-200/300` | `border-ds-border-subtle` | Default border |
| `border-slate-700/800` | `border-ds-border-subtle` (dark) | Dark border |
| `border-amber-200/300` | `border-ds-warning/30` | Warning border |
| `border-emerald-200/300` | `border-ds-success/20` | Success border |
| `border-rose-200/300` | `border-ds-destructive/20` | Error border |
| `border-sky-200/300` | `border-ds-info/20` | Info border |
| `ring-emerald-600/20` | `ring-ds-success/20` | Success ring |
| `ring-amber-600/20` | `ring-ds-warning/30` | Warning ring |
| `ring-rose-600/20` | `ring-ds-destructive/20` | Error ring |
| `shadow-sm/md` | giữ nguyên hoặc đổi `shadow-ds-sm/md` | Shadows |

---

## H. Sample fixes (5 files cụ thể)

### H1. `dataImporter/DataImporterCardResults.jsx` (top 3 hot file)

**Pattern lặp**: status pill cho row trong card list.

**Before** (sample line, line range cần check):
```jsx
<span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
  Đã duyệt
</span>
```

**After**:
```jsx
<StatusPill tone="success">Đã duyệt</StatusPill>
```

→ 1 component thay 8 dòng class. Refactor 30+ occurrences.

### H2. `hq-agency-manager/HQAgencyManagerControls.jsx`

**Before** (filter button):
```jsx
className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
```

**After**:
```jsx
className="rounded-full border border-ds-border-subtle bg-ds-surface-card px-3 py-1.5 text-sm text-ds-text-secondary hover:bg-ds-surface-muted"
```

### H3. `data-health-dashboard/DataHealthRolloutStatusPanel.jsx`

**Pattern**: status grid với 4 colors (emerald/amber/rose/sky)

**Before**:
```jsx
<div className="rounded-lg bg-emerald-50 p-3 text-emerald-700 ring-1 ring-emerald-200">
  ...OK 12...
</div>
```

**After** (sau khi `<StatusCard>` shared component có):
```jsx
<StatusCard tone="success" label="OK" count={12} />
```

### H4. `reporting/TeamDetailCard.jsx`

Card layout với many text-slate variants.

**Strategy**: Replace inline → wrap với `<MetricCard>` component (slice 4).

### H5. `reporting/StaffDetailCard.jsx`

Tương tự H4.

---

## I. Migration tracking

### I1. Bead structure

```
cng-0if (epic UX Review)
├── cng-0if.4 (slice 4 — components + token migration foundation)
│   ├── cng-0if.4.1 (foundation: StatusBadge, StatusPill component)
│   ├── cng-0if.4.2 (top 4 hot files: SyncPreview, Rollout, CardResults, TableBody)
│   └── cng-0if.4.3 (top 20 hot files batch)
└── (long tail trong slices 5-7)
```

### I2. Progress tracking trong task.md

Sau mỗi batch migrate, log:

```markdown
- Da reconcile <date> sau khi land batch <N> cua cng-0if.4.X; <count> occurrences migrated, top hot files <list>, residual <count>.
```

### I3. Verify command

Trước commit batch, count residual:

```powershell
rtk grep -r "bg-slate-\|bg-white\|text-slate-" src/components/ --include="*.tsx" --include="*.jsx" -c | rtk wc -l
```

→ So sánh với baseline trước slice.
