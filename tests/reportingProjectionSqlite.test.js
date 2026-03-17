/* eslint-env node */

/* @vitest-environment node */

import Database from 'better-sqlite3';

import { describe, expect, it } from 'vitest';

import {
  REPORTING_JOB_RUN_ENTRY_TABLE,
  REPORTING_MONTHLY_AGGREGATE_ENTRY_TABLE,
  REPORTING_PROJECTION_TABLE,
  REPORTING_SCHEDULE_ENTRY_TABLE,
  deleteReportingProjectionValue,
  ensureReportingProjectionTable,
  readReportingJobRunProjectionEntries,
  readReportingMonthlyAggregateProjectionEntries,
  readReportingProjectionValue,
  readReportingScheduleProjectionEntries,
  writeReportingProjectionValue,
} from '../server/reportingProjectionSqlite.js';

describe('reportingProjectionSqlite', () => {
  it('creates the reporting projection table and round-trips aggregate payloads', () => {
    const db = new Database(':memory:');

    try {
      ensureReportingProjectionTable(db);

      const table = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
        .get(REPORTING_PROJECTION_TABLE);
      const monthlyEntryTable = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
        .get(REPORTING_MONTHLY_AGGREGATE_ENTRY_TABLE);

      expect(table).toEqual({ name: REPORTING_PROJECTION_TABLE });
      expect(monthlyEntryTable).toEqual({ name: REPORTING_MONTHLY_AGGREGATE_ENTRY_TABLE });

      const snapshot = {
        generatedAt: '2026-03-09T09:00:00.000Z',
        total: 2,
        range: {
          from: '2026-01-01',
          to: '2026-02-28',
        },
        cache: {
          queryKey: '{"from":"2026-01-01","to":"2026-02-28"}',
        },
        items: [
          {
            period: '2026-01',
            label: '01/2026',
            range: {
              from: '2026-01-01',
              to: '2026-01-31',
            },
          },
          {
            period: '2026-02',
            label: '02/2026',
            range: {
              from: '2026-02-01',
              to: '2026-02-28',
            },
          },
        ],
      };

      writeReportingProjectionValue(db, 'kpi_reporting_monthly_aggregates_v1', snapshot, {
        updatedAt: '2026-03-09T09:00:00.000Z',
      });

      expect(readReportingProjectionValue(db, 'kpi_reporting_monthly_aggregates_v1')).toEqual(snapshot);

      const row = db
        .prepare(
          'SELECT projection_type, scope_key, range_from, range_to, query_key, entry_count, updated_at FROM reporting_projections WHERE projection_key = ?'
        )
        .get('kpi_reporting_monthly_aggregates_v1');

      expect(row).toEqual({
        projection_type: 'monthly_aggregate',
        scope_key: 'active',
        range_from: '2026-01-01',
        range_to: '2026-02-28',
        query_key: '{"from":"2026-01-01","to":"2026-02-28"}',
        entry_count: 2,
        updated_at: '2026-03-09T09:00:00.000Z',
      });

      const materializedItems = db
        .prepare(
          'SELECT projection_key, period, label, range_from, range_to, decls, item_count, kpi, top_team_count, top_staff_count FROM reporting_monthly_aggregate_projection_entries WHERE projection_key = ? ORDER BY period DESC'
        )
        .all('kpi_reporting_monthly_aggregates_v1');

      expect(materializedItems).toEqual([
        {
          projection_key: 'kpi_reporting_monthly_aggregates_v1',
          period: '2026-02',
          label: '02/2026',
          range_from: '2026-02-01',
          range_to: '2026-02-28',
          decls: 0,
          item_count: 0,
          kpi: 0,
          top_team_count: 0,
          top_staff_count: 0,
        },
        {
          projection_key: 'kpi_reporting_monthly_aggregates_v1',
          period: '2026-01',
          label: '01/2026',
          range_from: '2026-01-01',
          range_to: '2026-01-31',
          decls: 0,
          item_count: 0,
          kpi: 0,
          top_team_count: 0,
          top_staff_count: 0,
        },
      ]);
      expect(readReportingMonthlyAggregateProjectionEntries(db, 'kpi_reporting_monthly_aggregates_v1')).toEqual([
        expect.objectContaining({
          period: '2026-02',
          label: '02/2026',
        }),
        expect.objectContaining({
          period: '2026-01',
          label: '01/2026',
        }),
      ]);
    } finally {
      db.close();
    }
  });

  it('stores schedule arrays and removes them cleanly', () => {
    const db = new Database(':memory:');

    try {
      ensureReportingProjectionTable(db);

      const scheduleEntryTable = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
        .get(REPORTING_SCHEDULE_ENTRY_TABLE);

      expect(scheduleEntryTable).toEqual({ name: REPORTING_SCHEDULE_ENTRY_TABLE });

      const schedules = [
        {
          id: 'sched-1',
          name: 'Monthly Red',
          frequency: 'monthly',
          time: '09:15',
          dayOfMonth: 20,
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

      writeReportingProjectionValue(db, 'kpi_report_schedule_v1', schedules);

      expect(readReportingProjectionValue(db, 'kpi_report_schedule_v1')).toEqual(schedules);

      const row = db
        .prepare(
          'SELECT projection_type, scope_key, range_from, range_to, query_key, entry_count FROM reporting_projections WHERE projection_key = ?'
        )
        .get('kpi_report_schedule_v1');

      expect(row).toEqual({
        projection_type: 'report_schedule',
        scope_key: 'global',
        range_from: '',
        range_to: '',
        query_key: '',
        entry_count: 2,
      });

      const materializedSchedules = db
        .prepare(
          'SELECT projection_key, position, schedule_id, name, frequency, time, day_of_week, day_of_month, active, recipient_count, format_count FROM reporting_schedule_projection_entries WHERE projection_key = ? ORDER BY position ASC, schedule_id ASC'
        )
        .all('kpi_report_schedule_v1');

      expect(materializedSchedules).toEqual([
        {
          projection_key: 'kpi_report_schedule_v1',
          position: 0,
          schedule_id: 'sched-1',
          name: 'Monthly Red',
          frequency: 'monthly',
          time: '09:15',
          day_of_week: 0,
          day_of_month: 20,
          active: 1,
          recipient_count: 2,
          format_count: 1,
        },
        {
          projection_key: 'kpi_report_schedule_v1',
          position: 1,
          schedule_id: 'sched-2',
          name: 'Weekly Blue',
          frequency: 'weekly',
          time: '08:30',
          day_of_week: 1,
          day_of_month: 0,
          active: 0,
          recipient_count: 1,
          format_count: 2,
        },
      ]);
      expect(readReportingScheduleProjectionEntries(db, 'kpi_report_schedule_v1')).toEqual(schedules);

      deleteReportingProjectionValue(db, 'kpi_report_schedule_v1');

      expect(readReportingProjectionValue(db, 'kpi_report_schedule_v1')).toBeNull();
      expect(
        db
          .prepare(
            'SELECT projection_key, schedule_id FROM reporting_schedule_projection_entries WHERE projection_key = ?'
          )
          .all('kpi_report_schedule_v1')
      ).toEqual([]);
    } finally {
      db.close();
    }
  });

  it('backfills the schedule position column before creating its index on legacy tables', () => {
    const db = new Database(':memory:');

    try {
      db.exec(
        'CREATE TABLE reporting_schedule_projection_entries (\n' +
          '  projection_key TEXT NOT NULL,\n' +
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
          ')'
      );

      expect(() => ensureReportingProjectionTable(db)).not.toThrow();

      const columns = db.prepare('PRAGMA table_info(reporting_schedule_projection_entries)').all();
      expect(columns.some((column) => column?.name === 'position')).toBe(true);

      const positionIndex = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_reporting_schedule_projection_entries_projection_position'"
        )
        .get();

      expect(positionIndex).toEqual({
        name: 'idx_reporting_schedule_projection_entries_projection_position',
      });
    } finally {
      db.close();
    }
  });

  it('materializes reporting job runs into a dedicated entry table', () => {
    const db = new Database(':memory:');

    try {
      ensureReportingProjectionTable(db);

      const jobRunEntryTable = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
        .get(REPORTING_JOB_RUN_ENTRY_TABLE);

      expect(jobRunEntryTable).toEqual({ name: REPORTING_JOB_RUN_ENTRY_TABLE });

      writeReportingProjectionValue(db, 'kpi_reporting_job_runs_v1', [
        {
          id: 'run-1',
          job: 'reporting-monthly-aggregate-materialize',
          status: 'success',
          source: 'reporting-monthly-aggregates',
          actor: 'admin',
          snapshotKey: 'kpi_reporting_monthly_aggregates_v1',
          queryKey: '{"from":"2026-01-01","to":"2026-02-28"}',
          range: {
            from: '2026-01-01',
            to: '2026-02-28',
          },
          total: 2,
          startedAt: '2026-03-12T09:00:00.000Z',
          finishedAt: '2026-03-12T09:00:01.000Z',
          durationMs: 1000,
          error: '',
        },
      ]);

      const row = db
        .prepare(
          'SELECT projection_type, scope_key, entry_count FROM reporting_projections WHERE projection_key = ?'
        )
        .get('kpi_reporting_job_runs_v1');

      expect(row).toEqual({
        projection_type: 'job_runs',
        scope_key: '',
        entry_count: 1,
      });

      const materializedRuns = db
        .prepare(
          'SELECT projection_key, run_id, job_name, status, source, actor, snapshot_key, query_key, range_from, range_to, total, duration_ms FROM reporting_job_run_entries WHERE projection_key = ?'
        )
        .all('kpi_reporting_job_runs_v1');

      expect(materializedRuns).toEqual([
        {
          projection_key: 'kpi_reporting_job_runs_v1',
          run_id: 'run-1',
          job_name: 'reporting-monthly-aggregate-materialize',
          status: 'success',
          source: 'reporting-monthly-aggregates',
          actor: 'admin',
          snapshot_key: 'kpi_reporting_monthly_aggregates_v1',
          query_key: '{"from":"2026-01-01","to":"2026-02-28"}',
          range_from: '2026-01-01',
          range_to: '2026-02-28',
          total: 2,
          duration_ms: 1000,
        },
      ]);
      expect(readReportingJobRunProjectionEntries(db, 'kpi_reporting_job_runs_v1')).toEqual([
        expect.objectContaining({
          id: 'run-1',
          job: 'reporting-monthly-aggregate-materialize',
          status: 'success',
          queryKey: '{"from":"2026-01-01","to":"2026-02-28"}',
        }),
      ]);
    } finally {
      db.close();
    }
  });
});
