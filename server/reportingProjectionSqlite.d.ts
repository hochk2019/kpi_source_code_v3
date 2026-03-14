export const REPORTING_PROJECTION_TABLE: string;
export const REPORTING_SCHEDULE_ENTRY_TABLE: string;
export const REPORTING_MONTHLY_AGGREGATE_ENTRY_TABLE: string;
export const REPORTING_JOB_RUN_ENTRY_TABLE: string;

type SqliteStatementLike = {
  all(...params: unknown[]): unknown;
  get(...params: unknown[]): unknown;
  run(...params: unknown[]): unknown;
};

type SqliteDatabaseLike = {
  exec(sql: string): unknown;
  prepare(sql: string): SqliteStatementLike;
};

export function ensureReportingProjectionTable(database: SqliteDatabaseLike | null | undefined): void;

export function readReportingProjectionValue<T = unknown>(
  database: SqliteDatabaseLike | null | undefined,
  key: string
): T | null;

export function readReportingMonthlyAggregateProjectionEntries<T = unknown>(
  database: SqliteDatabaseLike | null | undefined,
  key: string
): T[];

export function readReportingJobRunProjectionEntries<T = unknown>(
  database: SqliteDatabaseLike | null | undefined,
  key: string
): T[];

export function writeReportingProjectionValue(
  database: SqliteDatabaseLike | null | undefined,
  key: string,
  value: unknown,
  options?: {
    updatedAt?: string;
  }
): void;

export function deleteReportingProjectionValue(
  database: SqliteDatabaseLike | null | undefined,
  key: string
): void;
