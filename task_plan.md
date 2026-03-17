# Task Plan

## Active Bead

- `cng-o3u` - Stabilize bootstrap baseline and remove stale audit docs

## Execution Plan

1. Fix reporting projection migration ordering.
   - Status: completed
   - Result: `position` column creation now precedes index creation in the reporting projection SQLite migration.
2. Shrink initial bootstrap payload.
   - Status: completed
   - Result: `/api/bootstrap?mode=shared-light` now returns a lighter shared snapshot and defers non-critical keys.
3. Replace full in-memory import search filtering.
   - Status: completed
   - Result: `/api/import/search` now prefers typed declaration snapshot queries with SQL pagination and only falls back when an older snapshot schema is detected.
4. Remove stale planning/review docs and rewrite the notebook.
   - Status: completed
   - Result: obsolete review files are removed and the notebook now tracks the live slice instead of historical epics.
5. Run final verification and close the bead.
   - Status: completed

## Verification Targets

- `tests/reportingProjectionSqlite.test.js`
- `tests/runtimeStorageLifecycle.test.js`
- `tests/storageClient.test.js`
- `tests/businessSnapshotSqlite.test.js`
- `tests/declarationSnapshotSearch.test.js`
- `tests/server.api.test.js`

## Decisions

- Keep the declaration search fallback path for one request when an outdated snapshot schema is detected, then rewrite the snapshot so later requests use the indexed path.
- Treat the old review plan and `TODO.md` as obsolete documentation, not as active backlog.
