export const DEFAULT_REPORTING_OBSERVABILITY_PAGE_SIZE: number;
export const MAX_REPORTING_OBSERVABILITY_PAGE_SIZE: number;

export function buildReportingJobRunCollection(
  input: unknown,
  options?: {
    search?: string;
    status?: 'all' | 'success' | 'error';
    page?: number;
    pageSize?: number;
  },
): {
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
  items: Record<string, unknown>[];
};

export function buildMonthlyAggregateCollection(
  input: unknown,
  options?: {
    search?: string;
    page?: number;
    pageSize?: number;
  },
): {
  total: number;
  filteredTotal: number;
  totalDecls: number;
  totalItems: number;
  totalCompanies: number;
  averageKpi: number;
  peakPeriod: Record<string, unknown> | null;
  search: string;
  page: number;
  pageSize: number;
  pageCount: number;
  items: Record<string, unknown>[];
};
