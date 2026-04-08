# Server Retirement Execution Board

Last updated: 2026-04-08
Epic bead: `cng-sr1`
Last completed bead: `cng-sr1.2`
Next bead: `cng-sr1.3`
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

Current verified state after `cng-sr1.2`:

- 8 runtime imports across 5 files
- 31 test imports across 25 files
- 23 mapped legacy targets still remaining for later waves

## Wave Status

| Bead | Wave | Scope | Status |
| --- | --- | --- | --- |
| `cng-sr1.1` | 1 | Bootstrap, frozen inventory, board/notebook/backlog reconcile, verifier scaffold, `packages/backend-shared` skeleton | closed |
| `cng-sr1.2` | 2 | SQLite, snapshot, projection, roster persistence extraction | closed |
| `cng-sr1.3` | 3 | Reporting, export, observability, legacy report bridge extraction | in_progress |
| `cng-sr1.4` | 4 | ECUS bridge and auth/bootstrap helper extraction | open |
| `cng-sr1.5` | 5 | Remaining legacy test imports and orphan runtime helpers | open |
| `cng-sr1.6` | 6 | Final `server/index.js` retirement and delete `server/` | open |

## Closeout Gates

Each wave closes only when all three pass:

1. targeted tests/lint for the touched area are green
2. `pnpm bd:check` is green
3. `pnpm verify:server-retirement` confirms the remaining imports are still fully mapped and did not regress upward

## Dependency Matrix

| Legacy target | Owner wave | Destination | Runtime refs | Test refs | Status |
| --- | --- | --- | --- | --- | --- |
| `server/aiProviders/index.js` | 5 | `@kpi/backend-shared/runtime` | 0 | 1 | open |
| `server/alertsDelivery.js` | 5 | `@kpi/backend-shared/runtime` | 0 | 1 | open |
| `server/bootstrapAccountPasswords.js` | 4 | `@kpi/backend-shared/auth` | 1 | 2 | open |
| `server/businessSnapshotSqlite.js` | 2 | `@kpi/backend-shared/persistence` | 0 | 0 | closed |
| `server/declarationSnapshotSearch.js` | 2 | `@kpi/backend-shared/persistence` | 0 | 0 | closed |
| `server/ecus/bridgeService.js` | 4 | `@kpi/backend-shared/ecus` | 1 | 1 | open |
| `server/ecusBridgeMutations.js` | 4 | `@kpi/backend-shared/ecus` | 0 | 1 | open |
| `server/https/aiHttpsConfig.js` | 5 | `@kpi/backend-shared/runtime` | 0 | 1 | open |
| `server/index.js` | 6 | `delete after runtime/test cutover` | 0 | 4 | open |
| `server/legacyReportingBridge.js` | 3 | `@kpi/backend-shared/reporting` | 1 | 1 | open |
| `server/reportExport.js` | 3 | `@kpi/backend-shared/reporting` | 1 | 2 | open |
| `server/reportExportPayloads.js` | 3 | `@kpi/backend-shared/reporting` | 1 | 1 | open |
| `server/reportingAggregateRuntime.js` | 3 | `@kpi/backend-shared/reporting` | 0 | 1 | open |
| `server/reportingObservability.js` | 3 | `@kpi/backend-shared/reporting` | 1 | 1 | open |
| `server/reportingObservabilityCollections.js` | 3 | `@kpi/backend-shared/reporting` | 1 | 1 | open |
| `server/reportingProjectionSqlite.js` | 2 | `@kpi/backend-shared/persistence` | 0 | 0 | closed |
| `server/reportingProjectionStore.js` | 2 | `@kpi/backend-shared/persistence` | 0 | 0 | closed |
| `server/reportingReadModels.js` | 3 | `@kpi/backend-shared/reporting` | 1 | 3 | open |
| `server/reportingRuleSelection.js` | 3 | `@kpi/backend-shared/reporting` | 0 | 2 | open |
| `server/reportingScheduleRuntime.js` | 3 | `@kpi/backend-shared/reporting` | 0 | 1 | open |
| `server/reportWatermark.js` | 3 | `@kpi/backend-shared/reporting` | 0 | 1 | open |
| `server/runtimeStorageLifecycle.js` | 3 | `@kpi/backend-shared/reporting` | 0 | 1 | open |
| `server/securityHardening.js` | 5 | `@kpi/backend-shared/runtime` | 0 | 1 | open |
| `server/sqliteMigrations.js` | 2/4 | `@kpi/backend-shared/persistence + auth` | 0 | 0 | closed |
| `server/sqlMonitor.js` | 5 | `@kpi/backend-shared/runtime` | 0 | 1 | open |
| `server/storageRouteController.js` | 5 | `@kpi/backend-shared/runtime` | 0 | 1 | open |
| `server/storageRouteRuntime.js` | 5 | `@kpi/backend-shared/runtime` | 0 | 1 | open |
| `server/teamRosterSqlite.js` | 2 | `@kpi/backend-shared/persistence` | 0 | 0 | closed |
| `server/v4RolloutMount.js` | 5 | `server-v4/src/app` | 0 | 1 | open |

## Notes

- `sqliteMigrations.js` is shared by persistence and auth consumers, so the matrix keeps owner wave `2/4` to make the dual migration explicit.
- `server/index.js` is intentionally deferred to wave 6 even though only tests point at it today.
- The verifier fails if any mapped target gains more direct imports than the frozen baseline, even if the target already exists in the matrix.
