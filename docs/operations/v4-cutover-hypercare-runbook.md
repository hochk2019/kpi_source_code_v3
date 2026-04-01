# V4 Cutover + Hypercare Runbook (cng-mbu.7)

Last updated: 2026-04-01  
Program: `cng-mbu`  
Execution lane: `cng-mbu.7`

## 1) Scope and objective

This runbook covers Week 8 big-bang cutover execution after release gates were closed in [v4-release-gate-signoff-2026-04-01.md](/E:/GPT/kpi_source_code_v4/docs/operations/v4-release-gate-signoff-2026-04-01.md).

Goal:
- switch canonical runtime in a controlled downtime window,
- keep rollback path hot,
- operate 7-day hypercare with explicit owners and triggers.

## 2) Preflight checklist (T-24h to T-1h)

All checks below must be PASS before cutover starts.

### Contract + parity

- [ ] run unified preflight gate (staging/prod label theo moi window):
  - `pnpm run verify:v4:cutover-preflight -- --discover-base-url --label staging --expected-stage module-parity --with-uat-smoke`
- [ ] archive generated evidence (`docs/operations/v4-cutover-evidence/*.json|*.md`) into cutover ticket
- [ ] fallback manual verification commands (chi dung khi can triage):
  - `pnpm run api:contract:gate`
  - `pnpm run verify:v4:parity`
  - `pnpm run verify:v4:rehearsal -- --label staging --expected-stage module-parity`

### Runtime readiness

- [ ] `GET /api/v4/health` returns:
  - `health.dbFile.state = "ready"`
  - `health.readiness.state != "blocked"`
- [ ] `GET /api/v4/meta/rollout` confirms:
  - `rollout.currentStage` not behind intended release stage
  - no unexpected migration/readiness blockers

### Data safety + rollback readiness

- [ ] run `pnpm run backup:run` and archive backup artifact reference
- [ ] verify monolith `/api/*` fallback route can be re-enabled quickly
- [ ] verify rollback communication channel and on-call roster are active

### UAT smoke before window

- [ ] run role-critical Playwright smoke set:
  - `pnpm exec playwright test tests/playwright/account-management.spec.js tests/playwright/team-management.spec.js tests/playwright/import-flow.spec.js tests/playwright/report-viewer.spec.js --config=playwright.config.mjs --workers=1`

## 3) Downtime window execution (T0)

Window/comms planning sheet:
- [v4-cutover-window-and-comms-plan.md](/E:/GPT/kpi_source_code_v4/docs/operations/v4-cutover-window-and-comms-plan.md)

### T0-15m: Freeze

- [ ] freeze non-cutover deploys
- [ ] announce maintenance start in operator channels
- [ ] confirm incident bridge and decision owner online

### T0: Cutover switch

- [ ] switch traffic to canonical runtime path (ingress/proxy mapping per environment)
- [ ] keep monolith write path rollbackable (no destructive config removal)
- [ ] capture immediate post-switch snapshot:
  - `GET /api/v4/health`
  - `GET /api/v4/meta/rollout`

### T0+15m: Functional validation

- [ ] operator-auth flow
- [ ] import flow (read + sync status)
- [ ] rules/adjustment flow
- [ ] reporting/export flow
- [ ] audit/monitoring visibility

### T0+30m: Go/No-Go checkpoint

- [ ] if no rollback trigger crossed, continue cutover
- [ ] if trigger crossed, execute rollback plan immediately

## 4) Rollback triggers (hard)

Rollback immediately when any condition is true:

1. `health.readiness.state = "blocked"` for >= 5 minutes.
2. authentication/session failures impact operator login path.
3. critical business flow break (import, adjustment, reporting export) cannot be mitigated within 15 minutes.
4. sustained error spike or severe latency degradation judged by incident commander as user-impacting.

## 5) Rollback plan

- [ ] route traffic back to monolith `/api/*`
- [ ] confirm monolith health + critical flow recovery
- [ ] post rollback notice with incident summary
- [ ] open incident follow-up bead for root cause and remediation

## 6) Hypercare (Day 0 -> Day 7)

Hypercare artifacts:
- Owner sign-off sheet: [v4-cutover-owner-matrix.md](/E:/GPT/kpi_source_code_v4/docs/operations/v4-cutover-owner-matrix.md)
- Checkpoint log: [v4-hypercare-checkpoint-log.md](/E:/GPT/kpi_source_code_v4/docs/operations/v4-hypercare-checkpoint-log.md)
- Final report template: [v4-hypercare-report-template.md](/E:/GPT/kpi_source_code_v4/docs/operations/v4-hypercare-report-template.md)

### Day 0 (first 6h)

- monitor every 30 minutes:
  - auth/session failures
  - import + sync failures
  - reporting/export failures
  - latency/error trend
- capture checkpoints in ops log every cycle

### Day 1-2

- monitor every 2 hours
- triage all P1/P2 defects same day
- keep rollback option documented and validated

### Day 3-7

- monitor every 4 hours
- close/triage remaining issues
- prepare cutover completion report

## 7) Owner matrix (fill before T0)

- Fill and sign in: [v4-cutover-owner-matrix.md](/E:/GPT/kpi_source_code_v4/docs/operations/v4-cutover-owner-matrix.md)
- Minimum requirement before T0:
  - 1 primary + 1 backup for each role
  - contact channel and escalation path verified
  - Day 0 / Day 1-2 / Day 3-7 coverage windows assigned

## 8) Exit criteria for closing cng-mbu.7

- no rollback trigger crossed during window and Day 0 stabilization,
- no unresolved P1 defects at Day 7,
- hypercare checkpoint log updated for all monitoring cycles,
- hypercare report published from template and linked in tracker docs (`task.md`, `docs/open-backlog.md`, `docs/big-bang-execution-status.md`).
