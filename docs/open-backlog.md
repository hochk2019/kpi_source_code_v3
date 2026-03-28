# Open Backlog

Last reconciled: 2026-03-28

This file is the canonical source of truth for unfinished work in this repo.

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

- `cng-7z0.1` — Persist KPI adjustment filter state per user
- `cng-7z0.2` — Virtualize or paginate KPI adjustment list
- `cng-7z0.3` — Add bulk approve and reject actions for KPI adjustments
- `cng-7z0.4` — Add quick links from KPI adjustments to related declaration or MST
- `cng-7z0.5` — Manage default KPI category settings directly in UI

### ECUS Declaration Sync

- `cng-7z0.6` — Show step-by-step ECUS sync progress
- `cng-7z0.7` — Add background sync queue with resume support for ECUS imports
- `cng-7z0.8` — Warn on declaration sync conflicts before overwrite
- `cng-7z0.9` — Add ECUS pre-check checklist before sync runs
- `cng-7z0.10` — Add automatic retry with backoff for failed ECUS writes
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

- `cng-7z0.29` — Allow custom report templates to be created and stored

### Reliability, QA, And Accessibility

- `cng-7z0.30` — Standardize network-error handling in `storageClient.js`
- `cng-7z0.31` — Add frontend performance telemetry and slow-screen dashboard
- `cng-7z0.32` — Run accessibility audit on `KPIAdjustments`, `DataImporter`, and `MSTAssignment`
- `cng-7z0.33` — Add automated regression coverage for filter and sync flows

## Reconciliation Workflow

- Before ending a session, compare `bd ready --json`, `task.md`, and this file.
- If a new unfinished item appears during implementation or review, create its bead in the same session and add it here immediately.
- When closing a bead, update the source doc and `task.md` in the same session.
- If an item is intentionally deferred or removed, note that explicitly in the source doc instead of leaving an orphan unchecked line.
# Open backlog

Canonical open backlog duoc tiep tuc theo doi tai file nay. Da reconcile lai ngay 2026-03-28 sau khi dong `cng-7z0.29`.

## Ready next

- [ ] `cng-7z0.30` — Persist filter states cho KPI Adjustments theo user va bo sung regression cho lane dieu chinh.
- [ ] `cng-2k4.22` — Text/lint hygiene cho app/runtime code, khong gom dirt co san trong `.claude/skills/*`.
- [ ] `cng-2k4.2` — Declarations write cutover voi compat guard + rollback plan.
- [ ] `cng-2k4.3` — Switch production entrypoint sang `server-v4`.

## Notes

- `cng-7z0.29` da dong trong session 2026-03-28 sau khi them local report templates cho Report Center.
- `bd` / `bd.cmd` hien chua truy cap duoc beads database trong worktree nay, nen backlog duoc giu song song tai day va `task.md`.
