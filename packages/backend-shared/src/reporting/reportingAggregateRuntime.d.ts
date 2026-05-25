export const DEFAULT_REPORTING_AGGREGATE_SOURCE_KEYS: Set<string>;

export interface ReportingAggregateRuntimeOptions {
  projectionStore: Record<string, unknown>;
  buildSourceSnapshot?: () => Record<string, unknown>;
  aggregateSourceKeys?: Set<string> | string[];
  buildMonthlyReportingAggregates?: (rows: unknown[], options: Record<string, unknown>) => Record<string, unknown>;
  buildMonthlyAggregateCollection?: (items: unknown[], options: Record<string, unknown>) => Record<string, unknown>;
  buildReportingJobRunCollection?: (items: unknown[], options: Record<string, unknown>) => Record<string, unknown>;
  buildReportingJobRun?: (input: Record<string, unknown>) => Record<string, unknown>;
  buildMonthlyAggregateQueryKey?: (query: Record<string, unknown>) => string;
  buildDefaultMonthlyAggregateQuery?: (rows: unknown[]) => Record<string, unknown>;
  resolveReportingRule?: (input: unknown, requestedId: string) => Record<string, unknown> | null;
  readRelationalMonthlyAggregateEntries?: (key: string) => Record<string, unknown>[];
  readRelationalJobRuns?: (key: string) => Record<string, unknown>[];
  activeSnapshotKey?: string;
  defaultSnapshotKey?: string;
  jobRunsKey?: string;
}

export interface ReportingAggregateRuntime {
  projectionStore: Record<string, unknown>;
  shouldRefreshMonthlyReportingAggregate(key: string): boolean;
  readStoredMonthlyReportingAggregateSnapshot(snapshotKey?: string): Record<string, unknown> | null;
  readStoredMonthlyReportingAggregateQuery(
    snapshot?: Record<string, unknown> | null,
  ): { from: string; to: string; limit?: number } | null;
  buildMonthlyReportingAggregateStatus(snapshot: unknown): Record<string, unknown>;
  readReportingViewAggregateStatus(query: unknown): Record<string, unknown>;
  buildReportingViewMeta(query: unknown): Record<string, unknown>;
  appendReportingJobRun(entry: Record<string, unknown>): Record<string, unknown>[];
  buildReportingObservabilityPayload(query?: Record<string, unknown>): Record<string, unknown>;
  readReportingObservabilityAggregateItems(
    snapshotKey: string,
    snapshot: Record<string, unknown> | null,
  ): Record<string, unknown>[];
  readReportingObservabilityJobRuns(): Record<string, unknown>[];
  resolveReportingObservabilityQuery(req: unknown): Record<string, unknown>;
  resolvePositivePageParam(value: unknown): number;
  resolvePositivePageSizeParam(value: unknown): number | undefined;
  hasMonthlyReportingAggregateQuery(query: unknown): boolean;
  resolveDefaultMonthlyReportingAggregateQuery(
    rowsInput: unknown[],
  ): { from: string; to: string } | null;
  buildMonthlyReportingAggregateData(
    sourceSnapshotInput: unknown,
    query: Record<string, unknown> | null,
  ): Record<string, unknown>;
  readCachedMonthlyReportingAggregateSnapshotFromKey(
    query: unknown,
    snapshotKey?: string,
    options?: { sourceSnapshot?: unknown },
  ): Record<string, unknown> | null;
  isStoredMonthlyReportingAggregateSnapshotStale(
    snapshotInput: unknown,
    sourceSnapshotInput: unknown,
    query: unknown,
  ): boolean;
  readRawReportingSourceSnapshot(): Record<string, unknown>;
  materializeStoredMonthlyReportingAggregateSnapshot(
    sourceSnapshotInput: unknown,
    query: Record<string, unknown> | null,
    options?: { actor?: string; snapshotKey?: string; source?: string; invalidatedAt?: string; invalidatedByKey?: string },
  ): Record<string, unknown>;
  refreshMonthlyReportingAggregateSnapshot(
    key: string,
    options?: { actor?: string; source?: string },
  ): void;
  materializeMonthlyReportingAggregateSnapshot(
    sourceSnapshotInput: unknown,
    query: Record<string, unknown> | null,
    options?: { actor?: string; snapshotKey?: string; source?: string; invalidatedAt?: string; invalidatedByKey?: string },
  ): Record<string, unknown> | null;
  materializeDefaultMonthlyReportingAggregateSnapshot(
    sourceSnapshotInput: unknown,
    options?: { actor?: string; source?: string },
  ): Record<string, unknown> | null;
}

export function createReportingAggregateRuntime(options?: ReportingAggregateRuntimeOptions): ReportingAggregateRuntime;
