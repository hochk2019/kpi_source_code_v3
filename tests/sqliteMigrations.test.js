/* eslint-env node */
/* @vitest-environment node */

import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import {
  SQLITE_MIGRATION_TABLE,
  ensureSqliteAuthTables,
  ensureSqliteBusinessSnapshotTables,
  ensureSqliteExportAuditTables,
  ensureSqliteKvStore,
  ensureSqliteTeamRosterTables,
  readAppliedSqliteMigrations,
} from '../server/sqliteMigrations.js';

describe('sqliteMigrations', () => {
  it('records applied migration ids for core and typed snapshot targets', () => {
    const db = new Database(':memory:');

    try {
      ensureSqliteKvStore(db);
      ensureSqliteAuthTables(db);
      ensureSqliteExportAuditTables(db);
      ensureSqliteBusinessSnapshotTables(db);
      ensureSqliteTeamRosterTables(db);

      const migrationTable = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
        .get(SQLITE_MIGRATION_TABLE);

      expect(migrationTable).toEqual({ name: SQLITE_MIGRATION_TABLE });
      expect(readAppliedSqliteMigrations(db).map((entry) => entry.id)).toEqual(
        expect.arrayContaining([
          '0001_kv_store',
          '0002_auth_sessions',
          '0003_export_audit',
          '0004_export_audit_access',
          '0200_business_snapshot_state',
          '0201_declaration_snapshot_rows',
          '0300_team_roster_state',
          '0301_teams',
          '0302_team_members',
        ]),
      );
    } finally {
      db.close();
    }
  });

  it('backfills declaration snapshot columns on legacy tables before marking migrations as applied', () => {
    const db = new Database(':memory:');

    try {
      db.exec(
        'CREATE TABLE declaration_snapshot_rows (\n' +
          '  snapshot_key TEXT NOT NULL,\n' +
          '  sort_order INTEGER NOT NULL,\n' +
          '  declaration_key TEXT NOT NULL DEFAULT \'\',\n' +
          '  so_tk TEXT NOT NULL DEFAULT \'\',\n' +
          '  so_tk_full TEXT NOT NULL DEFAULT \'\',\n' +
          '  branch TEXT NOT NULL DEFAULT \'\',\n' +
          '  mst TEXT NOT NULL DEFAULT \'\',\n' +
          '  registered_at TEXT NOT NULL DEFAULT \'\',\n' +
          '  payload TEXT NOT NULL,\n' +
          '  PRIMARY KEY(snapshot_key, sort_order)\n' +
          ')',
      );

      expect(() => ensureSqliteBusinessSnapshotTables(db)).not.toThrow();

      const columns = db.prepare('PRAGMA table_info(declaration_snapshot_rows)').all();
      expect(columns.some((column) => column?.name === 'company')).toBe(true);
      expect(columns.some((column) => column?.name === 'status')).toBe(true);
      expect(columns.some((column) => column?.name === 'agency_search')).toBe(true);
      expect(readAppliedSqliteMigrations(db).map((entry) => entry.id)).toContain(
        '0202_declaration_snapshot_backfill',
      );
    } finally {
      db.close();
    }
  });
});
