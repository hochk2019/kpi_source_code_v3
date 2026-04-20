---
description: How to synchronize with GitNexus context
---

Whenever starting a new task, analyzing, planning, or editing code in this project, you MUST synchronize and read the shared agent context using GitNexus.

1. **Before modifying code or planning**, you must auto-run the GitNexus analyzing tool:
// turbo
```bash
pnpm exec gitnexus analyze
```

2. After running the tool, use the `view_file` tool to read `AGENTS.md` (and `CLAUDE.md` if necessary) in the project root. This tells you what other agents (Claude, Codex, Kiro, etc.) have been doing, so you do not overwrite their dependencies or miss crucial architectural decisions.

3. Proceed with your standard workflow (planning, executing) keeping the shared context from `AGENTS.md` in mind. 

4. Whenever you make heavy architectural changes or finish a major phase, the post-commit hook will automatically refresh the context. You do not need to manually run `gitnexus refresh` on commits.
