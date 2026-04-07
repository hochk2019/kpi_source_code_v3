# Store Decomposition Execution Board
# Store Decomposition Execution Board

Last updated: 2026-04-07

Canonical program board for fully decomposing `src/lib/store.js` under epic `cng-ro9`.

## Program Rules

- Resume order bat buoc: `task.md` -> file nay -> `docs/open-backlog.md` -> bead dang active.
- Chi 1 child bead duoc `in_progress` tai mot thoi diem.
- Khong dong child bead neu chua cap nhat `Done`, `Verify`, `Risk`, `Decision`, `Next` trong `task.md`.
- Khong resume wave tiep theo neu `Next unblocker` cua wave hien tai con mo.
- Moi follow-up moi phat sinh trong lane nay phai duoc tao thanh child bead cua `cng-ro9` truoc khi ket thuc session.
- Khong cho phep import moi tu `@/lib/store.js` ke tu wave caller migration.

## Resume Checklist

1. Mo `task.md` va xac nhan `## Active Slice`.
2. Mo file nay va doc dong cua bead dang active.
3. Xac nhan `bd children cng-ro9 --json` khop voi board.
4. Xac nhan `docs/open-backlog.md` khop status/thu tu wave.
5. Chi khi 4 buoc tren khop moi tiep tuc code hoac close bead.

## Active Resume State

- Active bead: `cng-ro9.7`
- Resume from: declaration lifecycle mutations da duoc tach sang `src/lib/declMutationStore.js`; tiep tuc chay impact cho shared core helpers van con o `src/lib/store.js`, sau do tach helper dung chung cho declaration lanes ma khong lan sang caller migration.
- Pending verify:
  - `gitnexus_impact` cho shared core helper symbols
  - `pnpm bd:check`
  - `gitnexus_detect_changes(scope=all)` sau khi xong slice

## Wave Board

| Bead | Wave | Objective | In Scope | Public facade kept? | Caller migration? | Verify gate | Status | Resume from | Next unblocker |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `cng-ro9.1` | 0 | Bootstrap anti-drop execution control | Tao board canonical, reparent child beads, cap nhat `task.md` + `docs/open-backlog.md`, khoa protocol resume | n/a | no | `bd children cng-ro9 --json`; `bd show cng-ro9.1 --json`; `bd show cng-bl9 --json`; `pnpm bd:check` | `closed` | Hoan tat 2026-04-03; board/notebook/backlog da khop va chi con 1 code slice active | none |
| `cng-bl9` | 1 | Tach audit log helpers | `pushAuditLog`, `getAuditLogs`, `clearAuditLogs`, facade trong `src/lib/store.js` | yes | no | `gitnexus_impact` cho audit symbols; regression audit/store; `pnpm bd:check`; `gitnexus_detect_changes()` | `closed` | Hoan tat 2026-04-03; module `src/lib/auditLog.js` + test rieng da xanh | none |
| `cng-ro9.2` | 1 | Tach rules persistence | `getRules`, `setRules`, storage keys lien quan; khong doi business logic `src/lib/rules.js` | yes | no | `gitnexus_impact(getRules)` + `gitnexus_impact(setRules)`; rules/store regression; `pnpm bd:check`; `gitnexus_detect_changes()` | `closed` | Hoan tat 2026-04-03; module `src/lib/rulesPersistence.js` + facade regression da xanh, scope giu o `getRules`/`setRules` | none |
| `cng-ro9.3` | 2 | Tach team roster domain | roster read/subscribe/save, map/apply helpers, audit side effect qua module audit | yes | no | `gitnexus_impact` cho roster symbols; team manager/store regression; `pnpm bd:check`; `gitnexus_detect_changes()` | `closed` | Hoan tat 2026-04-03; module `src/lib/teamRoster.js` + facade regression da xanh, scope giu o roster read/save/subscribe/map/apply | none |
| `cng-ro9.4` | 3 | Tach declaration read/query | `getDeclRows`, sort/filter/query helpers, `getData` facade alias | yes | no | `gitnexus_impact(getDeclRows)`; decl read regression; `pnpm bd:check`; `gitnexus_detect_changes()` | `closed` | Hoan tat 2026-04-03; module `src/lib/declReadStore.js` + facade regression da xanh, scope giu o getDeclRows/getRecentDeclRows/getData/refresh read path | none |
| `cng-ro9.5` | 3 | Tach declaration save pipeline | `previewDeclRows`, `saveDeclRows`, import/save merge helpers | yes | no | `gitnexus_impact(previewDeclRows)` + `gitnexus_context(saveDeclRows@store.js)`; importer/store regression; `pnpm bd:check`; `gitnexus_detect_changes()` | `closed` | Hoan tat 2026-04-03; module `src/lib/declWriteStore.js` + facade regression da xanh, scope giu o preview/save lane va helper inject de tranh lan sang mutations | none |
| `cng-ro9.6` | 3 | Tach declaration lifecycle mutations | update/delete/restore/review helpers | yes | no | `gitnexus_impact` cho mutation symbols; row lifecycle regression; `pnpm bd:check`; `gitnexus_detect_changes()` | `closed` | Hoan tat 2026-04-07; module `src/lib/declMutationStore.js` + facade regression da xanh, scope giu o mutation lane va helper inject de tranh lan sang core wave | none |
| `cng-ro9.7` | 4 | Tach shared core helpers | core cross-domain helpers that su dung chung; day private helpers ve module dich | yes | no | helper module unit tests; cross-domain regression; `pnpm bd:check`; `gitnexus_detect_changes()` | `in_progress` | Cho `cng-ro9.6`; bat dau bang map ownership cho sanitize/apply/history/deleted-log helpers dang duoc declaration lanes inject | Xong core extraction de mo caller migration |
| `cng-ro9.8` | 5 | Migrate callers off `store.js` | direct imports cho libs/hooks/components theo dot, track residual shim consumers | mixed | yes | caller import diff review; targeted regression; `pnpm bd:check`; `gitnexus_detect_changes()` | `open` | Cho `cng-ro9.7`; bat dau low-risk libs/hooks truoc | So caller shim giam ve muc shim-only |
| `cng-ro9.9` | 6 | Lock `store.js` thanh shim mong | chi de lai import/re-export, compat comments, deprecation notes | yes | yes | shim regression; import scan; `pnpm bd:check`; `gitnexus_detect_changes()` | `open` | Cho caller migration dat muc chap nhan duoc | Quyết định mo bead xoa facade con lai neu can |
