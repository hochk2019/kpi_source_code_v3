# Phase 2b: Business Logic Deep Review

**Date**: 2026-04-25  
**Based on**: Phase 1 + Phase 2a findings

---

## Architecture: Data Flow Overview

```
Frontend (React 19)                    Backend (Express/TypeScript)
─────────────────────                  ────────────────────────────
storageClient.js (localStorage)   ←→   server-v4 API (REST)
      ↓                                     ↓
storeRuntime.js (barrel export)         Controllers → Services → Repositories
      ↓                                     ↓
Feature Stores:                        Persistence:
  declWriteStore.js (declarations)       SQLite / PostgreSQL
  declReadStore.js                       
  kpiAdjustments/ (entries/settings)   
  mstAssignments.js (MST ↔ staff)     
  rules.js (KPI calculation engine)   
  teamRoster.js                        
  hqAgencies.js                        
  auditLog.js                          
```

---

## ✅ Positive Findings

### BL-GOOD-1: Clean module separation in server-v4
- 15 domain modules, each with Controller → Service → Repository → Store layers
- BaseController with standardized Zod validation error handling
- Consistent `{ok, data}` / `{ok, error}` response format

### BL-GOOD-2: Robust input normalization
- `normalizeDeclRows`, `normalizeStr`, `normalizeName`, `normalizeMST`, `normalizeDeclarationNumber` — comprehensive normalization pipeline
- Month parsing handles 5+ date formats (ISO, compact, slash-separated, dd/mm/yyyy, mm/dd/yyyy)
- KPI adjustment entries have multi-format category and reference normalization

### BL-GOOD-3: KPI calculation engine is well-structured
- `computeKPI()` in `rules.js` follows clear pipeline: code → group detection → base points → item points → license points → CO bonus → rounding
- Rounding uses `Math.round((point + Number.EPSILON) * 10) / 10` — handles floating point correctly
- License points support per-code mapping, exclusion by code, exclusion by agency

### BL-GOOD-4: Audit trail coverage
- `pushAuditLog()` called on all write operations (merge, overwrite, delete, import)
- Import logs include `insertedDeclarations`, `updatedDeclarations`, `lockedDeclarations` with limits
- Declaration locking mechanism prevents overwrite of reviewed data

### BL-GOOD-5: Zod validation on all backend routes
- 43 `req.body` usages across 16 route files — all Controllers extend BaseController
- Zod validation errors return 400 with `error.flatten()` details
- Consistent pattern across all modules

---

## ⚠️ Issues Found

### BL-001: storeRuntime.js is a God Barrel (HIGH)
- **File**: `src/lib/storeRuntime.js` (1087 lines → grew to 1933 after recent changes)
- **Issue**: Re-exports from 12+ stores + adds utility functions + has own business logic (date conversion, MST augmentation, import logging). Mixes concerns.
- **Impact**: 
  - Every store change touches this file
  - Circular dependency risk (rules.js imports from store.js, storeRuntime imports from rules stores)
  - Hard to tree-shake — importing 1 function loads entire bundle
- **Fix**: Split into domain-specific barrel files: `declStore.js`, `mstStore.js`, `kpiStore.js`, etc. Keep storeRuntime as thin re-export only.
- **Effort**: L

### BL-002: Dual storage backend creates consistency risk (MEDIUM)
- **Frontend**: Uses `localStorage` (via `storageClient.js`) as primary store
- **Backend**: Uses SQLite/PostgreSQL as source of truth
- **Sync**: `useDataImporterSync.js` (1059 lines) handles bidirectional sync
- **Risk**: If sync fails mid-operation, localStorage and backend can diverge. No conflict resolution timestamp or vector clock.
- **Impact**: Data inconsistency between tabs, between frontend cache and server
- **Fix**: Move toward server-as-source-of-truth, use localStorage as read cache only. Already partially done with v4 migration.
- **Effort**: L (ongoing migration)

### BL-003: computeKPI lacks defensive guards on some inputs (MEDIUM)
- **File**: `src/lib/rules.js:1449`
- **Issue**: `const code = norm(row?.loaiHinh || row?.loai_hinh)` — if both fields are 0 or empty string, code becomes empty → group not found → point = 0 (silent wrong result instead of error)
- **Impact**: Declarations with unusual field naming silently get 0 points
- **Fix**: Add warning/logging when group detection fails for non-empty declarations
- **Effort**: XS

### BL-004: Import merge doesn't validate field consistency (MEDIUM)
- **File**: `src/lib/declWriteStore.js:197-296`
- **Issue**: `computeDeclImportDiff` trusts `getDeclarationKey()` but doesn't validate that incoming rows have all expected fields. Missing fields silently become undefined.
- **Impact**: Partial data can be merged into store, corrupting existing records
- **Fix**: Add schema validation before merge (at least required fields: so_tk, nhanh, date)
- **Effort**: S

### BL-005: Legacy math coexistence (MEDIUM)
- **File**: `packages/domain/src/reportingLegacyMath.js` (970 lines)
- **Issue**: Both legacy and new reporting math exist. Unclear when legacy is used vs new.
- **Impact**: Report numbers could differ depending on code path
- **Fix**: Document which path is active, add deprecation warnings, plan removal timeline
- **Effort**: M

### BL-006: KPI adjustment permissions are sync-checked but function is async-wrapped (LOW)
- **File**: `src/lib/storeRuntime.js:1368` wraps sync `declWriteStore.saveDeclRows` with `async`
- **Issue**: Permission checks (`adjustSubmit`, `adjustApprove`) throw synchronously but the wrapper is async → callers must handle both sync throw and async rejection
- **Fix**: Either make everything truly async or keep sync — don't mix
- **Effort**: S

---

## Summary

| Severity | Count | Key Items |
|----------|-------|-----------|
| HIGH | 1 | BL-001: storeRuntime God Barrel |
| MEDIUM | 4 | BL-002: dual storage, BL-003: silent 0-point, BL-004: no field validation, BL-005: legacy math |
| LOW | 1 | BL-006: sync/async mismatch |
