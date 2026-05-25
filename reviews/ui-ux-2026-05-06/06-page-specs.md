# 06 — Page-by-page Specs

> Wireframe ASCII + spec cho từng page sau khi áp dụng design direction. Spec này là **target state** cho slice 5 (page restructure).

---

## Cấu trúc tham chiếu chung (post-slice 1+2+3)

```
┌─ App Header (48px) ────────────────────────────────────────┐
│ [Logo] Golden Logistics      [θ Theme] [🔔] [👤 user]      │
├─────────┬──────────────────────────────────────────────────┤
│ Sidebar │ Page Header (48-72px)                            │
│ 200px   │ [eyebrow • Title (i)] [meta]            [Action] │
│         ├──────────────────────────────────────────────────┤
│ • Tab1  │ FilterBar / Toolbar (48px)                       │
│ • Tab2  │ [Search] [Filter1] [Filter2]      [Export ▾]    │
│         ├──────────────────────────────────────────────────┤
│         │                                                   │
│         │ Content (variable)                                │
│         │                                                   │
│         ├──────────────────────────────────────────────────┤
│         │ BulkActionBar (sticky, when select)              │
└─────────┴──────────────────────────────────────────────────┘
```

---

## Page 1 — Dashboard / Tổng quan KPI

**Route**: `?section=overview&tab=dashboard`  
**File**: `src/components/appShell/AppDashboardLanding.tsx`

### Wireframe

```
┌─ Page Header ─────────────────────────────────────────────┐
│ TỔNG QUAN                                                  │
│ Tổng quan KPI · Kỳ 30/04 → 30/05/2026 (i)         [↻]     │
└────────────────────────────────────────────────────────────┘
┌─ Permission banner (chỉ khi viewer) ──────────────────────┐
│ ⚠ Quyền hạn chế · [Đăng nhập admin] [×]                   │
└────────────────────────────────────────────────────────────┘
┌─ Metrics grid (2 cols mobile, 4 cols desktop) ────────────┐
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│ │ Tờ khai  │ │ Điểm KPI │ │ Điều chỉnh│ │ Cty quản │     │
│ │ 1,234    │ │ 567.89   │ │ Approved 8│ │ lý 45    │     │
│ │ ↑12%     │ │ ↑5%      │ │ Pending 2 │ │ 12 đội   │     │
│ │ ▁▂▃▄▅▆▇  │ │ ▁▃▅▇     │ │           │ │          │     │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
└────────────────────────────────────────────────────────────┘
┌─ Trend + Distribution (2 cols, 1 col mobile) ─────────────┐
│ ┌─ Xu hướng KPI 6 kỳ ────┐ ┌─ Phân bổ tổ đội ────┐       │
│ │  Line chart              │ │  Donut hoặc empty   │       │
│ │  240px                  │ │  state nếu 0 data   │       │
│ └─────────────────────────┘ └─────────────────────┘       │
└────────────────────────────────────────────────────────────┘
┌─ Top staff & quick links ──────────────────────────────────┐
│ ┌─ Top KPI nhân viên ─────┐ ┌─ Lối tắt ──────────┐        │
│ │ 1. Nguyễn A — 234.5    │ │ • Mở Import Data   │        │
│ │ 2. Trần B — 198.2      │ │ • Quy tắc KPI      │        │
│ │ 3. ...                 │ │ • Báo cáo KPI      │        │
│ └────────────────────────┘ └────────────────────┘        │
└────────────────────────────────────────────────────────────┘
```

### Specs

- **PageHeader**: title + meta period + reload action
- **No tabs** trong page (đây là dashboard)
- **MetricCards**: dùng `<MetricCard>` mới với delta + sparkline
- **Empty state**: nếu 0 records → mỗi card hiển thị "Chưa có dữ liệu" + CTA "Mở Import Data →"
- **Pie chart**: nếu `kpiData.every(d => d.value === 0)` → render `<EmptyState size="compact" icon={PieChart} ... />` thay vì pie full màu
- **Quick actions**: list compact (1 dòng/item), không phải 4 cards to
- **Bỏ**: "Tóm tắt điều hành KPI" header với description, "Xu hướng KPI 6 kỳ gần nhất" placeholder duplicate
- **Sticky**: PageHeader sticky on scroll

### Files cần edit (slice 5)

- `src/components/appShell/AppDashboardLanding.tsx`
- `src/hooks/useDashboardKpiOverview.js` (kiểm tra data shape, không sửa logic)
- `src/components/reporting/ReportingExecutiveSummaryPanel.jsx` → có thể merge vào `AppDashboardLanding`
- `src/components/reporting/SummaryCard.jsx` → migrate to `<MetricCard>`
- `src/components/reporting/TeamPieWidget.*` → empty state fix

---

## Page 2 — Import Data

**Route**: `?section=operations&tab=import`  
**File**: `src/components/dataImporter/DataImporterShell.jsx` + 96 sub-files

### Wireframe (overview state)

```
┌─ Page Header ─────────────────────────────────────────────┐
│ VẬN HÀNH                                                   │
│ Import Data · 1,234 tờ khai (i)         [Tải file ECUS ▾]│
└────────────────────────────────────────────────────────────┘
┌─ Permission banner ────────────────────────────────────────┐
│ ⚠ Quyền hạn chế · [Đăng nhập admin] [×]                   │
└────────────────────────────────────────────────────────────┘
┌─ Page Tabs ─────────────────────────────────────────────────┐
│ Bảng tờ khai (1234)  Xem trước (12)  Đồng bộ ECUS  Lịch sử│
└────────────────────────────────────────────────────────────┘
┌─ Tab "Bảng tờ khai" ───────────────────────────────────────┐
│ FilterBar:                                                  │
│ [Tìm số TK...] [Loại▾] [Trạng thái▾] [Kỳ▾]      [Export▾]│
├────────────────────────────────────────────────────────────┤
│ DataTable (sticky header, virtualized nếu > 1000 rows):   │
│ ☑ │ Số TK │ MST │ Tên cty │ Loại │ Ngày │ Trạng thái     │
│ ─────────────────────────────────────────────────         │
│ ☑ │ ...                                                    │
│ (50 rows/page, paginated)                                  │
└────────────────────────────────────────────────────────────┘
┌─ BulkActionBar (sticky bottom khi select) ────────────────┐
│ ✓ 12/1234 selected [Clear]   [Sync] [Export] [Delete]    │
└────────────────────────────────────────────────────────────┘
```

### Tabs structure

| Tab | Mục đích | Data source |
|-----|----------|-------------|
| Bảng tờ khai | Browse/edit imported declarations | `getDeclarations()` |
| Xem trước | Preview file mới upload trước khi commit | `<DataImporterImportPreviewSummary>` |
| Đồng bộ ECUS | Schedule + sync status | `<DataImporterSyncConfigPanel>` |
| Lịch sử | Audit trail | (mới) |

### Specs

- **Primary action** (PageHeader): "Tải file ECUS ▾" — dropdown 2 options:
  - "Upload XLSX..."
  - "Đồng bộ trực tiếp ECUS"
- **PageTabs**: count badge cho từng tab
- **DataTable**: dùng `<DataTable>` extended với selection, column resize, virtualized
- **BulkActionBar**: hiển thị khi `selection.size > 0`
- **Permissions**: 1 banner duy nhất nếu `!canEdit` (xoá 2 alerts xếp chồng cũ)
- **Bỏ**: WorkflowGuide banner, "Last sync summary card" (di chuyển vào tab Đồng bộ ECUS)

### Files cần edit (slice 5 + 6)

Đây là module lớn nhất (97 files). Refactor làm nhiều bước:
- Slice 5: chỉ tách shell-level (PageHeader, PageTabs, FilterBar, BulkActionBar) — keep all sub-components
- Slice 6 (optional): refactor sub-components nếu time cho phép

Files chính:
- `src/components/dataImporter/DataImporterShell.jsx`
- `src/components/dataImporter/DataImporterTableHeader.jsx`
- `src/components/dataImporter/DataImporterTableBody.jsx`
- `src/components/dataImporter/DataImporterFilterPresetControls.jsx`
- `src/components/dataImporter/DataImporterListControlsPanel.jsx`
- `src/components/dataImporter/DataImporterSelectionActions.jsx` → merge vào `<BulkActionBar>`
- `src/components/dataImporter/DataImporterWorkflowGuide.jsx` → xoá

---

## Page 3 — Gán MST & Đại lý HQ (gộp)

**Route**: `?section=operations&tab=mst-hq` (id mới)  
**Files**: `src/components/MSTAssignment.tsx` + `src/components/HQAgencyManager.tsx`

### Lý do gộp

- Cả 2 quản lý "đối tác / partner data" cùng ngữ cảnh
- User flow: import tờ khai → gán MST cho team → set agency cho MST
- Hiện tại tách 2 tab riêng → user phải chuyển qua chuyển lại

### Wireframe

```
┌─ Page Header ─────────────────────────────────────────────┐
│ VẬN HÀNH                                                   │
│ Gán MST & Đại lý HQ (i)            [Lưu thay đổi (3)]    │
│  └ Tooltip: "Quản lý phân bổ MST cho team và đại lý HQ"  │
└────────────────────────────────────────────────────────────┘
┌─ Page Tabs ────────────────────────────────────────────────┐
│ MST → Tổ đội (1234)   MST → Đại lý HQ (567)   Lịch sử (89)│
└────────────────────────────────────────────────────────────┘
┌─ Tab "MST → Tổ đội" ──────────────────────────────────────┐
│ FilterBar:                                                  │
│ [Tìm MST/Cty...] [Tổ đội▾] [Trạng thái▾] [Bộ lọc nâng cao▾]│
├────────────────────────────────────────────────────────────┤
│ DataTable (inline edit cho cột "Người phụ trách"):        │
│ ☑ │ MST │ Tên cty │ Người phụ trách │ Trạng thái │ ...   │
└────────────────────────────────────────────────────────────┘
```

### Tabs

| Tab | Mục đích |
|-----|----------|
| MST → Tổ đội | Hiện `MSTAssignment` |
| MST → Đại lý HQ | Hiện `HQAgencyManager` |
| Lịch sử | Audit trail gộp 2 nguồn |

### Specs

- Gộp routing: tab id mới `mst-hq` (cập nhật `appShellNavigation.ts`)
- Sub-tabs trong page: dùng `<PageTabs>`
- 2 components gốc (MSTAssignment, HQAgencyManager) giữ nguyên content nhưng:
  - Bỏ section header description
  - Bỏ permission alert duplicate
  - Tích hợp `<FilterBar>` chung
  - Bỏ "Bộ lọc nhân viên" + "Bộ lọc lịch sử" panels riêng → merge vào FilterBar advanced
- **Primary action** (PageHeader): "Lưu thay đổi (n)" — count dirty rows, disabled khi 0

### Files cần edit (slice 5)

- `src/lib/appShellNavigation.ts` — thêm id `mst-hq`, ẩn id cũ `mst` và `hq`
- `src/components/MSTAssignment.tsx` — bỏ section description, integrate FilterBar
- `src/components/HQAgencyManager.tsx` — bỏ section description, fix empty state (image 2)
- `src/components/KPICalculator.tsx` (router) — handle tab `mst-hq` render container với PageTabs

### Migration concern

- URL params backward compat: `?tab=mst` redirect sang `?tab=mst-hq&pageTab=mst`
- Memory key trong localStorage giữ nguyên (data structure không đổi)

---

## Page 4 — Quản lý Tổ đội

**Route**: `?section=performance&tab=teams`  
**File**: `src/components/TeamManager.tsx` + `src/components/team-manager/`

### Wireframe

```
┌─ Page Header ─────────────────────────────────────────────┐
│ HIỆU SUẤT                                                  │
│ Quản lý Tổ đội · 12 đội (i)         [Lưu tổ đội (5)]     │
└────────────────────────────────────────────────────────────┘
┌─ 2-column layout (1 col mobile) ───────────────────────────┐
│ ┌─ Sidebar 240px ─┐ ┌─ Detail panel ──────────────────┐  │
│ │ + Thêm tổ        │ │ Tổ "Đội 1" [Edit] [Delete]    │  │
│ │ ────────────    │ │ ─────────────────────────────  │  │
│ │ • Đội 1 (12)    │ │ Members:                       │  │
│ │ • Đội 2 (8)     │ │ ┌────────────────────────────┐ │  │
│ │ • Đội 3 (5)     │ │ │ + Thêm thành viên          │ │  │
│ │ • ...           │ │ ├────────────────────────────┤ │  │
│ │                  │ │ │ • Nguyễn A [Edit] [×]     │ │  │
│ │                  │ │ │ • Trần B [Edit] [×]       │ │  │
│ │                  │ │ │ • ...                      │ │  │
│ │                  │ │ └────────────────────────────┘ │  │
│ │                  │ │                                  │  │
│ │                  │ │ [Tabs: Companies | History]    │  │
│ │                  │ │ DataTable companies              │  │
│ └─────────────────┘ └────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### Specs

- Layout 2 cột: sidebar list + detail panel
- Detail panel có internal tabs: "Thành viên / Công ty / Lịch sử"
- Empty state nếu 0 teams: hero illustration + "Tạo tổ đội đầu tiên"
- Drag-and-drop reorder (defer)

---

## Page 5 — Quy tắc KPI

**Route**: `?section=performance&tab=rules`  
**File**: `src/components/RulesEditor.tsx` + `src/components/rules-editor/`

### Wireframe

```
┌─ Page Header ─────────────────────────────────────────────┐
│ HIỆU SUẤT                                                  │
│ Quy tắc KPI · v2 · Hiệu lực từ 01/05 (i)  [Áp dụng v3]   │
└────────────────────────────────────────────────────────────┘
┌─ Page Tabs ────────────────────────────────────────────────┐
│ Đang áp dụng (v2)   Lịch sử phiên bản   Tạo phiên bản mới │
└────────────────────────────────────────────────────────────┘
┌─ Tab "Đang áp dụng" ──────────────────────────────────────┐
│ Card: Phiên bản v2 · Hiệu lực 01/05 → ∞                  │
│  ─── Tổng quan: 12 quy tắc, 4 nhóm                       │
│  ─── [Sao chép] [Xuất XLSX]                               │
│ ─────────────────────────────────────────                 │
│ Accordion (collapsible):                                   │
│ ▸ Nhóm "Hỗ trợ thông quan" (4 rules)                      │
│ ▾ Nhóm "Giấy phép" (3 rules)                              │
│   • Loại 1 · 0.5 đ/đơn                                    │
│   • Loại 2 · 0.7 đ/đơn                                    │
│   • Loại 3 · 1.0 đ/đơn                                    │
│ ▸ Nhóm "Phụ thu" (3 rules)                                │
│ ▸ Nhóm "Khác" (2 rules)                                   │
└────────────────────────────────────────────────────────────┘
```

### Specs

- 3 sub-tabs: hiện áp dụng / lịch sử / tạo mới
- Accordion mỗi nhóm rules → progressive disclosure
- Read-only cho viewer, edit cho admin
- Diff view khi compare 2 versions (defer)

---

## Page 6 — Điểm KPI +/- (Adjustments)

**Route**: `?section=performance&tab=adjustments`  
**File**: `src/components/KPIAdjustments.tsx` + `src/components/kpi-adjustments/`

### Wireframe

```
┌─ Page Header ─────────────────────────────────────────────┐
│ HIỆU SUẤT                                                  │
│ Điều chỉnh KPI +/- (i)  [Cài đặt] [+ Thêm điều chỉnh]    │
└────────────────────────────────────────────────────────────┘
┌─ Page Tabs ────────────────────────────────────────────────┐
│ Tổng quan   Danh sách (245)   Lịch sử thao tác             │
└────────────────────────────────────────────────────────────┘
┌─ Tab "Tổng quan" ──────────────────────────────────────────┐
│ ┌─ Stats grid (4 cols) ─────────────────────────────────┐ │
│ │ Tổng cộng | Approved | Pending | Rejected             │ │
│ │ 245       | 200      | 35      | 10                   │ │
│ └────────────────────────────────────────────────────────┘ │
│ ┌─ Phân loại theo nhóm (chart) ──────────────────────────┐ │
│ │ [Bar chart]                                             │ │
│ └────────────────────────────────────────────────────────┘ │
│ ┌─ Top 5 nhân viên có nhiều adjustments ────────────────┐ │
│ └────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
┌─ Tab "Danh sách" ──────────────────────────────────────────┐
│ FilterBar:                                                  │
│ [Tìm...] [Trạng thái▾] [Loại▾] [Kỳ▾] [Người tạo▾]         │
├────────────────────────────────────────────────────────────┤
│ DataTable                                                   │
└────────────────────────────────────────────────────────────┘
```

### Specs

- 3 tabs: Tổng quan (stats) / Danh sách (table) / Lịch sử
- "Cài đặt" → mở `<AppDialog>` thay vì tab riêng
- "+ Thêm điều chỉnh" → mở `<AppDialog>` form
- Detail row → mở `<AppDialog>` chi tiết với approval workflow
- Settings: collapsible accordion theo nhóm KPI, defaults có giá trị thật (0.5 thay vì `_`)

### Files cần edit (slice 5)

- `src/components/KPIAdjustments.tsx` (762 LOC) — restructure thành tabs
- `src/components/kpi-adjustments/panels/KpiAdjustmentSettingsDialog.jsx` — fix placeholders
- `src/components/kpi-adjustments/panels/KpiAdjustmentOverviewPanel.jsx`
- `src/components/kpi-adjustments/panels/KpiAdjustmentListPanel.jsx`

---

## Page 7 — Báo cáo KPI / Report Center

**Route**: `?section=performance&tab=reports`  
**File**: `src/components/ReportViewer.tsx` + `src/components/reporting/`

### Wireframe

```
┌─ Page Header ─────────────────────────────────────────────┐
│ HIỆU SUẤT                                                  │
│ Report Center · Kỳ 30/04 → 30/05 (i)  [Mẫu▾] [Xuất▾]     │
└────────────────────────────────────────────────────────────┘
┌─ FilterBar (sticky) ───────────────────────────────────────┐
│ [Khoảng kỳ▾] [Bộ quy tắc▾] [Tổ đội▾] [Nhân viên▾]  [↻]   │
└────────────────────────────────────────────────────────────┘
┌─ Page Tabs ────────────────────────────────────────────────┐
│ Tổng quan  Nhân viên (45)  Tổ đội (12)  Lịch gửi  Mẫu     │
└────────────────────────────────────────────────────────────┘
┌─ Tab "Tổng quan" ──────────────────────────────────────────┐
│ Metrics + charts (như Dashboard nhưng có drill-down)      │
└────────────────────────────────────────────────────────────┘
┌─ Tab "Nhân viên" ──────────────────────────────────────────┐
│ DataTable: Tên | Tổ đội | Tờ khai | Điểm KPI | Adj | Total│
│ Click row → drawer chi tiết KPI theo loại                 │
└────────────────────────────────────────────────────────────┘
```

### Specs

- 5 tabs: Tổng quan / Nhân viên / Tổ đội / Lịch gửi / Mẫu
- FilterBar sticky chung cho mọi tab
- "Mẫu" tab gộp Templates + ScopeExplorer
- Bỏ "Cấu hình chưa hợp lệ" inline message → toast/banner riêng
- Bỏ description "Chọn khoảng thời gian, bộ quy tắc..." (chuyển vào info tooltip)

### Files cần edit (slice 5)

- `src/components/ReportViewer.tsx` (636 LOC)
- `src/components/reporting/ReportingPanels.tsx` (ReportingControlsPanel, ReportingSchedulePanel)
- `src/components/reporting/ReportingScopeExplorerPanel.jsx`
- `src/components/reporting/useReportViewerActions.js`
- `src/components/reporting/useReportViewerPreferences.js`

---

## Page 8 — Sức khỏe dữ liệu

**Route**: `?section=observability&tab=health` (di chuyển → `?section=operations&tab=health`)  
**File**: `src/components/DataHealthDashboard.tsx` (35KB)

### Wireframe

```
┌─ Page Header ─────────────────────────────────────────────┐
│ VẬN HÀNH                                                   │
│ Sức khỏe dữ liệu (i)              [Quét lại] [Xuất báo cáo]│
└────────────────────────────────────────────────────────────┘
┌─ Status overview (sticky) ────────────────────────────────┐
│ 🟢 12 OK    🟡 3 cảnh báo    🔴 1 nghiêm trọng           │
└────────────────────────────────────────────────────────────┘
┌─ Page Tabs ────────────────────────────────────────────────┐
│ Tất cả  Trùng lặp (3)  Thiếu (2)  ECUS sync (1)  Cảnh báo │
└────────────────────────────────────────────────────────────┘
┌─ Tab content: cards/lists các issue ───────────────────────┐
│ ▸ Trùng 11 số đầu MST (3 cases)                            │
│ ▸ ECUS sync timeout (1 incident)                           │
└────────────────────────────────────────────────────────────┘
```

### Specs

- Move section: Giám sát → Vận hành (logical với Import Data)
- Tabs theo loại issue
- Card mỗi issue có severity icon + action "Xem chi tiết / Bỏ qua"

---

## Page 9 — Trợ lý AI

**Route**: `?section=governance&tab=ai` (di chuyển từ observability)  
**File**: `src/components/AIAssistant.tsx` (16KB)

### Wireframe

```
┌─ Page Header ─────────────────────────────────────────────┐
│ QUẢN TRỊ                                                   │
│ Trợ lý AI · GPT-4o (i)            [Lịch sử] [Cài đặt]    │
└────────────────────────────────────────────────────────────┘
┌─ 2-column layout ──────────────────────────────────────────┐
│ ┌─ Conversation list ─┐ ┌─ Active chat ─────────────────┐ │
│ │ + New chat          │ │ User: ...                     │ │
│ │ ────────────────   │ │ AI: ...                       │ │
│ │ • Chat 1            │ │                                │ │
│ │ • Chat 2            │ │ [Input box] [Send]            │ │
│ └────────────────────┘ └────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

---

## Page 10 — Tài khoản

**Route**: `?section=governance&tab=accounts`  
**File**: `src/components/AccountManager.tsx` (33KB)

### Wireframe

```
┌─ Page Header ─────────────────────────────────────────────┐
│ QUẢN TRỊ                                                   │
│ Tài khoản · 24 user (i)              [+ Thêm tài khoản]  │
└────────────────────────────────────────────────────────────┘
┌─ FilterBar ────────────────────────────────────────────────┐
│ [Tìm user...] [Vai trò▾] [Trạng thái▾]  [Reset]    [Export▾]│
├────────────────────────────────────────────────────────────┤
│ DataTable                                                   │
└────────────────────────────────────────────────────────────┘
```

---

## Page 11 — Nhật ký (Audit Log)

**Route**: `?section=governance&tab=audit`  
**File**: `src/components/AuditLog.tsx` (41KB ⚠️ lớn)

### Wireframe

```
┌─ Page Header ─────────────────────────────────────────────┐
│ QUẢN TRỊ                                                   │
│ Nhật ký · 12,345 events (i)         [Xuất XLSX]          │
└────────────────────────────────────────────────────────────┘
┌─ FilterBar ────────────────────────────────────────────────┐
│ [Tìm...] [Loại▾] [Người dùng▾] [Kỳ▾]  [Reset]    [Export▾]│
├────────────────────────────────────────────────────────────┤
│ DataTable virtualized                                       │
└────────────────────────────────────────────────────────────┘
```

### Specs

- File 41KB → cần tách (slice riêng sau Phase B/C/D)
- Virtualization bắt buộc (rows > 1000)

---

## Page 12 — Lịch sử Export

**Route**: `?section=governance&tab=export-audit`  
**File**: `src/components/ExportAuditReport.tsx` (29KB)

### Wireframe (tương tự AuditLog)

---

## Tóm tắt theo Section sau IA mới

```
TỔNG QUAN
└── Dashboard (Page 1)

VẬN HÀNH
├── Import Data (Page 2)
├── Gán MST & Đại lý HQ (Page 3)  ← gộp 2 tab
└── Sức khỏe dữ liệu (Page 8)      ← di chuyển từ Giám sát

CẤU HÌNH (đổi tên từ HIỆU SUẤT)
├── Tổ đội (Page 4)
├── Quy tắc KPI (Page 5)
└── Điều chỉnh KPI +/- (Page 6)    ← tách khỏi Báo cáo

BÁO CÁO
├── Report Center (Page 7)
└── Lịch sử Export (Page 12)

QUẢN TRỊ
├── Tài khoản (Page 10)
├── Nhật ký (Page 11)
└── Trợ lý AI (Page 9)               ← di chuyển từ Giám sát
```

→ 5 sections × 2-3 tabs = **12 tabs** (giảm từ 13 do gộp MST+HQ).

---

## Prioritization

| Page | Slice | Priority |
|------|-------|----------|
| Dashboard | 5 | 🔴 (high visibility) |
| Import Data | 5 | 🔴 (volume sử dụng cao) |
| MST + HQ gộp | 5 | 🔴 (gộp giảm friction) |
| Adjustments | 5 | 🟠 |
| Reports | 5 | 🟠 |
| Teams | 6 | 🟡 |
| Rules | 6 | 🟡 |
| Health | 6 | 🟡 |
| AI | 6 | 🟢 |
| Accounts | 6 | 🟡 |
| Audit | 7 | 🟡 |
| Export Audit | 7 | 🟡 |
