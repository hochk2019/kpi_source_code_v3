export type LegacyReportRow = Record<string, unknown>;

export type LegacyReportStats = {
  decls: number;
  import: number;
  export: number;
  items: number;
  licenses: number;
  kpi: number;
  co: number;
  coLines: number;
  companyCount: number;
  licenseSummary?: string;
  adjustmentTotals?: Record<string, unknown>;
  licenseCodes?: string[];
  licenseCount?: number;
};

export type LegacyCompanySummaryRow = Record<string, unknown>;

export type LegacyReportListItem = Record<string, unknown> & {
  key: string;
  name: string;
  teamLabel?: string;
  memberNames?: string[];
  rows?: LegacyReportRow[];
  stats?: Partial<LegacyReportStats>;
  adjustmentSummary?: Record<string, unknown>;
  companies?: LegacyCompanySummaryRow[];
};

export type LegacyReportData = {
  range: {
    from: string;
    to: string;
  };
  rules: {
    id: string;
    name: string;
  };
  summary: LegacyReportStats;
  trend: {
    series: unknown[];
    teamSeries: unknown[];
    comparison: unknown;
    topTeams: unknown[];
  };
  adjustments: {
    list?: Record<string, unknown>[];
    applied?: Record<string, unknown>[];
    totalsByCategory?: Record<string, unknown>;
    totalPoints?: number;
    pendingCount?: number;
    approvedCount?: number;
    rejectedCount?: number;
    appliedCount?: number;
  };
  staff: {
    list: LegacyReportListItem[];
    keysHash: string;
  };
  teams: {
    list: LegacyReportListItem[];
    keysHash: string;
  };
};

export type ReportingReadModels = {
  summary: {
    range: {
      from: string;
      to: string;
    };
    ruleSet: {
      id: string;
      name: string;
    };
    summary: LegacyReportStats;
    trend: LegacyReportData['trend'];
    adjustments: {
      list: Record<string, unknown>[];
      applied: Record<string, unknown>[];
      totalPoints: number;
      pendingCount: number;
      approvedCount: number;
      rejectedCount: number;
      appliedCount: number;
      totalsByCategory: Record<string, unknown>;
    };
    companies: {
      staff: LegacyCompanySummaryRow[];
      teams: LegacyCompanySummaryRow[];
    };
  };
  staff: {
    range: {
      from: string;
      to: string;
    };
    ruleSet: {
      id: string;
      name: string;
    };
    total: number;
    keysHash: string;
    items: LegacyReportListItem[];
  };
  teams: {
    range: {
      from: string;
      to: string;
    };
    ruleSet: {
      id: string;
      name: string;
    };
    total: number;
    keysHash: string;
    items: LegacyReportListItem[];
  };
};

export function buildLegacyReportData(
  rowsInput: readonly Record<string, unknown>[],
  options?: Record<string, unknown>,
): LegacyReportData;

export function aggregateLegacyCompanies(
  rowsInput: readonly Record<string, unknown>[],
  options?: Record<string, unknown>,
): LegacyCompanySummaryRow[];

export type WatermarkPayload = {
  shortSignature?: string | null;
  formattedIssuedAt?: string | null;
  issuedAt?: string | Date | null;
  filterSummary?: string | null;
  requestId?: string | null;
};

export type ReportExportResult = {
  buffer: Buffer;
  filename: string;
  signature?: string | null;
  watermark?: WatermarkPayload | null;
};

export function generateReport(
  kind: string,
  payload?: unknown,
  options?: unknown,
): Promise<ReportExportResult>;

export function clearReportCache(): void;

export type CompactReportExportPayload = {
  exportPayload: Record<string, unknown>;
  auditPayload: Record<string, unknown>;
};

export function buildCompactReportExportPayload(
  kind: string,
  payload?: Record<string, unknown>,
  sourceSnapshotInput?: Record<string, unknown>,
): CompactReportExportPayload | null;

export type ReportingJobRun = Record<string, unknown> & {
  id: string;
  job: string;
  status: string;
  source: string;
  actor: string;
  snapshotKey: string;
  queryKey: string;
  range: {
    from: string;
    to: string;
  };
  total: number;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  error: string;
  meta: Record<string, unknown>;
};

export type ReportingJobRunCollection = {
  total: number;
  filteredTotal: number;
  successCount: number;
  failureCount: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  search: string;
  status: string;
  page: number;
  pageSize: number;
  pageCount: number;
  items: ReportingJobRun[];
};

export type ReportingMonthlyAggregateCollection = {
  total: number;
  filteredTotal: number;
  search: string;
  page: number;
  pageSize: number;
  pageCount: number;
  items: Array<Record<string, unknown>>;
};

export function buildReportingJobRun(input?: Record<string, unknown>): ReportingJobRun;
export function normalizeReportingJobRuns(
  input: unknown,
  options?: Record<string, unknown>,
): ReportingJobRun[];
export function summarizeReportingJobRuns(
  input: unknown,
  options?: Record<string, unknown>,
): ReportingJobRunCollection & { items: ReportingJobRun[] };

export function buildReportingJobRunCollection(
  input: unknown,
  options?: Record<string, unknown>,
): ReportingJobRunCollection;

export function buildMonthlyAggregateCollection(
  input: unknown,
  options?: Record<string, unknown>,
): ReportingMonthlyAggregateCollection;

export function buildReportingReadModels(
  rowsInput: readonly Record<string, unknown>[],
  options?: Record<string, unknown>,
): ReportingReadModels;

export function buildMonthlyReportingAggregates(
  rowsInput: readonly Record<string, unknown>[],
  options?: Record<string, unknown>,
): Record<string, unknown>;

export function buildMonthlyAggregateQueryKey(query?: Record<string, unknown>): string;
export function buildDefaultMonthlyAggregateQuery(
  rowsInput: readonly Record<string, unknown>[],
): Record<string, unknown>;
export function listReportingSchedules(
  entriesInput: readonly Record<string, unknown>[],
  options?: Record<string, unknown>,
): Record<string, unknown>;

export function resolveReportingRule(
  input: Record<string, unknown>,
  requestedIdInput?: string,
): Record<string, unknown> | null;

export const DEFAULT_REPORTING_JOB_RUN_LIMIT: number;
export const REPORTING_JOB_RUNS_KEY: string;
export const DEFAULT_REPORTING_AGGREGATE_SOURCE_KEYS: Set<string>;

export function createReportingAggregateRuntime(options?: Record<string, unknown>): Record<string, unknown>;
export function createReportingScheduleRuntime(options?: Record<string, unknown>): Record<string, unknown>;
export function computeWatermarkSignature(metadata?: Record<string, unknown>): string;
export function applyWorkbookWatermark(workbook: unknown, metadata?: Record<string, unknown>): unknown;
export function sanitizeExportFilters(filters?: Record<string, unknown>): Record<string, unknown>;
export function normalizeStorageValue(value: unknown): string | null;
export function syncReportingProjectionSeeds(
  database: unknown,
  readValue: (key: string) => unknown,
  options?: Record<string, unknown>,
): void;
export function hydrateRuntimeStorageSnapshots(options?: Record<string, unknown>): void;
export function createRuntimeStorageLifecycle(options?: Record<string, unknown>): Record<string, unknown>;
