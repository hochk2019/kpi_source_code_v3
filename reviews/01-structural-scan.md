# Phase 1: Structural Scan — kpi_source_code_v4

**Date**: 2026-04-25  
**Commit**: dc93dfc  
**Branch**: ux-improvement-plan  
**GitNexus**: 18,716 nodes | 32,651 edges | 728 clusters | 300 flows

---

## 📊 Metrics Overview

| Metric | Value |
|--------|-------|
| Total Source LOC | ~100,646 |
| Frontend files (src/) | 372 (components: 312, hooks: 9, lib: 39) |
| Backend files (server-v4/) | 148 |
| Shared packages (packages/) | 75 |
| Test files | 399 |
| Dependencies (prod) | 42 |
| Dependencies (dev) | 22 |
| TODO/FIXME/HACK markers | 1 |
| Files > 500 lines | 36 |
| Files > 800 lines | 8 |
| Files > 1000 lines | 3 |

---

## Architecture Overview

### Tech Stack
- **Frontend**: React 19 + Vite 6 + TailwindCSS 4 + Radix UI + Recharts
- **Backend**: Express 4 (server-v4, TypeScript) + better-sqlite3 + pg + mssql
- **Testing**: Vitest + Testing Library + Playwright + Supertest
- **Build**: Vite, pnpm monorepo (workspaces)
- **CI**: simple-git-hooks (pre-commit → lint+test, post-commit → gitnexus refresh)

### Project Structure
```
kpi_source_code_v4/
├── src/                    # Frontend React (372 files)
│   ├── components/         # 18 feature modules (312 files)
│   │   ├── appShell/       # App layout, navigation, dashboard
│   │   ├── dataImporter/   # Data import workflows
│   │   ├── kpi-adjustments/# KPI adjustment forms
│   │   ├── mst-assignment/ # MST assignment tables
│   │   ├── reporting/      # Report panels and charts
│   │   ├── ai-assistant/   # AI chat integration
│   │   ├── account-manager/# User account management
│   │   ├── team-manager/   # Team/roster management
│   │   ├── hq-agency-manager/ # HQ agency management
│   │   ├── rules-editor/   # KPI rules editor
│   │   ├── command-center/ # Command palette
│   │   ├── data-health-dashboard/ # Data health monitoring
│   │   ├── ui/             # shadcn/ui primitives
│   │   └── shared/         # Shared components
│   ├── hooks/              # Custom React hooks (9 files)
│   ├── lib/                # Business logic & store (39 files)
│   ├── auth/               # Authentication
│   └── designSystem/       # Design tokens
├── server-v4/src/          # Backend TypeScript (148 files)
│   ├── modules/            # 15 domain modules
│   │   ├── declarations/   # Core ECUS declarations
│   │   ├── reporting/      # Report generation
│   │   ├── kpi-rules/      # KPI rule engine
│   │   ├── kpi-adjustments/# KPI adjustment CRUD
│   │   ├── teams/          # Team management
│   │   ├── auth/           # Authentication & CSRF
│   │   ├── ai/             # AI assistant routes
│   │   └── ...             # 8 more modules
│   ├── persistence/        # DB adapters (SQLite + Postgres)
│   ├── http/               # Express middleware
│   └── app/                # App bootstrap & rollout
├── packages/               # Shared workspace packages (75 files)
│   ├── api-client/         # Frontend API client
│   ├── backend-shared/     # Shared backend utils, ECUS bridge, reporting
│   ├── domain/             # Domain logic (legacy math)
│   └── ui/                 # Shell UI primitives
├── tests/                  # Test suite (399 files)
└── scripts/                # Dev/build/deploy scripts
```

---

## ✅ Tốt

- **Modular backend**: server-v4 có 15 modules rõ ràng, tách biệt theo domain
- **Test coverage tốt**: 399 test files, server-v4 tests pass 100% (44 files, 159 tests)
- **Git hooks**: pre-commit chạy lint + tests tự động
- **GitNexus indexed**: 300 execution flows tracked
- **Monorepo workspace**: packages/ tách shared logic ra riêng
- **Modern stack**: React 19, Vite 6, TailwindCSS 4, TypeScript backend
- **Dual DB support**: SQLite (dev) + PostgreSQL (prod) abstraction
- **Almost no TODOs**: Chỉ 1 TODO marker trong toàn bộ source

---

## ⚠️ Cảnh báo (Medium)

### W1. 36 files vượt 500 dòng (Complexity)
Nhiều file frontend component vượt quá 500-800 dòng, vi phạm quy tắc 800-line module limit.
- **Top offenders**: `storeRuntime.js` (1087), `useDataImporterSync.js` (1059), `reportExport.js` (1041), `reportingLegacyMath.js` (970)
- **Impact**: Khó maintain, dễ tạo bugs, khó test riêng từng phần

### W2. 12 ESLint warnings (Unused vars/imports)
- `shellPrimitives.jsx`: 2 unused destructured props
- `App.jsx`: unused `clearStorageCache`, `isAdmin`
- `ExportAuditReport.jsx`: unused `resolveRoleLabel`, `setPageSize`
- `KPICalculator.jsx`: unused `buildAppShellWorkflowState`
- `ReportViewer.jsx`: unused `useChartPalette`, `managedCompanyCount`
- `DataImporterWorkflowGuide.jsx`: unused `getWorkflowStageStatus`, `steps`
- **Impact**: Dead code pollution, potential stale logic

### W3. React hooks dependency warning
- `useKpiPermissions.js:16`: `permissions` logical expression could cause re-render loop
- **Impact**: Possible performance issue, unexpected re-renders

### W4. Legacy code remnants
- `packages/domain/src/reportingLegacyMath.js` (970 lines) — "legacy" in name
- `server-v4/src/modules/ai/aiLegacyRoutes.js` (617 lines)
- `server-v4/src/legacy/` directory exists
- **Impact**: Confusion between legacy and new code paths

### W5. Double await pattern
- `tests/store.test.js:2823`: `await await saveKpiAdjustmentSettings(...)` — redundant double await
- **Impact**: Works but indicates unclear async contract

---

## ❌ Nghiêm trọng (Critical/High)

### E1. ❌ CRITICAL: Runtime TypeError in declWriteStore.js
```
TypeError: Cannot read properties of undefined (reading 'toLocaleString')
  at Object.saveDeclRows src/lib/declWriteStore.js:428:221
  at Module.saveDeclRows src/lib/storeRuntime.js:1372:25
```
- **Triggered by**: 4 test cases in store.test.js (lines 1129, 1166, 1204, 1265)
- **Impact**: Core business function `saveDeclRows` crashes on undefined data — potential data loss in production
- **Root cause**: Missing null check before `.toLocaleString()` call

### E2. ❌ HIGH: Frontend tests failing (48/87 fail)
- store.test.js: 48 failures due to Unhandled Rejections from E1
- Pre-commit hook bypassed with `--no-verify` for this commit
- **Impact**: CI pipeline effectively broken for frontend tests

### E3. ❌ HIGH: Massive files need decomposition
- `storeRuntime.js` (1087 lines) — Central state management, too many responsibilities
- `useDataImporterSync.js` (1059 lines) — Sync orchestration god-hook
- `reportExport.js` (1041 lines) — Report export monolith
- **Impact**: High bug surface area, impossible to unit test individual behaviors

---

## 📈 Test Results Summary

| Suite | Status | Files | Tests |
|-------|--------|-------|-------|
| server-v4 | ✅ PASS | 44/44 | 159/159 |
| frontend (store.test.js) | ❌ FAIL | 0/2 | 39/87 (48 failures) |
| lint | ⚠️ WARN | 1 error + 12 warnings | - |

---

## Next: Phase 2a (Code Quality Deep Dive)
Focus areas based on this scan:
1. `declWriteStore.js:428` — root cause of TypeError
2. `storeRuntime.js` — decomposition analysis
3. Unused imports/vars cleanup
4. `useKpiPermissions.js` — hooks dependency fix
