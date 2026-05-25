# V4 Release Gate Sign-off (cng-mbu.6)

Date: 2026-04-01  
Bead: `cng-mbu.6`  
Scope: Release Gates and Acceptance Closure

## Decision

- Result: `PASS`
- Cutover readiness: `READY for Week 8 preflight`
- Next execution lane: `completed`
- Closure addendum: [v4-hypercare-completion-report-2026-04-01.md](/E:/GPT/kpi_source_code_v4/docs/operations/v4-hypercare-completion-report-2026-04-01.md)

## Required release gates

### 1) Frontend legacy-only route usage

- Command: `pnpm run api:contract:gate`
- Result: pass
- Observed summary:
  - `canonical routes: 52`
  - `legacy routes: 0`

### 2) Canonical contract mismatch

- Control used: canonical contract scan + parity suite baseline
- Commands:
  - `pnpm run api:contract:report`
  - `pnpm run verify:v4:parity`
- Result:
  - contract scanner reports no legacy frontend calls
  - parity summary: `passed=7/7 failed=0`
- Conclusion: no open canonical contract mismatch blocker at release-gate level

### 3) Role-based UAT checklist

- Source evidence: Week 6-7 hardening/UAT lane (`cng-mbu.5`)
- Verified suites (already green and carried into closure):
  - `pnpm exec playwright test tests/playwright/account-management.spec.js tests/playwright/team-management.spec.js tests/playwright/hq-agency.spec.js tests/playwright/import-flow.spec.js tests/playwright/import-monitoring.spec.js tests/playwright/report-viewer.spec.js tests/playwright/export-flow.spec.js tests/playwright/lazy-tab-shell.spec.js tests/playwright/ui-shell-sidebar.spec.js tests/playwright/adjustments-health.spec.js --config=playwright.config.mjs --workers=1`
- Result: `19 passed`

## Supporting evidence

- Big-bang tracker: [docs/big-bang-execution-status.md](/E:/GPT/kpi_source_code_v4/docs/big-bang-execution-status.md)
- QA matrix: [docs/operations/v4-qa-matrix.md](/E:/GPT/kpi_source_code_v4/docs/operations/v4-qa-matrix.md)
- Latest rehearsal evidence:
  - [docs/operations/v4-rollout-evidence/2026-04-01T02-01-09-518Z-local-runtime.json](/E:/GPT/kpi_source_code_v4/docs/operations/v4-rollout-evidence/2026-04-01T02-01-09-518Z-local-runtime.json)
  - [docs/operations/v4-rollout-evidence/2026-04-01T02-01-09-518Z-local-runtime.md](/E:/GPT/kpi_source_code_v4/docs/operations/v4-rollout-evidence/2026-04-01T02-01-09-518Z-local-runtime.md)

## Risk carried to cng-mbu.7 (resolved)

- Staging/prod preflight still required before production traffic shift.
- Downtime window coordination and rollback drill must be executed in Week 8 cutover lane.
- Repository hard-gate closure completed after `verify:v4:cutover-preflight -- --with-uat-smoke --timeout-ms 120000` passed and `cng-m2r` was closed.
