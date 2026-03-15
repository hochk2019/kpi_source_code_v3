import type { DeclarationRecord } from '../server-v4/src/modules/declarations/DeclarationsRepository.js';
import type { KpiRuleSet } from '../server-v4/src/modules/kpi-rules/kpiRuleDefaults.js';
import type { TeamRoster } from '../server-v4/src/modules/teams/TeamsRepository.js';

export type ReportingReadModels = {
  summary: Record<string, unknown>;
  staff: Record<string, unknown>;
  teams: Record<string, unknown>;
};

export type MonthlyReportingAggregates = {
  range: {
    from: string;
    to: string;
  };
  ruleSet: {
    id: string;
    name: string;
  };
  generatedAt: string;
  cache: {
    queryKey: string;
    reused: boolean;
  };
  total: number;
  items: Record<string, unknown>[];
};

export function buildReportingReadModels(
  rowsInput: readonly DeclarationRecord[],
  options?: {
    roster?: TeamRoster;
    rules?: KpiRuleSet;
    from?: string;
    to?: string;
    adjustments?: readonly Record<string, unknown>[];
    limit?: number;
  }
): ReportingReadModels;

export function buildMonthlyReportingAggregates(
  rowsInput: readonly DeclarationRecord[],
  options?: {
    roster?: TeamRoster;
    rules?: KpiRuleSet;
    from?: string;
    to?: string;
    adjustments?: readonly Record<string, unknown>[];
    generatedAt?: string;
    limit?: number;
  }
): MonthlyReportingAggregates;

export function buildMonthlyAggregateQueryKey(query?: {
  from?: string;
  to?: string;
  limit?: number;
}): string;

export function buildDefaultMonthlyAggregateQuery(rowsInput: readonly DeclarationRecord[]): {
  from: string;
  to: string;
};

export function listReportingSchedules(
  entriesInput: readonly Record<string, unknown>[],
  options?: {
    asOf?: string;
  }
): {
  total: number;
  items: Record<string, unknown>[];
};
