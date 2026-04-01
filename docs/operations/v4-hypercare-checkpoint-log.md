# V4 Hypercare Checkpoint Log (cng-mbu.7)

Last updated: 2026-04-01  
Program: `cng-mbu`  
Execution lane: `cng-mbu.7`

## Usage

1. Moi cycle monitoring them 1 dong vao bang ben duoi.
2. Link den evidence JSON/MD duoc tao boi:
   - `pnpm run verify:v4:cutover-preflight -- --label <env>`
   - `pnpm run verify:v4:rehearsal -- --label <cycle>`
3. Neu co trigger rollback, ghi ro trong cot `Decision`.

## Checkpoint Table

| Cycle | Time (UTC+7) | Stage | Health readiness | Auth/session signal | Import/sync signal | Reporting/export signal | Latency/error signal | Decision | Evidence links | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Day0-C1 | `<timestamp>` | `<module-parity/cutover-ready>` | `<ready/degraded/blocked>` | `<ok/issue>` | `<ok/issue>` | `<ok/issue>` | `<ok/issue>` | `<continue/rollback/investigate>` | `<json/md links>` | `<name>` |

## Incident Notes

| Time (UTC+7) | Severity | Symptom | Mitigation | Status | Ticket |
| --- | --- | --- | --- | --- | --- |
| `<timestamp>` | `<P1/P2/P3>` | `<summary>` | `<action>` | `<open/resolved>` | `<link>` |
