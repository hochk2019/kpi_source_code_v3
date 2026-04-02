# Opus Review V2 — Tổng hợp UX Audit & Kiến trúc Đề xuất

> **Ngày:** 02/04/2026 · **Phiên bản:** kpi_source_code_v4  
> **Phương pháp:** Source code deep-dive (9,350-line store.js, 15 server-v4 modules, 106 test files) + Live UI testing (admin login, 12 tabs, dark mode)  
> **Phạm vi:** Full-stack audit → Unified architecture proposal

---

## MỤC LỤC

1. [Tổng quan Hiện trạng](#1-tổng-quan-hiện-trạng)
2. [Phát hiện UX — Đã xác nhận qua Live Testing](#2-phát-hiện-ux--đã-xác-nhận-qua-live-testing)
3. [Phát hiện Code — Deep Analysis](#3-phát-hiện-code--deep-analysis)
4. [Kiến trúc Đề xuất Hợp nhất](#4-kiến-trúc-đề-xuất-hợp-nhất)
5. [Lộ trình Triển khai](#5-lộ-trình-triển-khai)

---

# 1. TỔNG QUAN HIỆN TRẠNG

## Điểm mạnh (đã xác nhận)

| Aspect | Rating | Evidence |
|--------|--------|----------|
| Visual polish & Design system | 9/10 | oklch colors, Be Vietnam Pro font, glassmorphism dark mode |
| server-v4 module architecture | 9/10 | 15 domain modules, TypeScript, clean separation |
| Error Boundaries | 8/10 | 2-layer: `AppRoot` + per-tab `RuntimeErrorBoundary` |
| Performance monitoring | 9/10 | Web Vitals (FCP, LCP, CLS), screen render metrics, P50/P95 |
| Security baseline | 8/10 | `helmet` + rate limiting (10 req/15min) + `fetchWithAuth` |
| Workflow guides | 9/10 | 3-step guides per tab giúp onboarding nhanh |
| Test coverage | 7/10 | 106 test files — tốt cho AppShell, AI, DataImporter |

## Vấn đề cốt lõi

| Vấn đề | Nguồn gốc | Ảnh hưởng |
|--------|-----------|-----------|
| 🔴 **God Object `store.js`** | 9,350 dòng / 211 functions / 8+ domains | Không tree-shakeable, crash risk, untestable |
| 🔴 **Thiếu try/catch** | `store.js` xử lý JSON/localStorage không có error guard | App crash khi data corrupt |
| 🟡 **Ngôn ngữ hỗn hợp** | "VAN HANH", "Operator Shell" vs "Gán MST" | Inconsistent, unprofessional |
| 🟡 **Dual header** | App header + AppShell hero = ~150px wasted | Content pushed below fold |
| 🟡 **Workflow guides không collapse** | Mọi tab đều show 3 steps ở trên | Operator quen phải scroll qua mỗi lần |
| 🟡 **Shared components thiếu** | Chỉ 2 files trong `shared/` | Filter, Empty state, Skeleton bị duplicate |

---

# 2. PHÁT HIỆN UX — ĐÃ XÁC NHẬN QUA LIVE TESTING

## Top 10 UX Issues (được hợp nhất & xếp hạng lại)

### 🔴 P1. Dual Header — 150px lãng phí

**Thấy rõ trên screenshot:** Header trên (logo + auth + toolbar) + hero section (tab title + role pill + description) hiển thị đồng thời.

| Metric | Value |
|--------|-------|
| Vertical space wasted | ~150px |
| User info duplicated | "Xin chào, Quản trị viên" (header) + "admin" pill + "Nguoi dung admin" (hero) |
| Impact on 768px screens | Content bắt đầu ở ~300px từ top |

**Fix:** Merge thành 1 header duy nhất: `[Logo] [Breadcrumb: Section > Tab] [Search ⌘K] [User] [Actions]`

### 🔴 P2. Ngôn ngữ hỗn hợp — 3 kiểu trong 1 sidebar

**Thấy rõ:** Sidebar section headers không có dấu ("VAN HANH", "HIEU SUAT"), tab labels có dấu ("Gán MST", "Đại Lý HQ"), brand text tiếng Anh ("Operator Shell", "KPI Control Center").

**Fix:** Chuẩn hóa toàn bộ sang tiếng Việt có dấu. Giữ English chỉ cho code identifiers.

### 🟡 P3. Workflow Guide — chiếm quá nhiều vertical space

**Thấy rõ:** Mỗi tab đều show 3-step guide cards (~200px) trước khi hiện nội dung chính. Operator đã quen workflow vẫn phải scroll qua.

**Fix:** Thêm nút collapse/expand cho workflow guide. Nhớ trạng thái trong localStorage.

### 🟡 P4. Command Center — undiscoverable

**Thấy rõ:** Chỉ là text "Command Center" nhỏ trên header bar. Không có icon, không có hint Ctrl+K visible.

**Fix:** Thêm search bar visible với badge "⌘K" trên header.

### 🟡 P5. Loading States — text thay vì skeleton

**Thấy rõ:** Khi chuyển tab, hiện text "Đang tải nội dung..." — không có skeleton.

**Fix:** Thêm `TabPanelSkeleton` component matching layout của từng tab.

### 🟡 P6. HTTP 503 hiện raw trên Health page

**Thấy rõ:** Mục "Tổng quan sức khỏe dữ liệu" hiện banner đỏ "HTTP 503" — không có friendly message.

**Fix:** Wrap trong error component: "Không kết nối được dịch vụ ECUS. [Thử lại]"

### 🟡 P7. Sidebar scroll trên laptop nhỏ

**Thấy rõ:** 4 sections + 12 tabs = sidebar cần scroll. Trên 768px, sidebar chiếm ~30% width.

**Fix:** Collapse sidebar → icon-only mode trên viewport < 1024px. Recently-used tabs ở trên.

### 🟡 P8. Không có Dashboard landing page

**Thấy rõ:** App mở thẳng vào tab "Báo cáo KPI". Không có overview/home.

**Fix:** Tạo Dashboard page: KPI summary cards + quick actions + recent activity.

### 🟢 P9. Thiếu URL deep-link

Reports, audit entries không có URL shareable. Phải mô tả navigation path bằng lời.

**Fix:** Hash routing: `#/reports/insights`, `#/mst/workspace`.

### 🟢 P10. Dark mode — minor inconsistency

Root div dùng hardcoded Tailwind `bg-gray-50` nhưng dark mode vẫn hoạt động nhờ `dark:` variants.

**Fix:** Replace hardcoded colors → CSS variables `var(--ds-*)`.

---

# 3. PHÁT HIỆN CODE — DEEP ANALYSIS

## 3A. `store.js` — God Object (9,350 dòng)

**Phát hiện nghiêm trọng nhất.** Chứa 8+ domains trong 1 file:

```
store.js (9,350 lines / 168KB / 211 functions)
├── Column Config        (lines 1-594)
├── Deleted Decl Log     (lines 600-948)
├── MST Normalization    (lines 952-1275)
├── Declaration Merge    (lines 1279-1798)  ← mergeDeclarationRowClient: 400 dòng
├── MST Assignment       (lines 1866-2724)
├── Declaration History  (lines 2724-4900)
├── Teams & HQ Agencies  (lines 4900-6774)
├── KPI Adjustments      (lines 6774-8518)  ← normalizeAdjustmentInput: 500 dòng
└── Report Schedule      (lines 8518-9146)
```

**Nguy cơ:**
- Không có `try/catch` — grep `try {` = 0 results
- Mutable module state (`let legacyMSTMigrated = false`)
- Bất kỳ component nào `import` 1 function → load toàn bộ 168KB

## 3B. Hàm quá dài

| Function | Dòng | Module |
|----------|------|--------|
| `normalizeAdjustmentInput` | 504 | KPI Adjustments |
| `mergeDeclarationRowClient` | 397 | Declaration Merge |
| `saveMSTRow` | 130 | MST Assignment |
| `normalizeDeclarationRow` | 113 | MST Normalization |
| `saveRules` | 104 | Rules |

## 3C. Frontend–Backend logic duplication

`store.js` (frontend) và `server-v4/src/modules/` (backend) chứa normalize logic cho cùng data models → thay đổi business rules phải update 2 nơi.

`packages/domain/src/` đã có shared logic (22 files) nhưng chưa cover hết.

## 3D. Test gaps

| Area thiếu test | Risk |
|----------------|------|
| `store.js` core functions | 🔴 `normalizeDeclarationRow`, `mergeDeclarationRowClient` untested |
| `storageClient.js` retry/rollback | 🔴 Sync failure scenarios |
| `computeKPI` edge cases | 🟡 Business-critical calculation |
| `reportingLegacyMath.js` | 🟡 38KB math without regression tests |

## 3E. Điểm mạnh code

| Aspect | Detail |
|--------|--------|
| ✅ `useAsyncRequest` hook | AbortController, mount guard, error handling — xuất sắc |
| ✅ Error Boundaries 2 tầng | Root + per-tab → crash 1 tab không ảnh hưởng app |
| ✅ Web Vitals monitoring | FCP, LCP, CLS, TTFB, P50/P95 — rất ít internal tools có |
| ✅ server-v4 modules | 15 modules tự chứa, TypeScript, clean architecture |
| ✅ Security | helmet + rate limiting + token auth đã có sẵn |
| ✅ Naming conventions | PascalCase components, useCamelCase hooks, BEM CSS — nhất quán |

---

# 4. KIẾN TRÚC ĐỀ XUẤT HỢP NHẤT

## 4A. Tổng quan

```
┌──────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                        │
│  ┌──────────┐  ┌──────────────────────────────────────────────┐  │
│  │  Unified  │  │              Feature Modules                 │  │
│  │  Header   │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐      │  │
│  │(collapsed)│  │  │Dashboard│ │ Import  │ │   MST   │ ...  │  │
│  ├──────────┤  │  │  (NEW)  │ │  Data   │ │Assignment│      │  │
│  │ Sidebar  │  │  └────┬────┘ └────┬────┘ └────┬────┘      │  │
│  │ (icons + │  │       │           │           │             │  │
│  │  labels) │  └───────┼───────────┼───────────┼─────────────┘  │
│  │ collaps- │          │           │           │                 │
│  │  ible    │  ┌───────┴───────────┴───────────┴─────────────┐  │
│  └──────────┘  │              SHARED COMPONENTS               │  │
│                │  FilterToolbar · EmptyState · SkeletonCard   │  │
│                │  StatusBadge · ConfirmDialog · SyncChip      │  │
│                └──────────────────┬───────────────────────────┘  │
└───────────────────────────────────┼──────────────────────────────┘
                                    │
┌───────────────────────────────────┼──────────────────────────────┐
│                         STATE LAYER                              │
│  ┌────────────────────────────────┼──────────────────────────┐   │
│  │               Domain Stores (refactored from store.js)    │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │   │
│  │  │  mst/    │ │  decl/   │ │  kpi/    │ │  teams/  │    │   │
│  │  │assignment│ │  merge   │ │adjustment│ │  roster  │    │   │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘    │   │
│  └───────┼────────────┼────────────┼────────────┼────────────┘   │
│          └────────────┴────────────┴────────────┘                │
│                              │                                   │
│  ┌───────────────────────────┴───────────────────────────────┐   │
│  │              Shared Domain (packages/domain/src)          │   │
│  │  normalize · validate · compute · format                  │   │
│  └───────────────────────────┬───────────────────────────────┘   │
│                              │                                   │
│  ┌───────────────────────────┴───────────────────────────────┐   │
│  │              Storage Client (sync engine)                 │   │
│  │  localStorage ←→ Server sync (retry + circuit breaker)    │   │
│  └───────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
                                    │
┌───────────────────────────────────┼──────────────────────────────┐
│                       BACKEND (server-v4)                        │
│  15 domain modules · TypeScript · SQLite · Express               │
│  helmet · rate limiting · token auth                             │
└──────────────────────────────────────────────────────────────────┘
```

## 4B. Frontend — Cấu trúc thư mục đề xuất

### Hiện tại (vấn đề)
```
src/
├── lib/
│   ├── store.js          ← 9,350 dòng GOD OBJECT
│   ├── rules.js          ← 1,644 dòng (CRUD + compute + license)
│   ├── storageClient.js  ← 1,562 dòng sync engine
│   └── ... (15 files khác)
├── hooks/                ← 7 hooks
├── components/
│   ├── shared/           ← chỉ 2 files!
│   ├── appShell/
│   ├── dataImporter/     ← đã modular ✅
│   ├── CommandCenter.jsx ← 1,179 dòng
│   └── ... (20+ components)
└── auth/
```

### Đề xuất (sau refactor)
```
src/
├── domains/                           ← THAY store.js
│   ├── declarations/
│   │   ├── declarationNormalize.js    ← normalizeDeclarationRow
│   │   ├── declarationMerge.js        ← mergeDeclarationRowClient
│   │   ├── declarationHistory.js      ← decl history CRUD
│   │   └── declarationKeys.js         ← getDeclarationKey, etc.
│   ├── mst/
│   │   ├── mstNormalize.js            ← normalizeMST, sanitizeMSTRow
│   │   ├── mstAssignment.js           ← getMSTMap, saveMSTRow, upsertMSTRows
│   │   ├── mstHistory.js              ← appendMSTHistoryEntries
│   │   └── mstDiff.js                 ← diffMSTRows
│   ├── kpi/
│   │   ├── kpiComputation.js          ← computeKPI, detectGroup (from rules.js)
│   │   ├── kpiAdjustments.js          ← normalizeAdjustmentInput, save/update
│   │   └── kpiAdjustmentSettings.js   ← auto-approve config
│   ├── rules/
│   │   ├── ruleManagement.js          ← CRUD, versioning, history
│   │   └── licenseParsing.js          ← parseLicenseInfoFromRow
│   ├── teams/
│   │   ├── teamRoster.js
│   │   └── teamOperations.js
│   ├── hq/
│   │   ├── hqAgencies.js
│   │   └── hqHistory.js
│   ├── reporting/
│   │   ├── reportSchedule.js
│   │   └── reportExport.js
│   ├── import/
│   │   ├── columnConfig.js
│   │   ├── importLog.js
│   │   └── deletedDeclLog.js
│   ├── _shared/
│   │   ├── helpers.js                 ← safeParse, normalizeStr, toISODate
│   │   ├── dateUtils.js
│   │   └── storageHelpers.js          ← try/catch wrappers cho localStorage
│   └── index.js                       ← barrel re-exports (backward compat)
│
├── hooks/
│   ├── useAsyncRequest.js             ← giữ nguyên ✅
│   ├── useFilterPresets.js            ← tách thành 3 sub-hooks
│   ├── usePagination.js               ← giữ nguyên ✅
│   ├── useCommandSearch.js            ← mới (from CommandCenter)
│   ├── useCommandPins.js              ← mới (from CommandCenter)
│   └── useCommandKeyboard.js          ← mới (from CommandCenter)
│
├── components/
│   ├── shared/                        ← MỞ RỘNG
│   │   ├── StaffCombobox.jsx          ← đã có
│   │   ├── FilterToolbar.jsx          ← mới
│   │   ├── EmptyState.jsx             ← mới
│   │   ├── SkeletonCard.jsx           ← mới
│   │   ├── SyncStatusChip.jsx         ← mới
│   │   ├── ConfirmDialog.jsx          ← mới
│   │   └── FriendlyError.jsx          ← mới (thay "HTTP 503")
│   ├── appShell/
│   │   ├── AppShellFrame.jsx          ← refactor: collapsible sidebar
│   │   ├── UnifiedHeader.jsx          ← mới: merge header + hero
│   │   ├── BreadcrumbTrail.jsx        ← mới
│   │   └── AppShellWorkflowGuide.jsx  ← thêm collapse toggle
│   ├── dashboard/                     ← MỚI
│   │   ├── DashboardPage.jsx
│   │   ├── DashboardSummaryCards.jsx
│   │   ├── DashboardQuickActions.jsx
│   │   └── DashboardRecentActivity.jsx
│   ├── dataImporter/                  ← giữ nguyên ✅
│   ├── command-center/                ← tách từ CommandCenter.jsx
│   │   ├── CommandCenter.jsx          ← chỉ render UI
│   │   └── CommandResultsList.jsx
│   └── ...
│
├── sync/
│   ├── storageClient.js               ← giữ + thêm circuit breaker
│   └── storageSyncErrors.js
│
├── lib/                               ← utilities only
│   ├── apiRoutes.js
│   ├── commandBus.js
│   └── frontendPerformanceTelemetry.js ← giữ nguyên ✅
│
└── auth/
    └── localAuth.js
```

## 4C. Giải quyết `store.js` — Migration Strategy

**Phương pháp:** Strangler Fig pattern (giống đã áp dụng cho backend → server-v4)

```
Phase 1: Tạo barrel file
  store.js cuối file thêm:
  export * from './domains/index.js'
  → backward compatible, không break gì

Phase 2: Di chuyển từng domain
  Bắt đầu từ domain ít coupling nhất:
  1. reportSchedule    (630 dòng, ít dependency)
  2. columnConfig      (600 dòng, self-contained)
  3. deletedDeclLog    (350 dòng, isolated)
  4. hqAgencies        (900 dòng)
  5. teams             (900 dòng)
  6. kpiAdjustments    (1,750 dòng)
  7. mstAssignment     (860 dòng)
  8. declarationMerge  (500 dòng)
  9. mstNormalization   (320 dòng)
  10. declHistory      (2,200 dòng, phức tạp nhất)

Phase 3: Xóa store.js
  Thay bằng index.js re-export
```

## 4D. Shared Domain Package — Hợp nhất logic

```
packages/domain/src/
├── normalize/                    ← MỞ RỘNG
│   ├── declarationRow.js         ← chuyển từ store.js
│   ├── mstRow.js                 ← chuyển từ store.js
│   ├── adjustmentInput.js        ← chuyển từ store.js
│   └── dateUtils.js              ← chuyển từ store.js
├── compute/
│   ├── kpi.js                    ← computeKPI (from rules.js)
│   ├── reportingKpiComputation.js ← đã có
│   └── reportingLegacyMath.js    ← đánh dấu @deprecated nếu không dùng
├── validate/
│   ├── adjustment.js             ← shared validation rules
│   └── declaration.js
└── format/
    └── format.js                 ← đã có
```

**Lợi ích:** Frontend + Backend share cùng 1 normalize/validate → đổi business rules chỉ cần update 1 nơi.

## 4E. App Shell — Layout đề xuất

### Hiện tại
```
┌─────────────────────────────────────────────────────┐
│ [Logo] [Title] ........... [Auth] [Cmd] [Theme]     │  ← Header 1 (60px)
│                            [Change PW] [Logout]      │
├──────────┬──────────────────────────────────────────┤
│ Sidebar  │  SECTION LABEL (eyebrow)                  │
│ ------   │  Tab Name  [admin]  (role pill)            │  ← Hero (90px)
│ OPERATOR │  Description text                          │
│ SHELL    │  [User pill] [Workflow pill] [Cmd button]  │
│ ------   │──────────────────────────────────────────│
│ VAN HANH │  Workflow Guide (3 cards)                  │  ← Guide (120px)
│  Gán MST │   Step 1 | Step 2 | Step 3                │
│  Đại Lý  │──────────────────────────────────────────│
│  Import  │                                           │
│ ------   │  ACTUAL CONTENT                            │  ← Content (~530px)
│ HIEU SUAT│                                           │
│  ...     │                                           │
└──────────┴──────────────────────────────────────────┘
  Content starts at ~270px from top → below fold on small screens
```

### Đề xuất
```
┌─────────────────────────────────────────────────────┐
│ [Logo] Vận hành > Gán MST  [🔍 ⌘K] [🔔] [👤 admin]│  ← Unified Header (48px)
├──────────┬──────────────────────────────────────────┤
│ 📋Vận hành│  Workflow Guide [▼ collapse]              │  ← Optional (0-80px)
│  Gán MST │   Step 1 | Step 2 | Step 3               │
│  Đại Lý  │──────────────────────────────────────────│
│  Import  │                                           │
│ ─────── │  ACTUAL CONTENT                            │  ← Content (~650px+)
│ 📊Hiệu suất│                                        │
│  Tổ đội  │                                           │
│  Quy tắc │                                           │
│  ...     │                                           │
│ ─────── │                                           │
│ Recently │                                           │
│  Import  │                                           │
│  Báo cáo │                                           │
└──────────┴──────────────────────────────────────────┘
  Content starts at ~48px (or 128px with guide) → 120-200px saved
```

**Thay đổi chính:**
1. Merge dual header → 1 dòng 48px (breadcrumb + actions)
2. Workflow guide collapsible (nhớ state trong localStorage)
3. Sidebar: thêm "Recently used" section ở dưới
4. Section labels: Vietnamese có dấu + icon prefix
5. Command Center: search bar visible trên header

---

# 5. LỘ TRÌNH TRIỂN KHAI

## Sprint 0: Foundation (2 ngày)

| # | Task | Impact | Risk |
|---|------|--------|------|
| 0.1 | **Thêm `storageHelpers.js`** — try/catch wrapper cho localStorage | 🔴 Ngăn crash | Zero risk |
| 0.2 | **Tạo `src/domains/` folder** + barrel `index.js` re-exporting from `store.js` | Setup | Zero risk |
| 0.3 | **Fix language** — Vietnamese có dấu cho section labels + sidebar text | 🟡 Visual | Zero risk |

## Sprint 1: Store.js Decomposition (5-7 ngày)

| # | Task | Lines moved | Dependencies |
|---|------|-------------|-------------|
| 1.1 | Extract `reportSchedule.js` | ~630 | None |
| 1.2 | Extract `columnConfig.js` | ~600 | helpers.js |
| 1.3 | Extract `deletedDeclLog.js` | ~350 | helpers.js |
| 1.4 | Extract `hqAgencies.js` + `hqHistory.js` | ~900 | helpers.js |
| 1.5 | Extract `teams/teamRoster.js` | ~900 | helpers.js |
| 1.6 | Extract `kpiAdjustments.js` | ~1,750 | helpers.js, normalize |
| 1.7 | Extract `mstAssignment.js` + `mstHistory.js` | ~860 | mstNormalize |
| 1.8 | Extract `declarationMerge.js` | ~500 | mstNormalize |
| 1.9 | Extract `declHistory.js` | ~2,200 | declarationMerge |
| 1.10 | Delete `store.js`, replace with barrel `index.js` | — | All above |

**Test strategy:** Mỗi extraction phải giữ nguyên export API. Chạy 106 tests sau mỗi step.

## Sprint 2: UX Quick Wins (3-5 ngày)

| # | Task | Files affected |
|---|------|---------------|
| 2.1 | **Collapsible workflow guide** | `AppShellWorkflowGuide.jsx` |
| 2.2 | **Unified header** (merge dual headers) | `App.jsx`, `AppShellFrame.jsx`, new `UnifiedHeader.jsx` |
| 2.3 | **Skeleton loading states** | New `TabPanelSkeleton.jsx` |
| 2.4 | **Friendly error component** | New `FriendlyError.jsx` (thay HTTP 503) |
| 2.5 | **Command Center search bar visible** | `App.jsx`, `CommandCenter.jsx` |
| 2.6 | **Shared EmptyState + StatusBadge** | New files in `shared/` |

## Sprint 3: Architecture Completion (5-7 ngày)

| # | Task | Impact |
|---|------|--------|
| 3.1 | **Dashboard landing page** | New `dashboard/` module |
| 3.2 | **Tách CommandCenter** → hooks + render | 1,179 → ~300 dòng render |
| 3.3 | **Circuit breaker cho storageClient** | Sync resilience |
| 3.4 | **Consolidate normalize → domain package** | Single source of truth |
| 3.5 | **Test `computeKPI` + `normalizeAdjustmentInput`** | Business-critical |
| 3.6 | **URL hash routing** | Shareable deep links |

## Sprint 4: Polish & Hardening (3-5 ngày)

| # | Task | Priority |
|---|------|----------|
| 4.1 | Enable CSP + explicit CORS | P3 |
| 4.2 | Keyboard shortcuts (Ctrl+S, Escape) | P3 |
| 4.3 | Replace hardcoded colors → CSS variables | P3 |
| 4.4 | TypeScript for frontend domain models | Ongoing |
| 4.5 | Deprecate/document `reportingLegacyMath.js` | P3 |

---

## Tổng kết Effort

| Sprint | Duration | Focus | Risk Level |
|--------|----------|-------|------------|
| Sprint 0 | 2 ngày | Foundation & safety | 🟢 Zero |
| Sprint 1 | 5-7 ngày | `store.js` decomposition | 🟡 Medium (nhiều file di chuyển) |
| Sprint 2 | 3-5 ngày | UX quick wins | 🟢 Low |
| Sprint 3 | 5-7 ngày | Architecture completion | 🟡 Medium |
| Sprint 4 | 3-5 ngày | Polish & hardening | 🟢 Low |
| **Total** | **18-26 ngày** | **Full modernization** | |

---

> 📝 Opus Review V2 — Unified UX Audit & Architecture Proposal  
> Generated 02/04/2026 · Methodology: Source code deep-dive + Live UI testing  
> Coverage: 9,350-line `store.js`, 15 server-v4 modules, 106 test files, 12 UI tabs tested
