import { normalizeStr } from '../../legacy/legacy-normalizers.js';
import type { DeclarationRecord } from './DeclarationsRepository.js';

export type DeclarationAlertConfigDocument = {
  enabled: boolean;
  thresholdDays: number;
  autoResolveReviewed: boolean;
  channel: string;
};

export type DeclarationAlertStateEntry = {
  key: string;
  so_tk: string;
  mst: string;
  company: string;
  date: string;
  team: string;
  staff: string;
  missing: string[];
  firstDetected: string;
  lastUpdated: string;
  lastAlertAt: string;
  resolved: boolean;
  resolvedAt: string | null;
};

export type DeclarationAlertStateDocument = {
  entries: Record<string, DeclarationAlertStateEntry>;
  lastEvaluatedAt: string | null;
};

export type DeclarationAlertSummary = {
  total: number;
  outstanding: number;
  triggered: number;
};

export type DeclarationAlertListItem = {
  key: string;
  so_tk: string;
  mst: string;
  company: string;
  date: string;
  team: string;
  staff: string;
  missing: string[];
  firstDetected: string;
  lastUpdated: string;
  lastAlertAt: string;
  resolved: boolean;
  resolvedAt: string | null;
};

export type DeclarationAlertsPayload = {
  config: DeclarationAlertConfigDocument;
  alerts: DeclarationAlertListItem[];
  summary: {
    outstanding: number;
    totalTracked: number;
    lastEvaluatedAt: string | null;
  };
};

export function createDefaultDeclarationAlertConfig(): DeclarationAlertConfigDocument {
  return {
    enabled: true,
    thresholdDays: 2,
    autoResolveReviewed: true,
    channel: 'audit',
  };
}

export function normalizeDeclarationAlertConfig(value: unknown): DeclarationAlertConfigDocument {
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const defaults = createDefaultDeclarationAlertConfig();

  return {
    enabled: source.enabled === undefined ? defaults.enabled : source.enabled === true,
    thresholdDays: normalizeThresholdDays(source.thresholdDays, defaults.thresholdDays),
    autoResolveReviewed:
      source.autoResolveReviewed === undefined
        ? defaults.autoResolveReviewed
        : source.autoResolveReviewed !== false,
    channel: normalizeStr(source.channel) || defaults.channel,
  };
}

export function createDefaultDeclarationAlertState(): DeclarationAlertStateDocument {
  return {
    entries: {},
    lastEvaluatedAt: null,
  };
}

export function normalizeDeclarationAlertState(value: unknown): DeclarationAlertStateDocument {
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const rawEntries =
    source.entries && typeof source.entries === 'object' && !Array.isArray(source.entries)
      ? (source.entries as Record<string, unknown>)
      : {};
  const entries: Record<string, DeclarationAlertStateEntry> = {};

  for (const [key, entry] of Object.entries(rawEntries)) {
    const normalized = normalizeDeclarationAlertStateEntry(key, entry);
    if (normalized) {
      entries[normalized.key] = normalized;
    }
  }

  const lastEvaluatedAt = normalizeOptionalTimestamp(source.lastEvaluatedAt);
  return {
    entries,
    lastEvaluatedAt,
  };
}

export function evaluateDeclarationAlerts(input: {
  rows: readonly DeclarationRecord[];
  config: DeclarationAlertConfigDocument;
  state: DeclarationAlertStateDocument;
  now?: Date;
}): {
  state: DeclarationAlertStateDocument;
  summary: DeclarationAlertSummary;
  alerts: DeclarationAlertListItem[];
} {
  const rows = Array.isArray(input.rows) ? input.rows : [];
  const config = normalizeDeclarationAlertConfig(input.config);
  const state = normalizeDeclarationAlertState(input.state);
  const now = input.now instanceof Date ? input.now : new Date();
  const nowIso = now.toISOString();

  if (!config.enabled) {
    const nextState: DeclarationAlertStateDocument = {
      entries: {},
      lastEvaluatedAt: nowIso,
    };
    return {
      state: nextState,
      summary: {
        total: rows.length,
        outstanding: 0,
        triggered: 0,
      },
      alerts: [],
    };
  }

  const previousEntries = { ...state.entries };
  const nextEntries: Record<string, DeclarationAlertStateEntry> = {};
  const thresholdMs = Math.max(0, config.thresholdDays) * 24 * 60 * 60 * 1000;
  let triggered = 0;

  for (const row of rows) {
    if (!row || typeof row !== 'object') {
      continue;
    }

    const key = normalizeDeclarationAlertKey(row);
    if (!key) {
      continue;
    }

    const hasStaff = Boolean(normalizeStr(row.nhan_vien));
    const hasTeam = Boolean(normalizeStr(row.team));
    const reviewed = row.reviewed === true;
    const missing = [];
    if (!hasStaff) {
      missing.push('nhân viên');
    }
    if (!hasTeam) {
      missing.push('tổ đội');
    }

    const existing = previousEntries[key];
    if (missing.length === 0 || (reviewed && config.autoResolveReviewed !== false)) {
      if (existing && config.autoResolveReviewed === false) {
        nextEntries[key] = {
          ...existing,
          resolved: true,
          resolvedAt: nowIso,
          lastUpdated: nowIso,
        };
      }
      continue;
    }

    const timestamp = row.date ? Date.parse(row.date) : Number.NaN;
    const overdue = Number.isNaN(timestamp) ? true : now.getTime() - timestamp >= thresholdMs;
    if (!overdue) {
      if (existing && config.autoResolveReviewed === false) {
        nextEntries[key] = {
          ...existing,
          resolved: true,
          resolvedAt: nowIso,
          lastUpdated: nowIso,
        };
      }
      continue;
    }

    const lastAlertAtTs = existing?.lastAlertAt ? Date.parse(existing.lastAlertAt) : Number.NaN;
    const shouldAlert =
      !existing ||
      existing.resolved ||
      Number.isNaN(lastAlertAtTs) ||
      now.getTime() - lastAlertAtTs >= 60 * 60 * 1000;

    nextEntries[key] = {
      key,
      so_tk: normalizeStr(row.so_tk),
      mst: normalizeStr(row.mst),
      company: normalizeStr(row.cong_ty ?? row.company_name),
      date: normalizeStr(row.date),
      team: normalizeStr(row.team),
      staff: normalizeStr(row.nhan_vien),
      missing,
      firstDetected: existing?.firstDetected || nowIso,
      lastUpdated: nowIso,
      lastAlertAt: shouldAlert ? nowIso : existing?.lastAlertAt || nowIso,
      resolved: false,
      resolvedAt: null,
    };

    if (shouldAlert) {
      triggered += 1;
    }
  }

  const alerts = formatDeclarationAlertEntries(nextEntries);
  const nextState: DeclarationAlertStateDocument = {
    entries: nextEntries,
    lastEvaluatedAt: nowIso,
  };

  return {
    state: nextState,
    summary: {
      total: rows.length,
      outstanding: alerts.filter((entry) => !entry.resolved).length,
      triggered,
    },
    alerts,
  };
}

export function buildDeclarationAlertsPayload(input: {
  config: DeclarationAlertConfigDocument;
  state: DeclarationAlertStateDocument;
}): DeclarationAlertsPayload {
  const config = normalizeDeclarationAlertConfig(input.config);
  const state = normalizeDeclarationAlertState(input.state);
  const alerts = formatDeclarationAlertEntries(state.entries);

  return {
    config,
    alerts,
    summary: {
      outstanding: alerts.filter((entry) => !entry.resolved).length,
      totalTracked: alerts.length,
      lastEvaluatedAt: state.lastEvaluatedAt,
    },
  };
}

function normalizeDeclarationAlertStateEntry(
  fallbackKey: string,
  value: unknown,
): DeclarationAlertStateEntry | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const source = value as Record<string, unknown>;
  const key = normalizeStr(source.key) || normalizeStr(fallbackKey);
  if (!key) {
    return null;
  }

  return {
    key,
    so_tk: normalizeStr(source.so_tk),
    mst: normalizeStr(source.mst),
    company: normalizeStr(source.company),
    date: normalizeStr(source.date),
    team: normalizeStr(source.team),
    staff: normalizeStr(source.staff),
    missing: normalizeStringArray(source.missing),
    firstDetected: normalizeTimestamp(source.firstDetected),
    lastUpdated: normalizeTimestamp(source.lastUpdated),
    lastAlertAt: normalizeTimestamp(source.lastAlertAt),
    resolved: source.resolved === true,
    resolvedAt: normalizeOptionalTimestamp(source.resolvedAt),
  };
}

function formatDeclarationAlertEntries(
  entries: Record<string, DeclarationAlertStateEntry>,
): DeclarationAlertListItem[] {
  return Object.values(entries)
    .map((entry) => ({
      key: entry.key,
      so_tk: entry.so_tk,
      mst: entry.mst,
      company: entry.company,
      date: entry.date,
      team: entry.team,
      staff: entry.staff,
      missing: Array.isArray(entry.missing) ? entry.missing.slice() : [],
      firstDetected: entry.firstDetected,
      lastUpdated: entry.lastUpdated,
      lastAlertAt: entry.lastAlertAt,
      resolved: entry.resolved === true,
      resolvedAt: entry.resolvedAt || null,
    }))
    .sort((left, right) => Date.parse(right.lastAlertAt) - Date.parse(left.lastAlertAt));
}

function normalizeDeclarationAlertKey(row: DeclarationRecord): string {
  return normalizeStr(row.key) || `${normalizeStr(row.so_tk)}_${normalizeStr(row.nhanh)}`;
}

function normalizeThresholdDays(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.round(parsed));
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const normalized = normalizeStr(entry);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function normalizeTimestamp(value: unknown): string {
  const normalized = normalizeStr(value);
  if (!normalized) {
    return new Date().toISOString();
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function normalizeOptionalTimestamp(value: unknown): string | null {
  const normalized = normalizeStr(value);
  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
