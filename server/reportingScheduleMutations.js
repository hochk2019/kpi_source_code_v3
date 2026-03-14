export const REPORT_SCHEDULE_STORAGE_KEY = 'kpi_report_schedule_v1';

const DEFAULT_SCHEDULE_TIME = '08:00';
const VALID_SCHEDULE_FORMATS = new Set(['excel', 'pdf']);
const VALID_SCHEDULE_FREQUENCIES = new Set(['weekly', 'monthly']);

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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
  const seen = new Set();
  const recipients = [];

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
  const rawValues = Array.isArray(input) ? input : typeof input === 'string' ? input.split(/[,\n;]/) : [];
  const seen = new Set();
  const formats = [];

  for (const rawValue of rawValues) {
    const value = normalizeText(rawValue).toLowerCase();
    if (!VALID_SCHEDULE_FORMATS.has(value) || seen.has(value)) {
      continue;
    }

    seen.add(value);
    formats.push(value);
  }

  return formats.length ? formats : ['excel'];
}

function normalizeFrequency(input) {
  const value = normalizeText(input);
  return VALID_SCHEDULE_FREQUENCIES.has(value) ? value : null;
}

function normalizeBoolean(input, fallback) {
  if (typeof input === 'boolean') {
    return input;
  }

  if (typeof input === 'string') {
    const value = input.trim().toLowerCase();
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }
  }

  return fallback;
}

function normalizeOptionalIsoString(input) {
  const value = normalizeText(input);
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function clampNumber(input, minimum, maximum, fallback) {
  if (!Number.isFinite(input)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.trunc(input)));
}

function clampWeekday(input) {
  return clampNumber(Number(input), 1, 7, 1);
}

function clampMonthDay(input) {
  return clampNumber(Number(input), 1, 31, 1);
}

function calculateNextReportScheduleRun(schedule, { fromDate = new Date() } = {}) {
  if (!isRecord(schedule) || schedule.active === false) {
    return null;
  }

  const frequency = normalizeFrequency(schedule.frequency);
  if (!frequency) {
    return null;
  }

  const base = fromDate instanceof Date ? new Date(fromDate) : new Date();
  if (Number.isNaN(base.getTime())) {
    return null;
  }

  const timeInfo = normalizeScheduleTime(schedule.time);
  const candidate = new Date(base.getTime());
  candidate.setSeconds(0, 0);
  candidate.setMilliseconds(0);

  if (frequency === 'weekly') {
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
  const nextRun = new Date(candidate.getFullYear(), candidate.getMonth(), 1, timeInfo.hour, timeInfo.minute, 0, 0);
  nextRun.setDate(Math.min(targetDay, new Date(nextRun.getFullYear(), nextRun.getMonth() + 1, 0).getDate()));

  if (nextRun <= base) {
    nextRun.setDate(1);
    nextRun.setMonth(nextRun.getMonth() + 1);
    nextRun.setDate(Math.min(targetDay, new Date(nextRun.getFullYear(), nextRun.getMonth() + 1, 0).getDate()));
  }

  nextRun.setHours(timeInfo.hour, timeInfo.minute, 0, 0);
  return nextRun.toISOString();
}

function listStoredReportingSchedules(entriesInput) {
  return Array.isArray(entriesInput) ? entriesInput.filter(isRecord) : [];
}

export function normalizeReportingScheduleMutationEntry(input, fallback = null, options = {}) {
  const raw = isRecord(input) ? input : {};
  const base = isRecord(fallback) ? fallback : {};

  const frequency = normalizeFrequency(raw.frequency) || normalizeFrequency(base.frequency) || 'weekly';
  const timeInfo = normalizeScheduleTime(raw.time ?? base.time ?? DEFAULT_SCHEDULE_TIME);
  const normalized = {
    id: normalizeText(raw.id) || normalizeText(base.id) || `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: (normalizeText(raw.name || base.name || 'Báo cáo KPI') || 'Báo cáo KPI').slice(0, 120),
    frequency,
    time: timeInfo.label,
    dayOfWeek: frequency === 'weekly' ? clampWeekday(raw.dayOfWeek ?? base.dayOfWeek ?? 1) : null,
    dayOfMonth: frequency === 'monthly' ? clampMonthDay(raw.dayOfMonth ?? base.dayOfMonth ?? 1) : null,
    recipients: normalizeScheduleRecipients(raw.recipients ?? base.recipients ?? []),
    formats: normalizeScheduleFormats(raw.formats ?? base.formats ?? []),
    active: normalizeBoolean(raw.active ?? base.active, true),
    lastRun: normalizeOptionalIsoString(raw.lastRun) || normalizeOptionalIsoString(base.lastRun),
    nextRun: normalizeOptionalIsoString(raw.nextRun) || normalizeOptionalIsoString(base.nextRun),
  };

  if (!normalized.active) {
    normalized.nextRun = '';
    return normalized;
  }

  normalized.nextRun =
    calculateNextReportScheduleRun(normalized, { fromDate: options.fromDate }) || normalized.nextRun || '';
  return normalized;
}

export function upsertReportingSchedule(entriesInput, entry, options = {}) {
  const items = listStoredReportingSchedules(entriesInput);
  const normalizedId = normalizeText(entry?.id);
  const index = normalizedId ? items.findIndex((item) => normalizeText(item.id) === normalizedId) : -1;
  const base = index >= 0 ? items[index] : null;
  const saved = normalizeReportingScheduleMutationEntry(entry, base, options);

  if (index >= 0) {
    items[index] = saved;
  } else {
    items.push(saved);
  }

  return {
    saved,
    items,
  };
}

export function removeReportingSchedule(entriesInput, id) {
  const normalizedId = normalizeText(id);
  if (!normalizedId) {
    return {
      deleted: false,
      items: listStoredReportingSchedules(entriesInput),
    };
  }

  const items = listStoredReportingSchedules(entriesInput);
  const nextItems = items.filter((item) => normalizeText(item.id) !== normalizedId);
  return {
    deleted: nextItems.length !== items.length,
    items: nextItems,
  };
}
