import { describe, expect, it, vi } from 'vitest';

import { createReportingAggregateRuntime } from '@kpi/backend-shared/reporting';

const ACTIVE_SNAPSHOT_KEY = 'kpi_reporting_monthly_aggregates_v1';
const DEFAULT_SNAPSHOT_KEY = 'kpi_reporting_monthly_aggregates_default_v1';

describe('createReportingAggregateRuntime', () => {
  it('prefers relational observability entries over snapshot payload fallbacks', () => {
    const activeSnapshot = createStoredSnapshot({
      generatedAt: '2026-03-13T09:00:00.000Z',
      query: { from: '2026-02-01', to: '2026-02-28' },
      total: 2,
      items: [{ period: 'fallback-active' }],
    });
    const defaultSnapshot = createStoredSnapshot({
      generatedAt: '2026-03-12T09:00:00.000Z',
      query: { from: '2026-01-01', to: '2026-02-28' },
      total: 3,
      items: [{ period: 'fallback-default' }],
    });
    const projectionStore = createProjectionStore({
      [ACTIVE_SNAPSHOT_KEY]: activeSnapshot,
      [DEFAULT_SNAPSHOT_KEY]: defaultSnapshot,
    });
    const buildMonthlyAggregateCollection = vi.fn((items, options = {}) => ({
      total: items.length,
      filteredTotal: items.length,
      search: options.search || '',
      page: options.page || 1,
      pageSize: options.pageSize || items.length || 1,
      pageCount: 1,
      items,
    }));
    const buildReportingJobRunCollection = vi.fn((items, options = {}) => ({
      total: items.length,
      filteredTotal: items.length,
      successCount: items.filter((entry) => entry.status === 'success').length,
      failureCount: items.filter((entry) => entry.status === 'error').length,
      lastSuccessAt: null,
      lastFailureAt: null,
      search: options.search || '',
      status: options.status || '',
      page: options.page || 1,
      pageSize: options.pageSize || items.length || 1,
      pageCount: 1,
      items,
    }));
    const runtime = createReportingAggregateRuntime({
      projectionStore,
      buildSourceSnapshot: () => createSourceSnapshot(),
      readRelationalMonthlyAggregateEntries: (snapshotKey) =>
        snapshotKey === ACTIVE_SNAPSHOT_KEY ? [{ period: 'relational-active' }] : [],
      readRelationalJobRuns: () => [{ id: 'job-1', status: 'success' }],
      buildMonthlyAggregateCollection,
      buildReportingJobRunCollection,
    });

    const payload = runtime.buildReportingObservabilityPayload({
      periodSearch: '02/2026',
      jobSearch: 'aggregate',
    });

    expect(buildMonthlyAggregateCollection).toHaveBeenNthCalledWith(
      1,
      [{ period: 'relational-active' }],
      expect.objectContaining({ search: '02/2026' }),
    );
    expect(buildMonthlyAggregateCollection).toHaveBeenNthCalledWith(
      2,
      [{ period: 'fallback-default' }],
      expect.objectContaining({ search: '02/2026' }),
    );
    expect(buildReportingJobRunCollection).toHaveBeenCalledWith(
      [{ id: 'job-1', status: 'success' }],
      expect.objectContaining({ search: 'aggregate' }),
    );
    expect(payload.aggregates.active).toEqual(
      expect.objectContaining({
        available: true,
        total: 2,
      }),
    );
  });

  it('refreshes active and default stored aggregates for reporting source mutations', async () => {
    const projectionStore = createProjectionStore({
      [ACTIVE_SNAPSHOT_KEY]: createStoredSnapshot({
        query: { from: '2026-02-01', to: '2026-02-28' },
        total: 1,
      }),
    });
    const buildMonthlyReportingAggregates = vi.fn(({ from, to, limit }) => ({
      generatedAt: '2026-03-13T10:00:00.000Z',
      range: { from, to },
      total: limit ? 1 : 2,
      cache: {
        queryKey: JSON.stringify({
          from: from || '',
          to: to || '',
          limit: Number.isFinite(limit) && limit > 0 ? Math.trunc(limit) : 0,
        }),
        reused: false,
      },
      items: [{ period: '2026-02' }],
    }));
    const runtime = createReportingAggregateRuntime({
      projectionStore,
      buildSourceSnapshot: () =>
        createSourceSnapshot({
          rows: [{ id: 'TK1', registerNo: '102026001', openDate: '2026-02-10' }],
        }),
      buildMonthlyReportingAggregates,
      buildDefaultMonthlyAggregateQuery: vi.fn(() => ({
        from: '2026-01-01',
        to: '2026-02-28',
      })),
      buildReportingJobRun: (entry) => entry,
    });

    await runtime.refreshMonthlyReportingAggregateSnapshot('kpi_adjustments_v1', {
      actor: 'alice',
      source: 'storage-update',
    });

    expect(buildMonthlyReportingAggregates).toHaveBeenCalledTimes(2);
    expect(projectionStore.writeMonthlyAggregateSnapshot).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        generatedAt: '2026-03-13T10:00:00.000Z',
      }),
      expect.objectContaining({
        actor: 'alice',
        source: 'storage-update',
        snapshotKey: ACTIVE_SNAPSHOT_KEY,
      }),
    );
    expect(projectionStore.writeMonthlyAggregateSnapshot).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        generatedAt: '2026-03-13T10:00:00.000Z',
      }),
      expect.objectContaining({
        actor: 'alice',
        source: 'storage-update',
        snapshotKey: DEFAULT_SNAPSHOT_KEY,
      }),
    );
    expect(projectionStore.appendJobRun).toHaveBeenCalledTimes(2);
    expect(projectionStore.appendJobRun).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        actor: 'alice',
        source: 'storage-update',
        snapshotKey: ACTIVE_SNAPSHOT_KEY,
        status: 'success',
      }),
      expect.objectContaining({ snapshotKey: 'kpi_reporting_job_runs_v1' }),
    );
    expect(projectionStore.appendJobRun).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        actor: 'alice',
        source: 'storage-update',
        snapshotKey: DEFAULT_SNAPSHOT_KEY,
        status: 'success',
      }),
      expect.objectContaining({ snapshotKey: 'kpi_reporting_job_runs_v1' }),
    );
    expect(projectionStore.writeMonthlyAggregateSnapshot.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        projectionState: expect.objectContaining({
          snapshotKey: ACTIVE_SNAPSHOT_KEY,
          refreshedBy: 'alice',
          refreshSource: 'storage-update',
          invalidatedByKey: 'kpi_adjustments_v1',
          freshnessKey: expect.any(String),
          owner: expect.objectContaining({
            ruleSetId: 'default',
          }),
        }),
      }),
    );
  });

  it('deletes stale stored aggregates when refresh cannot derive queries anymore', async () => {
    const projectionStore = createProjectionStore({
      [ACTIVE_SNAPSHOT_KEY]: {
        generatedAt: '2026-03-12T09:00:00.000Z',
        cache: {
          queryKey: '',
        },
      },
      [DEFAULT_SNAPSHOT_KEY]: createStoredSnapshot({
        query: { from: '2026-01-01', to: '2026-02-28' },
      }),
    });
    const buildMonthlyReportingAggregates = vi.fn();
    const runtime = createReportingAggregateRuntime({
      projectionStore,
      buildSourceSnapshot: () => createSourceSnapshot({ rows: [] }),
      buildMonthlyReportingAggregates,
      buildDefaultMonthlyAggregateQuery: vi.fn(() => ({
        from: '',
        to: '',
      })),
    });

    await runtime.refreshMonthlyReportingAggregateSnapshot('decl_rows_v1', {
      actor: 'system',
      source: 'storage-delete',
    });

    expect(buildMonthlyReportingAggregates).not.toHaveBeenCalled();
    expect(projectionStore.deleteMonthlyAggregateSnapshot).toHaveBeenNthCalledWith(
      1,
      ACTIVE_SNAPSHOT_KEY,
    );
    expect(projectionStore.deleteMonthlyAggregateSnapshot).toHaveBeenNthCalledWith(
      2,
      DEFAULT_SNAPSHOT_KEY,
    );
  });

  it('rebuilds the active aggregate when cached projection ownership metadata is stale', () => {
    const currentSourceSnapshot = createSourceSnapshot({
      rules: {
        id: 'default',
        name: 'Default KPI',
        updatedAt: '2026-03-14T00:00:00.000Z',
        groups: {},
      },
    });
    const projectionStore = createProjectionStore({
      [ACTIVE_SNAPSHOT_KEY]: createStoredSnapshot({
        query: { from: '2026-02-01', to: '2026-02-28' },
        total: 1,
        projectionState: {
          schemaVersion: 1,
          snapshotKey: ACTIVE_SNAPSHOT_KEY,
          refreshedAt: '2026-03-13T09:00:00.000Z',
          freshnessKey: '',
          owner: {
            ruleSetId: 'default',
            ruleUpdatedAt: '2026-03-01T00:00:00.000Z',
          },
        },
      }),
    });
    const buildMonthlyReportingAggregates = vi.fn(({ from, to, limit }) => ({
      generatedAt: '2026-03-14T10:00:00.000Z',
      range: { from, to },
      total: limit ? 1 : 2,
      cache: {
        queryKey: JSON.stringify({
          from: from || '',
          to: to || '',
          limit: Number.isFinite(limit) && limit > 0 ? Math.trunc(limit) : 0,
        }),
        reused: false,
      },
      items: [{ period: '2026-02' }],
    }));
    const runtime = createReportingAggregateRuntime({
      projectionStore,
      buildMonthlyReportingAggregates,
    });

    const result = runtime.materializeMonthlyReportingAggregateSnapshot(currentSourceSnapshot, {
      from: '2026-02-01',
      to: '2026-02-28',
    });

    expect(buildMonthlyReportingAggregates).toHaveBeenCalledTimes(1);
    expect(projectionStore.writeMonthlyAggregateSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        projectionState: expect.objectContaining({
          owner: expect.objectContaining({
            ruleUpdatedAt: '2026-03-14T00:00:00.000Z',
          }),
        }),
      }),
      expect.objectContaining({
        snapshotKey: ACTIVE_SNAPSHOT_KEY,
      }),
    );
    expect(result.cache.reused).toBe(false);
  });
});

function createProjectionStore(initialSnapshots = {}) {
  const snapshots = new Map(Object.entries(initialSnapshots));
  const jobRuns = [];

  return {
    readMonthlyAggregateSnapshot: vi.fn((snapshotKey = ACTIVE_SNAPSHOT_KEY) =>
      snapshots.get(snapshotKey) ?? null,
    ),
    readMonthlyAggregateQuery: vi.fn((snapshot) => parseQueryKey(snapshot?.cache?.queryKey)),
    buildMonthlyAggregateStatus: vi.fn((snapshot) =>
      snapshot
        ? {
            available: true,
            generatedAt: snapshot.generatedAt || '',
            queryKey: snapshot?.cache?.queryKey || '',
            total: snapshot.total || 0,
            range: snapshot.range || { from: '', to: '' },
          }
        : {
            available: false,
            generatedAt: '',
            queryKey: '',
            total: 0,
            range: { from: '', to: '' },
          },
    ),
    appendJobRun: vi.fn((entry) => {
      jobRuns.unshift(entry);
      return jobRuns.slice();
    }),
    readJobRuns: vi.fn(() => jobRuns.slice()),
    readCachedMonthlyAggregateSnapshot: vi.fn((query, snapshotKey = ACTIVE_SNAPSHOT_KEY) => {
      const snapshot = snapshots.get(snapshotKey);
      if (!snapshot) {
        return null;
      }

      const queryKey = JSON.stringify({
        from: query?.from || '',
        to: query?.to || '',
        limit: Number.isFinite(query?.limit) && query.limit > 0 ? Math.trunc(query.limit) : 0,
      });
      if (snapshot?.cache?.queryKey !== queryKey) {
        return null;
      }

      return {
        ...snapshot,
        cache: {
          queryKey,
          reused: true,
        },
      };
    }),
    writeMonthlyAggregateSnapshot: vi.fn((snapshot, options = {}) => {
      const snapshotKey = options.snapshotKey || ACTIVE_SNAPSHOT_KEY;
      snapshots.set(snapshotKey, snapshot);
      return snapshots.get(snapshotKey);
    }),
    deleteMonthlyAggregateSnapshot: vi.fn((snapshotKey = ACTIVE_SNAPSHOT_KEY) => {
      snapshots.delete(snapshotKey);
    }),
    readScheduleEntries: vi.fn(() => []),
    writeScheduleEntries: vi.fn((entries) => entries),
  };
}

function createStoredSnapshot({
  generatedAt = '2026-03-12T09:00:00.000Z',
  query = { from: '2026-02-01', to: '2026-02-28' },
  total = 1,
  items = [],
  projectionState,
} = {}) {
  return {
    generatedAt,
    total,
    range: {
      from: query.from || '',
      to: query.to || '',
    },
    cache: {
      queryKey: JSON.stringify({
        from: query.from || '',
        to: query.to || '',
        limit: Number.isFinite(query.limit) && query.limit > 0 ? Math.trunc(query.limit) : 0,
      }),
      reused: false,
    },
    items,
    ...(projectionState ? { projectionState } : {}),
  };
}

function createSourceSnapshot(overrides = {}) {
  return {
    rows: [],
    roster: { teams: [] },
    rules: { id: 'default', name: 'Default KPI', groups: {} },
    adjustments: [],
    schedules: [],
    ...overrides,
  };
}

function parseQueryKey(input) {
  if (!input) {
    return null;
  }

  try {
    const parsed = JSON.parse(input);
    return {
      from: parsed?.from || '',
      to: parsed?.to || '',
      limit: Number(parsed?.limit || 0) > 0 ? Number(parsed.limit) : undefined,
    };
  } catch {
    return null;
  }
}
