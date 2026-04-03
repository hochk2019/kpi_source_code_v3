# Open Backlog

Last reconciled: 2026-04-03

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
- Reconciled again on 2026-03-31 after closing `cng-2k4.5`; AI assistant backend routes/constants/chat-history are extracted into `server-v4/src/modules/ai/*`, and `cng-2k4.6` is now the active backend-cutover slice.
- Reconciled again on 2026-03-31 after completing `cng-2k4.6`; alert/notification legacy routes and declaration-alert domain logic are now extracted into `server-v4/src/modules/alerts/*`, so backend cutover focus returns to `cng-2k4.2` and `cng-2k4.3`.
- Reconciled again on 2026-03-31 after completing `cng-7z0.31`; frontend performance telemetry and slow-screen dashboard are shipped, and epic `cng-7z0` is closed.
- Reconciled again on 2026-03-31 after completing `cng-2k4.23`; source checklist drift is cleared, and next technical slice `cng-2k4.24` is opened.
- Reconciled again on 2026-03-31 after completing `cng-2k4.24`; skip-to-content keyboard navigation is shipped with regression tests, and epic `cng-2k4` is now closed with no remaining open child beads.
- Reconciled again on 2026-03-31 after importing PLAN.md big-bang execution lanes: opened epic `cng-mbu` with week-mapped child beads and dependency graph, plus single status board `docs/big-bang-execution-status.md`.
- Reconciled again on 2026-03-31 after W1 sign-off (`cng-mbu.1`): ownership matrix da lock trong contract plan, bead `cng-mbu.1` closed, va `cng-mbu.2` duoc mo in-progress.
- Reconciled again on 2026-03-31 after completing `cng-mbu.2`; backend modularization lanes (data-health, duplicate-policy, filter-presets, feedback-training, rules-history, reports-export, notifications parity) da hoan tat va next ready item chuyen sang `cng-mbu.3`.
- Reconciled again on 2026-03-31 after completing `cng-mbu.3`; frontend canonical client migration da dat `api:contract:gate` (legacy usage = 0), `cng-mbu.3` closed, va `cng-mbu.4` duoc chuyen in-progress.
- Reconciled again on 2026-04-01 after completing `cng-mbu.4`; W5-6 parity/rehearsal da dat gate xanh, evidence rehearsal da duoc luu, va next ready item chuyen sang `cng-mbu.5`.
- Reconciled again on 2026-04-01 after completing `cng-mbu.5`; hardening smoke + UAT da dat gate xanh (smoke core, parity, a11y/perf/security/auth, Playwright UAT 19/19), va next ready item chuyen sang `cng-mbu.6`.
- Reconciled again on 2026-04-01 after closing `cng-mbu.6`; release gates da duoc khoa, va bo tai lieu `cng-mbu.7` (runbook, owner matrix, comms plan, hypercare checkpoint log, completion template) da duoc tao de bao phu phase cutover/hypercare.
- Reconciled again on 2026-04-01 after closing `cng-mbu.7`; engineering cutover package and local verification gates are complete, and all child beads under epic `cng-mbu` are now closed.
- Reconciled again on 2026-04-01 after validating full Big-bang engineering gates (`api:contract:gate`, `verify:v4:parity`, `verify:v4:cutover-preflight --dry-run`) and closing epic `cng-mbu`; repository had no open beads before hard-gate execution epic `cng-m2r` was opened.
- Reconciled again on 2026-04-01 after opening hard-gate execution epic `cng-m2r` with phase chain `cng-m2r.1..cng-m2r.6`, plus canonical board `docs/operations/v4-cutover-execution-board.md` and automation gate `pnpm run cutover:check`.
- Reconciled again on 2026-04-01 after closing `cng-m2r.6` and epic `cng-m2r`; UAT smoke + cutover preflight with `--with-uat-smoke` are green, repository cutover board is fully closed, and there are no open beads.
- Reconciled again on 2026-04-02 after opening sync refactor epic `cng-yn6` with child slices `cng-yn6.1..cng-yn6.6`; `cng-yn6.1` is in progress and `task.md` now carries the canonical session notebook for this lane.
- Reconciled again on 2026-04-02 after completing `cng-yn6.1`, `cng-yn6.2`, and `cng-yn6.3`; canonical `/api/v4/shared-sync/*` routes plus storage-client migration are shipped, and next ready work moves to failure isolation + persistence hot path.
- Reconciled again on 2026-04-02 after closing late cleanup bead `cng-yn6.7`; SQLite declarations now persist through canonical live rows with targeted regression tests, so sync lane `cng-yn6` is fully closed again and there are no open beads.
- Reconciled again on 2026-04-02 after opening frontend modernization epic `cng-1wj`; phase chain `cng-1wj.1..cng-1wj.11` now tracks the full shell/state modernization plan.
- Reconciled again on 2026-04-02 after completing phase-0 freeze/design (`cng-1wj.1`, `cng-1wj.2`); source brief `docs/opus-review-v2-modernization-brief-2026-04-02.md` is now the shell/state phase-0 reference, and `cng-1wj.3` is the active shell navigation slice.
- Reconciled again on 2026-04-02 after shipping shell/dashboard/command-center/workflow-guide/async primitives plus wave A state extraction; `cng-1wj.3..cng-1wj.9` are closed, and next ready slice is `cng-1wj.10`.
- Reconciled again on 2026-04-02 after completing `cng-1wj.10`; wave B now extracts report schedules, import column config, and KPI adjustments into dedicated modules, and `cng-1wj.11` is the next ready hardening slice.
- Reconciled again on 2026-04-02 after completing `cng-1wj.11` and closing epic `cng-1wj`; shell/state modernization hardening is green, and the only remaining note in this lane is an explicit deferred follow-up to split `src/lib/kpiAdjustments.js` further when a future KPI-adjustments slice already touches that domain.
- Reconciled again on 2026-04-02 after creating `cng-1se`; the deferred KPI-adjustments follow-up is now tracked as an active standalone bead for internal module decomposition behind the existing facade.
- Reconciled again on 2026-04-03 after landing commit `a54be12` and closing `cng-1se`; KPI adjustments internals are now decomposed behind the same facade/API, and next focused slice `cng-vtn` is opened to continue shrinking `src/lib/store.js` via MST assignment/history extraction.
- Reconciled again on 2026-04-03 after closing `cng-vtn`; MST assignment/history is now extracted behind `src/lib/store.js`, and next ready slice `cng-y29` continues the same decomposition lane for HQ agency/history helpers.
- Reconciled again on 2026-04-03 after closing `cng-y29`; HQ agency/history is now extracted behind `src/lib/store.js`, and next ready slice `cng-gti` continues the decomposition lane for deleted declaration log helpers.
- Reconciled again on 2026-04-03 after closing `cng-gti`; deleted declaration log helpers are now extracted behind `src/lib/store.js`, and next ready slice `cng-d51` continues the decomposition lane for declaration history helpers.
- Reconciled again on 2026-04-03 after closing `cng-d51`; declaration history helpers are now extracted behind `src/lib/store.js`, and next ready slice `cng-bl9` continues the decomposition lane for audit log helpers.
- Reconciled again on 2026-04-03 after opening epic `cng-ro9`; the store decomposition lane now uses canonical board `docs/store-decomposition-execution-board.md`, active bootstrap slice `cng-ro9.1`, and child-bead execution order so another agent can resume safely after context loss or power interruption.
- Reconciled again on 2026-04-03 after closing `cng-ro9.1`; wave-0 bootstrap is complete, `cng-bl9` is now the active wave-1 code slice, and the execution board remains the canonical resume surface for the lane.
- Reconciled again on 2026-04-03 after closing `cng-bl9`; audit log helpers are extracted into `src/lib/auditLog.js` with dedicated tests, and next ready slice is `cng-ro9.2` for rules persistence extraction.
- Reconciled again on 2026-04-03 after closing `cng-ro9.2`; rules persistence is extracted into `src/lib/rulesPersistence.js` with dedicated tests, and next active slice is `cng-ro9.3` for team roster domain extraction.
- Reconciled again on 2026-04-03 after closing `cng-ro9.3`; team roster domain is extracted into `src/lib/teamRoster.js` with dedicated tests, and next active slice is `cng-ro9.4` for declaration read/query extraction.
- Reconciled again on 2026-04-03 after closing `cng-ro9.4`; declaration read/query helpers are extracted into `src/lib/declReadStore.js` with dedicated tests, and next active slice is `cng-ro9.5` for declaration save pipeline extraction.
- Reconciled again on 2026-04-03 after closing `cng-ro9.5`; declaration save/import pipeline is extracted into `src/lib/declWriteStore.js` with dedicated tests, and next active slice is `cng-ro9.6` for declaration lifecycle mutations.

Rule:
- Every unfinished item from review notes, rollout plans, decomposition plans, or UX backlogs must be in one of two states:
- mapped to an open bead in this file
- explicitly marked deferred or removed in its source document

Current open epics:
- `cng-ro9` - store-decomposition-program

Current highest-priority ready items:
- `cng-ro9.6` - active wave-3 code slice for declaration lifecycle mutation extraction behind the existing `src/lib/store.js` facade

## Frontend Modernization Shell/State

Epic: `cng-1wj` (closed)  
Source set: `Opus_review_v2.md`, Stitch design deliverables, `task.md`

- `cng-1wj.1` - opus-review-fact-check-freeze (closed; source brief locked in `docs/opus-review-v2-modernization-brief-2026-04-02.md`)
- `cng-1wj.2` - shell-design-stitch-foundation (closed; Stitch project `projects/2389602522155416936`, design system `assets/ec04f12fca7146309a2f634e5bbe79e9`)
- `cng-1wj.3` - shell-navigation-contract (closed)
- `cng-1wj.4` - shell-unified-header-layout (closed)
- `cng-1wj.5` - dashboard-landing (closed)
- `cng-1wj.6` - command-center-refactor (closed)
- `cng-1wj.7` - workflow-guide-stateful-panel (closed)
- `cng-1wj.8` - shell-loading-empty-error-primitives (closed)
- `cng-1wj.9` - state-extraction-wave-a (closed; shell navigation, command center, dashboard summary moved to dedicated hooks/selectors)
- `cng-1wj.10` - state-extraction-wave-b (closed; report schedules, import column config, and KPI adjustments extracted behind `store.js` facades)
- `cng-1wj.11` - modernization-regression-hardening (closed; runtime shell smoke and regression matrix xanh)

## KPI Adjustments Follow-up

- No open child tasks currently tracked for this follow-up; `cng-1se` is closed in commit `a54be12`.

## Store Decomposition Program

Epic: `cng-ro9`  
Canonical board: `docs/store-decomposition-execution-board.md`

- Historical completed slices before epic bootstrap:
  - `cng-vtn` - store-mst-assignment-extraction (closed; MST assignment + MST history helpers are now extracted behind the existing facade with dedicated regression coverage)
  - `cng-y29` - store-hq-agency-extraction (closed; HQ agency rows + HQ history helpers are now extracted behind the existing facade with dedicated regression coverage)
  - `cng-gti` - store-deleted-decl-log-extraction (closed; deleted declaration log helpers are now extracted behind the existing facade with focused regression coverage for storage/filter/limit behavior)
  - `cng-d51` - store-decl-history-extraction (closed; declaration history helpers are now extracted behind the existing facade with focused regression coverage for sanitize/persist/read behavior)
- Active/resume-safe child chain:
  - `cng-ro9.1` - store-decomposition-bootstrap (closed; wave-0 anti-drop bootstrap for board, bead graph, notebook, and backlog reconcile)
  - `cng-bl9` - store-audit-log-extraction (closed; wave-1 audit facade extraction behind the existing store shim)
  - `cng-ro9.2` - store-rules-persistence-extraction (closed; wave-1 rules persistence facade extraction behind `src/lib/store.js` with dedicated module coverage)
  - `cng-ro9.3` - store-team-roster-extraction (closed; wave-2 team roster domain extraction behind `src/lib/store.js` with dedicated module coverage)
  - `cng-ro9.4` - store-decl-read-extraction (closed; wave-3 declaration read/query split behind `src/lib/store.js` with dedicated module coverage in `src/lib/declReadStore.js`)
  - `cng-ro9.5` - store-decl-save-pipeline-extraction (closed; wave-3 declaration save/import pipeline split behind `src/lib/store.js` with dedicated module coverage in `src/lib/declWriteStore.js`)
  - `cng-ro9.6` - store-decl-mutations-extraction (in progress; wave-3 declaration lifecycle mutations split)
  - `cng-ro9.7` - store-core-helpers-extraction (open; wave-4 shared core helper extraction)
  - `cng-ro9.8` - store-caller-migration (open; wave-5 direct caller migration off `@/lib/store.js`)
  - `cng-ro9.9` - store-shim-lockdown (open; wave-6 lock `store.js` as thin compatibility shim)

## Hard-gate Cutover Program

Epic: `cng-m2r` (closed)  
Source set: `docs/operations/v4-cutover-execution-board.md`, `task.md`

- `cng-m2r.1` - Phase 0 Re-baseline contract/parity gates (closed)
- `cng-m2r.2` - Phase 1 Remove frontend legacy auth fallbacks (closed)
- `cng-m2r.3` - Phase 2 Remove server-v4 legacy compat routes (closed)
- `cng-m2r.4` - Phase 3 Migrate scripts off `server/index.js` (closed)
- `cng-m2r.5` - Phase 4 Decommission legacy runtime entrypoint (closed)
- `cng-m2r.6` - Phase 5 Big-bang cutover window + hypercare (closed; UAT smoke blockers resolved)

## Big-bang Program (PLAN.md) [closed]

Epic: `cng-mbu` (closed)  
Source set: `E:/OneDrive - MSFT/Desktop/PLAN.md`, `docs/big-bang-execution-status.md`, `task.md`

- `cng-mbu.1` - W1 Contract and Architecture Freeze (closed)
- `cng-mbu.2` - W2-3 Backend Full Modularization (closed)
- `cng-mbu.3` - W3-5 Frontend Redesign Canonical Client (closed)
- `cng-mbu.4` - W5-6 Integration and Behavior Parity (closed; depends on `cng-mbu.2`, `cng-mbu.3`)
- `cng-mbu.5` - W6-7 Hardening and UAT (closed; depends on `cng-mbu.4`)
- `cng-mbu.6` - Release Gates and Acceptance Closure (closed; depends on `cng-mbu.4`, `cng-mbu.5`)
- `cng-mbu.7` - W8 Big-bang Cutover and Hypercare (closed; depends on `cng-mbu.6`)
- `cng-mbu.8` - Context Continuity and Session Bootstrap (closed)

## Technical Stabilization

Epic: `cng-2k4` (closed)
Source set: `Gemini_review_V1.md`, `docs/gemini-review-v1-factcheck-2026-03-25.md`, `docs/server-v4-rollout-plan-2026-03-25.md`, `frontend-wave1-decomposition.md`, `task.md`

- No open child tasks currently tracked in BD for epic `cng-2k4` (epic closed).

## Sync Latency And Disconnect Refactor

Epic: `cng-yn6`
Source set: user latency/disconnect investigation, `task.md`

- `cng-yn6.1` - SYNC-1 notebook and baseline (closed)
- `cng-yn6.2` - SYNC-2 canonical shared-sync server-v4 routes (closed)
- `cng-yn6.3` - SYNC-3 migrate storage client to canonical shared-sync API (closed)
- `cng-yn6.4` - SYNC-4 isolate sync failures and LAN retry policy (closed)
- `cng-yn6.5` - SYNC-5 optimize persistence hot path (closed)
- `cng-yn6.6` - SYNC-6 verify contract, regression, and perf (closed)
- `cng-yn6.7` - SYNC-6 cleanup SQLite declaration row-level persistence + notebook/backlog reconcile (closed)

## UX Improvement Backlog

Epic: `cng-7z0`
Source set: `docs/ux-improvement-backlog.md`

### KPI Adjustments

### ECUS Declaration Sync

### MST Assignment And Staffing

### Navigation And Notifications

### Reporting And Automation

### Reliability, QA, And Accessibility

- No open child tasks currently tracked in BD for epic `cng-7z0` (epic closed).

## Reconciliation Workflow

- Before ending a session, compare `bd ready --json`, `task.md`, and this file.
- If a new unfinished item appears during implementation or review, create its bead in the same session and add it here immediately.
- When closing a bead, update the source doc and `task.md` in the same session.
- If an item is intentionally deferred or removed, note that explicitly in the source doc instead of leaving an orphan unchecked line.
