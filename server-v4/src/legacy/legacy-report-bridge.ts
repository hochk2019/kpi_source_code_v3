import {
  aggregateLegacyCompanies as aggregateSharedLegacyCompanies,
  buildLegacyReportData as buildSharedLegacyReportData,
  type LegacyCompanySummaryRow,
  type LegacyReportData,
  type LegacyReportRow,
} from '../../../server/legacyReportingBridge.js';

import type { DeclarationRecord } from '../modules/declarations/DeclarationsRepository.js';
import type { KpiRuleSet } from '../modules/kpi-rules/kpiRuleDefaults.js';
import type { TeamRoster } from '../modules/teams/TeamsRepository.js';

export type { LegacyCompanySummaryRow, LegacyReportData, LegacyReportRow };

export async function buildLegacyReportData(
  rowsInput: readonly DeclarationRecord[],
  options: {
    roster: TeamRoster;
    rules: KpiRuleSet;
    from?: string;
    to?: string;
    adjustments?: readonly Record<string, unknown>[];
  }
): Promise<LegacyReportData> {
  return buildSharedLegacyReportData(rowsInput, options);
}

export async function aggregateLegacyCompanies(
  rowsInput: readonly LegacyReportRow[],
  options: {
    includeStaff?: boolean;
    includeTeam?: boolean;
  } = {}
): Promise<LegacyCompanySummaryRow[]> {
  return aggregateSharedLegacyCompanies(rowsInput, options);
}
