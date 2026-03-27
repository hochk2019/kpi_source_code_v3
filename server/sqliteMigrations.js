export const SQLITE_MIGRATION_TABLE = 'schema_migrations';

const KV_STORE_MIGRATIONS = [
  {
    id: '0001_kv_store',
    apply(database) {
      database.exec(
        'CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
      );
    },
  },
];

const AUTH_MIGRATIONS = [
  {
    id: '0002_auth_sessions',
    apply(database) {
      database.exec(
        'CREATE TABLE IF NOT EXISTS auth_sessions (' +
          'token TEXT PRIMARY KEY, ' +
          'username TEXT NOT NULL, ' +
          'created_at INTEGER NOT NULL, ' +
          'expires_at INTEGER NOT NULL' +
          ')',
      );
      database.exec(
        'CREATE INDEX IF NOT EXISTS idx_auth_sessions_username ON auth_sessions(username)',
      );
    },
  },
];

const EXPORT_AUDIT_MIGRATIONS = [
  {
    id: '0003_export_audit',
    apply(database) {
      database.exec(
        'CREATE TABLE IF NOT EXISTS export_audit (\n' +
          '  id INTEGER PRIMARY KEY AUTOINCREMENT,\n' +
          '  created_at TEXT NOT NULL,\n' +
          '  issued_at TEXT,\n' +
          '  username TEXT NOT NULL,\n' +
          '  display_name TEXT,\n' +
          '  role TEXT,\n' +
          '  report_kind TEXT NOT NULL,\n' +
          '  filename TEXT,\n' +
          '  signature TEXT,\n' +
          '  short_signature TEXT,\n' +
          '  filter_summary TEXT,\n' +
          '  filters TEXT,\n' +
          '  ip_address TEXT,\n' +
          '  request_id TEXT,\n' +
          '  user_agent TEXT\n' +
          ')',
      );
      database.exec(
        'CREATE INDEX IF NOT EXISTS idx_export_audit_created_at ON export_audit(created_at)',
      );
      database.exec(
        'CREATE INDEX IF NOT EXISTS idx_export_audit_username ON export_audit(username)',
      );
    },
  },
  {
    id: '0004_export_audit_access',
    apply(database) {
      database.exec(
        'CREATE TABLE IF NOT EXISTS export_audit_access (\n' +
          '  id INTEGER PRIMARY KEY AUTOINCREMENT,\n' +
          '  viewed_at TEXT NOT NULL,\n' +
          '  username TEXT NOT NULL,\n' +
          '  display_name TEXT,\n' +
          '  role TEXT,\n' +
          '  ip_address TEXT,\n' +
          '  client_host TEXT,\n' +
          '  user_agent TEXT,\n' +
          '  filters TEXT,\n' +
          '  query TEXT\n' +
          ')',
      );
      database.exec(
        'CREATE INDEX IF NOT EXISTS idx_export_audit_access_viewed_at ON export_audit_access(viewed_at)',
      );
      database.exec(
        'CREATE INDEX IF NOT EXISTS idx_export_audit_access_username ON export_audit_access(username)',
      );
    },
  },
];

const REPORTING_PROJECTION_MIGRATIONS = [
  {
    id: '0100_reporting_projections',
    apply(database) {
      database.exec(
        'CREATE TABLE IF NOT EXISTS reporting_projections (\n' +
          '  projection_key TEXT PRIMARY KEY,\n' +
          '  projection_type TEXT NOT NULL,\n' +
          '  scope_key TEXT NOT NULL DEFAULT \'\',\n' +
          '  range_from TEXT NOT NULL DEFAULT \'\',\n' +
          '  range_to TEXT NOT NULL DEFAULT \'\',\n' +
          '  query_key TEXT NOT NULL DEFAULT \'\',\n' +
          '  entry_count INTEGER NOT NULL DEFAULT 0,\n' +
          '  payload TEXT NOT NULL,\n' +
          '  updated_at TEXT NOT NULL\n' +
          ')',
      );
      database.exec(
        'CREATE INDEX IF NOT EXISTS idx_reporting_projections_type ON reporting_projections(projection_type)',
      );
    },
  },
  {
    id: '0101_reporting_schedule_projection_entries',
    apply(database) {
      database.exec(
        'CREATE TABLE IF NOT EXISTS reporting_schedule_projection_entries (\n' +
          '  projection_key TEXT NOT NULL,\n' +
          '  position INTEGER NOT NULL DEFAULT 0,\n' +
          '  schedule_id TEXT NOT NULL,\n' +
          '  name TEXT NOT NULL DEFAULT \'\',\n' +
          '  frequency TEXT NOT NULL DEFAULT \'\',\n' +
          '  time TEXT NOT NULL DEFAULT \'\',\n' +
          '  day_of_week INTEGER NOT NULL DEFAULT 0,\n' +
          '  day_of_month INTEGER NOT NULL DEFAULT 0,\n' +
          '  active INTEGER NOT NULL DEFAULT 0,\n' +
          '  last_run TEXT NOT NULL DEFAULT \'\',\n' +
          '  next_run TEXT NOT NULL DEFAULT \'\',\n' +
          '  recipient_count INTEGER NOT NULL DEFAULT 0,\n' +
          '  format_count INTEGER NOT NULL DEFAULT 0,\n' +
          '  payload TEXT NOT NULL,\n' +
          '  PRIMARY KEY (projection_key, schedule_id)\n' +
          ')',
      );
      database.exec(
        'CREATE INDEX IF NOT EXISTS idx_reporting_schedule_projection_entries_projection_key ON ' +
          'reporting_schedule_projection_entries(projection_key)',
      );
      database.exec(
        'CREATE INDEX IF NOT EXISTS idx_reporting_schedule_projection_entries_active ON ' +
          'reporting_schedule_projection_entries(active)',
      );
    },
  },
  {
    id: '0102_reporting_schedule_position_backfill',
    apply(database) {
      ensureTableColumn(
        database,
        'reporting_schedule_projection_entries',
        'position',
        'INTEGER NOT NULL DEFAULT 0',
      );
      database.exec(
        'CREATE INDEX IF NOT EXISTS idx_reporting_schedule_projection_entries_projection_position ON ' +
          'reporting_schedule_projection_entries(projection_key, position)',
      );
    },
  },
  {
    id: '0103_reporting_monthly_aggregate_projection_entries',
    apply(database) {
      database.exec(
        'CREATE TABLE IF NOT EXISTS reporting_monthly_aggregate_projection_entries (\n' +
          '  projection_key TEXT NOT NULL,\n' +
          '  period TEXT NOT NULL,\n' +
          '  label TEXT NOT NULL DEFAULT \'\',\n' +
          '  range_from TEXT NOT NULL DEFAULT \'\',\n' +
          '  range_to TEXT NOT NULL DEFAULT \'\',\n' +
          '  decls INTEGER NOT NULL DEFAULT 0,\n' +
          '  import_count INTEGER NOT NULL DEFAULT 0,\n' +
          '  export_count INTEGER NOT NULL DEFAULT 0,\n' +
          '  item_count INTEGER NOT NULL DEFAULT 0,\n' +
          '  license_count INTEGER NOT NULL DEFAULT 0,\n' +
          '  kpi REAL NOT NULL DEFAULT 0,\n' +
          '  co_count INTEGER NOT NULL DEFAULT 0,\n' +
          '  co_line_count INTEGER NOT NULL DEFAULT 0,\n' +
          '  company_count INTEGER NOT NULL DEFAULT 0,\n' +
          '  top_team_count INTEGER NOT NULL DEFAULT 0,\n' +
          '  top_staff_count INTEGER NOT NULL DEFAULT 0,\n' +
          '  payload TEXT NOT NULL,\n' +
          '  PRIMARY KEY (projection_key, period)\n' +
          ')',
      );
      database.exec(
        'CREATE INDEX IF NOT EXISTS idx_reporting_monthly_aggregate_projection_entries_projection_key ON ' +
          'reporting_monthly_aggregate_projection_entries(projection_key)',
      );
      database.exec(
        'CREATE INDEX IF NOT EXISTS idx_reporting_monthly_aggregate_projection_entries_range ON ' +
          'reporting_monthly_aggregate_projection_entries(range_from, range_to)',
      );
    },
  },
  {
    id: '0104_reporting_job_run_entries',
    apply(database) {
      database.exec(
        'CREATE TABLE IF NOT EXISTS reporting_job_run_entries (\n' +
          '  projection_key TEXT NOT NULL,\n' +
          '  run_id TEXT NOT NULL,\n' +
          '  job_name TEXT NOT NULL DEFAULT \'\',\n' +
          '  status TEXT NOT NULL DEFAULT \'\',\n' +
          '  source TEXT NOT NULL DEFAULT \'\',\n' +
          '  actor TEXT NOT NULL DEFAULT \'\',\n' +
          '  snapshot_key TEXT NOT NULL DEFAULT \'\',\n' +
          '  query_key TEXT NOT NULL DEFAULT \'\',\n' +
          '  range_from TEXT NOT NULL DEFAULT \'\',\n' +
          '  range_to TEXT NOT NULL DEFAULT \'\',\n' +
          '  total INTEGER NOT NULL DEFAULT 0,\n' +
          '  started_at TEXT NOT NULL DEFAULT \'\',\n' +
          '  finished_at TEXT NOT NULL DEFAULT \'\',\n' +
          '  duration_ms INTEGER NOT NULL DEFAULT 0,\n' +
          '  error_message TEXT NOT NULL DEFAULT \'\',\n' +
          '  payload TEXT NOT NULL,\n' +
          '  PRIMARY KEY (projection_key, run_id)\n' +
          ')',
      );
      database.exec(
        'CREATE INDEX IF NOT EXISTS idx_reporting_job_run_entries_projection_key ON ' +
          'reporting_job_run_entries(projection_key)',
      );
      database.exec(
        'CREATE INDEX IF NOT EXISTS idx_reporting_job_run_entries_finished_at ON ' +
          'reporting_job_run_entries(finished_at DESC)',
      );
    },
  },
  {
    id: '0105_reporting_projection_columns_backfill',
    apply(database) {
      ensureTableColumn(database, 'reporting_projections', 'scope_key', "TEXT NOT NULL DEFAULT ''");
      ensureTableColumn(database, 'reporting_projections', 'range_from', "TEXT NOT NULL DEFAULT ''");
      ensureTableColumn(database, 'reporting_projections', 'range_to', "TEXT NOT NULL DEFAULT ''");
      ensureTableColumn(database, 'reporting_projections', 'query_key', "TEXT NOT NULL DEFAULT ''");
      ensureTableColumn(database, 'reporting_projections', 'entry_count', 'INTEGER NOT NULL DEFAULT 0');
    },
  },
];

const BUSINESS_SNAPSHOT_MIGRATIONS = [
  {
    id: '0200_business_snapshot_state',
    apply(database) {
      database.exec(
        'CREATE TABLE IF NOT EXISTS business_snapshot_state (\n' +
          '  domain_key TEXT NOT NULL,\n' +
          '  snapshot_key TEXT NOT NULL,\n' +
          '  version INTEGER NOT NULL DEFAULT 1,\n' +
          '  row_count INTEGER NOT NULL DEFAULT 0,\n' +
          '  payload TEXT,\n' +
          '  updated_at TEXT NOT NULL,\n' +
          '  PRIMARY KEY(domain_key, snapshot_key)\n' +
          ')',
      );
    },
  },
  {
    id: '0201_declaration_snapshot_rows',
    apply(database) {
      database.exec(
        'CREATE TABLE IF NOT EXISTS declaration_snapshot_rows (\n' +
          '  snapshot_key TEXT NOT NULL,\n' +
          '  sort_order INTEGER NOT NULL,\n' +
          '  declaration_key TEXT NOT NULL DEFAULT \'\',\n' +
          '  so_tk TEXT NOT NULL DEFAULT \'\',\n' +
          '  so_tk_full TEXT NOT NULL DEFAULT \'\',\n' +
          '  branch TEXT NOT NULL DEFAULT \'\',\n' +
          '  mst TEXT NOT NULL DEFAULT \'\',\n' +
          '  registered_at TEXT NOT NULL DEFAULT \'\',\n' +
          '  company TEXT NOT NULL DEFAULT \'\',\n' +
          '  status TEXT NOT NULL DEFAULT \'\',\n' +
          '  staff_name TEXT NOT NULL DEFAULT \'\',\n' +
          '  team_name TEXT NOT NULL DEFAULT \'\',\n' +
          '  deleted_at TEXT NOT NULL DEFAULT \'\',\n' +
          '  co_count INTEGER NOT NULL DEFAULT 0,\n' +
          '  duplicate_prefix TEXT NOT NULL DEFAULT \'\',\n' +
          '  agency_search TEXT NOT NULL DEFAULT \'\',\n' +
          '  payload TEXT NOT NULL,\n' +
          '  PRIMARY KEY(snapshot_key, sort_order)\n' +
          ')',
      );
    },
  },
  {
    id: '0202_declaration_snapshot_backfill',
    apply(database) {
      ensureTableColumn(database, 'declaration_snapshot_rows', 'company', "TEXT NOT NULL DEFAULT ''");
      ensureTableColumn(database, 'declaration_snapshot_rows', 'status', "TEXT NOT NULL DEFAULT ''");
      ensureTableColumn(database, 'declaration_snapshot_rows', 'staff_name', "TEXT NOT NULL DEFAULT ''");
      ensureTableColumn(database, 'declaration_snapshot_rows', 'team_name', "TEXT NOT NULL DEFAULT ''");
      ensureTableColumn(database, 'declaration_snapshot_rows', 'deleted_at', "TEXT NOT NULL DEFAULT ''");
      ensureTableColumn(database, 'declaration_snapshot_rows', 'co_count', 'INTEGER NOT NULL DEFAULT 0');
      ensureTableColumn(database, 'declaration_snapshot_rows', 'duplicate_prefix', "TEXT NOT NULL DEFAULT ''");
      ensureTableColumn(database, 'declaration_snapshot_rows', 'agency_search', "TEXT NOT NULL DEFAULT ''");
      database.exec(
        'CREATE INDEX IF NOT EXISTS idx_declaration_snapshot_rows_snapshot_key_sort_order ON declaration_snapshot_rows(snapshot_key, sort_order)',
      );
      database.exec(
        'CREATE INDEX IF NOT EXISTS idx_declaration_snapshot_rows_snapshot_key_status ON declaration_snapshot_rows(snapshot_key, status)',
      );
      database.exec(
        'CREATE INDEX IF NOT EXISTS idx_declaration_snapshot_rows_snapshot_key_mst ON declaration_snapshot_rows(snapshot_key, mst)',
      );
      database.exec(
        'CREATE INDEX IF NOT EXISTS idx_declaration_snapshot_rows_snapshot_key_registered_at ON declaration_snapshot_rows(snapshot_key, registered_at)',
      );
      database.exec(
        'CREATE INDEX IF NOT EXISTS idx_declaration_snapshot_rows_snapshot_key_duplicate_prefix ON declaration_snapshot_rows(snapshot_key, duplicate_prefix)',
      );
    },
  },
  {
    id: '0203_mst_assignment_snapshot_rows',
    apply(database) {
      database.exec(
        'CREATE TABLE IF NOT EXISTS mst_assignment_snapshot_rows (\n' +
          '  snapshot_key TEXT NOT NULL,\n' +
          '  sort_order INTEGER NOT NULL,\n' +
          '  mst TEXT NOT NULL DEFAULT \'\',\n' +
          '  company TEXT NOT NULL DEFAULT \'\',\n' +
          '  person_import TEXT NOT NULL DEFAULT \'\',\n' +
          '  person_export TEXT NOT NULL DEFAULT \'\',\n' +
          '  team TEXT NOT NULL DEFAULT \'\',\n' +
          '  effective_from TEXT NOT NULL DEFAULT \'\',\n' +
          '  effective_to TEXT NOT NULL DEFAULT \'\',\n' +
          '  payload TEXT NOT NULL,\n' +
          '  PRIMARY KEY(snapshot_key, sort_order)\n' +
          ')',
      );
      database.exec(
        'CREATE INDEX IF NOT EXISTS idx_mst_assignment_snapshot_rows_snapshot_key_sort_order ON mst_assignment_snapshot_rows(snapshot_key, sort_order)',
      );
    },
  },
  {
    id: '0204_adjustment_snapshot_rows',
    apply(database) {
      database.exec(
        'CREATE TABLE IF NOT EXISTS adjustment_snapshot_rows (\n' +
          '  snapshot_key TEXT NOT NULL,\n' +
          '  sort_order INTEGER NOT NULL,\n' +
          '  adjustment_id TEXT NOT NULL DEFAULT \'\',\n' +
          '  month TEXT NOT NULL DEFAULT \'\',\n' +
          '  category TEXT NOT NULL DEFAULT \'\',\n' +
          '  staff_name TEXT NOT NULL DEFAULT \'\',\n' +
          '  team_name TEXT NOT NULL DEFAULT \'\',\n' +
          '  status TEXT NOT NULL DEFAULT \'\',\n' +
          '  total_points REAL NOT NULL DEFAULT 0,\n' +
          '  payload TEXT NOT NULL,\n' +
          '  PRIMARY KEY(snapshot_key, sort_order)\n' +
          ')',
      );
      database.exec(
        'CREATE INDEX IF NOT EXISTS idx_adjustment_snapshot_rows_snapshot_key_sort_order ON adjustment_snapshot_rows(snapshot_key, sort_order)',
      );
    },
  },
];

const TEAM_ROSTER_MIGRATIONS = [
  {
    id: '0300_team_roster_state',
    apply(database) {
      database.exec(
        'CREATE TABLE IF NOT EXISTS team_roster_state (\n' +
          '  snapshot_key TEXT PRIMARY KEY,\n' +
          '  version INTEGER NOT NULL DEFAULT 1,\n' +
          '  team_count INTEGER NOT NULL DEFAULT 0,\n' +
          '  member_count INTEGER NOT NULL DEFAULT 0,\n' +
          '  updated_at TEXT NOT NULL\n' +
          ')',
      );
    },
  },
  {
    id: '0301_teams',
    apply(database) {
      database.exec(
        'CREATE TABLE IF NOT EXISTS teams (\n' +
          '  id TEXT PRIMARY KEY,\n' +
          '  snapshot_key TEXT NOT NULL,\n' +
          '  legacy_team_id TEXT NOT NULL DEFAULT \'\',\n' +
          '  name TEXT NOT NULL DEFAULT \'\',\n' +
          '  sort_order INTEGER NOT NULL DEFAULT 0,\n' +
          '  active INTEGER NOT NULL DEFAULT 1,\n' +
          '  updated_at TEXT NOT NULL\n' +
          ')',
      );
      database.exec(
        'CREATE INDEX IF NOT EXISTS idx_teams_snapshot_key_sort_order ON teams(snapshot_key, sort_order)',
      );
    },
  },
  {
    id: '0302_team_members',
    apply(database) {
      database.exec(
        'CREATE TABLE IF NOT EXISTS team_members (\n' +
          '  id TEXT PRIMARY KEY,\n' +
          '  team_id TEXT NOT NULL,\n' +
          '  snapshot_key TEXT NOT NULL,\n' +
          '  legacy_member_id TEXT NOT NULL DEFAULT \'\',\n' +
          '  full_name TEXT NOT NULL DEFAULT \'\',\n' +
          '  notes TEXT NOT NULL DEFAULT \'\',\n' +
          '  sort_order INTEGER NOT NULL DEFAULT 0,\n' +
          '  active INTEGER NOT NULL DEFAULT 1,\n' +
          '  updated_at TEXT NOT NULL,\n' +
          '  FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE\n' +
          ')',
      );
      database.exec(
        'CREATE INDEX IF NOT EXISTS idx_team_members_team_id_sort_order ON team_members(team_id, sort_order)',
      );
      database.exec(
        'CREATE INDEX IF NOT EXISTS idx_team_members_snapshot_key_sort_order ON team_members(snapshot_key, sort_order)',
      );
    },
  },
];

export function ensureSqliteKvStore(database) {
  runSqliteMigrations(database, KV_STORE_MIGRATIONS);
}

export function ensureSqliteAuthTables(database) {
  runSqliteMigrations(database, [...KV_STORE_MIGRATIONS, ...AUTH_MIGRATIONS]);
}

export function ensureSqliteExportAuditTables(database) {
  runSqliteMigrations(database, [...KV_STORE_MIGRATIONS, ...EXPORT_AUDIT_MIGRATIONS]);
}

export function ensureSqliteReportingProjectionTables(database) {
  runSqliteMigrations(database, REPORTING_PROJECTION_MIGRATIONS);
}

export function ensureSqliteBusinessSnapshotTables(database) {
  runSqliteMigrations(database, BUSINESS_SNAPSHOT_MIGRATIONS);
}

export function ensureSqliteTeamRosterTables(database) {
  runSqliteMigrations(database, TEAM_ROSTER_MIGRATIONS);
}

export function readAppliedSqliteMigrations(database) {
  if (!database || typeof database.prepare !== 'function') {
    return [];
  }

  ensureSqliteMigrationTable(database);
  return database
    .prepare(
      `SELECT id, applied_at
       FROM ${SQLITE_MIGRATION_TABLE}
       ORDER BY id ASC`,
    )
    .all();
}

function runSqliteMigrations(database, migrations) {
  if (!database || typeof database.exec !== 'function' || typeof database.prepare !== 'function') {
    return;
  }

  ensureSqliteMigrationTable(database);
  const pending = migrations.filter((migration) => !hasAppliedMigration(database, migration.id));
  if (pending.length === 0) {
    return;
  }

  const applyPending =
    typeof database.transaction === 'function'
      ? database.transaction(() => {
          for (const migration of pending) {
            migration.apply(database);
            recordAppliedMigration(database, migration.id);
          }
        })
      : () => {
          for (const migration of pending) {
            migration.apply(database);
            recordAppliedMigration(database, migration.id);
          }
        };

  applyPending();
}

function ensureSqliteMigrationTable(database) {
  database.exec(
    `CREATE TABLE IF NOT EXISTS ${SQLITE_MIGRATION_TABLE} (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )`,
  );
}

function hasAppliedMigration(database, id) {
  const row = database
    .prepare(`SELECT 1 FROM ${SQLITE_MIGRATION_TABLE} WHERE id = ?`)
    .get(id);
  return Boolean(row);
}

function recordAppliedMigration(database, id) {
  database
    .prepare(
      `INSERT INTO ${SQLITE_MIGRATION_TABLE} (id, applied_at)
       VALUES (?, ?)
       ON CONFLICT(id) DO NOTHING`,
    )
    .run(id, new Date().toISOString());
}

function ensureTableColumn(database, tableName, columnName, columnDefinition) {
  if (hasTableColumn(database, tableName, columnName)) {
    return;
  }

  database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
}

function hasTableColumn(database, tableName, columnName) {
  try {
    const columns = database.prepare(`PRAGMA table_info(${tableName})`).all();
    return Array.isArray(columns) && columns.some((column) => normalizeText(column?.name) === columnName);
  } catch {
    return false;
  }
}

function normalizeText(value) {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}
