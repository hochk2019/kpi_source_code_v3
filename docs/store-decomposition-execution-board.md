# Store Decomposition Execution Board
# Store Decomposition Execution Board

Last updated: 2026-04-03

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

- Active bead: `cng-ro9.3`
- Resume from: chay impact cho `getTeamRoster` / `setTeamRoster` / `subscribeTeamRoster`, tao module team roster moi, va wire facade trong `src/lib/store.js` ma khong doi behavior team mapping/save hien tai.
- Pending verify:
  - `gitnexus_impact(target=getTeamRoster,direction=upstream)`
  - `gitnexus_impact(target=setTeamRoster,direction=upstream)`
  - `gitnexus_impact(target=subscribeTeamRoster,direction=upstream)`
  - `pnpm bd:check`
  - `gitnexus_detect_changes(scope=all)` sau khi xong slice

## Wave Board

| Bead | Wave | Objective | In Scope | Public facade kept? | Caller migration? | Verify gate | Status | Resume from | Next unblocker |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `cng-ro9.1` | 0 | Bootstrap anti-drop execution control | Tao board canonical, reparent child beads, cap nhat `task.md` + `docs/open-backlog.md`, khoa protocol resume | n/a | no | `bd children cng-ro9 --json`; `bd show cng-ro9.1 --json`; `bd show cng-bl9 --json`; `pnpm bd:check` | `closed` | Hoan tat 2026-04-03; board/notebook/backlog da khop va chi con 1 code slice active | none |
| `cng-bl9` | 1 | Tach audit log helpers | `pushAuditLog`, `getAuditLogs`, `clearAuditLogs`, facade trong `src/lib/store.js` | yes | no | `gitnexus_impact` cho audit symbols; regression audit/store; `pnpm bd:check`; `gitnexus_detect_changes()` | `closed` | Hoan tat 2026-04-03; module `src/lib/auditLog.js` + test rieng da xanh | none |
| `cng-ro9.2` | 1 | Tach rules persistence | `getRules`, `setRules`, storage keys lien quan; khong doi business logic `src/lib/rules.js` | yes | no | `gitnexus_impact(getRules)` + `gitnexus_impact(setRules)`; rules/store regression; `pnpm bd:check`; `gitnexus_detect_changes()` | `closed` | Hoan tat 2026-04-03; module `src/lib/rulesPersistence.js` + facade regression da xanh, scope giu o `getRules`/`setRules` | none |
| `cng-ro9.3` | 2 | Tach team roster domain | roster read/subscribe/save, map/apply helpers, audit side effect qua module audit | yes | no | `gitnexus_impact` cho roster symbols; team manager/store regression; `pnpm bd:check`; `gitnexus_detect_changes()` | `in_progress` | Bat dau bang impact cho `getTeamRoster` / `setTeamRoster` / `subscribeTeamRoster`; tai su dung primitives chung, khong copy helper | Xong team facade de mo declaration split |
| `cng-ro9.4` | 3 | Tach declaration read/query | `getDeclRows`, sort/filter/query helpers, `getData` facade alias | yes | no | `gitnexus_impact(getDeclRows)`; decl read regression; `pnpm bd:check`; `gitnexus_detect_changes()` | `open` | Bat dau declaration split bang read path it side effect nhat | Xong read module de mo save pipeline |
| `cng-ro9.5` | 3 | Tach declaration save pipeline | `previewDeclRows`, `saveDeclRows`, import/save merge helpers | yes | no | `gitnexus_impact(previewDeclRows)` + `gitnexus_impact(saveDeclRows)`; importer/store regression; `pnpm bd:check`; `gitnexus_detect_changes()` | `open` | Cho `cng-ro9.4`; move private helpers theo pipeline | Xong save pipeline de mo mutations |
| `cng-ro9.6` | 3 | Tach declaration lifecycle mutations | update/delete/restore/review helpers | yes | no | `gitnexus_impact` cho mutation symbols; row lifecycle regression; `pnpm bd:check`; `gitnexus_detect_changes()` | `open` | Cho `cng-ro9.5`; note blast radius rieng cho tung symbol | Xong mutations de mo core helpers |
| `cng-ro9.7` | 4 | Tach shared core helpers | core cross-domain helpers that su dung chung; day private helpers ve module dich | yes | no | helper module unit tests; cross-domain regression; `pnpm bd:check`; `gitnexus_detect_changes()` | `open` | Cho declaration waves xong de co full map helper ownership | Xong core extraction de mo caller migration |
| `cng-ro9.8` | 5 | Migrate callers off `store.js` | direct imports cho libs/hooks/components theo dot, track residual shim consumers | mixed | yes | caller import diff review; targeted regression; `pnpm bd:check`; `gitnexus_detect_changes()` | `open` | Cho `cng-ro9.7`; bat dau low-risk libs/hooks truoc | So caller shim giam ve muc shim-only |
| `cng-ro9.9` | 6 | Lock `store.js` thanh shim mong | chi de lai import/re-export, compat comments, deprecation notes | yes | yes | shim regression; import scan; `pnpm bd:check`; `gitnexus_detect_changes()` | `open` | Cho caller migration dat muc chap nhan duoc | Quyết định mo bead xoa facade con lai neu can |
