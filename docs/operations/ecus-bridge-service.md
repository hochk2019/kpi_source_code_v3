# ECUS Bridge Service Runbook

## Purpose

`apps/ecus-bridge` is the standalone Windows-side service boundary for:

- DPAPI-backed ECUS SQL credentials
- SQL Server connectivity and pagination capability discovery
- single-flight preview/run execution
- retried delivery of normalized payloads to the core API

The core API remains the system of record for declarations. The bridge service is the SQL/DPAPI integration edge.

## Required Environment

- `KPI_CORE_API_URL` or `ECUS_CORE_API_URL`: base URL for the core API
- `KPI_ECUS_BRIDGE_TOKEN` or `ECUS_BRIDGE_TOKEN`: bearer token used by the bridge when calling `/api/v4/declarations/imports/ecus-*`
- `ECUS_BRIDGE_CONTROL_TOKEN`: bearer token for `/status`, `/sync/preview`, and `/sync/run` on the standalone bridge host
- `ECUS_BRIDGE_HOST`: listen host, default `127.0.0.1`
- `ECUS_BRIDGE_PORT`: listen port, default `0`

SQL credential sources:

- Preferred on Windows: `ECUS_SQL_SECURE_FILE` pointing to the DPAPI-encrypted credential blob
- Fallback/manual override: `ECUS_SQL_SERVER`, `ECUS_SQL_DATABASE`, `ECUS_SQL_USER`, `ECUS_SQL_PASSWORD`
- Optional: `PWSH_PATH` when PowerShell is not available as `pwsh`

## Service Commands

From [apps/ecus-bridge/package.json](E:\GPT\kpi_source_code_v4\apps\ecus-bridge\package.json):

- `pnpm --dir apps/ecus-bridge start`
- `pnpm --dir apps/ecus-bridge service:install`
- `pnpm --dir apps/ecus-bridge service:remove`
- `pnpm --dir apps/ecus-bridge service:status`

## HTTP Contract

- `GET /health`
  - no auth
  - returns bridge health plus refreshed SQL health snapshot
- `GET /status`
  - requires `Authorization: Bearer <ECUS_BRIDGE_CONTROL_TOKEN>`
  - returns cached host status, busy flag, and last failure snapshot
- `POST /sync/preview`
  - requires control token
  - body: `{ "from": "YYYY-MM-DD", "to": "YYYY-MM-DD", "limit": number }`
- `POST /sync/run`
  - requires control token
  - body: `{ "from": "YYYY-MM-DD", "to": "YYYY-MM-DD", "limit": number, "actor": string, "reason": string }`

## Retry And Busy Semantics

- Bridge-to-core API calls retry on transient failures only:
  - network failure
  - `429`
  - `5xx`
- Current retry schedule in [bridgeApiClient.js](E:\GPT\kpi_source_code_v4\apps\ecus-bridge\src\bridgeApiClient.js): `250ms`, then `500ms`
- The host is single-flight:
  - concurrent preview/run requests are rejected with `409` and code `bridge_busy`
- `/health` always refreshes SQL health before responding

## Operational Ownership

- Canonical credential loader: [bridgeSecureCredentials.js](E:\GPT\kpi_source_code_v4\apps\ecus-bridge\src\bridgeSecureCredentials.js)
- Canonical SQL connection layer: [sqlBridge.js](E:\GPT\kpi_source_code_v4\apps\ecus-bridge\src\sqlBridge.js)
- `server/ecus/secureCredentials.js` and `server/ecus/sqlBridge.js` are compatibility shims only

## Failure Handling

- Invalid or missing control token:
  - `/status` and sync routes return `401` or `403`
- Oversized request body:
  - returns `413`
- Invalid JSON body:
  - returns `400`
- Busy bridge:
  - returns `409`
- SQL/bridge startup failure:
  - CLI closes the SQL pool before exiting non-zero

## Verification Checklist

1. `pnpm exec vitest run tests/server.secureCredentials.test.js tests/server.ecusSqlBridge.test.js tests/ecusBridgeBootstrap.test.js tests/ecusBridgeHttpServer.test.js tests/ecusBridgeHost.test.js tests/ecusBridgeCli.test.js tests/ecusBridgeWindowsService.test.js`
2. `pnpm exec eslint apps/ecus-bridge/src/bridgeSecureCredentials.js apps/ecus-bridge/src/sqlBridge.js apps/ecus-bridge/src/bridgeBootstrap.js tests/server.secureCredentials.test.js tests/server.ecusSqlBridge.test.js`
3. `git diff --check -- apps/ecus-bridge/src/bridgeSecureCredentials.js apps/ecus-bridge/src/sqlBridge.js server/ecus/secureCredentials.js server/ecus/sqlBridge.js docs/operations/ecus-bridge-service.md`
