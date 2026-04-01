# Big-bang Execution Status

Last updated: 2026-04-01  
Source plan: [PLAN.md](/E:/OneDrive - MSFT/Desktop/PLAN.md)  
Program epic: `cng-mbu`

## Purpose

Tai lieu nay la bang trang thai PM duy nhat cho plan big-bang 6-8 tuan.  
Moi phien moi, moi tai khoan moi, bat buoc doc file nay truoc khi code.

## Single Source Of Truth

1. [docs/big-bang-execution-status.md](/E:/GPT/kpi_source_code_v4/docs/big-bang-execution-status.md): trang thai tong + gate + resume protocol.
2. [task.md](/E:/GPT/kpi_source_code_v4/task.md): Active Slice, Verify, Risk, Decision, Next.
3. [docs/open-backlog.md](/E:/GPT/kpi_source_code_v4/docs/open-backlog.md): backlog mo canonically theo bead.
4. `bd` database: trang thai issue/dependency chinh thuc.

## Status Legend

- `Done`: da dat acceptance gate.
- `In Progress`: dang thuc thi, chua qua gate.
- `Not Started`: chua bat dau.
- `Blocked`: bi chan boi dependency hoac gate.

## Week-by-week Board

| PLAN lane | Bead | Status | Evidence | Remaining |
|---|---|---|---|---|
| Week 1 - Contract + Architecture freeze | `cng-mbu.1` | Done | [docs/api-contract-v4-migration-plan.md](/E:/GPT/kpi_source_code_v4/docs/api-contract-v4-migration-plan.md), [docs/server-v4-rollout-plan-2026-03-25.md](/E:/GPT/kpi_source_code_v4/docs/server-v4-rollout-plan-2026-03-25.md) | Da lock inventory + envelope + permission + pagination + ownership matrix cho W2/W3 |
| Week 2-3 - Backend full modularization | `cng-mbu.2` | Done | `server-v4/src/modules/{ai,alerts,auth,backup,data-health,duplicate-policy,filter-presets,feedback-training,declarations,reporting,rules,...}`, [docs/api-contract-v4-migration-plan.md](/E:/GPT/kpi_source_code_v4/docs/api-contract-v4-migration-plan.md) | Da hoan tat lane backend modularization theo W2-3 scope |
| Week 3-5 - Frontend redesign + canonical client | `cng-mbu.3` | Done | [docs/api-contract-v4-migration-plan.md](/E:/GPT/kpi_source_code_v4/docs/api-contract-v4-migration-plan.md), `api:contract:gate` | Hoan tat canonical FE clients (bao gom AI + notifications), legacy FE contract usage = 0 |
| Week 5-6 - Integration + parity | `cng-mbu.4` | Done | Gate da dinh nghia trong [docs/operations/v4-rollout-plan.md](/E:/GPT/kpi_source_code_v4/docs/operations/v4-rollout-plan.md); runner `pnpm run verify:v4:parity` + `pnpm run verify:v4:rehearsal` | Hoan tat adapter-vs-canonical parity, rollout rehearsal evidence, va xu ly blocker runtime build phu thuoc JS companion |
| Week 6-7 - Hardening + UAT | `cng-mbu.5` | Done | `pnpm run test:smoke:core`, `pnpm run verify:v4:parity`, hardening smoke suites, Playwright UAT batch (19/19), rehearsal evidence `2026-04-01T02-01-09-518Z` | Da hoan tat full regression + hardening smoke + UAT 2 nhom |
| Week 8 - Big-bang cutover + hypercare | `cng-mbu.7` | Done | [docs/operations/v4-release-gate-signoff-2026-04-01.md](/E:/GPT/kpi_source_code_v4/docs/operations/v4-release-gate-signoff-2026-04-01.md), [docs/operations/v4-cutover-hypercare-runbook.md](/E:/GPT/kpi_source_code_v4/docs/operations/v4-cutover-hypercare-runbook.md), [docs/operations/v4-cutover-window-and-comms-plan.md](/E:/GPT/kpi_source_code_v4/docs/operations/v4-cutover-window-and-comms-plan.md), [docs/operations/v4-cutover-owner-matrix.md](/E:/GPT/kpi_source_code_v4/docs/operations/v4-cutover-owner-matrix.md), [docs/operations/v4-hypercare-checkpoint-log.md](/E:/GPT/kpi_source_code_v4/docs/operations/v4-hypercare-checkpoint-log.md), [docs/operations/v4-hypercare-report-template.md](/E:/GPT/kpi_source_code_v4/docs/operations/v4-hypercare-report-template.md) | Da chot package cutover/hypercare + local verification gates (`verify:v4:parity`, `verify:v4:cutover-preflight --dry-run`, `bd:check`); execution staging/prod follow runbook operationally |
| Release gates / acceptance closure | `cng-mbu.6` | Done | [docs/operations/v4-release-gate-signoff-2026-04-01.md](/E:/GPT/kpi_source_code_v4/docs/operations/v4-release-gate-signoff-2026-04-01.md), `api:contract:gate` pass, `verify:v4:parity` pass | Gate da khoa, theo doi sang cutover lane |

## Continuity Setup

| Item | Bead | Status | Notes |
|---|---|---|---|
| Session continuity + bootstrap protocol | `cng-mbu.8` | Done | Da tao board status + dependency graph + resume protocol; bead da close |

## Architecture/Contract Checklist (mapped from PLAN.md)

| Required item | Status | Notes |
|---|---|---|
| Canonical API v4 as single FE contract | Done | FE da migrate sang canonical routes; `api:contract:gate` pass voi legacy usage = 0 |
| Legacy `/api/*` chi la adapter tam | Done | Khong con FE caller legacy-only; legacy routes con lai giu cho backward compatibility |
| Runtime chinh la module architecture | In Progress | `server-v4` da mo rong nhieu module, chua cutover toan phan |
| Tach domain monolith con lai | In Progress | Da tach `ai`, `alerts`; con nhieu domain theo plan |
| Unified auth/session/account lifecycle | In Progress | Co tien trinh, can closure theo contract gate |
| Unified pagination/filter/sort schema | In Progress | Da chot baseline key/shape trong contract freeze; chua migrate het endpoint ve shape cuoi |
| Unified permission matrix role-action | In Progress | Da co mot phan; can checklist cross-module |
| Unified telemetry/audit payload | In Progress | Da co rollout metadata; can chot payload governance |
| Service + repository boundary ro rang | In Progress | Nhieu module da tach, con legacy domain can tach tiep |
| UI khong phu thuoc storage key legacy | In Progress | Van con bootstrap/storage compat dependency |
| Metadata endpoints cho UI shell/help/context | In Progress | Da co `/api/v4/meta/*`; can hoan tat feed context day du |
| Read models toi uu cho operator-heavy screens | In Progress | Da co nhieu read model, can parity/perf gate toan bo |

## Current Observable Metrics

- `pnpm run api:contract:report` (2026-04-01):
  - canonical routes: `52`
  - legacy routes: `0`
- `pnpm run api:contract:gate` (2026-04-01):
  - pass (khong con legacy FE contract usage)
- `pnpm run verify:v4:parity` (2026-04-01):
  - pass (`failed=0`)
- Release gate sign-off package (2026-04-01):
  - [docs/operations/v4-release-gate-signoff-2026-04-01.md](/E:/GPT/kpi_source_code_v4/docs/operations/v4-release-gate-signoff-2026-04-01.md)
- Cutover runbook package (2026-04-01):
  - [docs/operations/v4-cutover-hypercare-runbook.md](/E:/GPT/kpi_source_code_v4/docs/operations/v4-cutover-hypercare-runbook.md)
  - [docs/operations/v4-cutover-owner-matrix.md](/E:/GPT/kpi_source_code_v4/docs/operations/v4-cutover-owner-matrix.md)
  - [docs/operations/v4-cutover-window-and-comms-plan.md](/E:/GPT/kpi_source_code_v4/docs/operations/v4-cutover-window-and-comms-plan.md)
  - [docs/operations/v4-hypercare-checkpoint-log.md](/E:/GPT/kpi_source_code_v4/docs/operations/v4-hypercare-checkpoint-log.md)
  - [docs/operations/v4-hypercare-report-template.md](/E:/GPT/kpi_source_code_v4/docs/operations/v4-hypercare-report-template.md)
- `pnpm run verify:v4:rehearsal -- --label local-runtime --base-url http://127.0.0.1:5100` (2026-04-01):
  - pass, evidence luu tai `docs/operations/v4-rollout-evidence/2026-04-01T02-01-09-518Z-local-runtime.{json,md}`
- `pnpm run test:smoke:core` (2026-04-01):
  - pass (`backend-core + frontend-core + frontend-canonical`)
- Hardening smoke suites (2026-04-01):
  - pass:
    - `pnpm exec vitest run tests/accessibility.test.jsx tests/dataHealthFrontendPerformancePanel.test.jsx tests/frontendPerformanceTelemetry.test.js --environment jsdom`
    - `pnpm exec vitest run tests/securityHardening.test.js tests/server-v4/authRoutes.test.js --environment node`
    - `pnpm exec playwright test tests/playwright/accessibility-admin.spec.js --config=playwright.config.mjs --workers=1`
- UAT 2 nhom Playwright batch (2026-04-01):
  - pass (`19 passed`)

W1 closure note:
- Sign-off freeze da dat ngay 2026-03-31 cho `cng-mbu.1`.
- Tu W2 tro di chi cho phep thay doi trong pham vi ownership matrix da lock.

## Dependency Graph (program-level)

- `cng-mbu.2` depends on `cng-mbu.1`
- `cng-mbu.3` depends on `cng-mbu.1`
- `cng-mbu.4` depends on `cng-mbu.2` and `cng-mbu.3`
- `cng-mbu.5` depends on `cng-mbu.4`
- `cng-mbu.6` depends on `cng-mbu.4` and `cng-mbu.5`
- `cng-mbu.7` depends on `cng-mbu.6`

## Resume Protocol (new session/new account)

1. Open:
   - [docs/big-bang-execution-status.md](/E:/GPT/kpi_source_code_v4/docs/big-bang-execution-status.md)
   - [task.md](/E:/GPT/kpi_source_code_v4/task.md)
2. Run:
   - `git status --short`
   - `pnpm bd:check`
   - `bd ready --json`
   - `pnpm run api:contract:report`
3. Pick exactly one bead lane to execute (single-slice).
4. Update `task.md` Active Slice before code.
5. End session with 5 lines in `task.md`: `Done`, `Verify`, `Risk`, `Decision`, `Next`.
6. Reconcile [docs/open-backlog.md](/E:/GPT/kpi_source_code_v4/docs/open-backlog.md) with `bd` before stopping.

## Session Ownership Rule

- Neu doi account hoac dong app, nguoi tiep theo khong duoc doan trang thai bang tri nho.
- Chi duoc tiep tuc dua tren:
  - bead status,
  - `task.md` Active Slice/Handoff,
  - file nay.
- Quy tac commit van hanh:
  - Moi khi hoan tat 1 bead/slice, agent phai tao 1 commit rieng cho bead do.
  - Khong gom nhieu bead vao cung 1 commit.
