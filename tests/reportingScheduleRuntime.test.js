import { describe, expect, it, vi } from 'vitest';

import { createReportingScheduleRuntime } from '@kpi/backend-shared/reporting';

describe('createReportingScheduleRuntime', () => {
  it('reads schedules with aggregate status and materializes the default snapshot when needed', () => {
    const projectionStore = {
      readScheduleEntries: vi.fn(() => [{ id: 'weekly-1', name: 'Weekly KPI' }]),
      writeScheduleEntries: vi.fn(),
    };
    const aggregateRuntime = {
      readStoredMonthlyReportingAggregateSnapshot: vi.fn(() => null),
      materializeDefaultMonthlyReportingAggregateSnapshot: vi.fn(() => ({
        generatedAt: '2026-03-13T10:00:00.000Z',
        total: 2,
      })),
      buildMonthlyReportingAggregateStatus: vi.fn((snapshot) => ({
        available: Boolean(snapshot),
        total: snapshot?.total || 0,
      })),
    };
    const listReportingSchedules = vi.fn((items, options = {}) => ({
      total: items.length,
      items,
      asOf: options.asOf || '',
    }));
    const runtime = createReportingScheduleRuntime({
      projectionStore,
      aggregateRuntime,
      buildSourceSnapshot: () => ({ rows: [{ registerNo: '102026001' }] }),
      listReportingSchedules,
    });

    const data = runtime.readSchedules(
      { asOf: '2026-03-09T07:00:00.000Z' },
      { actor: 'alice' },
    );

    expect(aggregateRuntime.materializeDefaultMonthlyReportingAggregateSnapshot).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        actor: 'alice',
        source: 'reporting-monthly-aggregates-default-schedules',
      }),
    );
    expect(listReportingSchedules).toHaveBeenCalledWith(
      [{ id: 'weekly-1', name: 'Weekly KPI' }],
      expect.objectContaining({ asOf: '2026-03-09T07:00:00.000Z' }),
    );
    expect(data).toEqual({
      total: 1,
      items: [{ id: 'weekly-1', name: 'Weekly KPI' }],
      asOf: '2026-03-09T07:00:00.000Z',
      aggregateStatus: {
        available: true,
        total: 2,
      },
    });
  });

  it('persists schedule saves through the projection store', () => {
    const projectionStore = {
      readScheduleEntries: vi.fn(() => [{ id: 'weekly-1' }]),
      writeScheduleEntries: vi.fn(),
    };
    const aggregateRuntime = {
      readStoredMonthlyReportingAggregateSnapshot: vi.fn(),
      materializeDefaultMonthlyReportingAggregateSnapshot: vi.fn(),
      buildMonthlyReportingAggregateStatus: vi.fn(),
    };
    const upsertReportingSchedule = vi.fn(() => ({
      saved: { id: 'weekly-2', name: 'Monthly KPI', frequency: 'monthly' },
      items: [{ id: 'weekly-1' }, { id: 'weekly-2', name: 'Monthly KPI', frequency: 'monthly' }],
    }));
    const runtime = createReportingScheduleRuntime({
      projectionStore,
      aggregateRuntime,
      upsertReportingSchedule,
    });

    const result = runtime.saveSchedule(
      { name: 'Monthly KPI', frequency: 'monthly' },
      { actor: 'alice', source: 'manual-save' },
    );

    expect(upsertReportingSchedule).toHaveBeenCalledWith(
      [{ id: 'weekly-1' }],
      { name: 'Monthly KPI', frequency: 'monthly' },
      expect.objectContaining({ actor: 'alice' }),
    );
    expect(projectionStore.writeScheduleEntries).toHaveBeenCalledWith(
      [{ id: 'weekly-1' }, { id: 'weekly-2', name: 'Monthly KPI', frequency: 'monthly' }],
      {
        actor: 'alice',
        source: 'manual-save',
      },
    );
    expect(result).toEqual({
      total: 2,
      item: { id: 'weekly-2', name: 'Monthly KPI', frequency: 'monthly' },
    });
  });

  it('does not persist a delete when the schedule does not exist', () => {
    const projectionStore = {
      readScheduleEntries: vi.fn(() => [{ id: 'weekly-1' }]),
      writeScheduleEntries: vi.fn(),
    };
    const aggregateRuntime = {
      readStoredMonthlyReportingAggregateSnapshot: vi.fn(),
      materializeDefaultMonthlyReportingAggregateSnapshot: vi.fn(),
      buildMonthlyReportingAggregateStatus: vi.fn(),
    };
    const removeReportingSchedule = vi.fn(() => ({
      deleted: false,
      items: [{ id: 'weekly-1' }],
    }));
    const runtime = createReportingScheduleRuntime({
      projectionStore,
      aggregateRuntime,
      removeReportingSchedule,
    });

    const result = runtime.deleteSchedule('missing-id', { actor: 'alice' });

    expect(removeReportingSchedule).toHaveBeenCalledWith([{ id: 'weekly-1' }], 'missing-id');
    expect(projectionStore.writeScheduleEntries).not.toHaveBeenCalled();
    expect(result).toEqual({
      deleted: false,
      total: 1,
    });
  });

  it('persists schedule deletes through the projection store', () => {
    const projectionStore = {
      readScheduleEntries: vi.fn(() => [{ id: 'weekly-1' }, { id: 'weekly-2' }]),
      writeScheduleEntries: vi.fn(),
    };
    const aggregateRuntime = {
      readStoredMonthlyReportingAggregateSnapshot: vi.fn(),
      materializeDefaultMonthlyReportingAggregateSnapshot: vi.fn(),
      buildMonthlyReportingAggregateStatus: vi.fn(),
    };
    const removeReportingSchedule = vi.fn(() => ({
      deleted: true,
      items: [{ id: 'weekly-2' }],
    }));
    const runtime = createReportingScheduleRuntime({
      projectionStore,
      aggregateRuntime,
      removeReportingSchedule,
    });

    const result = runtime.deleteSchedule('weekly-1', {
      actor: 'alice',
      source: 'manual-delete',
    });

    expect(projectionStore.writeScheduleEntries).toHaveBeenCalledWith(
      [{ id: 'weekly-2' }],
      {
        actor: 'alice',
        source: 'manual-delete',
      },
    );
    expect(result).toEqual({
      deleted: true,
      total: 1,
    });
  });
});
