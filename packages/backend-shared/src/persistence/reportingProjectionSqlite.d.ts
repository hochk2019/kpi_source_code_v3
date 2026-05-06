export const REPORTING_PROJECTION_TABLE: string;
export const REPORTING_SCHEDULE_ENTRY_TABLE: string;
export const REPORTING_MONTHLY_AGGREGATE_ENTRY_TABLE: string;
export const REPORTING_JOB_RUN_ENTRY_TABLE: string;

export function ensureReportingProjectionTable(database: unknown): void;

export function readReportingProjectionValue(database: unknown, key: string): unknown;

export function readReportingMonthlyAggregateProjectionEntries(
  database: unknown,
  key: string,
): Record<string, unknown>[];

export function readReportingScheduleProjectionEntries(
  database: unknown,
  key: string,
): Record<string, unknown>[];

export function readReportingJobRunProjectionEntries(
  database: unknown,
  key: string,
): Record<string, unknown>[];

export function writeReportingProjectionValue(
  database: unknown,
  key: string,
  value: unknown,
  options?: { updatedAt?: string },
): void;

export function deleteReportingProjectionValue(database: unknown, key: string): void;
