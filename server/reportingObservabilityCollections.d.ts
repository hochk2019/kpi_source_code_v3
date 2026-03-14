export const DEFAULT_REPORTING_OBSERVABILITY_PAGE_SIZE: number;
export const MAX_REPORTING_OBSERVABILITY_PAGE_SIZE: number;

export type ReportingJobRunCollectionItem = {
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
  items: ReportingJobRunCollectionItem[];
};

export type ReportingMonthlyAggregateCollectionItem = {
  period: string;
  label: string;
  range: {
    from: string;
    to: string;
  };
  decls: number;
  importCount: number;
  exportCount: number;
  itemCount: number;
  licenseCount: number;
  kpi: number;
  coCount: number;
  coLineCount: number;
  companyCount: number;
  topTeamCount: number;
  topStaffCount: number;
};

export type ReportingMonthlyAggregateCollection = {
  total: number;
  filteredTotal: number;
  totalDecls: number;
  totalItems: number;
  totalCompanies: number;
  averageKpi: number;
  peakPeriod: ReportingMonthlyAggregateCollectionItem | null;
  search: string;
  page: number;
  pageSize: number;
  pageCount: number;
  items: ReportingMonthlyAggregateCollectionItem[];
};

export function buildReportingJobRunCollection(
  input: unknown,
  options?: {
    search?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }
): ReportingJobRunCollection;

export function buildMonthlyAggregateCollection(
  input: unknown,
  options?: {
    search?: string;
    page?: number;
    pageSize?: number;
  }
): ReportingMonthlyAggregateCollection;
