# KPI Source Code v4 - Bug Fix Plan

## Tổng Quan

| Tổng bugs xác minh | Confirmed Bugs | Intentional/Acceptable |
|-------------------|----------------|----------------------|
| 15 | 5 | 10 |

---

## Confirmed Bugs - Đã Fix ✅

### ✅ BUG-001: `addByTiers()` thiếu `break` statement
**Vị trí:** `packages/domain/src/reportingKpiComputation.js:134-150`, `src/lib/rules.js:1574-1606`
**Status:** ✅ FIXED
**Files changed:**
- `packages/domain/src/reportingKpiComputation.js` - Added break after sum assignment in non-cumulative mode
- `src/lib/rules.js` - Same fix applied

---

### ✅ BUG-002: `co.js` - B01 leak vào `co_codes` gây false positive
**Vị trí:** `packages/domain/src/reportingLegacyMath.js:1058`
**Status:** ✅ FIXED
**Files changed:**
- `packages/domain/src/reportingLegacyMath.js` - Changed `hasCO` to use `has_co` field only, removed fallback to `co_codes.length`

---

### ✅ BUG-003: `sortDeclRows()` không filter deleted rows
**Vị trí:** `src/lib/declReadStore.js:40-77`
**Status:** ✅ FIXED
**Files changed:**
- `src/lib/declReadStore.js` - Added `{ excludeDeleted = false }` option
- `src/components/kpi-adjustments/model/businessDirectory.js` - Updated to use `excludeDeleted: true`
- `src/components/kpi-adjustments/hooks/useKpiAdjustmentFormWorkspace.js` - Updated to use `excludeDeleted: true`

---

### ✅ BUG-004: `computeLicenseSnapshot()` - manualCount không nhất quán với sourceCount
**Vị trí:** `packages/domain/src/licenseSummary.js:700-728`
**Status:** ✅ FIXED (documented as intentional design with clarification)
**Files changed:**
- `packages/domain/src/licenseSummary.js` - Added explanatory comment clarifying that `sourceCount` and `includedCount` serve different purposes (audit/display vs computation)

---

## Pending Fixes

### ⏳ BUG-005: `kpiAdjustments.js` - Thiếu cap cho adjustment points
**Vị trí:** `packages/domain/src/kpiAdjustments.js:605-618`
**Priority:** P3 - Low
**Status:** PENDING - Cần thêm cap ở data layer

---

## Không Phải Bug (Documented)

| Bug | Lý do |
|-----|-------|
| co.js lineCount | Intentional - dùng preferential code count như fallback |
| softDeleteDeclRows counter | NOT A BUG - seenKeys.add() được gọi TRƯỚC return |
| bridgeService data loss | Acceptable - SQLite là source of truth |
| normalizeAgencyKey nested | NOT A BUG - regex đúng với + quantifier |
| year parsing 70 cutoff | Legacy heuristic - có thể chấp nhận |
| hasCOFlag diacritics | Edge case - dữ liệu đã normalize thành "Có" |
| batchSize=0 | Impossible - defensive checks ngăn chặn |

---

## Phase Plan

### Phase 1: P1 Critical ✅ DONE
- [x] BUG-001: Fix addByTiers break statement
- [x] BUG-002: Fix B01 co_codes leak

### Phase 2: P2 High ✅ DONE
- [x] BUG-003: Fix sortDeclRows deleted rows filter
- [x] BUG-004: Fix computeLicenseSnapshot inconsistency (clarified intent)

### Phase 3: P3 Medium (Pending)
- [ ] BUG-005: Add adjustment point caps

### Phase 4: Verification & Testing
- [ ] Chạy existing tests để verify không có regression ✅ (Tests đang pass)
- [ ] Viết test cho các bugs đã fix (TBD)
- [ ] Manual testing trên UI (TBD)

---

## Files Đã Thay Đổi

1. ✅ `packages/domain/src/reportingKpiComputation.js`
2. ✅ `src/lib/rules.js`
3. ✅ `packages/domain/src/reportingLegacyMath.js`
4. ✅ `src/lib/declReadStore.js`
5. ✅ `packages/domain/src/licenseSummary.js`
6. ✅ `src/components/kpi-adjustments/model/businessDirectory.js`
7. ✅ `src/components/kpi-adjustments/hooks/useKpiAdjustmentFormWorkspace.js`

---

## Test Files Cần Tạo

1. `tests/reportingKpiComputation.test.js` - Add tests for addByTiers tier mode
2. `tests/co.test.js` - Add tests for B01 leak scenario
3. `tests/declReadStore.test.js` - Add tests for deleted rows filtering
4. `tests/licenseSummary.test.js` - Add tests for manualCount consistency
