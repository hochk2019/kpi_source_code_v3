// src/lib/rules.js
// --------------------------------------------------
// QUẢN LÝ BỘ QUY TẮC KPI (HỖ TRỢ NHIỀU PHIÊN BẢN)
// - Lưu nhiều bộ quy tắc (Rule v2, Rule v3, ...), chọn bộ mặc định
// - Quy tắc v2 dùng cơ chế điểm tuyến tính theo mục hàng
// - Giấy phép: cấu hình điểm theo mã, loại trừ theo mã & theo đại lý HQ
// --------------------------------------------------

import {
  getData,
  setData,
  getRules as readPersistedRules,
  setRules as persistRules,
  pushAuditLog,
} from './store.js';
import { getItem as getStorageItem, setItem as setStorageItem } from './storageClient.js';
import { fetchWithAuth } from '@/auth/localAuth.js';
import {
  DEFAULT_RULES,
  createDefaultRuleCollection,
  createDefaultRuleSetV2,
} from '@/shared/defaultRules.js';
import { coLineCount } from '@/shared/co.js';
export { DEFAULT_RULES } from '@/shared/defaultRules.js';

const KEY_HISTORY = 'kpi_rules_history';
const LEGACY_KEY_ACTIVE = 'kpi_rules';

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function norm(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase();
}

function normText(value) {
  return String(value ?? '').trim();
}

function uniqueNormalized(list) {
  const seen = new Set();
  const result = [];
  for (const item of Array.isArray(list) ? list : []) {
    const value = norm(item);
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function generateRuleId(prefix = 'rule') {
  const token = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${token}`;
}

function createRuleSkeleton() {
  const base = createDefaultRuleSetV2();
  base.id = generateRuleId(base.id || 'rule');
  base.name = base.name || 'Bộ quy tắc KPI';
  base.description = base.description || '';
  base.applyFrom = base.applyFrom || '';
  base.version = Number.isFinite(Number(base.version)) ? Number(base.version) : 0;
  return base;
}

function normalizeGroup(rawGroup, fallbackGroup) {
  const base = clone(fallbackGroup || {});
  const input = rawGroup || {};
  const next = {
    key: base.key || input.key || '',
    title: normText(input.title) || normText(base.title) || 'Nhóm',
    description: normText(input.description) || normText(base.description) || '',
    codes: Array.isArray(input.codes)
      ? input.codes
      : typeof input.codes === 'string'
      ? input.codes.split(',')
      : Array.isArray(base.codes)
      ? base.codes
      : [],
    base: Number.isFinite(Number(input.base)) ? Number(input.base) : Number(base.base) || 0,
    perItem: Number.isFinite(Number(input.perItem)) ? Number(input.perItem) : Number(base.perItem) || 0,
    tierMode: normText(input.tierMode) || normText(base.tierMode) || (Number(base.perItem) ? 'per_item' : 'highest'),
    tiers: Array.isArray(input.tiers) ? input.tiers : Array.isArray(base.tiers) ? base.tiers : [],
  };

  next.codes = uniqueNormalized(next.codes);
  next.tiers = next.tiers
    .map((tier) => ({
      from: Number.isFinite(Number(tier?.from)) ? Number(tier.from) : 0,
      to: Number.isFinite(Number(tier?.to)) ? Number(tier.to) : Number.POSITIVE_INFINITY,
      add: Number.isFinite(Number(tier?.add)) ? Number(tier.add) : 0,
    }))
    .filter((tier) => tier.from >= 0 && tier.add !== 0);

  if (!['per_item', 'highest', 'cumulative'].includes(next.tierMode)) {
    next.tierMode = next.perItem ? 'per_item' : 'highest';
  }

  return next;
}

function normalizeLicense(rawLicense, fallbackLicense) {
  const base = clone(fallbackLicense || {});
  const input = rawLicense || {};
  const defaultPoints = Number.isFinite(Number(input.defaultPoints))
    ? Number(input.defaultPoints)
    : Number(base.defaultPoints) || 0;

  const pointEntries = Array.isArray(input.codePoints)
    ? input.codePoints
    : Array.isArray(base.codePoints)
    ? base.codePoints
    : [];

  const pointMap = new Map();
  for (const entry of pointEntries) {
    const code = norm(entry?.code);
    if (!code) continue;
    const points = Number.isFinite(Number(entry?.points)) ? Number(entry.points) : defaultPoints;
    pointMap.set(code, points);
  }

  const excludeCodes = Array.isArray(input?.exclude?.codes)
    ? input.exclude.codes
    : Array.isArray(base?.exclude?.codes)
    ? base.exclude.codes
    : [];

  const excludeAgencies = Array.isArray(input?.exclude?.agencies)
    ? input.exclude.agencies
    : Array.isArray(base?.exclude?.agencies)
    ? base.exclude.agencies
    : [];

  const normalizedAgencies = [];
  for (const entry of excludeAgencies) {
    const agencyKey = norm(entry?.agency);
    if (!agencyKey) continue;
    const codes = uniqueNormalized(entry?.codes || []);
    if (!codes.length) continue;
    normalizedAgencies.push({ agency: agencyKey, codes });
  }

  return {
    defaultPoints,
    codePoints: Array.from(pointMap.entries()).map(([code, points]) => ({ code, points })),
    exclude: {
      codes: uniqueNormalized(excludeCodes),
      agencies: normalizedAgencies,
    },
  };
}

function normalizeBonuses(rawBonuses, fallbackBonuses) {
  const base = clone(fallbackBonuses || {});
  const input = rawBonuses || {};
  const rawCo = input.co || base.co || {};
  const perLineRaw =
    rawCo.perLine ??
    rawCo.perLinePoints ??
    rawCo.perLineBonus ??
    base.co?.perLine ??
    base.co?.perLinePoints ??
    base.co?.perLineBonus ??
    0;
  return {
    co: {
      enabled: Boolean(rawCo.enabled),
      label: normText(rawCo.label) || normText(base.co?.label) || 'Cộng điểm khi tờ khai có C/O',
      points: Number.isFinite(Number(rawCo.points)) ? Number(rawCo.points) : Number(base.co?.points) || 0,
      perLine: Number.isFinite(Number(perLineRaw)) ? Number(perLineRaw) : 0,
    },
  };
}

function normalizeRule(rawRule) {
  const skeleton = createRuleSkeleton();
  const input = rawRule || {};
  const idCandidate = normText(input.id || input.key);
  const normalizedId = idCandidate || generateRuleId('rule');

  const next = {
    ...skeleton,
    ...clone(input),
    id: normalizedId,
    name: normText(input.name) || normText(skeleton.name) || 'Bộ quy tắc KPI',
    description: normText(input.description) || normText(skeleton.description) || '',
    applyFrom: normText(input.applyFrom || input.appliedFrom || ''),
    updatedAt: input.updatedAt || skeleton.updatedAt || new Date().toISOString(),
  };

  const baseVersion = Number.isFinite(Number(input.version))
    ? Number(input.version)
    : Number.isFinite(Number(skeleton.version))
    ? Number(skeleton.version)
    : 0;
  next.version = Math.max(0, baseVersion);

  const baseGroups = skeleton.groups || {};
  const rawGroups = input.groups || {};
  next.groups = {
    group1: normalizeGroup(rawGroups.group1, baseGroups.group1),
    group2: normalizeGroup(rawGroups.group2, baseGroups.group2),
    group3: normalizeGroup(rawGroups.group3 || rawGroups.group34, baseGroups.group3),
  };

  next.license = normalizeLicense(input.license, skeleton.license);
  next.bonuses = normalizeBonuses(input.bonuses, skeleton.bonuses);

  return next;
}

function normalizeCollection(rawCollection) {
  const base = createDefaultRuleCollection();
  const input = rawCollection || {};
  const sets = Array.isArray(input.sets) ? input.sets : [];
  const normalizedSets = [];
  const seen = new Set();

  for (const entry of sets) {
    const normalized = normalizeRule(entry);
    let id = normalized.id;
    while (seen.has(id)) {
      id = generateRuleId(id.split('-')[0] || 'rule');
      normalized.id = id;
    }
    seen.add(id);
    normalizedSets.push(normalized);
  }

  if (!normalizedSets.length) {
    normalizedSets.push(normalizeRule(createDefaultRuleSetV2()));
  }

  const activeIdCandidate = normText(input.activeId || input.active || base.activeId);
  const hasActive = normalizedSets.some((rule) => rule.id === activeIdCandidate);
  const activeId = hasActive ? activeIdCandidate : normalizedSets[0].id;

  return {
    version: 2,
    activeId,
    sets: normalizedSets,
  };
}

function persistCollection(collection) {
  const normalized = normalizeCollection(collection);
  persistRules(normalized);
  const activeRule = normalized.sets.find((rule) => rule.id === normalized.activeId) || normalized.sets[0] || null;
  if (activeRule) {
    setStorageItem(LEGACY_KEY_ACTIVE, JSON.stringify(activeRule));
  }
  return normalized;
}

function migrateLegacyRule(singleRule) {
  if (!singleRule || typeof singleRule !== 'object') {
    return null;
  }
  const legacy = normalizeRule({
    ...singleRule,
    id: normText(singleRule.id || singleRule.key || 'legacy-rule'),
    name: normText(singleRule.name || 'Legacy Rule'),
  });
  return legacy;
}

function loadRuleCollection() {
  const stored = readPersistedRules();
  if (stored && typeof stored === 'object') {
    if (Array.isArray(stored.sets)) {
      return persistCollection(stored);
    }
    if (stored.groups && stored.license) {
      const legacyRule = migrateLegacyRule(stored);
      const defaults = createDefaultRuleSetV2();
      const collection = normalizeCollection({
        activeId: defaults.id,
        sets: legacyRule ? [legacyRule, defaults] : [defaults],
      });
      return persistCollection(collection);
    }
  }

  try {
    const legacyRaw = getStorageItem(LEGACY_KEY_ACTIVE);
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw);
      if (parsed && typeof parsed === 'object') {
        const legacyRule = migrateLegacyRule(parsed);
        const defaults = createDefaultRuleSetV2();
        const collection = normalizeCollection({
          activeId: defaults.id,
          sets: legacyRule ? [legacyRule, defaults] : [defaults],
        });
        return persistCollection(collection);
      }
    }
  } catch (err) {
    console.warn('loadRuleCollection: legacy parse failed', err);
  }

  const defaults = createDefaultRuleCollection();
  return persistCollection(defaults);
}

export function loadRuleSets() {
  return clone(loadRuleCollection());
}

export function loadRules(ruleId = null) {
  const collection = loadRuleCollection();
  const targetId = ruleId ? normText(ruleId) : collection.activeId;
  const rule = collection.sets.find((entry) => entry.id === targetId) || collection.sets[0];
  return clone(rule);
}

export function getRulesHistory() {
  try {
    const raw = JSON.parse(getStorageItem(KEY_HISTORY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .map((entry) => {
        if (!entry) return null;
        if (entry.snapshot) return entry;
        if (entry.groups && entry.license) {
          const normalized = normalizeRule(entry);
          return {
            id: normalized.id,
            name: normalized.name,
            updatedAt: normalized.updatedAt,
            applyFrom: normalized.applyFrom,
            snapshot: normalized,
          };
        }
        return null;
      })
      .filter(Boolean);
  } catch (err) {
    console.warn('getRulesHistory: invalid data, reset history', err);
    return [];
  }
}

export async function fetchRulesHistoryFromServer({ signal } = {}) {
  try {
    const response = await fetchWithAuth('/api/rules/history', { signal });
    const data = await response.json();
    if (!response.ok || data?.ok === false) {
      throw new Error(data?.error || `HTTP ${response.status}`);
    }
    const rawHistory = Array.isArray(data?.history) ? data.history : [];
    const normalized = rawHistory
      .map((entry) => {
        if (!entry) return null;
        const snapshot = entry.rules ? normalizeRule(entry.rules) : null;
        if (!snapshot) {
          return null;
        }
        const updatedAt = entry.savedAt || snapshot.updatedAt || new Date().toISOString();
        return {
          id: snapshot.id,
          name: snapshot.name,
          updatedAt,
          applyFrom: snapshot.applyFrom || '',
          snapshot,
        };
      })
      .filter(Boolean);
    if (normalized.length > 0) {
      try {
        setStorageItem(KEY_HISTORY, JSON.stringify(normalized));
      } catch (err) {
        console.warn('Không thể lưu lịch sử quy tắc vào localStorage', err);
      }
      return normalized;
    }
    return getRulesHistory();
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    throw new Error(error?.message || 'Không thể tải lịch sử quy tắc KPI.');
  }
}

function appendHistory(rule) {
  const history = getRulesHistory();
  history.unshift({
    id: rule.id,
    name: rule.name,
    updatedAt: rule.updatedAt,
    applyFrom: rule.applyFrom,
    version: Number.isFinite(Number(rule.version)) ? Number(rule.version) : undefined,
    snapshot: clone(rule),
  });
  while (history.length > 20) history.pop();
  setStorageItem(KEY_HISTORY, JSON.stringify(history));
}

function resolveRuleId(ruleInput, fallbackId) {
  const candidate = normText(ruleInput?.id || ruleInput?.key);
  return candidate || fallbackId || generateRuleId('rule');
}

export function saveRules(ruleInput, opts = {}) {
  const collection = loadRuleCollection();
  const actor = opts.actor || 'system';
  const ruleId = resolveRuleId(ruleInput, opts.ruleId || collection.activeId);
  const normalizedRule = normalizeRule({ ...clone(ruleInput), id: ruleId });
  if (opts.applyFrom !== undefined) {
    normalizedRule.applyFrom = normText(opts.applyFrom);
  }
  normalizedRule.updatedAt = new Date().toISOString();

  const idx = collection.sets.findIndex((entry) => entry.id === normalizedRule.id);
  const previous = idx >= 0 ? collection.sets[idx] : null;
  const previousVersion = Number.isFinite(Number(previous?.version)) ? Number(previous.version) : 0;
  const incomingVersion = Number.isFinite(Number(normalizedRule.version)) ? Number(normalizedRule.version) : previousVersion;
  normalizedRule.version = Math.max(previousVersion, incomingVersion) + 1;

  if (idx >= 0) {
    collection.sets[idx] = normalizedRule;
  } else {
    collection.sets.push(normalizedRule);
  }

  if (opts.setAsDefault) {
    collection.activeId = normalizedRule.id;
  } else if (!collection.activeId) {
    collection.activeId = normalizedRule.id;
  }

  const persisted = persistCollection(collection);
  if (opts.appendHistory !== false) {
    appendHistory(normalizedRule);
  }

  const recalcFrom = opts.recalcFrom && persisted.activeId === normalizedRule.id
    ? normText(opts.recalcFrom)
    : '';
  if (recalcFrom) {
    recalcKPIFrom(recalcFrom, normalizedRule);
  }

  pushAuditLog({
    actor,
    action: 'rules.save',
    detail: opts.detail || `Lưu bộ quy tắc ${normalizedRule.name}`,
    meta: {
      ruleId: normalizedRule.id,
      recalcFrom: recalcFrom || '',
      version: normalizedRule.version,
    },
  });

  return clone(normalizedRule);
}

export function restoreRuleVersion(snapshotInput, opts = {}) {
  if (!snapshotInput || typeof snapshotInput !== 'object') {
    throw new Error('Thiếu dữ liệu snapshot cần khôi phục');
  }
  const actor = opts.actor || 'system';
  const normalizedSnapshot = normalizeRule(snapshotInput);
  const restored = saveRules(
    { ...normalizedSnapshot, updatedAt: new Date().toISOString() },
    {
      actor,
      ruleId: normalizedSnapshot.id,
      setAsDefault: opts.setAsDefault,
      appendHistory: opts.appendHistory !== undefined ? opts.appendHistory : true,
      detail: opts.detail || `Khôi phục phiên bản ${normalizedSnapshot.version || ''} của ${normalizedSnapshot.name}`,
    }
  );
  pushAuditLog({
    actor,
    action: 'rules.rollback',
    detail: `Khôi phục bộ quy tắc ${restored.name} về phiên bản ${restored.version}`,
    meta: {
      ruleId: restored.id,
      restoredFromVersion: normalizedSnapshot.version || 0,
      version: restored.version,
    },
  });
  return restored;
}

export function setDefaultRule(ruleId, { actor = 'system' } = {}) {
  const collection = loadRuleCollection();
  const normalizedId = normText(ruleId);
  if (!normalizedId) return clone(collection);
  if (collection.activeId === normalizedId) {
    return clone(collection);
  }
  const exists = collection.sets.some((rule) => rule.id === normalizedId);
  if (!exists) return clone(collection);

  collection.activeId = normalizedId;
  const persisted = persistCollection(collection);
  const activeRule = persisted.sets.find((rule) => rule.id === persisted.activeId) || null;

  pushAuditLog({
    actor,
    action: 'rules.set_default',
    detail: activeRule ? `Đặt "${activeRule.name}" làm mặc định` : 'Đặt bộ quy tắc mặc định',
    meta: { ruleId: normalizedId },
  });

  return clone(persisted);
}

export function createRuleTemplate(baseRule = null, overrides = {}) {
  const source = baseRule ? normalizeRule(baseRule) : createRuleSkeleton();
  const nameOverride = normText(overrides.name);
  const next = clone(source);
  next.id = generateRuleId('rule');
  next.name = nameOverride || `${source.name || 'Bộ quy tắc'} (bản sao)`;
  next.applyFrom = '';
  next.updatedAt = new Date().toISOString();
  return next;
}

export function exportRuleCollection() {
  return clone(loadRuleCollection());
}

export function restoreRuleCollection(collectionInput, { actor = 'system' } = {}) {
  const persisted = persistCollection(collectionInput);
  const activeRule = persisted.sets.find((entry) => entry.id === persisted.activeId);
  pushAuditLog({
    actor,
    action: 'rules.restore_collection',
    detail: `Khôi phục ${persisted.sets.length} bộ quy tắc`,
    meta: {
      activeId: persisted.activeId,
      activeName: activeRule?.name || '',
    },
  });
  return clone(persisted);
}

// ====== QUẢN LÝ GIẤY PHÉP ======
const DIRECT_LICENSE_COUNT_FIELDS = [
  'Số lượng GP',
  'So luong GP',
  'Số lượng giấy phép',
  'So luong giay phep',
];

const LICENSE_CODE_FIELDS = [
  ['Mã giấy phép', 'Số giấy phép'],
  ['Mã giấy phép 1', 'Số giấy phép 1'],
  ['Mã giấy phép 2', 'Số giấy phép 2'],
  ['Mã giấy phép 3', 'Số giấy phép 3'],
  ['Mã giấy phép 4', 'Số giấy phép 4'],
  ['Mã giấy phép 5', 'Số giấy phép 5'],
];

function parseLicenseInfoFromRow(row) {
  const info = {
    codes: [],
    directCount: null,
  };
  if (!row || typeof row !== 'object') return info;

  for (const field of DIRECT_LICENSE_COUNT_FIELDS) {
    const raw = row?.[field];
    if (raw === undefined || raw === null || raw === '') continue;
    const normalized = normText(raw);
    if (/^\d+(?:\.\d+)?$/.test(normalized)) {
      const numeric = Number(normalized);
      if (Number.isFinite(numeric)) {
        info.directCount = Math.max(0, Math.round(numeric));
        return info;
      }
    }
  }

  const codes = new Set();
  for (const [codeKey, numberKey] of LICENSE_CODE_FIELDS) {
    const code = norm(row?.[codeKey]);
    const number = normText(row?.[numberKey]);
    if (!code || !number) continue;
    codes.add(code);
  }

  info.codes = Array.from(codes);
  return info;
}

export function extractLicenseCodesFromRowObj(row) {
  const info = parseLicenseInfoFromRow(row);
  return info.codes;
}

export function countLicenseTypesFromRowObj(row, excludeList = []) {
  const info = parseLicenseInfoFromRow(row);
  if (Number.isFinite(info.directCount)) {
    return info.directCount;
  }
  if (!info.codes.length) return 0;
  const exclude = new Set(uniqueNormalized(excludeList));
  return info.codes.filter((code) => !exclude.has(code)).length;
}

function resolveLicenseSource(row) {
  if (row) {
    let manualCandidate;
    if (Object.prototype.hasOwnProperty.call(row, 'licenseManualCount')) {
      manualCandidate = row.licenseManualCount;
    } else if (Object.prototype.hasOwnProperty.call(row, 'manual_license_count')) {
      manualCandidate = row.manual_license_count;
    }
    const manual = Number(manualCandidate);
    if (Number.isFinite(manual) && manual >= 0) {
      return {
        codes: [],
        directCount: Math.max(0, Math.round(manual)),
      };
    }
  }

  if (Array.isArray(row?.licenseCodes) && row.licenseCodes.length) {
    return {
      codes: uniqueNormalized(row.licenseCodes),
      directCount: null,
    };
  }

  if (row && typeof row === 'object' && row.__raw) {
    const info = parseLicenseInfoFromRow(row.__raw);
    if (info.codes.length || Number.isFinite(info.directCount)) {
      return info;
    }
  }

  const fallback = Number(row?.licenses ?? row?.so_luong_gp ?? row?.soLuongGiayPhep ?? 0) || 0;
  if (fallback > 0) {
    return { codes: [], directCount: fallback };
  }
  return { codes: [], directCount: null };
}

function buildLicenseConfigMaps(licenseConfig) {
  const excludeCodes = new Set(uniqueNormalized(licenseConfig?.exclude?.codes || []));
  const codePointMap = new Map();
  for (const entry of Array.isArray(licenseConfig?.codePoints) ? licenseConfig.codePoints : []) {
    const code = norm(entry?.code);
    if (!code) continue;
    const points = Number.isFinite(Number(entry?.points)) ? Number(entry.points) : Number(licenseConfig?.defaultPoints) || 0;
    codePointMap.set(code, points);
  }

  const agencyMap = new Map();
  for (const entry of Array.isArray(licenseConfig?.exclude?.agencies) ? licenseConfig.exclude.agencies : []) {
    const agencyKey = norm(entry?.agency);
    if (!agencyKey) continue;
    const codes = uniqueNormalized(entry?.codes || []);
    if (!codes.length) continue;
    agencyMap.set(agencyKey, new Set(codes));
  }

  return { excludeCodes, codePointMap, agencyMap };
}

// ====== TÍNH KPI ======
function computeGroupItemPoints(numItems, group) {
  const items = Number.isFinite(Number(numItems)) ? Number(numItems) : 0;
  if (items <= 0) return 0;

  if (Number.isFinite(Number(group?.perItem)) && Number(group.perItem) !== 0) {
    return items * Number(group.perItem);
  }

  const tiers = Array.isArray(group?.tiers) ? group.tiers : [];
  if (!tiers.length) return 0;
  const mode = group?.tierMode === 'cumulative' ? 'cumulative' : 'highest';
  return addByTiers(items, tiers, mode === 'cumulative');
}

function detectGroup(code, rules) {
  const groups = rules?.groups || {};
  const normalized = norm(code);
  for (const key of Object.keys(groups)) {
    const group = groups[key];
    if (!group) continue;
    if (group.codes.some((c) => norm(c) === normalized)) {
      return { key, group };
    }
  }
  return { key: '', group: null };
}

function hasCOFlag(row) {
  if (coLineCount(row) > 0) return true;
  if (row?.has_co) return true;
  const coText = String(row?.co || '').trim().toLowerCase();
  if (!coText) return false;
  return ['co', 'có', 'yes', 'x'].includes(coText);
}

export function computeKPI(row, rulesInput) {
  const rules = rulesInput || loadRules();
  const code = norm(row?.loaiHinh || row?.loai_hinh);
  const items = Number(row?.num_items ?? row?.muc_hang ?? 0) || 0;
  const { group } = detectGroup(code, rules);

  let point = 0;
  if (group) {
    point += Number(group.base || 0);
    point += computeGroupItemPoints(items, group);
  }

  const licenseConfig = rules?.license || {};
  const { excludeCodes, codePointMap, agencyMap } = buildLicenseConfigMaps(licenseConfig);
  const source = resolveLicenseSource(row);
  const agencyKey = norm(row?.agency || row?.dai_ly || row?.hqAgency || row?.agent);
  const agencyExcluded = agencyMap.get(agencyKey) || new Set();

  let licensePoints = 0;
  if (source.codes.length) {
    for (const codeValue of source.codes) {
      if (excludeCodes.has(codeValue)) continue;
      if (agencyExcluded.has(codeValue)) continue;
      const points = codePointMap.get(codeValue) ?? Number(licenseConfig.defaultPoints || 0);
      licensePoints += Number(points || 0);
    }
  } else if (Number.isFinite(source.directCount) && source.directCount > 0) {
    licensePoints += source.directCount * Number(licenseConfig.defaultPoints || 0);
  }

  point += licensePoints;

  const coBonus = rules?.bonuses?.co;
  if (coBonus?.enabled) {
    if (hasCOFlag(row)) {
      point += Number(coBonus.points || 0);
    }
    const perLine = Number(coBonus?.perLine || 0);
    if (perLine) {
      const lines = coLineCount(row);
      if (lines > 0) {
        point += lines * perLine;
      }
    }
  }

  return Math.max(0, Math.round((point + Number.EPSILON) * 10) / 10);
}

export function deleteRule(ruleId, { actor = 'system' } = {}) {
  const collection = loadRuleCollection();
  const normalizedId = normText(ruleId);
  if (!normalizedId) {
    throw new Error('Thiếu mã bộ quy tắc cần xóa');
  }
  if (collection.sets.length <= 1) {
    throw new Error('Không thể xóa bộ quy tắc cuối cùng');
  }
  const idx = collection.sets.findIndex((entry) => entry.id === normalizedId);
  if (idx < 0) {
    return clone(collection);
  }
  const [removed] = collection.sets.splice(idx, 1);
  if (!collection.sets.length) {
    throw new Error('Không thể xóa toàn bộ bộ quy tắc');
  }
  if (collection.activeId === normalizedId) {
    collection.activeId = collection.sets[0]?.id || collection.activeId;
  }
  const persisted = persistCollection(collection);
  pushAuditLog({
    actor,
    action: 'rules.delete',
    detail: removed ? `Xóa bộ quy tắc ${removed.name}` : 'Xóa bộ quy tắc',
    meta: { ruleId: normalizedId },
  });
  return clone(persisted);
}

function addByTiers(numItems, tiers = [], isCumulative = false) {
  if (!numItems || !tiers?.length) return 0;
  const sorted = [...tiers].sort((a, b) => (a.from || 0) - (b.from || 0));
  let sum = 0;
  for (const tier of sorted) {
    const { from = 0, to = Number.POSITIVE_INFINITY, add = 0 } = tier;
    if (numItems < from) continue;
    if (isCumulative) {
      sum += Number(add || 0);
    } else if (numItems >= from && numItems <= to) {
      sum = Number(add || 0);
    } else if (numItems > to) {
      sum = Number(add || 0);
    }
  }
  return sum;
}

export function recalcKPIFrom(fromYMD, rulesInput) {
  const rules = rulesInput || loadRules();
  const from = fromYMD ? new Date(fromYMD) : null;
  const data = getData();
  let changed = 0;

  for (const r of data) {
    const d = r?.date ? new Date(r.date) : null;
    if (!from || (d && d >= from)) {
      r.kpi = computeKPI(r, rules);
      r.updatedAt = new Date().toISOString();
      changed += 1;
    }
  }
  setData(data);
  return changed;
}
