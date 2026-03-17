# Task Tracker

## Active Slice

- Title: Stabilize bootstrap baseline and remove stale audit docs
- Bead: `cng-o3u`
- Status: completed
- Last updated: 2026-03-17

## Goal

- Fix the reporting projection SQLite migration so legacy databases can upgrade safely.
- Reduce bootstrap payload on first load by avoiding an eager full shared-store snapshot.
- Move `/api/import/search` off full in-memory declaration filtering when a typed snapshot is available.
- Remove or rewrite stale review/tracker documents that no longer describe the current system.

## Current Scope

1. Reporting projection migration ordering.
2. Shared-light bootstrap with deferred shared keys.
3. Snapshot-backed declaration search and pagination.
4. Tracker/doc cleanup for current runtime reality.
5. Final verification and bead closure.

## Completion Criteria

- Targeted regression tests pass.
- Stale review docs are removed.
- `task_plan.md`, `findings.md`, and `progress.md` reflect `cng-o3u`.
- Bead `cng-o3u` is closed after verification.

## Notes

- The previous v4 review and `cng-uke` execution notebook were historical records, not the active source of truth for the current runtime state.
- Current authoritative tracking is this notebook set plus bead `cng-o3u`.
- Final status:
  - targeted verification passed (`152/152` tests)
  - bead `cng-o3u` is closed
