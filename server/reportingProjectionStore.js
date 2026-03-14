import { buildMonthlyAggregateQueryKey } from './reportingReadModels.js';
import {
  DEFAULT_REPORTING_JOB_RUN_LIMIT,
  REPORTING_JOB_RUNS_KEY,
  buildReportingJobRun,
  normalizeReportingJobRuns,
} from './reportingObservability.js';

export const MONTHLY_REPORTING_AGGREGATE_KEY = 'kpi_reporting_monthly_aggregates_v1';
export const DEFAULT_MONTHLY_REPORTING_AGGREGATE_KEY = 'kpi_reporting_monthly_aggregates_default_v1';
export const REPORT_SCHEDULE_STORAGE_KEY = 'kpi_report_schedule_v1';
export { REPORTING_JOB_RUNS_KEY } from './reportingObservability.js';

export function createReportingProjectionStore(storage = {}) {
  const readJsonValue =
    typeof storage.readJsonValue === 'function' ? storage.readJsonValue : (_key, fallback) => fallback;
  const writeJsonValue = typeof storage.writeJsonValue === 'function' ? storage.writeJsonValue : () => {};
  const deleteValue = typeof storage.deleteValue === 'function' ? storage.deleteValue : () => {};
  const readProjectionValue =
    typeof storage.readProjectionValue === 'function' ? storage.readProjectionValue : () => null;
  const writeProjectionValue =
    typeof storage.writeProjectionValue === 'function'
      ? storage.writeProjectionValue
      : (key, value, options) => writeJsonValue(key, value, options);
  const deleteProjectionValue =
    typeof storage.deleteProjectionValue === 'function'
      ? storage.deleteProjectionValue
      : (key, options) => deleteValue(key, options);

  function readMonthlyAggregateSnapshot(snapshotKey = MONTHLY_REPORTING_AGGREGATE_KEY) {
    const snapshot = readProjectionValue(snapshotKey) ?? readJsonValue(snapshotKey, null);
    return isRecord(snapshot) ? snapshot : null;
  }

  function readDefaultMonthlyAggregateSnapshot() {
    return readMonthlyAggregateSnapshot(DEFAULT_MONTHLY_REPORTING_AGGREGATE_KEY);
  }

  function writeMonthlyAggregateSnapshot(snapshot, options = {}) {
    if (!isRecord(snapshot)) {
      return null;
    }

    const snapshotKey = normalizeText(options.snapshotKey) || MONTHLY_REPORTING_AGGREGATE_KEY;
    writeProjectionValue(snapshotKey, snapshot, options);
    return readMonthlyAggregateSnapshot(snapshotKey);
  }

  function deleteMonthlyAggregateSnapshot(snapshotKey = MONTHLY_REPORTING_AGGREGATE_KEY, options = {}) {
    deleteProjectionValue(snapshotKey, options);
  }

  function readMonthlyAggregateQuery(snapshotInput = readMonthlyAggregateSnapshot()) {
    const snapshot = isRecord(snapshotInput) ? snapshotInput : null;
    if (!snapshot) {
      return null;
    }

    return parseMonthlyAggregateQueryKey(snapshot?.cache?.queryKey);
  }

  function readCachedMonthlyAggregateSnapshot(query, snapshotKey = MONTHLY_REPORTING_AGGREGATE_KEY) {
    const snapshot = readMonthlyAggregateSnapshot(snapshotKey);
    if (!snapshot) {
      return null;
    }

    const queryKey = buildMonthlyAggregateQueryKey(query);
    if (normalizeText(snapshot?.cache?.queryKey) !== queryKey) {
      return null;
    }

    return toCachedMonthlyAggregateSnapshot(snapshot, queryKey);
  }

  function buildMonthlyAggregateStatus(snapshot) {
    if (!isRecord(snapshot)) {
      return {
        available: false,
        generatedAt: '',
        queryKey: '',
        total: 0,
        range: {
          from: '',
          to: '',
        },
      };
    }

    return {
      available: true,
      generatedAt: normalizeText(snapshot.generatedAt),
      queryKey: normalizeText(snapshot?.cache?.queryKey),
      total: toPositiveInt(snapshot.total, 0),
      range: {
        from: normalizeText(snapshot?.range?.from),
        to: normalizeText(snapshot?.range?.to),
      },
    };
  }

  function readScheduleEntries() {
    const stored = readProjectionValue(REPORT_SCHEDULE_STORAGE_KEY) ?? readJsonValue(REPORT_SCHEDULE_STORAGE_KEY, []);
    return Array.isArray(stored) ? stored.filter(isRecord) : [];
  }

  function writeScheduleEntries(entries, options = {}) {
    const normalized = Array.isArray(entries) ? entries.filter(isRecord) : [];
    writeProjectionValue(REPORT_SCHEDULE_STORAGE_KEY, normalized, options);
    return normalized;
  }

  function readJobRuns(options = {}) {
    const stored = readProjectionValue(REPORTING_JOB_RUNS_KEY) ?? readJsonValue(REPORTING_JOB_RUNS_KEY, []);
    return normalizeReportingJobRuns(stored, {
      limit: options.limit,
    });
  }

  function writeJobRuns(entries, options = {}) {
    const normalized = normalizeReportingJobRuns(entries, {
      limit: options.limit || DEFAULT_REPORTING_JOB_RUN_LIMIT,
    });
    writeProjectionValue(REPORTING_JOB_RUNS_KEY, normalized, options);
    return normalized;
  }

  function appendJobRun(entry, options = {}) {
    const normalizedEntry = buildReportingJobRun(entry);
    return writeJobRuns([normalizedEntry, ...readJobRuns(options)], options);
  }

  return {
    readMonthlyAggregateSnapshot,
    readDefaultMonthlyAggregateSnapshot,
    writeMonthlyAggregateSnapshot,
    deleteMonthlyAggregateSnapshot,
    readMonthlyAggregateQuery,
    readCachedMonthlyAggregateSnapshot,
    buildMonthlyAggregateStatus,
    readScheduleEntries,
    writeScheduleEntries,
    readJobRuns,
    writeJobRuns,
    appendJobRun,
  };
}

function parseMonthlyAggregateQueryKey(input) {
  const queryKey = normalizeText(input);
  if (!queryKey) {
    return null;
  }

  const parsed = safeParse(queryKey, null);
  if (!isRecord(parsed)) {
    return null;
  }

  const limit = toPositiveInt(parsed.limit, 0);
  return {
    from: normalizeText(parsed.from),
    to: normalizeText(parsed.to),
    limit: limit > 0 ? limit : undefined,
  };
}

function safeParse(json, fallback) {
  if (json === null || json === undefined) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(json);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function cloneJson(value) {
  if (value === null || value === undefined) {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}

function toCachedMonthlyAggregateSnapshot(snapshot, queryKey) {
  const cloned = cloneJson(snapshot);
  if (!isRecord(cloned)) {
    return null;
  }

  delete cloned.projectionState;
  return {
    ...cloned,
    cache: {
      queryKey,
      reused: true,
    },
  };
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function toPositiveInt(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback;
  }

  return Math.trunc(numeric);
}
