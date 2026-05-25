import { normalizeStr } from '../../legacy/legacy-normalizers.js';

const DEFAULT_SCHEDULE_TIME = '08:00';
const VALID_SCHEDULE_FORMATS = new Set(['excel', 'pdf']);
const VALID_SCHEDULE_FREQUENCIES = new Set(['weekly', 'monthly']);
const VALID_DELIVERY_CHANNELS = new Set(['email', 'report_center', 'download_bundle']);
const VALID_DELIVERY_STATUSES = new Set(['idle', 'pending', 'ready', 'success', 'error', 'blocked']);

export type ReportingScheduleRecord = {
  id: string;
  name: string;
  frequency: 'weekly' | 'monthly';
  time: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  recipients: string[];
  formats: string[];
  deliveryChannels: string[];
  deliveryStatus: string;
  lastDeliveryAt: string;
  lastDeliveryError: string;
  active: boolean;
  lastRun: string;
  nextRun: string;
};

type ReportingScheduleMutationOptions = {
  fromDate?: Date;
};

export function normalizeReportingScheduleEntry(
  input: unknown,
  options: {
    fallbackId?: string;
    fromDate?: Date;
  } = {}
): ReportingScheduleRecord | null {
  if (!isRecord(input)) {
    return null;
  }

  const frequency = normalizeFrequency(input.frequency);
  if (!frequency) {
    return null;
  }

  const timeInfo = normalizeScheduleTime(input.time);
  const normalized: ReportingScheduleRecord = {
    id: normalizeStr(input.id) || normalizeStr(options.fallbackId) || 'schedule',
    name: normalizeStr(input.name) || 'Báo cáo KPI',
    frequency,
    time: timeInfo.label,
    dayOfWeek: frequency === 'weekly' ? clampWeekday(input.dayOfWeek) : null,
    dayOfMonth: frequency === 'monthly' ? clampMonthDay(input.dayOfMonth) : null,
    recipients: normalizeScheduleRecipients(input.recipients),
    formats: normalizeScheduleFormats(input.formats),
    deliveryChannels: normalizeDeliveryChannels(input.deliveryChannels),
    deliveryStatus: normalizeDeliveryStatus(input.deliveryStatus),
    lastDeliveryAt: normalizeOptionalIsoString(input.lastDeliveryAt),
    lastDeliveryError: normalizeOptionalText(input.lastDeliveryError),
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
  normalized.nextRun = upcoming ?? '';
  return normalized;
}

export function normalizeReportingScheduleMutationEntry(
  input: unknown,
  fallback: unknown = null,
  options: ReportingScheduleMutationOptions = {}
): ReportingScheduleRecord {
  const raw = isRecord(input) ? input : {};
  const base = isRecord(fallback) ? fallback : {};
  const frequency = normalizeFrequency(raw.frequency) ?? normalizeFrequency(base.frequency) ?? 'weekly';
  const timeInfo = normalizeScheduleTime(raw.time ?? base.time ?? DEFAULT_SCHEDULE_TIME);
  const normalized: ReportingScheduleRecord = {
    id:
      normalizeStr(raw.id) ||
      normalizeStr(base.id) ||
      `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: (normalizeStr(raw.name) || normalizeStr(base.name) || 'Báo cáo KPI').slice(0, 120),
    frequency,
    time: timeInfo.label,
    dayOfWeek: frequency === 'weekly' ? clampWeekday(raw.dayOfWeek ?? base.dayOfWeek ?? 1) : null,
    dayOfMonth: frequency === 'monthly' ? clampMonthDay(raw.dayOfMonth ?? base.dayOfMonth ?? 1) : null,
    recipients: normalizeScheduleRecipients(raw.recipients ?? base.recipients ?? []),
    formats: normalizeScheduleFormats(raw.formats ?? base.formats ?? []),
    deliveryChannels: normalizeDeliveryChannels(raw.deliveryChannels ?? base.deliveryChannels ?? []),
    deliveryStatus: normalizeDeliveryStatus(raw.deliveryStatus ?? base.deliveryStatus),
    lastDeliveryAt:
      normalizeOptionalIsoString(raw.lastDeliveryAt) || normalizeOptionalIsoString(base.lastDeliveryAt),
    lastDeliveryError:
      normalizeOptionalText(raw.lastDeliveryError) || normalizeOptionalText(base.lastDeliveryError),
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

export function upsertReportingScheduleEntry(
  entriesInput: unknown,
  entry: unknown,
  options: ReportingScheduleMutationOptions = {}
): {
  saved: ReportingScheduleRecord;
  items: ReportingScheduleRecord[];
} {
  const items = listStoredReportingSchedules(entriesInput);
  const normalizedId = normalizeStr(isRecord(entry) ? entry.id : '');
  const index = normalizedId ? items.findIndex((item) => normalizeStr(item.id) === normalizedId) : -1;
  const fallback = index >= 0 ? items[index] : null;
  const saved = normalizeReportingScheduleMutationEntry(entry, fallback, options);

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

export function removeReportingScheduleEntry(
  entriesInput: unknown,
  id: string
): {
  deleted: boolean;
  items: ReportingScheduleRecord[];
} {
  const normalizedId = normalizeStr(id);
  const items = listStoredReportingSchedules(entriesInput);

  if (!normalizedId) {
    return {
      deleted: false,
      items,
    };
  }

  const nextItems = items.filter((item) => normalizeStr(item.id) !== normalizedId);
  return {
    deleted: nextItems.length !== items.length,
    items: nextItems,
  };
}

function calculateNextReportScheduleRun(
  schedule: ReportingScheduleRecord,
  options: {
    fromDate?: Date;
  } = {}
): string | null {
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

function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function normalizeScheduleTime(input: unknown): {
  hour: number;
  minute: number;
  label: string;
} {
  const raw = normalizeStr(input) || DEFAULT_SCHEDULE_TIME;
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

function normalizeScheduleRecipients(input: unknown): string[] {
  const rawValues = Array.isArray(input) ? input : typeof input === 'string' ? input.split(/[,\n;]/) : [];
  const seen = new Set<string>();
  const recipients: string[] = [];

  for (const rawValue of rawValues) {
    const value = normalizeStr(rawValue);
    if (!value || seen.has(value)) {
      continue;
    }

    seen.add(value);
    recipients.push(value);
  }

  return recipients;
}

function normalizeScheduleFormats(input: unknown): string[] {
  const values = Array.isArray(input) ? input : [];
  const formats: string[] = [];
  const seen = new Set<string>();

  for (const rawValue of values) {
    const value = normalizeStr(rawValue).toLowerCase();
    if (!VALID_SCHEDULE_FORMATS.has(value) || seen.has(value)) {
      continue;
    }

    seen.add(value);
    formats.push(value);
  }

  return formats.length ? formats : ['excel'];
}

function normalizeDeliveryChannels(input: unknown): string[] {
  const rawValues = Array.isArray(input) ? input : typeof input === 'string' ? input.split(/[,\n;]/) : [];
  const channels: string[] = [];
  const seen = new Set<string>();

  for (const rawValue of rawValues) {
    const value = normalizeStr(rawValue).toLowerCase();
    if (!VALID_DELIVERY_CHANNELS.has(value) || seen.has(value)) {
      continue;
    }

    seen.add(value);
    channels.push(value);
  }

  return channels.length ? channels : ['email'];
}

function normalizeDeliveryStatus(input: unknown): string {
  const value = normalizeStr(input).toLowerCase();
  return VALID_DELIVERY_STATUSES.has(value) ? value : 'idle';
}

function normalizeFrequency(input: unknown): 'weekly' | 'monthly' | null {
  const normalized = normalizeStr(input);
  if (!VALID_SCHEDULE_FREQUENCIES.has(normalized)) {
    return null;
  }

  return normalized as 'weekly' | 'monthly';
}

function clampWeekday(input: unknown): number {
  return clampNumber(Number(input), 1, 7, 1);
}

function clampMonthDay(input: unknown): number {
  return clampNumber(Number(input), 1, 31, 1);
}

function clampNumber(input: number, minimum: number, maximum: number, fallback: number): number {
  if (!Number.isFinite(input)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.trunc(input)));
}

function normalizeBoolean(input: unknown, fallback: boolean): boolean {
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

function normalizeOptionalIsoString(input: unknown): string {
  const value = normalizeStr(input);
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function normalizeOptionalText(input: unknown): string {
  return normalizeStr(input);
}

function listStoredReportingSchedules(entriesInput: unknown): ReportingScheduleRecord[] {
  return Array.isArray(entriesInput)
    ? entriesInput
        .map((entry, index) => normalizeReportingScheduleEntry(entry, { fallbackId: `schedule-${index + 1}` }))
        .filter((entry): entry is ReportingScheduleRecord => Boolean(entry))
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
