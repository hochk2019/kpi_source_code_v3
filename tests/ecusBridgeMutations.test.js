import { describe, expect, it, vi } from 'vitest';

import { createEcusBridgeMutations } from '@kpi/backend-shared/ecus';

function createMutations(overrides = {}) {
  const state = {
    declRows: [
      { so_tk: 'TK001', date: '2026-03-01', reviewed: true, mst: '0312345678', team: 'Ops' },
      { so_tk: 'TK002', date: '2026-03-01', reviewed: false, mst: '0399999999', team: 'Sales' },
    ],
    writes: [],
    savedConfig: [],
    auditLogs: [],
    importLogs: [],
    notifications: [],
  };

  const mutations = createEcusBridgeMutations({
    getEcusConfig: () => ({
      includeTaxCodes: [],
      excludeTaxCodes: [],
      rangeDays: 2,
    }),
    computeRangeWindow: (_config, explicit) => ({
      from: explicit?.from || '2026-03-01',
      to: explicit?.to || '2026-03-02',
    }),
    normalizeEcusTaxCodeList: (list) => (Array.isArray(list) ? list.map((value) => `${value}`.trim()).filter(Boolean) : []),
    buildEcusSyncContext: () => ({ source: 'test-context' }),
    shouldSkipByMst: (row, includeSet, excludeSet) => {
      const mst = row?.mst || '';
      if (includeSet.size > 0 && !includeSet.has(mst)) {
        return true;
      }
      if (excludeSet.size > 0 && excludeSet.has(mst)) {
        return true;
      }
      return false;
    },
    mapEcusRow: (raw) => raw && {
      so_tk: raw.so_tk,
      date: raw.date,
      mst: raw.mst,
      team: raw.team || '',
    },
    getDeclRows: () => state.declRows.slice(),
    getDeclarationKey: (row) => `${row.so_tk}_${row.date}`,
    mergeDeclarationRow: (existing, incoming) => {
      if (existing?.reviewed) {
        return { row: existing, changed: false, changedFields: [], locked: true };
      }
      const changed = existing.team !== incoming.team;
      return { row: { ...existing, ...incoming }, changed, changedFields: changed ? ['team'] : [] };
    },
    writeDeclRows: vi.fn((rows) => {
      state.writes.push(rows);
      state.declRows = rows.slice();
      return rows;
    }),
    ensureMSTEntriesForDeclRows: vi.fn(() => ({ total: 1 })),
    pushAuditLog: vi.fn((entry) => state.auditLogs.push(entry)),
    evaluateDeclarationAlerts: vi.fn(() => ({ duplicates: 0 })),
    pushImportLog: vi.fn((entry) => state.importLogs.push(entry)),
    saveEcusConfig: vi.fn((patch) => {
      state.savedConfig.push(patch);
      return { ...patch };
    }),
    pushNotification: vi.fn((entry) => state.notifications.push(entry)),
    recordEcusMonitorSyncSuccess: vi.fn(),
    recordEcusMonitorSyncFailure: vi.fn(),
    normalizeStr: (value) => `${value ?? ''}`.trim(),
    ...overrides,
  });

  return { mutations, state };
}

describe('ecus bridge mutations', () => {
  it('builds preview status from raw bridge rows without touching SQL', async () => {
    const { mutations } = createMutations();

    const preview = await mutations.previewFetchedRows(
      [
        { so_tk: 'TK001', date: '2026-03-01', mst: '0312345678', team: 'Ops' },
        { so_tk: 'TK003', date: '2026-03-01', mst: '0100000001', team: 'Blue' },
      ],
      {
        rangeInput: { from: '2026-03-01', to: '2026-03-02' },
        limit: 10,
      }
    );

    expect(preview).toEqual(
      expect.objectContaining({
        totalFetched: 2,
        limited: false,
        range: { from: '2026-03-01', to: '2026-03-02' },
      })
    );
    expect(preview.rows).toEqual([
      expect.objectContaining({ so_tk: 'TK001', status: 'existing', locked: true }),
      expect.objectContaining({ so_tk: 'TK003', status: 'new', locked: false }),
    ]);
  });

  it('commits raw bridge rows into declaration storage and logs a completed sync summary', async () => {
    const { mutations, state } = createMutations();

    const result = await mutations.commitFetchedRows(
      [
        { so_tk: 'TK002', date: '2026-03-01', mst: '0399999999', team: 'Green' },
        { so_tk: 'TK004', date: '2026-03-01', mst: '0100000004', team: 'Blue' },
      ],
      {
        actor: 'bridge-service',
        reason: 'scheduled',
        fetchedTotal: 2,
        rangeInput: { from: '2026-03-01', to: '2026-03-02' },
      }
    );

    expect(state.writes).toHaveLength(1);
    expect(state.savedConfig).toHaveLength(1);
    expect(state.importLogs).toHaveLength(1);
    expect(state.notifications).toHaveLength(1);
    expect(result).toEqual(
      expect.objectContaining({
        fetched: 2,
        imported: 1,
        updated: 1,
        skipped: 0,
        reviewLocked: 0,
      })
    );
  });
});
