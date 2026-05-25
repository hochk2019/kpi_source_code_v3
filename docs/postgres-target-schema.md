# PostgreSQL Target Schema And Migration Map

## Status
- Phase: `cng-7c8.4`
- Date: 2026-03-09
- Purpose: replace the current SQLite `kv_store` blob model with a PostgreSQL design that preserves current business behavior while making reporting, authz, and future modularization tractable.

## What The Current System Is Actually Doing
- `decl_rows_v1` is the operational fact store. It is patched by `(so_tk, nhanh)` and then re-read in bulk for reporting, export, and UI.
- `mst_rows_v2` is a temporal assignment table in disguise: one MST can map to different import/export staff across effective date windows.
- `team_roster_v1`, `hq_agencies_v1`, `kpi_users_v1`, `kpi_rules_v2`, `kpi_adjustments_v1`, and `kpi_report_schedule_v1` are business entities, not app settings.
- `buildReportData()` recomputes staff/team/month summaries in memory from raw declaration rows plus approved adjustments.
- `/api/bootstrap` returns a near-full storage snapshot after auth, so the frontend cache shape mirrors `kv_store` instead of a typed API boundary.

## Hot Paths That Drive The Schema
- Declaration write path: import/upsert/patch by `so_tk + nhanh`.
- MST lookup path: find assignment by `mst` and declaration date.
- Reporting path: aggregate declarations by month, staff, team, company, export/import, CO presence, license counts, and KPI points.
- Adjustment path: filter by month, status, staff, team, category.
- Schedule path: list active schedules ordered by `nextRun`.
- Audit/history path: append-only logs by actor and time.

## Design Principles
- Move true business entities into typed tables.
- Keep low-churn operational configuration in JSONB instead of over-normalizing it.
- Version KPI rules explicitly; derived KPI results must be keyed by rule-set version.
- Preserve historical snapshots for mutable names such as staff, team, and company.
- Use Postgres-native temporal constraints where the current model is interval-based.
- Prefer append-only event/history tables over mutating JSON history arrays.

## Target Schema

### 1. Identity And Access

#### `auth_accounts`
- `id uuid primary key`
- `username citext unique not null`
- `password_hash text not null`
- `role text not null`
- `display_name text not null`
- `member_id uuid null`
- `permissions_override jsonb not null default '{}'::jsonb`
- `status text not null default 'active'`
- `updated_at timestamptz not null`

Rationale:
- Current `kpi_users_v1` is account data plus optional team/member links and permission overrides.
- Keep permission overrides in JSONB for parity; role templates stay in code or a small reference table later.

#### `auth_sessions`
- `session_token text primary key`
- `account_id uuid not null references auth_accounts(id)`
- `created_at timestamptz not null`
- `expires_at timestamptz not null`

Indexes:
- `(account_id)`
- `(expires_at)`

### 2. Organization And Reference Data

#### `teams`
- `id uuid primary key`
- `code text null`
- `name text unique not null`
- `active boolean not null default true`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

#### `team_members`
- `id uuid primary key`
- `team_id uuid not null references teams(id)`
- `full_name text not null`
- `normalized_name text not null`
- `active boolean not null default true`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Indexes:
- unique `(team_id, normalized_name)`
- `(normalized_name)`

Rationale:
- Current `team_roster_v1` is small but relational by nature and is joined into reporting and MST resolution.

#### `mst_assignments`
- `id uuid primary key`
- `tax_code text not null`
- `company_name text not null default ''`
- `import_member_id uuid null references team_members(id)`
- `export_member_id uuid null references team_members(id)`
- `team_id uuid null references teams(id)`
- `valid_during daterange not null`
- `status text not null`
- `updated_at timestamptz not null`
- `updated_by_account_id uuid null references auth_accounts(id)`

Indexes and constraints:
- `gist (tax_code, valid_during)`
- exclusion constraint: `tax_code WITH =, valid_during WITH &&`

Rationale:
- This replaces `mst_rows_v2` cleanly and enforces the no-overlap rule that the current blob model can only approximate.

#### `mst_assignment_events`
- `id bigserial primary key`
- `mst_assignment_id uuid null references mst_assignments(id)`
- `tax_code text not null`
- `event_type text not null`
- `payload jsonb not null`
- `actor_username text not null`
- `occurred_at timestamptz not null`

Rationale:
- Replaces `mst_history_v1`.

#### `tax_code_agency_bindings`
- `id uuid primary key`
- `tax_code text unique not null`
- `company_name text not null default ''`
- `updated_at timestamptz not null`
- `updated_by_account_id uuid null references auth_accounts(id)`

#### `tax_code_agency_binding_agents`
- `id bigserial primary key`
- `binding_id uuid not null references tax_code_agency_bindings(id) on delete cascade`
- `agent_order smallint not null`
- `agent_name text not null`
- `agent_name_normalized text not null`

Indexes:
- unique `(binding_id, agent_name_normalized)`
- `(agent_name_normalized)`

Rationale:
- `hq_agencies_v1` is a one-to-many binding between MST and one or more agency names.

#### `tax_code_agency_binding_events`
- same pattern as `mst_assignment_events`

Rationale:
- Replaces `hq_history_v1`.

### 3. Declaration Fact Model

#### `declarations`
- `id uuid primary key`
- `declaration_no text not null`
- `declaration_no_raw text not null`
- `branch_code text not null default ''`
- `declared_at date not null`
- `raw_date_text text not null default ''`
- `tax_code text not null default ''`
- `company_name text not null default ''`
- `customs_type_code text not null default ''`
- `item_count integer not null default 0`
- `license_count integer not null default 0`
- `co_line_count integer not null default 0`
- `staff_member_id uuid null references team_members(id)`
- `team_id uuid null references teams(id)`
- `staff_name_snapshot text not null default ''`
- `team_name_snapshot text not null default ''`
- `agency_text text not null default ''`
- `is_export boolean not null default false`
- `source_system text not null default 'ecus'`
- `source_hash text null`
- `deleted_at timestamptz null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Indexes and constraints:
- unique `(declaration_no, branch_code)`
- `(declared_at desc)` where `deleted_at is null`
- `(tax_code, declared_at desc)` where `deleted_at is null`
- `(staff_member_id, declared_at desc)` where `deleted_at is null`
- `(team_id, declared_at desc)` where `deleted_at is null`
- `(is_export, declared_at desc)` where `deleted_at is null`
- `(company_name)`

Rationale:
- This is the center of the reporting model.
- Snapshot name columns preserve history even if team membership or account mappings later change.

#### `declaration_license_codes`
- `id bigserial primary key`
- `declaration_id uuid not null references declarations(id) on delete cascade`
- `code text not null`
- `is_excluded boolean not null default false`

Indexes:
- unique `(declaration_id, code)`
- `(code)`

Rationale:
- Replaces the embedded `licenseCodes`, `licenseSourceCodes`, and `licenseExcludedCodes` arrays with a queryable child table.

#### `declaration_events`
- `id bigserial primary key`
- `declaration_id uuid null references declarations(id)`
- `declaration_no text not null`
- `branch_code text not null default ''`
- `event_type text not null`
- `payload jsonb not null`
- `actor_username text not null`
- `occurred_at timestamptz not null`

Rationale:
- Replaces both `decl_history_v1` and `decl_deleted_log_v1`.
- Event types should include at least `import_upsert`, `manual_patch`, and `soft_delete`.

### 4. KPI Rules, Derived Results, And Reporting

#### `kpi_rule_sets`
- `id uuid primary key`
- `version_no bigint unique not null`
- `name text not null`
- `rules_jsonb jsonb not null`
- `is_active boolean not null`
- `created_at timestamptz not null`
- `created_by_account_id uuid null references auth_accounts(id)`
- `activated_at timestamptz null`
- `activated_by_account_id uuid null references auth_accounts(id)`

Rationale:
- `kpi_rules_v2` is rule-engine configuration, but it is also a version boundary for every derived KPI result.
- Keep the rules payload in JSONB first; do not deeply normalize rule internals until the engine is stabilized in TS.

#### `kpi_declaration_results`
- `declaration_id uuid not null references declarations(id) on delete cascade`
- `rule_set_id uuid not null references kpi_rule_sets(id) on delete cascade`
- `kpi_points numeric(12,2) not null`
- `computed_at timestamptz not null`
- primary key `(declaration_id, rule_set_id)`

Indexes:
- `(rule_set_id, computed_at desc)`

Rationale:
- Current reports recompute every row under the current rules.
- This table makes rule-versioned KPI derivation explicit and allows gradual precomputation.

#### `kpi_staff_monthly`
- `month_start date not null`
- `rule_set_id uuid not null references kpi_rule_sets(id)`
- `staff_member_id uuid not null references team_members(id)`
- `team_id uuid null references teams(id)`
- `decl_count integer not null`
- `item_count integer not null`
- `license_count integer not null`
- `export_decl_count integer not null`
- `co_decl_count integer not null`
- `co_line_count integer not null`
- `kpi_points numeric(12,2) not null`
- `adjustment_points numeric(12,2) not null`
- `refreshed_at timestamptz not null`
- primary key `(month_start, rule_set_id, staff_member_id)`

#### `kpi_team_monthly`
- same shape as `kpi_staff_monthly`, but keyed by `(month_start, rule_set_id, team_id)`

Rationale:
- Replaces the hottest in-memory aggregation path used by reports and AI snapshot generation.
- These can start as refreshable tables/materialized views fed from `declarations`, `kpi_declaration_results`, and approved adjustments.

### 5. Adjustments And Schedules

#### `kpi_adjustments`
- `id uuid primary key`
- `month_start date not null`
- `category text not null`
- `mode text null`
- `license_code text null`
- `staff_member_id uuid null references team_members(id)`
- `team_id uuid null references teams(id)`
- `staff_name_snapshot text not null default ''`
- `team_name_snapshot text not null default ''`
- `tax_code text null`
- `company_name text null`
- `quantity numeric(12,2) not null`
- `unit_points numeric(12,2) not null`
- `extra_quantity numeric(12,2) null`
- `extra_unit_points numeric(12,2) null`
- `total_points numeric(12,2) not null`
- `references text[] not null default '{}'`
- `note text not null default ''`
- `status text not null`
- `created_at timestamptz not null`
- `created_by_account_id uuid null references auth_accounts(id)`
- `updated_at timestamptz not null`
- `updated_by_account_id uuid null references auth_accounts(id)`
- `approved_at timestamptz null`
- `approved_by_account_id uuid null references auth_accounts(id)`
- `rejected_at timestamptz null`
- `rejected_by_account_id uuid null references auth_accounts(id)`
- `history_jsonb jsonb not null default '[]'::jsonb`

Indexes:
- `(month_start, status)`
- `(staff_member_id, month_start desc)`
- `(team_id, month_start desc)`
- `(category, month_start desc)`

Rationale:
- Mirrors the current approval lifecycle in `kpi_adjustments_v1` without hiding it inside an array.

#### `kpi_adjustment_policies`
- either a single-row table or `config_documents` entry
- keep as JSONB initially

Rationale:
- `kpi_adjustment_settings_v1` is configuration, not a reporting fact.

#### `report_schedules`
- `id uuid primary key`
- `name text not null`
- `frequency text not null`
- `run_time time not null`
- `day_of_week smallint null`
- `day_of_month smallint null`
- `recipients text[] not null`
- `formats text[] not null`
- `active boolean not null`
- `last_run_at timestamptz null`
- `next_run_at timestamptz null`
- `updated_at timestamptz not null`
- `updated_by_account_id uuid null references auth_accounts(id)`

Indexes:
- `(active, next_run_at)`

Rationale:
- Replaces `kpi_report_schedule_v1`.

### 6. Audit, Import, Export, And User Preferences

#### `audit_log`
- `id bigserial primary key`
- `occurred_at timestamptz not null`
- `actor_username text not null`
- `action text not null`
- `detail text not null`
- `meta jsonb not null default '{}'::jsonb`

Indexes:
- `(occurred_at desc)`
- `(actor_username, occurred_at desc)`
- `(action, occurred_at desc)`

Rationale:
- Replaces `audit_logs_v1`.

#### `import_runs`
- `id uuid primary key`
- `source text not null`
- `status text not null`
- `started_at timestamptz not null`
- `finished_at timestamptz null`
- `initiated_by_account_id uuid null`
- `summary jsonb not null default '{}'::jsonb`

Rationale:
- Replaces `import_logs_v1`.

#### `user_preferences`
- `account_id uuid primary key references auth_accounts(id)`
- `layout_config jsonb not null default '{}'::jsonb`

#### `saved_filter_presets`
- `id uuid primary key`
- `account_id uuid not null references auth_accounts(id)`
- `name text not null`
- `preset jsonb not null`
- `updated_at timestamptz not null`

Rationale:
- `ui_layout_config_v1` and `filter_presets_v1` are user-scoped preferences, not global system blobs.

#### `export_audit`
#### `export_audit_access`
- migrate as typed Postgres tables with the same functional shape as the current SQLite tables

### 7. Operational Config And AI State

#### `config_documents`
- `config_key text primary key`
- `document jsonb not null`
- `updated_at timestamptz not null`
- `updated_by_account_id uuid null references auth_accounts(id)`

Intended contents:
- `ecus_sync_config_v1`
- `decl_alert_config_v1`
- `decl_alert_state_v1`
- `co_tax_code_config_v1`
- `co_discrepancy_config_v1`
- `co_discrepancy_state_v1`
- `duplicate_policy_config_v1`
- `duplicate_policy_state_v1`
- `db_backup_config_v1`
- `kpi_adjustment_settings_v1`

Rationale:
- These are configuration/state documents with low relational value today.
- Forcing them into many tiny tables early would slow the migration without improving hot paths.

#### AI storage strategy
- Keep AI provider config in Postgres.
- Move chat history and short-lived caches out of the core bootstrap payload.
- Candidate model:
  - `ai_provider_configs`
  - `ai_snapshot_cache`
  - `ai_snapshot_history`
  - `ai_insights`
  - `ai_chat_messages`
- If latency becomes the driver, use Redis for cache and Postgres only for durable history.

## Migration Map

| Current key / table | Current shape | Target |
|---|---|---|
| `decl_rows_v1` | array of declaration objects | `declarations`, `declaration_license_codes`, `kpi_declaration_results` |
| `decl_history_v1` | JSON object of row history | `declaration_events` |
| `decl_deleted_log_v1` | delete log array | `declaration_events` with `event_type = 'soft_delete'` |
| `mst_rows_v2` | assignment rows with effective dates | `mst_assignments` |
| `mst_history_v1` | history array | `mst_assignment_events` |
| `team_roster_v1` | team/member tree | `teams`, `team_members` |
| `hq_agencies_v1` | MST -> company + agent list | `tax_code_agency_bindings`, `tax_code_agency_binding_agents` |
| `hq_history_v1` | history array | `tax_code_agency_binding_events` |
| `kpi_rules_v2` | rule collection JSON | `kpi_rule_sets` |
| `kpi_adjustments_v1` | adjustment array | `kpi_adjustments` |
| `kpi_adjustment_settings_v1` | policy JSON | `config_documents` or `kpi_adjustment_policies` |
| `kpi_report_schedule_v1` | schedule array | `report_schedules` |
| `kpi_users_v1` | account array | `auth_accounts` |
| `auth_sessions` | typed SQLite table | `auth_sessions` |
| `audit_logs_v1` | log array | `audit_log` |
| `import_logs_v1` | log array | `import_runs` |
| `filter_presets_v1` | per-user presets JSON | `saved_filter_presets` |
| `ui_layout_config_v1` | shared layout JSON | `user_preferences` |
| `decl_alert_*`, `co_*`, `duplicate_policy_*`, `ecus_sync_config_v1`, `db_backup_config_v1` | config/state JSON | `config_documents` |
| `ai_provider_config_v1` | provider config JSON | `ai_provider_configs` or `config_documents` |
| `ai_usage_cache_v1`, `ai_snapshot_cache_v1`, `ai_snapshot_history_v1`, `ai_insights_v1`, `ai_chat_history__*` | cache/history blobs | dedicated AI tables or Redis + durable Postgres history |
| `export_audit`, `export_audit_access` | typed SQLite tables | same typed tables in Postgres |

## Aggregation Strategy
- Source of truth remains `declarations`, `declaration_license_codes`, `kpi_rule_sets`, and `kpi_adjustments`.
- `kpi_declaration_results` is recomputed when:
  - declarations change
  - the active rule-set changes
- `kpi_staff_monthly` and `kpi_team_monthly` are refreshed from:
  - active `kpi_declaration_results`
  - approved `kpi_adjustments`
- AI snapshot and report endpoints should read these aggregates, not re-run the full in-memory report builder against raw blobs.

## Cutover Strategy

### Stage 1: Sidecar Postgres And Backfill
- Create Postgres schema without changing runtime reads.
- Backfill `teams`, `team_members`, `mst_assignments`, `tax_code_agency_bindings`, `auth_accounts`, `report_schedules`, `kpi_rule_sets`, `kpi_adjustments`, and `declarations`.
- Store source checksums and row counts for reconciliation.

### Stage 2: Dual Write On Current Backend
- For core write paths, write to both SQLite blob storage and Postgres:
  - declarations
  - MST assignments
  - HQ agency bindings
  - KPI adjustments
  - accounts
  - report schedules
- Keep reads on the current path until counts and spot checks match.

### Stage 3: Move Read Paths By Domain
- Switch low-risk reference reads first:
  - teams
  - MST assignments
  - HQ agency bindings
  - accounts
- Switch reporting and AI snapshot reads only after the aggregate tables are live.
- Remove `bootstrap` dependence on full-storage snapshot; replace with typed bootstrap endpoints.

### Stage 4: Retire Blob Keys
- Freeze writes to the migrated blob keys.
- Retain read-only export/archive tooling for rollback.
- Remove generic `/api/storage/:key` access for migrated business entities.

## Rollback Strategy
- Keep SQLite blob writes running until Postgres reads have baked in production-like verification.
- Maintain one-way export jobs from Postgres back to a blob-compatible archive during the transition.
- Do not delete `kv_store` keys until:
  - row counts match
  - sample hashes match
  - monthly KPI totals match by staff/team
  - schedule execution results match

## First Implementation Order After This Doc
1. Scaffold TypeScript modular monolith boundaries around these domains:
   - auth
   - declarations
   - mst-assignments
   - teams
   - hq-agencies
   - kpi-rules
   - kpi-adjustments
   - reporting
2. Add Postgres schema/migration files for the reference and auth domains first.
3. Backfill and dual-write the reference domains before touching declaration reporting.
4. Replace report generation with aggregate-backed queries before redesigning the heavy UI flows.
