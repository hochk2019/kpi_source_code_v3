import { normalizeReportingJobRuns } from './reportingObservability.js';

export const DEFAULT_REPORTING_OBSERVABILITY_PAGE_SIZE = 20;
export const MAX_REPORTING_OBSERVABILITY_PAGE_SIZE = 100;

export function buildReportingJobRunCollection(input, options = {}) {
  const items = normalizeReportingJobRuns(input, {
    limit: Number.MAX_SAFE_INTEGER,
  });
  const search = normalizeText(options.search);
  const status = normalizeStatusFilter(options.status);
  const filteredItems = items.filter((entry) => matchesJobRun(entry, search, status));
  const pageSize = resolvePageSize(options.pageSize);
  const pageCount = filteredItems.length
    ? Math.ceil(filteredItems.length / pageSize)
    : 0;
  const page = clampPage(options.page, pageCount);
  const pagedItems = slicePage(filteredItems, page, pageSize);

  let successCount = 0;
  let failureCount = 0;
  let lastSuccessAt = null;
  let lastFailureAt = null;

  filteredItems.forEach((entry) => {
    if (entry.status === 'success') {
      successCount += 1;
      if (!lastSuccessAt || entry.finishedAt > lastSuccessAt) {
        lastSuccessAt = entry.finishedAt;
      }
      return;
    }

    failureCount += 1;
    if (!lastFailureAt || entry.finishedAt > lastFailureAt) {
      lastFailureAt = entry.finishedAt;
    }
  });

  return {
    total: items.length,
    filteredTotal: filteredItems.length,
    successCount,
    failureCount,
    lastSuccessAt,
    lastFailureAt,
    search,
    status,
    page,
    pageSize,
    pageCount,
    items: pagedItems,
  };
}

export function buildMonthlyAggregateCollection(input, options = {}) {
  const items = normalizeMonthlyAggregateItems(input);
  const search = normalizeText(options.search);
  const filteredItems = items.filter((entry) => matchesMonthlyAggregate(entry, search));
  const pageSize = resolvePageSize(options.pageSize);
  const pageCount = filteredItems.length
    ? Math.ceil(filteredItems.length / pageSize)
    : 0;
  const page = clampPage(options.page, pageCount);
  const pagedItems = slicePage(filteredItems, page, pageSize);

  const totalDecls = filteredItems.reduce((sum, entry) => sum + entry.decls, 0);
  const totalItems = filteredItems.reduce((sum, entry) => sum + entry.itemCount, 0);
  const totalCompanies = filteredItems.reduce((sum, entry) => sum + entry.companyCount, 0);
  const kpiTotal = filteredItems.reduce((sum, entry) => sum + entry.kpi, 0);
  const averageKpi =
    filteredItems.length > 0
      ? Number((kpiTotal / filteredItems.length).toFixed(4))
      : 0;
  const peakPeriod = filteredItems.reduce((best, entry) => {
    if (!best || entry.kpi > best.kpi) {
      return entry;
    }
    return best;
  }, null);

  return {
    total: items.length,
    filteredTotal: filteredItems.length,
    totalDecls,
    totalItems,
    totalCompanies,
    averageKpi,
    peakPeriod,
    search,
    page,
    pageSize,
    pageCount,
    items: pagedItems,
  };
}

function normalizeMonthlyAggregateItems(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter(isRecord)
    .map((entry) => buildMonthlyAggregateItem(entry))
    .sort((left, right) => {
      const leftKey = `${left.period}|${left.range.to}|${left.label}`;
      const rightKey = `${right.period}|${right.range.to}|${right.label}`;
      return rightKey.localeCompare(leftKey);
    });
}

function buildMonthlyAggregateItem(entry) {
  const summary = isRecord(entry.summary) ? entry.summary : entry;
  const topTeams = Array.isArray(entry.topTeams) ? entry.topTeams.filter(isRecord) : [];
  const topStaff = Array.isArray(entry.topStaff) ? entry.topStaff.filter(isRecord) : [];

  return {
    period: normalizeText(entry.period),
    label: normalizeText(entry.label),
    range: {
      from: normalizeText(entry?.range?.from || entry.rangeFrom || entry.range_from),
      to: normalizeText(entry?.range?.to || entry.rangeTo || entry.range_to),
    },
    decls: toNonNegativeInt(summary.decls, 0),
    importCount: toNonNegativeInt(
      summary.importCount ?? summary.import ?? entry.importCount ?? entry.import_count,
      0
    ),
    exportCount: toNonNegativeInt(
      summary.exportCount ?? summary.export ?? entry.exportCount ?? entry.export_count,
      0
    ),
    itemCount: toNonNegativeInt(
      summary.itemCount ?? summary.items ?? entry.itemCount ?? entry.item_count,
      0
    ),
    licenseCount: toNonNegativeInt(
      summary.licenseCount ?? summary.licenses ?? entry.licenseCount ?? entry.license_count,
      0
    ),
    kpi: toFiniteNumber(summary.kpi ?? entry.kpi, 0),
    coCount: toNonNegativeInt(
      summary.coCount ?? summary.co ?? entry.coCount ?? entry.co_count,
      0
    ),
    coLineCount: toNonNegativeInt(
      summary.coLineCount ?? summary.coLines ?? entry.coLineCount ?? entry.co_line_count,
      0
    ),
    companyCount: toNonNegativeInt(
      summary.companyCount ?? entry.companyCount ?? entry.company_count,
      0
    ),
    topTeamCount: topTeams.length || toNonNegativeInt(entry.topTeamCount ?? entry.top_team_count, 0),
    topStaffCount:
      topStaff.length || toNonNegativeInt(entry.topStaffCount ?? entry.top_staff_count, 0),
    searchText: [
      normalizeText(entry.period),
      normalizeText(entry.label),
      normalizeText(entry?.range?.from || entry.rangeFrom || entry.range_from),
      normalizeText(entry?.range?.to || entry.rangeTo || entry.range_to),
      ...topTeams.map((team) => normalizeText(team.name || team.key)),
      ...topStaff.map((staff) => normalizeText(staff.name || staff.key)),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
  };
}

function matchesJobRun(entry, search, status) {
  if (status !== 'all' && entry.status !== status) {
    return false;
  }

  if (!search) {
    return true;
  }

  const haystack = [
    entry.job,
    entry.status,
    entry.source,
    entry.actor,
    entry.snapshotKey,
    entry.queryKey,
    entry.range?.from,
    entry.range?.to,
    entry.error,
    safeStringify(entry.meta),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(search.toLowerCase());
}

function matchesMonthlyAggregate(entry, search) {
  if (!search) {
    return true;
  }
  return entry.searchText.includes(search.toLowerCase());
}

function clampPage(value, pageCount) {
  const fallback = 1;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1) {
    return fallback;
  }
  if (pageCount > 0) {
    return Math.min(Math.trunc(numeric), pageCount);
  }
  return Math.trunc(numeric);
}

function resolvePageSize(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1) {
    return DEFAULT_REPORTING_OBSERVABILITY_PAGE_SIZE;
  }

  return Math.min(Math.trunc(numeric), MAX_REPORTING_OBSERVABILITY_PAGE_SIZE);
}

function slicePage(items, page, pageSize) {
  if (!items.length) {
    return [];
  }

  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

function normalizeStatusFilter(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'success' || normalized === 'error') {
    return normalized;
  }
  return 'all';
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function toNonNegativeInt(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return fallback;
  }

  return Math.trunc(numeric);
}

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return numeric;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function safeStringify(value) {
  if (!isRecord(value)) {
    return '';
  }

  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}
