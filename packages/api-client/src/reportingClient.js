import { fetchWithAuth } from "../../../src/auth/localAuth.js";
import { toAdjustmentTotalsArray } from "../../domain/src/kpiAdjustments.js";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toRange(input) {
  return {
    from: normalizeText(input?.from),
    to: normalizeText(input?.to),
  };
}

function toRuleLicense(input) {
  const codes = Array.isArray(input?.license?.exclude?.codes)
    ? input.license.exclude.codes.map(normalizeText).filter(Boolean)
    : [];

  if (!codes.length) {
    return null;
  }

  return {
    exclude: {
      codes,
    },
  };
}

function toRuleLicenseExcludedSummary(input) {
  const codes = Array.isArray(input?.license?.exclude?.codes)
    ? input.license.exclude.codes.map(normalizeText).filter(Boolean)
    : [];

  return codes.join(", ");
}

function toRuleReference(ruleSet, currentRules) {
  const currentId = normalizeText(currentRules?.id);
  const ruleId = normalizeText(ruleSet?.id) || currentId || "default";
  const ruleName = normalizeText(ruleSet?.name) || normalizeText(currentRules?.name) || "Default KPI";
  const detailSources = [];

  if (currentId && currentId === ruleId && isRecord(currentRules)) {
    detailSources.push(currentRules);
  }

  if (isRecord(ruleSet)) {
    detailSources.push(ruleSet);
  }

  const result = {
    id: ruleId,
    name: ruleName,
  };

  for (const source of detailSources) {
    const applyFrom = normalizeText(source?.applyFrom);
    if (applyFrom) {
      result.applyFrom = applyFrom;
      break;
    }
  }

  for (const source of detailSources) {
    const version = source?.version;
    if (typeof version === "number" && Number.isFinite(version)) {
      result.version = version;
      break;
    }
    if (typeof version === "string" && version.trim()) {
      result.version = version.trim();
      break;
    }
  }

  for (const source of detailSources) {
    const license = toRuleLicense(source);
    if (license) {
      result.license = license;
      const licenseExcludedSummary = toRuleLicenseExcludedSummary(source);
      if (licenseExcludedSummary) {
        result.licenseExcludedSummary = licenseExcludedSummary;
      }
      break;
    }
  }

  return result;
}

function toAdjustments(input) {
  const source = isRecord(input) ? input : {};
  const totalsSource = isRecord(source.totalsByCategory)
    ? source.totalsByCategory
    : isRecord(source.totals)
    ? source.totals
    : {};
  const totalsByCategory = Object.keys(totalsSource).reduce((acc, key) => {
    acc[key] = {
      points: Number(totalsSource[key]?.points || 0),
      quantity: Number(totalsSource[key]?.quantity || 0),
    };
    return acc;
  }, {});
  const totalsList = toAdjustmentTotals(
    Object.keys(totalsSource).reduce((acc, key) => {
      acc[key] = {
        key,
        label: totalsSource[key]?.label,
        order: totalsSource[key]?.order,
        points: Number(totalsSource[key]?.points || 0),
        quantity: Number(totalsSource[key]?.quantity || 0),
      };
      return acc;
    }, {})
  );
  const applied = Array.isArray(source.applied)
    ? source.applied.map((entry) => {
        const adjustment = isRecord(entry?.adjustment) ? entry.adjustment : {};
        const references = Array.isArray(adjustment.references)
          ? adjustment.references.map(normalizeText).filter(Boolean)
          : [];

        return {
          key: normalizeText(adjustment.id) || `${normalizeText(entry?.date)}-${normalizeText(entry?.nhan_vien)}`,
          date: normalizeText(entry?.date),
          displayDate: normalizeText(entry?.displayDate),
          label: normalizeText(adjustment.label) || normalizeText(entry?.loai_hinh),
          staffName: normalizeText(entry?.nhan_vien),
          teamName: normalizeText(entry?.team),
          quantity: Number.isFinite(Number(adjustment.quantity)) ? Number(adjustment.quantity) : null,
          unitPoints: Number.isFinite(Number(adjustment.unitPoints)) ? Number(adjustment.unitPoints) : null,
          references,
          referencesText: references.join(", "),
          note: normalizeText(adjustment.note),
          kpi: Number(entry?.kpi || 0),
        };
      })
    : [];

  return {
    list: Array.isArray(source.list) ? source.list : [],
    applied,
    totalPoints: Number(source.totalPoints || 0),
    pendingCount: Number(source.pendingCount || 0),
    approvedCount: Number(source.approvedCount || 0),
    rejectedCount: Number(source.rejectedCount || 0),
    appliedCount: Number(source.appliedCount || 0),
    totalsByCategory,
    totalsList,
  };
}

function toSummary(input) {
  const source = isRecord(input) ? input : {};

  return {
    decls: Number(source.decls || 0),
    import: Number(source.import || 0),
    export: Number(source.export || 0),
    kpi: Number(source.kpi || 0),
    licenses: Number(source.licenses || 0),
    licenseCount: Number(source.licenseCount || 0),
    co: Number(source.co || 0),
    coLines: Number(source.coLines || 0),
    companyCount: Number(source.companyCount || 0),
    licenseSummary: normalizeText(source.licenseSummary),
  };
}

function toTrend(input) {
  const source = isRecord(input) ? input : {};

  return {
    series: Array.isArray(source.series) ? source.series : [],
    comparison: isRecord(source.comparison) ? source.comparison : null,
  };
}

function toScheduleFormats(input) {
  const rawValues = Array.isArray(input) ? input : [];
  const values = [];
  const seen = new Set();

  for (const rawValue of rawValues) {
    const value = normalizeText(rawValue).toLowerCase();
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    values.push(value);
  }

  return values.length ? values : ["excel"];
}

function toScheduleDeliveryChannels(input) {
  const rawValues = Array.isArray(input) ? input : typeof input === "string" ? input.split(/[,\n;]/) : [];
  const values = [];
  const seen = new Set();

  for (const rawValue of rawValues) {
    const value = normalizeText(rawValue).toLowerCase();
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    values.push(value);
  }

  return values.length ? values : ["email"];
}

function toScheduleDeliveryStatus(input) {
  return normalizeText(input).toLowerCase() || "idle";
}

function toScheduleRecipients(input) {
  const rawValues = Array.isArray(input) ? input : [];
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

function toScheduleItem(input) {
  const source = isRecord(input) ? input : {};
  const formats = toScheduleFormats(source.formats);
  const recipients = toScheduleRecipients(source.recipients);
  const deliveryChannels = toScheduleDeliveryChannels(source.deliveryChannels);
  const rawDayOfWeek = source.dayOfWeek;
  const rawDayOfMonth = source.dayOfMonth;
  const dayOfWeek = Number(rawDayOfWeek);
  const dayOfMonth = Number(rawDayOfMonth);

  return {
    id: normalizeText(source.id),
    name: normalizeText(source.name),
    frequency: normalizeText(source.frequency) || "weekly",
    time: normalizeText(source.time) || "08:00",
    dayOfWeek:
      rawDayOfWeek === null || rawDayOfWeek === undefined || rawDayOfWeek === ""
        ? null
        : Number.isFinite(dayOfWeek)
        ? dayOfWeek
        : null,
    dayOfMonth:
      rawDayOfMonth === null || rawDayOfMonth === undefined || rawDayOfMonth === ""
        ? null
        : Number.isFinite(dayOfMonth)
        ? dayOfMonth
        : null,
    formats,
    formatsSummary: formats.map((item) => item.toUpperCase()).join(", "),
    recipients,
    recipientsSummary: recipients.join(", "),
    deliveryChannels,
    deliveryStatus: toScheduleDeliveryStatus(source.deliveryStatus),
    lastDeliveryAt: normalizeText(source.lastDeliveryAt),
    lastDeliveryError: normalizeText(source.lastDeliveryError),
    active: source.active !== false,
    lastRun: normalizeText(source.lastRun),
    nextRun: normalizeText(source.nextRun),
  };
}

function toAggregateStatus(input) {
  const source = isRecord(input) ? input : {};

  return {
    available: Boolean(source.available),
    generatedAt: normalizeText(source.generatedAt),
    queryKey: normalizeText(source.queryKey),
    total: Number(source.total || 0),
    range: toRange(source.range),
  };
}

function toReportingViewMeta(input) {
  const source = isRecord(input) ? input : {};

  return {
    servedAt: normalizeText(source.servedAt),
    aggregateStatus: toAggregateStatus(source.aggregateStatus),
  };
}

function createKeyedCollection(items) {
  const list = Array.isArray(items) ? items : [];
  const byKey = new Map();

  for (const entry of list) {
    const key = normalizeText(entry?.key);
    if (key) {
      byKey.set(key, entry);
    }
  }

  return {
    list,
    byKey,
  };
}

function createScheduleCollection(items) {
  const list = Array.isArray(items) ? items : [];
  const byId = new Map();

  for (const entry of list) {
    const key = normalizeText(entry?.id);
    if (key) {
      byId.set(key, entry);
    }
  }

  return {
    items: list,
    byId,
  };
}

function toCompanyRows(input) {
  return Array.isArray(input) ? input : [];
}

function toCompanyGroups(input) {
  const source = isRecord(input) ? input : {};

  return {
    staff: toCompanyRows(source.staff),
    teams: toCompanyRows(source.teams),
  };
}

function toLicenseSummary(stats) {
  if (!isRecord(stats) || !Array.isArray(stats.licenseCodes)) {
    return "";
  }

  return stats.licenseCodes.map(normalizeText).filter(Boolean).join(", ");
}

function toCodeSummary(values) {
  if (!Array.isArray(values)) {
    return "";
  }

  return values.map(normalizeText).filter(Boolean).join(", ");
}

function toAdjustmentTotals(input) {
  return toAdjustmentTotalsArray(isRecord(input) ? input : {});
}

function toAdjustmentMetrics(rows, adjustmentTotals) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const safeTotals = Array.isArray(adjustmentTotals) ? adjustmentTotals : [];
  const totalPoints = safeTotals.reduce((sum, item) => {
    const value = Number(item?.points || 0);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);

  let entryCount = 0;
  let positive = 0;
  let negative = 0;
  let neutral = 0;

  for (const row of safeRows) {
    if (!row?.isAdjustment) {
      continue;
    }

    entryCount += 1;
    const value = Number(row?.kpi || 0);

    if (!Number.isFinite(value) || Math.abs(value) < 0.0001) {
      neutral += 1;
      continue;
    }

    if (value > 0) {
      positive += 1;
    } else {
      negative += 1;
    }
  }

  return {
    totalPoints,
    entryCount,
    positive,
    negative,
    neutral,
  };
}

function normalizeDetailRow(input) {
  const source = isRecord(input) ? input : {};

  return {
    ...source,
    licenseSummary: toCodeSummary(source.licenseCodes),
    licenseExcludedSummary: toCodeSummary(source.licenseExcludedCodes),
  };
}

function normalizeStaffItem(input) {
  const source = isRecord(input) ? input : {};
  const stats = isRecord(source.stats) ? source.stats : {};
  const adjustmentSummary = isRecord(source.adjustmentSummary) ? source.adjustmentSummary : {};
  const rows = (Array.isArray(source.rows) ? source.rows : []).map(normalizeDetailRow);
  const adjustmentTotals = toAdjustmentTotals(adjustmentSummary);

  return {
    key: normalizeText(source.key),
    name: normalizeText(source.name),
    teamLabel: normalizeText(source.teamLabel),
    stats,
    licenseSummary: toLicenseSummary(stats),
    adjustmentSummary,
    adjustmentTotals,
    adjustmentMetrics: toAdjustmentMetrics(rows, adjustmentTotals),
    rows,
    companies: toCompanyRows(source.companies),
  };
}

function normalizeTeamItem(input) {
  const source = isRecord(input) ? input : {};
  const stats = isRecord(source.stats) ? source.stats : {};
  const adjustmentSummary = isRecord(source.adjustmentSummary) ? source.adjustmentSummary : {};
  const rows = (Array.isArray(source.rows) ? source.rows : []).map(normalizeDetailRow);
  const adjustmentTotals = toAdjustmentTotals(adjustmentSummary);

  return {
    key: normalizeText(source.key),
    name: normalizeText(source.name),
    stats,
    licenseSummary: toLicenseSummary(stats),
    adjustmentSummary,
    adjustmentTotals,
    adjustmentMetrics: toAdjustmentMetrics(rows, adjustmentTotals),
    rows,
    members: Array.isArray(source.members)
      ? source.members.map((member) => {
          const memberSource = isRecord(member) ? member : {};
          const memberStats = isRecord(memberSource.stats) ? memberSource.stats : {};

          return {
            key: normalizeText(memberSource.key),
            name: normalizeText(memberSource.name),
            stats: memberStats,
            licenseSummary: toLicenseSummary(memberStats),
          };
        })
      : [],
    companies: toCompanyRows(source.companies),
  };
}

export function createEmptyReportingViewModel(range = {}, currentRules = null) {
  return {
    meta: toReportingViewMeta(null),
    summary: toSummary(null),
    trend: toTrend(null),
    adjustments: toAdjustments(null),
    range: toRange(range),
    rules: toRuleReference(null, currentRules),
    companies: toCompanyGroups(null),
    staff: createKeyedCollection([]),
    teams: createKeyedCollection([]),
  };
}

export function createEmptyReportingSchedulesViewModel() {
  return {
    total: 0,
    aggregateStatus: toAggregateStatus(null),
    ...createScheduleCollection([]),
  };
}

let reportingSchedulesCache = createEmptyReportingSchedulesViewModel();
const reportingSchedulesListeners = new Set();

function publishReportingSchedules(viewModel) {
  reportingSchedulesCache = isRecord(viewModel)
    ? viewModel
    : createEmptyReportingSchedulesViewModel();

  for (const listener of reportingSchedulesListeners) {
    try {
      listener(reportingSchedulesCache);
    } catch (error) {
      console.error("Không thể đồng bộ subscriber lịch báo cáo KPI", error);
    }
  }

  return reportingSchedulesCache;
}

function mergeScheduleItemIntoCache(item) {
  const savedItem = toScheduleItem(item);
  const currentItems = Array.isArray(reportingSchedulesCache.items)
    ? reportingSchedulesCache.items
    : [];
  const index = currentItems.findIndex((entry) => entry.id === savedItem.id);
  const nextItems = [...currentItems];

  if (index >= 0) {
    nextItems[index] = savedItem;
  } else {
    nextItems.push(savedItem);
  }

  return publishReportingSchedules(
    buildReportingSchedulesViewModel({
      total: nextItems.length,
      aggregateStatus: reportingSchedulesCache.aggregateStatus,
      items: nextItems,
    })
  );
}

function removeScheduleItemFromCache(id) {
  const normalizedId = normalizeText(id);
  const currentItems = Array.isArray(reportingSchedulesCache.items)
    ? reportingSchedulesCache.items
    : [];
  const nextItems = currentItems.filter((entry) => entry.id !== normalizedId);

  return publishReportingSchedules(
    buildReportingSchedulesViewModel({
      total: nextItems.length,
      aggregateStatus: reportingSchedulesCache.aggregateStatus,
      items: nextItems,
    })
  );
}

export function buildReportingViewModel({ meta, summary, staff, teams, currentRules = null } = {}) {
  const metaData = isRecord(meta) ? meta : {};
  const summaryData = isRecord(summary) ? summary : {};
  const staffData = isRecord(staff) ? staff : {};
  const teamData = isRecord(teams) ? teams : {};
  const staffItems = (Array.isArray(staffData.items) ? staffData.items : []).map(normalizeStaffItem);
  const teamItems = (Array.isArray(teamData.items) ? teamData.items : []).map(normalizeTeamItem);

  return {
    meta: toReportingViewMeta(metaData),
    summary: toSummary(summaryData.summary),
    trend: toTrend(summaryData.trend),
    adjustments: toAdjustments(summaryData.adjustments),
    range: toRange(summaryData.range),
    rules: toRuleReference(summaryData.ruleSet, currentRules),
    companies: toCompanyGroups(summaryData.companies),
    staff: createKeyedCollection(staffItems),
    teams: createKeyedCollection(teamItems),
  };
}

export function buildReportingSchedulesViewModel(input = {}) {
  const source = isRecord(input) ? input : {};
  const items = (Array.isArray(source.items) ? source.items : []).map(toScheduleItem);

  return {
    total: Number(source.total || items.length),
    aggregateStatus: toAggregateStatus(source.aggregateStatus),
    ...createScheduleCollection(items),
  };
}

export function normalizeStoredReportingScheduleItems(items = []) {
  return buildReportingSchedulesViewModel({ items }).items;
}

export function mergeReportingScheduleItems(remoteItems = [], localItems = []) {
  const normalizedRemoteItems = (Array.isArray(remoteItems) ? remoteItems : []).map(toScheduleItem);
  const normalizedLocalItems = (Array.isArray(localItems) ? localItems : []).map(toScheduleItem);

  if (!normalizedLocalItems.length) {
    return normalizedRemoteItems;
  }

  const remoteById = new Map(normalizedRemoteItems.map((item) => [item.id, item]));
  const localIds = new Set();
  const merged = [];

  for (const localItem of normalizedLocalItems) {
    const remoteItem = localItem.id ? remoteById.get(localItem.id) : null;
    if (localItem.id) {
      localIds.add(localItem.id);
    }

    if (!remoteItem) {
      merged.push(localItem);
      continue;
    }

    const formats = localItem.formats.length ? localItem.formats : remoteItem.formats;
    const recipients = localItem.recipients.length ? localItem.recipients : remoteItem.recipients;
    const deliveryChannels = localItem.deliveryChannels.length
      ? localItem.deliveryChannels
      : remoteItem.deliveryChannels;
    const localHasDeliveryState =
      (localItem.deliveryStatus && localItem.deliveryStatus !== "idle") ||
      localItem.lastDeliveryAt ||
      localItem.lastDeliveryError;

    merged.push({
      ...remoteItem,
      ...localItem,
      formats,
      formatsSummary: formats.map((item) => item.toUpperCase()).join(", "),
      recipients,
      recipientsSummary: recipients.join(", "),
      deliveryChannels,
      deliveryStatus: localHasDeliveryState ? localItem.deliveryStatus : remoteItem.deliveryStatus,
      lastDeliveryAt: localItem.lastDeliveryAt || remoteItem.lastDeliveryAt,
      lastDeliveryError: localItem.lastDeliveryError || remoteItem.lastDeliveryError,
      lastRun: localItem.lastRun || remoteItem.lastRun,
      nextRun: localItem.nextRun || remoteItem.nextRun,
    });
  }

  for (const remoteItem of normalizedRemoteItems) {
    if (remoteItem.id && localIds.has(remoteItem.id)) {
      continue;
    }
    merged.push(remoteItem);
  }

  return merged;
}

function buildQueryString(query = {}) {
  const params = new URLSearchParams();

  const from = normalizeText(query.from);
  if (from) {
    params.set("from", from);
  }

  const to = normalizeText(query.to);
  if (to) {
    params.set("to", to);
  }

  const ruleId = normalizeText(query.ruleId);
  if (ruleId) {
    params.set("ruleId", ruleId);
  }

  if (Number.isFinite(query.limit) && query.limit > 0) {
    params.set("limit", String(Math.trunc(query.limit)));
  }

  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

async function requestJson(path, query = {}, options = {}) {
  const headers = new Headers(options.headers || undefined);
  const init = {
    method: options.method || "GET",
    headers,
  };

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    init.body = JSON.stringify(options.body);
  }

  const response = await fetchWithAuth(`${path}${buildQueryString(query)}`, init);

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || `HTTP ${response.status}`);
  }

  return isRecord(payload?.data) ? payload.data : {};
}

export async function fetchReportingSchedules(query = {}) {
  const schedules = await requestJson("/api/v4/reporting/schedules", query);
  return publishReportingSchedules(buildReportingSchedulesViewModel(schedules));
}

export function loadLocalReportingScheduleItems() {
  return [...reportingSchedulesCache.items];
}

export function subscribeReportingSchedules(listener) {
  if (typeof listener !== "function") {
    return () => {};
  }

  reportingSchedulesListeners.add(listener);
  listener(reportingSchedulesCache);

  return () => {
    reportingSchedulesListeners.delete(listener);
  };
}

export async function saveReportingSchedule(entry, options = {}) {
  void options;
  const payload = await requestJson("/api/v4/reporting/schedules", {}, {
    method: "POST",
    body: entry,
  });
  const saved = toScheduleItem(payload.item);
  mergeScheduleItemIntoCache(saved);
  return saved;
}

export async function deleteReportingSchedule(id, options = {}) {
  void options;
  const normalizedId = normalizeText(id);
  if (!normalizedId) {
    return false;
  }

  const payload = await requestJson(`/api/v4/reporting/schedules/${encodeURIComponent(normalizedId)}`, {}, {
    method: "DELETE",
  });
  if (payload.deleted === true) {
    removeScheduleItemFromCache(normalizedId);
    return true;
  }

  return false;
}

export async function fetchReportingViewModel(query = {}, currentRules = null) {
  return buildReportingViewModel({
    ...await requestJson("/api/v4/reporting/view", query),
    currentRules,
  });
}
