import {
  DEFAULT_REPORTING_JOB_RUN_LIMIT,
  buildMonthlyAggregateCollection,
  buildReportingJobRun,
  buildReportingJobRunCollection,
  buildReportingReadModels,
  normalizeReportingJobRuns,
  type LegacyCompanySummaryRow,
  type LegacyReportData,
  type ReportingMonthlyAggregateCollection,
} from '@kpi/backend-shared/reporting';
import { ReportingRepository, type ReportingSourceSnapshot } from './ReportingRepository.js';
import {
  normalizeReportingScheduleEntry,
  removeReportingScheduleEntry,
  type ReportingScheduleRecord,
  upsertReportingScheduleEntry,
} from './reportingScheduleNormalizer.js';
import {
  buildDefaultMonthlyAggregateQuery,
  buildMonthlyAggregateQueryKey,
  buildMonthlyReportingAggregates,
  type ReportingMonthlyAggregateResponse,
} from './reportingAggregateBuilder.js';

const ACTIVE_MONTHLY_AGGREGATE_KEY = 'kpi_reporting_monthly_aggregates_v1';
const DEFAULT_MONTHLY_AGGREGATE_KEY = 'kpi_reporting_monthly_aggregates_default_v1';

export type ReportingQuery = {
  from?: string;
  to?: string;
  ruleId?: string;
  limit?: number;
};

export type ReportingSchedulesQuery = {
  asOf?: string;
};

export type ReportingObservabilityQuery = {
  jobSearch?: string;
  jobStatus?: string;
  jobPage?: number;
  jobPageSize?: number;
  periodSearch?: string;
  periodPage?: number;
  periodPageSize?: number;
};

export type ReportingScheduleMutationInput = {
  id?: string;
  name?: string;
  frequency?: 'weekly' | 'monthly';
  time?: string;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  recipients?: string[] | string;
  formats?: string[] | string;
  deliveryChannels?: string[] | string;
  deliveryStatus?: string;
  lastDeliveryAt?: string;
  lastDeliveryError?: string;
  active?: boolean | string;
  lastRun?: string;
  nextRun?: string;
};

type RuleSetReference = {
  id: string;
  name: string;
};

type ReportingAdjustmentsResponse = {
  list: Record<string, unknown>[];
  applied: Record<string, unknown>[];
  totalPoints: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  appliedCount: number;
  totalsByCategory: Record<string, unknown>;
};

type ReportingCompanyGroups = {
  staff: LegacyCompanySummaryRow[];
  teams: LegacyCompanySummaryRow[];
};

type ReportingStaffItemResponse = LegacyReportData['staff']['list'][number] & {
  companies: LegacyCompanySummaryRow[];
};

type ReportingTeamItemResponse = LegacyReportData['teams']['list'][number] & {
  companies: LegacyCompanySummaryRow[];
};

export type ReportingSummaryResponse = {
  range: {
    from: string;
    to: string;
  };
  ruleSet: RuleSetReference;
  summary: LegacyReportData['summary'];
  trend: LegacyReportData['trend'];
  adjustments: ReportingAdjustmentsResponse;
  companies: ReportingCompanyGroups;
};

export type ReportingStaffResponse = {
  range: {
    from: string;
    to: string;
  };
  ruleSet: RuleSetReference;
  total: number;
  keysHash: string;
  items: ReportingStaffItemResponse[];
};

export type ReportingTeamsResponse = {
  range: {
    from: string;
    to: string;
  };
  ruleSet: RuleSetReference;
  total: number;
  keysHash: string;
  items: ReportingTeamItemResponse[];
};

export type ReportingViewResponse = {
  meta: ReportingViewMeta;
  summary: ReportingSummaryResponse;
  staff: ReportingStaffResponse;
  teams: ReportingTeamsResponse;
};

type ReportingViewReadModels = Pick<ReportingViewResponse, 'summary' | 'staff' | 'teams'>;

export type ReportingViewMeta = {
  servedAt: string;
  aggregateStatus: ReportingAggregateStatus;
};

export type ReportingSchedulesResponse = {
  total: number;
  items: ReportingScheduleRecord[];
  aggregateStatus: ReportingAggregateStatus;
};

export type ReportingJobRunResponse = {
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

export type ReportingObservabilityResponse = {
  aggregates: {
    active: ReportingAggregateStatus;
    default: ReportingAggregateStatus;
  };
  monthlyStats: {
    active: ReportingMonthlyAggregateCollection;
    default: ReportingMonthlyAggregateCollection;
  };
  jobs: {
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
    items: ReportingJobRunResponse[];
  };
};

export type { ReportingMonthlyAggregateResponse } from './reportingAggregateBuilder.js';

export type ReportingAggregateStatus = {
  available: boolean;
  generatedAt: string;
  queryKey: string;
  total: number;
  range: {
    from: string;
    to: string;
  };
};

export class ReportingService {
  constructor(private readonly repository: ReportingRepository) {}

  async getView(query: ReportingQuery = {}): Promise<ReportingViewResponse> {
    const metaPromise = this.buildViewMeta(query);
    const snapshot = await this.repository.readReportingSnapshot();
    const selectedRuleSet = resolveRequestedRuleSet(snapshot, query.ruleId);
    const readModels = buildReportingReadModels(snapshot.declarations, {
      roster: snapshot.roster,
      rules: selectedRuleSet,
      from: query.from,
      to: query.to,
      adjustments: snapshot.adjustments,
      limit: query.limit,
    }) as ReportingViewReadModels;

    return {
      meta: await metaPromise,
      ...readModels,
    };
  }

  async getMonthlyAggregates(query: ReportingQuery = {}): Promise<ReportingMonthlyAggregateResponse> {
    const snapshot = await this.repository.readReportingSnapshot();
    if (!hasAggregateQuery(query)) {
      const defaultQuery = buildDefaultMonthlyAggregateQuery(snapshot.declarations);
      const defaultSnapshot = await this.readStoredMonthlyAggregateSnapshot(
        DEFAULT_MONTHLY_AGGREGATE_KEY,
        defaultQuery,
        snapshot,
      );
      if (defaultSnapshot) {
        return defaultSnapshot;
      }

      if (hasAggregateQuery(defaultQuery)) {
        return this.materializeMonthlyAggregateSnapshot(snapshot, defaultQuery, {
          snapshotKey: DEFAULT_MONTHLY_AGGREGATE_KEY,
          source: 'reporting-monthly-aggregates-default',
        });
      }
    }

    const cached = await this.readStoredMonthlyAggregateSnapshot(
      ACTIVE_MONTHLY_AGGREGATE_KEY,
      query,
      snapshot,
    );
    if (cached) {
      return cached;
    }

    return this.materializeMonthlyAggregateSnapshot(snapshot, query, {
      snapshotKey: ACTIVE_MONTHLY_AGGREGATE_KEY,
      source: 'reporting-monthly-aggregates',
    });
  }

  async listSchedules(query: ReportingSchedulesQuery = {}): Promise<ReportingSchedulesResponse> {
    const asOf = resolveAsOfDate(query.asOf);
    const items = (await this.repository.listScheduleEntries())
      .map((entry, index) =>
        normalizeReportingScheduleEntry(entry, {
          fallbackId: `schedule-${index + 1}`,
          fromDate: asOf,
        })
      )
      .filter((entry): entry is ReportingScheduleRecord => Boolean(entry));

    return {
      total: items.length,
      items,
      aggregateStatus: await this.readDefaultAggregateStatus(),
    };
  }

  async getObservability(query: ReportingObservabilityQuery = {}): Promise<ReportingObservabilityResponse> {
    const [activeSnapshot, defaultSnapshot] = await Promise.all([
      this.repository.readRawMonthlyAggregateSnapshot(),
      this.repository.readRawDefaultMonthlyAggregateSnapshot(),
    ]);
    const [activeItems, defaultItems, jobRuns] = await Promise.all([
      this.readObservabilityAggregateItems('kpi_reporting_monthly_aggregates_v1', activeSnapshot),
      this.readObservabilityAggregateItems('kpi_reporting_monthly_aggregates_default_v1', defaultSnapshot),
      this.readObservabilityJobRuns(),
    ]);
    const jobs = buildReportingJobRunCollection(
      jobRuns,
      {
        search: query.jobSearch,
        status: query.jobStatus,
        page: query.jobPage,
        pageSize: query.jobPageSize,
      }
    );

    return {
      aggregates: {
        active: toAggregateStatus(activeSnapshot),
        default: defaultSnapshot
          ? {
              available: true,
              generatedAt: normalizeText(defaultSnapshot.generatedAt),
              queryKey: normalizeText(getRecord(defaultSnapshot.cache).queryKey),
              total: Number(defaultSnapshot.total || 0),
              range: {
                from: normalizeText(getRecord(defaultSnapshot.range).from),
                to: normalizeText(getRecord(defaultSnapshot.range).to),
              },
            }
          : toAggregateStatus(null),
      },
      monthlyStats: {
        active: buildMonthlyAggregateCollection(
          activeItems,
          {
            search: query.periodSearch,
            page: query.periodPage,
            pageSize: query.periodPageSize,
          }
        ),
        default: buildMonthlyAggregateCollection(
          defaultItems,
          {
            search: query.periodSearch,
            page: query.periodPage,
            pageSize: query.periodPageSize,
          }
        ),
      },
      jobs,
    };
  }

  async saveSchedule(input: ReportingScheduleMutationInput): Promise<{
    item: ReportingScheduleRecord;
    total: number;
  }> {
    const { saved, items } = upsertReportingScheduleEntry(
      await this.repository.listScheduleEntries(),
      input,
      {
        fromDate: new Date(),
      }
    );

    await this.repository.writeScheduleEntries(items as unknown as Record<string, unknown>[]);

    return {
      item: saved,
      total: items.length,
    };
  }

  async deleteSchedule(id: string): Promise<{
    deleted: boolean;
    total: number;
  }> {
    const { deleted, items } = removeReportingScheduleEntry(
      await this.repository.listScheduleEntries(),
      id,
    );
    if (!deleted) {
      return {
        deleted: false,
        total: items.length,
      };
    }

    await this.repository.writeScheduleEntries(items as unknown as Record<string, unknown>[]);
    return {
      deleted: true,
      total: items.length,
    };
  }

  private async readStoredMonthlyAggregateSnapshot(
    snapshotKey: string,
    query: ReportingQuery,
    sourceSnapshot: ReportingSourceSnapshot,
  ): Promise<ReportingMonthlyAggregateResponse | null> {
    const snapshot =
      snapshotKey === DEFAULT_MONTHLY_AGGREGATE_KEY
        ? await this.repository.readRawDefaultMonthlyAggregateSnapshot()
        : await this.repository.readRawMonthlyAggregateSnapshot();
    if (!snapshot) {
      return null;
    }

    const queryKey = buildMonthlyAggregateQueryKey(query);
    const cache = getRecord(snapshot.cache);
    if (normalizeText(cache.queryKey) !== queryKey) {
      return null;
    }

    if (isStoredMonthlyAggregateSnapshotStale(snapshot, sourceSnapshot, query)) {
      return null;
    }

    return normalizeStoredMonthlyAggregateSnapshot(snapshot, queryKey);
  }

  private async buildViewMeta(query: ReportingQuery): Promise<ReportingViewMeta> {
    return {
      servedAt: new Date().toISOString(),
      aggregateStatus: await this.readViewAggregateStatus(query),
    };
  }

  private async readViewAggregateStatus(query: ReportingQuery): Promise<ReportingAggregateStatus> {
    if (!hasAggregateQuery(query)) {
      return toAggregateStatus(await this.repository.readRawDefaultMonthlyAggregateSnapshot());
    }

    const snapshot = await this.repository.readRawMonthlyAggregateSnapshot();
    const cache = getRecord(snapshot?.cache);
    const queryKey = buildMonthlyAggregateQueryKey(query);
    if (!snapshot || normalizeText(cache.queryKey) !== queryKey) {
      return toAggregateStatus(null);
    }

    return toAggregateStatus(snapshot);
  }

  private async materializeMonthlyAggregateSnapshot(
    sourceSnapshot: ReportingSourceSnapshot,
    query: ReportingQuery,
    options: {
      snapshotKey: string;
      source: string;
      invalidatedAt?: string;
      invalidatedByKey?: string;
    },
  ): Promise<ReportingMonthlyAggregateResponse> {
    const startedAt = new Date().toISOString();
    const snapshotKey = options.snapshotKey;
    const source = options.source;

    try {
      const built = await buildMonthlyReportingAggregates({
        rows: sourceSnapshot.declarations,
        roster: sourceSnapshot.roster,
        rules: sourceSnapshot.activeRuleSet,
        adjustments: sourceSnapshot.adjustments,
        from: query.from,
        to: query.to,
        limit: query.limit,
      });
      const storedSnapshot = attachStoredMonthlyAggregateProjectionState(
        built,
        sourceSnapshot,
        query,
        {
          snapshotKey,
          actor: 'system',
          source,
          invalidatedAt: options.invalidatedAt || startedAt,
          invalidatedByKey: options.invalidatedByKey,
        },
      );
      if (snapshotKey === DEFAULT_MONTHLY_AGGREGATE_KEY) {
        await this.repository.writeRawDefaultMonthlyAggregateSnapshot(storedSnapshot);
      } else {
        await this.repository.writeRawMonthlyAggregateSnapshot(storedSnapshot);
      }
      await this.recordJobRun({
        job: 'reporting-monthly-aggregate-materialize',
        status: 'success',
        source,
        actor: 'system',
        snapshotKey,
        queryKey: built.cache.queryKey,
        range: built.range,
        total: built.total,
        startedAt,
        finishedAt: built.generatedAt,
      });
      return built;
    } catch (error) {
      await this.recordJobRun({
        job: 'reporting-monthly-aggregate-materialize',
        status: 'error',
        source,
        actor: 'system',
        snapshotKey,
        queryKey: buildMonthlyAggregateQueryKey(query),
        range: {
          from: normalizeText(query.from),
          to: normalizeText(query.to),
        },
        startedAt,
        finishedAt: new Date().toISOString(),
        error:
          error instanceof Error
            ? error.message
            : 'Failed to build monthly reporting aggregates.',
      });
      throw error;
    }
  }

  private async readDefaultAggregateStatus(): Promise<ReportingAggregateStatus> {
    const snapshot = await this.repository.readReportingSnapshot();
    const defaultQuery = buildDefaultMonthlyAggregateQuery(snapshot.declarations);
    const defaultSnapshot = hasAggregateQuery(defaultQuery)
      ? await this.readStoredMonthlyAggregateSnapshot(
          DEFAULT_MONTHLY_AGGREGATE_KEY,
          defaultQuery,
          snapshot,
        )
      : null;
    if (!defaultSnapshot) {
      if (!hasAggregateQuery(defaultQuery)) {
        return toAggregateStatus(null);
      }

      const built = await this.materializeMonthlyAggregateSnapshot(snapshot, defaultQuery, {
        snapshotKey: DEFAULT_MONTHLY_AGGREGATE_KEY,
        source: 'reporting-monthly-aggregates-default',
      });
      return {
        available: true,
        generatedAt: built.generatedAt,
        queryKey: built.cache.queryKey,
        total: built.total,
        range: built.range,
      };
    }

    return {
      available: true,
      generatedAt: defaultSnapshot.generatedAt,
      queryKey: defaultSnapshot.cache.queryKey,
      total: defaultSnapshot.total,
      range: defaultSnapshot.range,
    };
  }

  private async recordJobRun(entry: Record<string, unknown>): Promise<void> {
    const runs = normalizeReportingJobRuns(
      [buildReportingJobRun(entry), ...(await this.repository.readRawJobRuns())],
      {
        limit: DEFAULT_REPORTING_JOB_RUN_LIMIT,
      }
    );
    await this.repository.writeRawJobRuns(runs as unknown as Record<string, unknown>[]);
  }

  private async readObservabilityAggregateItems(
    snapshotKey: string,
    snapshot: Record<string, unknown> | null
  ): Promise<Record<string, unknown>[]> {
    const relationalItems = await this.repository.readRelationalMonthlyAggregateEntries(snapshotKey);
    if (relationalItems.length > 0) {
      return relationalItems;
    }

    const items = Array.isArray(snapshot?.items) ? snapshot.items : [];
    return items.filter(isRecord);
  }

  private async readObservabilityJobRuns(): Promise<Record<string, unknown>[]> {
    const relationalRuns = await this.repository.readRelationalJobRuns();
    if (relationalRuns.length > 0) {
      return relationalRuns;
    }

    return this.repository.readRawJobRuns();
  }
}

function resolveRequestedRuleSet(
  snapshot: Awaited<ReturnType<ReportingRepository['readReportingSnapshot']>>,
  ruleIdInput?: string,
) {
  const requestedId = normalizeText(ruleIdInput);
  if (!requestedId) {
    return snapshot.activeRuleSet;
  }

  return snapshot.ruleCollection.sets.find((entry) => normalizeText(entry.id) === requestedId) ?? snapshot.activeRuleSet;
}

function normalizeText(input: unknown): string {
  return typeof input === 'string' ? input.trim() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function resolveAsOfDate(input?: string): Date | undefined {
  if (!input) {
    return undefined;
  }

  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function toAggregateStatus(snapshot: Record<string, unknown> | null): ReportingAggregateStatus {
  if (!snapshot) {
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

  const cache = getRecord(snapshot.cache);
  const range = getRecord(snapshot.range);

  return {
    available: true,
    generatedAt: normalizeText(snapshot.generatedAt),
    queryKey: normalizeText(cache.queryKey),
    total: Number(snapshot.total || 0),
    range: {
      from: normalizeText(range.from),
      to: normalizeText(range.to),
    },
  };
}

function hasAggregateQuery(query: ReportingQuery): boolean {
  return Boolean(
    normalizeText(query.from) ||
      normalizeText(query.to) ||
      (typeof query.limit === 'number' && Number.isFinite(query.limit) && query.limit > 0)
  );
}

function normalizeStoredMonthlyAggregateSnapshot(
  snapshot: Record<string, unknown>,
  queryKey: string
): ReportingMonthlyAggregateResponse {
  const range = getRecord(snapshot.range);
  const ruleSet = getRecord(snapshot.ruleSet);

  return {
    range: {
      from: normalizeText(range.from),
      to: normalizeText(range.to),
    },
    ruleSet: {
      id: normalizeText(ruleSet.id) || 'default',
      name: normalizeText(ruleSet.name) || 'Default KPI',
    },
    generatedAt: normalizeText(snapshot.generatedAt) || new Date().toISOString(),
    cache: {
      queryKey,
      reused: true,
    },
    total: Number(snapshot.total || 0),
    items: Array.isArray(snapshot.items)
      ? (snapshot.items as ReportingMonthlyAggregateResponse['items'])
      : [],
  };
}

function attachStoredMonthlyAggregateProjectionState(
  snapshot: ReportingMonthlyAggregateResponse,
  sourceSnapshot: ReportingSourceSnapshot,
  query: ReportingQuery,
  options: {
    snapshotKey: string;
    actor?: string;
    source?: string;
    invalidatedAt?: string;
    invalidatedByKey?: string;
  },
): Record<string, unknown> {
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
      freshnessKey: buildStoredMonthlyAggregateFreshnessKey(sourceSnapshot, query),
      owner: {
        ruleSetId: normalizeText(sourceSnapshot.activeRuleSet?.id) || 'default',
        ruleUpdatedAt: normalizeText(sourceSnapshot.activeRuleSet?.updatedAt),
      },
      sourceCounts: {
        declarations: Array.isArray(sourceSnapshot.declarations) ? sourceSnapshot.declarations.length : 0,
        teams: Array.isArray(sourceSnapshot.roster?.teams) ? sourceSnapshot.roster.teams.length : 0,
        adjustments: Array.isArray(sourceSnapshot.adjustments) ? sourceSnapshot.adjustments.length : 0,
      },
    },
  };
}

function isStoredMonthlyAggregateSnapshotStale(
  snapshotInput: Record<string, unknown> | null,
  sourceSnapshot: ReportingSourceSnapshot,
  query: ReportingQuery,
): boolean {
  const snapshot = isRecord(snapshotInput) ? snapshotInput : null;
  if (!snapshot) {
    return true;
  }

  const projectionState = getRecord(snapshot.projectionState);
  if (!Object.keys(projectionState).length) {
    return false;
  }

  const owner = getRecord(projectionState.owner);
  const expectedFreshnessKey = buildStoredMonthlyAggregateFreshnessKey(sourceSnapshot, query);
  const storedFreshnessKey = normalizeText(projectionState.freshnessKey);
  if (storedFreshnessKey && storedFreshnessKey !== expectedFreshnessKey) {
    return true;
  }

  const currentRuleSetId = normalizeText(sourceSnapshot.activeRuleSet?.id) || 'default';
  if (normalizeText(owner.ruleSetId) && normalizeText(owner.ruleSetId) !== currentRuleSetId) {
    return true;
  }

  const currentRuleUpdatedAt = normalizeText(sourceSnapshot.activeRuleSet?.updatedAt);
  if (normalizeText(owner.ruleUpdatedAt) && normalizeText(owner.ruleUpdatedAt) !== currentRuleUpdatedAt) {
    return true;
  }

  const invalidatedAt = normalizeText(projectionState.invalidatedAt);
  const refreshedAt = normalizeText(projectionState.refreshedAt);
  return Boolean(invalidatedAt && refreshedAt && invalidatedAt > refreshedAt);
}

function buildStoredMonthlyAggregateFreshnessKey(
  sourceSnapshot: ReportingSourceSnapshot,
  query: ReportingQuery,
): string {
  return JSON.stringify({
    queryKey: buildMonthlyAggregateQueryKey(query),
    ruleSetId: normalizeText(sourceSnapshot.activeRuleSet?.id) || 'default',
    ruleUpdatedAt: normalizeText(sourceSnapshot.activeRuleSet?.updatedAt),
    declarationCount: Array.isArray(sourceSnapshot.declarations) ? sourceSnapshot.declarations.length : 0,
    teamCount: Array.isArray(sourceSnapshot.roster?.teams) ? sourceSnapshot.roster.teams.length : 0,
    adjustmentCount: Array.isArray(sourceSnapshot.adjustments) ? sourceSnapshot.adjustments.length : 0,
  });
}

function getRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
}
