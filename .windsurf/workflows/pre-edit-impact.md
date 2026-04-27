---
description: Run blast-radius analysis before editing any function/class/method
---

# /pre-edit-impact <symbol_name>

## Steps

1. Run impact analysis on the target symbol:
```
gitnexus_impact({target: "<symbol_name>", direction: "upstream"})
```

2. Run context analysis to see all callers and callees:
```
gitnexus_context({name: "<symbol_name>"})
```

3. Output a **blast radius table** to the user:

| Depth | Risk | Count | Files |
|-------|------|-------|-------|
| d=1 WILL BREAK | ... | ... | list of files:lines |
| d=2 LIKELY AFFECTED | ... | ... | list of files:lines |
| d=3 MAY NEED TESTING | ... | ... | list of files:lines |

4. If risk is HIGH or CRITICAL:
   - **STOP. Do NOT edit.**
   - Present risk to user with concrete description of what will break.
   - Wait for explicit user confirmation before proceeding.

5. If risk is LOW/MEDIUM:
   - Present table, note any d=1 dependents that MUST be updated together.
   - Proceed only after user acknowledges the scope.

## Rules
- This workflow is **MANDATORY** before editing any function signature, renaming, or changing sync/async.
- Skip only for trivial changes (typo in string literal, comment-only edits).
- Evidence of running this workflow must appear in the chat before any code edit.
