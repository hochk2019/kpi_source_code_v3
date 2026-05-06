export interface ReportingScheduleRuntimeOptions {
  projectionStore: Record<string, unknown>;
  aggregateRuntime: Record<string, unknown>;
  buildSourceSnapshot?: () => Record<string, unknown>;
  listReportingSchedules?: (entries: unknown, options?: Record<string, unknown>) => Record<string, unknown>;
  upsertReportingSchedule?: (
    entries: unknown,
    entry: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => { saved: Record<string, unknown>; items: Record<string, unknown>[] };
  removeReportingSchedule?: (
    entries: unknown,
    id: string,
  ) => { deleted: boolean; items: Record<string, unknown>[] };
  defaultAggregateSnapshotKey?: string;
}

export interface ReportingScheduleRuntime {
  readSchedules(
    query?: Record<string, unknown>,
    options?: { actor?: string; source?: string },
  ): Record<string, unknown>;
  saveSchedule(
    entry: Record<string, unknown>,
    options?: { actor?: string; source?: string },
  ): { total: number; item: Record<string, unknown> };
  deleteSchedule(
    id: string,
    options?: { actor?: string; source?: string },
  ): { deleted: boolean; total: number };
}

export function createReportingScheduleRuntime(options?: ReportingScheduleRuntimeOptions): ReportingScheduleRuntime;
