# 09 — Tracking, Beads & Handoff

> Quy trình theo dõi công việc, ghi nhận tiến độ, và bàn giao giữa các phiên cho agent.

---

## A. Quy trình tổng cho agent

```
┌────────────────────────────────────────────────────────┐
│ 1. Đầu phiên: /pre-task-gate                            │
│    - Đọc task.md → "Active Slice"                       │
│    - List unfinished items                              │
│    - State assumptions                                  │
├────────────────────────────────────────────────────────┤
│ 2. Trước mỗi edit hàm/class: /pre-edit-impact <symbol>  │
│    - Chạy gitnexus_impact upstream                      │
│    - Output blast radius table                          │
│    - HIGH/CRITICAL → STOP, hỏi user                     │
├────────────────────────────────────────────────────────┤
│ 3. Đổi function signature: /signature-change            │
│    - Liệt kê 100% callers + test files                  │
│    - Update ALL d=1 callers cùng PR                     │
├────────────────────────────────────────────────────────┤
│ 4. Touch file ngoài scope: STOP                         │
│    - Mention file + lý do, KHÔNG sửa                    │
│    - Karpathy Principle #3                              │
├────────────────────────────────────────────────────────┤
│ 5. Cuối slice: /end-slice                               │
│    - 5-line summary: Done/Verify/Risk/Decision/Next     │
│    - Run gitnexus_detect_changes                        │
│    - Close bead + sync                                  │
│    - Update task.md "Handoff"                           │
└────────────────────────────────────────────────────────┘
```

---

## B. Beads (cng-* prefix)

### B1. Tạo bead cho slice

```powershell
rtk bd create -p cng -t "Slice <N>: <title>" --type task
# Output: cng-XXXX
```

Ví dụ:
```powershell
rtk bd create -p cng -t "Slice 1: Foundation cleanup (tokens + sidebar diet + remove WorkflowGuide)" --type task
```

### B2. Bead cho sub-tasks

Mỗi slice có thể tạo nhiều bead con cho từng sub-task lớn:

```powershell
# Slice 1 main bead: cng-1001
rtk bd create -p cng -t "Slice 1.1: Add design tokens (radius, shadow, duration)" --type subtask --parent cng-1001
rtk bd create -p cng -t "Slice 1.2: Sidebar diet (hide caption, tooltip on hover)" --type subtask --parent cng-1001
rtk bd create -p cng -t "Slice 1.3: Remove AppShellWorkflowGuide" --type subtask --parent cng-1001
rtk bd create -p cng -t "Slice 1.4: Fix StatusBadge tokens" --type subtask --parent cng-1001
```

### B3. Lifecycle commands

```powershell
# List ready work
rtk bd ready

# Show specific
rtk bd show cng-XXXX

# Claim work
rtk bd update cng-XXXX --status in_progress

# Complete
rtk bd close cng-XXXX

# Sync với git
rtk bd sync

# Safe wrapper (canonical worktree, auto-sync)
rtk pnpm bd:safe -- ready
rtk pnpm bd:safe -- update cng-XXXX --status in_progress
rtk pnpm bd:safe -- close cng-XXXX
```

### B4. BD consistency check

Trước commit:
```powershell
rtk pnpm bd:check
```

Đảm bảo `task.md` + `docs/open-backlog.md` không lệch BD.

---

## C. task.md format

`task.md` là **single source of truth** cho trạng thái phiên. Cập nhật mỗi slice.

### C1. Cấu trúc

```markdown
# Task notebook

## Active Slice

**Slice**: 1 — Foundation cleanup
**Bead**: cng-1001
**Started**: 2026-05-06 09:00
**Estimated**: 7h
**Status**: in_progress

### Goal

Dọn dẹp foundation: design tokens bổ sung, sidebar diet, xoá WorkflowGuide, fix StatusBadge tokens.

### Done (so far)

- [x] 1.1 — Add design tokens (cng-1001-1)
- [x] 1.2 — Sidebar diet (cng-1001-2)
- [ ] 1.3 — Remove WorkflowGuide (in progress, cng-1001-3)
- [ ] 1.4 — Fix StatusBadge (cng-1001-4)

### Next steps

1. Finish removing AppShellWorkflowGuide.jsx + 8 page guideProps
2. Run typecheck + smoke test
3. Verify visual on dashboard + MST page

### Notes / decisions

- Decided to keep WorkflowGuide types removed (no migration path)
- Used Tooltip from @/components/ui/tooltip instead of custom

## Handoff

If next session needs to continue:
1. Read commit `a1b2c3d` để biết state hiện tại
2. Run `rtk bd show cng-1001-3` để xem subtask đang dở
3. Continue task 1.3 từ file `src/components/appShell/AppShellFrame.tsx:250` (đã edit dở)
4. Sau task 1.3, làm 1.4

## Recent slices (history)

### Slice 0 — Foundation TS migration (DONE 2026-04-15)
- All page components → .tsx
- All shadcn UI → .tsx
- Tests passing (399/410)
- Commit: e5f6a7b

### (next slices appended here)
```

### C2. Update cadence

- **Đầu phiên**: đọc task.md, identify "Active Slice" + "Next steps"
- **Sau mỗi sub-task**: update "Done (so far)"
- **Cuối phiên/slice**: cập nhật "Handoff" và move slice xuống "Recent slices"

---

## D. Discipline log

Sau mỗi commit, log compliance vào `task.md` mục cuối hoặc commit body:

```markdown
## Discipline log (slice 1)

| Check | Status | Notes |
|-------|--------|-------|
| RTK compliance | ✅ 100% | Tất cả 23 commands dùng rtk |
| gitnexus_impact ran | ✅ | AppShellFrame, AppShellWorkflowGuide, StatusBadge |
| Test parity | ✅ | 399/410 pass (existing failures unchanged) |
| Module size ≤ 800 LOC | ✅ | All edits within limits |
| Test added for new component | N/A | No new component this slice |
| Karpathy principles | ✅ | Surgical, simple, goal-driven |
```

---

## E. Commit conventions

### E1. Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### E2. Types (Sentry-style + project-specific)

- `feat` — new feature
- `fix` — bug fix
- `refactor` — code restructure (no behavior change)
- `style` — UI/UX styling
- `test` — test additions/updates
- `chore` — tooling, deps, config
- `docs` — documentation

### E3. Scopes (project-specific)

- `ui-ux` — design system, layout, visual
- `dashboard` — Dashboard page
- `mst` — MST Assignment
- `hq` — HQ Agency Manager
- `import` — Data Importer
- `reports` — Report Center
- `adjustments` — KPI Adjustments
- `teams` — Team Manager
- `rules` — Rules Editor
- `accounts` — Account Manager
- `audit` — Audit Log
- `health` — Data Health
- `ai` — AI Assistant
- `tokens` — Design tokens
- `components` — Shared components

### E4. Examples

```
feat(ui-ux): slice 1.1 — add design tokens for radius/shadow/duration

# Blast radius:
# - Files affected: src/App.css
# - No upstream callers (CSS only)

# Changes:
# - Add --ds-radius-{xs,sm,md,lg,pill}
# - Add --ds-shadow-{sm,md,lg}
# - Add --ds-duration-{fast,md,slow}
# - Add --ds-easing-default

# Verify:
# - rtk pnpm run typecheck:frontend ✅
# - Visual: no regression in 5 sample pages

Refs: cng-1001-1
```

```
refactor(ui-ux): slice 1.2 — sidebar diet (hide caption text)

# Blast radius (gitnexus_impact AppShellFrame upstream):
# - 8 page callers via KPICalculator router
# - 12 test files reference AppShellFrame

# Changes:
# - Hide ds-app-shell__nav-caption by default
# - Wrap nav buttons với Tooltip from @/components/ui/tooltip
# - Reduce sidebar width 220px → 200px

# Verify:
# - rtk pnpm run typecheck:frontend ✅
# - rtk pnpm exec vitest run tests/appShellFrame.test.jsx ✅
# - Visual: sidebar text giảm 60%, hover tooltip xuất hiện đúng

Refs: cng-1001-2
```

---

## F. Handoff giữa phiên

### F1. Khi nào cần handoff

- Phiên gặp giới hạn token / context
- User end phiên dở dang
- Slice quá lớn cần chia 2 phiên

### F2. Handoff checklist

Trước khi end phiên:

```markdown
## Handoff to next session (slice 1)

**Last commit**: `a1b2c3d` — slice 1.2 done
**Next task**: cng-1001-3 (Remove WorkflowGuide)

### State

- task 1.1 ✅ done (commit a1b2c3d)
- task 1.2 ✅ done (commit a1b2c3d)
- task 1.3 🟡 in progress — file `src/components/appShell/AppShellFrame.tsx:250` already edited (line 250: `<AppShellWorkflowGuide>` removed). NOT committed yet.
- task 1.4 ❌ pending

### Modified files (uncommitted)

- src/components/appShell/AppShellFrame.tsx (250-260 removed)

### Next session start

1. Read this section in task.md
2. `rtk git status` to see uncommitted changes
3. `rtk bd show cng-1001-3` for context
4. Continue:
   - Remove `<AppShellWorkflowGuide>` references in 8 page components (Dashboard, Import, MST, HQ, Adjustments, Reports, Teams, Rules)
   - Delete `src/components/appShell/AppShellWorkflowGuide.jsx`
   - Delete `src/components/appShell/appShellWorkflowGuidePreference.js`
   - Run typecheck + smoke
   - Commit slice 1.3
   - Then start task 1.4 (StatusBadge tokens)

### Risks / blockers

- 8 page components have varying patterns of WorkflowGuide usage. Some pass props, some don't. Need careful regex search.

### Tests to update

- `tests/appShellWorkflowGuide.test.jsx` — DELETE (component removed)
- `tests/appShellWorkflowGuidePreference.test.js` — DELETE
- `tests/appShellFrame.test.jsx` — UPDATE (no more workflowGuide prop)
```

### F3. Resuming session

Khi resume:

```powershell
# 1. Check git state
rtk git status
rtk git log -n 5 --oneline

# 2. Read task.md
# (check "Active Slice" + "Handoff" sections)

# 3. Verify last commit state
rtk pnpm run typecheck:frontend

# 4. Continue work
```

---

## G. Backlog hygiene

### G1. Open backlog

`docs/open-backlog.md` là canonical list các bead chưa close.

Update khi:
- Tạo bead mới mà chưa làm ngay → add vào backlog
- Phát hiện issue trong slice nhưng out-of-scope → tạo bead + add backlog
- Không đề "TODO" mơ hồ trong code → mỗi TODO phải có bead

### G2. Sync backlog với BD

```powershell
rtk pnpm bd:check
```

Báo cáo lệch giữa `task.md` / `docs/open-backlog.md` / BD ready list.

---

## H. Multi-session checklist (cuối session)

Theo `AGENTS.md` "Landing the Plane":

```powershell
# 1. File issues for remaining work
# (Tạo bead cho mọi follow-up)

# 2. Run quality gates
rtk pnpm run typecheck:frontend
rtk pnpm run test:smoke:frontend-core

# 3. Update issue status
rtk bd update cng-XXXX --status in_progress  # nếu chưa xong
rtk bd close cng-YYYY                         # nếu xong

# 4. PUSH TO REMOTE (mandatory!)
rtk git pull --rebase
rtk bd sync
rtk git push
rtk git status  # MUST show "up to date with origin"

# 5. Clean up
rtk git stash list  # check nothing dangling

# 6. Verify
# All commits pushed, all beads synced

# 7. Hand off
# Update task.md với section "Handoff to next session"
```

---

## I. Memory / context limit handling

Nếu agent gặp giới hạn context:

### I1. Refresh from task.md

```powershell
# Read task.md fresh
rtk Get-Content task.md | Select-String -Pattern "Active Slice" -Context 0,30
```

### I2. GitNexus refresh

Nếu suspect index stale:
```powershell
rtk pnpm run gitnexus:analyze
```

### I3. Compact session

Nếu phiên dài, đặc biệt với 410 test files đọc, có thể:
- Save important state to task.md
- End session with handoff
- Next session start fresh, read handoff

---

## J. Common slash commands (Windsurf)

| Command | Mục đích |
|---------|----------|
| `/pre-task-gate` | Session startup |
| `/pre-edit-impact <symbol>` | Blast radius before edit |
| `/signature-change <sym> <change>` | Function signature change checklist |
| `/end-slice` | Slice completion checklist |
| `/analyze-project` | Forensic analysis |

→ Mọi slice nên dùng `/pre-task-gate` đầu phiên + `/end-slice` cuối phiên.

---

## K. Tools quick reference

```powershell
# RTK (token saver)
rtk gain                  # Show savings
rtk gain --history        # Recent commands
rtk discover              # Find missed opportunities

# GitNexus
gitnexus_impact({target: "<symbol>", direction: "upstream"})
gitnexus_query({query: "<concept>"})
gitnexus_context({name: "<symbol>"})
gitnexus_detect_changes()
READ gitnexus://repo/kpi_source_code_v4/process/{processName}

# BD (Beads)
rtk bd ready
rtk bd create -p cng -t "..." --type task
rtk bd close cng-XXXX
rtk bd sync
rtk pnpm bd:safe -- <cmd>
rtk pnpm bd:check

# Project
rtk pnpm run typecheck:frontend
rtk pnpm run test:frontend
rtk pnpm run test:smoke:frontend-core
rtk pnpm dev
rtk pnpm build
```

---

## L. Final reminders

- ✅ **Đọc task.md đầu mỗi phiên**
- ✅ **gitnexus_impact trước mỗi edit hàm/class**
- ✅ **Tạo bead trước slice**
- ✅ **RTK 100% compliance**
- ✅ **Test với mỗi component mới**
- ✅ **Module ≤ 800 LOC**
- ✅ **Không touch file ngoài scope**
- ✅ **Push to remote cuối session**
- ✅ **Update task.md "Handoff" trước end session**

---

> **Chúc agent đồng hành thuận lợi! Mọi câu hỏi, ghi chú vào `task.md` mục "Notes / decisions" để Cascade tiếp theo có context.**
