export type SnapshotWriteOptions = {
  snapshotKey?: string;
  updatedAt?: string;
};

export type ReportingProjectionPayload = Record<string, unknown> | Record<string, unknown>[] | null;

export type SqliteMigrationRecord = {
  id: string;
  appliedAt?: string;
};

export const ACTIVE_BUSINESS_SNAPSHOT_KEY: string;
export const BUSINESS_SNAPSHOT_STATE_TABLE: string;
export const DECLARATION_SNAPSHOT_DOMAIN_KEY: string;
export const DECLARATION_SNAPSHOT_ROW_TABLE: string;
export const DEFAULT_MONTHLY_REPORTING_AGGREGATE_KEY: string;
export const MONTHLY_REPORTING_AGGREGATE_KEY: string;
export const REPORT_SCHEDULE_STORAGE_KEY: string;

export function ensureSqliteAuthTables(database: unknown): void;
export function ensureSqliteBusinessSnapshotTables(database: unknown): void;
export function ensureSqliteExportAuditTables(database: unknown): void;
export function ensureSqliteKvStore(database: unknown): void;
export function ensureSqliteTeamRosterTables(database: unknown): void;
export function ensureReportingProjectionTable(database: unknown): void;

export function readAdjustmentRowsSnapshot(
  database: unknown,
  snapshotKey?: string,
): Record<string, unknown>[] | null;
export function readAppliedSqliteMigrations(database: unknown): SqliteMigrationRecord[];
export function readDeclarationRowsSnapshot(
  database: unknown,
  snapshotKey?: string,
): Record<string, unknown>[] | null;
export function readMstAssignmentRowsSnapshot(
  database: unknown,
  snapshotKey?: string,
): Record<string, unknown>[] | null;
export function readRuleCollectionSnapshot(
  database: unknown,
  snapshotKey?: string,
): Record<string, unknown> | null;
export function readTeamRosterSnapshot(
  database: unknown,
  snapshotKey?: string,
): Record<string, unknown> | null;

export function writeAdjustmentRowsSnapshot(
  database: unknown,
  rows: readonly Record<string, unknown>[],
  options?: SnapshotWriteOptions,
): void;
export function writeDeclarationRowsSnapshot(
  database: unknown,
  rows: readonly Record<string, unknown>[],
  options?: SnapshotWriteOptions,
): void;
export function writeMstAssignmentRowsSnapshot(
  database: unknown,
  rows: readonly Record<string, unknown>[],
  options?: SnapshotWriteOptions,
): void;
export function writeRuleCollectionSnapshot(
  database: unknown,
  collection: Record<string, unknown>,
  options?: SnapshotWriteOptions,
): void;
export function writeTeamRosterSnapshot(
  database: unknown,
  roster: Record<string, unknown>,
  options?: SnapshotWriteOptions,
): void;

export function deleteReportingProjectionValue(database: unknown, key: string): void;
export function readReportingProjectionValue(database: unknown, key: string): ReportingProjectionPayload;
export function writeReportingProjectionValue(
  database: unknown,
  key: string,
  value: ReportingProjectionPayload,
): void;

export function readReportingJobRunProjectionEntries<T extends Record<string, unknown>>(
  database: unknown,
  snapshotKey: string,
): T[];
export function readReportingMonthlyAggregateProjectionEntries<T extends Record<string, unknown>>(
  database: unknown,
  snapshotKey: string,
): T[];
export function readReportingScheduleProjectionEntries<T extends Record<string, unknown>>(
  database: unknown,
  snapshotKey: string,
): T[];

export function createReportingProjectionStore(storage?: {
  readJsonValue?: (key: string, fallback: unknown) => unknown;
  writeJsonValue?: (key: string, value: unknown, options?: unknown) => void;
  deleteValue?: (key: string, options?: unknown) => void;
  readProjectionValue?: (key: string) => unknown;
  writeProjectionValue?: (key: string, value: unknown, options?: unknown) => void;
  deleteProjectionValue?: (key: string, options?: unknown) => void;
}): {
  readMonthlyAggregateSnapshot: (snapshotKey?: string) => Record<string, unknown> | null;
  readDefaultMonthlyAggregateSnapshot: () => Record<string, unknown> | null;
  writeMonthlyAggregateSnapshot: (
    snapshot: Record<string, unknown>,
    options?: { snapshotKey?: string },
  ) => Record<string, unknown> | null;
  deleteMonthlyAggregateSnapshot: (snapshotKey?: string, options?: unknown) => void;
  readMonthlyAggregateQuery: (
    snapshotInput?: Record<string, unknown> | null,
  ) => { from: string; to: string; limit?: number } | null;
  readCachedMonthlyAggregateSnapshot: (
    query: unknown,
    snapshotKey?: string,
  ) => Record<string, unknown> | null;
  buildMonthlyAggregateStatus: (snapshot: unknown) => Record<string, unknown>;
  readScheduleEntries: () => Record<string, unknown>[];
  writeScheduleEntries: (entries: unknown[], options?: unknown) => Record<string, unknown>[];
  readJobRuns: (options?: { limit?: number }) => Record<string, unknown>[];
  writeJobRuns: (entries: unknown[], options?: { limit?: number }) => Record<string, unknown>[];
  appendJobRun: (entry: unknown, options?: { limit?: number }) => Record<string, unknown>[];
};

export function searchDeclarationSnapshot(
  database: unknown,
  rawFilters?: Record<string, unknown>,
  options?: {
    snapshotKey?: string;
    page?: number;
    pageSize?: number;
  },
): {
  total: number;
  page: number;
  pageSize: number;
  rows: Record<string, unknown>[];
} | null;
