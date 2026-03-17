# Findings & Decisions

## Current Findings

### 1. Reporting projection migration could fail on legacy databases

- Root cause: the SQLite migration created an index on `position` before guaranteeing that the `position` column existed.
- Decision: make the migration add the column first, then create the index, and lock that order with a regression test.

### 2. Bootstrap loaded too much shared state on first paint

- Root cause: the shared bootstrap path eagerly loaded broad store data that the UI could fetch later.
- Decision: introduce a shared-light bootstrap mode and refresh deferred keys separately after the initial app load.

### 3. Import search was scaling poorly

- Root cause: `/api/import/search` loaded the entire declarations dataset into memory and filtered it in Node.js.
- Decision: query typed declaration snapshots in SQLite with pagination when the snapshot schema is current, and keep a compatibility fallback for stale snapshots.

### 4. Tracker and audit docs were stale

- Root cause: `TODO.md`, `docs/system-v4-review-plan.md`, and the notebook still described older epics and review programs as if they were active.
- Decision: remove obsolete docs and rewrite the notebook around bead `cng-o3u`.

## Current Decisions

- `task.md`, `task_plan.md`, `findings.md`, and `progress.md` are the live notebook for the current slice.
- Historical review material should not remain in the active tracker once it diverges from current runtime behavior.
- The older "external integration coverage / env assumptions" concern is not a standalone active bug in this slice; it only survives as historical notebook wording and is superseded by the current targeted verification set.

## Changed Files In This Slice

- `server/reportingProjectionSqlite.js`
- `tests/reportingProjectionSqlite.test.js`
- `packages/domain/src/bootstrapStorageKeys.js`
- `server/runtimeStorageLifecycle.js`
- `server/index.js`
- `src/lib/storageClient.js`
- `tests/runtimeStorageLifecycle.test.js`
- `tests/storageClient.test.js`
- `server/businessSnapshotSqlite.js`
- `server/declarationSnapshotSearch.js`
- `tests/declarationSnapshotSearch.test.js`
- `tests/server.api.test.js`
- `docs/windows-sql2008-assessment.md`
- notebook files in repo root
