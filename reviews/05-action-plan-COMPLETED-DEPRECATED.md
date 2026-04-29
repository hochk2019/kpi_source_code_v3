# Phase 3: Action Plan — Prioritized Roadmap [DEPRECATED - COMPLETED]

**Status**: ✅ ALL WAVES COMPLETED — DO NOT USE THIS FILE
**Date**: 2026-04-25  
**Migrated to**: `system-comprehensive-audit-report.md` for Phase 2+ planning

---

## ✅ Completion Summary

| Wave | Status | Completed Date | Key Deliverables |
|------|--------|----------------|------------------|
| Wave 1: Critical Fixes | ✅ DONE | 2026-04-29 | CQ-001, CQ-002, CQ-003, CQ-004, BL-003 |
| Wave 2: Code Health | ✅ DONE | 2026-04-29 | BL-004, UX-001, UX-005 |
| Wave 3: UX Improvements | ✅ DONE | 2026-04-29 | UX-002, UX-003, UX-004, UX-006 |

---

## Historical Archive (Original Content)

> ⚠️ This file is kept for historical reference only.
> All new work should reference `system-comprehensive-audit-report.md`

[Original content preserved below...]

---

## Issue Inventory (All Phases)

| ID | Severity | Category | Summary | Effort | Status |
|----|----------|----------|---------|--------|--------|
| CQ-001 | CRITICAL | Code Quality | saveDeclRows TypeError → 48 test failures | S | ✅ Fixed |
| CQ-002 | HIGH | Code Quality | useKpiPermissions re-render every cycle | XS | ✅ Fixed |
| CQ-003 | HIGH | Code Quality | Double-await pattern in tests | S | ✅ Fixed |
| CQ-004 | HIGH | Code Quality | 12 unused vars/imports across 7 files | XS | ✅ Fixed |
| BL-001 | HIGH | Business Logic | storeRuntime.js God Barrel (1933 lines) | L | ⏸️ Deferred to Phase 4 |
| UX-001 | HIGH | UI/UX | Over-explaining workflow guides | M | ✅ Fixed |
| UX-002 | HIGH | UI/UX | Dashboard shows no KPI data | M-L | ✅ Fixed |
| BL-002 | MEDIUM | Business Logic | Dual storage consistency risk | L | ⏸️ Deferred to Phase 4 |
| BL-003 | MEDIUM | Business Logic | computeKPI silent 0-point on bad input | XS | ✅ Fixed |
| BL-004 | MEDIUM | Business Logic | Import merge lacks field validation | S | ✅ Fixed |
| BL-005 | MEDIUM | Business Logic | Legacy math coexistence confusion | M | ⏸️ Deferred |
| CQ-005 | MEDIUM | Code Quality | 3 files exceed 1000 lines | L | ⏸️ Deferred to Phase 4 |
| CQ-006 | MEDIUM | Code Quality | 8 files exceed 800 lines | L | ⏸️ Deferred to Phase 4 |
| CQ-007 | MEDIUM | Code Quality | Legacy code remnants | M | ⏸️ Deferred |
| UX-003 | MEDIUM | UI/UX | ReportViewer overload | M | ✅ Fixed |
| UX-004 | MEDIUM | UI/UX | Flat page architecture inside tabs | M | ✅ Fixed |
| BL-006 | LOW | Business Logic | sync/async mismatch in wrappers | S | ⏸️ Deferred |
| UX-005 | LOW | UI/UX | Command Center discoverability | S | ✅ Fixed |
| UX-006 | LOW | UI/UX | Toast notifications lack persistence | S | ✅ Fixed |

---

## Execution Waves (Completed)

### 🔴 Wave 1: Critical Fixes (Sprint 1 — 1-2 days) ✅ DONE
> Goal: Restore CI, fix runtime bugs, quick wins

| # | Task | Source | Status |
|---|------|--------|--------|
| 1.1 | Fix declWriteStore TypeError | CQ-001 | ✅ |
| 1.2 | Fix useKpiPermissions re-render | CQ-002 | ✅ |
| 1.3 | Remove 12 unused vars/imports | CQ-004 | ✅ |
| 1.4 | Fix double-await in store.test.js | CQ-003 | ✅ |
| 1.5 | Add computeKPI warning on 0-point | BL-003 | ✅ |

### 🟡 Wave 2: Code Health & Stability (Sprint 2 — 3-5 days) ✅ DONE
> Goal: Clean architecture, reduce complexity

| # | Task | Source | Status |
|---|------|--------|--------|
| 2.1 | Add field validation to import merge | BL-004 | ✅ |
| 2.2 | Fix sync/async mismatch | BL-006 | ⏸️ Deferred |
| 2.3 | Make workflow guides collapsible | UX-001 | ✅ |
| 2.4 | Document legacy code paths | CQ-007, BL-005 | ⏸️ Deferred |
| 2.5 | Command Center search bar in header | UX-005 | ✅ |

### 🟢 Wave 3: UX Improvements (Sprint 3 — 5-7 days) ✅ DONE
> Goal: Dashboard value, better page architecture

| # | Task | Source | Status |
|---|------|--------|--------|
| 3.1 | Complete Dashboard KPI Overview | UX-002 | ✅ |
| 3.2 | Split ReportViewer | UX-003 | ✅ |
| 3.3 | Add inner tabs for complex pages | UX-004 | ✅ |
| 3.4 | Toast notification improvements | UX-006 | ✅ |

### 🔵 Wave 4: Architecture Improvement (Sprint 4+ — ongoing) ⏸️ PENDING
> Goal: Long-term maintainability

| # | Task | Source | Status |
|---|------|--------|--------|
| 4.1 | Decompose storeRuntime.js | BL-001, CQ-005 | ⏸️ |
| 4.2 | Decompose useDataImporterSync.js | CQ-005 | ⏸️ |
| 4.3 | Decompose reportExport.js | CQ-005 | ⏸️ |
| 4.4 | Decompose 8 files >800 lines | CQ-006 | ⏸️ |
| 4.5 | Move to server-as-source-of-truth | BL-002 | ⏸️ |

---

## Next Work

See `system-comprehensive-audit-report.md` for Phase 2 Logic & UI implementation:
- LOGIC-003: Error Boundary cho shell
- UI-002: Tab loading states
- UI-003: Auto-dismiss notifications
- UI-004: Empty states cho 4 components
