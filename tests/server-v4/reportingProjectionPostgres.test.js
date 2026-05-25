import { describe, expect, it, vi } from 'vitest';

import { createPostgresReportingProjectionPersistence } from '../../server-v4/src/persistence/reportingProjectionPostgres.ts';

const SCHEDULE_ENTRY_TABLE = 'reporting_schedule_projection_entries';
const MONTHLY_ENTRY_TABLE = 'reporting_monthly_aggregate_projection_entries';
const JOB_RUN_ENTRY_TABLE = 'reporting_job_run_entries';

describe('server-v4 postgres reporting projection persistence', () => {
  it('reads and writes reporting projection payloads through the postgres adapter', async () => {
    const pool = createFakePool();
    const persistence = createPostgresReportingProjectionPersistence('postgres://runtime/kpi', {
      pool,
    });
    const snapshot = {
      generatedAt: '2026-03-13T10:00:00.000Z',
      range: {
        from: '2026-02-01',
        to: '2026-02-28',
      },
      cache: {
        queryKey: '{"from":"2026-02-01","to":"2026-02-28","limit":0}',
      },
      total: 1,
      items: [{ period: '2026-02' }],
    };

    await persistence.writeValue('kpi_reporting_monthly_aggregates_v1', snapshot);

    await expect(
      persistence.readValue('kpi_reporting_monthly_aggregates_v1'),
    ).resolves.toEqual(snapshot);
    expect(pool.query).toHaveBeenCalled();
  });

  it('materializes schedule, monthly aggregate, and job run entries into relational rows on write', async () => {
    const pool = createFakePool();
    const persistence = createPostgresReportingProjectionPersistence('postgres://runtime/kpi', {
      pool,
    });
    const schedules = [
      {
        id: 'sched-1',
        name: 'Monthly Red',
        frequency: 'monthly',
        dayOfMonth: 20,
        time: '09:15',
        active: true,
        recipients: ['ops@example.com', 'lead@example.com'],
        formats: ['pdf'],
      },
      {
        id: 'sched-2',
        name: 'Weekly Blue',
        frequency: 'weekly',
        dayOfWeek: 1,
        time: '08:30',
        active: false,
        recipients: ['blue@example.com'],
        formats: ['excel', 'pdf'],
      },
    ];
    const snapshot = {
      generatedAt: '2026-03-13T10:00:00.000Z',
      range: {
        from: '2026-02-01',
        to: '2026-02-28',
      },
      cache: {
        queryKey: '{"from":"2026-02-01","to":"2026-02-28","limit":0}',
      },
      total: 1,
      items: [
        {
          period: '2026-02',
          label: '02/2026',
          range: {
            from: '2026-02-01',
            to: '2026-02-28',
          },
          summary: {
            decls: 4,
            import: 2,
            export: 1,
            items: 7,
            licenses: 3,
            kpi: 18.5,
            co: 1,
            coLines: 2,
            companyCount: 2,
          },
          topTeams: [{ id: 'team-a' }],
          topStaff: [{ id: 'staff-a' }],
        },
      ],
    };
    const runs = [
      {
        id: 'job-2',
        job: 'reporting-monthly-aggregate-materialize',
        status: 'success',
        source: 'reporting-monthly-aggregates',
        actor: 'system',
        snapshotKey: 'kpi_reporting_monthly_aggregates_v1',
        queryKey: snapshot.cache.queryKey,
        range: snapshot.range,
        total: 1,
        startedAt: '2026-03-13T09:59:00.000Z',
        finishedAt: '2026-03-13T10:00:00.000Z',
        durationMs: 60000,
        error: '',
      },
    ];

    await persistence.writeValue('kpi_report_schedule_v1', schedules);
    await persistence.writeValue('kpi_reporting_monthly_aggregates_v1', snapshot);
    await persistence.writeValue('kpi_reporting_job_runs_v1', runs);

    await expect(persistence.readScheduleEntries('kpi_report_schedule_v1')).resolves.toEqual(schedules);
    await expect(
      persistence.readMonthlyAggregateEntries('kpi_reporting_monthly_aggregates_v1'),
    ).resolves.toEqual(snapshot.items);
    await expect(persistence.readJobRunEntries('kpi_reporting_job_runs_v1')).resolves.toEqual(runs);
    expect(pool.materialized.scheduleEntriesByKey.get('kpi_report_schedule_v1')).toEqual(schedules);
    expect(pool.materialized.monthlyEntriesByKey.get('kpi_reporting_monthly_aggregates_v1')).toEqual(
      snapshot.items,
    );
    expect(pool.materialized.jobRunsByKey.get('kpi_reporting_job_runs_v1')).toEqual(runs);
  });

  it('falls back to stored payloads when relational entry rows are unavailable', async () => {
    const pool = createFakePool({
      kpi_report_schedule_v1: [
        { id: 'sched-2', name: 'Weekly Blue' },
        { id: 'sched-1', name: 'Monthly Red' },
      ],
      kpi_reporting_monthly_aggregates_v1: {
        generatedAt: '2026-03-13T10:00:00.000Z',
        total: 2,
        items: [{ period: '2026-02' }, { period: '2026-01' }],
      },
      kpi_reporting_job_runs_v1: [
        { id: 'job-2', status: 'success' },
        { id: 'job-1', status: 'error' },
      ],
    });
    const persistence = createPostgresReportingProjectionPersistence('postgres://runtime/kpi', {
      pool,
    });

    await expect(persistence.readScheduleEntries('kpi_report_schedule_v1')).resolves.toEqual([
      { id: 'sched-2', name: 'Weekly Blue' },
      { id: 'sched-1', name: 'Monthly Red' },
    ]);
    await expect(
      persistence.readMonthlyAggregateEntries('kpi_reporting_monthly_aggregates_v1'),
    ).resolves.toEqual([{ period: '2026-02' }, { period: '2026-01' }]);
    await expect(persistence.readJobRunEntries('kpi_reporting_job_runs_v1')).resolves.toEqual([
      { id: 'job-2', status: 'success' },
      { id: 'job-1', status: 'error' },
    ]);
  });

  it('deletes stored payloads, clears relational rows, and disposes the underlying pool', async () => {
    const pool = createFakePool();
    const persistence = createPostgresReportingProjectionPersistence('postgres://runtime/kpi', {
      pool,
    });
    const snapshot = {
      generatedAt: '2026-03-13T10:00:00.000Z',
      range: {
        from: '2026-02-01',
        to: '2026-02-28',
      },
      cache: {
        queryKey: '{"from":"2026-02-01","to":"2026-02-28","limit":0}',
      },
      total: 1,
      items: [{ period: '2026-02' }],
    };

    await persistence.writeValue('kpi_reporting_monthly_aggregates_v1', snapshot);
    await persistence.deleteValue('kpi_reporting_monthly_aggregates_v1');

    await expect(
      persistence.readValue('kpi_reporting_monthly_aggregates_v1'),
    ).resolves.toBeNull();
    await expect(
      persistence.readMonthlyAggregateEntries('kpi_reporting_monthly_aggregates_v1'),
    ).resolves.toEqual([]);
    await persistence.dispose();
    expect(pool.end).toHaveBeenCalledTimes(1);
  });

  it('allows callers to keep pool ownership when managePool is false', async () => {
    const pool = createFakePool();
    const persistence = createPostgresReportingProjectionPersistence('postgres://runtime/kpi', {
      pool,
      managePool: false,
    });

    await persistence.dispose();

    expect(pool.end).not.toHaveBeenCalled();
  });
});

function createFakePool(initialState = {}) {
  const rowsByKey = new Map(Object.entries(initialState));
  const scheduleEntriesByKey = new Map();
  const monthlyEntriesByKey = new Map();
  const jobRunsByKey = new Map();

  return {
    materialized: {
      scheduleEntriesByKey,
      monthlyEntriesByKey,
      jobRunsByKey,
    },
    query: vi.fn(async (sql, values = []) => {
      if (sql.includes('CREATE TABLE') || sql.includes('CREATE INDEX')) {
        return { rows: [] };
      }

      if (sql.includes('SELECT payload FROM reporting_projections WHERE projection_key =')) {
        const key = values[0];
        return {
          rows: rowsByKey.has(key) ? [{ payload: rowsByKey.get(key) }] : [],
        };
      }

      if (sql.includes('INSERT INTO reporting_projections')) {
        const key = values[0];
        const payload = values[7];
        rowsByKey.set(key, parsePayload(payload));
        return { rows: [] };
      }

      if (sql.includes('DELETE FROM reporting_projections WHERE projection_key =')) {
        rowsByKey.delete(values[0]);
        return { rows: [] };
      }

      if (sql.includes(`SELECT payload FROM ${SCHEDULE_ENTRY_TABLE} WHERE projection_key =`)) {
        const key = values[0];
        const entries = [...(scheduleEntriesByKey.get(key) ?? [])];
        return {
          rows: entries.map((entry) => ({ payload: entry })),
        };
      }

      if (sql.includes(`SELECT payload FROM ${MONTHLY_ENTRY_TABLE} WHERE projection_key =`)) {
        const key = values[0];
        const entries = [...(monthlyEntriesByKey.get(key) ?? [])].sort((left, right) =>
          String(right?.period || '').localeCompare(String(left?.period || '')),
        );
        return {
          rows: entries.map((entry) => ({ payload: entry })),
        };
      }

      if (sql.includes(`SELECT payload FROM ${JOB_RUN_ENTRY_TABLE} WHERE projection_key =`)) {
        const key = values[0];
        const entries = [...(jobRunsByKey.get(key) ?? [])].sort((left, right) => {
          const finishedCompare = String(right?.finishedAt || '').localeCompare(String(left?.finishedAt || ''));
          if (finishedCompare !== 0) {
            return finishedCompare;
          }

          return String(right?.id || '').localeCompare(String(left?.id || ''));
        });
        return {
          rows: entries.map((entry) => ({ payload: entry })),
        };
      }

      if (sql.includes(`INSERT INTO ${SCHEDULE_ENTRY_TABLE}`)) {
        const key = values[0];
        const payload = values[13];
        scheduleEntriesByKey.set(key, [...(scheduleEntriesByKey.get(key) ?? []), parsePayload(payload)]);
        return { rows: [] };
      }

      if (sql.includes(`INSERT INTO ${MONTHLY_ENTRY_TABLE}`)) {
        const key = values[0];
        const payload = values[16];
        monthlyEntriesByKey.set(key, [...(monthlyEntriesByKey.get(key) ?? []), parsePayload(payload)]);
        return { rows: [] };
      }

      if (sql.includes(`INSERT INTO ${JOB_RUN_ENTRY_TABLE}`)) {
        const key = values[0];
        const payload = values[15];
        jobRunsByKey.set(key, [...(jobRunsByKey.get(key) ?? []), parsePayload(payload)]);
        return { rows: [] };
      }

      if (sql.includes(`DELETE FROM ${SCHEDULE_ENTRY_TABLE} WHERE projection_key =`)) {
        scheduleEntriesByKey.delete(values[0]);
        return { rows: [] };
      }

      if (sql.includes(`DELETE FROM ${MONTHLY_ENTRY_TABLE} WHERE projection_key =`)) {
        monthlyEntriesByKey.delete(values[0]);
        return { rows: [] };
      }

      if (sql.includes(`DELETE FROM ${JOB_RUN_ENTRY_TABLE} WHERE projection_key =`)) {
        jobRunsByKey.delete(values[0]);
        return { rows: [] };
      }

      throw new Error(`Unexpected SQL in fake pool: ${sql}`);
    }),
    end: vi.fn(async () => {}),
  };
}

function parsePayload(payload) {
  return typeof payload === 'string' ? JSON.parse(payload) : payload;
}
