# V4 Cutover Window + Communications Plan (cng-mbu.7)

Last updated: 2026-04-01  
Program: `cng-mbu`  
Execution lane: `cng-mbu.7`  
Status: `Archived template` after repository package closure

Archive note:
- repository closure evidence is tracked in [v4-hypercare-completion-report-2026-04-01.md](/E:/GPT/kpi_source_code_v4/docs/operations/v4-hypercare-completion-report-2026-04-01.md)
- placeholders below were not populated inside the repo and must be filled again for any future real cutover window

## 1) Window Definition

| Item | Value |
| --- | --- |
| Environment | `<staging/prod>` |
| Cutover date | `<YYYY-MM-DD>` |
| Freeze start (UTC+7) | `<HH:mm>` |
| Cutover switch (UTC+7) | `<HH:mm>` |
| Go/No-Go checkpoint (UTC+7) | `<HH:mm>` |
| Freeze end (UTC+7) | `<HH:mm>` |
| Incident bridge URL | `<link>` |
| Cutover ticket | `<link>` |

## 2) Communications Matrix

| Audience | Channel | Message owner | Send time | Template |
| --- | --- | --- | --- | --- |
| Internal operators | `<channel>` | Communications owner | T-30m | Maintenance start |
| Support/helpdesk | `<channel>` | Communications owner | T-30m | Risk + fallback note |
| Engineering on-call | `<channel>` | Incident commander | T-15m | Bridge + owner matrix |
| Leadership stakeholders | `<channel>` | Incident commander | T0+30m | Go/No-Go update |
| All operators | `<channel>` | Communications owner | T+window close | Completion or rollback notice |

## 3) Message Templates

### A) Maintenance Start (T-30m)

`[CUTOVER] Bat dau window <env> luc <time>. Runtime switch theo runbook cng-mbu.7. Vui long theo doi channel <channel> de cap nhat Go/No-Go.`

### B) Go/No-Go (T0+30m)

`[CUTOVER] Go/No-Go <env>: <GO/NO-GO>. Health=<state>, Stage=<stage>, P1=<count>. Next update: <time>.`

### C) Rollback Notice

`[CUTOVER] ROLLBACK <env> kich hoat luc <time> do trigger <trigger>. Traffic da route ve monolith /api/*. Dang theo doi on dinh hoa va se gui RCA ticket sau.`

### D) Completion Notice

`[CUTOVER] HOAN TAT <env> luc <time>. Khong co rollback trigger. Hypercare Day0 bat dau voi cadence 30m theo checkpoint log.`

## 4) Delivery Checklist

- [ ] Window timing duoc lock va xac nhan voi owner matrix.
- [ ] All audience channels duoc xac minh ton tai va co owner.
- [ ] Message templates duoc dien day du placeholder.
- [ ] Link runbook, owner matrix, checkpoint log vao cutover ticket.
