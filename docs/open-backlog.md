# Open Backlog

Last reconciled: 2026-03-31

This file is the canonical source of truth for unfinished work in this repo.

Reconciliation note:
- Reconciled after completing `cng-7z0.29`, `cng-7z0.1`, `cng-7z0.2`, `cng-7z0.3`, `cng-7z0.4`, and `cng-7z0.5`.
- Reconciled again on 2026-03-29 after closing stale beads `cng-7z0.1`, `cng-7z0.2`, `cng-7z0.3`, `cng-7z0.4`, `cng-7z0.5`, `cng-7z0.29`, `cng-2k4.19`, and `cng-2k4.20`, and removing stale open-list entries already reflected in code and `task.md`.
- Reconciled again on 2026-03-29 after completing `cng-7z0.6` and promoting `cng-7z0.7` as the next ready UX slice.
- Reconciled again on 2026-03-29 after shipping the ECUS preflight/retry/resume UX lane: `cng-7z0.9` and `cng-7z0.10` are complete, while `cng-7z0.7` remains open only for true backend-detached queue orchestration.
- Reconciled again on 2026-03-29 after completing `cng-7z0.11`; recent sync history is now persisted in the ECUS sync queue state and surfaced in-panel, while notification/dashboard consumers remain deferred to later slices.
- Reconciled again on 2026-03-29 after closing `cng-7z0.12`, `cng-7z0.13`, stale wizard bead `cng-7z0.15`, and preset-sharing slice `cng-7z0.14`; DataImporter now has worker-backed parsing, stage-level lazy loading, a shipped multi-step workflow guide, and shared filter/column presets, so the next UX-ready item in this lane is actionable failure recovery hints.
- Reconciled again on 2026-03-29 after completing `cng-7z0.16`; DataImporter sync failures now surface actionable recovery hints in the real sync panel, and the remaining open UX work returns to backend-detached ECUS queue orchestration plus MST/navigation slices.
- Reconciled again on 2026-03-30 after completing `cng-7z0.21`; MST assignment exports now ship CSV/XLSX outputs with latest assignee metadata derived from history, so the remaining UX backlog in this lane moves on to navigation/help work.
- Reconciled again on 2026-03-30 after closing stale bead `cng-2k4.18`; the repo already lazy-loads `xlsx` via `src/lib/loadXlsx.js`, so the technical backlog now focuses on the remaining server-v4, module-size, and hygiene items.
- Reconciled again on 2026-03-30 after completing `cng-7z0.24`; Notification Center now keeps unread state until the operator explicitly bulk-marks all items as read, so the navigation backlog narrows to backend-synced pins, global search, and contextual help.
- Reconciled again on 2026-03-30 after completing `cng-7z0.22`; Command Center pin state now persists through the backend compat storage path and shared client cache, so the remaining navigation backlog narrows to permission-aware search plus contextual help.
- Reconciled again on 2026-03-30 after completing `cng-7z0.23`; Command Center search now suggests report workflow shortcuts and account-aware user entries without widening app-shell blast radius, so the remaining navigation backlog is contextual quick-help only.
- Reconciled again on 2026-03-30 after completing `cng-7z0.25` and `cng-2k4.22`; Support Center now surfaces per-tab FAQ/docs guidance with copyable repo references, while repository text normalization now relies on `.gitattributes` plus a clean `pnpm lint`, so the remaining ready work returns to backend cutover and ECUS queue orchestration.
- Reconciled again on 2026-03-30 after advancing `cng-7z0.7` with phase-aware resume semantics and closing stale shipped beads `cng-7z0.26`, `cng-7z0.27`, `cng-7z0.28`, and `cng-7z0.34` that were already reflected as completed in `docs/ux-improvement-backlog.md`.
- Reconciled again on 2026-03-31 after closing `cng-2k4.7`; numbered SQLite migrations are now tracked as completed in `task.md`, and this item is removed from the open technical backlog list.
- Reconciled again on 2026-03-31 after closing `cng-7z0.7`; ECUS sync now supports backend-detached async commit jobs with resume polling, so this item is removed from open UX backlog.

Rule:
- Every unfinished item from review notes, rollout plans, decomposition plans, or UX backlogs must be in one of two states:
- mapped to an open bead in this file
- explicitly marked deferred or removed in its source document

Current open epics:
- `cng-2k4` — Post-Gemini remaining technical backlog
- `cng-7z0` — UX improvement backlog execution

Current highest-priority ready items:
- Backend cutover lane:
- `cng-2k4.5` — Extract AI assistant backend routes into server-v4 ai module
- `cng-2k4.6` — Extract alert and notification backend logic into server-v4 alerts module

## Technical Stabilization

Epic: `cng-2k4`
Source set: `Gemini_review_V1.md`, `docs/gemini-review-v1-factcheck-2026-03-25.md`, `docs/server-v4-rollout-plan-2026-03-25.md`, `frontend-wave1-decomposition.md`, `task.md`

- `cng-2k4.1` — Canonicalize auth v4 and retire legacy-only account flows
- `cng-2k4.2` — Execute declarations write cutover with compat guard and rollback plan
- `cng-2k4.3` — Switch production entrypoint from legacy server to server-v4
- `cng-2k4.4` — Extract backup and restore domain into server-v4 backup module
- `cng-2k4.5` — Extract AI assistant backend routes into server-v4 ai module
- `cng-2k4.6` — Extract alert and notification backend logic into server-v4 alerts module
- `cng-2k4.8` — Add buildV4App integration and route-matrix verification tests
- `cng-2k4.9` — Expose rollout metadata in an operator-facing frontend dashboard
- `cng-2k4.10` — Implement CSRF protection for mutation routes
- `cng-2k4.11` — Replace sync bcrypt usage on legacy auth hot paths
- `cng-2k4.12` — Add global unhandled rejection logging and standard API error envelope
- `cng-2k4.13` — Re-verify remaining `Checklist.md` runtime gaps and refresh documentation
- `cng-2k4.16` — Reduce `HQAgencyManager.jsx` below the module size target
- `cng-2k4.17` — Reduce `TeamManager.jsx` below the module size target

## UX Improvement Backlog

Epic: `cng-7z0`
Source set: `docs/ux-improvement-backlog.md`

### KPI Adjustments

### ECUS Declaration Sync

### MST Assignment And Staffing

### Navigation And Notifications

### Reporting And Automation

### Reliability, QA, And Accessibility

- `cng-7z0.30` — Standardize network-error handling in `storageClient.js`
- `cng-7z0.31` — Add frontend performance telemetry and slow-screen dashboard

## Reconciliation Workflow

- Before ending a session, compare `bd ready --json`, `task.md`, and this file.
- If a new unfinished item appears during implementation or review, create its bead in the same session and add it here immediately.
- When closing a bead, update the source doc and `task.md` in the same session.
- If an item is intentionally deferred or removed, note that explicitly in the source doc instead of leaving an orphan unchecked line.
