# V4 Cutover Preflight Evidence

- Captured at: 2026-04-01T04:26:27.189Z
- Label: local-cutover-2026-04-01
- Base URL: http://127.0.0.1:5100
- Expected stage: module-parity
- Status: fail

## Command gates
- [x] [api-contract-report] pnpm run api:contract:report (exit 0)
- [x] [api-contract-gate] pnpm run api:contract:gate (exit 0)
- [ ] [parity-suite] pnpm run verify:v4:parity (exit 1)

## Checklist
- [ ] Contract + parity command gates pass
- [x] Health readiness khong blocked
- [x] Rollout readiness khong blocked
- [x] Migration verification khong co fail
- [x] Current stage khop expected (module-parity)

## Blockers
- Command failed: parity-suite (exit 1)

## Rehearsal summary
```text
[cutover-preflight] capturedAt=2026-04-01T04:26:27.189Z
[cutover-preflight] label=local-cutover-2026-04-01 baseUrl=http://127.0.0.1:5100
[cutover-preflight] status=fail
[cutover-preflight] commands
  - PASS [api-contract-report] (0) pnpm run api:contract:report
  - PASS [api-contract-gate] (0) pnpm run api:contract:gate
  - FAIL [parity-suite] (1) pnpm run verify:v4:parity
[cutover-preflight] checklist
  - FAIL Contract + parity command gates pass
  - PASS Health readiness khong blocked
  - PASS Rollout readiness khong blocked
  - PASS Migration verification khong co fail
  - PASS Current stage khop expected (module-parity)
[cutover-preflight] blockers
  - Command failed: parity-suite (exit 1)
```
