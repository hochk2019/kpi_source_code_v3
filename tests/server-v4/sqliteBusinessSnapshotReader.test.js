import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import {
  writeAdjustmentRowsSnapshot,
  writeDeclarationRowsSnapshot,
  writeMstAssignmentRowsSnapshot,
  writeRuleCollectionSnapshot,
} from '../../server/businessSnapshotSqlite.js';
import { writeReportingProjectionValue } from '../../server/reportingProjectionSqlite.js';
import { replaceCanonicalSqliteDeclarationRows } from '../../server-v4/src/modules/declarations/sqliteDeclarationRowsTable.ts';
import { writeTeamRosterSnapshot } from '../../server/teamRosterSqlite.js';
import { LEGACY_BUSINESS_HOT_PATH_KEYS } from '../../server-v4/src/persistence/businessSnapshotReader.ts';
import { SqliteBusinessSnapshotReader } from '../../server-v4/src/persistence/sqliteBusinessSnapshotReader.ts';

const tempFiles = [];

function createRuntimeDb(seed = {}, { materializeTyped = true } = {}) {
  const dbFile = path.join(
    os.tmpdir(),
    `server-v4-business-snapshot-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.sqlite`,
  );
  const db = new Database(dbFile);
  db.exec('CREATE TABLE kv_store (key TEXT PRIMARY KEY, value TEXT NOT NULL)');

  const insert = db.prepare('INSERT INTO kv_store (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(seed)) {
    insert.run(key, JSON.stringify(value));
  }

  if (materializeTyped) {
    materializeTypedBusinessSnapshots(db, seed);
  }

  db.close();
  tempFiles.push(dbFile);
  return dbFile;
}

function materializeTypedBusinessSnapshots(db, seed = {}) {
  if (Object.prototype.hasOwnProperty.call(seed, 'decl_rows_v1')) {
    writeDeclarationRowsSnapshot(db, Array.isArray(seed.decl_rows_v1) ? seed.decl_rows_v1 : []);
  }
  if (Object.prototype.hasOwnProperty.call(seed, 'mst_rows_v2')) {
    writeMstAssignmentRowsSnapshot(db, Array.isArray(seed.mst_rows_v2) ? seed.mst_rows_v2 : []);
  }
  if (Object.prototype.hasOwnProperty.call(seed, 'team_roster_v1')) {
    const roster =
      seed.team_roster_v1 && typeof seed.team_roster_v1 === 'object'
        ? seed.team_roster_v1
        : { version: 1, teams: [] };
    writeTeamRosterSnapshot(db, roster);
  }
  if (Object.prototype.hasOwnProperty.call(seed, 'kpi_rules_v2')) {
    const rules =
      seed.kpi_rules_v2 && typeof seed.kpi_rules_v2 === 'object'
        ? seed.kpi_rules_v2
        : { version: 2, activeId: 'default', sets: [] };
    writeRuleCollectionSnapshot(db, rules);
  }
  if (Object.prototype.hasOwnProperty.call(seed, 'kpi_adjustments_v1')) {
    writeAdjustmentRowsSnapshot(db, Array.isArray(seed.kpi_adjustments_v1) ? seed.kpi_adjustments_v1 : []);
  }
  if (Object.prototype.hasOwnProperty.call(seed, 'kpi_report_schedule_v1')) {
    writeReportingProjectionValue(
      db,
      'kpi_report_schedule_v1',
      Array.isArray(seed.kpi_report_schedule_v1) ? seed.kpi_report_schedule_v1 : [],
    );
  }
  if (Object.prototype.hasOwnProperty.call(seed, 'kpi_reporting_monthly_aggregates_v1')) {
    const snapshot =
      seed.kpi_reporting_monthly_aggregates_v1 &&
      typeof seed.kpi_reporting_monthly_aggregates_v1 === 'object' &&
      !Array.isArray(seed.kpi_reporting_monthly_aggregates_v1)
        ? seed.kpi_reporting_monthly_aggregates_v1
        : null;
    if (snapshot) {
      writeReportingProjectionValue(db, 'kpi_reporting_monthly_aggregates_v1', snapshot);
    }
  }
  if (Object.prototype.hasOwnProperty.call(seed, 'kpi_reporting_monthly_aggregates_default_v1')) {
    const snapshot =
      seed.kpi_reporting_monthly_aggregates_default_v1 &&
      typeof seed.kpi_reporting_monthly_aggregates_default_v1 === 'object' &&
      !Array.isArray(seed.kpi_reporting_monthly_aggregates_default_v1)
        ? seed.kpi_reporting_monthly_aggregates_default_v1
        : null;
    if (snapshot) {
      writeReportingProjectionValue(db, 'kpi_reporting_monthly_aggregates_default_v1', snapshot);
    }
  }
}

afterEach(() => {
  while (tempFiles.length) {
    const file = tempFiles.pop();
    if (file && fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }
});

describe('SqliteBusinessSnapshotReader', () => {
  it('exposes the hot-path inventory and runtime db file for current reads', () => {
    const dbFile = createRuntimeDb();
    const reader = new SqliteBusinessSnapshotReader(dbFile);

    expect(reader.getSourceKind()).toBe('dual-write');
    expect(reader.getHotPathKeys()).toEqual(LEGACY_BUSINESS_HOT_PATH_KEYS);
    expect(reader.getLegacyDbFile()).toBe(dbFile);
  });

  it('reads business hot-path payload groups from typed snapshots', () => {
    const dbFile = createRuntimeDb({
      decl_rows_v1: [{ so_tk: 'TK1' }],
      mst_rows_v2: [{ mst: '0101234567' }],
      team_roster_v1: { version: 1, teams: [{ name: 'Blue Team', members: [{ name: 'Lan' }] }] },
      kpi_rules_v2: { id: 'legacy-kpi', groups: {} },
      kpi_adjustments_v1: [{ id: 'adj-1' }],
      kpi_report_schedule_v1: [{ id: 'weekly-blue' }],
      kpi_reporting_monthly_aggregates_v1: {
        generatedAt: '2026-03-09T09:00:00.000Z',
        total: 1,
        cache: { queryKey: '{"from":"2026-02-01","to":"2026-02-28","limit":0}', reused: false },
      },
      kpi_reporting_monthly_aggregates_default_v1: {
        generatedAt: '2026-03-10T09:00:00.000Z',
        total: 1,
      },
    });
    const reader = new SqliteBusinessSnapshotReader(dbFile);

    expect(reader.readDeclarationRows()).toEqual([{ so_tk: 'TK1' }]);
    expect(reader.readMstAssignmentRows()).toEqual([{ mst: '0101234567' }]);
    expect(reader.readTeamRoster()).toEqual({
      version: 1,
      teams: [{ name: 'Blue Team', members: [{ name: 'Lan' }] }],
    });
    expect(reader.readRuleCollection()).toEqual({
      version: 2,
      activeId: 'legacy-kpi',
      sets: [{ id: 'legacy-kpi', groups: {} }],
      id: 'legacy-kpi',
      groups: {},
    });
    expect(reader.readAdjustmentRows()).toEqual([{ id: 'adj-1' }]);
    expect(reader.readReportSchedules()).toEqual([{ id: 'weekly-blue' }]);
    expect(reader.readMonthlyAggregateSnapshot()).toEqual({
      generatedAt: '2026-03-09T09:00:00.000Z',
      total: 1,
      cache: { queryKey: '{"from":"2026-02-01","to":"2026-02-28","limit":0}', reused: false },
    });
    expect(reader.readDefaultMonthlyAggregateSnapshot()).toEqual({
      generatedAt: '2026-03-10T09:00:00.000Z',
      total: 1,
    });
  });

  it('does not fall back to kv_store business blobs when typed snapshots are missing', () => {
    const dbFile = createRuntimeDb(
      {
        decl_rows_v1: [{ so_tk: 'BLOB-TK' }],
        mst_rows_v2: [{ mst: '0999999999' }],
        team_roster_v1: { version: 1, teams: [{ name: 'Blob Team' }] },
        kpi_rules_v2: { id: 'blob-kpi', groups: {} },
        kpi_adjustments_v1: [{ id: 'adj-blob' }],
        kpi_report_schedule_v1: [{ id: 'blob-schedule' }],
        kpi_reporting_monthly_aggregates_v1: { generatedAt: '2026-03-11T09:00:00.000Z' },
        kpi_reporting_monthly_aggregates_default_v1: { generatedAt: '2026-03-12T09:00:00.000Z' },
      },
      { materializeTyped: false },
    );
    const reader = new SqliteBusinessSnapshotReader(dbFile);

    expect(reader.readDeclarationRows()).toEqual([]);
    expect(reader.readMstAssignmentRows()).toEqual([]);
    expect(reader.readTeamRoster()).toEqual({});
    expect(reader.readRuleCollection()).toEqual({});
    expect(reader.readAdjustmentRows()).toEqual([]);
    expect(reader.readReportSchedules()).toEqual([]);
    expect(reader.readMonthlyAggregateSnapshot()).toBeNull();
    expect(reader.readDefaultMonthlyAggregateSnapshot()).toBeNull();
  });

  it('prefers typed teams snapshot when it has already been materialized', () => {
    const dbFile = createRuntimeDb({
      team_roster_v1: {
        version: 1,
        teams: [{ name: 'Stale Blob Team', members: [{ name: 'Blob User' }] }],
      },
    });
    const db = new Database(dbFile);
    writeTeamRosterSnapshot(db, {
      version: 1,
      teams: [{ name: 'Typed Blue Team', members: [{ name: 'Lan' }] }],
    });
    db.close();

    const reader = new SqliteBusinessSnapshotReader(dbFile);

    expect(reader.readTeamRoster()).toEqual({
      version: 1,
      teams: [{ name: 'Typed Blue Team', members: [{ name: 'Lan' }] }],
    });
  });

  it('prefers typed declarations, MST, rules, and adjustments snapshots when they are materialized already', () => {
    const dbFile = createRuntimeDb({
      decl_rows_v1: [{ so_tk: 'STALE-TK' }],
      mst_rows_v2: [{ mst: '0999999999', person_import: 'Blob User' }],
      kpi_rules_v2: { id: 'blob-kpi', groups: {} },
      kpi_adjustments_v1: [{ id: 'adj-blob', totalPoints: 0 }],
    });
    const db = new Database(dbFile);
    writeDeclarationRowsSnapshot(db, [{ so_tk: 'TYPED-TK', nhanh: 'Blue', mst: '0101234567', date: '2026-02-14' }]);
    writeMstAssignmentRowsSnapshot(db, [{ mst: '0101234567', person_import: 'Lan', team: 'Blue Team' }]);
    writeRuleCollectionSnapshot(db, {
      version: 2,
      activeId: 'typed-kpi',
      sets: [{ id: 'typed-kpi', name: 'Typed KPI', groups: {} }],
    });
    writeAdjustmentRowsSnapshot(db, [{ id: 'adj-typed', totalPoints: 2, status: 'approved' }]);
    db.close();

    const reader = new SqliteBusinessSnapshotReader(dbFile);

    expect(reader.readDeclarationRows()).toEqual([
      { so_tk: 'TYPED-TK', nhanh: 'Blue', mst: '0101234567', date: '2026-02-14' },
    ]);
    expect(reader.readMstAssignmentRows()).toEqual([{ mst: '0101234567', person_import: 'Lan', team: 'Blue Team' }]);
    expect(reader.readRuleCollection()).toEqual({
      version: 2,
      activeId: 'typed-kpi',
      sets: [{ id: 'typed-kpi', name: 'Typed KPI', groups: {} }],
    });
    expect(reader.readAdjustmentRows()).toEqual([{ id: 'adj-typed', totalPoints: 2, status: 'approved' }]);
  });

  it('prefers canonical declaration live rows when typed snapshot rows drift stale', () => {
    const dbFile = createRuntimeDb({
      decl_rows_v1: [{ so_tk: 'TYPED-TK', nhanh: 'Blue', mst: '0101111111', agency: 'Typed Agency' }],
    });
    const db = new Database(dbFile);
    replaceCanonicalSqliteDeclarationRows(db, [
      { so_tk: 'LIVE-TK', nhanh: 'Red', mst: '0102222222', agency: 'Live Agency' },
    ]);
    writeDeclarationRowsSnapshot(db, [
      { so_tk: 'TYPED-TK', nhanh: 'Blue', mst: '0101111111', agency: 'Typed Agency' },
    ]);
    db.close();

    const reader = new SqliteBusinessSnapshotReader(dbFile);

    expect(reader.readDeclarationRows()).toEqual([
      { so_tk: 'LIVE-TK', nhanh: 'Red', mst: '0102222222', agency: 'Live Agency' },
    ]);
  });

  it('can be marked as relational-store for future non-dual-write runtimes', () => {
    const dbFile = createRuntimeDb();
    const reader = new SqliteBusinessSnapshotReader(dbFile, { sourceKind: 'relational-store' });

    expect(reader.getSourceKind()).toBe('relational-store');
  });
});
