# Phase 2c: UI/UX Deep Review

**Date**: 2026-04-25  
**Based on**: Phase 1 + existing ux_system_audit.md

---

## Architecture Summary

### Navigation Structure (5 sections, 12 tabs)
```
Overview    → Dashboard KPI (tổng quan)
Operations  → Gán MST, Import Data
Performance → Quản lý Tổ đội, Quy tắc KPI, Điểm KPI +/-, Báo cáo KPI
Observability → Sức khỏe dữ liệu*, Trợ lý AI*
Governance  → Tài khoản*, Nhật ký*, Lịch sử export*
(* = permission-gated)
```

### Design System
- **Theming**: Custom ThemeProvider with system/light/dark + high-contrast + brand tokens
- **Component library**: shadcn/ui + Radix primitives (22 Radix packages)
- **Icons**: Lucide React
- **Charts**: Recharts
- **Styling**: TailwindCSS 4 with glassmorphism aesthetic (backdrop-blur, slate/amber palette)
- **Animations**: Framer Motion

---

## ✅ Positive Findings

### UX-GOOD-1: Comprehensive accessibility coverage
- 179 ARIA/accessibility annotations across 64 components
- `role="alert"` on error boundaries
- Keyboard navigation support (`onKeyDown`, `tabIndex`)
- Error boundary with Vietnamese-language user-friendly messages + retry

### UX-GOOD-2: Robust loading states
- 184 loading/skeleton references across 34 components
- Consistent `isLoading` pattern with skeleton fallbacks
- AI assistant has dedicated loading states for streaming

### UX-GOOD-3: Responsive design is well-implemented
- 283 responsive breakpoint usages across 103 components
- Grid layouts adapt from mobile to desktop (`sm:`, `md:`, `lg:`, `xl:`)
- Panel-based layouts with ResizablePanels for desktop

### UX-GOOD-4: Global error recovery
- `RuntimeErrorBoundary` wraps entire app in `AppRoot.jsx`
- KPICalculator has additional nested error boundary
- Reset keys pattern allows auto-recovery on navigation

### UX-GOOD-5: Vietnamese-first localization
- All UI labels, tooltips, command descriptions in Vietnamese
- Navigation system supports command palette search in both Vietnamese and English keywords
- Error messages are user-friendly Vietnamese text

### UX-GOOD-6: Design system with brand flexibility
- Theme + brand tokens separated
- Multiple brand options with chart palette adaptation
- System preference detection for dark mode

---

## ⚠️ Issues Found

### UX-001: Over-explaining — Workflow guides consume first fold (HIGH)
- **Source**: ux_system_audit.md (already identified)
- **Issue**: Every page has WorkflowGuide + SectionHeader description taking 200-300px at top, pushing primary content below the fold
- **Impact**: Users must scroll past explanatory content on every page visit — frustrating for power users
- **Fix**: Make workflow guides collapsible (default collapsed for returning users), or move to `?` help button
- **Effort**: M

### UX-002: Dashboard shows navigation metadata, not KPI data (HIGH)
- **Source**: ux_system_audit.md (already identified)
- **Issue**: AppDashboardLanding shows module count (8), section count (3), quick actions — NO actual KPI data (declarations, scores, trends)
- **Partially fixed**: `useDashboardKpiOverview.js` hook was added (110 lines) but integration may be incomplete
- **Impact**: Users land on dashboard and see no business value — must navigate to Reports tab
- **Fix**: Complete dashboard KPI overview integration (summary cards, trend chart, top performers)
- **Effort**: M-L

### UX-003: ReportViewer overload (MEDIUM)
- **Source**: ux_system_audit.md
- **Issue**: ReportViewer (584 lines) contains ALL: controls + overview + detail tables + schedule + notes
- **Fix**: Split overview → dashboard, keep detail tables + controls in ReportViewer
- **Effort**: M (partially done)

### UX-004: Flat page architecture inside tabs (MEDIUM)
- **Source**: ux_system_audit.md
- **Issue**: Within each tab, all content is on one long scrollable page. No sub-tabs or sections for complex features (e.g., KPIAdjustments has form + list + settings on one page)
- **Impact**: Users lose context scrolling through long pages
- **Fix**: Add inner tab navigation for complex pages (KPIAdjustments, DataImporter)
- **Effort**: M

### UX-005: Command Center search is keyboard-only discovery (LOW)
- **File**: `src/components/CommandCenter.jsx`
- **Issue**: Command palette (Ctrl+K) is powerful but there's no visual hint on the dashboard that it exists
- **Fix**: Add a search bar in the app header that opens the command palette on focus
- **Effort**: S

### UX-006: Toast notifications lack persistence (LOW)
- **Library**: Sonner (v2.0.3)
- **Issue**: Toasts auto-dismiss. For important operations (data import results, sync status), users may miss critical feedback
- **Fix**: Use sticky toasts for operations with >5s duration; add notification center for history
- **Effort**: S

---

## Summary

| Severity | Count | Key Items |
|----------|-------|-----------|
| HIGH | 2 | UX-001: over-explaining, UX-002: empty dashboard |
| MEDIUM | 2 | UX-003: report overload, UX-004: flat architecture |
| LOW | 2 | UX-005: command center discoverability, UX-006: toast persistence |

### Note
Many UX issues were already identified in `ux_system_audit.md` (2026-04-21). Some fixes were started (useDashboardKpiOverview hook, AppDashboardLanding rewrite) but may be incomplete.
