# Progress Log

## Session: 2026-03-17

### Slice: `cng-o3u` Stabilize bootstrap baseline and remove stale audit docs

- Recovered current task context from the notebook and bead tracker.
- Fixed the reporting projection SQLite migration ordering bug so legacy tables can add `position` before indexing it.
- Added shared-light bootstrap support and deferred shared-key refresh to reduce hot-path payload on first load.
- Reworked `/api/import/search` to use typed declaration snapshot queries with SQL pagination when the snapshot schema is current.
- Removed obsolete review/tracker docs and rewrote the notebook around the live slice.
- Closed bead `cng-o3u` after the final targeted verification sweep.

## Verification Log

- `pnpm exec vitest run tests/reportingProjectionSqlite.test.js --environment node` -> passed
- `pnpm exec vitest run tests/runtimeStorageLifecycle.test.js tests/storageClient.test.js` -> passed
- `pnpm exec vitest run tests/businessSnapshotSqlite.test.js tests/declarationSnapshotSearch.test.js` -> passed
- `pnpm exec vitest run tests/server.api.test.js` -> passed
- `pnpm exec vitest run tests/reportingProjectionSqlite.test.js tests/runtimeStorageLifecycle.test.js tests/storageClient.test.js tests/businessSnapshotSqlite.test.js tests/declarationSnapshotSearch.test.js tests/server.api.test.js` -> passed (`6/6` files, `152/152` tests)
- `wsl -d Ubuntu-2204 -u sam -- bd close cng-o3u` -> passed

## Status

- Slice complete.
