export const REPORT_SCHEDULE_KEY = "kpi_report_schedule_v1";

const VALID_SCHEDULE_FREQUENCIES = new Set(["weekly", "monthly"]);
const VALID_SCHEDULE_FORMATS = new Set(["excel", "pdf"]);

function safeParse(json, fallback) {
  try {
    const value = JSON.parse(json);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function normalizeScheduleTime(value) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d{1,2}):(\d{1,2})$/);
    if (match) {
      const hours = Math.min(Math.max(parseInt(match[1], 10), 0), 23);
      const minutes = Math.min(Math.max(parseInt(match[2], 10), 0), 59);
      return {
        hour: hours,
        minute: minutes,
        label: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
      };
    }
  }

  return { hour: 8, minute: 0, label: "08:00" };
}

function clampWeekday(value) {
  const day = Number.isFinite(Number(value)) ? Number(value) : 1;
  if (day < 1) return 1;
  if (day > 7) return 7;
  return Math.round(day);
}

function clampMonthDay(value) {
  const day = Number.isFinite(Number(value)) ? Number(value) : 1;
  if (day < 1) return 1;
  if (day > 31) return 31;
  return Math.round(day);
}

function normalizeScheduleRecipients(input) {
  const list = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(/[;,]/)
      : [];

  const seen = new Set();
  const result = [];
  for (const entry of list) {
    const value = String(entry || "").trim();
    if (!value) {
      continue;
    }
    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(value);
  }

  return result;
}

function normalizeScheduleFormats(input) {
  const list = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(/[;,]/)
      : [];

  const seen = new Set();
  const result = [];
  for (const entry of list) {
    const value = String(entry || "").trim().toLowerCase();
    if (!VALID_SCHEDULE_FORMATS.has(value) || seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }

  if (!result.length) {
    result.push("excel");
  }

  return result;
}

function createScheduleId() {
  return `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function calculateNextReportScheduleRun(schedule, { fromDate = new Date() } = {}) {
  if (!schedule || typeof schedule !== "object") {
    return null;
  }

  if (schedule.active === false) {
    return null;
  }

  const frequency = typeof schedule.frequency === "string" ? schedule.frequency.trim() : "";
  if (!VALID_SCHEDULE_FREQUENCIES.has(frequency)) {
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

  if (frequency === "weekly") {
    const targetDay = clampWeekday(schedule.dayOfWeek);
    const current = candidate.getDay() === 0 ? 7 : candidate.getDay();
    candidate.setHours(timeInfo.hour, timeInfo.minute, 0, 0);

    let diff = targetDay - current;
    if (diff < 0 || (diff === 0 && candidate <= base)) {
      diff += 7;
    }

    candidate.setDate(candidate.getDate() + diff);
    candidate.setHours(timeInfo.hour, timeInfo.minute, 0, 0);
    return candidate.toISOString();
  }

  if (frequency === "monthly") {
    const targetDay = clampMonthDay(schedule.dayOfMonth);
    const initial = new Date(
      candidate.getFullYear(),
      candidate.getMonth(),
      1,
      timeInfo.hour,
      timeInfo.minute,
      0,
      0,
    );

    const daysInMonth = new Date(initial.getFullYear(), initial.getMonth() + 1, 0).getDate();
    initial.setDate(Math.min(targetDay, daysInMonth));

    if (initial <= base) {
      initial.setDate(1);
      initial.setMonth(initial.getMonth() + 1);
      const nextDays = new Date(initial.getFullYear(), initial.getMonth() + 1, 0).getDate();
      initial.setDate(Math.min(targetDay, nextDays));
    }

    initial.setHours(timeInfo.hour, timeInfo.minute, 0, 0);
    return initial.toISOString();
  }

  return null;
}

export function normalizeReportScheduleEntry(entry, fallback = null) {
  const base = fallback && typeof fallback === "object" ? fallback : {};
  const raw = entry && typeof entry === "object" ? entry : {};
  const id = String(raw.id || base.id || createScheduleId());
  const name = String(raw.name ?? base.name ?? "Báo cáo KPI").trim().slice(0, 120) || "Báo cáo KPI";

  const rawFrequency = typeof raw.frequency === "string" ? raw.frequency.trim() : "";
  const baseFrequency = typeof base.frequency === "string" ? base.frequency.trim() : "";
  const frequency = VALID_SCHEDULE_FREQUENCIES.has(rawFrequency)
    ? rawFrequency
    : VALID_SCHEDULE_FREQUENCIES.has(baseFrequency)
      ? baseFrequency
      : "weekly";

  const timeInfo = normalizeScheduleTime(raw.time ?? base.time ?? "08:00");
  const recipients = normalizeScheduleRecipients(raw.recipients ?? base.recipients ?? []);
  const formats = normalizeScheduleFormats(raw.formats ?? base.formats ?? []);
  const active = raw.active ?? base.active ?? true;
  const lastRun =
    typeof raw.lastRun === "string" && raw.lastRun
      ? raw.lastRun
      : typeof base.lastRun === "string"
        ? base.lastRun
        : "";
  let nextRun =
    typeof raw.nextRun === "string" && raw.nextRun
      ? raw.nextRun
      : typeof base.nextRun === "string"
        ? base.nextRun
        : "";

  const normalized = {
    id,
    name,
    frequency,
    time: timeInfo.label,
    dayOfWeek: frequency === "weekly" ? clampWeekday(raw.dayOfWeek ?? base.dayOfWeek ?? 1) : null,
    dayOfMonth: frequency === "monthly" ? clampMonthDay(raw.dayOfMonth ?? base.dayOfMonth ?? 1) : null,
    recipients,
    formats,
    active: Boolean(active),
    lastRun,
    nextRun,
  };

  if (normalized.active) {
    const upcoming = calculateNextReportScheduleRun(normalized);
    if (upcoming) {
      normalized.nextRun = upcoming;
    }
  } else {
    normalized.nextRun = "";
  }

  return normalized;
}

export function createReportScheduleStore({
  getItem = () => null,
  setItem = () => { },
  refreshSharedKeys = () => { },
  pushAuditLog = null,
} = {}) {
  function readReportSchedules() {
    const stored = safeParse(getItem(REPORT_SCHEDULE_KEY), []);
    return Array.isArray(stored) ? stored.filter(Boolean) : [];
  }

  async function writeReportSchedules(list) {
    const payload = Array.isArray(list) ? list : [];
    await setItem(REPORT_SCHEDULE_KEY, JSON.stringify(payload));
    refreshSharedKeys([REPORT_SCHEDULE_KEY]);
    return payload;
  }

  return {
    getReportSchedules() {
      return readReportSchedules().map((entry) => normalizeReportScheduleEntry(entry));
    },

    async saveReportSchedule(entry, { actor = "system" } = {}) {
      const stored = readReportSchedules();
      const normalizedId = entry && entry.id ? String(entry.id) : "";
      const index = normalizedId ? stored.findIndex((item) => item?.id === normalizedId) : -1;
      const base = index >= 0 ? stored[index] : null;
      const normalized = normalizeReportScheduleEntry(entry, base);

      if (index >= 0) {
        stored[index] = normalized;
      } else {
        stored.push(normalized);
      }

      await writeReportSchedules(stored);

      if (typeof pushAuditLog === "function") {
        pushAuditLog({
          actor,
          action: "report.schedule.save",
          detail: `Cập nhật lịch gửi báo cáo ${normalized.name}`,
          meta: {
            scheduleId: normalized.id,
            frequency: normalized.frequency,
            formats: normalized.formats,
            active: normalized.active,
          },
        });
      }

      return normalized;
    },

    async deleteReportSchedule(id, { actor = "system" } = {}) {
      const stored = readReportSchedules();
      const normalizedId = String(id || "").trim();
      if (!normalizedId) {
        return false;
      }

      const next = stored.filter((item) => item && item.id !== normalizedId);
      if (next.length === stored.length) {
        return false;
      }

      await writeReportSchedules(next);

      if (typeof pushAuditLog === "function") {
        pushAuditLog({
          actor,
          action: "report.schedule.delete",
          detail: `Xoá lịch gửi báo cáo ${normalizedId}`,
          meta: { scheduleId: normalizedId },
        });
      }

      return true;
    },
  };
}
