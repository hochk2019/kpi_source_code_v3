# Agent Instructions

## Quy tắc dự án (bắt buộc)

- Giữ trí nhớ xuyên suốt nhiều lượt trao đổi.
- Duy trì trạng thái công việc trong một “sổ tay” thống nhất.
- Tránh cảnh AI bị quên ngữ cảnh khi context bị nén hay reset.
- Không nhồi quá nhiều code vào trong một module (mỗi module không quá 800 dòng nếu có thể).
- Mỗi module mới đều cần tạo bản test. Nếu code chính thay đổi thì cũng cập nhật test cho phù hợp và ngược lại.
- Chủ động tìm hiểu các nội dung tương tự ở dự án khác tương tự, để đề xuất cải tiến mong muốn của người dùng

## Quy tắc tối ưu token va context (bat buoc)

- Muc tieu van hanh: tiet kiem token toi da trong moi turn nhung van giu chat luong va toc do thuc thi cao nhat.
- Lam viec theo `1 slice = 1 bead = 1 muc tieu` trong moi phien; khong tron nhieu lane trong cung mot turn.
- Mac dinh chi nap context can thiet:
  - Chi doc cac file lien quan truc tiep den slice dang lam.
  - Uu tien `rg` de tim nhanh truoc, sau do moi mo doan nho theo line.
  - Khong dump toan bo file lon neu khong bat buoc.
- Gioi han output de tranh no context:
  - Khong paste log dai; chi trich doan loi lien quan (uu tien <= 80 dong).
  - Khong trinh bay lai noi dung da xac nhan o turn truoc, chi neu co thay doi moi.
  - Tra loi uu tien ket qua, command verify, va tac dong; giam giai thich dai dong.
- Duy tri "so tay ngan":
  - `task.md` la noi giu tri nho duy nhat cho trang thai thuc thi.
  - Moi lan chuyen slice phai cap nhat `Active Slice` + `Handoff` truoc khi lam tiep.
  - Neu context bi nen/reset, khoi phuc tu `task.md` truoc khi thao tac code.
- Quy tac doc/ghi:
  - Moi thay doi code phai gioi han pham vi file ro rang truoc khi sua.
  - Moi module moi hoac thay doi hanh vi deu can test di kem.
  - Trach viec refactor rong khong can thiet khi user chi yeu cau fix nho.
- Quy tac session de giam token:
  - Sau khi xong moi slice, chot bang 5 dong: `Done`, `Verify`, `Risk`, `Decision`, `Next`.
  - Neu can tiep tuc viec lon, tach thanh phien moi thay vi giu context qua dai.
- Muc tieu hieu nang:
  - Uu tien "signal over volume": it chu hon, nhieu hanh dong hon.
  - Giam token khong duoc lam mat tinh dung dan, test, hoac kha nang rollback.

## Quy tắc dùng Skills

- Nếu người dùng nhắc tên skill hoặc yêu cầu khớp mô tả skill thì **phải dùng skill** đó.
- Mở `SKILL.md` của skill và làm theo workflow; chỉ load file cần thiết.
- Ưu tiên dùng scripts/assets/template của skill nếu có.

## Beads + task.md (theo dõi công việc)

Dự án dùng **bd (beads)** kết hợp `task.md`.

- Prefix chuẩn: **`cng`**.
- Khi tạo task mới: **thêm `task.md` + tạo bead tương ứng**.
- Khi hoàn thành: **đánh dấu ở cả `task.md` và bead**.

### Quick Reference

```bash
bd ready                              # Find available work
bd show <id>                          # View issue details
bd update <id> --status in_progress   # Claim work
bd close <id>                         # Complete work
bd sync                               # Sync with git
pnpm bd:safe -- ready                 # Wrapper an toan: luon chay tren canonical worktree + auto-sync mutation
pnpm bd:check                         # Kiem tra task.md/open-backlog co lech voi BD hay khong
```

### Quy tắc chống lệch BD giữa nhiều worktree

- Ưu tiên dùng `pnpm bd:safe -- <lenh>` thay cho gọi `bd` trực tiếp khi thao tác từ Codex worktree.
- `bd:safe` luôn resolve canonical repo root rồi mới chạy `bd`, tránh trạng thái "No git repository initialized" trong worktree tạm.
- Các lệnh mutate (`create/update/close/...`) sẽ tự chạy `bd sync` sau khi thành công.
- Gate `pnpm bd:check` đã được gắn vào `precommit` để chặn commit nếu `task.md`/`docs/open-backlog.md` lệch trạng thái bead.

## Backlog Hygiene

- Canonical open backlog cua repo la `docs/open-backlog.md`.
- Moi muc chua xong trong review, fact-check, rollout plan, decomposition plan, hoac UX backlog deu phai co bead mo tuong ung; khong de lai TODO mo ma khong co bead.
- Truoc khi ket thuc session, reconcile `bd ready --json`, `task.md`, `docs/open-backlog.md`, va moi planning doc da sua trong session do.
- Neu dang lam ma lo ra follow-up moi, phai chon 1 trong 2 cach ngay lap tuc:
  - tao bead moi va them vao `docs/open-backlog.md`
  - ghi ro la deferred/out-of-scope trong source doc
- Khong de `Next Suggested Slice` o trang thai `TBD` neu da du biet buoc tiep theo hop ly.

## Kết thúc phiên làm việc (tóm tắt)

- Nếu có thay đổi code: chạy test/lint phù hợp và báo kết quả.
- Cập nhật trạng thái bead + `task.md`.
- **Chỉ commit/push khi được người dùng yêu cầu**.
# Beads CLI (WSL)
# - Beads is installed inside WSL (Ubuntu-2204, user sam).
# - Use the Windows wrapper (bd.cmd) or call via WSL directly.
#
# Examples:
#   bd ready --json
#   bd show <id>
#   wsl -d Ubuntu-2204 -u sam -- bd ready --json
#
# If bd is not recognized in Windows, restart the shell after PATH update.

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **kpi_source_code_v4** (5590 symbols, 18025 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/kpi_source_code_v4/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/kpi_source_code_v4/context` | Codebase overview, check index freshness |
| `gitnexus://repo/kpi_source_code_v4/clusters` | All functional areas |
| `gitnexus://repo/kpi_source_code_v4/processes` | All execution flows |
| `gitnexus://repo/kpi_source_code_v4/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
