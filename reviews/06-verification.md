# Pre-Fix Verification — Wave 1

## Verified Issues

### ✅ CQ-001: CONFIRMED BUG — async/sync mismatch in declWriteStore
- **Root cause** (corrected): `storeRuntime.js:1331` defines `persistAndAnnotateDeclRows` as **async**, but `declWriteStore.saveDeclRows` (sync function) calls it at lines 376 and 412 **without await**
- `stored = persistAndAnnotateDeclRows(mergedRows)` → `stored` = Promise, not Array
- `stored.length` = undefined → `undefined.toLocaleString("vi-VN")` → TypeError
- Additionally: `ensureMSTEntriesForDeclRows` calls `upsertMSTRows` (async) without await at line 77
- **This is a BUG introduced when `persistAndAnnotateDeclRows` was made async**
- **Fix approach**: Make `declWriteStore.saveDeclRows` itself async and await both calls, OR make `persistAndAnnotateDeclRows` sync

### ✅ CQ-002: CONFIRMED BUG (minor) — useKpiPermissions re-render for guest
- Only affects when `effectiveAuth.permissions` is falsy → `{}` creates new ref every render
- Normal users with permissions object: ref is stable
- **Fix**: Move into useMemo callback
- **Severity downgraded**: LOW (only guest users affected)

### ✅ CQ-003: CONFIRMED HARMLESS — double-await
- `await await` on async function is no-op on second await
- **Fix**: Remove redundant await for clarity only
- **Severity downgraded**: LOW (cosmetic)

### ✅ CQ-004: CONFIRMED DEAD CODE — unused vars
- All 12 are genuinely unused, verified by ESLint
- **Fix**: Remove them

### ❌ BL-003: NOT A BUG — computeKPI 0-point is by design
- When `detectGroup()` returns null, only base + item points = 0
- License points and CO bonus are STILL calculated (lines 1473-1536)
- This is intentional: declarations may get points from licenses even without a matching group
- **REMOVED from Wave 1**

---

## Wave 1 Implementation Status (2026-04-26)

### ✅ CQ-001: DONE
- Made async: `saveDeclRows`, `ensureMSTEntriesForDeclRows`, `previewDeclRows` (declWriteStore), `updateDeclRowFields`, `softDeleteDeclRows`, `hardDeleteDeclRows`, `restoreDeclRows` (declMutationStore)
- Fixed runtime wrappers: `setTeamRoster`, `upsertHQAgencies`, `saveHQAgencyRow`, `deleteHQAgencyRow`, `setRules` (storeRuntime)
- Updated tests: ~50 await additions, removed double-await, added microtask flushes
- **Result**: `tests/store.test.js` 65/65 pass (was 17/65)
- **Follow-up bead**: `cng-jws` for pre-existing setItem fire-and-forget TypeError in declHistory/auditLog tests

### ✅ CQ-002: DONE
- Moved `permissions` derivation INSIDE `useMemo` callback in `src/hooks/useKpiPermissions.js`
- Removed `permissions` from useMemo deps (was breaking memoization on falsy)
- Added regression test suite: `tests/useKpiPermissions.test.jsx` (8 tests, including reference stability guards)
- **Result**: 8/8 pass; KPICalculator no longer re-renders unnecessarily for guest users

### ✅ CQ-003: DONE (handled during CQ-001)
- All `await await` patterns removed during CQ-001 test updates

### ✅ CQ-004: DONE (10/12 items)
- Removed: `clearStorageCache`, `isAdmin`, `isAdminRole` (App.jsx); `resolveRoleLabel`, `setPageSize`, `ROLE_LABELS`, `normalizeRoleKey` (ExportAuditReport.jsx); `buildAppShellWorkflowState` (KPICalculator.jsx); `useChartPalette`, `managedCompanyCount`, `roster`, `mstRows`, `getTeamRoster`, `getMSTMap`, `mapMemberNamesToTeams`, `normalizeName` (ReportViewer.jsx); `getWorkflowStageStatus`, `steps` (DataImporterWorkflowGuide.jsx)
- ReportViewer subscriptions preserved via `bumpVersion()` instead of orphan setters
- **SKIPPED 2 items**: `description`, `descriptionClassName` props in `shellPrimitives.jsx` are NOT dead code — `SectionHeader` destructures them but fails to render. 15+ call sites pass user-facing copy that gets silently dropped. **Follow-up bead**: `cng-bkp`

### Wave 1 Summary
- **Lines changed**: ~150 lines across 9 production files + 2 test files
- **Tests**: 73/73 pass on directly affected suites; 4 pre-existing fails in `reportViewer/shellPrimitives/ExportAuditReport` confirmed unchanged via `git stash` (not regressions)
- **ESLint**: 0 warnings on all modified files
- **Open beads**: `cng-jws` (P1, declHistory setItem TypeError), `cng-bkp` (P1, SectionHeader missing render)
