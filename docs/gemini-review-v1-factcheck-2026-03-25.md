# Fact-check Gemini Review V1

Date: 2026-03-25
Source reviewed: `Gemini_review_V1.md`
Scope: compared the review with the current repository state on disk. This pass focused on static code and repo structure, not a full runtime walkthrough of every UI flow.

## Overall verdict

The review is directionally useful, but it mixes three kinds of claims:

1. Claims that are still correct and actionable.
2. Claims that are conceptually right, but use stale numbers or stale version info.
3. Claims that are now incorrect because the repo has changed since the review was written.

The biggest correction is architectural:

- The review says `server-v4` was not integrated into production code.
- The current repo shows `server-v4` is already mounted partially through the legacy app, but only for the `reporting` module.

That means the correct statement is:

- `server-v4` is no longer dormant.
- The migration is in a partial strangler-fig state.
- Mounting all 8 modules immediately should not be treated as a blind "next obvious step" without rollout planning.

## High-confidence findings

### Accurate and still valid

- Backend monolith risk is real.
  - `server/index.js` is still extremely large at about `13,010` lines and `491.4 KB`.
  - File: [server/index.js](/E:/GPT/kpi_source_code_v4/server/index.js)
- Frontend fat-component risk is real.
  - [src/components/MSTAssignment.jsx](/E:/GPT/kpi_source_code_v4/src/components/MSTAssignment.jsx): `3328` lines
  - [src/components/KPIAdjustments.jsx](/E:/GPT/kpi_source_code_v4/src/components/KPIAdjustments.jsx): `2950` lines
  - [src/components/AiAssistant.jsx](/E:/GPT/kpi_source_code_v4/src/components/AiAssistant.jsx): `2872` lines
  - [src/components/RulesEditor.jsx](/E:/GPT/kpi_source_code_v4/src/components/RulesEditor.jsx): `1761` lines
- `StaffCombobox` duplication is real.
  - [src/components/MSTAssignment.jsx:228](/E:/GPT/kpi_source_code_v4/src/components/MSTAssignment.jsx#L228)
  - [src/components/AccountManager.jsx:379](/E:/GPT/kpi_source_code_v4/src/components/AccountManager.jsx#L379)
  - [src/components/dataImporter/DataImporterAssignmentComboboxes.jsx:113](/E:/GPT/kpi_source_code_v4/src/components/dataImporter/DataImporterAssignmentComboboxes.jsx#L113)
- Security hardening work is still incomplete.
  - `cng-xyq.6` already added `helmet` and a login rate limiter:
    - [server/securityHardening.js](/E:/GPT/kpi_source_code_v4/server/securityHardening.js)
    - [server/index.js](/E:/GPT/kpi_source_code_v4/server/index.js)
  - Shared password policy is now centralized and the minimum length is `8`:
    - [passwordPolicy.js](/E:/GPT/kpi_source_code_v4/packages/domain/src/passwordPolicy.js)
  - No CSRF middleware found.
  - No React `ErrorBoundary` found.
  - No `process.on('unhandledRejection')` handler found.
- Sync bcrypt usage still exists in the legacy backend and can still block the event loop.
  - [server/index.js:1599](/E:/GPT/kpi_source_code_v4/server/index.js#L1599)
  - [server/index.js:10750](/E:/GPT/kpi_source_code_v4/server/index.js#L10750)
  - [server/index.js:11695](/E:/GPT/kpi_source_code_v4/server/index.js#L11695)
  - [server/index.js:11984](/E:/GPT/kpi_source_code_v4/server/index.js#L11984)
  - [server/index.js:12148](/E:/GPT/kpi_source_code_v4/server/index.js#L12148)
- The KPI computation review is broadly sound.
  - [packages/domain/src/reportingKpiComputation.js](/E:/GPT/kpi_source_code_v4/packages/domain/src/reportingKpiComputation.js) is still compact and relatively clean.
  - It still contains hardcoded Vietnamese field names.
  - It still rounds to one decimal place at [packages/domain/src/reportingKpiComputation.js:234](/E:/GPT/kpi_source_code_v4/packages/domain/src/reportingKpiComputation.js#L234).
- Performance observations remain directionally correct.
  - Large chunks still exist in `dist/assets`, especially KPI calculator and vendor bundles.

### Correct in spirit, but stale in detail

- `server/index.js` size/line-count in the review is stale.
  - Review says about `27,000` lines and `501 KB`.
  - Current file is about `13,010` lines and `491.4 KB`.
- Frontend line counts in the review are stale.
  - The components are still too large, but the exact numbers have changed.
- App shell metrics in the review are stale.
  - [src/App.jsx](/E:/GPT/kpi_source_code_v4/src/App.jsx) is now about `260` lines, not `544`.
  - [src/App.css](/E:/GPT/kpi_source_code_v4/src/App.css) is now about `1184` lines, not `1311`.
- Technology stack section is stale.
  - [package.json](/E:/GPT/kpi_source_code_v4/package.json) now uses React `19.1.0` and Vite `6.3.5`, not React 18.
- Testing scale is understated by the review.
  - The repo currently contains about `230` test files under [tests](/E:/GPT/kpi_source_code_v4/tests).
  - This pass did not rerun the full suite, so "all tests pass" was not re-verified here.

### Incorrect or outdated

- "Server-v4 chưa được hòa mạng" is no longer true as written.
  - The current legacy server mounts `server-v4` partially:
    - [server/index.js:208](/E:/GPT/kpi_source_code_v4/server/index.js#L208)
    - [server/index.js:220](/E:/GPT/kpi_source_code_v4/server/index.js#L220)
    - [server/index.js:230](/E:/GPT/kpi_source_code_v4/server/index.js#L230)
    - [server/index.js:232](/E:/GPT/kpi_source_code_v4/server/index.js#L232)
    - [server/index.js:22059](/E:/GPT/kpi_source_code_v4/server/index.js#L22059)
  - It mounts only the `reporting` module today, not the full module catalog.
- The review is internally inconsistent on this same point.
  - Section 3 says v4 was not integrated.
  - Section 9.2 says server-v4 was already integrated with a strangler-fig step.
- The earlier security baseline note is now partially outdated.
  - `helmet` and login rate limiting were missing at fact-check time, but were added later by `cng-xyq.6`.
  - The password policy note is also stale: the current shared minimum length is `8`, not `6`.

## Claims not fully re-verified in this pass

- Business checklist UI claims such as bulk select, export flow, and history UI were not all re-tested live in browser during this pass.
- The review's exact warning count from ESLint was not re-run here.
- The full runtime behavior of all v4 routes was not exercised end-to-end.

These should be treated as "needs runtime verification", not accepted as settled fact.

## Corrected implementation priority

Epic: `cng-xyq` — Thuc thi backlog uu tien sau fact-check Gemini review

Completed:

- `cng-xyq.6` — Security hardening baseline for backend/auth

Current priority order:

1. `cng-xyq.3` — React Error Boundary at app and tab level
2. `cng-xyq.2` — Extract shared `StaffCombobox`
3. `cng-xyq.1` — Verify business checklist and update `Checklist.md`
4. `cng-xyq.5` — Plan `server-v4` rollout beyond `reporting`
5. `cng-xyq.4` — Plan wave-1 decomposition of large frontend components

## Recommended interpretation of the old review

Keep:

- monolith warning
- fat-component warning
- security hardening recommendations
- error-boundary recommendation
- duplicate combobox refactor
- migration-system recommendation

Revise:

- treat all size/version metrics as stale until refreshed
- treat `server-v4` as partially integrated, not absent
- do not mount all 8 modules just because the review says so; plan rollout by blast radius and compat risk
- mark checklist-related product claims as runtime-verification work, not settled fact
