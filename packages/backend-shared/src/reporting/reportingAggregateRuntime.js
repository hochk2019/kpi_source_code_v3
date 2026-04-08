import { DEFAULT_RULES as SHARED_DEFAULT_RULES } from '../../../domain/src/defaultRules.js';
import {
  DEFAULT_MONTHLY_REPORTING_AGGREGATE_KEY,
  MONTHLY_REPORTING_AGGREGATE_KEY,
  REPORTING_JOB_RUNS_KEY,
} from '../persistence/reportingProjectionStore.js';
import { buildReportingJobRun } from './reportingObservability.js';
import {
  buildMonthlyAggregateCollection,
  buildReportingJobRunCollection,
} from './reportingObservabilityCollections.js';
import {
  buildDefaultMonthlyAggregateQuery,
  buildMonthlyAggregateQueryKey,
  buildMonthlyReportingAggregates,
} from './reportingReadModels.js';
import { resolveReportingRule } from './reportingRuleSelection.js';

export const DEFAULT_REPORTING_AGGREGATE_SOURCE_KEYS = new Set([
  'decl_rows_v1',
  'team_roster_v1',
  'kpi_rules_v2',
  'kpi_adjustments_v1',
]);

export function createReportingAggregateRuntime(options = {}) {
  const projectionStore = options.projectionStore;
  if (!projectionStore) {
    throw new Error('createReportingAggregateRuntime() requires projectionStore.');
  }

  const buildSourceSnapshot =
    typeof options.buildSourceSnapshot === 'function'
      ? options.buildSourceSnapshot
      : () => ({
          rows: [],
          roster: { teams: [] },
          rules: SHARED_DEFAULT_RULES,
          adjustments: [],
          schedules: [],
        });
  const aggregateSourceKeys = toSourceKeySet(options.aggregateSourceKeys);
  const buildMonthlyReportingAggregatesImpl =
    options.buildMonthlyReportingAggregates ?? buildMonthlyReportingAggregates;
  const buildMonthlyAggregateCollectionImpl =
    options.buildMonthlyAggregateCollection ?? buildMonthlyAggregateCollection;
  const buildReportingJobRunCollectionImpl =
    options.buildReportingJobRunCollection ?? buildReportingJobRunCollection;
  const buildReportingJobRunImpl = options.buildReportingJobRun ?? buildReportingJobRun;
  const buildMonthlyAggregateQueryKeyImpl =
    options.buildMonthlyAggregateQueryKey ?? buildMonthlyAggregateQueryKey;
  const buildDefaultMonthlyAggregateQueryImpl =
    options.buildDefaultMonthlyAggregateQuery ?? buildDefaultMonthlyAggregateQuery;
  const resolveReportingRuleImpl = options.resolveReportingRule ?? resolveReportingRule;
  const readRelationalMonthlyAggregateEntries =
    typeof options.readRelationalMonthlyAggregateEntries === 'function'
      ? options.readRelationalMonthlyAggregateEntries
      : () => [];
  const readRelationalJobRuns =
    typeof options.readRelationalJobRuns === 'function' ? options.readRelationalJobRuns : () => [];
  const activeSnapshotKey = normalizeText(options.activeSnapshotKey) || MONTHLY_REPORTING_AGGREGATE_KEY;
  const defaultSnapshotKey =
    normalizeText(options.defaultSnapshotKey) || DEFAULT_MONTHLY_REPORTING_AGGREGATE_KEY;
  const jobRunsKey = normalizeText(options.jobRunsKey) || REPORTING_JOB_RUNS_KEY;

  function shouldRefreshMonthlyReportingAggregate(key) {
    return aggregateSourceKeys.has(normalizeText(key));
  }

  function readStoredMonthlyReportingAggregateSnapshot(snapshotKey = activeSnapshotKey) {
    return projectionStore.readMonthlyAggregateSnapshot(snapshotKey);
  }

  function readStoredMonthlyReportingAggregateQuery(
    snapshot = readStoredMonthlyReportingAggregateSnapshot(),
  ) {
    return projectionStore.readMonthlyAggregateQuery(snapshot);
  }

  function buildMonthlyReportingAggregateStatus(snapshot) {
    return projectionStore.buildMonthlyAggregateStatus(snapshot);
  }

  function readReportingViewAggregateStatus(query) {
    if (hasMonthlyReportingAggregateQuery(query)) {
      const snapshot = readStoredMonthlyReportingAggregateSnapshot(activeSnapshotKey);
      const expectedQueryKey = buildMonthlyAggregateQueryKeyImpl(query);
      const actualQueryKey = normalizeText(snapshot?.cache?.queryKey);

      if (!snapshot || actualQueryKey !== expectedQueryKey) {
        return buildMonthlyReportingAggregateStatus(null);
      }

      return buildMonthlyReportingAggregateStatus(snapshot);
    }

    return buildMonthlyReportingAggregateStatus(
      readStoredMonthlyReportingAggregateSnapshot(defaultSnapshotKey),
    );
  }

  function buildReportingViewMeta(query) {
    return {
      servedAt: new Date().toISOString(),
      aggregateStatus: readReportingViewAggregateStatus(query),
    };
  }

  function appendReportingJobRun(entry) {
    return projectionStore.appendJobRun(entry, {
      snapshotKey: jobRunsKey,
    });
  }

  function readReportingObservabilityAggregateItems(snapshotKey, snapshot) {
    const relationalItems = readRelationalMonthlyAggregateEntries(snapshotKey);
    if (Array.isArray(relationalItems) && relationalItems.length > 0) {
      return relationalItems;
    }

    return Array.isArray(snapshot?.items) ? snapshot.items : [];
  }

  function readReportingObservabilityJobRuns() {
    const relationalRuns = readRelationalJobRuns(jobRunsKey);
    if (Array.isArray(relationalRuns) && relationalRuns.length > 0) {
      return relationalRuns;
    }

    return projectionStore.readJobRuns();
  }

  function buildReportingObservabilityPayload(query = {}) {
    const activeSnapshot = readStoredMonthlyReportingAggregateSnapshot(activeSnapshotKey);
    const defaultSnapshot = readStoredMonthlyReportingAggregateSnapshot(defaultSnapshotKey);
    const activeItems = readReportingObservabilityAggregateItems(activeSnapshotKey, activeSnapshot);
    const defaultItems = readReportingObservabilityAggregateItems(defaultSnapshotKey, defaultSnapshot);
    const jobRuns = readReportingObservabilityJobRuns();

    return {
      aggregates: {
        active: buildMonthlyReportingAggregateStatus(activeSnapshot),
        default: buildMonthlyReportingAggregateStatus(defaultSnapshot),
      },
      monthlyStats: {
        active: buildMonthlyAggregateCollectionImpl(activeItems, {
          search: query.periodSearch,
          page: query.periodPage,
          pageSize: query.periodPageSize,
        }),
        default: buildMonthlyAggregateCollectionImpl(defaultItems, {
          search: query.periodSearch,
          page: query.periodPage,
          pageSize: query.periodPageSize,
        }),
      },
      jobs: buildReportingJobRunCollectionImpl(jobRuns, {
        search: query.jobSearch,
        status: query.jobStatus,
        page: query.jobPage,
        pageSize: query.jobPageSize,
      }),
    };
  }

  function resolveReportingObservabilityQuery(req) {
    return {
      jobSearch: normalizeText(req?.query?.jobSearch),
      jobStatus: normalizeText(req?.query?.jobStatus),
      jobPage: resolvePositivePageParam(req?.query?.jobPage),
      jobPageSize: resolvePositivePageSizeParam(req?.query?.jobPageSize),
      periodSearch: normalizeText(req?.query?.periodSearch),
      periodPage: resolvePositivePageParam(req?.query?.periodPage),
      periodPageSize: resolvePositivePageSizeParam(req?.query?.periodPageSize),
    };
  }

  function resolvePositivePageParam(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 1) {
      return 1;
    }

    return Math.trunc(numeric);
  }

  function resolvePositivePageSizeParam(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 1) {
      return undefined;
    }

    return Math.min(Math.trunc(numeric), 100);
  }

  function hasMonthlyReportingAggregateQuery(query) {
    if (!query || typeof query !== 'object' || Array.isArray(query)) {
      return false;
    }

    return Boolean(
      normalizeText(query.from) ||
        normalizeText(query.to) ||
        (Number.isFinite(query.limit) && Number(query.limit) > 0),
    );
  }

  function resolveDefaultMonthlyReportingAggregateQuery(rowsInput) {
    const query = buildDefaultMonthlyAggregateQueryImpl(Array.isArray(rowsInput) ? rowsInput : []);
    return hasMonthlyReportingAggregateQuery(query) ? query : null;
  }

  function buildMonthlyReportingAggregateData(sourceSnapshotInput, query) {
    const sourceSnapshot = normalizeSourceSnapshot(sourceSnapshotInput);
    const selectedRules = resolveReportingRuleImpl(sourceSnapshot.rules, query?.ruleId);

    return buildMonthlyReportingAggregatesImpl(sourceSnapshot.rows, {
      roster: sourceSnapshot.roster,
      rules: selectedRules || SHARED_DEFAULT_RULES,
      from: query?.from,
      to: query?.to,
      adjustments: sourceSnapshot.adjustments,
      limit: query?.limit,
    });
  }

  function readCachedMonthlyReportingAggregateSnapshotFromKey(
    query,
    snapshotKey = activeSnapshotKey,
    options = {},
  ) {
    const cached = projectionStore.readCachedMonthlyAggregateSnapshot(query, snapshotKey);
    if (!cached) {
      return null;
    }

    const sourceSnapshot = options.sourceSnapshot
      ? normalizeSourceSnapshot(options.sourceSnapshot)
      : null;
    const storedSnapshot = sourceSnapshot
      ? readStoredMonthlyReportingAggregateSnapshot(snapshotKey)
      : null;

    if (
      sourceSnapshot &&
      storedSnapshot &&
      isStoredMonthlyReportingAggregateSnapshotStale(storedSnapshot, sourceSnapshot, query)
    ) {
      return null;
    }

    return cached;
  }

  function readRawReportingSourceSnapshot() {
    return normalizeSourceSnapshot(buildSourceSnapshot());
  }

  function materializeStoredMonthlyReportingAggregateSnapshot(sourceSnapshotInput, query, options = {}) {
    const actor = options.actor || 'system';
    const snapshotKey = options.snapshotKey || activeSnapshotKey;
    const source = options.source || 'reporting-monthly-aggregates';
    const startedAt = new Date().toISOString();
    const queryKey = buildMonthlyAggregateQueryKeyImpl(query || {});
    const sourceSnapshot = normalizeSourceSnapshot(sourceSnapshotInput);

    try {
      const data = buildMonthlyReportingAggregateData(sourceSnapshot, query || {});
      const storedSnapshot = attachMonthlyAggregateProjectionState(data, sourceSnapshot, query, {
        actor,
        snapshotKey,
        source,
        invalidatedAt: normalizeText(options.invalidatedAt) || startedAt,
        invalidatedByKey: normalizeText(options.invalidatedByKey),
      });
      projectionStore.writeMonthlyAggregateSnapshot(storedSnapshot, {
        actor,
        snapshotKey,
        source,
      });
      appendReportingJobRun(
        buildReportingJobRunImpl({
          job: 'reporting-monthly-aggregate-materialize',
          status: 'success',
          source,
          actor,
          snapshotKey,
          queryKey,
          range: data.range,
          total: data.total,
          startedAt,
          finishedAt: data.generatedAt,
        }),
      );
      return sanitizeMonthlyAggregateSnapshot(storedSnapshot, {
        queryKey,
        reused: false,
      });
    } catch (error) {
      appendReportingJobRun(
        buildReportingJobRunImpl({
          job: 'reporting-monthly-aggregate-materialize',
          status: 'error',
          source,
          actor,
          snapshotKey,
          queryKey,
          range: {
            from: normalizeText(query?.from),
            to: normalizeText(query?.to),
          },
          startedAt,
          finishedAt: new Date().toISOString(),
          error:
            error instanceof Error
              ? error.message
              : 'Khong the materialize monthly reporting aggregate.',
        }),
      );
      throw error;
    }
  }

  function refreshMonthlyReportingAggregateSnapshot(key, options = {}) {
    if (!shouldRefreshMonthlyReportingAggregate(key)) {
      return;
    }

    const actor = options.actor || 'system';
    const sourceSnapshot = readRawReportingSourceSnapshot();
    const query = readStoredMonthlyReportingAggregateQuery(
      readStoredMonthlyReportingAggregateSnapshot(activeSnapshotKey),
    );
    const invalidatedAt = new Date().toISOString();

    if (query) {
      materializeStoredMonthlyReportingAggregateSnapshot(sourceSnapshot, query, {
        actor,
        snapshotKey: activeSnapshotKey,
        source: options.source || `reporting-monthly-aggregates-refresh:${key}`,
        invalidatedAt,
        invalidatedByKey: key,
      });
    } else {
      projectionStore.deleteMonthlyAggregateSnapshot(activeSnapshotKey);
    }

    const defaultQuery = resolveDefaultMonthlyReportingAggregateQuery(sourceSnapshot.rows);
    if (!defaultQuery) {
      projectionStore.deleteMonthlyAggregateSnapshot(defaultSnapshotKey);
      return;
    }

    materializeStoredMonthlyReportingAggregateSnapshot(sourceSnapshot, defaultQuery, {
      actor,
      snapshotKey: defaultSnapshotKey,
      source: options.source || `reporting-monthly-aggregates-default-refresh:${key}`,
      invalidatedAt,
      invalidatedByKey: key,
    });
  }

  function materializeMonthlyReportingAggregateSnapshot(sourceSnapshotInput, query, options = {}) {
    const snapshotKey = options.snapshotKey || activeSnapshotKey;
    const actor = options.actor || 'system';
    const sourceSnapshot =
      typeof sourceSnapshotInput === 'function' ? sourceSnapshotInput() : sourceSnapshotInput;
    const normalizedSourceSnapshot = normalizeSourceSnapshot(sourceSnapshot);
    const cached = readCachedMonthlyReportingAggregateSnapshotFromKey(query, snapshotKey, {
      sourceSnapshot: normalizedSourceSnapshot,
    });
    if (cached) {
      return cached;
    }

    const data = materializeStoredMonthlyReportingAggregateSnapshot(sourceSnapshot, query, {
      actor,
      snapshotKey,
      source: options.source || 'reporting-monthly-aggregates',
      invalidatedAt: normalizeText(options.invalidatedAt),
      invalidatedByKey: normalizeText(options.invalidatedByKey),
    });

    return cloneJson(data);
  }

  function materializeDefaultMonthlyReportingAggregateSnapshot(sourceSnapshotInput, options = {}) {
    const sourceSnapshot =
      typeof sourceSnapshotInput === 'function' ? sourceSnapshotInput() : sourceSnapshotInput;
    const normalizedSnapshot = normalizeSourceSnapshot(sourceSnapshot);
    const query = resolveDefaultMonthlyReportingAggregateQuery(normalizedSnapshot.rows);

    if (!query) {
      projectionStore.deleteMonthlyAggregateSnapshot(defaultSnapshotKey);
      return null;
    }

    return materializeMonthlyReportingAggregateSnapshot(normalizedSnapshot, query, {
      actor: options.actor,
      snapshotKey: defaultSnapshotKey,
      source: options.source || 'reporting-monthly-aggregates-default',
    });
  }

  return {
    projectionStore,
    shouldRefreshMonthlyReportingAggregate,
    readStoredMonthlyReportingAggregateSnapshot,
    readStoredMonthlyReportingAggregateQuery,
    buildMonthlyReportingAggregateStatus,
    readReportingViewAggregateStatus,
    buildReportingViewMeta,
    appendReportingJobRun,
    buildReportingObservabilityPayload,
    readReportingObservabilityAggregateItems,
    readReportingObservabilityJobRuns,
    resolveReportingObservabilityQuery,
    resolvePositivePageParam,
    resolvePositivePageSizeParam,
    hasMonthlyReportingAggregateQuery,
    resolveDefaultMonthlyReportingAggregateQuery,
    buildMonthlyReportingAggregateData,
    readCachedMonthlyReportingAggregateSnapshotFromKey,
    isStoredMonthlyReportingAggregateSnapshotStale,
    readRawReportingSourceSnapshot,
    materializeStoredMonthlyReportingAggregateSnapshot,
    refreshMonthlyReportingAggregateSnapshot,
    materializeMonthlyReportingAggregateSnapshot,
    materializeDefaultMonthlyReportingAggregateSnapshot,
  };
}

function normalizeSourceSnapshot(input) {
  const source = isRecord(input) ? input : {};

  return {
    rows: Array.isArray(source.rows) ? source.rows : [],
    roster: isRecord(source.roster) ? source.roster : { teams: [] },
    rules: source.rules ?? SHARED_DEFAULT_RULES,
    adjustments: Array.isArray(source.adjustments) ? source.adjustments : [],
    schedules: Array.isArray(source.schedules) ? source.schedules : [],
  };
}

function toSourceKeySet(input) {
  if (input instanceof Set) {
    return input;
  }

  if (Array.isArray(input)) {
    return new Set(input.map((entry) => normalizeText(entry)).filter(Boolean));
  }

  return DEFAULT_REPORTING_AGGREGATE_SOURCE_KEYS;
}

function cloneJson(value) {
  if (value === null || value === undefined) {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}

function attachMonthlyAggregateProjectionState(snapshotInput, sourceSnapshotInput, query, options = {}) {
  const snapshot = isRecord(snapshotInput) ? cloneJson(snapshotInput) : {};
  const sourceSnapshot = normalizeSourceSnapshot(sourceSnapshotInput);
  const rules = isRecord(sourceSnapshot.rules) ? sourceSnapshot.rules : {};
  const refreshedAt = normalizeText(snapshot.generatedAt) || new Date().toISOString();

  return {
    ...snapshot,
    projectionState: {
      schemaVersion: 1,
      snapshotKey: normalizeText(options.snapshotKey),
      refreshedAt,
      refreshedBy: normalizeText(options.actor) || 'system',
      refreshSource: normalizeText(options.source),
      invalidatedAt: normalizeText(options.invalidatedAt),
      invalidatedByKey: normalizeText(options.invalidatedByKey),
      freshnessKey: buildMonthlyAggregateFreshnessKey(sourceSnapshot, query),
      owner: {
        ruleSetId: normalizeText(rules.id) || 'default',
        ruleUpdatedAt: normalizeText(rules.updatedAt),
      },
      sourceCounts: {
        rows: sourceSnapshot.rows.length,
        teams: Array.isArray(sourceSnapshot.roster?.teams) ? sourceSnapshot.roster.teams.length : 0,
        adjustments: sourceSnapshot.adjustments.length,
        schedules: sourceSnapshot.schedules.length,
      },
    },
  };
}

function sanitizeMonthlyAggregateSnapshot(snapshotInput, options = {}) {
  const snapshot = isRecord(snapshotInput) ? cloneJson(snapshotInput) : null;
  if (!snapshot) {
    return null;
  }

  delete snapshot.projectionState;
  const cache = isRecord(snapshot.cache) ? snapshot.cache : {};
  return {
    ...snapshot,
    cache: {
      queryKey: normalizeText(options.queryKey) || normalizeText(cache.queryKey),
      reused: Boolean(options.reused),
    },
  };
}

function isStoredMonthlyReportingAggregateSnapshotStale(snapshotInput, sourceSnapshotInput, query) {
  const snapshot = isRecord(snapshotInput) ? snapshotInput : null;
  if (!snapshot) {
    return true;
  }

  const projectionState = isRecord(snapshot.projectionState) ? snapshot.projectionState : null;
  if (!projectionState) {
    return false;
  }

  const sourceSnapshot = normalizeSourceSnapshot(sourceSnapshotInput);
  const rules = isRecord(sourceSnapshot.rules) ? sourceSnapshot.rules : {};
  const owner = isRecord(projectionState.owner) ? projectionState.owner : {};
  const storedFreshnessKey = normalizeText(projectionState.freshnessKey);
  const expectedFreshnessKey = buildMonthlyAggregateFreshnessKey(sourceSnapshot, query);

  if (storedFreshnessKey && storedFreshnessKey !== expectedFreshnessKey) {
    return true;
  }

  if (
    normalizeText(owner.ruleSetId) &&
    normalizeText(owner.ruleSetId) !== (normalizeText(rules.id) || 'default')
  ) {
    return true;
  }

  if (
    normalizeText(owner.ruleUpdatedAt) &&
    normalizeText(owner.ruleUpdatedAt) !== normalizeText(rules.updatedAt)
  ) {
    return true;
  }

  const invalidatedAt = normalizeText(projectionState.invalidatedAt);
  const refreshedAt = normalizeText(projectionState.refreshedAt);
  return Boolean(invalidatedAt && refreshedAt && invalidatedAt > refreshedAt);
}

function buildMonthlyAggregateFreshnessKey(sourceSnapshot, query) {
  const rules = isRecord(sourceSnapshot.rules) ? sourceSnapshot.rules : {};
  const roster = isRecord(sourceSnapshot.roster) ? sourceSnapshot.roster : {};
  return JSON.stringify({
    queryKey: JSON.stringify({
      from: normalizeText(query?.from),
      to: normalizeText(query?.to),
      limit:
        typeof query?.limit === 'number' && Number.isFinite(query.limit) && query.limit > 0
          ? Math.trunc(query.limit)
          : 0,
    }),
    ruleSetId: normalizeText(rules.id) || 'default',
    ruleUpdatedAt: normalizeText(rules.updatedAt),
    rowCount: Array.isArray(sourceSnapshot.rows) ? sourceSnapshot.rows.length : 0,
    teamCount: Array.isArray(roster.teams) ? roster.teams.length : 0,
    adjustmentCount: Array.isArray(sourceSnapshot.adjustments) ? sourceSnapshot.adjustments.length : 0,
    scheduleCount: Array.isArray(sourceSnapshot.schedules) ? sourceSnapshot.schedules.length : 0,
  });
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}
