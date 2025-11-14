/* eslint-env node */

/* @vitest-environment node */



process.env.NODE_ENV = 'test';

process.env.VITEST = 'true';

process.env.KPI_DB_FILE = ':memory:';

process.env.KPI_DISABLE_CRON = '1';

process.env.KPI_SKIP_LISTEN = '1';

process.env.MONITOR_ACCESS_TOKEN = 'test-monitor-token';



import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

import {

  initializeDatabase,

  appendEcusMonitorHistory,

  getEcusMonitorHistory,

  clearEcusMonitorHistory,

  buildEcusMonitorMetrics,

  buildEcusMonitorSeries,

} from '../server/index.js';



function buildSnapshot({

  runAt,

  status = 'success',

  severity = 'normal',

  staleMinutes = 15,

  rowsInserted = 42,

  consecutiveErrors = 0,

  issues = [],

} = {}) {

  const runTimestamp = runAt ? new Date(runAt).toISOString() : new Date().toISOString();

  return {

    generatedAt: new Date().toISOString(),

    severity,

    issues,

    thresholds: { warning: 90, critical: 180 },

    sync: {

      lastRunAt: runTimestamp,

      lastStatus: status,

      staleMinutes,

      rowsFetched: rowsInserted + 10,

      rowsInserted,

      rowsUpdated: Math.max(0, Math.floor(rowsInserted / 3)),

      rowsSkipped: 0,

      totalStored: 5000 + rowsInserted,

    },

    database: { ok: true, state: 'ok', latencyMs: 150 },

    alertDispatch: { triggered: [] },

    alertState: {

      consecutiveErrors,

      lastErrorMessage: consecutiveErrors > 0 ? 'Lỗi giả lập' : null,

      lastSuccessAt: consecutiveErrors > 0 ? null : runTimestamp,

      lastFailureAlertAt: null,

      lastStaleAlertAt: null,

      lastAlertDeliveredAt: null,

    },

  };

}



describe('ecus monitor history & metrics', () => {

  beforeAll(async () => {

    await initializeDatabase({ dbFile: ':memory:' });

  });



  beforeEach(() => {

    clearEcusMonitorHistory({ actor: 'test' });

  });



  afterEach(() => {

    vi.useRealTimers();

  });



  it('ghi nhận snapshot mới vào lịch sử', () => {

    vi.useFakeTimers();

    const baseTime = new Date('2024-01-01T00:00:00Z');

    vi.setSystemTime(baseTime);



    const snapshot = buildSnapshot({ runAt: baseTime.toISOString(), rowsInserted: 25, staleMinutes: 12 });

    const result = appendEcusMonitorHistory(snapshot, { actor: 'tester' });



    expect(result?.totalEntries).toBe(1);

    const history = getEcusMonitorHistory();

    expect(history.entries).toHaveLength(1);

    expect(history.entries[0]).toMatchObject({

      staleMinutes: 12,

      rowsInserted: 25,

      severity: 'normal',

    });

  });



  it('hợp nhất bản ghi khi dữ liệu trùng trong cửa sổ 5 phút', () => {

    vi.useFakeTimers();

    const baseTime = new Date('2024-01-02T08:00:00Z');

    vi.setSystemTime(baseTime);

    appendEcusMonitorHistory(buildSnapshot({ runAt: baseTime.toISOString(), staleMinutes: 18 }), { actor: 'tester' });



    const secondTime = new Date(baseTime.getTime() + 3 * 60 * 1000); // +3 phút

    vi.setSystemTime(secondTime);

    appendEcusMonitorHistory(buildSnapshot({ runAt: secondTime.toISOString(), staleMinutes: 18 }), {

      actor: 'tester',

    });



    const history = getEcusMonitorHistory();

    expect(history.entries).toHaveLength(1);

    expect(history.entries[0].runAt).toBe(secondTime.toISOString());

  });



  it('tính toán thống kê và chuỗi thời gian cho dashboard', () => {

    vi.useFakeTimers();

    const baseTime = new Date('2024-01-05T00:00:00Z');



    vi.setSystemTime(baseTime);

    appendEcusMonitorHistory(buildSnapshot({ runAt: baseTime.toISOString(), staleMinutes: 10, rowsInserted: 30 }), {

      actor: 'tester',

    });



    vi.setSystemTime(new Date(baseTime.getTime() + 60 * 60 * 1000));

    appendEcusMonitorHistory(

      buildSnapshot({

        runAt: new Date(baseTime.getTime() + 60 * 60 * 1000).toISOString(),

        severity: 'warning',

        status: 'warning',

        staleMinutes: 120,

        rowsInserted: 15,

      }),

      { actor: 'tester' }

    );



    vi.setSystemTime(new Date(baseTime.getTime() + 2 * 60 * 60 * 1000));

    appendEcusMonitorHistory(

      buildSnapshot({

        runAt: new Date(baseTime.getTime() + 2 * 60 * 60 * 1000).toISOString(),

        severity: 'critical',

        status: 'error',

        staleMinutes: 200,

        rowsInserted: 5,

        consecutiveErrors: 2,

      }),

      { actor: 'tester' }

    );



    const history = getEcusMonitorHistory();

    const metrics = buildEcusMonitorMetrics({ history });



    expect(metrics.totals.entries).toBe(3);

    expect(metrics.windows['24h'].errorCount).toBe(1);

    expect(metrics.windows['24h'].warningCount).toBe(1);

    expect(metrics.windows['24h'].staleBreaches).toBe(2);

    expect(metrics.windows['24h'].averageStaleMinutes).toBeCloseTo((10 + 120 + 200) / 3, 2);



    const series = buildEcusMonitorSeries(history.entries, { thresholds: metrics.thresholds });

    const statusSeries = series.find((entry) => entry.name === 'ecus_sync_status');

    expect(statusSeries?.datapoints).toHaveLength(3);

    const latencySeries = series.find((entry) => entry.name === 'ecus_sync_stale_minutes');

    expect(latencySeries?.datapoints[latencySeries.datapoints.length - 1][0]).toBe(200);



    vi.useRealTimers();

  });

});



