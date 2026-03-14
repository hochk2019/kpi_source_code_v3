import { buildLegacyReportData, type LegacyReportData } from '../../legacy/legacy-report-bridge.js';
import type { DeclarationRecord } from '../declarations/DeclarationsRepository.js';
import type { KpiRuleSet } from '../kpi-rules/kpiRuleDefaults.js';
import type { TeamRoster } from '../teams/TeamsRepository.js';

type ReportStats = LegacyReportData['summary'];

export type ReportingMonthlyAggregateCache = {
  queryKey: string;
  reused: boolean;
};

export type ReportingMonthlyAggregateItem = {
  period: string;
  label: string;
  range: {
    from: string;
    to: string;
  };
  summary: ReportStats;
  topTeams: Array<{
    key: string;
    name: string;
    stats: ReportStats;
  }>;
  topStaff: Array<{
    key: string;
    name: string;
    teamLabel: string;
    stats: ReportStats;
  }>;
};

export type ReportingMonthlyAggregateResponse = {
  range: {
    from: string;
    to: string;
  };
  ruleSet: {
    id: string;
    name: string;
  };
  generatedAt: string;
  cache: ReportingMonthlyAggregateCache;
  total: number;
  items: ReportingMonthlyAggregateItem[];
};

export async function buildMonthlyReportingAggregates(options: {
  rows: readonly DeclarationRecord[];
  roster: TeamRoster;
  rules: KpiRuleSet;
  adjustments: readonly Record<string, unknown>[];
  from?: string;
  to?: string;
  limit?: number;
  generatedAt?: Date;
}): Promise<ReportingMonthlyAggregateResponse> {
  const grouped = groupRowsByMonth(filterRowsByRange(options.rows, options.from, options.to));
  const periods = Array.from(grouped.keys()).sort().reverse();
  const items: ReportingMonthlyAggregateItem[] = [];
  const queryKey = buildMonthlyAggregateQueryKey(options);

  for (const period of periods) {
    const monthRows = grouped.get(period) ?? [];
    const monthRange = createMonthlyRange(period, {
      from: normalizeText(options.from),
      to: normalizeText(options.to),
    });
    const report = await buildLegacyReportData(monthRows, {
      roster: options.roster,
      rules: options.rules,
      from: monthRange.from,
      to: monthRange.to,
      adjustments: options.adjustments,
    });

    items.push({
      period,
      label: formatMonthLabel(period),
      range: monthRange,
      summary: report.summary,
      topTeams: normalizeTopTeams(report),
      topStaff: normalizeTopStaff(report),
    });
  }

  const normalizedItems = applyLimit(items, options.limit);
  return {
    range: {
      from: normalizeText(options.from) || normalizedItems.at(-1)?.range.from || '',
      to: normalizeText(options.to) || normalizedItems[0]?.range.to || '',
    },
    ruleSet: {
      id: normalizeText(options.rules?.id) || 'default',
      name: normalizeText(options.rules?.name) || 'Default KPI',
    },
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    cache: {
      queryKey,
      reused: false,
    },
    total: items.length,
    items: normalizedItems,
  };
}

export function buildMonthlyAggregateQueryKey(query: { from?: string; to?: string; limit?: number }): string {
  const limit = query.limit;
  return JSON.stringify({
    from: normalizeText(query.from),
    to: normalizeText(query.to),
    limit: typeof limit === 'number' && Number.isFinite(limit) && limit > 0 ? Math.trunc(limit) : 0,
  });
}

export function buildDefaultMonthlyAggregateQuery(rowsInput: readonly DeclarationRecord[]): {
  from: string;
  to: string;
} {
  const periods = Array.from(groupRowsByMonth(Array.isArray(rowsInput) ? rowsInput : []).keys()).sort();
  const selectedPeriods = periods.slice(-2);
  if (!selectedPeriods.length) {
    return {
      from: '',
      to: '',
    };
  }

  const firstRange = createMonthlyRange(selectedPeriods[0], { from: '', to: '' });
  const lastRange = createMonthlyRange(selectedPeriods.at(-1) ?? '', { from: '', to: '' });
  return {
    from: firstRange.from,
    to: lastRange.to,
  };
}

function normalizeTopTeams(report: LegacyReportData): ReportingMonthlyAggregateItem['topTeams'] {
  const items = Array.isArray(report?.teams?.list) ? report.teams.list : [];
  return items.slice(0, 3).map((entry) => ({
    key: normalizeText(entry?.key),
    name: normalizeText(entry?.name),
    stats: cloneStats(entry?.stats),
  }));
}

function normalizeTopStaff(report: LegacyReportData): ReportingMonthlyAggregateItem['topStaff'] {
  const items = Array.isArray(report?.staff?.list) ? report.staff.list : [];
  return items.slice(0, 3).map((entry) => ({
    key: normalizeText(entry?.key),
    name: normalizeText(entry?.name),
    teamLabel: normalizeText(entry?.teamLabel),
    stats: cloneStats(entry?.stats),
  }));
}

function cloneStats(stats: Partial<ReportStats> | undefined): ReportStats {
  return {
    decls: Number(stats?.decls || 0),
    import: Number(stats?.import || 0),
    export: Number(stats?.export || 0),
    items: Number(stats?.items || 0),
    licenses: Number(stats?.licenses || 0),
    kpi: Number(stats?.kpi || 0),
    co: Number(stats?.co || 0),
    coLines: Number(stats?.coLines || 0),
    companyCount: Number((stats as ReportStats | undefined)?.companyCount || 0),
    licenseSummary: normalizeText((stats as ReportStats | undefined)?.licenseSummary) || '—',
    adjustmentTotals: isRecord((stats as ReportStats | undefined)?.adjustmentTotals)
      ? { ...(stats as ReportStats).adjustmentTotals }
      : {},
    licenseCodes: Array.isArray((stats as ReportStats | undefined)?.licenseCodes)
      ? [...(stats as ReportStats).licenseCodes]
      : [],
    licenseCount: Number((stats as ReportStats | undefined)?.licenseCount || 0),
  };
}

function filterRowsByRange(rowsInput: readonly DeclarationRecord[], from?: string, to?: string): DeclarationRecord[] {
  const rows = Array.isArray(rowsInput) ? [...rowsInput] : [];
  const fromDate = parseDateOnly(from);
  const toDate = parseDateOnly(to);

  return rows.filter((row) => {
    const rowDate = parseRowDate(row);
    if (!rowDate) {
      return false;
    }

    if (fromDate && rowDate.getTime() < fromDate.getTime()) {
      return false;
    }

    if (toDate && rowDate.getTime() > toDate.getTime()) {
      return false;
    }

    return true;
  });
}

function groupRowsByMonth(rows: readonly DeclarationRecord[]): Map<string, DeclarationRecord[]> {
  const grouped = new Map<string, DeclarationRecord[]>();

  for (const row of rows) {
    const rowDate = parseRowDate(row);
    if (!rowDate) {
      continue;
    }

    const period = `${rowDate.getFullYear()}-${String(rowDate.getMonth() + 1).padStart(2, '0')}`;
    const bucket = grouped.get(period) ?? [];
    bucket.push(row);
    grouped.set(period, bucket);
  }

  return grouped;
}

function createMonthlyRange(period: string, options: { from: string; to: string }): { from: string; to: string } {
  const [yearText, monthText] = period.split('-');
  const year = Number.parseInt(yearText || '', 10);
  const monthIndex = Number.parseInt(monthText || '', 10) - 1;

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return { from: '', to: '' };
  }

  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  const requestedFrom = parseDateOnly(options.from);
  const requestedTo = parseDateOnly(options.to);

  const from = requestedFrom && requestedFrom.getTime() > start.getTime() ? requestedFrom : start;
  const to = requestedTo && requestedTo.getTime() < end.getTime() ? requestedTo : end;

  return {
    from: formatDateOnly(from),
    to: formatDateOnly(to),
  };
}

function parseRowDate(row: DeclarationRecord): Date | null {
  const candidate = row.date ?? row.ngay_dk ?? row.created_at;
  return parseDateOnly(candidate);
}

function parseDateOnly(input: unknown): Date | null {
  const value = normalizeText(input);
  if (!value) {
    return null;
  }

  const matched = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (matched) {
    const year = Number.parseInt(matched[1], 10);
    const month = Number.parseInt(matched[2], 10);
    const day = Number.parseInt(matched[3], 10);
    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? null
    : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function formatDateOnly(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatMonthLabel(period: string): string {
  const [year, month] = period.split('-');
  return year && month ? `${month}/${year}` : period;
}

function normalizeGeneratedAt(input?: Date): string {
  const generatedAt = input instanceof Date ? input : new Date();
  return Number.isNaN(generatedAt.getTime()) ? new Date().toISOString() : generatedAt.toISOString();
}

function applyLimit<T>(items: readonly T[], limit?: number): T[] {
  if (!Number.isFinite(limit) || !limit || limit <= 0) {
    return [...items];
  }

  return items.slice(0, Math.trunc(limit));
}

function normalizeText(input: unknown): string {
  return typeof input === 'string' ? input.trim() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
