---
description: Session startup checklist — run at the beginning of every task
---

# /gate

## Context Recovery (if session was compacted/reset)

1. Read `task.md` if it exists — restore Active Slice + Handoff state.
2. Check `docs/open-backlog.md` for current priorities.
3. Run `bd ready` to see open beads.

## Pre-Task Discipline Check

4. **State the task goal** in one sentence.
5. **List assumptions** — what you believe is true about current code state.
6. **Identify files in scope** — only these files should be touched.
7. **Identify symbols to edit** — run `/pre-edit-impact` for each.

## RTK Compliance Reminder

8. All shell commands MUST use `rtk` prefix:
   - `rtk git status` not `git status`
   - `rtk vitest run ...` not `pnpm exec vitest run ...`
   - `rtk git log -n 5` not `git log --oneline -5`
   - `rtk grep "pattern" src/` not `grep "pattern" src/`

## Karpathy Principles Reminder

9. **Think Before Coding** — state assumptions, ask if uncertain.
10. **Simplicity First** — minimum code to solve the problem.
11. **Surgical Changes** — only touch what the task requires.
12. **Goal-Driven Execution** — define success criteria before implementing.

## Output

After completing this gate, output:
```
GATE PASSED
Task: <one sentence>
Scope: <files list>
Symbols: <symbols to edit, with impact status>
Success criteria: <how to verify done>
```
