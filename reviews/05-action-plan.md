# Phase 3: Action Plan — Prioritized Roadmap

**Date**: 2026-04-25  
**Based on**: Phase 1 (Structural) + Phase 2a (Code Quality) + Phase 2b (Business Logic) + Phase 2c (UI/UX)

---

## Issue Inventory (All Phases)

| ID | Severity | Category | Summary | Effort |
|----|----------|----------|---------|--------|
| CQ-001 | CRITICAL | Code Quality | saveDeclRows TypeError → 48 test failures | S |
| CQ-002 | HIGH | Code Quality | useKpiPermissions re-render every cycle | XS |
| CQ-003 | HIGH | Code Quality | Double-await pattern in tests | S |
| CQ-004 | HIGH | Code Quality | 12 unused vars/imports across 7 files | XS |
| BL-001 | HIGH | Business Logic | storeRuntime.js God Barrel (1933 lines) | L |
| UX-001 | HIGH | UI/UX | Over-explaining workflow guides | M |
| UX-002 | HIGH | UI/UX | Dashboard shows no KPI data | M-L |
| BL-002 | MEDIUM | Business Logic | Dual storage consistency risk | L |
| BL-003 | MEDIUM | Business Logic | computeKPI silent 0-point on bad input | XS |
| BL-004 | MEDIUM | Business Logic | Import merge lacks field validation | S |
| BL-005 | MEDIUM | Business Logic | Legacy math coexistence confusion | M |
| CQ-005 | MEDIUM | Code Quality | 3 files exceed 1000 lines | L |
| CQ-006 | MEDIUM | Code Quality | 8 files exceed 800 lines | L |
| CQ-007 | MEDIUM | Code Quality | Legacy code remnants | M |
| UX-003 | MEDIUM | UI/UX | ReportViewer overload | M |
| UX-004 | MEDIUM | UI/UX | Flat page architecture inside tabs | M |
| BL-006 | LOW | Business Logic | sync/async mismatch in wrappers | S |
| UX-005 | LOW | UI/UX | Command Center discoverability | S |
| UX-006 | LOW | UI/UX | Toast notifications lack persistence | S |

---

## Execution Waves

### 🔴 Wave 1: Critical Fixes (Sprint 1 — 1-2 days)
> Goal: Restore CI, fix runtime bugs, quick wins

| # | Task | Source | Effort | Details |
|---|------|--------|--------|---------|
| 1.1 | **Fix declWriteStore TypeError** | CQ-001 | S | Root cause: test data lacks fields needed by `saveDeclRows`. Add null guards at `declWriteStore.js:428` for `summary.skipped`, `summary.locked`. Also fix test data to include required fields. |
| 1.2 | **Fix useKpiPermissions re-render** | CQ-002 | XS | Move `const permissions = effectiveAuth.permissions \|\| {}` inside the useMemo callback at line 18 |
| 1.3 | **Remove 12 unused vars/imports** | CQ-004 | XS | Clean 7 files: App.jsx, ExportAuditReport.jsx, KPICalculator.jsx, ReportViewer.jsx, DataImporterWorkflowGuide.jsx, shellPrimitives.jsx |
| 1.4 | **Fix double-await in store.test.js** | CQ-003 | XS | Line 2823: `await await` → `await`. Audit all storeRuntime async wrappers |
| 1.5 | **Add computeKPI warning on 0-point** | BL-003 | XS | Add console.warn when `detectGroup()` returns null for non-empty declarations |

**Verification**: `pnpm run verify:server-v4 && pnpm run test && pnpm lint`

---

### 🟡 Wave 2: Code Health & Stability (Sprint 2 — 3-5 days)
> Goal: Clean architecture, reduce complexity

| # | Task | Source | Effort | Details |
|---|------|--------|--------|---------|
| 2.1 | **Add field validation to import merge** | BL-004 | S | Add Zod schema for required decl fields (so_tk, nhanh, date) before `computeDeclImportDiff` |
| 2.2 | **Fix sync/async mismatch** | BL-006 | S | Audit storeRuntime.js: remove `async` from wrappers that call sync store functions, OR make all stores truly async |
| 2.3 | **Make workflow guides collapsible** | UX-001 | M | Add `collapsed` state (localStorage-persisted), default open for first visit, collapsed for returning users |
| 2.4 | **Document legacy code paths** | CQ-007, BL-005 | M | Add `@deprecated` JSDoc to legacy files, document which code path is active, create migration plan |
| 2.5 | **Command Center search bar in header** | UX-005 | S | Add visible search input in AppShellFrame header that triggers command palette |

**Verification**: `pnpm run verify:smoke:core`

---

### 🟢 Wave 3: UX Improvements (Sprint 3 — 5-7 days)
> Goal: Dashboard value, better page architecture

| # | Task | Source | Effort | Details |
|---|------|--------|--------|---------|
| 3.1 | **Complete Dashboard KPI Overview** | UX-002 | M-L | Integrate `useDashboardKpiOverview` with AppDashboardLanding: summary cards, trend chart, top performers, adjustment summary |
| 3.2 | **Split ReportViewer** | UX-003 | M | Move overview widgets to dashboard, keep detail tables + controls + schedule in ReportViewer |
| 3.3 | **Add inner tabs for complex pages** | UX-004 | M | KPIAdjustments: Form \| List \| Settings tabs. DataImporter: Import \| Review \| Sync tabs |
| 3.4 | **Toast notification improvements** | UX-006 | S | Sticky toasts for long operations, add notification history to NotificationCenter |

**Verification**: Manual UX review + `pnpm run test:smoke:frontend-canonical`

---

### 🔵 Wave 4: Architecture Improvement (Sprint 4+ — ongoing)
> Goal: Long-term maintainability

| # | Task | Source | Effort | Details |
|---|------|--------|--------|---------|
| 4.1 | **Decompose storeRuntime.js** | BL-001, CQ-005 | L | Split into domain barrels: declStore, mstStore, kpiStore, reportStore, teamStore. Keep storeRuntime as thin re-export |
| 4.2 | **Decompose useDataImporterSync.js** | CQ-005 | L | Split: sync orchestrator, conflict resolution, progress tracking as separate hooks |
| 4.3 | **Decompose reportExport.js** | CQ-005 | L | Split by sheet type: staff sheet, team sheet, summary sheet |
| 4.4 | **Decompose 8 files >800 lines** | CQ-006 | L | Prioritize: AuditLog.jsx, AccountManager.jsx, DataHealthDashboard.jsx |
| 4.5 | **Move to server-as-source-of-truth** | BL-002 | L | Reduce localStorage to read cache, add conflict resolution timestamps |

---

## Quick Reference

### Effort Scale
- **XS**: < 30 min
- **S**: < 2 hours
- **M**: < 1 day
- **L**: > 1 day

### Wave Priority Rules
1. **Wave 1** tasks can be started immediately — no dependencies
2. **Wave 2** depends on Wave 1 completion (CI must be green first)
3. **Wave 3** can run in parallel with Wave 2 (UX changes are independent)
4. **Wave 4** is incremental — do one file at a time, each is independent

### Risk Matrix
```
           Low Impact    High Impact
Low Effort   CQ-004       CQ-002, BL-003
             CQ-003       CQ-001
High Effort  CQ-006       BL-001, BL-002
             CQ-007       UX-002
```

---

## Bead Mapping

Each wave should create corresponding beads:

| Wave | Bead prefix | Example |
|------|------------|---------|
| Wave 1 | `cng-fix-*` | `cng-fix-declwrite-typeerror` |
| Wave 2 | `cng-stab-*` | `cng-stab-import-validation` |
| Wave 3 | `cng-ux-*` | `cng-ux-dashboard-kpi` |
| Wave 4 | `cng-arch-*` | `cng-arch-decompose-storeruntime` |
