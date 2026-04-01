# V4 Cutover Owner Matrix (cng-mbu.7)

Last updated: 2026-04-01  
Program: `cng-mbu`  
Execution lane: `cng-mbu.7`

## Purpose

Tai lieu nay la owner handoff matrix bat buoc truoc khi mo downtime window.

## Role Coverage

| Role | Primary owner | Backup owner | Contact channel | Escalation path | Coverage window | Confirmed at |
| --- | --- | --- | --- | --- | --- | --- |
| Incident commander | `<name>` | `<name>` | `<channel>` | `<policy/link>` | Day 0 (T-15m -> T+6h) | `<timestamp>` |
| Backend owner | `<name>` | `<name>` | `<channel>` | `<policy/link>` | Day 0 + Day 1-2 | `<timestamp>` |
| Frontend owner | `<name>` | `<name>` | `<channel>` | `<policy/link>` | Day 0 + Day 1-2 | `<timestamp>` |
| QA/UAT owner | `<name>` | `<name>` | `<channel>` | `<policy/link>` | Day 0 + Day 1-2 | `<timestamp>` |
| Communications owner | `<name>` | `<name>` | `<channel>` | `<policy/link>` | Day 0 + Day 1-2 + Day 3-7 | `<timestamp>` |
| On-call SRE/Platform | `<name>` | `<name>` | `<channel>` | `<policy/link>` | Day 0 + Day 3-7 | `<timestamp>` |

## Checkpoint Acknowledgement

- [ ] All primary owners acknowledged bridge invite.
- [ ] All backup owners acknowledged handoff policy.
- [ ] Escalation path tested (dry ping) before T0.
- [ ] Contact channels pinned in cutover ticket.

## Decision Owners

| Decision point | Final approver | Backup approver | Notes |
| --- | --- | --- | --- |
| Go/No-Go at T0+30m | `<name>` | `<name>` | Must reference runbook rollback triggers |
| Rollback execution | `<name>` | `<name>` | Trigger on hard rollback conditions |
| Hypercare Day 0 closure | `<name>` | `<name>` | Requires no unresolved P1 |
| Hypercare Day 7 closure | `<name>` | `<name>` | Publish final report |

## Sign-off

- Incident commander sign-off: `<name/date>`
- Engineering sign-off: `<name/date>`
- QA sign-off: `<name/date>`
- Product/Operations sign-off: `<name/date>`
