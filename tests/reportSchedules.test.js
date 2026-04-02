import { describe, expect, it, vi } from 'vitest';

import {
  REPORT_SCHEDULE_KEY,
  calculateNextReportScheduleRun,
  createReportScheduleStore,
} from '@/lib/reportSchedules.js';

function createInMemoryScheduleStore() {
  const storage = new Map();
  const getItem = (key) => (storage.has(key) ? storage.get(key) : null);
  const setItem = (key, value) => {
    storage.set(key, value);
  };
  const refreshSharedKeys = vi.fn();
  const pushAuditLog = vi.fn();

  const scheduleStore = createReportScheduleStore({
    getItem,
    setItem,
    refreshSharedKeys,
    pushAuditLog,
  });

  return {
    storage,
    refreshSharedKeys,
    pushAuditLog,
    scheduleStore,
  };
}

describe('reportSchedules', () => {
  it('calculates next weekly run from a reference date', () => {
    const reference = new Date('2024-09-02T07:00:00.000Z');
    const nextRunIso = calculateNextReportScheduleRun(
      {
        frequency: 'weekly',
        dayOfWeek: 3,
        time: '09:30',
      },
      { fromDate: reference },
    );

    expect(typeof nextRunIso).toBe('string');

    const runDate = new Date(nextRunIso || 0);
    expect(runDate.getTime()).toBeGreaterThan(reference.getTime());
    expect(runDate.getDay()).toBe(3);
    expect(runDate.getHours()).toBe(9);
    expect(runDate.getMinutes()).toBe(30);
  });

  it('clamps monthly schedules to the last day of the month', () => {
    const reference = new Date('2024-01-31T10:00:00.000Z');
    const nextRunIso = calculateNextReportScheduleRun(
      {
        frequency: 'monthly',
        dayOfMonth: 31,
        time: '06:45',
      },
      { fromDate: reference },
    );

    expect(typeof nextRunIso).toBe('string');

    const runDate = new Date(nextRunIso || 0);
    expect(runDate.getFullYear()).toBe(2024);
    expect(runDate.getMonth()).toBe(1);
    expect(runDate.getDate()).toBe(29);
    expect(runDate.getHours()).toBe(6);
    expect(runDate.getMinutes()).toBe(45);
  });

  it('normalizes recipients and formats when saving schedules', () => {
    const { refreshSharedKeys, pushAuditLog, scheduleStore, storage } = createInMemoryScheduleStore();

    const saved = scheduleStore.saveReportSchedule({
      name: 'Báo cáo tuần',
      recipients: 'boss@example.com, support@example.com ; boss@example.com ',
      frequency: 'monthly',
      dayOfMonth: 5,
      time: '08:15',
      formats: ['excel', 'pdf', 'pdf', 'csv'],
    });

    expect(saved.id).toBeTruthy();
    expect(saved.recipients).toEqual(['boss@example.com', 'support@example.com']);
    expect(saved.formats).toEqual(['excel', 'pdf']);
    expect(typeof saved.nextRun).toBe('string');
    expect(storage.get(REPORT_SCHEDULE_KEY)).toBeTruthy();
    expect(refreshSharedKeys).toHaveBeenCalledWith([REPORT_SCHEDULE_KEY]);
    expect(pushAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'report.schedule.save',
      }),
    );
  });

  it('clears nextRun for inactive schedules', () => {
    const { scheduleStore } = createInMemoryScheduleStore();

    const saved = scheduleStore.saveReportSchedule({
      name: 'Tắt tạm thời',
      frequency: 'weekly',
      dayOfWeek: 2,
      time: '08:00',
      active: false,
      recipients: 'boss@example.com',
    });

    expect(saved.active).toBe(false);
    expect(saved.nextRun).toBe('');
  });

  it('deletes schedules by id', () => {
    const { pushAuditLog, scheduleStore } = createInMemoryScheduleStore();

    const entry = scheduleStore.saveReportSchedule({
      name: 'Tạm thời',
      recipients: 'kpi@example.com',
      frequency: 'weekly',
      dayOfWeek: 1,
      time: '07:00',
    });

    expect(scheduleStore.getReportSchedules()).toHaveLength(1);

    const removed = scheduleStore.deleteReportSchedule(entry.id);

    expect(removed).toBe(true);
    expect(scheduleStore.getReportSchedules()).toHaveLength(0);
    expect(pushAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'report.schedule.delete',
      }),
    );
  });
});
