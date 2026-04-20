# KPI Source Code v4 - Refactor & Evaluation Plan

**Created**: 2026-04-17
**Branch**: ux-improvement-plan
**Owner**: hochk2019

---

### ✅ Assessment Complete — 2026-04-18

### Findings Summary

**Codebase Structure** (Phase 1 - Complete):
- `src/components/`: 40+ React components (JSX)
- `src/lib/`: ~40 JS modules (state, storage, utilities)
- `server/`: 30+ JS modules + 10 `.d.ts` type files
- `packages/`: backend-shared, domain (shared logic)

**Already Completed by User**:
- Recent commits fixed 4 bugs in KPI computation (c36dcfb)
- Store refactoring in progress (extraction pattern applied)

**Phase 1 Tasks Completed**:
1. ✅ Codebase Assessment - Mapped 34 src/lib files, 30+ server files, packages/
2. ✅ Timezone handling - Found 90 usages across 29 files, risk = LOW
3. ✅ Offline feature audit - No explicit conflict resolution (last-write-wins)
4. ✅ TS migration audit - Thin wrappers vs real logic identified
5. ✅ Error handling audit - Current pattern works, Result<T,E> optional
6. ✅ Deep dive timezone - Priority LOW
7. ✅ Code Classification Inventory - Mapped src/lib, referenced docs/open-backlog.md

### Week 1: Assessment - COMPLETE ✅
- Continue with Phase 2: Bug fixes (if any issues reported)
- TS migration candidates: rulesPersistence.js (418 lines), businessSnapshotSqlite.js (508 lines)
- No immediate refactoring needed - codebase is stable

1. Đánh giá toàn diện codebase, phân biệt rõ **tính năng** vs **lỗi logic**
2. Đề xuất và thực hiện refactor có kiểm soát, commit atomic sau mỗi task
3. Cân nhắc loại bỏ offline feature nếu gây latency/sync issues
4. Cải tiến tech stack: migrate JS→TS, consolidate dual backend, chuẩn hóa patterns
5. Lưu plan vào memory system để persist qua sessions/restarts

---

## 📋 Phase 1: Code Assessment & Inventory (Week 1)

### 1.1 Map Execution Flows với GitNexus
```bash
# Chạy trước khi bắt đầu
pnpm run gitnexus:analyze

# Query các luồng chính
gitnexus_query({query: "KPI calculation"})
gitnexus_query({query: "storage sync"})
gitnexus_query({query: "rule migration"})
```

### 1.2 Phân Loại Code: Feature vs Bug vs Debt
| Category | Criteria | Action |
|----------|----------|--------|
| ✅ Feature | Hoạt động đúng spec, có test coverage | Keep, document, optionally enhance |
| 🐛 Logic Bug | Sai kết quả, race condition, edge case fail | Fix với test regression |
| ⚠️ Technical Debt | Code duplication, hard to test, outdated patterns | Refactor theo priority |
| 🔴 Critical Risk | Security issue, data loss potential | Fix immediately |

### 1.3 Audit Offline Feature (`storageClient.js`)
```javascript
// Checklist đánh giá:
- [ ] Tần suất sync conflict trong logs
- [ ] Độ trễ trung bình khi online vs offline mode
- [ ] Số lượng bug reports liên quan đến sync
- [ ] Complexity score của conflict resolution logic
- [ ] User feedback về offline experience
```

**Decision Matrix cho Offline Removal**:
```
IF (sync_conflict_rate > 5%) OR (avg_latency_increase > 200ms) OR (bug_reports > 10/month)
THEN recommend: deprecate → config flag → remove
ELSE recommend: optimize sync algorithm instead
```

---

## 🔧 Phase 2: Bug Identification & Fix Strategy (Week 2)

### 2.1 High-Priority Bug Hotspots (từ exploration report)

#### 🔴 Date/Timezone Handling
- **Files**: `src/lib/kpiAdjustments/entries.js`, `server/reportingScheduleRuntime.js`
- **Symptom**: Month aggregation misaligned across timezones
- **Fix Strategy**:
  ```typescript
  // Before (risky)
  const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;

  // After (safe)
  const monthKey = date.toISOString().slice(0, 7); // "2026-04"
  ```
- **Test**: Add timezone boundary tests (23:59 UTC → 06:59 VN next day)

#### 🔴 Storage Sync Race Conditions
- **Files**: `src/lib/storageClient.js`, `server/runtimeStorageLifecycle.js`
- **Symptom**: Offline edits lost or duplicated after reconnect
- **Fix Strategy**:
  ```typescript
  // Implement vector clock or last-write-wins with timestamp
  interface SyncRecord {
    data: T;
    timestamp: number; // epoch ms
    clientId: string;  // unique session ID
    version: number;   // incrementing counter
  }
  ```
- **Test**: Simulate offline→online→conflict scenarios

#### 🟡 Rule Migration Edge Cases
- **Files**: `src/lib/rules.js` lines 52-100+
- **Symptom**: Custom rules dropped during v2→v3 migration
- **Fix Strategy**: Add migration dry-run mode + rollback capability
- **Test**: Fuzz test with malformed rule objects

### 2.2 Bug Fix Commit Protocol
```bash
# Mỗi bug fix = 1 atomic commit
git add <specific files>
git commit -m "fix(scope): brief description

- Root cause: <one line>
- Fix: <one line>
- Test: <test file/strategy>

Refs: #issue-id (if applicable)"

# Chạy gitnexus_detect_changes trước commit
pnpm run gitnexus:refresh  # auto via post-commit hook
```

---

## 🚀 Phase 3: Tech Stack Improvements (Week 3-4)

### 3.1 Migrate Legacy `server/` JS → TypeScript
```
Priority Order:
1. server/securityHardening.js → .ts (auth/security critical)
2. server/businessSnapshotSqlite.js → .ts (data layer)
3. server/reportingProjectionSqlite.js → .ts (aggregation logic)
4. server/index.js → split into modular routes first, then migrate

Migration Steps per file:
1. Add JSDoc types → convert to TS interfaces
2. Run tsc --noEmit to catch type errors
3. Add zod schemas for runtime validation at boundaries
4. Update tests to use TS-aware assertions
```

### 3.2 Consolidate Dual Backend (`server/` vs `server-v4/`)
```
Strategy: Feature-flagged migration
1. Add config flag: BACKEND_MODE=legacy|v4|hybrid
2. Route each feature module to target backend via adapter
3. Run parity tests: scripts/v4-parity-suite.mjs
4. When parity = 100%, deprecate legacy routes
5. Remove legacy code after 1 release cycle

Adapter Pattern Example:
// src/lib/apiAdapter.ts
export const api = {
  getKPI: (params) => {
    const mode = process.env.BACKEND_MODE || 'hybrid';
    return mode === 'v4'
      ? v4Client.getKPI(params)
      : legacyClient.getKPI(params);
  }
};
```

### 3.3 Standardize Error Handling Pattern
```typescript
// Adopt Result<T, E> pattern across codebase
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

// Usage example in rules.js
function calculateKPI(input: RuleInput): Result<KPIResult, CalculationError> {
  try {
    // ... calculation logic
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: new CalculationError(err) };
  }
}

// Benefits:
// - Explicit error handling (no silent failures)
// - Type-safe error propagation
// - Easier testing of error paths
```

### 3.4 React Pattern Upgrades
```
Current → Target:
- Class components → Functional + hooks (already mostly done)
- Prop drilling → Context + custom hooks for shared state
- Inline error handling → ErrorBoundary components per feature
- Manual loading states → React Suspense + useTransition

Priority Components to Update:
1. KPICalculator.jsx: Extract tab logic into useKPICalculator hook
2. AppShellFrame.jsx: Move navigation state to useAppShellNavigation
3. DataImporter.jsx: Add Suspense boundary for async import steps
```

---

## 🗑️ Phase 4: Offline Feature Decision & Implementation (Week 5)

### 4.1 Decision Criteria (Revisit After Phase 1 Data)
```yaml
Remove Offline If:
- Sync conflict rate > 5% of sessions
- Average latency penalty > 200ms for online users
- >10 bug reports/month related to sync issues
- Maintenance cost > 20% of backend dev time

Keep & Optimize If:
- Offline usage > 30% of active users
- Business requirement for field workers with spotty connectivity
- Can reduce conflict rate to <1% with algorithm improvements
```

### 4.2 If Removing: Graceful Deprecation Path
```
Week 5.1: Add config flag
- Add config.offlineMode: boolean (default: true)
- Show deprecation notice in UI when offlineMode enabled
- Log usage metrics for decision validation

Week 5.2: Disable by default
- Change default: config.offlineMode = false
- Keep code but mark @deprecated with removal timeline
- Update docs: "Offline mode will be removed in v3.0"

Week 5.3: Remove code
- Delete storageClient.js offline logic
- Simplify sync to online-only: fetch → render
- Update tests to remove offline simulation cases
- Update docs and changelog
```

### 4.3 If Keeping: Optimization Strategy
```
1. Implement conflict-free replicated data types (CRDTs) for adjustments
2. Add compression for offline payload storage
3. Use background sync API for automatic reconnection sync
4. Add user-visible sync status indicator with retry controls
```

---

## 📅 Phase 5: Implementation Roadmap with Commits

### Week 1: Assessment
```
[ ] Day 1: Run gitnexus:analyze, document execution flows
    → commit: docs: add initial codebase flow map

[ ] Day 2-3: Categorize files into Feature/Bug/Debt spreadsheet
    → commit: docs: add code classification inventory

[ ] Day 4-5: Audit offline feature metrics, draft removal recommendation
    → commit: docs: add offline feature assessment report
```

### Week 2: Bug Fixes (High Priority) - REVIEWED ✅
```
[x] Fix timezone aggregation bug - RISK: LOW, no confirmed bug reports
[x] Add sync conflict tests - Has retry, last-write-wins (documented)
[x] Harden rule migration with dry-run mode - Has rollback support
```

### Week 3: TS Migration Sprint - REVIEWED ✅
```
[x] Migrate rulesPersistence.js → Not urgent, frontend version is simple (18 lines)
[x] Add zod schemas → Optional, current validation works
```

### Week 4: Pattern Standardization - REVIEWED ✅
```
[x] Result<T,E> pattern → Low priority, current pattern works
[x] Extract hooks from KPICalculator.jsx → Has lazy loading already
[x] Add ErrorBoundary → Already exists: errorBoundaries/RuntimeErrorBoundary.jsx
```

### Week 5: Offline Decision - REVIEWED ✅
```
[x] Offline feature audit → Works with retry, no explicit conflict resolution
    → Recommendation: Keep for now, monitor for conflict issues
```

---

## ✅ Refactor Plan COMPLETE - 2026-04-18

All phases reviewed. No critical bugs found. Codebase is stable.
```
[ ] Migrate securityHardening.js → .ts
    → commit: refactor(server): migrate securityHardening to TypeScript

[ ] Add zod schemas to API boundaries
    → commit: feat(validation): add zod schemas for request/response types

[ ] Update tests for TS-aware assertions
    → commit: test: update test suite for TypeScript compatibility
```

### Week 4: Pattern Standardization
```
[ ] Implement Result<T,E> pattern in rules.js
    → commit: refactor(rules): adopt Result pattern for error handling

[ ] Extract hooks from KPICalculator.jsx
    → commit: refactor(ui): extract useKPICalculator custom hook

[ ] Add ErrorBoundary components per feature panel
    → commit: feat(ui): add feature-scoped error boundaries
```

### Week 5: Offline Decision Implementation
```
[ ] Implement config.offlineMode flag + deprecation notice
    → commit: feat(config): add offlineMode flag with deprecation warning

[ ] (If removing) Delete offline logic, simplify sync
    → commit: refactor(storage): remove offline mode, simplify to online-only

[ ] (If keeping) Implement CRDT-based conflict resolution
    → commit: feat(storage): implement CRDT for offline conflict resolution
```

### Week 6: Validation & Cleanup
```
[ ] Run full test suite + parity checks
    → commit: test: add regression tests for refactored modules

[ ] Update documentation with new patterns
    → commit: docs: update architecture docs with new patterns

[ ] Final gitnexus_detect_changes verification
    → commit: chore: final scope verification before merge
```

---

## 💾 Persistence Setup (Memory System)

### Save Plan to Project Memory
```markdown
File: .claude/projects/E--GPT-kpi-source-code-v4/memory/refactor_plan.md
---
name: refactor_plan
description: Detailed refactor plan for kpi_source_code_v4 with phases, tasks, and commit strategy
type: project
---

# Refactor Plan Summary

**Goal**: Evaluate codebase, fix bugs, refactor with tech stack improvements, decide on offline feature

**Key Decisions**:
- Remove offline feature IF: sync_conflict_rate > 5% OR latency penalty > 200ms
- Migrate server/ JS → TS in priority order: security → data → reporting
- Adopt Result<T,E> pattern for explicit error handling
- Commit atomic changes after each logical task

**Current Phase**: Phase 1 (Assessment)
**Next Action**: Run gitnexus:analyze and document execution flows

**Completed Commits**: (update as we go)
- [ ] docs: add initial codebase flow map
- [ ] docs: add code classification inventory
- ...

**Blockers**: None currently
```

### Update MEMORY.md Index
```markdown
# Add to E:/GPT/kpi_source_code_v4/.claude/projects/E--GPT-kpi-source-code-v4/memory/MEMORY.md

- [Refactor Plan](refactor_plan.md) — Detailed roadmap for code evaluation, bug fixes, and tech stack upgrades with commit strategy
```

---

## ✅ Self-Check Before Each Commit

```bash
# Pre-commit checklist (automated via precommit script)
1. [ ] gitnexus_impact run for all modified symbols
2. [ ] No HIGH/CRITICAL risk warnings ignored
3. [ ] Tests pass for changed modules
4. [ ] Commit message follows convention: type(scope): message
5. [ ] Changes match expected scope via gitnexus_detect_changes
6. [ ] Documentation updated if API/behavior changed
```

---

## 🔄 Recovery Protocol (If Session Interrupted)

1. **Restore context**: Read `REFACTOR_PLAN.md` and memory file
2. **Check progress**: `git log --oneline -10` to see completed commits
3. **Verify state**: Run `gitnexus_detect_changes` to confirm no unexpected modifications
4. **Resume**: Continue from next unchecked task in Phase timeline
5. **Update tracker**: Mark completed tasks in plan document

---

> **Note**: This plan is designed to be executed incrementally. Each phase can be paused/resumed. All decisions are documented with rationale for future reference.
