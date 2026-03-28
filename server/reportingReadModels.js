import { aggregateLegacyCompanies, buildLegacyReportData } from './legacyReportingBridge.js';

const DEFAULT_SCHEDULE_TIME = '08:00';
const VALID_SCHEDULE_FORMATS = new Set(['excel', 'pdf']);
const VALID_SCHEDULE_FREQUENCIES = new Set(['weekly', 'monthly']);
const VALID_DELIVERY_CHANNELS = new Set(['email', 'report_center', 'download_bundle']);
const VALID_DELIVERY_STATUSES = new Set(['idle', 'pending', 'ready', 'success', 'error', 'blocked']);

export function buildReportingReadModels(rowsInput, options = {}) {
  const report = buildLegacyReportData(normalizeRowList(rowsInput), {
    roster: normalizeRoster(options.roster),
    rules: options.rules,
    from: normalizeText(options.from),
    to: normalizeText(options.to),
    adjustments: normalizeRecordList(options.adjustments),
  });

  const ruleSet = toRuleSetReference(report?.rules);
  const staffItems = Array.isArray(report?.staff?.list) ? report.staff.list : [];
  const teamItems = Array.isArray(report?.teams?.list) ? report.teams.list : [];

  return {
    summary: {
      range: report?.range || { from: '', to: '' },
      ruleSet,
      summary: report?.summary || {},
      trend: report?.trend || { series: [], teamSeries: [], comparison: null, topTeams: [] },
      adjustments: normalizeAdjustments(report?.adjustments),
      companies: buildSummaryCompanyGroups(report),
    },
    staff: {
      range: report?.range || { from: '', to: '' },
      ruleSet,
      total: staffItems.length,
      keysHash: normalizeText(report?.staff?.keysHash),
      items: applyLimit(staffItems.map(attachStaffCompanies), options.limit),
    },
    teams: {
      range: report?.range || { from: '', to: '' },
      ruleSet,
      total: teamItems.length,
      keysHash: normalizeText(report?.teams?.keysHash),
      items: applyLimit(teamItems.map(attachTeamCompanies), options.limit),
    },
  };
}

export function buildMonthlyReportingAggregates(rowsInput, options = {}) {
  const rows = filterRowsByRange(normalizeRowList(rowsInput), options.from, options.to);
  const grouped = groupRowsByMonth(rows);
  const periods = Array.from(grouped.keys()).sort().reverse();
  const items = [];
  const queryKey = buildMonthlyAggregateQueryKey(options);

  for (const period of periods) {
    const monthRows = grouped.get(period) || [];
    const monthRange = createMonthlyRange(period, {
      from: normalizeText(options.from),
      to: normalizeText(options.to),
    });
    const report = buildLegacyReportData(monthRows, {
      roster: normalizeRoster(options.roster),
      rules: options.rules,
      from: monthRange.from,
      to: monthRange.to,
      adjustments: normalizeRecordList(options.adjustments),
    });

    items.push({
      period,
      label: formatMonthLabel(period),
      range: monthRange,
      summary: cloneStats(report?.summary),
      topTeams: normalizeTopTeams(report),
      topStaff: normalizeTopStaff(report),
    });
  }

  const normalizedItems = applyLimit(items, options.limit);

  return {
    range: {
      from: normalizeText(options.from) || normalizedItems.at(-1)?.range?.from || '',
      to: normalizeText(options.to) || normalizedItems[0]?.range?.to || '',
    },
    ruleSet: toRuleSetReference(options.rules),
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    cache: {
      queryKey,
      reused: false,
    },
    total: items.length,
    items: normalizedItems,
  };
}

export function buildMonthlyAggregateQueryKey(query = {}) {
  return JSON.stringify({
    from: normalizeText(query.from),
    to: normalizeText(query.to),
    limit: Number.isFinite(query.limit) && query.limit > 0 ? Math.trunc(query.limit) : 0,
  });
}

export function buildDefaultMonthlyAggregateQuery(rowsInput) {
  const periods = Array.from(groupRowsByMonth(normalizeRowList(rowsInput)).keys()).sort();
  const selectedPeriods = periods.slice(-2);
  if (!selectedPeriods.length) {
    return {
      from: '',
      to: '',
    };
  }

  const firstRange = createMonthlyRange(selectedPeriods[0]);
  const lastRange = createMonthlyRange(selectedPeriods.at(-1));
  return {
    from: firstRange.from,
    to: lastRange.to,
  };
}

export function listReportingSchedules(entriesInput, options = {}) {
  const asOf = resolveAsOfDate(options.asOf);
  const entries = Array.isArray(entriesInput) ? entriesInput : [];
  const items = entries
    .map((entry, index) =>
      normalizeReportingScheduleEntry(entry, {
        fallbackId: `schedule-${index + 1}`,
        fromDate: asOf,
      })
    )
    .filter(Boolean);

  return {
    total: items.length,
    items,
  };
}

function toRuleSetReference(ruleSet) {
  return {
    id: normalizeText(ruleSet?.id) || 'default',
    name: normalizeText(ruleSet?.name) || 'Default KPI',
  };
}

function normalizeRowList(input) {
  return Array.isArray(input) ? input.filter(isRecord) : [];
}

function normalizeRoster(input) {
  if (!isRecord(input)) {
    return { version: 1, teams: [] };
  }

  return {
    ...input,
    teams: Array.isArray(input.teams) ? input.teams.filter(isRecord) : [],
  };
}

function normalizeRecordList(input) {
  return Array.isArray(input) ? input.filter(isRecord) : [];
}

function normalizeTopTeams(report) {
  const items = Array.isArray(report?.teams?.list) ? report.teams.list : [];
  return items.slice(0, 3).map((entry) => ({
    key: normalizeText(entry?.key),
    name: normalizeText(entry?.name),
    stats: cloneStats(entry?.stats),
  }));
}

function normalizeTopStaff(report) {
  const items = Array.isArray(report?.staff?.list) ? report.staff.list : [];
  return items.slice(0, 3).map((entry) => ({
    key: normalizeText(entry?.key),
    name: normalizeText(entry?.name),
    teamLabel: normalizeText(entry?.teamLabel),
    stats: cloneStats(entry?.stats),
  }));
}

function cloneStats(stats) {
  const adjustmentTotals = isRecord(stats?.adjustmentTotals) ? { ...stats.adjustmentTotals } : {};
  const licenseCodes = Array.isArray(stats?.licenseCodes) ? [...stats.licenseCodes] : [];

  return {
    decls: Number(stats?.decls || 0),
    import: Number(stats?.import || 0),
    export: Number(stats?.export || 0),
    items: Number(stats?.items || 0),
    licenses: Number(stats?.licenses || 0),
    kpi: Number(stats?.kpi || 0),
    co: Number(stats?.co || 0),
    coLines: Number(stats?.coLines || 0),
    companyCount: Number(stats?.companyCount || 0),
    licenseSummary: normalizeText(stats?.licenseSummary) || '—',
    adjustmentTotals,
    licenseCodes,
    licenseCount: Number(stats?.licenseCount || licenseCodes.length || 0),
  };
}

function normalizeAdjustments(input) {
  const source = isRecord(input) ? input : {};

  return {
    list: Array.isArray(source.list) ? [...source.list] : [],
    applied: Array.isArray(source.applied) ? [...source.applied] : [],
    totalPoints: Number(source.totalPoints || 0),
    pendingCount: Number(source.pendingCount || 0),
    approvedCount: Number(source.approvedCount || 0),
    rejectedCount: Number(source.rejectedCount || 0),
    appliedCount: Number(source.appliedCount || 0),
    totalsByCategory: isRecord(source.totalsByCategory) ? { ...source.totalsByCategory } : {},
  };
}

function buildSummaryCompanyGroups(report) {
  const rows = flattenItemRows(Array.isArray(report?.staff?.list) ? report.staff.list : []);

  return {
    staff: aggregateLegacyCompanies(rows, { includeStaff: true, includeTeam: false }),
    teams: aggregateLegacyCompanies(rows, { includeStaff: true, includeTeam: true }),
  };
}

function attachStaffCompanies(item) {
  const rows = Array.isArray(item?.rows) ? item.rows : [];
  return {
    ...item,
    companies: aggregateLegacyCompanies(rows, { includeStaff: false, includeTeam: false }),
  };
}

function attachTeamCompanies(item) {
  const rows = Array.isArray(item?.rows) ? item.rows : [];
  return {
    ...item,
    companies: aggregateLegacyCompanies(rows, { includeStaff: true, includeTeam: false }),
  };
}

function flattenItemRows(items) {
  const rows = [];

  for (const item of items) {
    if (!Array.isArray(item?.rows)) {
      continue;
    }
    rows.push(...item.rows);
  }

  return rows;
}

function applyLimit(items, limit) {
  if (!Number.isFinite(limit) || limit <= 0) {
    return [...items];
  }

  return items.slice(0, Math.trunc(limit));
}

function filterRowsByRange(rows, from, to) {
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

function groupRowsByMonth(rows) {
  const grouped = new Map();

  for (const row of rows) {
    const rowDate = parseRowDate(row);
    if (!rowDate) {
      continue;
    }

    const period = `${rowDate.getFullYear()}-${String(rowDate.getMonth() + 1).padStart(2, '0')}`;
    const bucket = grouped.get(period) || [];
    bucket.push(row);
    grouped.set(period, bucket);
  }

  return grouped;
}

function createMonthlyRange(period, options = {}) {
  const [yearText, monthText] = String(period || '').split('-');
  const year = Number.parseInt(yearText || '', 10);
  const monthIndex = Number.parseInt(monthText || '', 10) - 1;

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return { from: '', to: '' };
  }

  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  const requestedFrom = parseDateOnly(options.from);
  const requestedTo = parseDateOnly(options.to);
  const fromDate = requestedFrom && requestedFrom.getTime() > start.getTime() ? requestedFrom : start;
  const toDate = requestedTo && requestedTo.getTime() < end.getTime() ? requestedTo : end;

  return {
    from: formatDateOnly(fromDate),
    to: formatDateOnly(toDate),
  };
}

function parseRowDate(row) {
  return parseDateOnly(row?.date || row?.ngay_dk || row?.created_at);
}

function parseDateOnly(input) {
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

function formatDateOnly(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatMonthLabel(period) {
  const [year, month] = String(period || '').split('-');
  return year && month ? `${month}/${year}` : String(period || '');
}

function resolveAsOfDate(input) {
  if (!input) {
    return undefined;
  }

  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function normalizeReportingScheduleEntry(input, options = {}) {
  if (!isRecord(input)) {
    return null;
  }

  const frequency = normalizeFrequency(input.frequency);
  if (!frequency) {
    return null;
  }

  const timeInfo = normalizeScheduleTime(input.time);
  const normalized = {
    id: normalizeText(input.id) || normalizeText(options.fallbackId) || 'schedule',
    name: normalizeText(input.name) || 'Bao cao KPI',
    frequency,
    time: timeInfo.label,
    dayOfWeek: frequency === 'weekly' ? clampWeekday(input.dayOfWeek) : null,
    dayOfMonth: frequency === 'monthly' ? clampMonthDay(input.dayOfMonth) : null,
    recipients: normalizeScheduleRecipients(input.recipients),
    formats: normalizeScheduleFormats(input.formats),
    deliveryChannels: normalizeDeliveryChannels(input.deliveryChannels),
    deliveryStatus: normalizeDeliveryStatus(input.deliveryStatus),
    lastDeliveryAt: normalizeOptionalIsoString(input.lastDeliveryAt),
    lastDeliveryError: normalizeText(input.lastDeliveryError),
    active: normalizeBoolean(input.active, true),
    lastRun: normalizeOptionalIsoString(input.lastRun),
    nextRun: normalizeOptionalIsoString(input.nextRun),
  };

  if (!normalized.active) {
    normalized.nextRun = '';
    return normalized;
  }

  const upcoming = calculateNextReportScheduleRun(normalized, {
    fromDate: options.fromDate,
  });
  normalized.nextRun = upcoming || '';
  return normalized;
}

function calculateNextReportScheduleRun(schedule, options = {}) {
  const base = options.fromDate instanceof Date ? new Date(options.fromDate) : new Date();
  if (Number.isNaN(base.getTime())) {
    return null;
  }

  const timeInfo = normalizeScheduleTime(schedule.time);
  const candidate = new Date(base.getTime());
  candidate.setSeconds(0, 0);
  candidate.setMilliseconds(0);

  if (schedule.frequency === 'weekly') {
    const targetDay = clampWeekday(schedule.dayOfWeek);
    const currentDay = candidate.getDay() === 0 ? 7 : candidate.getDay();
    candidate.setHours(timeInfo.hour, timeInfo.minute, 0, 0);

    let difference = targetDay - currentDay;
    if (difference < 0 || (difference === 0 && candidate <= base)) {
      difference += 7;
    }

    candidate.setDate(candidate.getDate() + difference);
    candidate.setHours(timeInfo.hour, timeInfo.minute, 0, 0);
    return candidate.toISOString();
  }

  const targetDay = clampMonthDay(schedule.dayOfMonth);
  const initial = new Date(
    candidate.getFullYear(),
    candidate.getMonth(),
    1,
    timeInfo.hour,
    timeInfo.minute,
    0,
    0
  );
  initial.setDate(Math.min(targetDay, daysInMonth(initial)));

  if (initial <= base) {
    initial.setDate(1);
    initial.setMonth(initial.getMonth() + 1);
    initial.setDate(Math.min(targetDay, daysInMonth(initial)));
  }

  initial.setHours(timeInfo.hour, timeInfo.minute, 0, 0);
  return initial.toISOString();
}

function normalizeScheduleTime(input) {
  const raw = normalizeText(input) || DEFAULT_SCHEDULE_TIME;
  const matched = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!matched) {
    return { hour: 8, minute: 0, label: DEFAULT_SCHEDULE_TIME };
  }

  const hour = clampNumber(Number.parseInt(matched[1], 10), 0, 23, 8);
  const minute = clampNumber(Number.parseInt(matched[2], 10), 0, 59, 0);
  return {
    hour,
    minute,
    label: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  };
}

function normalizeScheduleRecipients(input) {
  const rawValues = Array.isArray(input) ? input : typeof input === 'string' ? input.split(/[,\n;]/) : [];
  const recipients = [];
  const seen = new Set();

  for (const rawValue of rawValues) {
    const value = normalizeText(rawValue);
    if (!value || seen.has(value)) {
      continue;
    }

    seen.add(value);
    recipients.push(value);
  }

  return recipients;
}

function normalizeScheduleFormats(input) {
  const values = Array.isArray(input) ? input : [];
  const formats = [];
  const seen = new Set();

  for (const rawValue of values) {
    const value = normalizeText(rawValue).toLowerCase();
    if (!VALID_SCHEDULE_FORMATS.has(value) || seen.has(value)) {
      continue;
    }

    seen.add(value);
    formats.push(value);
  }

  return formats.length ? formats : ['excel'];
}

function normalizeDeliveryChannels(input) {
  const rawValues = Array.isArray(input) ? input : typeof input === 'string' ? input.split(/[,\n;]/) : [];
  const channels = [];
  const seen = new Set();

  for (const rawValue of rawValues) {
    const value = normalizeText(rawValue).toLowerCase();
    if (!VALID_DELIVERY_CHANNELS.has(value) || seen.has(value)) {
      continue;
    }

    seen.add(value);
    channels.push(value);
  }

  return channels.length ? channels : ['email'];
}

function normalizeDeliveryStatus(input) {
  const normalized = normalizeText(input).toLowerCase();
  return VALID_DELIVERY_STATUSES.has(normalized) ? normalized : 'idle';
}

function normalizeFrequency(input) {
  const normalized = normalizeText(input).toLowerCase();
  if (!VALID_SCHEDULE_FREQUENCIES.has(normalized)) {
    return null;
  }

  return normalized;
}

function normalizeOptionalIsoString(input) {
  const value = normalizeText(input);
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function normalizeGeneratedAt(input) {
  const generatedAt = input instanceof Date ? input : new Date();
  return Number.isNaN(generatedAt.getTime()) ? new Date().toISOString() : generatedAt.toISOString();
}

function normalizeBoolean(input, fallback) {
  if (typeof input === 'boolean') {
    return input;
  }

  if (typeof input === 'string') {
    const normalized = input.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }

    if (normalized === 'false') {
      return false;
    }
  }

  return fallback;
}

function clampWeekday(input) {
  return clampNumber(Number(input), 1, 7, 1);
}

function clampMonthDay(input) {
  return clampNumber(Number(input), 1, 31, 1);
}

function clampNumber(input, minimum, maximum, fallback) {
  if (!Number.isFinite(input)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.trunc(input)));
}

function daysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function normalizeText(input) {
  return typeof input === 'string' ? input.trim() : '';
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
