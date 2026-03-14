import {
  aggregateLegacyCompanies,
  buildLegacyReportData,
  type LegacyCompanySummaryRow,
  type LegacyReportData,
} from '../../legacy/legacy-report-bridge.js';
import { ReportingRepository } from './ReportingRepository.js';
import {
  buildDefaultMonthlyAggregateQuery,
  buildMonthlyAggregateQueryKey,
  buildMonthlyReportingAggregates,
  type ReportingMonthlyAggregateResponse,
} from './reportingAggregateBuilder.js';
import {
  normalizeReportingScheduleEntry,
  removeReportingScheduleEntry,
  type ReportingScheduleRecord,
  upsertReportingScheduleEntry,
} from './reportingScheduleNormalizer.js';
import {
  DEFAULT_REPORTING_JOB_RUN_LIMIT,
  buildReportingJobRun,
  normalizeReportingJobRuns,
} from '../../../../server/reportingObservability.js';
import {
  buildMonthlyAggregateCollection,
  buildReportingJobRunCollection,
  type ReportingMonthlyAggregateCollection,
} from '../../../../server/reportingObservabilityCollections.js';

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
    const report = await this.buildReport(query);
    const [companies, staffItems, teamItems] = await Promise.all([
      buildSummaryCompanyGroups(report),
      enrichStaffItems(applyLimit(report.staff.list, query.limit)),
      enrichTeamItems(applyLimit(report.teams.list, query.limit)),
    ]);

    return {
      meta: await this.buildViewMeta(query),
      summary: {
        range: report.range,
        ruleSet: toRuleSetReference(report.rules),
        summary: report.summary,
        trend: report.trend,
        adjustments: normalizeAdjustments(report.adjustments),
        companies,
      },
      staff: {
        range: report.range,
        ruleSet: toRuleSetReference(report.rules),
        total: report.staff.list.length,
        keysHash: report.staff.keysHash,
        items: staffItems,
      },
      teams: {
        range: report.range,
        ruleSet: toRuleSetReference(report.rules),
        total: report.teams.list.length,
        keysHash: report.teams.keysHash,
        items: teamItems,
      },
    };
  }

  async getMonthlyAggregates(query: ReportingQuery = {}): Promise<ReportingMonthlyAggregateResponse> {
    if (!hasAggregateQuery(query)) {
      const defaultSnapshot = await this.readOrBuildDefaultMonthlyAggregateSnapshot();
      if (defaultSnapshot) {
        return defaultSnapshot;
      }
    }

    const cached = await this.readCachedMonthlyAggregateSnapshot(query);
    if (cached) {
      return cached;
    }

    const snapshot = await this.repository.readReportingSnapshot();
    const startedAt = new Date().toISOString();

    try {
      const built = await buildMonthlyReportingAggregates({
        rows: snapshot.declarations,
        roster: snapshot.roster,
        rules: snapshot.activeRuleSet,
        adjustments: snapshot.adjustments,
        from: query.from,
        to: query.to,
        limit: query.limit,
      });
      await this.repository.writeRawMonthlyAggregateSnapshot(built as unknown as Record<string, unknown>);
      await this.recordJobRun({
        job: 'reporting-monthly-aggregate-materialize',
        status: 'success',
        source: 'reporting-monthly-aggregates',
        actor: 'system',
        snapshotKey: 'kpi_reporting_monthly_aggregates_v1',
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
        source: 'reporting-monthly-aggregates',
        actor: 'system',
        snapshotKey: 'kpi_reporting_monthly_aggregates_v1',
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

  async listSchedules(query: ReportingSchedulesQuery = {}): Promise<ReportingSchedulesResponse> {
    const asOf = resolveAsOfDate(query.asOf);
    const items = (await this.repository.listRawSchedules())
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
      await this.repository.listRawSchedules(),
      input,
      {
        fromDate: new Date(),
      }
    );

    await this.repository.writeRawSchedules(items as unknown as Record<string, unknown>[]);

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
      await this.repository.listRawSchedules(),
      id,
    );
    if (!deleted) {
      return {
        deleted: false,
        total: items.length,
      };
    }

    await this.repository.writeRawSchedules(items as unknown as Record<string, unknown>[]);
    return {
      deleted: true,
      total: items.length,
    };
  }

  private async buildReport(query: ReportingQuery): Promise<LegacyReportData> {
    const snapshot = await this.repository.readReportingSnapshot();
    const selectedRuleSet = resolveRequestedRuleSet(snapshot, query.ruleId);

    return buildLegacyReportData(snapshot.declarations, {
      roster: snapshot.roster,
      rules: selectedRuleSet,
      from: query.from,
      to: query.to,
      adjustments: snapshot.adjustments,
    });
  }

  private async readCachedMonthlyAggregateSnapshot(
    query: ReportingQuery,
  ): Promise<ReportingMonthlyAggregateResponse | null> {
    const snapshot = await this.repository.readRawMonthlyAggregateSnapshot();
    if (!snapshot) {
      return null;
    }

    const queryKey = buildMonthlyAggregateQueryKey(query);
    const cache = getRecord(snapshot.cache);
    if (normalizeText(cache.queryKey) !== queryKey) {
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

  private async readOrBuildDefaultMonthlyAggregateSnapshot(): Promise<ReportingMonthlyAggregateResponse | null> {
    const stored = await this.repository.readRawDefaultMonthlyAggregateSnapshot();
    if (stored) {
      const queryKey = normalizeText(getRecord(stored.cache).queryKey);
      return normalizeStoredMonthlyAggregateSnapshot(stored, queryKey);
    }

    const snapshot = await this.repository.readReportingSnapshot();
    const defaultQuery = buildDefaultMonthlyAggregateQuery(snapshot.declarations);
    if (!hasAggregateQuery(defaultQuery)) {
      return null;
    }

    const startedAt = new Date().toISOString();

    try {
      const built = await buildMonthlyReportingAggregates({
        rows: snapshot.declarations,
        roster: snapshot.roster,
        rules: snapshot.activeRuleSet,
        adjustments: snapshot.adjustments,
        from: defaultQuery.from,
        to: defaultQuery.to,
      });
      await this.repository.writeRawDefaultMonthlyAggregateSnapshot(
        built as unknown as Record<string, unknown>
      );
      await this.recordJobRun({
        job: 'reporting-monthly-aggregate-materialize',
        status: 'success',
        source: 'reporting-monthly-aggregates-default',
        actor: 'system',
        snapshotKey: 'kpi_reporting_monthly_aggregates_default_v1',
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
        source: 'reporting-monthly-aggregates-default',
        actor: 'system',
        snapshotKey: 'kpi_reporting_monthly_aggregates_default_v1',
        queryKey: buildMonthlyAggregateQueryKey(defaultQuery),
        range: {
          from: normalizeText(defaultQuery.from),
          to: normalizeText(defaultQuery.to),
        },
        startedAt,
        finishedAt: new Date().toISOString(),
        error:
          error instanceof Error
            ? error.message
            : 'Failed to build default monthly reporting aggregates.',
      });
      throw error;
    }
  }

  private async readDefaultAggregateStatus(): Promise<ReportingAggregateStatus> {
    const defaultSnapshot = await this.readOrBuildDefaultMonthlyAggregateSnapshot();
    if (!defaultSnapshot) {
      return toAggregateStatus(null);
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

function toRuleSetReference(ruleSet: LegacyReportData['rules']): RuleSetReference {
  return {
    id: ruleSet.id,
    name: ruleSet.name,
  };
}

function normalizeAdjustments(input: LegacyReportData['adjustments'] | undefined): ReportingAdjustmentsResponse {
  const source = isRecord(input) ? input : {};

  return {
    list: Array.isArray(source.list) ? source.list.filter(isRecord) : [],
    applied: Array.isArray(source.applied) ? source.applied.filter(isRecord) : [],
    totalPoints: Number(source.totalPoints || 0),
    pendingCount: Number(source.pendingCount || 0),
    approvedCount: Number(source.approvedCount || 0),
    rejectedCount: Number(source.rejectedCount || 0),
    appliedCount: Number(source.appliedCount || 0),
    totalsByCategory: isRecord(source.totalsByCategory) ? source.totalsByCategory : {},
  };
}

async function buildSummaryCompanyGroups(report: LegacyReportData): Promise<ReportingCompanyGroups> {
  const rows = report.staff.list.flatMap((item) => item.rows);

  return {
    staff: await aggregateLegacyCompanies(rows, { includeStaff: true, includeTeam: false }),
    teams: await aggregateLegacyCompanies(rows, { includeStaff: true, includeTeam: true }),
  };
}

async function enrichStaffItems(
  items: LegacyReportData['staff']['list']
): Promise<ReportingStaffItemResponse[]> {
  return Promise.all(
    items.map(async (item) => ({
      ...item,
      companies: await aggregateLegacyCompanies(item.rows, {
        includeStaff: false,
        includeTeam: false,
      }),
    }))
  );
}

async function enrichTeamItems(
  items: LegacyReportData['teams']['list']
): Promise<ReportingTeamItemResponse[]> {
  return Promise.all(
    items.map(async (item) => ({
      ...item,
      companies: await aggregateLegacyCompanies(item.rows, {
        includeStaff: true,
        includeTeam: false,
      }),
    }))
  );
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

function applyLimit<T>(items: readonly T[], limit?: number): T[] {
  if (!Number.isFinite(limit) || !limit || limit <= 0) {
    return [...items];
  }

  return items.slice(0, Math.trunc(limit));
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

function getRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
}
