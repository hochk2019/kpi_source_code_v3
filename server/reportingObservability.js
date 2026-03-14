export const REPORTING_JOB_RUNS_KEY = 'kpi_reporting_job_runs_v1';
export const DEFAULT_REPORTING_JOB_RUN_LIMIT = 20;

export function buildReportingJobRun(input = {}) {
  const startedAt = normalizeTimestamp(input.startedAt || input.started_at);
  const finishedAt = normalizeTimestamp(
    input.finishedAt || input.finished_at || startedAt
  );
  const range = {
    from: normalizeText(input?.range?.from || input.rangeFrom || input.range_from),
    to: normalizeText(input?.range?.to || input.rangeTo || input.range_to),
  };
  const queryKey = normalizeText(input.queryKey || input.query_key);
  const job = normalizeText(input.job) || 'reporting-job';
  const status = normalizeStatus(input.status);
  const total = toNonNegativeInt(input.total, 0);
  const durationMs = resolveDurationMs(input.durationMs || input.duration_ms, startedAt, finishedAt);

  return {
    id:
      normalizeText(input.id) ||
      [job, finishedAt, queryKey || range.from || range.to || 'global'].join(':'),
    job,
    status,
    source: normalizeText(input.source) || 'reporting',
    actor: normalizeText(input.actor) || 'system',
    snapshotKey: normalizeText(input.snapshotKey || input.snapshot_key),
    queryKey,
    range,
    total,
    startedAt,
    finishedAt,
    durationMs,
    error: normalizeText(input.error || input.errorMessage || input.error_message),
    meta: isRecord(input.meta) ? { ...input.meta } : {},
  };
}

export function normalizeReportingJobRuns(input, options = {}) {
  const limit = toNonNegativeInt(options.limit, DEFAULT_REPORTING_JOB_RUN_LIMIT) || DEFAULT_REPORTING_JOB_RUN_LIMIT;
  const entries = Array.isArray(input) ? input.map((entry) => buildReportingJobRun(entry)) : [];

  return entries
    .sort((left, right) => {
      const leftFinished = Date.parse(left.finishedAt);
      const rightFinished = Date.parse(right.finishedAt);
      if (Number.isFinite(leftFinished) || Number.isFinite(rightFinished)) {
        return (Number.isFinite(rightFinished) ? rightFinished : 0) - (Number.isFinite(leftFinished) ? leftFinished : 0);
      }
      return right.startedAt.localeCompare(left.startedAt);
    })
    .slice(0, limit);
}

export function summarizeReportingJobRuns(input, options = {}) {
  const items = normalizeReportingJobRuns(input, options);
  let successCount = 0;
  let failureCount = 0;
  let lastSuccessAt = null;
  let lastFailureAt = null;

  items.forEach((entry) => {
    if (entry.status === 'success') {
      successCount += 1;
      if (!lastSuccessAt || entry.finishedAt > lastSuccessAt) {
        lastSuccessAt = entry.finishedAt;
      }
      return;
    }

    failureCount += 1;
    if (!lastFailureAt || entry.finishedAt > lastFailureAt) {
      lastFailureAt = entry.finishedAt;
    }
  });

  return {
    total: items.length,
    successCount,
    failureCount,
    lastSuccessAt,
    lastFailureAt,
    items,
  };
}

function normalizeStatus(value) {
  return `${value || ''}`.trim().toLowerCase() === 'success' ? 'success' : 'error';
}

function resolveDurationMs(value, startedAt, finishedAt) {
  const explicit = Number(value);
  if (Number.isFinite(explicit) && explicit >= 0) {
    return Math.trunc(explicit);
  }

  const startedTs = Date.parse(startedAt);
  const finishedTs = Date.parse(finishedAt);
  if (!Number.isFinite(startedTs) || !Number.isFinite(finishedTs) || finishedTs < startedTs) {
    return 0;
  }

  return Math.trunc(finishedTs - startedTs);
}

function normalizeTimestamp(value) {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return new Date().toISOString();
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function toNonNegativeInt(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return fallback;
  }

  return Math.trunc(numeric);
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
