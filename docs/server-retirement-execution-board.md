# Server Retirement Execution Board

Last updated: 2026-04-08
Epic bead: `cng-sr1`
Last completed bead: `cng-sr1.5`
Next bead: `cng-sr1.6`
Frozen inventory: `docs/server-retirement-inventory.json`

## Mission

Retire `server/` in controlled waves until:

- `server-v4/src/**` has zero direct imports from `server/**`
- `tests/**` has zero direct imports from `server/**`
- reusable backend helpers live under `packages/backend-shared`
- the legacy `server/` tree can be removed only in the final wave

## Baselines

- Planning-input audit baseline: 25 runtime refs across 14 files; 59 test refs across 38 files
- Direct-import gate baseline frozen on 2026-04-08: 25 runtime imports across 14 files; 52 test imports across 35 files; 29 mapped `server/*` targets
- Gate command: `pnpm verify:server-retirement`

The lane keeps both baselines intentionally:

- the planning-input baseline preserves the broader pre-lane audit
- the verifier baseline is narrower and machine-enforced, based on direct imports only

Current verified state after `cng-sr1.5`:

- 0 runtime imports across 0 files
- 0 test imports across 0 files
- 0 mapped legacy targets remaining in the direct-import verifier

## Wave Status

| Bead | Wave | Scope | Status |
| --- | --- | --- | --- |
| `cng-sr1.1` | 1 | Bootstrap, frozen inventory, board/notebook/backlog reconcile, verifier scaffold, `packages/backend-shared` skeleton | closed |
| `cng-sr1.2` | 2 | SQLite, snapshot, projection, roster persistence extraction | closed |
| `cng-sr1.3` | 3 | Reporting, export, observability, legacy report bridge extraction | closed |
| `cng-sr1.4` | 4 | ECUS bridge and auth/bootstrap helper extraction | closed |
| `cng-sr1.5` | 5 | Remaining legacy test imports and orphan runtime helpers | closed |
| `cng-sr1.6` | 6 | Final `server/index.js` retirement and delete `server/` | in_progress |

## Closeout Gates

Each wave closes only when all three pass:

1. targeted tests/lint for the touched area are green
2. `pnpm bd:check` is green
3. `pnpm verify:server-retirement` confirms the remaining imports are still fully mapped and did not regress upward

## Dependency Matrix

| Legacy target | Owner wave | Destination | Runtime refs | Test refs | Status |
| --- | --- | --- | --- | --- | --- |
| `server/aiProviders/index.js` | 5 | `@kpi/backend-shared/runtime` | 0 | 0 | closed |
| `server/alertsDelivery.js` | 5 | `@kpi/backend-shared/runtime` | 0 | 0 | closed |
| `server/bootstrapAccountPasswords.js` | 4 | `@kpi/backend-shared/auth` | 0 | 0 | closed |
| `server/businessSnapshotSqlite.js` | 2 | `@kpi/backend-shared/persistence` | 0 | 0 | closed |
| `server/declarationSnapshotSearch.js` | 2 | `@kpi/backend-shared/persistence` | 0 | 0 | closed |
| `server/ecus/bridgeService.js` | 4 | `@kpi/backend-shared/ecus` | 0 | 0 | closed |
| `server/ecusBridgeMutations.js` | 4 | `@kpi/backend-shared/ecus` | 0 | 0 | closed |
| `server/https/aiHttpsConfig.js` | 5 | `@kpi/backend-shared/runtime` | 0 | 0 | closed |
| `server/index.js` | 6 | `replace testing quarantine before delete` | 0 | 0 | in_progress |
| `server/legacyReportingBridge.js` | 3 | `@kpi/backend-shared/reporting` | 0 | 0 | closed |
| `server/reportExport.js` | 3 | `@kpi/backend-shared/reporting` | 0 | 0 | closed |
| `server/reportExportPayloads.js` | 3 | `@kpi/backend-shared/reporting` | 0 | 0 | closed |
| `server/reportingAggregateRuntime.js` | 3 | `@kpi/backend-shared/reporting` | 0 | 0 | closed |
| `server/reportingObservability.js` | 3 | `@kpi/backend-shared/reporting` | 0 | 0 | closed |
| `server/reportingObservabilityCollections.js` | 3 | `@kpi/backend-shared/reporting` | 0 | 0 | closed |
| `server/reportingProjectionSqlite.js` | 2 | `@kpi/backend-shared/persistence` | 0 | 0 | closed |
| `server/reportingProjectionStore.js` | 2 | `@kpi/backend-shared/persistence` | 0 | 0 | closed |
| `server/reportingReadModels.js` | 3 | `@kpi/backend-shared/reporting` | 0 | 0 | closed |
| `server/reportingRuleSelection.js` | 3 | `@kpi/backend-shared/reporting` | 0 | 0 | closed |
| `server/reportingScheduleRuntime.js` | 3 | `@kpi/backend-shared/reporting` | 0 | 0 | closed |
| `server/reportWatermark.js` | 3 | `@kpi/backend-shared/reporting` | 0 | 0 | closed |
| `server/runtimeStorageLifecycle.js` | 3 | `@kpi/backend-shared/reporting` | 0 | 0 | closed |
| `server/securityHardening.js` | 5 | `@kpi/backend-shared/runtime` | 0 | 0 | closed |
| `server/sqliteMigrations.js` | 2/4 | `@kpi/backend-shared/persistence + auth` | 0 | 0 | closed |
| `server/sqlMonitor.js` | 5 | `@kpi/backend-shared/runtime` | 0 | 0 | closed |
| `server/storageRouteController.js` | 5 | `@kpi/backend-shared/runtime` | 0 | 0 | closed |
| `server/storageRouteRuntime.js` | 5 | `@kpi/backend-shared/runtime` | 0 | 0 | closed |
| `server/teamRosterSqlite.js` | 2 | `@kpi/backend-shared/persistence` | 0 | 0 | closed |
| `server/v4RolloutMount.js` | 5 | `server-v4/src/app` | 0 | 0 | closed |

## Notes

- `sqliteMigrations.js` is shared by persistence and auth consumers, so the matrix keeps owner wave `2/4` to make the dual migration explicit.
- The direct-import verifier is fully zeroed, but `packages/backend-shared/src/testing/index.js` still forwards legacy API suites to `server/index.js` as a temporary quarantine, so physical deletion remains a wave-6 task.
- The verifier fails if any mapped target gains more direct imports than the frozen baseline, even if the target already exists in the matrix.
