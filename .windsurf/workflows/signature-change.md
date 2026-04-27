---
description: Checklist for changing function signatures (sync→async, rename, param changes)
---

# /sig-change <symbol_name> <change_description>

## Pre-flight (MUST complete before editing)

1. **Run /pre-edit-impact** on the symbol first.

2. **List ALL callers** from gitnexus_context incoming_refs:
   - Output as table: `| # | Caller | File:Line | Currently awaited? |`
   - Count total callers that need updating.

3. **Identify test files** that call or mock this symbol:
   - Search: `rtk grep "<symbol_name>" tests/`
   - List each test file and line.

4. **Present change plan** to user:
   ```
   Symbol: <name>
   Change: <sync→async | rename | param change | return type change>
   Callers to update: <count>
   Tests to update: <count>
   Risk: <LOW|MEDIUM|HIGH|CRITICAL>
   ```

5. **Wait for user approval** before making ANY edits.

## Execution (after approval)

6. Edit the target symbol.
7. Update ALL d=1 callers (from step 2) in the same commit scope.
8. Update ALL test files (from step 3).
9. Run affected tests: `rtk vitest run <test_files> --reporter=basic --testTimeout=10000`
10. If tests fail → fix before moving on, do NOT leave broken callers.

## Post-flight

11. Run `gitnexus_detect_changes({scope: "staged"})` to verify scope matches plan.
12. If scope exceeds plan → explain why to user before committing.

## Anti-pattern this prevents
CQ-001 incident: `saveDeclRows` made async → 5 callers missed → 9 test failures → 30+ min rework.
