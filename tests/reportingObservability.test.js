import { describe, expect, it } from 'vitest';

import {
  buildReportingJobRun,
  normalizeReportingJobRuns,
  summarizeReportingJobRuns,
} from '@kpi/backend-shared/reporting';
import {
  buildMonthlyAggregateCollection,
  buildReportingJobRunCollection,
} from '@kpi/backend-shared/reporting';

describe('reportingObservability', () => {
  it('normalizes reporting job runs and sorts newest first', () => {
    const runs = normalizeReportingJobRuns([
      {
        job: 'reporting-monthly-aggregate-materialize',
        status: 'success',
        finishedAt: '2026-03-12T10:15:00.000Z',
      },
      {
        job: 'reporting-monthly-aggregate-materialize',
        status: 'error',
        finishedAt: '2026-03-12T08:15:00.000Z',
        error: 'boom',
      },
    ]);

    expect(runs).toEqual([
      expect.objectContaining({
        job: 'reporting-monthly-aggregate-materialize',
        status: 'success',
        finishedAt: '2026-03-12T10:15:00.000Z',
      }),
      expect.objectContaining({
        job: 'reporting-monthly-aggregate-materialize',
        status: 'error',
        finishedAt: '2026-03-12T08:15:00.000Z',
        error: 'boom',
      }),
    ]);
  });

  it('summarizes success and failure timestamps', () => {
    const summary = summarizeReportingJobRuns([
      buildReportingJobRun({
        job: 'reporting-monthly-aggregate-materialize',
        status: 'success',
        finishedAt: '2026-03-12T10:15:00.000Z',
      }),
      buildReportingJobRun({
        job: 'reporting-monthly-aggregate-materialize',
        status: 'error',
        finishedAt: '2026-03-12T11:15:00.000Z',
        error: 'boom',
      }),
    ]);

    expect(summary).toEqual({
      total: 2,
      successCount: 1,
      failureCount: 1,
      lastSuccessAt: '2026-03-12T10:15:00.000Z',
      lastFailureAt: '2026-03-12T11:15:00.000Z',
      items: [
        expect.objectContaining({
          status: 'error',
          finishedAt: '2026-03-12T11:15:00.000Z',
        }),
        expect.objectContaining({
          status: 'success',
          finishedAt: '2026-03-12T10:15:00.000Z',
        }),
      ],
    });
  });

  it('filters and paginates reporting job runs', () => {
    const collection = buildReportingJobRunCollection(
      [
        buildReportingJobRun({
          id: 'run-1',
          job: 'reporting-monthly-aggregate-materialize',
          status: 'success',
          source: 'reporting-monthly-aggregates',
          actor: 'admin',
          finishedAt: '2026-03-12T10:15:00.000Z',
        }),
        buildReportingJobRun({
          id: 'run-2',
          job: 'reporting-monthly-aggregate-materialize',
          status: 'success',
          source: 'reporting-monthly-aggregates',
          actor: 'system',
          finishedAt: '2026-03-12T11:15:00.000Z',
        }),
        buildReportingJobRun({
          id: 'run-3',
          job: 'reporting-monthly-aggregate-materialize',
          status: 'error',
          source: 'reporting-monthly-aggregates',
          actor: 'system',
          finishedAt: '2026-03-12T09:15:00.000Z',
          error: 'boom',
        }),
      ],
      {
        search: 'aggregate',
        status: 'success',
        page: 2,
        pageSize: 1,
      }
    );

    expect(collection).toEqual({
      total: 3,
      filteredTotal: 2,
      successCount: 2,
      failureCount: 0,
      lastSuccessAt: '2026-03-12T11:15:00.000Z',
      lastFailureAt: null,
      search: 'aggregate',
      status: 'success',
      page: 2,
      pageSize: 1,
      pageCount: 2,
      items: [
        expect.objectContaining({
          id: 'run-1',
          status: 'success',
          finishedAt: '2026-03-12T10:15:00.000Z',
        }),
      ],
    });
  });

  it('builds paginated monthly aggregate stats from filtered periods', () => {
    const collection = buildMonthlyAggregateCollection(
      [
        {
          period: '2026-01',
          label: '01/2026',
          range: {
            from: '2026-01-01',
            to: '2026-01-31',
          },
          summary: {
            decls: 1,
            items: 2,
            companyCount: 1,
            kpi: 0.4,
          },
          topTeams: [{ name: 'Red Team' }],
          topStaff: [{ name: 'Minh' }],
        },
        {
          period: '2026-02',
          label: '02/2026',
          range: {
            from: '2026-02-01',
            to: '2026-02-28',
          },
          summary: {
            decls: 3,
            items: 4,
            companyCount: 2,
            kpi: 0.8,
          },
          topTeams: [{ name: 'Blue Team' }],
          topStaff: [{ name: 'Lan' }],
        },
      ],
      {
        search: '02/2026',
        pageSize: 1,
      }
    );

    expect(collection).toEqual({
      total: 2,
      filteredTotal: 1,
      totalDecls: 3,
      totalItems: 4,
      totalCompanies: 2,
      averageKpi: 0.8,
      peakPeriod: expect.objectContaining({
        period: '2026-02',
        kpi: 0.8,
      }),
      search: '02/2026',
      page: 1,
      pageSize: 1,
      pageCount: 1,
      items: [
        expect.objectContaining({
          period: '2026-02',
          label: '02/2026',
          decls: 3,
          itemCount: 4,
          companyCount: 2,
          kpi: 0.8,
          topTeamCount: 1,
          topStaffCount: 1,
        }),
      ],
    });
  });
});
