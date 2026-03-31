# Big-bang Execution Status

Last updated: 2026-03-31  
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
| Week 3-5 - Frontend redesign + canonical client | `cng-mbu.3` | In Progress | [docs/api-contract-v4-migration-plan.md](/E:/GPT/kpi_source_code_v4/docs/api-contract-v4-migration-plan.md), `api:contract:report` | Da chuyen FE lanes data-health, duplicate-policy, filter-presets, feedback-training, rules-history, reports-export/audit; con legacy callers AI + notifications va cleanup legacy route map |
| Week 5-6 - Integration + parity | `cng-mbu.4` | Not Started | Gate da dinh nghia trong [docs/operations/v4-rollout-plan.md](/E:/GPT/kpi_source_code_v4/docs/operations/v4-rollout-plan.md) | Chay adapter-vs-canonical parity + migration rehearsal |
| Week 6-7 - Hardening + UAT | `cng-mbu.5` | Not Started | QA matrix san co | Chay full regression, a11y, perf, security smoke, UAT 2 nhom |
| Week 8 - Big-bang cutover + hypercare | `cng-mbu.7` | Not Started | Rollout stages + fallback da co | Freeze, preflight, cutover, 7-day hypercare |
| Release gates / acceptance closure | `cng-mbu.6` | Blocked | `api:contract:gate` hien fail do legacy usage > 0 | Dat `legacy-only FE calls = 0`, `contract mismatch = 0`, UAT pass |

## Continuity Setup

| Item | Bead | Status | Notes |
|---|---|---|---|
| Session continuity + bootstrap protocol | `cng-mbu.8` | Done | Da tao board status + dependency graph + resume protocol; bead da close |

## Architecture/Contract Checklist (mapped from PLAN.md)

| Required item | Status | Notes |
|---|---|---|
| Canonical API v4 as single FE contract | In Progress | Da co route registry + scanner; chua zero legacy |
| Legacy `/api/*` chi la adapter tam | In Progress | Van con caller FE dung legacy-only |
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

- `pnpm run api:contract:report` (2026-03-31):
  - canonical routes: `37`
  - legacy routes: `19`
- `pnpm run api:contract:gate`:
  - expected fail cho den khi legacy usage = `0`

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
