# Super Agents System — Design Spec

**Date:** 2026-05-04
**Status:** Approved
**Location:** Global (`~/.claude/skills/super-agents/`)
**Strategy:** Pure Skills — orchestrator dispatches agents via Claude Code's Agent tool

---

## 1. Overview

A reusable multi-agent system for Claude Code that runs parallel analysis agents (read-only) followed by a single executor agent (read-write) to find and fix issues automatically.

**Key principles:**
- Analysis agents: read-only, never modify files
- Executor: read-write, generates execution-report explaining every change
- Each agent runs in isolated context (subagent), no shared state
- Reports persist in `.super-agents/reports/` for review
- Multi-model: cheap models (haiku) for analysis, strong model (opus) for execution

---

## 2. Directory Structure

```
~/.claude/skills/super-agents/
├── SKILL.md                          # Orchestrator — entry point
├── config.yaml                       # Default config
├── agents/
│   ├── code-reviewer.md              # Logic, naming, patterns
│   ├── security-auditor.md           # OWASP, injection, auth
│   ├── ux-reviewer.md                # UI/UX, accessibility, responsive
│   ├── performance-analyst.md        # Bundle size, render perf, memory
│   ├── test-checker.md               # Test coverage, regressions
│   └── executor.md                   # Reads reports, auto-fixes, generates execution-report
├── templates/
│   ├── analysis-report.md            # Format for each agent report
│   └── execution-report.md           # Format for executor output
└── scripts/
    ├── collect-changes.sh            # Git diff → changed files list
    └── pre-commit-hook.sh            # Hook entry point
```

---

## 3. Agent Definitions

Each agent is a markdown file with metadata header + prompt body.

| Agent | Model | Scope | Focus |
|-------|-------|-------|-------|
| `code-reviewer` | haiku | read-only | Logic errors, naming, code smells, dead code |
| `security-auditor` | haiku | read-only | OWASP Top 10, injection, auth flaws, secrets exposure |
| `ux-reviewer` | haiku | read-only | Accessibility, responsive, design tokens, a11y |
| `performance-analyst` | haiku | read-only | Bundle size, render perf, memory leaks, N+1 |
| `test-checker` | haiku | read-only | Missing tests, regressions, coverage gaps |
| `executor` | opus | read-write | Reads reports, prioritizes, fixes, generates execution-report |

**Model routing:**
- Analysis agents → `model: "haiku"` (Claude Haiku 4.5 — cheap, fast)
- Executor → `model: "opus"` (Claude Opus 4.7 — strong reasoning)
- Override in config: `default_analysis_model: sonnet` for higher quality

---

## 4. Orchestrator Workflow

```
STEP 1: COLLECT CONTEXT
├── git diff --name-only HEAD~1 (or --staged for pre-commit)
│   → Output: newline-separated file paths, filtered by scope.include/exclude
├── Read CLAUDE.md, package.json (tech stack)
└── Output: changed_files[], project_context{}

STEP 2: DISPATCH ANALYSIS AGENTS (PARALLEL)
├── For each enabled agent in config:
│   → Agent(model=haiku, prompt=agent.md + changed_files + project_context)
│   → Each writes .super-agents/reports/{timestamp}/report-{N}.md
├── Timeout: 120s per agent
└── Agent fail → skip, log warning, continue

STEP 3: VALIDATE REPORTS
├── Check: all expected reports exist
├── Check: each report has valid format
├── Count: total issues by severity
└── If 0 issues → skip executor, print OK

STEP 4: EXECUTE FIXES
├── Agent(model=opus, prompt=executor.md + all reports + changed files)
├── Prioritizes: P0 → P1 → P2 → P3
├── Applies fixes (Edit tool for modifications, Write tool for new files)
├── Runs build check after each fix group
└── Writes execution-report.md

STEP 5: OUTPUT & CLEANUP
├── Print summary: "X issues found, Y fixed, Z skipped, W need human review"
├── Reports saved in .super-agents/reports/{timestamp}/
└── Return control to user
```

**Error handling:**
- Agent timeout → skip + warn, don't block pipeline
- Agent crash → log error, continue with available reports
- Executor fail to fix → mark as "needs human review" in execution-report
- Build fails after fix → revert that specific fix, mark as skipped

**Modes:**
- `/super-agents analyze` — Phase 1-3 only (no fixes)
- `/super-agents fix` — full pipeline (analysis + execution)
- `/super-agents fix --staged` — analyze staged files only (pre-commit)
- `/super-agents run <agent-name>` — run single agent

---

## 5. Config System

`config.yaml` — single config file, user customizes here.

```yaml
models:
  analysis: haiku
  executor: opus

agents:
  - name: code-reviewer
    enabled: true
    priority: 1
    timeout: 120
  - name: security-auditor
    enabled: true
    priority: 1
    timeout: 120
  - name: ux-reviewer
    enabled: true
    priority: 2
    timeout: 90
  - name: performance-analyst
    enabled: true
    priority: 2
    timeout: 90
  - name: test-checker
    enabled: true
    priority: 3
    timeout: 120
  - name: executor
    enabled: true
    priority: 99
    timeout: 300

scope:
  default: changed          # changed | staged | full (manual commands use this; --staged flag overrides to staged)
  include: ["src/**", "packages/**", "components/**"]
  exclude: ["node_modules/**", "dist/**", "*.test.*", ".super-agents/**"]

severity:
  auto_fix: [P0, P1]
  propose_only: [P2, P3]

output:
  reports_dir: .super-agents/reports
  keep_last: 10
  format: markdown

hooks:
  pre_commit: true
  ci: true

ci:
  fail_on: P0
```

**Config priority:** Project `.super-agents/config.yaml` > Global `config.yaml` > Defaults

---

## 6. Report Formats

### Analysis Report

```markdown
# {agent_name} Report
**Generated:** {timestamp}
**Scope:** {file_count} files changed
**Model:** {model_name}

## Issues Found
| # | Severity | File | Line | Issue | Suggested Fix |
|---|----------|------|------|-------|---------------|

## Summary
- Total: {total} | P0: {p0} | P1: {p1} | P2: {p2} | P3: {p3}
```

### Execution Report

```markdown
# Execution Report
**Generated:** {timestamp}
**Executor Model:** {model_name}

## Results Summary
| Status | Count |
|--------|-------|
| ✅ Fixed | {fixed} |
| ⏭ Skipped | {skipped} |
| ⚠️ Needs Human Review | {review} |

## Detailed Changes
### ✅ Fixed
1. **[P0] file:line** — Issue description
   - **What:** Change made
   - **Why safe:** Explanation
   - **Build check:** ✅ Passed

### ⏭ Skipped
- Issue + reason

### ⚠️ Needs Human Review
- Issue + what's needed

## Build Status: ✅ Pass / ❌ Fail
## Recommendations
```

---

## 7. Integration

### Manual Commands
```
/super-agents analyze              # Analysis only
/super-agents fix                  # Analysis + auto-fix
/super-agents analyze --staged     # Staged files only
/super-agents fix --severity P0,P1 # Fix specific severity
/super-agents run security-auditor # Single agent
```

### Pre-commit Hook
- Runs `analyze --staged`
- Blocks commit if P0 issues found
- Setup: `ln -sf ~/.claude/skills/super-agents/scripts/pre-commit-hook.sh .git/hooks/pre-commit`

### CI/CD (GitHub Actions)
- Runs `analyze` on pull_request
- Uploads reports as artifacts
- Fails check if P0 issues found

---

## 8. Project Override

Projects can create `.super-agents/config.yaml` to:
- Disable specific agents (e.g., backend project disables ux-reviewer)
- Add custom agents with custom prompts
- Override model assignments
- Adjust severity thresholds

---

## 9. Cost Estimate

Per run (5 analysis agents + 1 executor):
- Analysis (haiku × 5): ~$0.01-0.03 per run (small changed files)
- Executor (opus × 1): ~$0.05-0.15 per run (depends on issues found)
- **Total: ~$0.06-0.18 per run**

For comparison, a human code review: ~$50-100/hour.

---

## 10. Success Criteria

1. `/super-agents analyze` runs all 5 analysis agents in parallel, produces reports
2. `/super-agents fix` runs full pipeline, generates execution-report
3. Pre-commit hook blocks on P0 issues
4. Reports are clear, actionable, and persist for review
5. System works across different projects (React, Node, Python, etc.)
6. Cost per run < $0.20 for typical changed files
