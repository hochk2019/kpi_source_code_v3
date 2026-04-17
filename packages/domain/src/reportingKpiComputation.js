import { DEFAULT_RULES } from "./defaultRules.js";
import { coLineCount } from "./co.js";

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
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

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
    if (!/^\d+(?:\.\d+)?$/.test(normalized)) continue;
    const numeric = Number(normalized);
    if (Number.isFinite(numeric)) {
      info.directCount = Math.max(0, Math.round(numeric));
      return info;
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

function addByTiers(numItems, tiers = [], isCumulative = false) {
  if (!numItems || !tiers?.length) return 0;
  const sorted = [...tiers].sort((a, b) => (a.from || 0) - (b.from || 0));
  let sum = 0;
  for (const tier of sorted) {
    const { from = 0, to = Number.POSITIVE_INFINITY, add = 0 } = tier;
    if (numItems < from) continue;
    if (isCumulative) {
      sum += Number(add || 0);
    } else {
      if (numItems >= from && numItems <= to) {
        sum = Number(add || 0);
        break;
      }
      if (numItems > to) {
        sum = Number(add || 0);
        break;
      }
    }
  }
  return sum;
}

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
    if (group.codes.some((groupCode) => norm(groupCode) === normalized)) {
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

export { DEFAULT_RULES };

export function computeKPI(row, rulesInput) {
  const rules = rulesInput && rulesInput.groups ? rulesInput : DEFAULT_RULES;
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
      if (excludeCodes.has(codeValue) || agencyExcluded.has(codeValue)) continue;
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
