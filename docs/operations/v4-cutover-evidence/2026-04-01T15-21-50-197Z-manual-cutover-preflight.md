# V4 Cutover Preflight Evidence

- Captured at: 2026-04-01T15:21:50.197Z
- Label: manual
- Base URL: http://127.0.0.1:5000
- Expected stage: module-parity
- Status: fail

## Command gates
- [x] [cutover-governance-gate] pnpm run cutover:check (exit 0)
- [x] [api-contract-report] pnpm run api:contract:report (exit 0)
- [x] [api-contract-gate] pnpm run api:contract:gate (exit 0)
- [x] [parity-suite] pnpm run verify:v4:parity (exit 0)
- [ ] [uat-smoke] pnpm exec playwright test tests/playwright/account-management.spec.js tests/playwright/team-management.spec.js tests/playwright/import-flow.spec.js tests/playwright/report-viewer.spec.js --config=playwright.config.mjs --workers=1 (exit 1)

## Checklist
- [ ] Contract + parity command gates pass
- [x] Health readiness khong blocked
- [x] Rollout readiness khong blocked
- [x] Migration verification khong co fail
- [x] Current stage khop expected (module-parity)

## Blockers
- Command failed: uat-smoke (exit 1)

## Rehearsal summary
```text
[cutover-preflight] capturedAt=2026-04-01T15:21:50.197Z
[cutover-preflight] label=manual baseUrl=http://127.0.0.1:5000
[cutover-preflight] status=fail
[cutover-preflight] commands
  - PASS [cutover-governance-gate] (0) pnpm run cutover:check
  - PASS [api-contract-report] (0) pnpm run api:contract:report
  - PASS [api-contract-gate] (0) pnpm run api:contract:gate
  - PASS [parity-suite] (0) pnpm run verify:v4:parity
  - FAIL [uat-smoke] (1) pnpm exec playwright test tests/playwright/account-management.spec.js tests/playwright/team-management.spec.js tests/playwright/import-flow.spec.js tests/playwright/report-viewer.spec.js --config=playwright.config.mjs --workers=1
[cutover-preflight] checklist
  - FAIL Contract + parity command gates pass
  - PASS Health readiness khong blocked
  - PASS Rollout readiness khong blocked
  - PASS Migration verification khong co fail
  - PASS Current stage khop expected (module-parity)
[cutover-preflight] blockers
  - Command failed: uat-smoke (exit 1)
```
