---
description: End-of-slice closeout with discipline audit — run after completing each slice
---

# /end-slice

## 1. Standard Closeout (5-line)

```
Done:     <what was completed>
Verify:   <command run + result>
Risk:     <known risks or tech debt created>
Decision: <key decisions made and why>
Next:     <next suggested slice>
```

## 2. Discipline Checklist

Answer each with evidence (command output, link, or "N/A"):

- [ ] **Impact analysis**: Ran `gitnexus_impact` before editing symbols? → <evidence>
- [ ] **Pre-existing vs regression**: Verified failing tests existed before changes? → <evidence>
- [ ] **Scope discipline**: Only touched files in declared scope? → <diff file list>
- [ ] **No drive-by refactors**: Did NOT "improve" adjacent code? → <yes/no>
- [ ] **All callers updated**: If signature changed, all d=1 callers updated? → <count>
- [ ] **RTK compliance**: Used `rtk` prefix for shell commands? → <% compliance>
- [ ] **Tests pass**: Ran tests after changes? → <pass/fail count>

## 3. Detect Changes Verification

Run before committing:
```
gitnexus_detect_changes({scope: "staged"})
```

Verify output matches expected scope. If unexpected files appear, explain or unstage.

## 4. Bead/Task Update

- Update `task.md` Active Slice + Handoff.
- Close finished beads: `bd close <id>`
- Create beads for any discovered follow-up work.
- Reconcile `docs/open-backlog.md` if changed.

## 5. Commit (only if user requests)

```bash
rtk git add <files>
rtk git commit -m "<type>(<scope>): <message>"
```

Do NOT push unless user explicitly requests.
