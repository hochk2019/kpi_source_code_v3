# Opus Review V2 Modernization Brief

Date: 2026-04-02  
Source review: `Opus_review_v2.md`  
Related epic: `cng-1wj`  
Stitch project: `projects/2389602522155416936`

## Purpose

This brief freezes the parts of `Opus_review_v2.md` that are still correct, marks stale findings that should not drive implementation, and captures the approved phase-0 design direction before shell/state modernization begins.

This file is the phase-0 source of truth for:

- `cng-1wj.1` - opus-review-fact-check-freeze
- `cng-1wj.2` - shell-design-stitch-foundation

## Verified Findings

The following issues were re-checked against the current frontend and are valid enough to drive implementation:

1. App shell framing is still split across multiple surfaces.
   The current experience still combines a global app header in [`src/App.jsx`](../src/App.jsx) with a contextual hero in [`src/components/appShell/AppShellFrame.jsx`](../src/components/appShell/AppShellFrame.jsx), which creates duplicated orientation chrome.

2. Navigation labels are not fully normalized.
   The app still mixes English and Vietnamese naming patterns such as `Import Data`, `Command Center`, and KPI/report labels in otherwise Vietnamese operator flows.

3. The default entry surface is too deep.
   The app still boots directly into the reporting tab rather than a lightweight dashboard landing that helps a new or returning operator understand where to start.

4. Workflow guidance is present but too persistent.
   [`src/components/appShell/AppShellWorkflowGuide.jsx`](../src/components/appShell/AppShellWorkflowGuide.jsx) provides useful guidance, but it still lacks a true collapsed/persisted panel state and therefore competes with primary work surfaces.

5. Command Center discoverability is still weaker than it should be.
   [`src/components/CommandCenter.jsx`](../src/components/CommandCenter.jsx) is useful once opened, but shell-level affordances and shortcut discovery still need improvement.

6. URL-deep-link shell state is missing.
   The app shell still relies on local component state for active tab selection, without a stable URL contract for `section` and `tab`.

7. Loading and empty-state treatment is inconsistent.
   Several shell-level surfaces still fall back to basic text loading or uneven empty/error presentation instead of a shared shell primitive set.

8. Frontend state remains more centralized than desired.
   `store.js` is still a broad compatibility surface and should continue to be decomposed by domain, but this must happen incrementally rather than through a big-bang rewrite.

## Stale Or Rejected Findings

The following review claims should not be used as implementation drivers because they are no longer accurate or are materially outdated:

1. Exact module-size counts in the review are stale.
   The reported line counts for `store.js` and `CommandCenter.jsx` no longer match the current codebase.

2. Error-handling claims are stale.
   The review's implication that the frontend broadly lacks guarded error handling no longer reflects the current implementation.

3. Test-coverage claims are stale.
   The current repository contains materially more test coverage than the review suggests, including targeted shell, command-center, workflow, and reporting tests.

4. The raw `HTTP 503`/transport-error framing is stale as a global app-shell diagnosis.
   Some older runtime issues were real in earlier lanes, but they are not the main shell modernization driver anymore.

## Deferred Or Out-Of-Scope Items

These are intentionally not part of the first shell modernization implementation wave:

1. Full store rewrite in one pass.
2. Large visual redesign of every domain screen at once.
3. Mobile-first redesign.
4. Business-logic rewrites inside reporting, adjustments, import, or health domains beyond the minimum needed for shell/state extraction.

## Approved Implementation Boundaries

## Shell And Navigation

- Introduce a stable shell URL contract with `section` and `tab`.
- Change the default landing surface from `reports` to a new dashboard tab.
- Normalize section/tab metadata in [`src/lib/appShellNavigation.js`](../src/lib/appShellNavigation.js).
- Keep backward compatibility for old/no-param entry flows by resolving to the nearest visible tab.

## Header And Layout

- Remove the current "double header" feeling.
- Keep a slim global utility bar for auth/session actions only.
- Use the shell hero inside [`src/components/appShell/AppShellFrame.jsx`](../src/components/appShell/AppShellFrame.jsx) as the primary contextual header.

## Dashboard Landing

- Add a dedicated dashboard tab as the default app entry point.
- Scope it to summary cards, quick actions, and operator status framing.
- Do not attempt a full analytics/product-metrics system in this slice.

## Command Center

- Keep the existing command surface working while the shell modernization lands.
- Improve discoverability and structure in later beads without widening the initial blast radius.

## Workflow Guide

- Keep the current builder contract working now.
- Add collapsed/persisted panel behavior in a later bead after shell routing and landing are stable.

## State Decomposition

- Extract shell/navigation/dashboard/command-center state first.
- Preserve `store.js` as a compatibility/orchestration layer until later waves.
- Do not move reporting/import/adjustments/health state in the same step as shell routing.

## Stitch Design Foundation

The approved design direction is based on the Google Stitch project `projects/2389602522155416936` and design system asset `assets/ec04f12fca7146309a2f634e5bbe79e9` (`Paper & Teal`).

## Creative Direction

- Direction name: `Quiet Operations Minimalism`
- Creative north star: `The Curated Ledger`
- Product posture: calm, editorial, operational, and non-template

## Design System Tokens

- Surface base: warm ivory / paper-like neutral (`#fafaf5`)
- Primary accent: deep teal (`#29695b`)
- Typography: Manrope for display/headlines, Inter for body/labels
- Roundness: restrained, soft corners
- Spacing scale: generous, breathable, desktop-first
- Structural rule: prefer tonal separation over hard borders

## Explicit Visual Rules

- No purple bias
- No dark-mode-first styling
- No hard 1px container grid everywhere
- No generic SaaS chrome
- No duplicated hero/header framing

## Stitch Deliverables

1. Dashboard landing
   - Screen: `projects/2389602522155416936/screens/193b4bde927044268f33dd3178e05e97`
   - Title: `KPI Control Center Dashboard`
   - Device: desktop

2. Unified shell / section-shell reference
   - Screen: `projects/2389602522155416936/screens/f4c9e8d98e6845549793d5253d7dc1da`
   - Title: `Declarations List`
   - Device returned by Stitch: mobile
   - Note: keep as composition reference only; implementation target remains desktop shell.

3. Command Center expanded state
   - Screen: `projects/2389602522155416936/screens/a740538e976e40b2bb3602ee62ff7cdf`
   - Title: `Command Center Expanded`
   - Device returned by Stitch: mobile
   - Note: use as overlay/content reference, not final viewport contract.

4. Workflow guide state
   - Screen: `projects/2389602522155416936/screens/91e753611e0747aca034c25862fe87c4`
   - Title: `Reporting Workflow Guide`
   - Device: desktop

## Phase Order

The implementation order remains fixed:

1. Freeze scope and design
2. Navigation contract
3. Unified shell/header
4. Dashboard landing
5. Command Center and workflow-guide UX
6. Shared loading/empty/error primitives
7. State extraction wave A
8. State extraction wave B
9. Regression hardening

## Exit Criteria For Phase 0

Phase 0 is considered complete when all of the following are true:

- This brief is committed to the repository state.
- `task.md` and `docs/open-backlog.md` reference the active modernization lane consistently.
- Stitch project/screens/design system are recorded in repo documentation.
- The next code slice can begin with shell URL contract work without ambiguity about scope or design direction.
