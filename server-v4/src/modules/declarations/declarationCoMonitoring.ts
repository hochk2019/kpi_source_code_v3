import { normalizeStr } from '../../legacy/legacy-normalizers.js';

const DEFAULT_CO_PREFERENTIAL_BLACKLIST = Object.freeze(['B01', 'B03', 'B30', 'B02']);
const MAX_MISMATCHES = 200;

export type CoCodeConfigDocument = {
  version: number;
  whitelist: string[];
  blacklist: string[];
  updatedAt: string | null;
  updatedBy: string | null;
};

export type CoDiscrepancyRange = {
  from: string;
  to: string;
};

export type CoDiscrepancyConfigDocument = {
  enabled: boolean;
  cron: string;
  rangeDays: number;
  threshold: number;
  sampleLimit: number;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type CoDiscrepancyStateDocument = {
  lastRunAt: string | null;
  range: CoDiscrepancyRange | null;
  mismatchCount: number;
  totalChecked: number;
  status: string;
  error: string | null;
  durationMs: number;
  mismatches: unknown[];
  triggered: boolean;
  limited: boolean;
  actor: string | null;
  reason: string | null;
};

export function createDefaultCoCodeConfig(): CoCodeConfigDocument {
  return {
    version: 1,
    whitelist: [],
    blacklist: [...DEFAULT_CO_PREFERENTIAL_BLACKLIST],
    updatedAt: null,
    updatedBy: null,
  };
}

export function normalizeCoCodeConfig(value: unknown): CoCodeConfigDocument {
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const defaults = createDefaultCoCodeConfig();
  const blacklist = normalizeCodeListForConfig(source.blacklist);

  return {
    version: normalizeInteger(source.version, defaults.version, { min: 1 }),
    whitelist: normalizeCodeListForConfig(source.whitelist),
    blacklist: blacklist.length ? blacklist : [...defaults.blacklist],
    updatedAt: normalizeOptionalText(source.updatedAt),
    updatedBy: normalizeOptionalText(source.updatedBy),
  };
}

export function createDefaultCoDiscrepancyConfig(): CoDiscrepancyConfigDocument {
  return {
    enabled: false,
    cron: '30 4 * * *',
    rangeDays: 3,
    threshold: 10,
    sampleLimit: 500,
    updatedAt: null,
    updatedBy: null,
  };
}

export function normalizeCoDiscrepancyConfig(value: unknown): CoDiscrepancyConfigDocument {
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const defaults = createDefaultCoDiscrepancyConfig();

  return {
    enabled: source.enabled === true,
    cron: normalizeStr(source.cron) || defaults.cron,
    rangeDays: normalizeInteger(source.rangeDays, defaults.rangeDays, { min: 1 }),
    threshold: normalizeInteger(source.threshold, defaults.threshold, { min: 1 }),
    sampleLimit: normalizeInteger(source.sampleLimit, defaults.sampleLimit, { min: 0 }),
    updatedAt: normalizeOptionalText(source.updatedAt),
    updatedBy: normalizeOptionalText(source.updatedBy),
  };
}

export function createDefaultCoDiscrepancyState(): CoDiscrepancyStateDocument {
  return {
    lastRunAt: null,
    range: null,
    mismatchCount: 0,
    totalChecked: 0,
    status: 'idle',
    error: null,
    durationMs: 0,
    mismatches: [],
    triggered: false,
    limited: false,
    actor: null,
    reason: null,
  };
}

export function normalizeCoDiscrepancyState(value: unknown): CoDiscrepancyStateDocument {
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const defaults = createDefaultCoDiscrepancyState();

  return {
    lastRunAt: normalizeOptionalText(source.lastRunAt),
    range: normalizeCoDiscrepancyRange(source.range),
    mismatchCount: normalizeInteger(source.mismatchCount, defaults.mismatchCount, { min: 0 }),
    totalChecked: normalizeInteger(source.totalChecked, defaults.totalChecked, { min: 0 }),
    status: normalizeStr(source.status) || defaults.status,
    error: normalizeOptionalText(source.error),
    durationMs: normalizeInteger(source.durationMs, defaults.durationMs, { min: 0 }),
    mismatches: Array.isArray(source.mismatches) ? source.mismatches.slice(0, MAX_MISMATCHES) : [],
    triggered: source.triggered === true,
    limited: source.limited === true,
    actor: normalizeOptionalText(source.actor),
    reason: normalizeOptionalText(source.reason),
  };
}

function normalizeCodeListForConfig(list: unknown): string[] {
  if (!Array.isArray(list)) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const item of list) {
    const next = normalizeStr(item).toUpperCase();
    if (!next || seen.has(next)) {
      continue;
    }

    seen.add(next);
    normalized.push(next);
  }

  return normalized;
}

function normalizeInteger(
  value: unknown,
  fallback: number,
  options: { min?: number } = {},
): number {
  const parsed = Number.isFinite(Number(value)) ? Math.floor(Number(value)) : null;
  if (parsed === null) {
    return fallback;
  }

  const min = Number.isFinite(options.min) ? Number(options.min) : Number.NEGATIVE_INFINITY;
  return parsed < min ? min : parsed;
}

function normalizeCoDiscrepancyRange(value: unknown): CoDiscrepancyRange | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const source = value as Record<string, unknown>;
  return {
    from: `${source.from ?? ''}`.trim(),
    to: `${source.to ?? ''}`.trim(),
  };
}

function normalizeOptionalText(value: unknown): string | null {
  const normalized = normalizeStr(value);
  return normalized || null;
}
