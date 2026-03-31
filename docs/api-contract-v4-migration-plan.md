# API Contract v4 Migration Plan

Last updated: 2026-03-31

Tracking board: [docs/big-bang-execution-status.md](/E:/GPT/kpi_source_code_v4/docs/big-bang-execution-status.md)  
Program beads: `cng-mbu.1` (contract freeze), `cng-mbu.3` (frontend canonical client)

## Scope

Mục tiêu tài liệu này là chốt inventory route frontend để migrate dần về contract canonical `/api/v4/*` trước big-bang cutover.

## Completed in current wave

| Domain | Legacy route | Canonical route | Status |
|---|---|---|---|
| HQ history | `/api/hq/history` | `/api/v4/hq-agencies/history` | Done |
| Backups summary | `/api/admin/backups/summary` | `/api/v4/backups/summary` | Done |
| Backups files | `/api/admin/backups/files` | `/api/v4/backups/files` | Done |
| Backups schedule | `/api/admin/backups/schedule` | `/api/v4/backups/schedule` | Done |
| Backup run | `/api/admin/backups/run` | `/api/v4/backups/run` | Done |
| Backup restore | `/api/admin/backups/restore` | `/api/v4/backups/restore` | Done |

## Pending migration lanes

| Domain | Current frontend route(s) | Target state | Note |
|---|---|---|---|
| Data health | `/api/data-health/summary` | `/api/v4/...` | Chưa có module `server-v4` tương ứng |
| Duplicate policy | `/api/duplicate-policy` | `/api/v4/...` | Chưa có module `server-v4` tương ứng |
| Filter presets | `/api/filter-presets*` | `/api/v4/...` | Cần backend module hoá |
| Feedback/training | `/api/training-resources`, `/api/feedback*` | `/api/v4/...` | Hiện đang bám legacy store |
| AI assistant | `/api/ai/*` | `/api/v4/ai/*` | Có thể migrate theo từng subdomain |
| Report export | `/api/reports/export*`, `/api/admin/audit/export` | `/api/v4/reporting/*` | Cần chuẩn hoá response + file export flow |

## Guardrails

- Frontend route constants tập trung ở `src/lib/apiRoutes.js`.
- Báo cáo usage route qua script:
  - `pnpm run api:contract:report`
- Release gate (khi sẵn sàng):
  - `pnpm run api:contract:gate`
