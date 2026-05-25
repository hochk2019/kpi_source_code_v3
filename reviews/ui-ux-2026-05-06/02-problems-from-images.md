# 02 — Vấn đề từ 7 ảnh người dùng cung cấp

> Mỗi ảnh được phân tích theo: **Quan sát visual → Root cause trong code → Fix cụ thể**.
> Image labels theo thứ tự upload trong request.

---

## Image 1 — Điểm KPI +/- Thêm (`?section=performance&tab=adjustments`)

**File**: `@/src/components/KPIAdjustments.tsx` (762 LOC) + `@/src/components/kpi-adjustments/` (20 files)

### Quan sát
- Sidebar bên trái rất dày: "VẬN HÀNH" + 3 tab + "HIỆU SUẤT" + 4 tab, mỗi tab có description 1-2 dòng (`Quản lý gán MST cho doanh nghiệp và người phụ trách`, `Cộng/trừ điểm KPI bổ sung theo tháng`, ...)
- Hero header: eyebrow "HIỆU SUẤT" + title to "Điểm KPI +/- Thêm" + role pill "viewer" + 1 info icon + nội dung "Người dùng guest" / "Tìm kiếm... Ctrl K"
- **2 cards lớn liên tiếp**: "Điều chỉnh KPI" header với description "Quản lý, điều chỉnh và xét duyệt KPIs cộng trừ ngoài hệ thống"
- Tabs trong page: "Nhập điều chỉnh | Danh sách | Cài đặt"
- "Cấu hình điểm KPI" — description "Chỉ áp dụng cho Admin/Quản lý..."
- 3 sections "Hỗ trợ thông quan", "Hỗ trợ thông quan (luồng vàng/đỏ)", "Hỗ trợ xin giấy phép" — mỗi section có **2 dòng description** (`Hỗ trợ thông quan`, `Điểm mặc định`) và 1 input rỗng
- Input toàn dấu `_` → placeholder không có giá trị mặc định

### Vấn đề
| Code | Mức | Vấn đề | Evidence |
|------|-----|--------|----------|
| IMG1-1 | 🔴 | Sidebar text quá dày, mỗi tab 2 dòng caption | `@/src/components/appShell/AppShellFrame.tsx:204-205` (`ds-app-shell__nav-caption`) |
| IMG1-2 | 🔴 | Hero header chiếm 120px+ với eyebrow + title + role + info + user pill | `@/src/components/appShell/AppShellFrame.tsx:217-247` |
| IMG1-3 | 🟠 | "Điều chỉnh KPI" SectionHeader có description 1 dòng dư thừa với title | `@/src/components/KPIAdjustments.tsx` (cần locate) |
| IMG1-4 | 🟠 | Mỗi setting có 2 dòng (label + sublabel + "Điểm mặc định" + helper) chiếm ~80px/dòng | `@/src/components/kpi-adjustments/panels/KpiAdjustmentSettingsDialog.jsx` hoặc `KpiAdjustmentOverviewPanel.jsx` |
| IMG1-5 | 🟡 | Tabs "Nhập điều chỉnh / Danh sách / Cài đặt" position chưa rõ priority | line 27 (`Tabs from @/components/ui/tabs`) |
| IMG1-6 | 🟡 | Vùng trên cùng "Tác động KPI" và "Mở Report Center" buttons không gắn vào hero — float ở giữa surface | check render path |

### Fix
1. **Slice 1 (sidebar diet)**: Ẩn `ds-app-shell__nav-caption` mặc định. Chỉ hiện trong tooltip on hover/focus. Điều chỉnh `AppShellFrame.tsx:204-205`.
2. **Slice 2 (hero compact)**: Hero header rút còn 1 dòng: `eyebrow • title • role`, đẩy "user pill / search / info" sang **toolbar dưới hero** hoặc **gọn vào CommandCenter**.
3. **Slice 3 (page header chuẩn)**: Áp dụng `<PageHeader>` mới (xem `05-component-library.md`), bỏ description card-level cho mọi `SectionHeader` thuộc adjustments page.
4. **Slice 5 (page-spec adjustments)**:
   - Settings tab: collapsible accordion theo nhóm KPI (`Hỗ trợ thông quan`, `Giấy phép`, ...). Default collapsed.
   - Inputs hiển thị placeholder rõ ràng (`0.50 điểm/đơn`) thay vì `_`.

---

## Image 2 — Đại Lý HQ (`?section=operations&tab=hq`) — TRANG TRẮNG

**File**: `@/src/components/HQAgencyManager.tsx` (951 LOC)

### Quan sát
- Sidebar bình thường + Hero "Đại Lý HQ" + role "viewer"
- **Toàn bộ vùng nội dung trống** — không có table, không có empty state, không có message gì
- Header có "Người dùng guest" và search box

### Root cause
File `@/src/components/HQAgencyManager.tsx` có render: `<HQAgencyManagerControls>` + `<HQAgencyTable>` + `<p>` ghi chú dưới (line 882-948). 

**Tại sao trắng?** Khi load với role viewer:
- `readDraftsFromStore()` (line 76) đọc localStorage → guest không có data persisted → `drafts = []`
- `<HQAgencyManagerControls>` render với `hasRows={false}` → có thể controls được dấu hết
- `<HQAgencyTable>` với `pageRows=[]` → render empty table có thể không có placeholder

→ **Cần kiểm tra `HQAgencyManagerControls.jsx`** xem có conditional render tất cả khi viewer không.

### Vấn đề
| Code | Mức | Vấn đề | Evidence |
|------|-----|--------|----------|
| IMG2-1 | 🔴 | Trang trắng hoàn toàn — không có empty state | `@/src/components/HQAgencyManager.tsx:882-948` |
| IMG2-2 | 🟠 | Note "Cột Đại lý HQ sẽ xuất hiện..." là helper text bị ẩn vì không có rows | `@/src/components/HQAgencyManager.tsx:942-947` |
| IMG2-3 | 🟡 | Khi viewer mode, không có CTA "Đăng nhập để xem dữ liệu" rõ ràng | (toàn UI) |

### Fix (slice 5)
1. Component `<EmptyState>` chuẩn với:
   - Icon `Database` từ lucide
   - Title: "Chưa có dữ liệu Đại lý HQ"
   - Description: "Tài khoản đang đăng nhập với quyền guest. Đăng nhập admin để xem và quản lý đại lý."
   - CTA: "Đăng nhập" (mở Login dialog) hoặc "Tìm hiểu thêm"
2. `HQAgencyManager` luôn render frame (controls + table) ngay cả khi 0 rows. Empty state nằm trong `<DataTable>` `emptyState` prop.

---

## Image 3 — Gán MST (`?section=operations&tab=mst`)

**File**: `@/src/components/MSTAssignment.tsx` (585 LOC) + `@/src/components/mst-assignment/` (38 files)

### Quan sát
- Sidebar có thêm "TỔNG QUAN" → "Tổng quan KPI" highlight nhẹ → đang xem tab khác
- Hero "Gán mã số thuế (MST)" + description "Quản lý, phân bổ và theo dõi trạng thái gán doanh nghiệp cho tổ đội"
- 1 alert vàng: "Bạn đang xem bằng MST ở chế độ chỉ xem. Đăng nhập bằng tài khoản quản trị hoặc được cấp quyền để import, chỉnh sửa và lưu thay đổi"
- Card "0 bản ghi" + "Xem nhanh danh sách MST, tìm kiếm, gom theo MST..."
- **Toolbar 6 controls trên 1 hàng**: checkbox "Gom theo MST", search input, 4 buttons export ("XLSX (lọc)", "CSV (lọc)", "XLSX (tất cả)", "CSV (tất cả)")
- 1 card "Bộ lọc nhân viên phụ trách" với combobox + 1 button "Lưu bộ lọc nhân viên" + 1 dropdown "Lead-view rút gọn" + checkbox "Bật lead-view rút gọn"
- 1 hàng button group: "Tất cả | Đã gắn đủ | Chờ gắn" + dropdown "Tất cả team"
- 1 card "Bộ lọc lịch sử thay đổi" với date range + select + 2 buttons + text "Hiển thị 0 / 0 bản ghi lịch sử"

### Vấn đề
| Code | Mức | Vấn đề | Evidence |
|------|-----|--------|----------|
| IMG3-1 | 🔴 | 4 export buttons trên 1 hàng → cần gộp thành 1 `<ExportDropdown>` | `MSTAssignmentToolbar.jsx` (xem trong 38 files) |
| IMG3-2 | 🟠 | "Bộ lọc nhân viên" và "Bộ lọc lịch sử" luôn visible → chiếm 250px+ trước khi user thấy table | `mst-assignment/filters/MstAssignmentStaffFilterPanel.jsx`, `MstAssignmentHistoryFilterPanel.jsx` |
| IMG3-3 | 🟠 | Permission alert vàng + "0 bản ghi" + 3 toolbar lines = ~400px hero+toolbar trước table | toàn page |
| IMG3-4 | 🟡 | Section description "Quản lý, phân bổ và theo dõi trạng thái gán doanh nghiệp..." có thể chuyển thành tooltip info icon | SectionHeader description |
| IMG3-5 | 🟡 | "Lead-view rút gọn" thuật ngữ khó hiểu cho user mới | i18n key |

### Fix
1. **Slice 4 (component library)**: Tạo `<ExportDropdown>`:
   ```tsx
   <ExportDropdown
     items={[
       { label: 'Excel (kết quả lọc)', format: 'xlsx', scope: 'filtered' },
       { label: 'CSV (kết quả lọc)', format: 'csv', scope: 'filtered' },
       { label: 'Excel (toàn bộ)', format: 'xlsx', scope: 'all' },
       { label: 'CSV (toàn bộ)', format: 'csv', scope: 'all' },
     ]}
     onExport={handleExport}
   />
   ```
2. **Slice 5 (MST page)**:
   - Tabs trong page: `[Bảng MST] [Bộ lọc nâng cao] [Lịch sử]`
   - "Bộ lọc nhân viên phụ trách" → trong tab Bảng (collapsible)
   - "Bộ lọc lịch sử" → trong tab Lịch sử
   - Bulk action bar sticky bottom khi chọn nhiều rows
3. **Slice 1 (permission banner chuẩn)**: 1 banner duy nhất đầu page, dismissible, dùng `<PermissionBanner>` mới.

---

## Image 4 — Tổng quan KPI / Dashboard (`?section=overview&tab=dashboard`) — phần trên

**File**: `@/src/components/appShell/AppDashboardLanding.tsx` (273 LOC)

### Quan sát
- Sidebar **đầy đủ**: "HỆ THỐNG ĐIỀU HÀNH KPI Command (i)" + "TỔNG QUAN" + tab "Tổng quan KPI" highlight + description "Điểm vào mặc định để xem lối tắt, trạng thái và bề mặt điều hành chính"
- Mỗi nav group có description 2-3 dòng
- Hero "Tổng quan KPI" + role "viewer" + info icon
- **Card lớn**: "Chế độ khách (i)" + description "Kỳ hiện tại 2026-04-30 — 2026-05-30" + button "Làm mới"
- Section "Tóm tắt điều hành KPI" với description "Nêu nhanh tín hiệu thắng kỳ hiện tại để dẫn dắt nhịp chốt KPI trước khi drill-down chi tiết"
- 4 cards metrics: "KPI / TỜ KHAI 0,00", "NHÂN SỰ DẪN ĐẦU Chưa có dữ liệu", "TỔ ĐỘI CHIẾM TỶ TRỌNG CAO NHẤT Chưa có dữ liệu", "ĐIỀU CHỈNH CHỜ DUYỆT 0"
- "TÍN HIỆU LỆCH CHUẨN — Không phát hiện lệch chuẩn nổi bật trong kỳ hiện tại"
- 4 summary cards: "Tổng tờ khai 0", "Tổng điểm KPI 0,00", "Điểm KPI +/- bổ sung 0,00 / Đã duyệt 0 / Chờ duyệt 0", "Số công ty quản lý 0"
- "Xu hướng KPI 6 kỳ gần nhất" placeholder

### Vấn đề
| Code | Mức | Vấn đề | Evidence |
|------|-----|--------|----------|
| IMG4-1 | 🟠 | Hero "Chế độ khách (i)" + period range + reload chiếm 1 row riêng — không gắn với title | `AppDashboardLanding.tsx:142-173` |
| IMG4-2 | 🟠 | "Tóm tắt điều hành KPI" có description **dài** giải thích cách dùng | `ReportingExecutiveSummaryPanel.jsx` (cần locate) |
| IMG4-3 | 🟡 | 4 cards "ExecutiveSummaryPanel" + 4 SummaryCards = 8 cards cùng overview → trùng lặp | flow render |
| IMG4-4 | 🟡 | Empty state "Chưa có dữ liệu" / "0,00" / "0" trộn nhiều ngôn ngữ → cần chuẩn hoá | (toàn page) |

### Fix (slice 5)
1. Hero rút gọn: `Tổng quan KPI · Kỳ 30/04 → 30/05/2026 [↻]`
2. Bỏ description "Tóm tắt điều hành KPI" — chỉ giữ title + tooltip info nếu cần.
3. Gộp **Executive summary cards** với **Summary cards** thành 1 grid 4 cards với hình thức rõ ràng:
   - Tổng tờ khai · Import:0 / Export:0
   - Tổng điểm KPI · Type:0 / License:0
   - Điều chỉnh · Approved:0 / Pending:0
   - Công ty quản lý · 0 (X tổ đội)
4. Empty state mỗi card: 1 dòng "Chưa có dữ liệu kỳ này" + link "Cấu hình quy tắc KPI →".

---

## Image 5 — Báo cáo KPI / Report Center (`?section=performance&tab=reports`)

**File**: `@/src/components/ReportViewer.tsx` (636 LOC) + `@/src/components/reporting/` (23 files)

### Quan sát
- Hero "Báo cáo KPI viewer" + info icon + Người dùng guest pill + Search Ctrl K
- "Report Center (i)" + description "Theo dõi Drill-down, insights và quản lý lịch gửi báo cáo"
- Button "Đối chiếu Điều chỉnh" → navigate adjustments
- Link "← Quay lại Dashboard tổng quan"
- Section "Điều khiển báo cáo KPI" + description "Chọn khoảng thời gian, bộ quy tắc và trạng thái read model trước khi xem dashboard KPI"
- 3 badges: "0 tờ khai | Rule v2 | Tải lại dữ liệu"
- "MẪU BÁO CÁO" select + 3 buttons "Áp dụng | Lưu mẫu mới | Làm mới"
- 1 dòng caption "Lưu cực bộ theo từng tính chất tiến tay. Chưa áp dụng mẫu báo cáo nào"
- "Khoảng thời gian | Từ ngày | Đến ngày" — 3 cột date inputs
- "BỘ QUY TẮC KPI" select "Rule v2 - Đang áp dụng" + caption
- "THÔNG TIN BÁO CÁO" — Khoảng kỳ + "Cấu hình chưa hợp lệ"
- "Khám phá phạm vi báo cáo" + description

### Vấn đề
| Code | Mức | Vấn đề | Evidence |
|------|-----|--------|----------|
| IMG5-1 | 🔴 | Hero + 2 nav links + section description + 3 status pills → 5 hàng tổng cộng ~250px trước control | `ReportViewer.tsx:55-200` (cần locate) |
| IMG5-2 | 🔴 | Trang scroll dài (~3000-4000px theo audit cũ) — không có tabs trong page | toàn page |
| IMG5-3 | 🟠 | "Mẫu báo cáo" 3 buttons đứng cạnh nhau khó scan | `ReportingControlsPanel.tsx` |
| IMG5-4 | 🟠 | "Cấu hình chưa hợp lệ" status nằm trong "THÔNG TIN BÁO CÁO" → user không biết phải làm gì | logic load template |
| IMG5-5 | 🟡 | "Khám phá phạm vi báo cáo" section rời rạc | `ReportingScopeExplorerPanel.jsx` |

### Fix
1. **Slice 5 (page-spec reports)**:
   - Hero rút gọn 1 dòng + back link inline
   - **Tabs trong page**: `[Tổng quan] [Nhân viên] [Tổ đội] [Xuất báo cáo] [Lịch gửi]`
   - "Điều khiển báo cáo" trở thành sticky toolbar trên cùng (collapsed by default)
   - Mỗi tab có nội dung riêng → không scroll dài
2. **Slice 4**: ExportDropdown cho "Xuất báo cáo".
3. **Slice 5**: Tab "Lịch gửi" gộp `ReportingSchedulePanel` + email config.

---

## Image 6 — Tổng quan KPI / Dashboard (phần dưới — pie charts)

**File**: `@/src/components/reporting/ReportingOverviewWidgets.jsx` (`TeamPieWidget`)

### Quan sát
- "Phân bố KPI theo tổ đội" — 1 pie chart **nguyên 1 hình tròn cam** với text trắng "Không có dữ liệu" ở giữa, legend bên phải "Team 1, 2, 3 (0% KPI)"
- "Phân bổ tờ khai theo tổ đội" — pie chart cam tương tự
- "Hành động nhanh" — 4 cards: Bắt đầu với Import, Mở dashboard báo cáo, Gọi trợ lý AI, Mở báo cáo KPI

### Vấn đề
| Code | Mức | Vấn đề | Evidence |
|------|-----|--------|----------|
| IMG6-1 | 🔴 | Pie chart **render full màu cam** khi 0 dữ liệu — không có empty state riêng | `@/src/components/reporting/ReportingOverviewWidgets.jsx` `TeamPieWidget` |
| IMG6-2 | 🟠 | Legend "Team 1 0,00 (0% KPI)" hiển thị dù không có data → nhiễu | cùng file |
| IMG6-3 | 🟡 | "Hành động nhanh" cards quá to (4 cards trên 1 hàng, mỗi card ~160px height) | `AppDashboardLanding.tsx:246-265` |

### Fix (slice 5 + 6)
1. Trong `TeamPieWidget`, kiểm tra `kpiData.every(d => d.value === 0)` → render `<EmptyState size="compact" icon={PieChart} title="Chưa có dữ liệu kỳ này" description="Hãy đảm bảo đã import tờ khai và gán MST" />`
2. "Hành động nhanh" rút còn `<QuickActionList>` — 4 mục trong 1 list compact, mỗi mục 1 dòng + icon, không phải 4 cards riêng.

---

## Image 7 — Tổng quan KPI cuối trang + sidebar dày

**File**: `AppDashboardLanding.tsx` + `AppShellFrame.tsx`

### Quan sát
- **Sidebar trái**: "HỆ THỐNG ĐIỀU HÀNH KPI Command (i)" + 5 sections, mỗi section có 2-3 lines description, mỗi tab có 1 line tooltip → tổng ~600px text
- "Hành động nhanh" 4 cards lặp lại metadata Module Map (Import, Dashboard, AI, Báo cáo)
- "Mở báo cáo KPI" → nút phụ thay vì primary CTA

### Vấn đề
| Code | Mức | Vấn đề | Evidence |
|------|-----|--------|----------|
| IMG7-1 | 🔴 | Sidebar text dày → cần ẩn caption và section description, chỉ show tooltip hover | `AppShellFrame.tsx:184-187, 204-205` |
| IMG7-2 | 🟠 | "Hành động nhanh" trùng nội dung sidebar 100% | `AppDashboardLanding.tsx:246-265` |
| IMG7-3 | 🟡 | Brand "KPI Command" + info icon trên sidebar không actionable | `AppShellFrame.tsx:138-148` |

### Fix
1. **Slice 1**: Sidebar diet — bỏ caption mặc định, bỏ section description trong sidebar (chỉ hiện trong tooltip).
2. **Slice 5 (dashboard)**: Bỏ "Hành động nhanh" duplicate — thay bằng **link contextual** trong từng card (vd. card "Tổng tờ khai" → link "Mở Import Data →" khi 0 records).

---

## Tổng kết visual issues

| Vùng | Pixels lãng phí ước tính | Slice xử lý |
|------|-------------------------|-------------|
| Hero header (mỗi page ~120px) | ~120px × 13 trang = 1560px | Slice 2 |
| Sidebar caption + description | ~250px text trong sidebar | Slice 1 |
| WorkflowGuide banner (xoá toàn bộ) | ~250px × 8 trang = 2000px | Slice 1 |
| SectionHeader description (mỗi card 60px) | ~60px × ~30 cards = 1800px | Slice 3 |
| Permission alerts xếp chồng (image 1, 6) | ~80px | Slice 4 |
| Pie chart full màu khi 0 data | ~300px lãng phí UX | Slice 4 |
| Quick Actions 4 cards to | ~150px | Slice 5 |
| **Tổng** | **~6000+ pixels lãng phí** | **8 slices** |

→ Sau khi fix, **mỗi trang giảm 30-40% chiều cao**, user nhìn thấy nội dung chính ở viewport đầu tiên.
