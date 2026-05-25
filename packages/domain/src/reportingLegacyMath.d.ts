export interface QuickRangeOption {
  value: string;
  label: string;
}

export const QUICK_RANGE_OPTIONS: readonly QuickRangeOption[];

export function computeQuickRange(
  option: string,
  base?: Date,
): { from: string; to: string };

export interface DeclarationRow {
  date: string;
  displayDate: string;
  so_tk: string;
  mst: string;
  cong_ty: string;
  loai_hinh: string;
  num_items: number;
  licenses: number;
  nhan_vien: string;
  team: string;
  isExport: boolean;
  kpi: number;
  hasCO: boolean;
  coLineCount: number;
  coLabel: string;
  licenseCodes: string[];
  licenseExcludedCodes: string[];
  licenseSourceCodes: string[];
  licenseManualCount: number | null;
  [key: string]: unknown;
}

export interface StaffStats {
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
}

export interface StaffEntry {
  key: string;
  name: string;
  teamNames: string[];
  teamLabel: string;
  stats: StaffStats;
  rows: DeclarationRow[];
  adjustmentSummary: Record<string, unknown>;
}

export interface TeamMemberEntry {
  key: string;
  name: string;
  stats: StaffStats;
  rows: DeclarationRow[];
}

export interface TeamEntry {
  key: string;
  name: string;
  stats: StaffStats;
  rows: DeclarationRow[];
  members: TeamMemberEntry[];
  memberNames: string[];
  adjustmentSummary: Record<string, unknown>;
}

export interface TrendDataPoint {
  period: string;
  kpi: number;
  decls: number;
  items: number;
  licenses: number;
  [teamName: string]: unknown;
}

export interface ComparisonStats {
  current: StaffStats;
  previous: StaffStats;
  delta: {
    kpi: number;
    kpiPercent: number | null;
    decls: number;
  };
}

export interface ReportData {
  rows: DeclarationRow[];
  summary: StaffStats & {
    companyCount: number;
    licenseSummary: string;
    adjustmentTotals: Record<string, unknown>;
  };
  staff: {
    list: StaffEntry[];
    byKey: Map<string, StaffEntry>;
    keysHash: string;
  };
  teams: {
    list: TeamEntry[];
    byKey: Map<string, TeamEntry>;
    keysHash: string;
  };
  range: { from: string; to: string };
  rules: Record<string, unknown>;
  trend: {
    series: TrendDataPoint[];
    teamSeries: TrendDataPoint[];
    comparison: ComparisonStats | null;
    topTeams: string[];
  };
  adjustments: {
    list: unknown[];
    applied: unknown[];
    totalPoints: number;
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
    appliedCount: number;
    totalsByCategory: Record<string, unknown>;
    staffSummaries: unknown[];
    teamSummaries: unknown[];
  };
}

export function buildReportData(
  rowsInput: readonly Record<string, unknown>[],
  options?: {
    roster?: Record<string, unknown>;
    rules?: Record<string, unknown>;
    from?: string;
    to?: string;
    adjustments?: readonly Record<string, unknown>[];
  },
): ReportData;

export interface CompanyAggregationRow {
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
}

export function aggregateByCompany(
  rows: readonly Record<string, unknown>[],
  options?: {
    includeStaff?: boolean;
    includeTeam?: boolean;
  },
): CompanyAggregationRow[];

declare const _default: {
  QUICK_RANGE_OPTIONS: typeof QUICK_RANGE_OPTIONS;
  computeQuickRange: typeof computeQuickRange;
  buildReportData: typeof buildReportData;
  aggregateByCompany: typeof aggregateByCompany;
};

export default _default;
