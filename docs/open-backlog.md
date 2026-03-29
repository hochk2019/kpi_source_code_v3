# Open Backlog

Last reconciled: 2026-03-29

This file is the canonical source of truth for unfinished work in this repo.

Reconciliation note:
- Reconciled after completing `cng-7z0.29`, `cng-7z0.1`, `cng-7z0.2`, `cng-7z0.3`, `cng-7z0.4`, and `cng-7z0.5`.
- Reconciled again on 2026-03-29 after closing stale beads `cng-7z0.1`, `cng-7z0.2`, `cng-7z0.3`, `cng-7z0.4`, `cng-7z0.5`, `cng-7z0.29`, `cng-2k4.19`, and `cng-2k4.20`, and removing stale open-list entries already reflected in code and `task.md`.
- Reconciled again on 2026-03-29 after completing `cng-7z0.6` and promoting `cng-7z0.7` as the next ready UX slice.
- Reconciled again on 2026-03-29 after shipping the ECUS preflight/retry/resume UX lane: `cng-7z0.9` and `cng-7z0.10` are complete, while `cng-7z0.7` remains open only for true backend-detached queue orchestration.

Rule:
- Every unfinished item from review notes, rollout plans, decomposition plans, or UX backlogs must be in one of two states:
- mapped to an open bead in this file
- explicitly marked deferred or removed in its source document

Current open epics:
- `cng-2k4` — Post-Gemini remaining technical backlog
- `cng-7z0` — UX improvement backlog execution

Current highest-priority ready items:
- Frontend stabilization lane:
- `cng-2k4.22` — Restore app/runtime text and lint hygiene after backlog refactors; exclude unrelated pre-existing tool dirt
- Backend cutover lane:
- `cng-2k4.2` — Execute declarations write cutover with compat guard and rollback plan
- `cng-2k4.3` — Switch production entrypoint from legacy server to server-v4
- Ready next in UX lane:
- `cng-7z0.7` — Finish backend-detached sync queue/orchestration for ECUS imports

## Technical Stabilization

Epic: `cng-2k4`
Source set: `Gemini_review_V1.md`, `docs/gemini-review-v1-factcheck-2026-03-25.md`, `docs/server-v4-rollout-plan-2026-03-25.md`, `frontend-wave1-decomposition.md`, `task.md`

- `cng-2k4.1` — Canonicalize auth v4 and retire legacy-only account flows
- `cng-2k4.2` — Execute declarations write cutover with compat guard and rollback plan
- `cng-2k4.3` — Switch production entrypoint from legacy server to server-v4
- `cng-2k4.4` — Extract backup and restore domain into server-v4 backup module
- `cng-2k4.5` — Extract AI assistant backend routes into server-v4 ai module
- `cng-2k4.6` — Extract alert and notification backend logic into server-v4 alerts module
- `cng-2k4.7` — Add numbered schema migrations for SQLite and server-v4
- `cng-2k4.8` — Add buildV4App integration and route-matrix verification tests
- `cng-2k4.9` — Expose rollout metadata in an operator-facing frontend dashboard
- `cng-2k4.10` — Implement CSRF protection for mutation routes
- `cng-2k4.11` — Replace sync bcrypt usage on legacy auth hot paths
- `cng-2k4.12` — Add global unhandled rejection logging and standard API error envelope
- `cng-2k4.13` — Re-verify remaining `Checklist.md` runtime gaps and refresh documentation
- `cng-2k4.16` — Reduce `HQAgencyManager.jsx` below the module size target
- `cng-2k4.17` — Reduce `TeamManager.jsx` below the module size target
- `cng-2k4.18` — Lazy-load `xlsx` and trim Excel-flow bundle cost
- `cng-2k4.22` — Restore app/runtime text and lint hygiene after backlog refactors; exclude unrelated pre-existing tool dirt

## UX Improvement Backlog

Epic: `cng-7z0`
Source set: `docs/ux-improvement-backlog.md`

### KPI Adjustments

### ECUS Declaration Sync

- `cng-7z0.7` — Add background sync queue with resume support for ECUS imports
- `cng-7z0.11` — Persist declaration sync history for notifications and dashboards

### Data Importer

- `cng-7z0.12` — Move XLSX parsing to a Web Worker in DataImporter
- `cng-7z0.13` — Modularize and lazy-load DataImporter subflows
- `cng-7z0.14` — Persist and share DataImporter filter and column presets
- `cng-7z0.15` — Design a multi-step import wizard for DataImporter
- `cng-7z0.16` — Improve DataImporter failure feedback with actionable recovery hints

### MST Assignment And Staffing

- `cng-7z0.17` — Detect duplicate MST assignments and suggest resolution
- `cng-7z0.18` — Add filtered MST assignment change timeline
- `cng-7z0.19` — Add compact lead-view mode for MST staffing
- `cng-7z0.20` — Validate and warn on invalid or oversized company names during MST editing
- `cng-7z0.21` — Export MST assignment report with assignment metadata

### Navigation And Notifications

- `cng-7z0.22` — Sync Command Center pin state to backend across devices
- `cng-7z0.23` — Add permission-aware global search
- `cng-7z0.24` — Add unread notification badge and bulk mark-as-read
- `cng-7z0.25` — Provide contextual quick-help and FAQ hub

### Reporting And Automation

### Reliability, QA, And Accessibility

- `cng-7z0.30` — Standardize network-error handling in `storageClient.js`
- `cng-7z0.31` — Add frontend performance telemetry and slow-screen dashboard

## Reconciliation Workflow

- Before ending a session, compare `bd ready --json`, `task.md`, and this file.
- If a new unfinished item appears during implementation or review, create its bead in the same session and add it here immediately.
- When closing a bead, update the source doc and `task.md` in the same session.
- If an item is intentionally deferred or removed, note that explicitly in the source doc instead of leaving an orphan unchecked line.
