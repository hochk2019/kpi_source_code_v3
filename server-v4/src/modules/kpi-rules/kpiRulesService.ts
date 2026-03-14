import { randomUUID } from 'node:crypto';

import { toIsoDate } from '../../legacy/legacy-normalizers.js';
import { KpiRulesRepository } from './KpiRulesRepository.js';
import {
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
import { cloneKpiRuleCollection, type KpiRulesActor, type KpiRulesStore } from './kpiRulesStore.js';

export type KpiRulesListResponse = KpiRuleCollection & {
  ruleSetCount: number;
};

export type KpiRulesCreateDraftResponse = KpiRulesListResponse & {
  ruleSet: KpiRuleSet;
};

export class KpiRulesHttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'KpiRulesHttpError';
  }
}

export class KpiRulesService {
  private lastWrittenCollection: KpiRuleCollection | null = null;

  constructor(
    private readonly repository: KpiRulesRepository,
    private readonly store: KpiRulesStore,
  ) {}

  async getRuleCollection(): Promise<KpiRulesListResponse> {
    const collection = await this.readCurrentCollection();
    return summarizeCollection(collection);
  }

  async createRuleSetDraft(
    actor: KpiRulesActor,
    payload: Record<string, unknown>,
  ): Promise<KpiRulesCreateDraftResponse> {
    this.requireRulesManage(actor);
    const collection = await this.readCurrentCollection();
    const activeRuleSet = collection.sets.find((entry) => entry.id === collection.activeId) ?? collection.sets[0];
    const nextRuleSet = buildRuleSetDraft(activeRuleSet ?? createDefaultKpiRuleSet(), payload);
    const persisted = await this.store.writeRuleCollection({
      ...cloneKpiRuleCollection(collection),
      sets: [...collection.sets, nextRuleSet],
    });
    this.lastWrittenCollection = cloneKpiRuleCollection(persisted);

    return {
      ...summarizeCollection(persisted),
      ruleSet: nextRuleSet,
    };
  }

  async activateRuleSet(actor: KpiRulesActor, ruleSetId: string): Promise<KpiRulesListResponse> {
    this.requireRulesManage(actor);
    const normalizedId = `${ruleSetId ?? ''}`.trim();
    if (!normalizedId) {
      throw new KpiRulesHttpError(400, 'invalid_request', 'Thiếu bộ quy tắc KPI cần kích hoạt.');
    }

    const collection = await this.readCurrentCollection();
    if (!collection.sets.some((entry) => entry.id === normalizedId)) {
      throw new KpiRulesHttpError(404, 'not_found', 'Không tìm thấy bộ quy tắc KPI.');
    }

    const nextCollection = await this.store.writeRuleCollection({
      ...cloneKpiRuleCollection(collection),
      activeId: normalizedId,
    });
    this.lastWrittenCollection = cloneKpiRuleCollection(nextCollection);

    return summarizeCollection(nextCollection);
  }

  private requireRulesManage(actor: KpiRulesActor): void {
    if (!actor.permissions.rulesEdit && !actor.permissions.accountManage) {
      throw new KpiRulesHttpError(403, 'forbidden', 'Bạn không có quyền quản lý bộ quy tắc KPI.');
    }
  }

  private async readCurrentCollection(): Promise<KpiRuleCollection> {
    if (this.lastWrittenCollection) {
      return cloneKpiRuleCollection(this.lastWrittenCollection);
    }

    return this.repository.getRuleCollection();
  }
}

function summarizeCollection(collection: KpiRuleCollection): KpiRulesListResponse {
  return {
    ...collection,
    ruleSetCount: collection.sets.length,
  };
}

function buildRuleSetDraft(baseRuleSet: KpiRuleSet, payload: Record<string, unknown>): KpiRuleSet {
  const now = new Date().toISOString();
  const nextName = normalizeText(payload.name);
  if (!nextName) {
    throw new KpiRulesHttpError(400, 'invalid_request', 'Tên bộ quy tắc KPI không được để trống.');
  }

  return {
    ...cloneRuleSet(baseRuleSet),
    id: randomUUID(),
    name: nextName,
    description: readOptionalText(payload.description) ?? baseRuleSet.description,
    applyFrom: normalizeApplyFrom(payload.applyFrom) ?? baseRuleSet.applyFrom,
    updatedAt: now,
    groups: mergeGroups(baseRuleSet.groups, payload.groups),
    license: mergeLicense(baseRuleSet.license, payload.license),
    bonuses: mergeBonuses(baseRuleSet.bonuses, payload.bonuses),
  };
}

function mergeGroups(
  baseGroups: Record<string, KpiRuleGroup>,
  patch: unknown,
): Record<string, KpiRuleGroup> {
  const nextGroups: Record<string, KpiRuleGroup> = {};
  for (const [key, value] of Object.entries(baseGroups)) {
    nextGroups[key] = cloneGroup(value);
  }

  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return nextGroups;
  }

  for (const [rawKey, rawPatch] of Object.entries(patch as Record<string, unknown>)) {
    if (!rawPatch || typeof rawPatch !== 'object' || Array.isArray(rawPatch)) {
      continue;
    }

    const patchRecord = rawPatch as Record<string, unknown>;
    const nextKey = normalizeText(patchRecord.key) || rawKey.trim();
    if (!nextKey) {
      continue;
    }

    const baseGroup = nextGroups[nextKey] ?? {
      key: nextKey,
      title: nextKey,
      description: '',
      codes: [],
      base: 0,
      perItem: 0,
      tierMode: 'per_item',
      tiers: [],
    };

    nextGroups[nextKey] = {
      key: nextKey,
      title: readOptionalText(patchRecord.title) ?? baseGroup.title,
      description:
        Object.prototype.hasOwnProperty.call(patchRecord, 'description')
          ? normalizeText(patchRecord.description)
          : baseGroup.description,
      codes: Array.isArray(patchRecord.codes)
        ? normalizeStringArray(patchRecord.codes).map((entry) => entry.toUpperCase())
        : baseGroup.codes.slice(),
      base: normalizeFiniteNumber(patchRecord.base, baseGroup.base),
      perItem: normalizeFiniteNumber(patchRecord.perItem, baseGroup.perItem),
      tierMode: readOptionalText(patchRecord.tierMode) ?? baseGroup.tierMode,
      tiers: Array.isArray(patchRecord.tiers) ? normalizeTiers(patchRecord.tiers) : cloneTiers(baseGroup.tiers),
    };
  }

  return nextGroups;
}

function mergeLicense(baseLicense: KpiRuleLicense, patch: unknown): KpiRuleLicense {
  const nextLicense = cloneLicense(baseLicense);
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return nextLicense;
  }

  const patchRecord = patch as Record<string, unknown>;
  nextLicense.defaultPoints = normalizeFiniteNumber(patchRecord.defaultPoints, nextLicense.defaultPoints);
  if (Array.isArray(patchRecord.codePoints)) {
    nextLicense.codePoints = normalizeCodePoints(patchRecord.codePoints);
  }

  if (patchRecord.exclude && typeof patchRecord.exclude === 'object' && !Array.isArray(patchRecord.exclude)) {
    const excludePatch = patchRecord.exclude as Record<string, unknown>;
    if (Array.isArray(excludePatch.codes)) {
      nextLicense.exclude.codes = normalizeStringArray(excludePatch.codes).map((entry) => entry.toUpperCase());
    }
    if (Array.isArray(excludePatch.agencies)) {
      nextLicense.exclude.agencies = normalizeAgencyExclusions(excludePatch.agencies);
    }
  }

  return nextLicense;
}

function mergeBonuses(baseBonuses: KpiRuleBonuses, patch: unknown): KpiRuleBonuses {
  const nextBonuses = cloneBonuses(baseBonuses);
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return nextBonuses;
  }

  const patchRecord = patch as Record<string, unknown>;
  if (patchRecord.co && typeof patchRecord.co === 'object' && !Array.isArray(patchRecord.co)) {
    const coPatch = patchRecord.co as Record<string, unknown>;
    if (typeof coPatch.enabled === 'boolean') {
      nextBonuses.co.enabled = coPatch.enabled;
    }
    nextBonuses.co.label = readOptionalText(coPatch.label) ?? nextBonuses.co.label;
    nextBonuses.co.points = normalizeFiniteNumber(coPatch.points, nextBonuses.co.points);
    nextBonuses.co.perLine = normalizeFiniteNumber(coPatch.perLine, nextBonuses.co.perLine);
  }

  return nextBonuses;
}

function cloneRuleSet(ruleSet: KpiRuleSet): KpiRuleSet {
  return JSON.parse(JSON.stringify(ruleSet)) as KpiRuleSet;
}

function cloneGroup(group: KpiRuleGroup): KpiRuleGroup {
  return {
    ...group,
    codes: group.codes.slice(),
    tiers: cloneTiers(group.tiers),
  };
}

function cloneTiers(tiers: readonly KpiRuleTier[]): KpiRuleTier[] {
  return tiers.map((entry) => ({ ...entry }));
}

function cloneLicense(license: KpiRuleLicense): KpiRuleLicense {
  return {
    defaultPoints: license.defaultPoints,
    codePoints: license.codePoints.map((entry) => ({ ...entry })),
    exclude: {
      codes: license.exclude.codes.slice(),
      agencies: license.exclude.agencies.map((entry) => ({
        agency: entry.agency,
        codes: entry.codes.slice(),
      })),
    },
  };
}

function cloneBonuses(bonuses: KpiRuleBonuses): KpiRuleBonuses {
  return {
    co: {
      ...bonuses.co,
    },
  };
}

function normalizeTiers(input: readonly unknown[]): KpiRuleTier[] {
  return input
    .map((entry) => normalizeTier(entry))
    .filter((entry): entry is KpiRuleTier => Boolean(entry));
}

function normalizeTier(input: unknown): KpiRuleTier | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }

  const record = input as Record<string, unknown>;
  return {
    minItems: normalizeFiniteNumber(record.minItems, 0),
    points: normalizeFiniteNumber(record.points, 0),
  };
}

function normalizeCodePoints(input: readonly unknown[]): KpiLicenseCodePoint[] {
  return input
    .map((entry) => normalizeCodePoint(entry))
    .filter((entry): entry is KpiLicenseCodePoint => Boolean(entry));
}

function normalizeCodePoint(input: unknown): KpiLicenseCodePoint | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }

  const record = input as Record<string, unknown>;
  const code = normalizeText(record.code).toUpperCase();
  if (!code) {
    return null;
  }

  return {
    code,
    points: normalizeFiniteNumber(record.points, 0),
  };
}

function normalizeAgencyExclusions(input: readonly unknown[]): KpiLicenseAgencyExclusion[] {
  return input
    .map((entry) => normalizeAgencyExclusion(entry))
    .filter((entry): entry is KpiLicenseAgencyExclusion => Boolean(entry));
}

function normalizeAgencyExclusion(input: unknown): KpiLicenseAgencyExclusion | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }

  const record = input as Record<string, unknown>;
  const agency = normalizeText(record.agency);
  if (!agency) {
    return null;
  }

  return {
    agency,
    codes: Array.isArray(record.codes)
      ? normalizeStringArray(record.codes).map((entry) => entry.toUpperCase())
      : [],
  };
}

function normalizeApplyFrom(value: unknown): string | null {
  const normalized = toIsoDate(value);
  return normalized ? `${normalized}T00:00:00.000Z` : null;
}

function normalizeStringArray(value: readonly unknown[]): string[] {
  return value.map((entry) => normalizeText(entry)).filter(Boolean);
}

function normalizeText(value: unknown): string {
  return `${value ?? ''}`.trim();
}

function readOptionalText(value: unknown): string | null {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizeFiniteNumber(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}
