# V4 Cutover Execution Board (Hard Gate)

Last updated: 2026-04-01  
Program epic: `cng-m2r`  
Enforcement mode: `HARD_GATE`  
Status: `Closed` (repo hard-gate lane complete)

## Closure Snapshot

- Final gate: `pnpm run verify:v4:cutover-preflight -- --with-uat-smoke --timeout-ms 120000`
- Final evidence:
  - [2026-04-01T16-53-51-886Z-manual-cutover-preflight.json](/E:/GPT/kpi_source_code_v4/docs/operations/v4-cutover-evidence/2026-04-01T16-53-51-886Z-manual-cutover-preflight.json)
  - [2026-04-01T16-53-51-886Z-manual-cutover-preflight.md](/E:/GPT/kpi_source_code_v4/docs/operations/v4-cutover-evidence/2026-04-01T16-53-51-886Z-manual-cutover-preflight.md)
- Tracker closure:
  - `cng-m2r.6` closed
  - `cng-m2r` closed
- Package report:
  - [v4-hypercare-completion-report-2026-04-01.md](/E:/GPT/kpi_source_code_v4/docs/operations/v4-hypercare-completion-report-2026-04-01.md)

## Rule

- Khong duoc chuyen phase neu task dependency chua `Done`.
- Khong duoc mark `Done` neu thieu verify command hoac evidence file.
- Khong duoc deploy neu `pnpm run cutover:check` fail.
- Thu tu bat buoc cho moi phase: `Done -> Verify -> Evidence -> Update bead -> Update board -> Update task.md`.

## Taskboard

| Task ID | Bead ID | Owner | Dependency | Status | Verify Command | Evidence Path | Rollback Note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CUT-00 | cng-m2r.1 | sam | - | Done | `pnpm run api:contract:report && pnpm run api:contract:gate && pnpm run verify:v4:parity` | docs/operations/v4-cutover-evidence/2026-04-01T15-29-13-630Z-manual-cutover-preflight.md | Baseline-only, khong mutate runtime. |
| CUT-01 | cng-m2r.2 | sam | CUT-00 | Done | `pnpm run api:contract:gate` | docs/operations/v4-cutover-evidence/2026-04-01T15-29-13-630Z-manual-cutover-preflight.md | Revert frontend auth fallback commit, run gate lai. |
| CUT-02 | cng-m2r.3 | sam | CUT-01 | Done | `pnpm run test:server-v4` | docs/operations/v4-cutover-evidence/2026-04-01T15-29-13-630Z-manual-cutover-preflight.md | Restore `legacy-compat` mount va route aliases tam thoi. |
| CUT-03 | cng-m2r.4 | sam | CUT-02 | Done | `pnpm run healthcheck && pnpm run test:backend` | docs/operations/v4-cutover-evidence/2026-04-01T15-29-13-630Z-manual-cutover-preflight.md | Re-point script bootstrap ve runtime cu neu blocker. |
| CUT-04 | cng-m2r.5 | sam | CUT-03 | Done | `pnpm run verify:v4:parity` | docs/operations/v4-cutover-evidence/2026-04-01T15-29-13-630Z-manual-cutover-preflight.md | Bat lai rollback mode + legacy entrypoint neu can. |
| CUT-05 | cng-m2r.6 | sam | CUT-04 | Done | `pnpm run verify:v4:cutover-preflight -- --with-uat-smoke --timeout-ms 120000` | docs/operations/v4-cutover-evidence/2026-04-01T16-53-51-886Z-manual-cutover-preflight.md | UAT smoke blocker da duoc resolve; board dong o repo scope. |
