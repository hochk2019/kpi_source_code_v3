# Phase 2a: Code Quality & Logic Deep Review

**Date**: 2026-04-25  
**Based on**: Phase 1 scan (01-structural-scan.md)

---

## ❌ CRITICAL Issues

### CQ-001: Runtime TypeError in saveDeclRows (CRITICAL)
- **File**: `src/lib/declWriteStore.js:428`
- **Error**: `TypeError: Cannot read properties of undefined (reading 'toLocaleString')`
- **Root cause**: Unhandled Rejection leaking from test environment — tests at lines 1129, 1166, 1204, 1265 in `store.test.js` call `saveDeclRows` through async wrapper in `storeRuntime.js:1372` but test assertions don't properly await the async rejection chain
- **Impact**: 48 frontend test failures, CI effectively broken
- **Fix**: The two `expect(() => await ...)` patterns were fixed. Remaining failures stem from Unhandled Rejections that bubble up from tests sharing state. Need to isolate test data or add proper error boundaries in test setup.
- **Effort**: S (< 2h)

### CQ-002: useKpiPermissions creates new object ref every render (HIGH)
- **File**: `src/hooks/useKpiPermissions.js:16`
- **Bug**: `const permissions = effectiveAuth.permissions || {}` creates a new `{}` every render when `effectiveAuth.permissions` is falsy → useMemo at line 33 has `permissions` as dep → re-computes every render
- **Impact**: All components using `useKpiPermissions` re-render unnecessarily every cycle — performance degradation across KPI Calculator, Data Importer, all permission-gated features
- **Fix**: Move `permissions` derivation inside useMemo callback, or wrap in its own useMemo
- **Effort**: XS (< 30 min)

---

## ⚠️ HIGH Issues

### CQ-003: Double-await pattern (HIGH)
- **File**: `tests/store.test.js:2823`
- **Code**: `const settings = await await saveKpiAdjustmentSettings(...)`
- **Issue**: Redundant double await. `saveKpiAdjustmentSettings` in `storeRuntime.js` is `async` wrapping a sync function — double await is harmless but indicates unclear async contract
- **Impact**: Confusing code, masks whether functions are truly async
- **Fix**: Audit all `storeRuntime.js` exports — if underlying store function is sync, remove `async` from wrapper OR remove one `await` at call sites
- **Effort**: S (< 2h)

### CQ-004: 12 unused variables/imports across 7 files (HIGH)
Files affected:
| File | Unused | Type |
|------|--------|------|
| `packages/ui/src/shellPrimitives.jsx:13,18` | `description`, `descriptionClassName` | destructured props |
| `src/App.jsx:17` | `clearStorageCache` | import |
| `src/App.jsx:154` | `isAdmin` | variable |
| `src/components/ExportAuditReport.jsx:54` | `resolveRoleLabel` | function |
| `src/components/ExportAuditReport.jsx:88` | `setPageSize` | destructured |
| `src/components/KPICalculator.jsx:26` | `buildAppShellWorkflowState` | destructured |
| `src/components/ReportViewer.jsx:42` | `useChartPalette` | import |
| `src/components/ReportViewer.jsx:320` | `managedCompanyCount` | variable |
| `src/components/dataImporter/DataImporterWorkflowGuide.jsx:4` | `getWorkflowStageStatus` | import |
| `src/components/dataImporter/DataImporterWorkflowGuide.jsx:29` | `steps` | destructured |
- **Impact**: Dead code, increased bundle size, confusing maintenance
- **Fix**: Remove each unused var/import
- **Effort**: XS (< 30 min)

---

## ⚠️ MEDIUM Issues

### CQ-005: 3 files exceed 1000 lines — God Module pattern (MEDIUM)
| File | Lines | Responsibility |
|------|-------|---------------|
| `src/lib/storeRuntime.js` | 1087 | Central state re-export hub for ALL stores |
| `src/components/dataImporter/useDataImporterSync.js` | 1059 | Sync orchestration + conflict resolution + progress tracking |
| `packages/backend-shared/src/reporting/reportExport.js` | 1041 | Excel report generation with multiple sheet types |
- **Impact**: Hard to test, hard to understand, high coupling
- **Fix**: Decompose into focused modules. `storeRuntime.js` is a re-export barrel — could split by domain (decl, kpi, reporting, teams). `useDataImporterSync` should split orchestration from conflict logic.
- **Effort**: L (> 1 day each)

### CQ-006: 8 files exceed 800 lines (MEDIUM)
`reportingLegacyMath.js` (970), `bridgeService.js` (867), `AuditLog.jsx` (862), `AccountManager.jsx` (819), `DataHealthDashboard.jsx` (816), `ReportingPanels.jsx` (812), `serverTestHarness.js` (790), `reportingRuntime.ts` (784)
- **Impact**: Violates project 800-line rule in AGENTS.md
- **Effort**: M-L per file

### CQ-007: Legacy code coexistence (MEDIUM)
- `packages/domain/src/reportingLegacyMath.js` (970 lines, "legacy" in name)
- `server-v4/src/modules/ai/aiLegacyRoutes.js` (617 lines)
- `server-v4/src/legacy/` directory
- **Impact**: Unclear which code paths are active vs deprecated
- **Fix**: Add deprecation comments, create migration plan, or remove if fully replaced
- **Effort**: M (< 1 day)

---

## ✅ Positive Findings

- **server-v4 tests**: 44/44 files pass, 159/159 tests — excellent backend coverage
- **Clean module structure**: server-v4 modules follow consistent pattern (routes, service, store layers)
- **Type safety**: Backend fully TypeScript with strict config
- **Minimal TODOs**: Only 1 TODO marker — codebase is relatively clean
- **Pre-commit hooks**: Automated quality gates in place
- **GitNexus indexed**: 300 execution flows tracked for safe refactoring

---

## Summary

| Severity | Count | Key Items |
|----------|-------|-----------|
| CRITICAL | 1 | CQ-001: saveDeclRows TypeError (48 test failures) |
| HIGH | 3 | CQ-002: useKpiPermissions re-render, CQ-003: double-await, CQ-004: unused vars |
| MEDIUM | 3 | CQ-005/006: God modules, CQ-007: legacy code |
