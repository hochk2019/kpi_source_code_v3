export const MONTHLY_REPORTING_AGGREGATE_KEY: string;
export const DEFAULT_MONTHLY_REPORTING_AGGREGATE_KEY: string;
export const REPORT_SCHEDULE_STORAGE_KEY: string;
export const REPORTING_JOB_RUNS_KEY: string;

type ProjectionStoreOptions = {
  updatedAt?: string;
  source?: string;
  snapshotKey?: string;
  limit?: number;
};

type ProjectionStoreQuery = {
  from?: string;
  to?: string;
  limit?: number;
};

type ProjectionStoreAdapter = {
  readJsonValue?: <T = unknown>(key: string, fallback: T) => T;
  writeJsonValue?: (key: string, value: unknown, options?: ProjectionStoreOptions) => void;
  deleteValue?: (key: string, options?: ProjectionStoreOptions) => void;
  readProjectionValue?: <T = unknown>(key: string) => T | null;
  writeProjectionValue?: (key: string, value: unknown, options?: ProjectionStoreOptions) => void;
  deleteProjectionValue?: (key: string, options?: ProjectionStoreOptions) => void;
};

type MonthlyAggregateStatus = {
  available: boolean;
  generatedAt: string;
  queryKey: string;
  total: number;
  range: {
    from: string;
    to: string;
  };
};

export function createReportingProjectionStore(storage?: ProjectionStoreAdapter): {
  readMonthlyAggregateSnapshot<T = unknown>(snapshotKey?: string): T | null;
  readDefaultMonthlyAggregateSnapshot<T = unknown>(): T | null;
  writeMonthlyAggregateSnapshot<T = unknown>(snapshot: T, options?: ProjectionStoreOptions): T | null;
  deleteMonthlyAggregateSnapshot(snapshotKey?: string, options?: ProjectionStoreOptions): void;
  readMonthlyAggregateQuery(snapshotInput?: unknown): ProjectionStoreQuery | null;
  readCachedMonthlyAggregateSnapshot<T = unknown>(query: ProjectionStoreQuery, snapshotKey?: string): T | null;
  buildMonthlyAggregateStatus(snapshot: unknown): MonthlyAggregateStatus;
  readScheduleEntries<T = unknown>(): T[];
  writeScheduleEntries<T = unknown>(entries: T[], options?: ProjectionStoreOptions): T[];
  readJobRuns<T = unknown>(options?: ProjectionStoreOptions): T[];
  writeJobRuns<T = unknown>(entries: T[], options?: ProjectionStoreOptions): T[];
  appendJobRun<T = unknown>(entry: T, options?: ProjectionStoreOptions): T[];
};
