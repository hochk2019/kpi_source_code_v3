# Server-v4 Rollout Plan

Date: 2026-03-25
Bead: `cng-xyq.5`
Status: draft for implementation sequencing

Reconciliation note 2026-03-27:
- Planning artifact nay da xong vai tro sequencing.
- Cac viec rollout con mo hien duoc track canonically trong `docs/open-backlog.md` duoi epic `cng-2k4`, dac biet: `cng-2k4.1`, `cng-2k4.2`, `cng-2k4.3`, `cng-2k4.4`, `cng-2k4.6`, `cng-2k4.7`, `cng-2k4.8`, va `cng-2k4.9`.

## Current State

- The legacy server already mounts the compiled `server-v4` runtime, but only with the `reporting` module via `mountReportingV4App` in `server/index.js`.
- `buildV4App` already has runtime routers for all 8 catalog modules:
  - `auth`
  - `declarations`
  - `mst-assignments`
  - `teams`
  - `hq-agencies`
  - `kpi-rules`
  - `kpi-adjustments`
  - `reporting`
- `buildV4App` also exposes rollout metadata routes:
  - `GET /api/v4/health`
  - `GET /api/v4/meta/modules`
  - `GET /api/v4/meta/rollout`
- The built-in rollout status logic already encodes the intended safety rule:
  - keep monolith `/api/*` as the production write path until the next gate is green
  - re-run QA before enabling any additional `/api/v4/*` write traffic
  - fall back to monolith immediately if parity or persistence health regresses

## Route Inventory To Cross-Check

### Already Mounted In Production

- `GET /api/v4/health`
- `GET /api/v4/meta/modules`
- `GET /api/v4/meta/rollout`
- Reporting:
  - `GET /api/v4/reporting/summary`
  - `GET /api/v4/reporting/staff`
  - `GET /api/v4/reporting/teams`
  - `GET /api/v4/reporting/aggregates/monthly`
  - `POST /api/v4/reporting/exports`
  - `GET /api/v4/reporting/schedules`
  - `POST /api/v4/reporting/schedules`

### Legacy Compat Routes Already Backed By V4 Services

- Auth compat:
  - `POST /api/auth/login`
  - `GET /api/auth/session`
  - `POST /api/auth/logout`
  - `GET /api/auth/accounts`
  - `POST /api/auth/accounts`
  - `PATCH /api/auth/accounts/:username`
  - `POST /api/auth/accounts/:username/password`
  - `DELETE /api/auth/accounts/:username`
  - `POST /api/auth/password/change`
- Bootstrap/storage compat:
  - `GET /api/bootstrap`
  - `GET /api/storage/:key`
- Importer compat with canonical v4 targets:
  - `POST /api/import/ecus/preview` -> `POST /api/v4/declarations/imports/ecus-preview`
  - `POST /api/import/ecus/run` -> `POST /api/v4/declarations/imports/ecus-commit`
  - `GET /api/import/alerts` -> `GET /api/v4/declarations/imports/alerts`
  - `GET /api/import/alerts/config` -> `GET /api/v4/declarations/imports/alerts/config`
  - `PUT /api/import/alerts/config` -> `PUT /api/v4/declarations/imports/alerts/config`
  - `POST /api/import/alerts/review` -> `POST /api/v4/declarations/imports/alerts/review`
  - `POST /api/import/alerts/unreview` -> `POST /api/v4/declarations/imports/alerts/unreview`
  - `GET /api/import/co-codes` -> `GET /api/v4/declarations/imports/co-codes`
  - `PUT /api/import/co-codes` -> `PUT /api/v4/declarations/imports/co-codes`
  - `GET /api/import/co-discrepancy` -> `GET /api/v4/declarations/imports/co-discrepancy`
  - `POST /api/import/co-discrepancy/run` -> `POST /api/v4/declarations/imports/co-discrepancy/run`
  - `PUT /api/import/co-discrepancy/config` -> `PUT /api/v4/declarations/imports/co-discrepancy/config`

### V4 Routes Implemented But Not Yet Mounted As Canonical Module Traffic

- Auth:
  - `GET /api/v4/auth/session`
  - `POST /api/v4/auth/login`
  - `POST /api/v4/auth/logout`
  - `GET /api/v4/auth/accounts`
  - `POST /api/v4/auth/accounts`
  - `PATCH /api/v4/auth/accounts/:username`
- Declarations:
  - `GET /api/v4/declarations/imports/ecus-config`
  - `POST /api/v4/declarations/imports/ecus-preview`
  - `POST /api/v4/declarations/imports/ecus-commit`
  - `GET /api/v4/declarations/imports/co-codes`
  - `PUT /api/v4/declarations/imports/co-codes`
  - `GET /api/v4/declarations/imports/co-discrepancy`
  - `POST /api/v4/declarations/imports/co-discrepancy/run`
  - `PUT /api/v4/declarations/imports/co-discrepancy/config`
  - `GET /api/v4/declarations/imports/alerts`
  - `GET /api/v4/declarations/imports/alerts/config`
  - `PUT /api/v4/declarations/imports/alerts/config`
  - `POST /api/v4/declarations/imports/alerts/review`
  - `POST /api/v4/declarations/imports/alerts/unreview`
  - `GET /api/v4/declarations/`
  - `PATCH /api/v4/declarations/:declarationId`
  - `GET /api/v4/declarations/:declarationId/events`
- MST assignments:
  - `GET /api/v4/mst-assignments/`
  - `GET /api/v4/mst-assignments/resolve`
  - `POST /api/v4/mst-assignments/`
  - `PATCH /api/v4/mst-assignments/:assignmentId`
  - `GET /api/v4/mst-assignments/history`
- Teams:
  - `GET /api/v4/teams/__meta`
  - `GET /api/v4/teams/`
  - `PUT /api/v4/teams/`
  - `POST /api/v4/teams/`
  - `PATCH /api/v4/teams/:teamId`
  - `POST /api/v4/teams/:teamId/members`
  - `PATCH /api/v4/teams/members/:memberId`
- HQ agencies:
  - `GET /api/v4/hq-agencies/`
  - `POST /api/v4/hq-agencies/`
  - `DELETE /api/v4/hq-agencies/:taxCode`
  - `GET /api/v4/hq-agencies/history`
- KPI rules:
  - `GET /api/v4/kpi-rules/`
  - `POST /api/v4/kpi-rules/`
  - `POST /api/v4/kpi-rules/:ruleSetId/activate`
- KPI adjustments:
  - `GET /api/v4/kpi-adjustments/`
  - `POST /api/v4/kpi-adjustments/`
  - `PATCH /api/v4/kpi-adjustments/:adjustmentId`
  - `GET /api/v4/kpi-adjustments/settings`
  - `PUT /api/v4/kpi-adjustments/settings`

## Known Parity Gaps

### Auth

- Legacy compat still serves operations that are not present in the v4 auth module metadata:
  - `POST /api/auth/accounts/:username/password`
  - `DELETE /api/auth/accounts/:username`
  - `POST /api/auth/password/change`
- Conclusion:
  - do not switch account-management UI to canonical `/api/v4/auth/*` until these three flows have a v4 home or are explicitly retained as long-lived compat routes

### Bootstrap And Storage

- `GET /api/bootstrap` and `GET /api/storage/:key` are still legacy-shaped adapter routes.
- Conclusion:
  - they are migration dependencies, not business-domain completion signals
  - they should be kept until all frontend state bootstrap paths stop depending on legacy storage keys

### Declarations

- This is the highest blast-radius domain:
  - ECUS preview/commit
  - alert config/review
  - C/O discrepancy workflow
  - declaration row edits and event history
- Compat traffic tracker already exists and can block migrated legacy importer routes with guard mode `block-migrated`.
- Conclusion:
  - declarations should be the last major write-path cutover, not the first

## Recommended Rollout Order

### Wave 0: Stabilize Rollout Instrumentation

- Goal:
  - make `/api/v4/meta/rollout` part of the standard verification checklist before each rollout change
- Required checks:
  - persistence source kind is understood for the target environment
  - importer compat traffic snapshot is recorded before and after tests
  - module counts and route counts are captured in release notes
- Exit gate:
  - one documented QA run with rollout metadata attached

### Wave 1: Low-Blast-Radius Master Data Modules

- Modules:
  - `teams`
  - `mst-assignments`
  - `hq-agencies`
- Why first:
  - bounded CRUD domains
  - low coupling to importer and KPI recomputation
  - existing server-v4 routers and tests already present
- Verification gates:
  - route-level parity tests pass
  - admin UI works against mounted v4 endpoints without bootstrap regressions
  - history endpoints return equivalent data shape to current UI expectations

### Wave 2: KPI Policy Modules

- Modules:
  - `kpi-rules`
  - `kpi-adjustments`
- Why second:
  - still narrower than declarations
  - directly affects downstream reporting correctness
  - safe only after master data modules are stable
- Verification gates:
  - rule activation and adjustment approval flows are parity-tested
  - reporting snapshots remain stable before vs after write operations
  - no regression in approval settings and adjustment filters

### Wave 3: Auth Canonicalization

- Module:
  - `auth`
- Why not earlier:
  - v4 auth catalog is missing three legacy account/password flows
  - compat auth already works and is not the current bottleneck
- Required work before rollout:
  - decide whether password reset/delete/self-change belong in canonical v4 auth routes
  - add tests for those flows in server-v4 if the routes move
- Exit gate:
  - account management UI no longer depends on legacy-only auth endpoints

### Wave 4: Declarations Shadow Rollout

- Module:
  - `declarations`
- Strategy:
  - start with read shadowing and importer compat telemetry
  - compare canonical responses with legacy behavior under real QA scenarios
  - keep monolith writes as source of truth until shadow mismatches are resolved
- Verification gates:
  - ECUS preview and commit parity
  - alerts list/config/review parity
  - C/O discrepancy config/run parity
  - declaration edit/history parity
  - zero unexplained diff in sampled declaration payloads

### Wave 5: Declarations Write Cutover

- Switch:
  - enable canonical write traffic for migrated importer routes
  - use importer compat guard to block migrated legacy paths during controlled QA
- Verification gates:
  - importer compat migrated hits trend to zero in normal QA flow
  - no new 500s in import/C/O paths
  - recovery path is documented: disable guard and route operators back to monolith if needed

## Verify Gates By Domain

- Baseline for every wave:
  - `GET /api/v4/health`
  - `GET /api/v4/meta/modules`
  - `GET /api/v4/meta/rollout`
- Existing server-v4 test suites to reuse:
  - `tests/server-v4/authRoutes.test.js`
  - `tests/server-v4/postgresTeamsRoute.test.js`
  - `tests/server-v4/postgresMstAssignmentsRoute.test.js`
  - `tests/server-v4/postgresHqAgenciesRoute.test.js`
  - `tests/server-v4/postgresKpiRulesRoute.test.js`
  - `tests/server-v4/postgresKpiAdjustmentsRoute.test.js`
  - `tests/server-v4/postgresDeclarationsRoute.test.js`
  - `tests/server-v4/legacyCompatRoutes.test.js`
  - `tests/server-v4/importerCompatTraffic.test.js`
  - `tests/server-v4/runtimeRoutes.test.js`
  - `tests/server-v4/v4RolloutStatus.test.js`

## Immediate Implementation Recommendation

- Do not mount all remaining modules in one step.
- Next implementation slice should be:
  - mount `teams`, `mst-assignments`, and `hq-agencies` behind the legacy server
  - keep `auth` and `declarations` on compat-first mode
  - add a QA checklist that captures `/api/v4/meta/rollout` before and after the change

## Suggested Follow-Up Beads

- `cng-xyq.x` Wave-1 mount for `teams` + `mst-assignments` + `hq-agencies`
- `cng-xyq.x` auth parity closure for password/delete/self-change routes
- `cng-xyq.x` declarations shadow diff and compat telemetry gate
