import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_MONTHLY_REPORTING_AGGREGATE_KEY,
  MONTHLY_REPORTING_AGGREGATE_KEY,
  REPORT_SCHEDULE_STORAGE_KEY,
} from '@kpi/backend-shared/persistence';
import { createRuntimeStorageLifecycle } from '@kpi/backend-shared/reporting';

function seedKv(database, entries) {
  const stmt = database.prepare(
    'INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  for (const [key, value] of Object.entries(entries)) {
    stmt.run(key, value);
  }
}

function createHarness(database, overrides = {}) {
  const deps = {
    database,
    defaultStorage: {
      hq_history_v1: '[]',
      kpi_users_v1: '[]',
    },
    aiChatHistoryPrefix: 'kpi_ai_history_',
    listAccountsForClient: () => [{ username: 'fresh-user' }],
    normalizeDeclRows: vi.fn((rows) => ({
      normalizedRows: (Array.isArray(rows) ? rows : []).map((row) => ({
        ...row,
        normalized: true,
      })),
    })),
    safeParse: (value, fallback) => {
      try {
        return JSON.parse(value);
      } catch {
        return fallback;
      }
    },
    scheduleMstHistorySyncFromJson: vi.fn(),
    writeTeamRosterSnapshot: vi.fn(),
    deleteTeamRosterSnapshot: vi.fn(),
    writeDeclarationRowsSnapshot: vi.fn(),
    deleteDeclarationRowsSnapshot: vi.fn(),
    writeMstAssignmentRowsSnapshot: vi.fn(),
    deleteMstAssignmentRowsSnapshot: vi.fn(),
    writeRuleCollectionSnapshot: vi.fn(),
    persistRulesSnapshot: vi.fn(),
    loadRulesSnapshot: vi.fn(() => ({ rules: [{ id: 'old-rules' }] })),
    writeAdjustmentRowsSnapshot: vi.fn(),
    deleteAdjustmentRowsSnapshot: vi.fn(),
    writeProjectionValue: vi.fn(),
    refreshReportingAggregate: vi.fn(),
    getRulesSeed: vi.fn((rules) => rules),
    defaultRules: [{ id: 'default-rules' }],
    logger: {
      warn: vi.fn(),
    },
    ...overrides,
  };

  return {
    deps,
    lifecycle: createRuntimeStorageLifecycle(deps),
  };
}

describe('runtimeStorageLifecycle', () => {
  let database;

  beforeEach(() => {
    database = new Database(':memory:');
    database.exec('CREATE TABLE kv_store (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  });

  afterEach(() => {
    database?.close();
  });

  it('fans out declaration storage writes and deletes through typed snapshots', () => {
    const { lifecycle, deps } = createHarness(database);
    const rows = [{ so_tk: '1029384756', nhanh: 'Blue' }];

    lifecycle.upsertValue('decl_rows_v1', JSON.stringify(rows), {
      actor: 'alice',
      source: 'api',
    });

    expect(database.prepare('SELECT value FROM kv_store WHERE key = ?').get('decl_rows_v1')?.value).toBe(
      JSON.stringify(rows)
    );
    expect(deps.normalizeDeclRows).toHaveBeenCalledWith(rows);
    expect(deps.writeDeclarationRowsSnapshot).toHaveBeenCalledWith(
      database,
      [{ so_tk: '1029384756', nhanh: 'Blue', normalized: true }],
      expect.objectContaining({
        updatedAt: expect.any(String),
      })
    );
    expect(deps.refreshReportingAggregate).toHaveBeenCalledWith('decl_rows_v1', {
      actor: 'alice',
      source: 'api',
    });

    lifecycle.deleteValue('decl_rows_v1', {
      actor: 'alice',
      source: 'api-delete',
    });

    expect(database.prepare('SELECT value FROM kv_store WHERE key = ?').get('decl_rows_v1')).toBeUndefined();
    expect(deps.deleteDeclarationRowsSnapshot).toHaveBeenCalledWith(database);
    expect(deps.refreshReportingAggregate).toHaveBeenLastCalledWith('decl_rows_v1', {
      actor: 'alice',
      source: 'api-delete',
    });
  });

  it('restores default KPI rules when the rules storage key is deleted', () => {
    const defaultRules = [{ id: 'default-rules', name: 'Default Rules' }];
    const { lifecycle, deps } = createHarness(database, {
      defaultRules,
      getRulesSeed: vi.fn(() => defaultRules),
    });

    lifecycle.deleteValue('kpi_rules_v2', {
      actor: 'ops-admin',
      source: 'api-delete',
    });

    expect(deps.getRulesSeed).toHaveBeenCalledWith(defaultRules);
    expect(deps.persistRulesSnapshot).toHaveBeenCalledWith(JSON.stringify(defaultRules), {
      actor: 'ops-admin',
      source: 'api-delete',
    });
    expect(deps.writeRuleCollectionSnapshot).toHaveBeenCalledWith(
      database,
      defaultRules,
      expect.objectContaining({
        updatedAt: expect.any(String),
      })
    );
    expect(deps.refreshReportingAggregate).toHaveBeenCalledWith('kpi_rules_v2', {
      actor: 'ops-admin',
      source: 'api-delete',
    });
  });

  it('hydrates typed snapshots and reporting projections from kv_store bootstrap data', () => {
    seedKv(database, {
      decl_rows_v1: JSON.stringify([{ id: 'decl-1' }]),
      mst_rows_v2: JSON.stringify([{ id: 'mst-1' }]),
      team_roster_v1: JSON.stringify({ version: 1, teams: [{ id: 'team-1' }] }),
      kpi_rules_v2: JSON.stringify([{ id: 'rules-new' }]),
      kpi_adjustments_v1: JSON.stringify([{ id: 'adj-1' }]),
      [REPORT_SCHEDULE_STORAGE_KEY]: JSON.stringify([{ id: 'schedule-1' }]),
      [MONTHLY_REPORTING_AGGREGATE_KEY]: JSON.stringify({ generatedAt: '2026-03-13T08:30:00.000Z' }),
      [DEFAULT_MONTHLY_REPORTING_AGGREGATE_KEY]: JSON.stringify({ generatedAt: '2026-03-13T07:15:00.000Z' }),
    });
    const { lifecycle, deps } = createHarness(database, {
      loadRulesSnapshot: vi.fn(() => ({ rules: [{ id: 'rules-old' }] })),
    });

    lifecycle.hydrateSqliteSnapshots({
      seeded: true,
      updatedAt: '2026-03-13T09:00:00.000Z',
    });

    expect(deps.writeDeclarationRowsSnapshot).toHaveBeenCalledWith(
      database,
      [{ id: 'decl-1', normalized: true }],
      { updatedAt: '2026-03-13T09:00:00.000Z' }
    );
    expect(deps.writeMstAssignmentRowsSnapshot).toHaveBeenCalledWith(
      database,
      [{ id: 'mst-1' }],
      { updatedAt: '2026-03-13T09:00:00.000Z' }
    );
    expect(deps.writeTeamRosterSnapshot).toHaveBeenCalledWith(
      database,
      { version: 1, teams: [{ id: 'team-1' }] },
      { updatedAt: '2026-03-13T09:00:00.000Z' }
    );
    expect(deps.writeAdjustmentRowsSnapshot).toHaveBeenCalledWith(
      database,
      [{ id: 'adj-1' }],
      { updatedAt: '2026-03-13T09:00:00.000Z' }
    );
    expect(deps.writeRuleCollectionSnapshot).toHaveBeenCalledWith(
      database,
      [{ id: 'rules-new' }],
      { updatedAt: '2026-03-13T09:00:00.000Z' }
    );
    expect(deps.persistRulesSnapshot).toHaveBeenCalledWith(JSON.stringify([{ id: 'rules-new' }]), {
      actor: 'system',
      source: 'bootstrap-seed',
    });
    expect(deps.writeProjectionValue).toHaveBeenNthCalledWith(
      1,
      database,
      REPORT_SCHEDULE_STORAGE_KEY,
      [{ id: 'schedule-1' }],
      {
        updatedAt: '2026-03-13T09:00:00.000Z',
        source: 'bootstrap-seed',
      }
    );
    expect(deps.writeProjectionValue).toHaveBeenNthCalledWith(
      2,
      database,
      MONTHLY_REPORTING_AGGREGATE_KEY,
      { generatedAt: '2026-03-13T08:30:00.000Z' },
      {
        updatedAt: '2026-03-13T09:00:00.000Z',
        source: 'bootstrap-seed',
      }
    );
    expect(deps.writeProjectionValue).toHaveBeenNthCalledWith(
      3,
      database,
      DEFAULT_MONTHLY_REPORTING_AGGREGATE_KEY,
      { generatedAt: '2026-03-13T07:15:00.000Z' },
      {
        updatedAt: '2026-03-13T09:00:00.000Z',
        source: 'bootstrap-seed',
      }
    );
  });

  it('builds bootstrap snapshots without AI chat history rows and rewrites account storage', () => {
    seedKv(database, {
      hq_history_v1: JSON.stringify([{ mst: '0101234567' }]),
      [`kpi_ai_history_admin`]: JSON.stringify({ messages: [{ id: 'm-1' }] }),
      kpi_users_v1: JSON.stringify([{ username: 'legacy-user' }]),
    });
    const { lifecycle } = createHarness(database, {
      listAccountsForClient: () => [{ username: 'fresh-admin', role: 'admin' }],
    });

    const snapshot = lifecycle.buildBootstrapSnapshot();

    expect(snapshot).toMatchObject({
      hq_history_v1: JSON.stringify([{ mst: '0101234567' }]),
      kpi_users_v1: JSON.stringify([{ username: 'fresh-admin', role: 'admin' }]),
    });
    expect(snapshot).not.toHaveProperty('kpi_ai_history_admin');
  });

  it('limits bootstrap snapshots to requested keys when building a light payload', () => {
    seedKv(database, {
      hq_history_v1: JSON.stringify([{ mst: '0101234567' }]),
      decl_rows_v1: JSON.stringify([{ so_tk: 'DECL-001' }]),
      [`kpi_ai_history_admin`]: JSON.stringify({ messages: [{ id: 'm-1' }] }),
      kpi_users_v1: JSON.stringify([{ username: 'legacy-user' }]),
    });
    const { lifecycle } = createHarness(database, {
      listAccountsForClient: () => [{ username: 'fresh-admin', role: 'admin' }],
    });

    const snapshot = lifecycle.buildBootstrapSnapshot({
      keys: ['hq_history_v1', 'kpi_users_v1'],
    });

    expect(snapshot).toEqual({
      hq_history_v1: JSON.stringify([{ mst: '0101234567' }]),
      kpi_users_v1: JSON.stringify([{ username: 'fresh-admin', role: 'admin' }]),
    });
  });
});
