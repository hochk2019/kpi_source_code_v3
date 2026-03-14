import type { DeclarationRecord } from '../server-v4/src/modules/declarations/DeclarationsRepository.js';
import type { KpiRuleSet } from '../server-v4/src/modules/kpi-rules/kpiRuleDefaults.js';
import type { TeamRoster } from '../server-v4/src/modules/teams/TeamsRepository.js';

export type LegacyReportRow = Record<string, unknown>;

export type LegacyCompanySummaryRow = {
  mst: string;
  cong_ty: string;
  staff?: string;
  team?: string;
  decls: number;
  items: number;
  licenses: number;
  kpi: number;
  loai_hinh: string;
  modes: string;
  co: number;
  coLines: number;
  licenseCodes: string[];
  licenseExcluded: string[];
  licenseSummary: string;
  licenseTooltip: string;
};

export type LegacyReportStats = {
  decls: number;
  import: number;
  export: number;
  items: number;
  licenses: number;
  kpi: number;
  co: number;
  coLines: number;
  licenseCodes: string[];
  licenseCount: number;
};

export type LegacyReportStaffItem = {
  key: string;
  name: string;
  teamNames: string[];
  teamLabel: string;
  stats: LegacyReportStats;
  rows: LegacyReportRow[];
  adjustmentSummary: Record<string, unknown>;
};

export type LegacyReportTeamMember = {
  key: string;
  name: string;
  stats: LegacyReportStats;
  rows: LegacyReportRow[];
};

export type LegacyReportTeamItem = {
  key: string;
  name: string;
  stats: LegacyReportStats;
  rows: LegacyReportRow[];
  members: LegacyReportTeamMember[];
  memberNames: string[];
  adjustmentSummary: Record<string, unknown>;
};

export type LegacyReportData = {
  rows: LegacyReportRow[];
  summary: LegacyReportStats & {
    companyCount: number;
    licenseSummary: string;
    adjustmentTotals: Record<string, unknown>;
  };
  staff: {
    list: LegacyReportStaffItem[];
    byKey: Map<string, LegacyReportStaffItem>;
    keysHash: string;
  };
  teams: {
    list: LegacyReportTeamItem[];
    byKey: Map<string, LegacyReportTeamItem>;
    keysHash: string;
  };
  range: {
    from: string;
    to: string;
  };
  rules: KpiRuleSet;
  trend: {
    series: Array<Record<string, unknown>>;
    teamSeries: Array<Record<string, unknown>>;
    comparison: Record<string, unknown> | null;
    topTeams: string[];
  };
  adjustments: Record<string, unknown>;
};

export function buildLegacyReportData(
  rowsInput: readonly DeclarationRecord[],
  options?: {
    roster?: TeamRoster;
    rules?: KpiRuleSet;
    from?: string;
    to?: string;
    adjustments?: readonly Record<string, unknown>[];
  }
): LegacyReportData;

export function aggregateLegacyCompanies(
  rowsInput: readonly LegacyReportRow[],
  options?: {
    includeStaff?: boolean;
    includeTeam?: boolean;
  }
): LegacyCompanySummaryRow[];
