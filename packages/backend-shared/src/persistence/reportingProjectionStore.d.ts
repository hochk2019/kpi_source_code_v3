export const MONTHLY_REPORTING_AGGREGATE_KEY: string;
export const DEFAULT_MONTHLY_REPORTING_AGGREGATE_KEY: string;
export const REPORT_SCHEDULE_STORAGE_KEY: string;
export { REPORTING_JOB_RUNS_KEY } from './reportingObservability.js';

export interface ReportingProjectionStoreStorage {
  readJsonValue?: (key: string, fallback: unknown) => unknown;
  writeJsonValue?: (key: string, value: unknown, options?: unknown) => void;
  deleteValue?: (key: string, options?: unknown) => void;
  readProjectionValue?: (key: string) => unknown;
  writeProjectionValue?: (key: string, value: unknown, options?: unknown) => void;
  deleteProjectionValue?: (key: string, options?: unknown) => void;
}

export interface ReportingProjectionStore {
  readMonthlyAggregateSnapshot(snapshotKey?: string): Record<string, unknown> | null;
  readDefaultMonthlyAggregateSnapshot(): Record<string, unknown> | null;
  writeMonthlyAggregateSnapshot(
    snapshot: Record<string, unknown>,
    options?: { snapshotKey?: string; [key: string]: unknown },
  ): Record<string, unknown> | null;
  deleteMonthlyAggregateSnapshot(snapshotKey?: string, options?: unknown): void;
  readMonthlyAggregateQuery(
    snapshotInput?: Record<string, unknown> | null,
  ): { from: string; to: string; limit?: number } | null;
  readCachedMonthlyAggregateSnapshot(
    query: unknown,
    snapshotKey?: string,
  ): Record<string, unknown> | null;
  buildMonthlyAggregateStatus(snapshot: unknown): Record<string, unknown>;
  readScheduleEntries(): Record<string, unknown>[];
  writeScheduleEntries(entries: unknown[], options?: unknown): Record<string, unknown>[];
  readJobRuns(options?: { limit?: number }): Record<string, unknown>[];
  writeJobRuns(entries: unknown[], options?: { limit?: number }): Record<string, unknown>[];
  appendJobRun(entry: unknown, options?: { limit?: number }): Record<string, unknown>[];
}

export function createReportingProjectionStore(storage?: ReportingProjectionStoreStorage): ReportingProjectionStore;
