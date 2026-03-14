import { normalizeStr, toIsoDate } from '../../legacy/legacy-normalizers.js';
import {
  createDefaultKpiRuleCollection,
  createDefaultKpiRuleSet,
  type KpiLicenseAgencyExclusion,
  type KpiLicenseCodePoint,
  type KpiRuleBonuses,
  type KpiRuleCollection,
  type KpiRuleGroup,
  type KpiRuleLicense,
  type KpiRuleSet,
  type KpiRuleTier,
} from './kpiRuleDefaults.js';
import type { KpiRulesAsyncReader } from './kpiRulesAsyncReader.js';

export class KpiRulesRepository {
  constructor(private readonly reader: KpiRulesAsyncReader) {}

  async getRuleCollection(): Promise<KpiRuleCollection> {
    const fallback = createDefaultKpiRuleCollection();
    const raw = (await this.reader.readRuleCollection()) || fallback;
    return normalizeRuleCollection(raw);
  }
}

function normalizeRuleCollection(input: unknown): KpiRuleCollection {
  if (!input || typeof input !== 'object') {
    return createDefaultKpiRuleCollection();
  }

  const raw = input as Record<string, unknown>;

  if (Array.isArray(raw.sets)) {
    const sets = raw.sets
      .map((entry, index) => normalizeRuleSet(entry, index))
      .filter((entry): entry is KpiRuleSet => Boolean(entry));

    return finalizeRuleCollection(sets, raw.activeId ?? raw.active);
  }

  if (looksLikeRuleSet(raw)) {
    const singleRule = normalizeRuleSet(raw, 0);
    return finalizeRuleCollection(singleRule ? [singleRule] : [], raw.id);
  }

  return createDefaultKpiRuleCollection();
}

function finalizeRuleCollection(sets: KpiRuleSet[], requestedActiveId: unknown): KpiRuleCollection {
  if (!sets.length) {
    return createDefaultKpiRuleCollection();
  }

  const dedupedSets = dedupeRuleSetIds(sets);
  const requestedId = normalizeStr(requestedActiveId);
  const activeId = dedupedSets.some((entry) => entry.id === requestedId) ? requestedId : dedupedSets[0].id;

  return {
    version: 2,
    activeId,
    sets: dedupedSets,
  };
}

function dedupeRuleSetIds(sets: KpiRuleSet[]): KpiRuleSet[] {
  const usedIds = new Set<string>();

  return sets.map((entry, index) => {
    let nextId = entry.id || `rule-${index + 1}`;
    let suffix = 1;

    while (usedIds.has(nextId)) {
      nextId = `${entry.id}-${suffix}`;
      suffix += 1;
    }

    usedIds.add(nextId);
    if (nextId === entry.id) {
      return entry;
    }

    return {
      ...entry,
      id: nextId,
    };
  });
}

function normalizeRuleSet(input: unknown, index: number): KpiRuleSet | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const fallback = createDefaultKpiRuleSet();
  const raw = input as Record<string, unknown>;
  const id = normalizeStr(raw.id ?? raw.key) || `rule-${index + 1}`;
  const name = normalizeStr(raw.name) || `Rule ${index + 1}`;
  const description = normalizeStr(raw.description) || fallback.description;
  const applyFrom = toIsoDate(raw.applyFrom ?? raw.apply_from);
  const updatedAt = normalizeTimestamp(raw.updatedAt ?? raw.updated_at) || fallback.updatedAt;

  return {
    id,
    name,
    description,
    applyFrom,
    updatedAt,
    groups: normalizeGroups(raw.groups, fallback.groups),
    license: normalizeLicense(raw.license, fallback.license),
    bonuses: normalizeBonuses(raw.bonuses, fallback.bonuses),
  };
}

function looksLikeRuleSet(input: Record<string, unknown>): boolean {
  return 'groups' in input || 'license' in input || 'bonuses' in input;
}

function normalizeGroups(
  input: unknown,
  fallback: Record<string, KpiRuleGroup>
): Record<string, KpiRuleGroup> {
  if (!input || typeof input !== 'object') {
    return structuredClone(fallback);
  }

  const entries = Object.entries(input as Record<string, unknown>)
    .map(([key, value]) => normalizeGroup(key, value))
    .filter((entry): entry is [string, KpiRuleGroup] => Boolean(entry));

  if (!entries.length) {
    return structuredClone(fallback);
  }

  return Object.fromEntries(entries);
}

function normalizeGroup(key: string, input: unknown): [string, KpiRuleGroup] | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const raw = input as Record<string, unknown>;
  const normalizedKey = normalizeStr(raw.key) || key;

  return [
    normalizedKey,
    {
      key: normalizedKey,
      title: normalizeStr(raw.title) || normalizedKey,
      description: normalizeStr(raw.description),
      codes: normalizeStringArray(raw.codes).map((entry) => entry.toUpperCase()),
      base: normalizeNumber(raw.base),
      perItem: normalizeNumber(raw.perItem ?? raw.per_item),
      tierMode: normalizeStr(raw.tierMode ?? raw.tier_mode) || 'per_item',
      tiers: normalizeTiers(raw.tiers),
    },
  ];
}

function normalizeTiers(input: unknown): KpiRuleTier[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((entry) => normalizeTier(entry))
    .filter((entry): entry is KpiRuleTier => Boolean(entry));
}

function normalizeTier(input: unknown): KpiRuleTier | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const raw = input as Record<string, unknown>;
  return {
    minItems: normalizeNumber(raw.minItems ?? raw.min_items),
    points: normalizeNumber(raw.points),
  };
}

function normalizeLicense(input: unknown, fallback: KpiRuleLicense): KpiRuleLicense {
  if (!input || typeof input !== 'object') {
    return structuredClone(fallback);
  }

  const raw = input as Record<string, unknown>;

  return {
    defaultPoints: normalizeNumber(raw.defaultPoints ?? raw.default_points, fallback.defaultPoints),
    codePoints: normalizeCodePoints(raw.codePoints ?? raw.code_points),
    exclude: {
      codes: normalizeStringArray((raw.exclude as Record<string, unknown> | undefined)?.codes),
      agencies: normalizeLicenseAgencies((raw.exclude as Record<string, unknown> | undefined)?.agencies),
    },
  };
}

function normalizeCodePoints(input: unknown): KpiLicenseCodePoint[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((entry) => normalizeCodePoint(entry))
    .filter((entry): entry is KpiLicenseCodePoint => Boolean(entry));
}

function normalizeCodePoint(input: unknown): KpiLicenseCodePoint | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const raw = input as Record<string, unknown>;
  const code = normalizeStr(raw.code).toUpperCase();
  if (!code) {
    return null;
  }

  return {
    code,
    points: normalizeNumber(raw.points),
  };
}

function normalizeLicenseAgencies(input: unknown): KpiLicenseAgencyExclusion[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((entry) => normalizeLicenseAgency(entry))
    .filter((entry): entry is KpiLicenseAgencyExclusion => Boolean(entry));
}

function normalizeLicenseAgency(input: unknown): KpiLicenseAgencyExclusion | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const raw = input as Record<string, unknown>;
  const agency = normalizeStr(raw.agency);
  if (!agency) {
    return null;
  }

  return {
    agency,
    codes: normalizeStringArray(raw.codes).map((entry) => entry.toUpperCase()),
  };
}

function normalizeBonuses(input: unknown, fallback: KpiRuleBonuses): KpiRuleBonuses {
  if (!input || typeof input !== 'object') {
    return structuredClone(fallback);
  }

  const raw = input as Record<string, unknown>;
  const coInput = raw.co && typeof raw.co === 'object' ? (raw.co as Record<string, unknown>) : {};

  return {
    co: {
      enabled: normalizeBoolean(coInput.enabled, fallback.co.enabled),
      label: normalizeStr(coInput.label) || fallback.co.label,
      points: normalizeNumber(coInput.points, fallback.co.points),
      perLine: normalizeNumber(coInput.perLine ?? coInput.per_line, fallback.co.perLine),
    },
  };
}

function normalizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((entry) => normalizeStr(entry))
    .filter(Boolean);
}

function normalizeNumber(input: unknown, fallback = 0): number {
  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeBoolean(input: unknown, fallback = false): boolean {
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

function normalizeTimestamp(input: unknown): string {
  const raw = normalizeStr(input);
  if (!raw) {
    return '';
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toISOString();
}
