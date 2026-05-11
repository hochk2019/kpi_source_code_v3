# 08 — Test & TypeScript Fixes

> Hướng dẫn fix tất cả test fail hiện có + TypeScript errors + cách viết test mới cho component refactor.

---

## A. Trạng thái hiện tại

### A1. TypeScript

```powershell
rtk pnpm run typecheck:frontend
# Exit code: 0 ✅
```

→ **TypeScript hoàn toàn pass**. Không cần fix gì cho slice hiện tại.

### A2. Frontend tests

```powershell
rtk pnpm run test:frontend
# Long running (>10 minutes for full suite)
```

Trạng thái Slice 8.1 gần nhất:
- KPIAdjustments batch: **36 pass / 0 fail**
- KPICalculator batch: **5 pass / 0 fail**
- reporting* batch: **76 pass / 0 fail**
- rules* batch: **41 pass / 0 fail**
- useDataImporterActionGuards: **3 pass / 0 fail**
- useDataImporter* batch: **117 pass / 0 fail / 0 unhandled errors**

Ghi chú chạy test:
- Full `test:frontend` dễ chạy lâu và tạo log rất lớn.
- Dùng Vitest `--reporter=json` redirect ra `.vitest-*.json`, sau đó parse summary ngắn bằng Python.

### A3. Per-test breakdown

Theo các test file đã verified pass trong commits gần đây:
- `tests/server.seed.test.js` ✅
- `tests/businessSnapshotSqlite.test.js` ✅
- `tests/teamRosterSqlite.test.js` ✅
- `tests/reportingProjectionSqlite.test.js` ✅
- `tests/auth.test.jsx` ✅
- `tests/appShellFrame.test.jsx` ✅
- `tests/commandCenter.test.jsx` ✅
- `tests/dataImporter.preview.test.jsx` ✅
- `tests/reportViewer.test.jsx` ✅

→ **Smoke core test pass**. Failing là edge case test files.

### A4. Component + a11y tests (Slice 8.2-8.4)

New test files added:
- `tests/ExportDropdown.test.tsx` — **9 pass** (trigger, dropdown, onExport, disabled, loading, close)
- `tests/a11y.test.tsx` — **8 pass** (axe-core for PageHeader, InfoTooltip, EmptyState, PermissionBanner, BulkActionBar, LoadingState, FilterBar, ExportDropdown)
- `tests/playwright/visual-regression.spec.js` — screenshot baselines for 5 pages (needs --update-snapshots)

Existing component tests (all pass):
- `tests/PageHeader.test.tsx` — 8 pass
- `tests/InfoTooltip.test.tsx` — 5 pass
- `tests/FilterBar.test.tsx` — 7 pass
- `tests/EmptyState.test.tsx` — 8 pass
- `tests/PermissionBanner.test.tsx` — 6 pass
- `tests/BulkActionBar.test.tsx` — 7 pass
- `tests/LoadingState.test.tsx` — 8 pass

**Total: 66 pass / 0 fail across 9 component + a11y test files**

---

## B. Test fail cần fix

### B1. `tests/ConflictResolutionDialog.test.jsx` ✅

**5 tests fail** vì `getByRole("dialog")` returns multiple elements.

**Root cause**: Cấu trúc Radix Dialog hiện tại render:
- 1 Overlay (role="dialog" cho overlay)
- 1 Content (role="dialog" cho content panel)

→ Test cũ giả định chỉ 1 element role="dialog".

**Fix** (slice 8.1):

```diff
- const dialog = screen.getByRole("dialog");
+ const dialogs = screen.getAllByRole("dialog");
+ const dialog = dialogs.find(d => d.id === "conflict-title-content"); // hoặc tương tự
```

Hoặc tốt hơn: dùng `getByLabelText`:

```tsx
// Nếu Dialog có aria-labelledby="conflict-title"
const dialog = screen.getByLabelText(/Xung đột phiên bản/i);
```

Hoặc dùng `data-testid`:

```tsx
// Component
<DialogContent data-testid="conflict-resolution-dialog">

// Test
const dialog = screen.getByTestId("conflict-resolution-dialog");
```

**Status**: đã ổn định ở batch trước; tiếp tục tránh `getByRole("dialog")` đơn lẻ khi Radix render nhiều dialog-like nodes.

### B2. DOM/text assertion updates ✅/🟡

Đã áp dụng cho các cụm MSTAssignment, KPIAdjustments, KPICalculator, reporting, rules.
Phần còn lại cần tiếp tục trong `useDataImporter*` fail cluster.

**Pattern fix**:
```diff
- expect(screen.getByText("Quản lý gán MST cho doanh nghiệp")).toBeInTheDocument();
+ expect(screen.getByText(/MST/i)).toBeInTheDocument();
+ // Hoặc dùng getByRole/getByLabelText/getByTestId thay vì text query
```

### B3. Snapshot tests stale 🟡

Sau slice 1-7, nhiều snapshot sẽ stale do DOM thay đổi.

**Fix**:
```powershell
rtk pnpm exec vitest run -u  # update snapshots
```

→ **CHỈ chạy sau khi đã verify visual đúng**. Đừng update snapshot bừa bãi.

### B4. `useDataImporter*` async hook/action updates ✅

**Status hiện tại**: batch `useDataImporter*` đạt **117 pass / 0 fail / 0 unhandled errors**.

**Root cause chính**:
- Một số hook action đã chuyển sang async/Promise.
- Test cũ vẫn assert sync return value hoặc `window.confirm`.
- Một số flows dùng AppDialog/async alert/confirm thay vì browser confirm trực tiếp.

**Files đã ổn định trong batch cuối**:
- `tests/useDataImporterDuplicateReview.test.jsx`
- `tests/useDataImporterEditAccess.test.jsx`
- `tests/useDataImporterFilterPresets.test.jsx`
- `tests/useDataImporterImportFlow.test.jsx`
- `tests/useDataImporterLicenseExclusions.test.jsx`
- `tests/useDataImporterListPreferences.test.jsx`
- `tests/useDataImporterRowMutations.test.jsx`
- `tests/useDataImporterSavedEdits.test.jsx`
- `tests/useDataImporterSavedHighlights.test.jsx`
- `tests/useDataImporterSavedSession.test.jsx`
- `tests/useDataImporterSelectionBulkActions.test.jsx`
- `tests/useDataImporterSync.test.jsx`

---

## C. Test patterns cần áp dụng cho component mới

### C1. Render với context

Mọi component test phải wrap đủ providers:

```tsx
import { render } from '@testing-library/react';
import { ThemeProvider } from '@/designSystem/ThemeProvider';
import { AppDialogProvider } from '@/hooks/useAppDialog';

function renderWithProviders(ui: ReactNode) {
  return render(
    <ThemeProvider>
      <AppDialogProvider>
        {ui}
      </AppDialogProvider>
    </ThemeProvider>
  );
}
```

→ Tạo helper trong `tests/_helpers/renderWithProviders.tsx` (NEW).

### C2. Query priority (RTL best practice)

Theo Testing Library priority:

1. `getByRole(role, { name })` — accessible name
2. `getByLabelText` — form fields
3. `getByPlaceholderText` — inputs without label
4. `getByText` — non-interactive content
5. `getByDisplayValue` — form values
6. `getByAltText` — images
7. `getByTitle` — title attribute
8. `getByTestId` — last resort

→ **Avoid `getByText` cho interactive elements**. Dùng `getByRole`.

### C3. User events

Dùng `@testing-library/user-event` v14+ pattern (`setup()`):

```tsx
import { userEvent } from '@testing-library/user-event';

test('click button triggers callback', async () => {
  const user = userEvent.setup();
  const onClick = vi.fn();
  render(<MyButton onClick={onClick}>Save</MyButton>);
  
  await user.click(screen.getByRole('button', { name: /save/i }));
  
  expect(onClick).toHaveBeenCalledOnce();
});
```

### C4. Async assertions

```tsx
import { waitFor, screen } from '@testing-library/react';

test('shows loading then data', async () => {
  render(<DataPanel />);
  
  expect(screen.getByText(/đang tải/i)).toBeInTheDocument();
  
  await waitFor(() => {
    expect(screen.getByText(/dữ liệu/i)).toBeInTheDocument();
  });
});
```

### C5. Accessibility tests

```tsx
import { axe } from 'vitest-axe';

test('has no a11y violations', async () => {
  const { container } = render(<MyComponent />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

---

## D. Test plan cho 13 components mới

### D1. PageHeader

**File**: `tests/PageHeader.test.tsx`

```tsx
describe('PageHeader', () => {
  test('renders title', () => { ... });
  test('renders eyebrow above title', () => { ... });
  test('renders subtitle below title', () => { ... });
  test('renders meta items', () => { ... });
  test('renders actions', () => { ... });
  test('back link triggers callback', async () => { ... });
  test('info tooltip opens on click', async () => { ... });
  test('truncates long title with title attr', () => { ... });
  test('sticky mode applies sticky class', () => { ... });
  test('mobile responsive (gap, wrap)', () => { ... });
  test('has no a11y violations', async () => { ... });
});
```

### D2. FilterBar

**File**: `tests/FilterBar.test.tsx`

```tsx
describe('FilterBar', () => {
  test('renders Search sub-component', () => { ... });
  test('renders Select sub-components', () => { ... });
  test('renders DateRange', () => { ... });
  test('renders Toggle', () => { ... });
  test('Reset button visible when activeFilterCount > 0', () => { ... });
  test('onReset triggered', async () => { ... });
  test('mobile responsive (vertical stack)', () => { ... });
  test('search debounce works', async () => { ... });
  test('collapsible mode', async () => { ... });
});
```

### D3. ExportDropdown

**File**: `tests/ExportDropdown.test.tsx`

```tsx
describe('ExportDropdown', () => {
  test('renders trigger button', () => { ... });
  test('opens dropdown on click', async () => { ... });
  test('renders all items', async () => { ... });
  test('onExport called with correct item', async () => { ... });
  test('shows loading state during export', async () => { ... });
  test('disabled item not clickable', async () => { ... });
  test('disabled item shows tooltip reason', async () => { ... });
  test('keyboard navigation works', async () => { ... });
  test('closes after select', async () => { ... });
});
```

### D4. EmptyState

**File**: `tests/EmptyState.test.tsx`

```tsx
describe('EmptyState', () => {
  test('renders title only', () => { ... });
  test('renders icon + title + description', () => { ... });
  test('renders actions', () => { ... });
  test('size compact has smaller padding', () => { ... });
  test('size lg has larger icon', () => { ... });
  test('tone variants apply correct color', () => { ... });
  test('action click triggers callback', async () => { ... });
  test('has no a11y violations', async () => { ... });
});
```

### D5. PermissionBanner

**File**: `tests/PermissionBanner.test.tsx`

```tsx
describe('PermissionBanner', () => {
  test('renders title and description', () => { ... });
  test('level info has correct color', () => { ... });
  test('level warning has correct color', () => { ... });
  test('level error has correct color', () => { ... });
  test('renders actions', () => { ... });
  test('action click triggers callback', async () => { ... });
  test('dismissible: × hides banner', async () => { ... });
  test('persistKey: dismiss state persists in localStorage', async () => { ... });
  test('persistKey: restored on mount', () => { ... });
  test('has role="alert"', () => { ... });
  test('has no a11y violations', async () => { ... });
});
```

### D6. BulkActionBar

**File**: `tests/BulkActionBar.test.tsx`

```tsx
describe('BulkActionBar', () => {
  test('hidden when selectedCount=0', () => { ... });
  test('visible when selectedCount>0', () => { ... });
  test('shows X/Y format', () => { ... });
  test('renders actions', () => { ... });
  test('action click triggers callback', async () => { ... });
  test('disabled action not clickable', () => { ... });
  test('Clear button triggers onClear', async () => { ... });
  test('ESC key clears selection', async () => { ... });
  test('Select all triggers onSelectAll', async () => { ... });
  test('animates slide-up on appear', () => { ... });
});
```

### D7. InfoTooltip, PageTabs, LoadingState, KeyValueList, MetricCard, DataTable extension

(Tương tự pattern trên — tham khảo `05-component-library.md` để có spec chi tiết)

---

## E. Page test refactor (Slice 5+)

### E1. Pattern cho page restructure

Khi refactor page sang dùng `<PageHeader>`, `<FilterBar>`, ..., test cũ sẽ fail vì:
- DOM structure thay đổi (hero block → PageHeader)
- Class name thay đổi
- Description text bị bỏ

**Fix pattern**:

```tsx
// BEFORE (test query bằng class hoặc text Việt)
test('renders page header', () => {
  render(<KPIAdjustments />);
  expect(screen.getByText(/Quản lý, điều chỉnh và xét duyệt/)).toBeInTheDocument();
});

// AFTER (test query semantic)
test('renders page header', () => {
  render(<KPIAdjustments />);
  expect(screen.getByRole('heading', { level: 1, name: /Điều chỉnh KPI/i })).toBeInTheDocument();
  // Description đã bỏ — chỉ verify title
});
```

### E2. Test tabs trong page

```tsx
test('switches to Danh sách tab on click', async () => {
  const user = userEvent.setup();
  render(<KPIAdjustments />);
  
  await user.click(screen.getByRole('tab', { name: /danh sách/i }));
  
  expect(screen.getByRole('tabpanel', { name: /danh sách/i })).toBeInTheDocument();
});
```

### E3. Test URL param sync

```tsx
test('persists active tab to URL', async () => {
  const user = userEvent.setup();
  render(<KPIAdjustments />);
  
  await user.click(screen.getByRole('tab', { name: /lịch sử/i }));
  
  expect(window.location.search).toContain('pageTab=history');
});
```

### E4. Test permission banner

```tsx
test('shows PermissionBanner when canEdit=false', () => {
  render(<KPIAdjustments canEdit={false} />);
  expect(screen.getByRole('alert')).toHaveTextContent(/quyền hạn chế/i);
});

test('hides PermissionBanner when canEdit=true', () => {
  render(<KPIAdjustments canEdit={true} />);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
```

### E5. Test empty state

```tsx
test('shows EmptyState when no data', async () => {
  // Mock empty data
  vi.mocked(getKpiAdjustments).mockReturnValue([]);
  
  render(<KPIAdjustments />);
  
  await waitFor(() => {
    expect(screen.getByText(/chưa có điều chỉnh/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /thêm điều chỉnh đầu tiên/i })).toBeInTheDocument();
  });
});
```

---

## F. Visual regression với Playwright

### F1. Setup

**File**: `playwright.config.ts` (existing)

Đảm bảo có `expect.toHaveScreenshot` enabled.

**File**: `tests/playwright/visual-regression.spec.ts` (NEW)

```ts
import { test, expect } from '@playwright/test';

const PAGES = [
  { id: 'dashboard', section: 'overview', tab: 'dashboard' },
  { id: 'import', section: 'operations', tab: 'import' },
  { id: 'mst-hq', section: 'operations', tab: 'mst-hq' },
  { id: 'adjustments', section: 'performance', tab: 'adjustments' },
  { id: 'reports', section: 'performance', tab: 'reports' },
];

test.describe('Visual regression', () => {
  for (const { id, section, tab } of PAGES) {
    test(`Page: ${id}`, async ({ page }) => {
      await page.goto(`/?section=${section}&tab=${tab}`);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveScreenshot(`${id}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
    });
  }
});
```

### F2. Run

```powershell
# First run — capture baselines
rtk pnpm exec playwright test tests/playwright/visual-regression.spec.ts --update-snapshots

# Subsequent runs — diff
rtk pnpm exec playwright test tests/playwright/visual-regression.spec.ts
```

### F3. Acceptance threshold

Default Playwright cho phép 0.2 mismatch. Cho phép tuning:

```ts
await expect(page).toHaveScreenshot(`${id}.png`, {
  threshold: 0.3,  // 30% difference allowed
  maxDiffPixels: 100,
});
```

---

## G. Accessibility (a11y) tests

### G1. Setup

`vitest-axe` đã có deps. Cấu hình:

**File**: `vitest.setup.js`

```js
import { expect } from 'vitest';
import * as matchers from 'vitest-axe/matchers';

expect.extend(matchers);
```

### G2. Per-page a11y test

**File**: `tests/a11y.test.tsx` (NEW)

```tsx
import { axe } from 'vitest-axe';
import { renderWithProviders } from './_helpers/renderWithProviders';

const PAGES = [
  { name: 'Dashboard', component: AppDashboardLanding },
  { name: 'KPI Adjustments', component: KPIAdjustments },
  // ...
];

describe.each(PAGES)('A11y: $name', ({ component: Component }) => {
  test('has no a11y violations', async () => {
    const { container } = renderWithProviders(<Component />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

### G3. Specific WCAG checks

Kiểm tra:
- Color contrast (text-ds-text-muted-soft trên muted bg)
- Form labels
- Heading hierarchy (h1 → h2 → h3)
- Focus indicators
- Keyboard navigation
- Skip links

---

## H. Performance budget

### H1. Lighthouse audit

```powershell
rtk pnpm build
rtk pnpm preview &  # Background
rtk pnpm exec lighthouse http://localhost:5173 --output=json --quiet > lighthouse-snapshot.json
```

Target metrics:
- Performance ≥ 80
- Accessibility ≥ 95
- Best Practices ≥ 90
- SEO ≥ 80 (internal app — không quan trọng)

### H2. Bundle size

```powershell
rtk pnpm build
ls -lh dist/assets/*.js | sort -k5 -h
```

Target: main bundle ≤ 500KB (gzipped).

---

## I. Common pitfalls khi update tests

### Pitfall 1: Provider missing

```
TypeError: Cannot read properties of undefined (reading 'theme')
```

→ Wrap render với `<ThemeProvider>`.

### Pitfall 2: Async render

```
Unable to find an element by ...
```

→ Dùng `waitFor`, `findBy*` thay vì `getBy*`.

### Pitfall 3: Multiple matches

```
Found multiple elements with role "dialog"
```

→ Dùng `getAllByRole` + filter, hoặc `getByLabelText`/`getByTestId`.

### Pitfall 4: Stale closure

```tsx
// BAD
test('updates state', async () => {
  let count = 0;
  const onClick = () => count++;
  render(<Button onClick={onClick} />);
  await user.click(screen.getByRole('button'));
  expect(count).toBe(1); // OK ở turn này, fail ở turn sau
});

// GOOD
test('updates state', async () => {
  const onClick = vi.fn();
  render(<Button onClick={onClick} />);
  await user.click(screen.getByRole('button'));
  expect(onClick).toHaveBeenCalledOnce();
});
```

### Pitfall 5: Snapshot trượt

```
Snapshot does not match
```

→ ĐỪNG update bừa. Inspect diff trước, verify visual đúng, sau đó update.

---

## J. Test infrastructure improvements (defer)

- **Storybook** — defer, không có hiện tại
- **Chromatic** visual regression as a service — defer
- **MSW** mock service worker — đã có pattern tương tự (vi.mocked)
- **Playwright Component Testing** — defer

---

## K. Quick reference

```powershell
# Typecheck
rtk pnpm run typecheck:frontend

# Test all
rtk pnpm run test:frontend

# Test specific file
rtk pnpm exec vitest run tests/PageHeader.test.tsx

# Test with watch
rtk pnpm exec vitest tests/PageHeader.test.tsx

# Test with UI
rtk pnpm exec vitest --ui

# Update snapshots
rtk pnpm exec vitest run -u

# Smoke core
rtk pnpm run test:smoke:frontend-core

# Playwright
rtk pnpm exec playwright test

# Lint
rtk pnpm lint
```
