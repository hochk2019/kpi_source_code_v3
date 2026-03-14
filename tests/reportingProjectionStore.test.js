import { beforeEach, describe, expect, it } from 'vitest';

import {
  createReportingProjectionStore,
  DEFAULT_MONTHLY_REPORTING_AGGREGATE_KEY,
  MONTHLY_REPORTING_AGGREGATE_KEY,
  REPORTING_JOB_RUNS_KEY,
  REPORT_SCHEDULE_STORAGE_KEY,
} from '../server/reportingProjectionStore.js';

function createMemoryStore() {
  const values = new Map();

  return {
    values,
    readJsonValue(key, fallback) {
      return values.has(key) ? values.get(key) : fallback;
    },
    writeJsonValue(key, value) {
      values.set(key, value);
    },
    deleteValue(key) {
      values.delete(key);
    },
  };
}

describe('reportingProjectionStore', () => {
  let memoryStore;
  let projectionStore;

  beforeEach(() => {
    memoryStore = createMemoryStore();
    projectionStore = createReportingProjectionStore(memoryStore);
  });

  it('đọc snapshot monthly aggregate theo query key và trả về bản clone reused', () => {
    memoryStore.values.set(MONTHLY_REPORTING_AGGREGATE_KEY, {
      generatedAt: '2026-03-09T00:00:00.000Z',
      total: 2,
      range: { from: '2026-02-01', to: '2026-02-28' },
      cache: {
        queryKey: JSON.stringify({
          from: '2026-02-01',
          to: '2026-02-28',
          limit: 0,
        }),
      },
      items: [{ period: '2026-02' }],
    });

    const cached = projectionStore.readCachedMonthlyAggregateSnapshot({
      from: '2026-02-01',
      to: '2026-02-28',
    });

    expect(cached).toEqual({
      generatedAt: '2026-03-09T00:00:00.000Z',
      total: 2,
      range: { from: '2026-02-01', to: '2026-02-28' },
      cache: {
        queryKey: JSON.stringify({
          from: '2026-02-01',
          to: '2026-02-28',
          limit: 0,
        }),
        reused: true,
      },
      items: [{ period: '2026-02' }],
    });

    cached.items.push({ period: 'mutated' });
    expect(memoryStore.values.get(MONTHLY_REPORTING_AGGREGATE_KEY).items).toEqual([{ period: '2026-02' }]);
  });

  it('trả về trạng thái trống khi chưa có default monthly aggregate snapshot', () => {
    expect(projectionStore.readDefaultMonthlyAggregateSnapshot()).toBeNull();
    expect(
      projectionStore.buildMonthlyAggregateStatus(projectionStore.readDefaultMonthlyAggregateSnapshot())
    ).toEqual({
      available: false,
      generatedAt: '',
      queryKey: '',
      total: 0,
      range: {
        from: '',
        to: '',
      },
    });
  });

  it('đọc và ghi schedule entries qua projection keys typed', () => {
    projectionStore.writeScheduleEntries([
      { id: 'schedule-1', name: 'Lich 1' },
      null,
      { id: 'schedule-2', active: true },
    ]);

    expect(memoryStore.values.get(REPORT_SCHEDULE_STORAGE_KEY)).toEqual([
      { id: 'schedule-1', name: 'Lich 1' },
      { id: 'schedule-2', active: true },
    ]);
    expect(projectionStore.readScheduleEntries()).toEqual([
      { id: 'schedule-1', name: 'Lich 1' },
      { id: 'schedule-2', active: true },
    ]);
  });

  it('ghi và xóa đúng snapshot key cho default monthly aggregate', () => {
    projectionStore.writeMonthlyAggregateSnapshot(
      {
        generatedAt: '2026-03-09T01:00:00.000Z',
        cache: { queryKey: 'default-query' },
      },
      { snapshotKey: DEFAULT_MONTHLY_REPORTING_AGGREGATE_KEY }
    );

    expect(projectionStore.readDefaultMonthlyAggregateSnapshot()).toEqual({
      generatedAt: '2026-03-09T01:00:00.000Z',
      cache: { queryKey: 'default-query' },
    });

    projectionStore.deleteMonthlyAggregateSnapshot(DEFAULT_MONTHLY_REPORTING_AGGREGATE_KEY);
    expect(projectionStore.readDefaultMonthlyAggregateSnapshot()).toBeNull();
  });

  it('append recent reporting job runs and caps the stored history', () => {
    projectionStore.appendJobRun({
      id: 'run-1',
      job: 'reporting-monthly-aggregate-materialize',
      status: 'success',
      finishedAt: '2026-03-12T10:15:00.000Z',
    });
    projectionStore.appendJobRun(
      {
        id: 'run-2',
        job: 'reporting-monthly-aggregate-materialize',
        status: 'error',
        finishedAt: '2026-03-12T11:15:00.000Z',
        error: 'boom',
      },
      { limit: 1 }
    );

    expect(memoryStore.values.get(REPORTING_JOB_RUNS_KEY)).toEqual([
      expect.objectContaining({
        id: 'run-2',
        status: 'error',
      }),
    ]);
    expect(projectionStore.readJobRuns()).toEqual([
      expect.objectContaining({
        id: 'run-2',
        error: 'boom',
      }),
    ]);
  });
});
