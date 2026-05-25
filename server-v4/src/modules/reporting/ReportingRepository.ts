import type { ReportingProjectionPersistence } from '../../persistence/reportingProjectionPersistence.js';
import type { AdjustmentAsyncReader } from '../kpi-adjustments/adjustmentAsyncReader.js';
import { DeclarationsRepository, type DeclarationRecord } from '../declarations/DeclarationsRepository.js';
import type { DeclarationAsyncReader } from '../declarations/declarationAsyncReader.js';
import { KpiRulesRepository } from '../kpi-rules/KpiRulesRepository.js';
import type { KpiRulesAsyncReader } from '../kpi-rules/kpiRulesAsyncReader.js';
import type { KpiRuleCollection, KpiRuleSet } from '../kpi-rules/kpiRuleDefaults.js';
import { TeamsRepository, type TeamRoster } from '../teams/TeamsRepository.js';
import type { TeamRosterAsyncReader } from '../teams/teamRosterAsyncReader.js';

const MONTHLY_AGGREGATE_KEY = 'kpi_reporting_monthly_aggregates_v1';
const DEFAULT_MONTHLY_AGGREGATE_KEY = 'kpi_reporting_monthly_aggregates_default_v1';
const REPORT_SCHEDULE_STORAGE_KEY = 'kpi_report_schedule_v1';
const REPORTING_JOB_RUNS_KEY = 'kpi_reporting_job_runs_v1';

export type ReportingSourceSnapshot = {
  declarations: DeclarationRecord[];
  roster: TeamRoster;
  ruleCollection: KpiRuleCollection;
  activeRuleSet: KpiRuleSet;
  adjustments: Record<string, unknown>[];
};

export type ReportingRepositoryReaders = {
  adjustmentsReader: AdjustmentAsyncReader;
  declarationsReader: DeclarationAsyncReader;
  kpiRulesReader: KpiRulesAsyncReader;
  teamsReader: TeamRosterAsyncReader;
};

export class ReportingRepository {
  private readonly declarationsRepository: DeclarationsRepository;
  private readonly rulesRepository: KpiRulesRepository;
  private readonly teamsRepository: TeamsRepository;
  private readonly adjustmentsReader: AdjustmentAsyncReader;

  constructor(
    private readonly projections: ReportingProjectionPersistence,
    readers: ReportingRepositoryReaders,
  ) {
    this.declarationsRepository = new DeclarationsRepository(readers.declarationsReader);
    this.rulesRepository = new KpiRulesRepository(readers.kpiRulesReader);
    this.teamsRepository = new TeamsRepository(readers.teamsReader);
    this.adjustmentsReader = readers.adjustmentsReader;
  }

  async readReportingSnapshot(): Promise<ReportingSourceSnapshot> {
    const [ruleCollection, declarations, adjustments, roster] = await Promise.all([
      this.rulesRepository.getRuleCollection(),
      this.declarationsRepository.listDeclarations(),
      this.adjustmentsReader.readAdjustmentRows(),
      this.teamsRepository.listRoster(),
    ]);

    return {
      declarations,
      roster,
      ruleCollection,
      activeRuleSet: resolveActiveRuleSet(ruleCollection),
      adjustments: normalizeAdjustmentList(adjustments),
    };
  }

  async listScheduleEntries(): Promise<Record<string, unknown>[]> {
    const relational = await this.projections.readScheduleEntries(REPORT_SCHEDULE_STORAGE_KEY);
    if (relational.length > 0) {
      return relational;
    }

    const stored = await this.readProjectionValue(REPORT_SCHEDULE_STORAGE_KEY);
    if (!Array.isArray(stored)) {
      return [];
    }

    return stored.filter(isRecord);
  }

  async writeScheduleEntries(items: Record<string, unknown>[]): Promise<void> {
    await this.writeProjectionValue(REPORT_SCHEDULE_STORAGE_KEY, items);
  }

  async readRawMonthlyAggregateSnapshot(): Promise<Record<string, unknown> | null> {
    const stored = await this.readProjectionValue(MONTHLY_AGGREGATE_KEY);
    return isRecord(stored) ? stored : null;
  }

  async readRawDefaultMonthlyAggregateSnapshot(): Promise<Record<string, unknown> | null> {
    const stored = await this.readProjectionValue(DEFAULT_MONTHLY_AGGREGATE_KEY);
    return isRecord(stored) ? stored : null;
  }

  async writeRawMonthlyAggregateSnapshot(snapshot: Record<string, unknown>): Promise<void> {
    await this.writeProjectionValue(MONTHLY_AGGREGATE_KEY, snapshot);
  }

  async writeRawDefaultMonthlyAggregateSnapshot(snapshot: Record<string, unknown>): Promise<void> {
    await this.writeProjectionValue(DEFAULT_MONTHLY_AGGREGATE_KEY, snapshot);
  }

  async readRawJobRuns(): Promise<Record<string, unknown>[]> {
    const stored = await this.readProjectionValue(REPORTING_JOB_RUNS_KEY);
    return Array.isArray(stored) ? stored.filter(isRecord) : [];
  }

  async writeRawJobRuns(items: Record<string, unknown>[]): Promise<void> {
    await this.writeProjectionValue(REPORTING_JOB_RUNS_KEY, items);
  }

  async readRelationalMonthlyAggregateEntries(snapshotKey: string): Promise<Record<string, unknown>[]> {
    return this.projections.readMonthlyAggregateEntries(snapshotKey);
  }

  async readRelationalJobRuns(): Promise<Record<string, unknown>[]> {
    return this.projections.readJobRunEntries(REPORTING_JOB_RUNS_KEY);
  }

  private async readProjectionValue(
    key: string,
  ): Promise<Record<string, unknown> | Record<string, unknown>[] | null> {
    const stored = await this.projections.readValue(key);
    return Array.isArray(stored) ? stored.filter(isRecord) : isRecord(stored) ? stored : null;
  }

  private async writeProjectionValue(
    key: string,
    value: Record<string, unknown> | Record<string, unknown>[],
  ): Promise<void> {
    const isArrayPayload = Array.isArray(value) && value.every(isRecord);
    if (!isRecord(value) && !isArrayPayload) {
      return;
    }

    await this.projections.writeValue(key, value);
  }
}

function resolveActiveRuleSet(ruleCollection: KpiRuleCollection): KpiRuleSet {
  return (
    ruleCollection.sets.find((entry) => entry.id === ruleCollection.activeId) ??
    ruleCollection.sets[0]
  );
}

function normalizeAdjustmentList(input: unknown): Record<string, unknown>[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.filter(isRecord);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
