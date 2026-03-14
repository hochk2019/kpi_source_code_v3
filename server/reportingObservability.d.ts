export const REPORTING_JOB_RUNS_KEY: string;
export const DEFAULT_REPORTING_JOB_RUN_LIMIT: number;

export type ReportingJobRunRecord = {
  id: string;
  job: string;
  status: 'success' | 'error';
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

export type ReportingJobRunSummary = {
  total: number;
  successCount: number;
  failureCount: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  items: ReportingJobRunRecord[];
};

export function buildReportingJobRun(input?: Record<string, unknown>): ReportingJobRunRecord;

export function normalizeReportingJobRuns(
  input: unknown,
  options?: {
    limit?: number;
  }
): ReportingJobRunRecord[];

export function summarizeReportingJobRuns(
  input: unknown,
  options?: {
    limit?: number;
  }
): ReportingJobRunSummary;
